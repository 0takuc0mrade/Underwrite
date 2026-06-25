#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const output = resolve(
  process.env.DEPLOYMENT_OUTPUT ?? "deployments/casper-testnet.json",
);

const defaults = {
  network: process.env.CASPER_NETWORK ?? "casper-testnet",
  chainName: process.env.CASPER_CHAIN_NAME ?? "casper-test",
  nodeAddress:
    process.env.CASPER_NODE_ADDRESS ??
    process.env.ODRA_CASPER_LIVENET_RPC_ADDRESS ??
    "https://node.testnet.casper.network/rpc",
  underwriteContract: "",
  settlementToken: "",
  vault: "",
  coverageTemplate: "cargo_delay",
  policyId: "MRC-CRG-2026-00481",
  coveredSubject: "MAEU-784239160",
  riskEvent: "cargo_delay",
  triggerMetric: "delay_hours",
  triggerValue: 75,
  agentAccount: process.env.UNDERWRITE_AGENT_ACCOUNT ?? "",
  claimantAccount: process.env.DEMO_CLAIMANT_ACCOUNT ?? "",
  oraclePublicKey:
    process.env.UNDERWRITE_ORACLE_PUBLIC_KEY ??
    "fd1724385aa0c75b64fb78cd602fa1d991fdebf76b13c58ed702eac835e9f618",
  validClaimAttestationHash: "",
  validClaimDeployHash: "",
  duplicateClaimDeployHash: "",
  staleOrInvalidClaimDeployHash: "",
  payoutAmountMinor: 6250000,
  timestamp: "",
  explorerLinks: {
    underwriteContract: "",
    settlementToken: "",
    validClaim: "",
    duplicateClaim: "",
    staleOrInvalidClaim: "",
  },
  notes: [],
};

const aliases = {
  contract: "underwriteContract",
  token: "settlementToken",
  vault: "vault",
  policy: "policyId",
  policyId: "policyId",
  agent: "agentAccount",
  claimant: "claimantAccount",
  oracle: "oraclePublicKey",
  attestation: "validClaimAttestationHash",
  validDeploy: "validClaimDeployHash",
  duplicateDeploy: "duplicateClaimDeployHash",
  staleDeploy: "staleOrInvalidClaimDeployHash",
  payout: "payoutAmountMinor",
};

function readCurrent() {
  if (!existsSync(output)) return defaults;
  const existing = JSON.parse(readFileSync(output, "utf8"));
  return {
    ...defaults,
    ...existing,
    explorerLinks: {
      ...defaults.explorerLinks,
      ...(existing.explorerLinks ?? {}),
    },
  };
}

function parseValue(raw) {
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function setPath(target, key, value) {
  const normalized = aliases[key] ?? key;
  if (normalized.startsWith("explorerLinks.")) {
    const linkKey = normalized.slice("explorerLinks.".length);
    target.explorerLinks[linkKey] = value;
    return;
  }
  target[normalized] = value;
}

function usage() {
  console.log(`Usage:
  node scripts/record-evidence.mjs init
  node scripts/record-evidence.mjs set key=value [key=value...]
  node scripts/record-evidence.mjs note "text"

Examples:
  node scripts/record-evidence.mjs init
  node scripts/record-evidence.mjs set contract=hash-... token=hash-...
  node scripts/record-evidence.mjs set attestation=3f74... validDeploy=...
  node scripts/record-evidence.mjs set explorerLinks.validClaim=https://...
`);
}

const [command, ...args] = process.argv.slice(2);
if (!command || command === "-h" || command === "--help") {
  usage();
  process.exit(command ? 0 : 1);
}

const current = readCurrent();
current.timestamp = new Date().toISOString();

if (command === "init") {
  // Keep defaults plus environment-derived values.
} else if (command === "set") {
  for (const arg of args) {
    const index = arg.indexOf("=");
    if (index === -1) {
      throw new Error(`Expected key=value, got: ${arg}`);
    }
    const key = arg.slice(0, index);
    const value = parseValue(arg.slice(index + 1));
    setPath(current, key, value);
  }
} else if (command === "note") {
  const note = args.join(" ").trim();
  if (!note) throw new Error("note text is required");
  current.notes = [...(current.notes ?? []), note];
} else {
  usage();
  throw new Error(`Unknown command: ${command}`);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(current, null, 2)}\n`);
console.log(`Updated ${output}`);
