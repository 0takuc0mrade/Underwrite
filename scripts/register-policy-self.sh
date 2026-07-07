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
: "${UNDERWRITE_ORACLE_PUBLIC_KEY:?missing UNDERWRITE_ORACLE_PUBLIC_KEY}"

policy_id="${UNDERWRITE_POLICY_ID:-MRC-CRG-2026-00481}"
claimant="${UNDERWRITE_SELF_CLAIMANT_ACCOUNT:-${DEMO_CLAIMANT_ACCOUNT:-}}"
if [[ -z "$claimant" ]]; then
  echo "Missing UNDERWRITE_SELF_CLAIMANT_ACCOUNT or DEMO_CLAIMANT_ACCOUNT."
  echo "The self-registration contract path requires claimant to equal the transaction caller."
  exit 1
fi
export UNDERWRITE_SELF_CLAIMANT_ACCOUNT="$claimant"

echo "==> Self-registering policy $policy_id on Casper Testnet"
echo "==> This succeeds only when UNDERWRITE_SELF_CLAIMANT_ACCOUNT is the signer/caller."
cargo run -p underwrite-contracts --features livenet --bin register_policy_self_testnet

node scripts/record-evidence.mjs note "wallet-mode self policy registration submitted through register_policy_self_testnet; requires redeployed wallet-mode contract"

echo "==> Self policy registration helper completed"
