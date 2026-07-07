#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
else
  echo "No .env file found; using existing environment variables."
fi

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
export ODRA_LOG_LEVEL="${ODRA_LOG_LEVEL:-debug}"

: "${ODRA_CASPER_LIVENET_NODE_ADDRESS:?missing ODRA_CASPER_LIVENET_NODE_ADDRESS}"
: "${ODRA_CASPER_LIVENET_EVENTS_URL:?missing ODRA_CASPER_LIVENET_EVENTS_URL}"
: "${ODRA_CASPER_LIVENET_CHAIN_NAME:?missing ODRA_CASPER_LIVENET_CHAIN_NAME}"
: "${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:?missing ODRA_CASPER_LIVENET_SECRET_KEY_PATH}"
: "${UNDERWRITE_CONTRACT_ADDRESS:?missing UNDERWRITE_CONTRACT_ADDRESS}"
: "${DEMO_CLAIMANT_ACCOUNT:?missing DEMO_CLAIMANT_ACCOUNT}"
: "${UNDERWRITE_ORACLE_PUBLIC_KEY:?missing UNDERWRITE_ORACLE_PUBLIC_KEY}"

policy_id="${UNDERWRITE_POLICY_ID:-MRC-CRG-2026-00481}"
risk_fixture="${UNDERWRITE_RISK_FIXTURE_PATH:-fixtures/signed-risk-attestation.cargo-delay.json}"

echo "==> Registering policy $policy_id on Casper Testnet"
cargo run -p underwrite-contracts --features livenet --bin register_policy_testnet

claimant="$(node -e "const fs=require('fs'); const path='$risk_fixture'; if (fs.existsSync(path)) { const json=JSON.parse(fs.readFileSync(path,'utf8')); console.log(json.claimant ?? '') }")"

if [[ -n "$claimant" ]]; then
  node scripts/record-evidence.mjs set \
    policyId="$policy_id" \
    claimant="$claimant" \
    oracle="$UNDERWRITE_ORACLE_PUBLIC_KEY"
else
  node scripts/record-evidence.mjs set \
    policyId="$policy_id" \
    oracle="$UNDERWRITE_ORACLE_PUBLIC_KEY"
fi

node scripts/record-evidence.mjs note "policy registration submitted through register_policy_testnet; capture explorer deploy hash manually if Odra output does not expose it"

echo "==> Policy registration helper completed"
