import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const ACCOUNT_PATTERN = /^(account-hash-[0-9a-fA-F]{64}|01[0-9a-fA-F]{64}|02[0-9a-fA-F]{66})$/;
export const POLICY_PATTERN = /^[A-Z0-9\-]{5,30}$/;
export const NONCE_PATTERN = /^[a-zA-Z0-9_]{5,40}$/;
export const HEX_PATTERN = /^[0-9a-fA-F]{64}$/;
export const DEMO_EVIDENCE_ID = "demo-scenario-cargo-delay";
export const MAX_REQUESTS_PER_WINDOW = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const REQUEST_ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REQUEST_STORE_TTL_MS = 24 * 60 * 60 * 1000;

export type AgentRequestInput = {
  claimantPublicKey: string;
  policyId: string;
  evidenceHash: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  chainName: string;
  contractHash: string;
  signature: string;
};

export type AgentRequestStoreMetadata = {
  claimantPublicKey?: string;
  policyId?: string;
  evidenceHash?: string;
  createdAt: number;
  expiresAt: number;
};

type StoredRequest = AgentRequestStoreMetadata & {
  id: string;
};

export type AgentRequestStore = {
  hasSeenRequest(requestId: string, now?: number): Promise<boolean>;
  markRequestSeen(requestId: string, metadata: AgentRequestStoreMetadata): Promise<void>;
  cleanupExpiredRequests(now?: number): Promise<void>;
};

export type RateLimitStore = {
  check(key: string, now?: number): boolean;
};

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly records = new Map<string, { count: number; windowStart: number }>();

  check(key: string, now = Date.now()) {
    const record = this.records.get(key);
    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.records.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    record.count += 1;
    return true;
  }
}

export class InMemoryAgentRequestStore implements AgentRequestStore {
  private readonly requests = new Map<string, AgentRequestStoreMetadata>();

  async hasSeenRequest(requestId: string, now = Date.now()) {
    await this.cleanupExpiredRequests(now);
    return this.requests.has(requestId);
  }

  async markRequestSeen(requestId: string, metadata: AgentRequestStoreMetadata) {
    this.requests.set(requestId, metadata);
  }

  async cleanupExpiredRequests(now = Date.now()) {
    for (const [requestId, metadata] of this.requests) {
      if (metadata.expiresAt <= now) {
        this.requests.delete(requestId);
      }
    }
  }
}

export class FileBackedAgentRequestStore implements AgentRequestStore {
  private readonly storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  async hasSeenRequest(requestId: string, now = Date.now()) {
    await this.cleanupExpiredRequests(now);
    const requests = await this.read();
    return requests.some((request) => request.id === requestId);
  }

  async markRequestSeen(requestId: string, metadata: AgentRequestStoreMetadata) {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    const requests = await this.read();
    requests.push({ id: requestId, ...metadata });
    await this.write(requests);
  }

  async cleanupExpiredRequests(now = Date.now()) {
    const requests = await this.read();
    const active = requests.filter((request) => request.expiresAt > now);
    if (active.length !== requests.length) {
      await this.write(active);
    }
  }

  private async read(): Promise<StoredRequest[]> {
    try {
      const text = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isStoredRequest);
    } catch {
      return [];
    }
  }

  private async write(requests: StoredRequest[]) {
    await mkdir(path.dirname(this.storePath), { recursive: true });
    const tmp = `${this.storePath}.tmp`;
    await writeFile(tmp, `${JSON.stringify(requests, null, 2)}\n`);
    await rename(tmp, this.storePath);
  }
}

function isStoredRequest(value: unknown): value is StoredRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.expiresAt === "number"
  );
}

export function parseEnvFile(text: string) {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    env[key] = raw.replace(/^['"]|['"]$/g, "");
  }
  return env;
}

export async function loadEnvFromRepo(repoRoot: string) {
  const envPath = path.join(repoRoot, ".env");
  const fileEnv = existsSync(envPath) ? parseEnvFile(await readFile(envPath, "utf8")) : {};
  return {
    ...process.env,
    ...fileEnv
  };
}

export function validateAgentRequestBody(
  body: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
  now = Date.now()
): { ok: true; value: AgentRequestInput } | { ok: false; status: number; message: string } {
  const claimantPublicKey = String(body.claimantPublicKey || "").trim();
  const policyId = String(body.policyId || "").trim();
  const evidenceHash = String(body.evidenceHash || "").trim();
  const nonce = String(body.nonce || "").trim();
  const issuedAt = Number(body.issuedAt);
  const expiresAt = Number(body.expiresAt);
  const chainName = String(body.chainName || "").trim();
  const contractHash = String(body.contractHash || "").trim();
  const signature = String(body.signature || "").trim();

  if (!policyId) {
    return { ok: false, status: 400, message: "Policy ID is required." };
  }
  if (!POLICY_PATTERN.test(policyId)) {
    return { ok: false, status: 400, message: "Invalid policy ID format." };
  }
  if (!claimantPublicKey) {
    return { ok: false, status: 400, message: "Claimant public key is required." };
  }
  if (!ACCOUNT_PATTERN.test(claimantPublicKey)) {
    return { ok: false, status: 400, message: "Invalid claimant public key." };
  }
  if (!NONCE_PATTERN.test(nonce)) {
    return { ok: false, status: 400, message: "Invalid nonce format." };
  }
  if (!HEX_PATTERN.test(evidenceHash) && evidenceHash !== DEMO_EVIDENCE_ID) {
    return { ok: false, status: 400, message: "Invalid evidence hash or scenario ID." };
  }
  if (!signature) {
    return { ok: false, status: 400, message: "Wallet signature is required." };
  }
  if (Number.isNaN(issuedAt) || Number.isNaN(expiresAt)) {
    return { ok: false, status: 400, message: "Invalid timestamps." };
  }
  if (now > expiresAt) {
    return { ok: false, status: 400, message: "Request has expired." };
  }
  if (now < issuedAt - 60_000) {
    return { ok: false, status: 400, message: "Request issued in the future." };
  }

  const configuredChain = env.ODRA_CASPER_LIVENET_CHAIN_NAME || "casper-test";
  if (chainName !== configuredChain) {
    return { ok: false, status: 400, message: `Request chain mismatch. Expected ${configuredChain}.` };
  }

  const configuredContract = env.UNDERWRITE_CONTRACT_ADDRESS || "";
  const normReqContract = contractHash.replace(/^hash-/, "");
  const normEnvContract = configuredContract.replace(/^hash-/, "");
  if (!normEnvContract || normReqContract !== normEnvContract) {
    return { ok: false, status: 400, message: "Request contract mismatch." };
  }

  return {
    ok: true,
    value: {
      claimantPublicKey,
      policyId,
      evidenceHash,
      nonce,
      issuedAt,
      expiresAt,
      chainName,
      contractHash,
      signature
    }
  };
}

export function buildAgentRequestMessage(input: AgentRequestInput) {
  return [
    "Underwrite Agent Verification Request",
    `Chain: ${input.chainName}`,
    `Contract: ${input.contractHash}`,
    `Policy: ${input.policyId}`,
    `Claimant: ${input.claimantPublicKey}`,
    `Evidence: ${input.evidenceHash}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires At: ${input.expiresAt}`
  ].join("\n");
}

export function explorerUrl(hash: string, env: NodeJS.ProcessEnv) {
  const base = env.CASPER_EXPLORER_BASE_URL || "https://testnet.cspr.live";
  return `${base.replace(/\/$/, "")}/transaction/${hash}`;
}

export function extractDeployHash(output: string) {
  const matches = Array.from(output.matchAll(/Transaction "([0-9a-fA-F]{64})"/g));
  return matches.at(-1)?.[1];
}

export function safeOutput(output: string) {
  return output
    .split(/\r?\n/)
    .filter((line) => !/SECRET|KEY_PATH|PRIVATE|\.pem|\/home\/[^/\s]+/i.test(line))
    .slice(-18)
    .join("\n");
}

export async function cleanupRequestArtifacts(requestsDir: string, now = Date.now(), ttlMs = REQUEST_ARTIFACT_TTL_MS) {
  let entries: Array<{ isFile(): boolean; name: string }>;
  try {
    entries = (await readdir(requestsDir, { withFileTypes: true })) as Array<{ isFile(): boolean; name: string }>;
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => /^req_[a-zA-Z0-9_]+-(payload|fixture|attestation)\.json$/.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(requestsDir, entry.name);
        const metadata = await stat(filePath);
        if (now - metadata.mtimeMs > ttlMs) {
          await unlink(filePath).catch(() => undefined);
        }
      })
  );
}
