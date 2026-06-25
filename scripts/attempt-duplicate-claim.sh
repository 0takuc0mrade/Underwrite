#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cat <<'EOF'
Duplicate-claim rejection evidence:

1. Submit the same valid claim attestation a second time.
2. The contract should reject it with ClaimAlreadyProcessed.
3. Capture the deploy hash or node error output.
4. Record the evidence:

   node scripts/record-evidence.mjs set \
     duplicateDeploy=<duplicate-claim-deploy-hash-or-error-reference> \
     explorerLinks.duplicateClaim=<explorer-url>

Do not record a duplicate claim hash until the duplicate attempt has actually
been submitted or captured from the node/explorer.
EOF
