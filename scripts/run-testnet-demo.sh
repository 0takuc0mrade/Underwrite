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

: "${UNDERWRITE_CONTRACT_ADDRESS:?missing UNDERWRITE_CONTRACT_ADDRESS}"
: "${DEMO_CLAIMANT_ACCOUNT:?missing DEMO_CLAIMANT_ACCOUNT}"
: "${UNDERWRITE_ORACLE_PUBLIC_KEY:?missing UNDERWRITE_ORACLE_PUBLIC_KEY}"

node scripts/record-evidence.mjs init

echo "==> 1/6 Register policy"
scripts/register-policy.sh

echo "==> 2/6 Run valid agent attestation"
scripts/generate-fresh-attestation.sh
scripts/run-agent.sh deployments/signed-risk-attestation.cargo-delay.fresh.json

echo "==> 3/6 Submit valid claim"
scripts/submit-valid-claim.sh

echo "==> 4/6 Attempt duplicate rejection"
scripts/attempt-duplicate-claim.sh

echo "==> 5/6 Generate signed stale attestation"
scripts/generate-stale-attestation.sh

echo "==> 6/6 Attempt stale rejection"
scripts/attempt-stale-claim.sh

echo "==> Testnet demo path complete. Review deployments/casper-testnet.json and add real explorer deploy hashes if Odra did not print them."
