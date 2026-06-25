#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cat <<'EOF'
Policy registration is the next required Testnet call:

  UnderwriteSettlement.register_policy(
    policy_number = "MRC-CRG-2026-00481",
    claimant = DEMO_CLAIMANT_ACCOUNT,
    insured_value_minor = 12500000,
    currency = "USD",
    oracle_public_key = UNDERWRITE_ORACLE_PUBLIC_KEY
  )

Current blocker:
  The repo has a working Odra deploy binary, but it does not yet include a
  livenet helper that rehydrates an already deployed UnderwriteSettlement
  address and calls register_policy. Add that Rust entrypoint or use Odra/Casper
  tooling manually, then record the deploy hash.

After the deploy succeeds, record evidence:

  node scripts/record-evidence.mjs set \
    policyId=MRC-CRG-2026-00481 \
    claimant="$DEMO_CLAIMANT_ACCOUNT" \
    oracle="$UNDERWRITE_ORACLE_PUBLIC_KEY" \
    explorerLinks.underwriteContract=<explorer-url>
EOF
