#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Checking workspace tests"
cargo test --workspace

echo "==> Building Odra contract artifacts"
if command -v cargo-odra >/dev/null 2>&1; then
  (cd contracts && cargo odra build)
else
  echo "cargo-odra is not installed."
  echo "Install it with: cargo install cargo-odra"
  echo "Skipping artifact build after tests. No deployment artifacts were produced."
fi
