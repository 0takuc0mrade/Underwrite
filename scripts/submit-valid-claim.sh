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

attestation="${1:-${UNDERWRITE_ATTESTATION_PATH:-deployments/latest-attestation.json}}"
if [[ ! -f "$attestation" ]]; then
  echo "Missing $attestation. Run scripts/run-agent.sh first."
  exit 1
fi
export UNDERWRITE_ATTESTATION_PATH="$attestation"

echo "==> Submitting valid claim attestation from $attestation"
cargo run -p underwrite-contracts --features livenet --bin submit_claim_testnet

attestation_hash="$(node -e "const fs=require('fs'); const text=fs.readFileSync('$attestation','utf8'); const json=JSON.parse(text.slice(text.indexOf('{'))); console.log(json.attestation_hash ?? '')")"
payout_amount="$(node -e "const fs=require('fs'); const text=fs.readFileSync('$attestation','utf8'); const json=JSON.parse(text.slice(text.indexOf('{'))); console.log(json.payout_amount_minor ?? '')")"
payout_percentage="$(node -e "const fs=require('fs'); const text=fs.readFileSync('$attestation','utf8'); const json=JSON.parse(text.slice(text.indexOf('{'))); console.log(json.payout_percentage ?? '')")"

node scripts/record-evidence.mjs set \
  attestation="$attestation_hash" \
  payout="$payout_amount" \
  payoutPercentage="$payout_percentage" \
  validStatus=submitted

node scripts/record-evidence.mjs note "valid claim submitted through submit_claim_testnet; capture explorer deploy hash manually if Odra output does not expose it"

echo "==> Valid claim helper completed"
