# Underwrite

A Casper-native state machine for parametric cargo insurance settlement.

Authenticated evidence enters the protocol, deterministic policy rules calculate
the permitted payout, and a funded CEP-18 vault transfers settlement tokens to
the policyholder.

## Protocol

```text
signed cargo observation
          |
          v
 autonomous Rust agent
 signature + policy evaluation
          |
          v
 UnderwriteSettlement (Odra)
 policy / oracle / freshness / replay checks
          |
          v
 CEP-18 settlement token transfer
```

## Contract architecture

- `SettlementToken` wraps Odra's CEP-18 implementation.
- `UnderwriteSettlement` stores policies, the authorized agent, processed claim
  IDs, evidence hashes, and settlement records.
- The settlement contract verifies a Casper-compatible Ed25519 signature over
  the claim ID before moving tokens.
- Payout tiers are enforced on-chain at 48, 72, 120, and 240 hours.

## Test locally

```bash
cargo test --workspace
```

The contract tests deploy both contracts in OdraVM, fund the settlement contract
with CEP-18 tokens, settle a claim, and test replay and payout failures.

## Build contracts

Install the Odra CLI, then build the contracts declared in `contracts/Odra.toml`:

```bash
cargo install cargo-odra
cd contracts
cargo odra build
```

## Casper Testnet

Copy `.env.example` to `.env` and provide a funded Casper Testnet key.

```bash
cargo run -p underwrite-contracts \
  --features livenet \
  --bin deploy_testnet
```

The command deploys the CEP-18 token, deploys `UnderwriteSettlement`, and funds
the contract vault. Record the printed addresses in the submission deployment
section.

## Agent

The agent verifies the oracle signature and emits a claim attestation suitable
for the contract call:

```bash
cargo run -p underwrite-agent -- fixtures/signed-observation.json
```

Use the library helper `sign_observation` to create a signed fixture from
`fixtures/observation.json`.

## Dashboard

Serve `dashboard/` with any static file server:

```bash
python3 -m http.server 4174 --directory dashboard
```

Replace the pending explorer link after the Testnet deployment.

## Security cases

The protocol rejects unauthorized callers, unknown or inactive policies,
claimant mismatches, unauthorized oracle keys, bad signatures, stale or future
observations, expired attestations, non-qualifying delays, incorrect payout
amounts, and replayed claim IDs.

Underwrite is unaudited hackathon software and must not custody production
insurance funds.
