# Testing Underwrite

Underwrite uses Odra 2.8.1 for Casper contracts. Odra's macro crate currently
uses the nightly-only `box_patterns` feature, so workspace and contract tests
must run with nightly Rust.

The repo pins nightly in `rust-toolchain.toml` and includes the
`wasm32-unknown-unknown` target required for contract builds.

## Setup

```bash
rustup toolchain install nightly --target wasm32-unknown-unknown
rustup show active-toolchain
```

Expected active toolchain inside this repository:

```text
nightly-... (overridden by rust-toolchain.toml)
```

## Agent Tests

```bash
cargo test -p underwrite-agent
```

Expected result:

```text
running 4 tests
test tests::rejects_mismatched_oracle_key ... ok
test tests::rejects_modified_evidence ... ok
test tests::verifies_and_builds_attestation ... ok
test tests::verifies_generic_risk_attestation ... ok
test result: ok. 4 passed
```

## Agent Fixture Attestations

```bash
cargo run -p underwrite-agent -- fixtures/signed-observation.json
```

Expected important fields:

```json
{
  "delay_hours": 75,
  "payout_percentage": 50,
  "payout_amount_minor": 6250000
}
```

The generic risk-attestation fixture is also supported:

```bash
cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json
```

Expected important fields:

```json
{
  "template": "cargo_delay",
  "policy_id": "MRC-CRG-2026-00481",
  "risk_event": "cargo_delay",
  "trigger_metric": "delay_hours",
  "trigger_value": 75,
  "payout_percentage": 50,
  "payout_amount_minor": 6250000,
  "attestation_hash": "..."
}
```

## Workspace And Contract Tests

```bash
cargo test --workspace
```

Expected contract result:

```text
running 11 tests
test settlement::tests::payout_boundaries_are_exact ... ok
test settlement::tests::unauthorized_agent_is_rejected ... ok
test settlement::tests::incorrect_payout_is_rejected ... ok
test settlement::tests::policy_registration_succeeds ... ok
test settlement::tests::wrong_oracle_public_key_is_rejected ... ok
test settlement::tests::expired_claim_is_rejected ... ok
test settlement::tests::valid_claim_stores_settlement_record ... ok
test settlement::tests::stale_claim_is_rejected ... ok
test settlement::tests::insufficient_vault_funds_are_rejected ... ok
test settlement::tests::qualifying_claim_transfers_cep18_tokens ... ok
test settlement::tests::duplicate_claim_is_rejected ... ok
test result: ok. 11 passed
```

The contract suite covers:

- policy registration
- unauthorized agent rejection
- wrong oracle public key rejection
- stale claim rejection
- expired claim rejection
- duplicate claim rejection
- insufficient vault funds rejection
- valid settlement record storage
- CEP-18-style transfer to claimant
- payout boundaries at 47, 48, 71, 72, 119, 120, 239, and 240 hours

## Current Known Limitation

On stable Rust, `cargo test --workspace` fails before contract tests can run:

```text
error[E0554]: #![feature] may not be used on the stable release channel
 --> odra-macros-2.8.1/src/lib.rs:3:1
  |
3 | #![feature(box_patterns)]
```

This is expected on stable and is why the repository pins nightly. If nightly is
not installed or cannot be downloaded in the current environment, record that as
an environment blocker rather than hiding the failure.

In restricted sandboxes, `casper-engine-test-support` may also fail while trying
to generate `chainspec.toml` inside the Cargo registry. In a normal developer
environment this is not an issue. In this Codex sandbox, rerunning
`cargo test --workspace` with host filesystem permissions allowed the suite to
pass.

## Before Submission

Run and capture:

```bash
cargo test -p underwrite-agent
cargo test --workspace
cargo run -p underwrite-agent -- fixtures/signed-observation.json
cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json
node scripts/record-evidence.mjs init
```

For Casper Testnet evidence, also capture deploy hashes, contract addresses,
policy registration output, successful claim settlement, and at least one
rejection case.

## Deployment Script Checks

The deployment scripts are intentionally honest about what is automated versus
manual. Before recording Testnet evidence, check:

```bash
scripts/build-contracts.sh
scripts/run-agent.sh
scripts/register-policy.sh
scripts/submit-claim.sh
scripts/attempt-duplicate-claim.sh
scripts/attempt-stale-claim.sh
```

`scripts/deploy-testnet.sh` requires a real `.env` with funded Casper Testnet
credentials. Do not run it until the account and secret key path are ready.
