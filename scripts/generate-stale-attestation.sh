#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source_payload="${1:-fixtures/risk-attestation.cargo-delay.payload.json}"
stale_payload="${2:-deployments/stale-risk-attestation.cargo-delay.payload.json}"
signed_output="${3:-deployments/signed-risk-attestation.cargo-delay.stale.json}"
agent_output="${4:-deployments/latest-stale-attestation.json}"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ ! -f "$source_payload" ]]; then
  echo "Missing source payload: $source_payload"
  exit 1
fi

mkdir -p "$(dirname "$stale_payload")" "$(dirname "$signed_output")" "$(dirname "$agent_output")"

node -e '
const fs = require("fs");
const input = process.argv[1];
const output = process.argv[2];
const payload = JSON.parse(fs.readFileSync(input, "utf8"));
payload.observed_at = 1700000000;
payload.expires_at = 1700086400;
payload.nonce = "risk_20231114_cargo_delay_stale";
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + "\n");
' "$source_payload" "$stale_payload"

echo "==> Signing stale risk attestation payload"
cargo run -p underwrite-agent -- sign-risk "$stale_payload" > "$signed_output"

echo "==> Producing stale claim attestation report"
cargo run -p underwrite-agent -- "$signed_output" | tee "$agent_output"

echo "==> Stale signed fixture: $signed_output"
echo "==> Stale agent report: $agent_output"
