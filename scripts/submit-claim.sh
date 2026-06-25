#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

attestation="${1:-deployments/latest-attestation.json}"

if [[ ! -f "$attestation" ]]; then
  echo "Missing $attestation. Run scripts/run-agent.sh first."
  exit 1
fi

cat <<EOF
Valid claim submission is the required Testnet contract call:

  UnderwriteSettlement.settle_claim(
    claim_id,
    policy_number,
    claimant,
    evidence_hash,
    status_code,
    delay_hours,
    payout_amount_minor,
    observed_at,
    expires_at,
    claim_id_signature,
    oracle_public_key
  )

Use values from:
  $attestation

Current blocker:
  The repo does not yet include a livenet helper that rehydrates the deployed
  UnderwriteSettlement address and submits settle_claim. Use manual Odra/Casper
  tooling or add that Rust entrypoint, then record the real deploy hash.

After a successful Testnet deploy:

  node scripts/record-evidence.mjs set \
    validDeploy=<valid-claim-deploy-hash> \
    explorerLinks.validClaim=<explorer-url>

Do not populate validClaimDeployHash until the transaction has actually been sent.
EOF
