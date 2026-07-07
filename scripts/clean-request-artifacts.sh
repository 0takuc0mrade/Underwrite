#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

requests_dir="${UNDERWRITE_REQUEST_ARTIFACT_DIR:-deployments/requests}"
max_age_days="${UNDERWRITE_REQUEST_ARTIFACT_MAX_AGE_DAYS:-7}"

if [[ ! -d "$requests_dir" ]]; then
  echo "No request artifact directory found at $requests_dir"
  exit 0
fi

echo "==> Cleaning Agent Request artifacts older than $max_age_days days from $requests_dir"
find "$requests_dir" -type f \
  \( -name 'req_*-payload.json' -o -name 'req_*-fixture.json' -o -name 'req_*-attestation.json' -o -name 'request-store.json' \) \
  -mtime +"$max_age_days" \
  -print \
  -delete

echo "==> Request artifact cleanup complete"
