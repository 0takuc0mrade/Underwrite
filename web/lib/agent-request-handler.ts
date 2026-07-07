import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEMO_EVIDENCE_ID,
  FileBackedAgentRequestStore,
  InMemoryAgentRequestStore,
  InMemoryRateLimitStore,
  REQUEST_STORE_TTL_MS,
  buildAgentRequestMessage,
  cleanupRequestArtifacts,
  explorerUrl,
  extractDeployHash,
  loadEnvFromRepo,
  safeOutput,
  validateAgentRequestBody,
  type AgentRequestInput,
  type AgentRequestStore,
  type RateLimitStore
} from "./agent-request.ts";

type CommandRunner = (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
) => Promise<{ output: string; code: number }>;

type VerifySignature = (input: AgentRequestInput, message: string) => Promise<boolean> | boolean;
type PublicKeyToAccountHash = (publicKeyHex: string) => Promise<string> | string;

type HandlerDeps = {
  repoRoot?: string;
  loadEnv?: () => Promise<NodeJS.ProcessEnv>;
  runCommand?: CommandRunner;
  verifySignature?: VerifySignature;
  publicKeyToAccountHash?: PublicKeyToAccountHash;
  requestStore?: AgentRequestStore;
  rateLimitStore?: RateLimitStore;
  now?: () => number;
};

const repoRoot = path.resolve(process.cwd(), "..");
const defaultRateLimitStore = new InMemoryRateLimitStore();

function defaultRequestStore(root: string): AgentRequestStore {
  try {
    return new FileBackedAgentRequestStore(path.join(root, "deployments", "requests", "request-store.json"));
  } catch {
    // MVP/demo fallback only. Production should use durable storage such as
    // Redis, Postgres, or SQLite for replay-safe request idempotency.
    return new InMemoryAgentRequestStore();
  }
}

async function defaultRunCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ output: string; code: number }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} timed out after 10 minutes`));
    }, 10 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(new Error(safeOutput(output)));
        return;
      }
      resolve({ output, code: exitCode });
    });
  });
}

function defaultVerifySignature(input: AgentRequestInput, message: string) {
  return loadCasperSdk().then(({ CLPublicKey, verifyMessageSignature }) => {
    const publicKey = CLPublicKey.fromHex(input.claimantPublicKey);
    let sigBytes = Uint8Array.from(Buffer.from(input.signature, "hex"));
    if (sigBytes.length === 65) {
      sigBytes = sigBytes.slice(1);
    }
    return verifyMessageSignature(publicKey, message, sigBytes);
  });
}

async function defaultPublicKeyToAccountHash(publicKeyHex: string) {
  const { CLPublicKey } = await loadCasperSdk();
  const publicKeyObj = CLPublicKey.fromHex(publicKeyHex);
  const accountHashHex = Buffer.from(publicKeyObj.toAccountHash()).toString("hex");
  return `account-hash-${accountHashHex}`;
}

async function loadCasperSdk() {
  const sdkModule = (await import("casper-js-sdk")) as unknown as {
    default?: {
      CLPublicKey: { fromHex(publicKeyHex: string): { toAccountHash(): Uint8Array } };
      verifyMessageSignature: (
        publicKey: unknown,
        message: string,
        signatureBytes: Uint8Array
      ) => boolean;
    };
  };
  const sdk = sdkModule.default;
  if (!sdk?.CLPublicKey || !sdk.verifyMessageSignature) {
    throw new Error("Casper SDK wallet verification helpers are unavailable.");
  }
  return sdk;
}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Agent workflow failed.";
  return safeOutput(message) || "Agent workflow failed.";
}

export function createAgentRequestHandler(deps: HandlerDeps = {}) {
  const root = deps.repoRoot ?? repoRoot;
  const requestsDir = path.join(root, "deployments", "requests");
  const loadEnv = deps.loadEnv ?? (() => loadEnvFromRepo(root));
  const runCommand = deps.runCommand ?? defaultRunCommand;
  const verifySignature = deps.verifySignature ?? defaultVerifySignature;
  const publicKeyToAccountHash = deps.publicKeyToAccountHash ?? defaultPublicKeyToAccountHash;
  const requestStore = deps.requestStore ?? defaultRequestStore(root);
  const rateLimitStore = deps.rateLimitStore ?? defaultRateLimitStore;
  const now = deps.now ?? (() => Date.now());

  return async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(400, { status: "error", message: "Invalid JSON body." });
    }

    const env = await loadEnv();
    if (env.UNDERWRITE_ENABLE_AGENT_REQUESTS !== "true") {
      return json(503, {
        status: "not_configured",
        message:
          "Agent requests are disabled on this deployment. Enable UNDERWRITE_ENABLE_AGENT_REQUESTS=true only when the server is configured for public agent requests."
      });
    }

    const validation = validateAgentRequestBody(body, env, now());
    if (!validation.ok) {
      return json(validation.status, { status: "error", message: validation.message });
    }
    const input = validation.value;

    if (!rateLimitStore.check(input.claimantPublicKey, now())) {
      return json(429, { status: "error", message: "Rate limit exceeded. Please try again later." });
    }

    await requestStore.cleanupExpiredRequests(now());
    if (await requestStore.hasSeenRequest(input.nonce, now())) {
      return json(400, { status: "error", message: "Request nonce has already been used." });
    }

    const message = buildAgentRequestMessage(input);
    try {
      if (!(await verifySignature(input, message))) {
        return json(401, { status: "error", message: "Invalid wallet signature." });
      }
    } catch {
      return json(400, { status: "error", message: "Signature verification failed." });
    }

    await requestStore.markRequestSeen(input.nonce, {
      claimantPublicKey: input.claimantPublicKey,
      policyId: input.policyId,
      evidenceHash: input.evidenceHash,
      createdAt: now(),
      expiresAt: now() + REQUEST_STORE_TTL_MS
    });

    try {
      await mkdir(requestsDir, { recursive: true });
      await cleanupRequestArtifacts(requestsDir, now());

      const payloadPath = path.join(requestsDir, `${input.nonce}-payload.json`);
      const requestFixturePath = path.join(requestsDir, `${input.nonce}-fixture.json`);
      const requestAttestationPath = path.join(requestsDir, `${input.nonce}-attestation.json`);
      const defaultPayloadPath = path.join(root, "fixtures", "risk-attestation.cargo-delay.payload.json");
      const templateContent = JSON.parse(await readFile(defaultPayloadPath, "utf8"));

      const claimantAccountHash = await publicKeyToAccountHash(input.claimantPublicKey);
      const observedAt = Math.floor(input.issuedAt / 1000);

      const requestPayload = {
        ...templateContent,
        policy_id: input.policyId,
        claimant: claimantAccountHash,
        evidence_hash: input.evidenceHash === DEMO_EVIDENCE_ID ? templateContent.evidence_hash : input.evidenceHash,
        nonce: input.nonce,
        observed_at: observedAt,
        expires_at: observedAt + 86400 * 7
      };

      await writeFile(payloadPath, JSON.stringify(requestPayload, null, 2));

      const { output: signOutput } = await runCommand(
        "cargo",
        ["run", "-p", "underwrite-agent", "--", "sign-risk", path.relative(root, payloadPath)],
        env
      );
      const jsonStartIdx = signOutput.indexOf("{");
      if (jsonStartIdx === -1) {
        throw new Error("Failed to generate signed oracle evidence.");
      }
      await writeFile(requestFixturePath, signOutput.slice(jsonStartIdx));

      await runCommand(
        "scripts/run-agent.sh",
        [path.relative(root, requestFixturePath), path.relative(root, requestAttestationPath)],
        env
      );

      const { output: submitOutput } = await runCommand(
        "scripts/submit-valid-claim.sh",
        [path.relative(root, requestAttestationPath)],
        env
      );

      const deployHash = extractDeployHash(submitOutput);
      if (!deployHash) {
        throw new Error("Failed to extract deploy hash from submission output.");
      }

      return json(200, {
        status: "success",
        message: "Agent verified evidence and submitted the settlement claim.",
        deployHash,
        explorerUrl: explorerUrl(deployHash, env),
        outputPath: path.relative(root, requestAttestationPath),
        outputTail: safeOutput(submitOutput)
      });
    } catch (error) {
      return json(500, {
        status: "error",
        message: safeErrorMessage(error)
      });
    }
  };
}
