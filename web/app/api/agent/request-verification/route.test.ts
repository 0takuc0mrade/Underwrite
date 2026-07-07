import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { FileBackedAgentRequestStore, InMemoryRateLimitStore } from "../../../../lib/agent-request.ts";
import { createAgentRequestHandler } from "../../../../lib/agent-request-handler.ts";

const NOW = 1_783_380_000_000;
const PUBLIC_KEY = "01fd1724385aa0c75b64fb78cd602fa1d991fdebf76b13c58ed702eac835e9f618";
const CONTRACT = "hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f";
const DEPLOY_HASH = "e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b";

type CommandCall = {
  command: string;
  args: string[];
};

async function makeRepo() {
  const root = await mkdtemp(path.join(tmpdir(), "underwrite-agent-request-"));
  await mkdir(path.join(root, "fixtures"), { recursive: true });
  await mkdir(path.join(root, "deployments", "requests"), { recursive: true });
  await writeFile(
    path.join(root, "fixtures", "risk-attestation.cargo-delay.payload.json"),
    JSON.stringify(
      {
        policy_id: "MRC-CRG-2026-00481",
        claimant: "account-hash-0000000000000000000000000000000000000000000000000000000000000000",
        evidence_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        nonce: "template_nonce",
        observed_at: 1_700_000_000,
        expires_at: 1_700_086_400
      },
      null,
      2
    )
  );
  return root;
}

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    UNDERWRITE_ENABLE_AGENT_REQUESTS: "true",
    ODRA_CASPER_LIVENET_CHAIN_NAME: "casper-test",
    UNDERWRITE_CONTRACT_ADDRESS: CONTRACT,
    CASPER_EXPLORER_BASE_URL: "https://testnet.cspr.live",
    ...overrides
  } as unknown as NodeJS.ProcessEnv;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    claimantPublicKey: PUBLIC_KEY,
    policyId: "MRC-CRG-2026-00481",
    evidenceHash: "demo-scenario-cargo-delay",
    nonce: `req_${NOW}_abc123`,
    issuedAt: NOW,
    expiresAt: NOW + 15 * 60 * 1000,
    chainName: "casper-test",
    contractHash: CONTRACT,
    signature: "01".repeat(64),
    ...overrides
  };
}

function jsonRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/agent/request-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function invoke(options: {
  body?: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
  verify?: boolean;
  repoRoot?: string;
  commandCalls?: CommandCall[];
} = {}) {
  const repoRoot = options.repoRoot ?? (await makeRepo());
  const commandCalls = options.commandCalls ?? [];
  const handler = createAgentRequestHandler({
    repoRoot,
    now: () => NOW,
    loadEnv: async () => options.env ?? env(),
    requestStore: new FileBackedAgentRequestStore(path.join(repoRoot, "deployments", "requests", "request-store.json")),
    rateLimitStore: new InMemoryRateLimitStore(),
    verifySignature: () => options.verify ?? true,
    publicKeyToAccountHash: () => "account-hash-1111111111111111111111111111111111111111111111111111111111111111",
    runCommand: async (command, args) => {
      commandCalls.push({ command, args });
      if (command === "cargo") {
        return {
          code: 0,
          output: `Compiling...\n${JSON.stringify({ signed: true, claim_id: "claim-1" })}\n`
        };
      }
      if (command === "scripts/run-agent.sh") {
        return { code: 0, output: JSON.stringify({ ok: true }) };
      }
      if (command === "scripts/submit-valid-claim.sh") {
        return { code: 0, output: `Transaction "${DEPLOY_HASH}" successfully executed.` };
      }
      throw new Error(`unexpected command ${command}`);
    }
  });
  const response = await handler(jsonRequest(options.body ?? validBody()));
  return { response, body: await response.json(), commandCalls, repoRoot };
}

test("route is disabled unless UNDERWRITE_ENABLE_AGENT_REQUESTS is true", async () => {
  const { response, body, commandCalls } = await invoke({
    env: env({ UNDERWRITE_ENABLE_AGENT_REQUESTS: "false" })
  });
  assert.equal(response.status, 503);
  assert.equal(body.status, "not_configured");
  assert.equal(commandCalls.length, 0);
});

test("malformed JSON body is rejected", async () => {
  const handler = createAgentRequestHandler({
    repoRoot: await makeRepo(),
    loadEnv: async () => env(),
    now: () => NOW
  });
  const response = await handler(new Request("http://localhost", { method: "POST", body: "{" }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.message, "Invalid JSON body.");
});

test("missing policy ID is rejected", async () => {
  const { response, body, commandCalls } = await invoke({ body: validBody({ policyId: "" }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Policy ID is required.");
  assert.equal(commandCalls.length, 0);
});

test("invalid policy ID format is rejected", async () => {
  const { response, body } = await invoke({ body: validBody({ policyId: "bad policy id" }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Invalid policy ID format.");
});

test("missing claimant is rejected", async () => {
  const { response, body } = await invoke({ body: validBody({ claimantPublicKey: "" }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Claimant public key is required.");
});

test("invalid claimant public key is rejected", async () => {
  const { response, body } = await invoke({ body: validBody({ claimantPublicKey: "not-a-key" }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Invalid claimant public key.");
});

test("missing signature is rejected", async () => {
  const { response, body } = await invoke({ body: validBody({ signature: "" }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Wallet signature is required.");
});

test("expired request is rejected", async () => {
  const { response, body } = await invoke({ body: validBody({ expiresAt: NOW - 1 }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Request has expired.");
});

test("request too far in the future is rejected", async () => {
  const { response, body } = await invoke({ body: validBody({ issuedAt: NOW + 120_000 }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Request issued in the future.");
});

test("invalid signature is rejected", async () => {
  const { response, body, commandCalls } = await invoke({ verify: false });
  assert.equal(response.status, 401);
  assert.equal(body.message, "Invalid wallet signature.");
  assert.equal(commandCalls.length, 0);
});

test("unsupported scenario or evidence ID is rejected", async () => {
  const { response, body } = await invoke({ body: validBody({ evidenceHash: "totally-unsupported" }) });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Invalid evidence hash or scenario ID.");
});

test("reused nonce is rejected", async () => {
  const repoRoot = await makeRepo();
  const first = await invoke({ repoRoot });
  assert.equal(first.response.status, 200);

  const second = await invoke({ repoRoot });
  assert.equal(second.response.status, 400);
  assert.equal(second.body.message, "Request nonce has already been used.");
  assert.equal(second.commandCalls.length, 0);
});

test("valid request reaches safe execution path", async () => {
  const commandCalls: CommandCall[] = [];
  const { response, body } = await invoke({ commandCalls });
  assert.equal(response.status, 200);
  assert.equal(body.deployHash, DEPLOY_HASH);
  assert.equal(commandCalls.length, 3);
  assert.deepEqual(commandCalls.map((call) => call.command), [
    "cargo",
    "scripts/run-agent.sh",
    "scripts/submit-valid-claim.sh"
  ]);
  for (const call of commandCalls) {
    assert.equal(call.args.some((arg) => arg.includes(PUBLIC_KEY)), false);
    assert.equal(call.args.some((arg) => arg.includes(";")), false);
    assert.equal(call.args.some((arg) => path.isAbsolute(arg)), false);
  }
});

test("script execution is not called with raw unsanitized user input", async () => {
  const { response, body, commandCalls } = await invoke({
    body: validBody({ nonce: "req_bad;rm-rf" })
  });
  assert.equal(response.status, 400);
  assert.equal(body.message, "Invalid nonce format.");
  assert.equal(commandCalls.length, 0);
});
