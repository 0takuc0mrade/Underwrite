#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

cat <<'EOF'
Vault funding status:

  scripts/deploy-testnet.sh already funds the settlement contract with
  50000000 minor units during the initial Odra deployment flow.

If you deploy token and settlement separately, fund the vault by transferring
settlement tokens to UNDERWRITE_CONTRACT_ADDRESS, then record the token and
vault identifiers:

  node scripts/record-evidence.mjs set \
    token="$UNDERWRITE_TOKEN_ADDRESS" \
    vault="$UNDERWRITE_CONTRACT_ADDRESS"

Do not mark vault funding complete until a real Testnet token transfer deploy
has succeeded.
EOF
