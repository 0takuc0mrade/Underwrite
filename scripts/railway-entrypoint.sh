#!/usr/bin/env bash
set -euo pipefail

mkdir -p /app/secrets /app/deployments/requests

if [[ -n "${CASPER_SECRET_KEY_PEM_BASE64:-}" ]]; then
  umask 077
  printf '%s' "$CASPER_SECRET_KEY_PEM_BASE64" | tr -d '\n\r ' | base64 -d > /app/secrets/casper-secret-key.pem
  export ODRA_CASPER_LIVENET_SECRET_KEY_PATH="${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:-/app/secrets/casper-secret-key.pem}"
  export CASPER_ACCOUNT_SECRET_KEY_PATH="${CASPER_ACCOUNT_SECRET_KEY_PATH:-/app/secrets/casper-secret-key.pem}"
fi

if [[ "${UNDERWRITE_ENABLE_AGENT_REQUESTS:-false}" == "true" ]]; then
  if [[ -z "${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:-}" || ! -f "${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:-}" ]]; then
    echo "Agent requests are enabled, but no Casper secret key file is available."
    echo "Set CASPER_SECRET_KEY_PEM_BASE64 or mount a key and set ODRA_CASPER_LIVENET_SECRET_KEY_PATH."
    exit 1
  fi
fi

export PORT="${PORT:-3000}"
export NEXT_TELEMETRY_DISABLED=1

exec "$@"
