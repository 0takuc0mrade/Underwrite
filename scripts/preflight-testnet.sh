#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

failures=0

pass() {
  printf '[pass] %s\n' "$1"
}

fail() {
  printf '[fail] %s\n' "$1"
  failures=$((failures + 1))
}

check_command() {
  local name="$1"
  local install_hint="${2:-}"
  if command -v "$name" >/dev/null 2>&1; then
    pass "binary: $name"
  else
    fail "binary: $name missing${install_hint:+ ($install_hint)}"
  fi
}

check_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    pass "file: $path"
  else
    fail "file: $path missing"
  fi
}

check_env() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    pass "env: $name"
  else
    fail "env: $name missing"
  fi
}

check_existing_path_env() {
  local name="$1"
  check_env "$name"
  if [[ -n "${!name:-}" ]]; then
    if [[ "${!name}" == /absolute/path/* ]]; then
      fail "env: $name still contains placeholder path"
    elif [[ -f "${!name}" ]]; then
      pass "path: $name points to an existing file"
    else
      fail "path: $name does not point to an existing file"
    fi
  fi
}

phase="${PREFLIGHT_PHASE:-deploy}"
if [[ "$phase" != "deploy" && "$phase" != "demo" ]]; then
  fail "PREFLIGHT_PHASE must be deploy or demo"
fi

echo "==> Underwrite Casper Testnet preflight ($phase phase)"

check_command cargo
check_command rustup
check_command cargo-odra "install with: cargo install cargo-odra"
check_command node
check_command wasm-opt "install Binaryen; npm fallback: npm install -g binaryen"
check_command wasm-strip "install WABT; npm fallback: npm install -g wabt"

if [[ -f .env ]]; then
  pass ".env present"
  set -a
  source .env
  set +a
  rpc_address="${ODRA_CASPER_LIVENET_RPC_ADDRESS:-${ODRA_CASPER_LIVENET_NODE_ADDRESS:-${CASPER_NODE_ADDRESS:-}}}"
  rpc_address="${rpc_address%/}"
  if [[ "$rpc_address" != */rpc ]]; then
    rpc_address="${rpc_address}/rpc"
  fi
  node_base="${rpc_address%/rpc}"
  export ODRA_CASPER_LIVENET_NODE_ADDRESS="$rpc_address"
  export ODRA_CASPER_LIVENET_RPC_ADDRESS="$rpc_address"
  events_url="${ODRA_CASPER_LIVENET_EVENTS_URL:-${node_base}/events}"
  events_url="${events_url%/}"
  if [[ "$events_url" == */events/main ]]; then
    events_url="${events_url%/main}"
  fi
  export ODRA_CASPER_LIVENET_EVENTS_URL="$events_url"
else
  fail ".env missing; copy .env.example to .env and fill Testnet values"
fi

for name in \
  ODRA_CASPER_LIVENET_NODE_ADDRESS \
  ODRA_CASPER_LIVENET_EVENTS_URL \
  ODRA_CASPER_LIVENET_CHAIN_NAME \
  CASPER_NETWORK \
  CASPER_CHAIN_NAME \
  UNDERWRITE_AGENT_ACCOUNT \
  DEMO_CLAIMANT_ACCOUNT \
  UNDERWRITE_ORACLE_PUBLIC_KEY \
  DEPLOYMENT_OUTPUT
do
  check_env "$name"
done

check_existing_path_env ODRA_CASPER_LIVENET_SECRET_KEY_PATH

if [[ "$phase" == "demo" ]]; then
  check_env UNDERWRITE_CONTRACT_ADDRESS
fi

check_file fixtures/risk-attestation.cargo-delay.payload.json
check_file fixtures/signed-risk-attestation.cargo-delay.json

if [[ -f "${DEPLOYMENT_OUTPUT:-deployments/casper-testnet.json}" ]]; then
  pass "deployment evidence: ${DEPLOYMENT_OUTPUT:-deployments/casper-testnet.json}"
elif [[ -f deployments/casper-testnet.example.json ]]; then
  pass "deployment evidence example: deployments/casper-testnet.example.json"
else
  fail "deployment evidence file/example missing"
fi

echo "==> Checking livenet binaries compile"
if cargo check -p underwrite-contracts --features livenet --bins >/tmp/underwrite-preflight-cargo-check.log 2>&1; then
  pass "cargo check livenet bins"
else
  fail "cargo check livenet bins failed; see /tmp/underwrite-preflight-cargo-check.log"
fi

echo "==> Checking agent fixture"
if cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json >/tmp/underwrite-preflight-agent.log 2>&1; then
  if node -e 'const fs=require("fs"); const text=fs.readFileSync("/tmp/underwrite-preflight-agent.log","utf8"); const json=JSON.parse(text.slice(text.indexOf("{"))); if (!json.attestation_hash || !json.claim_attestation) process.exit(1);' >/dev/null 2>&1; then
    pass "agent fixture produces valid attestation"
  else
    fail "agent fixture output missing attestation_hash or claim_attestation"
  fi
else
  fail "agent fixture run failed; see /tmp/underwrite-preflight-agent.log"
fi

if [[ "$failures" -gt 0 ]]; then
  echo "==> Preflight failed with $failures issue(s). Fix these before a real Testnet run."
  exit 1
fi

echo "==> Preflight passed. Ready for the $phase phase."
