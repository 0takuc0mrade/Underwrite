# Underwrite

Underwrite is a Casper-native autonomous parametric settlement primitive for
logistics insurance. It is intentionally narrow: signed evidence comes in,
deterministic checks run, and a funded vault settles a valid claim.

This is Underwrite Lite, not an insurance marketplace. There are no policy
NFTs, no x402 payments, and no broad quote workflow in this repository. The
submission spine is:

```text
signed evidence
  -> autonomous Rust agent attestation
  -> Casper contract verification
  -> CEP-18 vault payout
```

## Underwrite Lite Flow

1. A policy is registered on Casper with a claimant, insured value, currency,
   and authorized oracle public key.
2. A trusted oracle or evidence source signs a shipment observation.
3. The off-chain Underwrite agent verifies the signature and deterministic
   payout tier.
4. The agent emits a claim attestation containing claim ID, policy ID,
   evidence hash, claimant, payout, timestamp, oracle key, and signature.
5. The Casper settlement contract checks the authorized agent, authorized
   oracle key, policy existence, claimant, freshness, expiry, replay state, and
   payout bounds.
6. A valid claim is recorded and paid from the CEP-18 settlement vault.
7. Duplicate, stale, unauthorized, malformed, non-qualifying, or over-limit
   claims fail safely.

## Architecture

```text
fixtures/signed-observation.json
          |
          v
underwrite-agent
  - verifies Ed25519 oracle signature
  - calculates deterministic payout tier
  - signs claim ID for contract verification
          |
          v
UnderwriteSettlement (Odra)
  - policy registry
  - authorized agent gate
  - oracle public key check
  - freshness and expiry checks
  - replay protection
  - deterministic payout bounds
  - settlement record storage
          |
          v
SettlementToken (CEP-18 wrapper)
  - funded vault transfer to claimant
```

## Current Local Status

Implemented:

- Rust workspace with `contracts` and `agent`
- Odra settlement contract and CEP-18 token wrapper
- Policy registration and lookup
- Authorized agent and oracle key checks
- Claim replay protection
- Freshness and expiry checks
- Deterministic payout tiers at 48, 72, 120, and 240 hours
- Settlement record storage
- Agent-side Ed25519 verification and attestation generation
- Realistic signed cargo-delay fixture
- Static dashboard mockup for the protocol flow

Verified locally:

```bash
cargo test -p underwrite-agent
cargo run -p underwrite-agent -- fixtures/signed-observation.json
```

The fixture produces a 75-hour delay attestation with a 50% payout tier and
`6250000` minor units.

Workspace contract tests pass under nightly Rust. Nightly is required because
Odra 2.8.1 depends on `odra-macros`, which uses nightly-only `box_patterns`.
This repo pins nightly in `rust-toolchain.toml`.

## Test Commands

```bash
rustup toolchain install nightly --target wasm32-unknown-unknown
cargo test -p underwrite-agent
cargo test --workspace
```

See `TESTING.md` for exact setup, expected output, and known limitations.

## Agent CLI

Create a signed fixture:

```bash
cargo run -p underwrite-agent -- sign fixtures/observation.json
```

Verify the bundled signed fixture and produce a claim attestation:

```bash
cargo run -p underwrite-agent -- fixtures/signed-observation.json
```

## Build Contracts

Install Odra tooling, then build the contracts:

```bash
cargo install cargo-odra
cd contracts
cargo odra build
```

## Casper Testnet Deployment Evidence

Deployment evidence is not complete yet. Fill this section after the Testnet
run.

| Artifact | Status | Value |
| --- | --- | --- |
| Network | Pending | Casper Testnet |
| Settlement token address | Pending | TBD |
| Underwrite settlement address | Pending | TBD |
| Vault funding deploy hash | Pending | TBD |
| Policy registration deploy hash | Pending | TBD |
| Valid claim deploy hash | Pending | TBD |
| Duplicate claim rejection evidence | Pending | TBD |
| Stale claim rejection evidence | Pending | TBD |
| Explorer links | Pending | TBD |

Use `deployments/casper-testnet.example.json` as the deployment evidence shape.

## Dashboard

Serve the static dashboard locally:

```bash
python3 -m http.server 4174 --directory dashboard
```

The dashboard is currently a protocol mockup. Replace the pending explorer link
and static values after Testnet deployment.

## Security Scope

Underwrite is unaudited hackathon software. It is designed to demonstrate a
small Casper-native parametric settlement primitive and must not custody
production insurance funds without professional review.
