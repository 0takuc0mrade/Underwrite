#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Checking workspace tests"
cargo test --workspace

echo "==> Building Odra contract artifacts"
if command -v cargo-odra >/dev/null 2>&1; then
  (cd contracts && cargo odra build)
  mkdir -p wasm
  cp contracts/wasm/SettlementToken.wasm wasm/SettlementToken.wasm
  cp contracts/wasm/UnderwriteSettlement.wasm wasm/UnderwriteSettlement.wasm
else
  echo "cargo-odra is not installed."
  echo "Install it with: cargo install cargo-odra"
  if [[ "${REQUIRE_CONTRACT_ARTIFACTS:-0}" == "1" ]]; then
    echo "Contract artifacts are required for this deployment path. Failing instead of silently skipping."
    exit 1
  fi
  echo "Local verification mode: skipping artifact build after tests."
  echo "Set REQUIRE_CONTRACT_ARTIFACTS=1 for Testnet deployment/preflight."
fi
