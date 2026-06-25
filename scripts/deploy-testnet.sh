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

: "${ODRA_CASPER_LIVENET_RPC_ADDRESS:?missing ODRA_CASPER_LIVENET_RPC_ADDRESS}"
: "${ODRA_CASPER_LIVENET_CHAIN_NAME:?missing ODRA_CASPER_LIVENET_CHAIN_NAME}"
: "${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:?missing ODRA_CASPER_LIVENET_SECRET_KEY_PATH}"

node scripts/record-evidence.mjs init

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
