# Underwrite

Underwrite is a Casper-native risk settlement layer for DeFi and RWA apps. It
turns signed risk attestations into deterministic, replay-safe vault payouts.

Underwrite Lite is intentionally narrow. It is not an insurance marketplace, a
policy NFT system, an x402 payment flow, or an AI risk-scoring product. The
submission spine is:

```text
signed risk attestation
  -> autonomous Rust agent verification
  -> deterministic payout calculation
  -> Casper contract authorization, freshness, and replay checks
  -> funded CEP-18 vault settlement
  -> event and evidence record for dashboards and reviewers
```

## Problem

Casper DeFi and RWA products can expose users to specific measurable risks:
liquidity pool loss events, treasury drawdowns, validator or staking incidents,
invoice defaults, and logistics delays. These products need a small settlement
primitive that can verify a signed risk event and release a bounded payout
without becoming a broad insurance marketplace.

## Solution

Underwrite provides that primitive. A trusted oracle or evidence source signs a
risk observation. The off-chain agent verifies the signature, applies the
template-specific deterministic payout rule, and submits a claim attestation.
The Casper contract independently enforces agent authorization, oracle
authorization, policy existence, claimant match, freshness, expiry, replay
protection, and payout bounds before paying from a funded vault.

Cargo delay is the first fully implemented demo template. The protocol is
framed more generally so Casper apps can reuse the same settlement spine for
other parametric risk products later.

## Supported Templates

| Template | Status | Example Use |
| --- | --- | --- |
| `cargo_delay` | Working local demo | RWA logistics or trade-finance shipment delay cover |
| `treasury_drawdown` | Documented only | DAO or treasury loss-threshold protection |
| `lp_risk_cover` | Documented only | CSPR.trade-style LP risk or pool incident cover |
| `rwa_default` | Documented only | Invoice/default attestations for RWA credit products |

Only `cargo_delay` has working agent and contract payout logic in this repo.
The other templates are product direction, not implemented integrations.

## Underwrite Lite Flow

1. A risk policy is registered on Casper with a claimant, insured value,
   currency, and authorized oracle public key.
2. A trusted oracle or evidence source signs a risk attestation.
3. The off-chain Underwrite agent verifies the signature and deterministic
   payout tier.
4. The agent emits a claim attestation containing claim ID, policy ID, evidence
   hash, claimant, payout, timestamp, oracle key, and signature.
5. The Casper settlement contract checks the authorized agent, authorized oracle
   key, policy existence, claimant, freshness, expiry, replay state, and payout
   bounds.
6. A valid claim is recorded and paid from the CEP-18 settlement vault.
7. Duplicate, stale, unauthorized, malformed, non-qualifying, or over-limit
   claims fail safely.

## Architecture

```text
fixtures/signed-risk-attestation.cargo-delay.json
          |
          v
underwrite-agent
  - verifies Ed25519 oracle signature
  - maps coverage template to deterministic payout rule
  - emits claim attestation and attestation hash
          |
          v
UnderwriteSettlement (Odra)
  - risk policy registry
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

## Why Casper

Casper is a strong fit for this Underwrite Lite shape because the product is a
small protocol primitive: registered policy state, authorized signers,
deterministic execution, replay-safe settlement records, and auditable deploy
evidence. Underwrite does not need a marketplace to be useful; it needs a
verifiable settlement path that Casper DeFi/RWA builders can compose with.

## Current Implementation Status

Implemented:

- Rust workspace with `contracts` and `agent`
- Odra settlement contract and CEP-18 token wrapper
- Risk policy registration and lookup
- Authorized agent and oracle key checks
- Claim replay protection
- Freshness and expiry checks
- Deterministic payout tiers at 48, 72, 120, and 240 hours
- Settlement record storage
- Agent-side Ed25519 verification and attestation generation
- Backward-compatible cargo observation fixture
- Generic signed `cargo_delay` risk-attestation fixture
- Static dashboard mockup for the protocol flow

Fully working locally:

```bash
cargo test -p underwrite-agent
cargo test --workspace
cargo run -p underwrite-agent -- fixtures/signed-observation.json
cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json
```

The cargo-delay fixture produces a 75-hour trigger, a 50% payout tier, and
`6250000` minor units.

Still pending for submission:

- Casper Testnet deployment
- Real settlement token and vault addresses
- Policy registration deploy hash
- Valid claim deploy hash
- Duplicate/stale rejection evidence
- Dashboard links updated with real explorer records

Workspace contract tests pass under nightly Rust. Nightly is required because
Odra 2.8.1 depends on `odra-macros`, which uses nightly-only `box_patterns`.
This repo pins `nightly-2026-06-25` in `rust-toolchain.toml`.

## Agent CLI

Create the legacy cargo observation fixture:

```bash
cargo run -p underwrite-agent -- sign fixtures/observation.json
```

Create the generic risk-attestation fixture:

```bash
cargo run -p underwrite-agent -- sign-risk fixtures/risk-attestation.cargo-delay.payload.json
```

Verify the backward-compatible signed observation:

```bash
cargo run -p underwrite-agent -- fixtures/signed-observation.json
```

Verify the generic risk-attestation fixture:

```bash
cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json
```

The generic output includes template, policy ID, risk event, trigger
metric/value, payout percentage, payout amount, attestation hash, and the claim
attestation that can be submitted to the contract.

## Build Contracts

Install Odra tooling, then build the contracts:

```bash
cargo install cargo-odra
scripts/build-contracts.sh
```

## Casper Testnet Deployment

Copy `.env.example` to `.env`, fill the Testnet account values, then follow
`DEPLOYMENT.md`.

Primary commands:

```bash
scripts/build-contracts.sh
scripts/deploy-testnet.sh
scripts/register-policy.sh
scripts/run-agent.sh
scripts/submit-claim.sh
scripts/attempt-duplicate-claim.sh
scripts/attempt-stale-claim.sh
```

Automated today:

- local workspace verification
- Odra livenet deploy for token + settlement + vault funding
- generic risk-attestation agent run
- evidence JSON initialization/update helper

Manual or pending:

- deploy hash capture from node/explorer output
- policy registration call helper
- claim submission call helper
- duplicate/stale Testnet rejection evidence

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

Use `deployments/casper-testnet.example.json` as the committed evidence shape.
Write real evidence to ignored file `deployments/casper-testnet.json`:

```bash
node scripts/record-evidence.mjs init
node scripts/record-evidence.mjs set contract=<address> token=<address>
node scripts/record-evidence.mjs note "policy registration pending"
```

## Demo Path

1. Show the supported template list and explain that `cargo_delay` is the
   working demo template.
2. Run the agent on `fixtures/signed-risk-attestation.cargo-delay.json`.
3. Show template, policy ID, risk event, trigger metric/value, payout, and
   attestation hash.
4. Run `cargo test --workspace` to show local contract verification.
5. After deployment, show Casper Testnet policy registration, valid payout, and
   duplicate or stale rejection evidence.

## Dashboard

Serve the static dashboard locally:

```bash
python3 -m http.server 4174 --directory dashboard
```

The dashboard is currently a protocol mockup. Replace pending explorer links and
static values after Testnet deployment.

## Security Scope

Underwrite is unaudited hackathon software. It demonstrates a small
Casper-native risk settlement primitive and must not custody production funds
without professional review.
