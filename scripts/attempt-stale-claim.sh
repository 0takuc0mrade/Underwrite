#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cat <<'EOF'
Stale or invalid claim rejection evidence:

1. Create or modify a claim attestation so observed_at is outside the freshness
   window or expires_at is earlier than the current block time.
2. Submit it to UnderwriteSettlement.settle_claim.
3. The contract should reject it with StaleClaim or ExpiredClaim.
4. Capture the deploy hash or node error output.
5. Record the evidence:

   node scripts/record-evidence.mjs set \
     staleDeploy=<stale-or-invalid-deploy-hash-or-error-reference> \
     explorerLinks.staleOrInvalidClaim=<explorer-url>

The local contract tests already cover stale and expired rejection. This script
is for collecting real Casper Testnet evidence, not for generating fake hashes.
EOF
