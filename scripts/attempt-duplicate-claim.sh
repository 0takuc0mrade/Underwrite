#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and fill the Testnet values."
  exit 1
fi

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
export ODRA_LOG_LEVEL="${ODRA_LOG_LEVEL:-debug}"

: "${ODRA_CASPER_LIVENET_NODE_ADDRESS:?missing ODRA_CASPER_LIVENET_NODE_ADDRESS}"
: "${ODRA_CASPER_LIVENET_EVENTS_URL:?missing ODRA_CASPER_LIVENET_EVENTS_URL}"
: "${ODRA_CASPER_LIVENET_CHAIN_NAME:?missing ODRA_CASPER_LIVENET_CHAIN_NAME}"
: "${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:?missing ODRA_CASPER_LIVENET_SECRET_KEY_PATH}"
: "${UNDERWRITE_CONTRACT_ADDRESS:?missing UNDERWRITE_CONTRACT_ADDRESS}"

attestation="${1:-${UNDERWRITE_ATTESTATION_PATH:-deployments/latest-attestation.json}}"
if [[ ! -f "$attestation" ]]; then
  echo "Missing $attestation. Run scripts/run-agent.sh first."
  exit 1
fi
export UNDERWRITE_ATTESTATION_PATH="$attestation"

echo "==> Attempting duplicate claim submission"
set +e
cargo run -p underwrite-contracts --features livenet --bin submit_duplicate_claim_testnet
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  node scripts/record-evidence.mjs set duplicateStatus=unexpected_success
  echo "Duplicate claim did not fail locally. Check explorer/node state before using this evidence."
  exit 1
fi

node scripts/record-evidence.mjs set duplicateStatus=rejected_or_failed
node scripts/record-evidence.mjs note "duplicate claim attempt returned non-zero status; inspect terminal output/explorer for ClaimAlreadyProcessed evidence"
echo "==> Duplicate claim attempt captured"
