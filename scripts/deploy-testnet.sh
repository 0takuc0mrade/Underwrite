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
if [[ "${UNDERWRITE_RPC_DEBUG_PROXY:-0}" == "1" ]]; then
  rpc_address="http://127.0.0.1:${RPC_DEBUG_PORT:-7777}/rpc"
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

node scripts/record-evidence.mjs init

echo "==> Pre-deployment artifact check"
REQUIRE_CONTRACT_ARTIFACTS=1 scripts/build-contracts.sh

echo "==> Deploying SettlementToken and UnderwriteSettlement with Odra livenet"
echo "==> This command prints deployed addresses. Copy them into deployments/casper-testnet.json."
cargo run -p underwrite-contracts --features livenet --bin deploy_testnet

cat <<'EOF'

Next manual recording step:
  node scripts/record-evidence.mjs set \
    token=<SettlementToken printed above> \
    contract=<UnderwriteSettlement printed above> \
    vault=<UnderwriteSettlement printed above> \
    agent=<Agent printed above>

Odra livenet returns deployed addresses from this binary. Deploy hashes may need
to be captured from node logs, wallet output, or explorer search until lower-level
deploy-hash capture is wired.
EOF
