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

stale_attestation="${1:-${UNDERWRITE_STALE_ATTESTATION_PATH:-deployments/latest-stale-attestation.json}}"
if [[ ! -f "$stale_attestation" ]]; then
  echo "Missing $stale_attestation."
  echo "Run scripts/generate-stale-attestation.sh before attempting stale rejection evidence."
  exit 1
fi
export UNDERWRITE_STALE_ATTESTATION_PATH="$stale_attestation"

echo "==> Attempting stale claim submission from $stale_attestation"
set +e
cargo run -p underwrite-contracts --features livenet --bin submit_stale_claim_testnet
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  node scripts/record-evidence.mjs set staleStatus=unexpected_success
  echo "Stale/invalid claim did not fail locally. Check explorer/node state before using this evidence."
  exit 1
fi

node scripts/record-evidence.mjs set staleStatus=rejected_or_failed
node scripts/record-evidence.mjs note "stale claim attempt returned non-zero status; inspect terminal output/explorer for StaleClaim or ExpiredClaim evidence"
echo "==> Stale claim attempt captured"
