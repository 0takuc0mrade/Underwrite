#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

fixture="${1:-fixtures/signed-risk-attestation.cargo-delay.json}"
output="${2:-deployments/latest-attestation.json}"

mkdir -p "$(dirname "$output")"

echo "==> Running Underwrite agent on $fixture"
cargo run -p underwrite-agent -- "$fixture" | tee "$output"

attestation_hash="$(node -e "const fs=require('fs'); const text=fs.readFileSync('$output','utf8'); const json=JSON.parse(text.slice(text.indexOf('{'))); console.log(json.attestation_hash ?? '')")"
payout_amount="$(node -e "const fs=require('fs'); const text=fs.readFileSync('$output','utf8'); const json=JSON.parse(text.slice(text.indexOf('{'))); console.log(json.payout_amount_minor ?? '')")"
payout_percentage="$(node -e "const fs=require('fs'); const text=fs.readFileSync('$output','utf8'); const json=JSON.parse(text.slice(text.indexOf('{'))); console.log(json.payout_percentage ?? '')")"
if [[ -n "$attestation_hash" ]]; then
  node scripts/record-evidence.mjs set \
    attestation="$attestation_hash" \
    payout="$payout_amount" \
    payoutPercentage="$payout_percentage"
fi

echo "==> Attestation output saved to $output"
