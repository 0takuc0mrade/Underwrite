import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OperationAction = "register_policy" | "run_agent" | "submit_claim";

const ACTIONS = new Set<OperationAction>(["register_policy", "run_agent", "submit_claim"]);
const ACCOUNT_PATTERN = /^(account-hash-[0-9a-fA-F]{64}|01[0-9a-fA-F]{64}|02[0-9a-fA-F]{66})$/;
const SAFE_PATH_PATTERN = /^[a-zA-Z0-9._/\-]+$/;
const repoRoot = path.resolve(process.cwd(), "..");

function parseEnvFile(text: string) {
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

async function loadOperatorEnv() {
  const envPath = path.join(repoRoot, ".env");
  const fileEnv = existsSync(envPath) ? parseEnvFile(await readFile(envPath, "utf8")) : {};
  return {
    ...process.env,
    ...fileEnv
  };
}

function explorerUrl(hash: string, env: NodeJS.ProcessEnv) {
  const base = env.CASPER_EXPLORER_BASE_URL || "https://testnet.cspr.live";
  return `${base.replace(/\/$/, "")}/transaction/${hash}`;
}

function extractDeployHash(output: string) {
  const matches = Array.from(output.matchAll(/Transaction "([0-9a-fA-F]{64})"/g));
  return matches.at(-1)?.[1];
}

function safeOutput(output: string) {
  return output
    .split(/\r?\n/)
    .filter((line) => !/SECRET|KEY_PATH|PRIVATE|\.pem/i.test(line))
    .slice(-18)
    .join("\n");
}

function safeRepoPath(value: unknown, fallback: string) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (path.isAbsolute(raw) || raw.includes("..") || !SAFE_PATH_PATTERN.test(raw)) {
    throw new Error("Path must be a safe repo-relative path.");
  }
  if (!raw.startsWith("fixtures/") && !raw.startsWith("deployments/")) {
    throw new Error("Path must be inside fixtures/ or deployments/.");
  }
  return raw;
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
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

async function runOperation(action: OperationAction, body: Record<string, unknown>, env: NodeJS.ProcessEnv) {
  const timestamp = new Date().toISOString();

  if (action === "run_agent") {
    const signedRiskPath = safeRepoPath(body.signedRiskPath, "fixtures/signed-risk-attestation.cargo-delay.json");
    const outputPath = safeRepoPath(body.outputPath, "deployments/latest-attestation.json");
    const { output } = await runCommand("scripts/run-agent.sh", [signedRiskPath, outputPath], env);
    return {
      action,
      status: "success",
      message: "Agent verification completed and wrote an attestation report.",
      timestamp,
      outputPath,
      outputTail: safeOutput(output)
    };
  }

  if (action === "register_policy") {
    const claimantAccount = typeof body.claimantAccount === "string" ? body.claimantAccount.trim() : "";
    if (!ACCOUNT_PATTERN.test(claimantAccount)) {
      throw new Error("Enter a valid Casper account-hash or public key for the claimant.");
    }

    const policyId = typeof body.policyId === "string" && body.policyId.trim() ? body.policyId.trim() : "MRC-CRG-2026-00481";
    const insuredValueMinor = Number(body.insuredValueMinor || 12_500_000);
    if (!Number.isSafeInteger(insuredValueMinor) || insuredValueMinor <= 0) {
      throw new Error("insuredValueMinor must be a positive integer.");
    }

    const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "USD";
    const operatorDir = path.join(repoRoot, "deployments", "operator");
    await mkdir(operatorDir, { recursive: true });
    const fixturePath = path.join(operatorDir, `policy-${Date.now()}.json`);
    await writeFile(
      fixturePath,
      `${JSON.stringify({ claimant: claimantAccount, insured_value_minor: insuredValueMinor }, null, 2)}\n`
    );

    const commandEnv = {
      ...env,
      UNDERWRITE_POLICY_ID: policyId,
      UNDERWRITE_RISK_FIXTURE_PATH: path.relative(repoRoot, fixturePath),
      DEMO_CLAIMANT_ACCOUNT: claimantAccount,
      UNDERWRITE_INSURED_VALUE_MINOR: String(insuredValueMinor),
      UNDERWRITE_POLICY_CURRENCY: currency
    };
    const { output } = await runCommand("scripts/register-policy.sh", [], commandEnv);
    const deployHash = extractDeployHash(output);
    return {
      action,
      status: "success",
      message: "Policy registration transaction was submitted through the server-side operator.",
      timestamp,
      deployHash,
      explorerUrl: deployHash ? explorerUrl(deployHash, env) : undefined,
      outputPath: path.relative(repoRoot, fixturePath),
      outputTail: safeOutput(output)
    };
  }

  const attestationPath = safeRepoPath(body.attestationPath, "deployments/latest-attestation.json");
  const { output } = await runCommand("scripts/submit-valid-claim.sh", [attestationPath], env);
  const deployHash = extractDeployHash(output);
  return {
    action,
    status: "success",
    message: "Claim attestation was submitted to the Underwrite settlement contract.",
    timestamp,
    deployHash,
    explorerUrl: deployHash ? explorerUrl(deployHash, env) : undefined,
    outputPath: attestationPath,
    outputTail: safeOutput(output)
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString(), message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const action = body.action;
  if (!ACTIONS.has(action as OperationAction)) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        message: "Choose a supported Underwrite operation."
      },
      { status: 400 }
    );
  }

  const env = await loadOperatorEnv();
  if (env.UNDERWRITE_ENABLE_OPERATOR_ACTIONS !== "true") {
    return NextResponse.json(
      {
        status: "not_configured",
        action,
        timestamp: new Date().toISOString(),
        message:
          "Operator actions are disabled on this deployment for key safety. You can still inspect real Testnet proof. Run locally with your own Testnet key and set UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true to execute actions."
      },
      { status: 503 }
    );
  }

  if (!existsSync(path.join(repoRoot, ".env"))) {
    return NextResponse.json(
      {
        status: "not_configured",
        action,
        timestamp: new Date().toISOString(),
        message: "Server-side .env is missing. The browser never receives private keys; configure the local server .env first."
      },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json(await runOperation(action as OperationAction, body, env));
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        action,
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Underwrite operation failed."
      },
      { status: 500 }
    );
  }
}
