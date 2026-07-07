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
- Odra livenet helpers for policy registration and claim submission
- Wallet-mode contract support through `register_policy_self` for caller-owned policies
- Testnet demo orchestration scripts with evidence JSON updates
- Next.js operator dashboard with landing, operations, evidence, policy, and agent pages

Fully working locally:

```bash
cargo test -p underwrite-agent
cargo test --workspace
cargo run -p underwrite-agent -- fixtures/signed-observation.json
cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json
```

The cargo-delay fixture produces a 75-hour trigger, a 50% payout tier, and
`6250000` minor units.

Ready for submission:

- Casper Testnet deployment evidence
- Real settlement token and vault addresses
- Policy registration deploy hash
- Valid claim deploy hash
- Duplicate and stale rejection evidence
- Wallet-mode policy registration evidence
- Agent Request settlement evidence
- Dashboard links updated with real explorer records

Wallet-mode note: the deployed wallet-mode contract includes
`register_policy_self`, which allows a wallet caller to register a policy only
for itself. Claim settlement remains agent-authorized, so user wallets own
policies while the agent verifies evidence and submits settlement claims.

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

For deployment artifact generation, `cargo-odra` is required:

```bash
REQUIRE_CONTRACT_ARTIFACTS=1 scripts/build-contracts.sh
```

`cargo-odra` also needs `wasm-opt` and `wasm-strip` from Binaryen/WABT.

## Casper Testnet Deployment

Copy `.env.example` to `.env`, fill the Testnet account values, then follow
`DEPLOYMENT.md`.

Primary commands:

```bash
scripts/build-contracts.sh
scripts/preflight-testnet.sh
scripts/deploy-testnet.sh
scripts/register-policy.sh
scripts/register-policy-self.sh
scripts/run-agent.sh
scripts/submit-valid-claim.sh
scripts/attempt-duplicate-claim.sh
scripts/generate-stale-attestation.sh
scripts/attempt-stale-claim.sh
```

Automated today:

- local workspace verification
- Odra livenet deploy for token + settlement + vault funding
- Odra livenet policy registration helper
- Odra livenet self-registration helper for wallet-mode contract testing
- Odra livenet valid claim submission helper
- Odra livenet duplicate and stale attempt helpers
- signed stale attestation generator for independent stale rejection evidence
- generic risk-attestation agent run
- evidence JSON initialization/update helper
- two-phase preflight: default deploy phase before deployment, `PREFLIGHT_PHASE=demo` after `UNDERWRITE_CONTRACT_ADDRESS` exists
- Next.js local operator mode guarded by `UNDERWRITE_ENABLE_OPERATOR_ACTIONS`
- Public Agent Request Mode guarded by `UNDERWRITE_ENABLE_AGENT_REQUESTS`

Remaining manual items:

- optional claimant token balance screenshot or query
- demo video capture

## Final Testnet Evidence

Real Casper Testnet deployment and demo evidence was captured on 2026-06-28.
The canonical local evidence file is `deployments/casper-testnet.json`.

| Artifact | Status | Value |
| --- | --- | --- |
| Network | Complete | Casper Testnet (`casper-test`) |
| Settlement token address | Complete | `hash-b72d08a0ff2ad7653ca99c875b64290b521f150824473fa646388b6f85686b5a` |
| Underwrite settlement address | Complete | `hash-9b94b24a2d92dce1d69df6c5d04eddf983b7894763a388f91c8aedc8ae523f6f` |
| Vault funding deploy hash | Complete | [`0d89bc6f277b1ff569cd64e04df350c36946749275a6ffe0302bfdbb3f4648a5`](https://testnet.cspr.live/transaction/0d89bc6f277b1ff569cd64e04df350c36946749275a6ffe0302bfdbb3f4648a5) |
| Policy registration deploy hash | Complete | [`953dba5cebef2141b0f116c06a7e8a2ebd04c2f7e4b93f446d94db6ac6266efc`](https://testnet.cspr.live/transaction/953dba5cebef2141b0f116c06a7e8a2ebd04c2f7e4b93f446d94db6ac6266efc) |
| Valid claim deploy hash | Complete | [`2129b97bdbee1d659a3dbe784420feb004ec6e411966ece3395e7828d824c23b`](https://testnet.cspr.live/transaction/2129b97bdbee1d659a3dbe784420feb004ec6e411966ece3395e7828d824c23b) |
| Duplicate claim rejection evidence | Complete | [`9a4d4fa5700e0c19b5450a77618a01b1eef7945b42fa427d2a56ad6870d5ec3f`](https://testnet.cspr.live/transaction/9a4d4fa5700e0c19b5450a77618a01b1eef7945b42fa427d2a56ad6870d5ec3f), rejected with `User error: 8` |
| Stale claim rejection evidence | Complete | [`941dc7fbfc16936a442628dd2200f7b9b7d2f00a5b334b6e3f7171fb181c1b2f`](https://testnet.cspr.live/transaction/941dc7fbfc16936a442628dd2200f7b9b7d2f00a5b334b6e3f7171fb181c1b2f), rejected with `User error: 11` |
| Payout | Complete | 50%, `6250000` minor units |

The successful demo flow registered policy `MRC-CRG-2026-00481`, generated a
fresh signed cargo-delay attestation, settled the valid claim, rejected a
duplicate replay attempt, and rejected a separately signed stale claim.

## Wallet Mode And Agent Request Evidence

A newer wallet-mode Testnet run is captured in
`web/public/evidence/wallet-mode-testnet.json` and rendered by the Next.js
`/evidence` page.

| Artifact | Status | Value |
| --- | --- | --- |
| Wallet-mode settlement contract | Complete | `hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f` |
| Wallet-mode settlement token | Complete | `hash-1f2857fd127ffe3014d06734b5df882cf084fdd50bfab36c1e4020533c56793d` |
| Wallet policy registration | Complete | [`8779d088e9aa4bc70ed416c08805c778b2bdc4ff36b4be90c9e9589dfe52c6aa`](https://testnet.cspr.live/transaction/8779d088e9aa4bc70ed416c08805c778b2bdc4ff36b4be90c9e9589dfe52c6aa) |
| Agent Request settlement | Complete | [`e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b`](https://testnet.cspr.live/transaction/e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b) |

Wallet Mode lets a user connect Casper Wallet and register a policy through
`register_policy_self`. Agent Request Mode then asks the wallet to sign an
off-chain verification request. The backend verifies that signature, creates
request-scoped evidence and attestation files, and submits settlement through
the authorized agent/relayer. Casper still enforces policy ownership, oracle
trust, freshness, replay protection, payout bounds, and vault settlement.

Request nonce/idempotency tracking is file-backed at
`deployments/requests/request-store.json`, with generated request artifacts
ignored by git. If durable storage cannot be initialized, the code falls back
to an in-memory store for local MVP/demo use only. Production deployments
should use Redis, Postgres, SQLite, or another durable store.

Clean old generated request artifacts with:

```bash
scripts/clean-request-artifacts.sh
```

Use `deployments/casper-testnet.example.json` as the committed evidence shape.
Write real evidence to ignored file `deployments/casper-testnet.json`:

```bash
node scripts/record-evidence.mjs init
node scripts/record-evidence.mjs set contract=<address> token=<address>
node scripts/record-evidence.mjs note "valid claim submitted; explorer hash captured from Testnet output"
```

## Demo Path

1. Show the supported template list and explain that `cargo_delay` is the
   working demo template.
2. Run the agent on `fixtures/signed-risk-attestation.cargo-delay.json`.
3. Show template, policy ID, risk event, trigger metric/value, payout, and
   attestation hash.
4. Run `cargo test --workspace` to show local contract verification.
5. After deployment, run `scripts/run-testnet-demo.sh` to show Casper Testnet
   policy registration, valid payout, duplicate rejection, and separately signed
   stale rejection evidence.

## Frontend Product Structure

The primary submission frontend is the Next.js app in `web/`:

```bash
cd web
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

The frontend is split into product pages:

- `/` is the landing and overview page.
- `/operate` is the operator console for wallet identity, policy registration,
  agent verification, and claim submission.
- `/evidence` is the Casper Testnet audit trail with explorer links.
- `/policy` is the policy, vault, token, contract, claimant, agent, and oracle
  admin view.
- `/agent` explains the evidence-to-claim workflow in simple language.

The product model is:

1. Your wallet owns the policy and identifies you as the claimant.
2. The Underwrite agent verifies signed evidence and calculates the deterministic payout tier.
3. Casper enforces policy, claimant, oracle, freshness, replay, and payout rules.
4. The vault pays valid claims automatically.
5. Operator Mode provides a server-side administration fallback.

Wallet Mode contract support:

- Existing `register_policy` remains owner/admin-gated for Operator Mode.
- New `register_policy_self` supports wallet-owned policy registration by
  requiring the transaction caller to equal the claimant.
- `settle_claim` remains agent-authorized; users own policies, agents process
  claims, and Casper enforces payouts.
- Real wallet-mode policy registration and Agent Request settlement evidence
  are displayed on `/evidence`.

The frontend supports two operating modes on `/operate`:

- **Wallet Mode (default):** the primary user-facing path. Shows a workflow
  with honest status labels: connect wallet, review policy terms, register
  policy with wallet, request agent verification, and track claim result.
  Frontend support for browser-wallet `register_policy_self` is implemented.
  Agent Request Mode allows wallet-authenticated users to securely request
  agent verification via off-chain signatures. The server verifies the wallet
  signature, creates request-scoped files, runs the agent, and submits the
  settlement claim without exposing private keys to the browser.
- **Operator Mode:** server-side administration fallback. Run the app locally
  with your own funded Testnet key and enable server-side operations:

```text
UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true
```

In local operator mode, `/operate` calls `POST /api/operations/run`, which maps
to the existing scripts:

- `scripts/register-policy.sh`
- `scripts/run-agent.sh`
- `scripts/submit-valid-claim.sh`

If operator actions are disabled, the UI says so intentionally, explains that
the deployment is protecting keys, and does not show fake hashes.

The older static dashboard remains available as a no-build fallback:

```bash
python3 -m http.server 4174
```

Then open `http://localhost:4174/dashboard/`.

## Security Scope

Underwrite is unaudited hackathon software. It demonstrates a small
Casper-native risk settlement primitive and must not custody production funds
without professional review.
