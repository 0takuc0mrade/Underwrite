import { spawn } from "node:child_process";
import { createHash, createPublicKey, verify as verifyNodeSignature } from "node:crypto";
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
  return loadCasperSdk().then(async ({ CLPublicKey, verifyMessageSignature }) => {
    if (input.claimantPublicKey.startsWith("account-hash-")) return false;

    let publicKey: unknown;
    try {
      publicKey = CLPublicKey.fromHex(input.claimantPublicKey);
    } catch {
      return false;
    }

    const candidates = signatureByteCandidates(input.signature);
    if (candidates.length === 0) return false;

    for (const sigBytes of candidates) {
      try {
        if (verifyMessageSignature(publicKey, message, sigBytes)) return true;
      } catch {
        // Try the next normalized representation before reporting failure.
      }
    }

    return (
      verifyRawEd25519Signature(input.claimantPublicKey, message, candidates) ||
      (await verifyRawSecp256k1Signature(input.claimantPublicKey, message, candidates))
    );
  });
}

function verifyRawEd25519Signature(publicKeyHex: string, message: string, candidates: Uint8Array[]) {
  try {
    if (!publicKeyHex.startsWith("01")) return false;

    const rawPublicKey = Buffer.from(publicKeyHex.slice(2), "hex");
    if (rawPublicKey.length !== 32) return false;

    // Ed25519 SubjectPublicKeyInfo header for a raw 32-byte public key.
    const spkiHeader = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = createPublicKey({
      key: Buffer.concat([spkiHeader, rawPublicKey]),
      format: "der",
      type: "spki"
    });
    const rawMessage = Buffer.from(message, "utf8");

    return candidates.some((signature) => {
      try {
        return signature.length === 64 && verifyNodeSignature(null, rawMessage, publicKey, signature);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

async function verifyRawSecp256k1Signature(publicKeyHex: string, message: string, candidates: Uint8Array[]) {
  try {
    if (!publicKeyHex.startsWith("02")) return false;

    const publicKey = Buffer.from(publicKeyHex.slice(2), "hex");
    if (publicKey.length !== 33) return false;

    const { verify } = await import("@noble/secp256k1");
    const messageHash = createHash("sha256").update(Buffer.from(message, "utf8")).digest();

    return candidates.some((signature) => {
      try {
        return verify(signature, messageHash, publicKey, { strict: false });
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function signatureByteCandidates(signature: string) {
  const normalized = signature.trim().replace(/^0x/i, "");
  const hexCandidates = new Set<string>();
  addHexCandidate(hexCandidates, normalized);

  // Older browser code accidentally hex-encoded the ASCII signature string.
  // Accepting the decoded form lets in-flight clients recover after redeploys
  // without weakening verification: the cryptographic check still has to pass.
  if (normalized.length > 130 && normalized.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(normalized)) {
    addHexCandidate(hexCandidates, Buffer.from(normalized, "hex").toString("utf8").trim().replace(/^0x/i, ""));
  }

  const byteCandidates = new Map<string, Uint8Array>();
  for (const hex of hexCandidates) {
    const bytes = Uint8Array.from(Buffer.from(hex, "hex"));
    byteCandidates.set(Buffer.from(bytes).toString("hex"), bytes);
    if (bytes.length === 65 && (bytes[0] === 1 || bytes[0] === 2)) {
      const withoutAlgorithmByte = bytes.slice(1);
      byteCandidates.set(Buffer.from(withoutAlgorithmByte).toString("hex"), withoutAlgorithmByte);
    }
  }

  return Array.from(byteCandidates.values());
}

function addHexCandidate(candidates: Set<string>, value: string) {
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    candidates.add(value.toLowerCase());
  }
}

async function defaultPublicKeyToAccountHash(publicKeyHex: string) {
  const { CLPublicKey } = await loadCasperSdk();
  const publicKeyObj = CLPublicKey.fromHex(publicKeyHex);
  const accountHashHex = Buffer.from(publicKeyObj.toAccountHash()).toString("hex");
  return `account-hash-${accountHashHex}`;
}

async function loadCasperSdk(): Promise<CasperSdkHelpers> {
  const sdkModule = (await import("casper-js-sdk")) as unknown as CasperSdkModule;
  const sdk = sdkModule.default ?? sdkModule;
  if (!sdk?.CLPublicKey || !sdk.verifyMessageSignature) {
    throw new Error("Casper SDK wallet verification helpers are unavailable.");
  }
  return sdk as CasperSdkHelpers;
}

type CasperSdkHelpers = {
  CLPublicKey: { fromHex(publicKeyHex: string): { toAccountHash(): Uint8Array } };
  verifyMessageSignature: (
    publicKey: unknown,
    message: string,
    signatureBytes: Uint8Array
  ) => boolean;
};

type CasperSdkModule = Partial<CasperSdkHelpers> & {
  default?: CasperSdkHelpers;
};

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

function errorJson(status: number, code: string, message: string) {
  return json(status, { status: "error", code, message });
}

function validationCode(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("policy")) return "invalid_policy";
  if (normalized.includes("claimant")) return "invalid_claimant";
  if (normalized.includes("nonce")) return "invalid_nonce";
  if (normalized.includes("evidence")) return "invalid_evidence";
  if (normalized.includes("signature")) return "invalid_signature";
  if (normalized.includes("timestamp") || normalized.includes("expired") || normalized.includes("future")) {
    return "invalid_timestamp";
  }
  if (normalized.includes("chain")) return "chain_mismatch";
  if (normalized.includes("contract")) return "contract_mismatch";
  return "invalid_request";
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Agent workflow failed.";
  return safeOutput(message) || "Agent workflow failed.";
}

function safeVerificationDetail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return safeOutput(message).slice(0, 140) || "unknown verifier error";
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
      return errorJson(400, "invalid_json", "Invalid JSON body.");
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
      return errorJson(validation.status, validationCode(validation.message), validation.message);
    }
    const input = validation.value;

    if (!rateLimitStore.check(input.claimantPublicKey, now())) {
      return errorJson(429, "rate_limited", "Rate limit exceeded. Please try again later.");
    }

    await requestStore.cleanupExpiredRequests(now());
    if (await requestStore.hasSeenRequest(input.nonce, now())) {
      return errorJson(400, "nonce_replayed", "Request nonce has already been used.");
    }

    const message = buildAgentRequestMessage(input);
    try {
      if (!(await verifySignature(input, message))) {
        return errorJson(401, "invalid_wallet_signature", "Invalid wallet signature.");
      }
    } catch (error) {
      return json(400, {
        status: "error",
        code: "signature_verification_failed",
        message: "Signature verification failed.",
        detail: safeVerificationDetail(error)
      });
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
