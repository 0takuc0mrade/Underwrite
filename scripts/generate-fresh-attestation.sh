#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source_payload="${1:-fixtures/risk-attestation.cargo-delay.payload.json}"
fresh_payload="${2:-deployments/fresh-risk-attestation.cargo-delay.payload.json}"
signed_output="${3:-deployments/signed-risk-attestation.cargo-delay.fresh.json}"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ ! -f "$source_payload" ]]; then
  echo "Missing source payload: $source_payload"
  exit 1
fi

mkdir -p "$(dirname "$fresh_payload")" "$(dirname "$signed_output")"

node -e '
const fs = require("fs");
const input = process.argv[1];
const output = process.argv[2];
const now = Math.floor(Date.now() / 1000);
const payload = JSON.parse(fs.readFileSync(input, "utf8"));
payload.observed_at = now - 300;
payload.expires_at = now + 24 * 60 * 60;
payload.nonce = `risk_${now}_cargo_delay_fresh`;
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + "\n");
' "$source_payload" "$fresh_payload"

echo "==> Signing fresh risk attestation payload"
cargo run -p underwrite-agent -- sign-risk "$fresh_payload" > "$signed_output"

echo "==> Fresh signed fixture: $signed_output"
