# Underwrite Submission Checklist

Use this as the practical path from local prototype to Casper Testnet
submission.

## Repository

- [ ] Configure GitHub remote.
- [ ] Push `main`.
- [ ] Confirm README renders cleanly.
- [ ] Confirm no secrets are committed.
- [ ] Confirm `.env` remains ignored.
- [ ] Copy `.env.example` to `.env` locally and fill Testnet values.

## Local Verification

- [ ] Install pinned nightly toolchain.
- [ ] Run `cargo test -p underwrite-agent`.
- [ ] Run `cargo test --workspace`.
- [ ] Run `cargo run -p underwrite-agent -- fixtures/signed-observation.json`.
- [ ] Run `cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json`.
- [ ] Run `node scripts/record-evidence.mjs init`.
- [ ] Save attestation output.
- [ ] Save test output logs.
- [ ] Run `scripts/generate-stale-attestation.sh`.
- [ ] Confirm `deployments/latest-stale-attestation.json` is generated locally and remains uncommitted.

## Contract Deployment

- [x] Fund Casper Testnet deploy account.
- [x] Install `cargo-odra` with `cargo install cargo-odra`.
- [x] Install `wasm-opt` and `wasm-strip` through Binaryen/WABT.
- [x] Run `scripts/preflight-testnet.sh`.
- [x] Build Odra contracts.
- [x] Run `scripts/deploy-testnet.sh`.
- [x] Deploy `SettlementToken`.
- [x] Deploy `UnderwriteSettlement`.
- [x] Fund the settlement vault.
- [x] Record settlement token address.
- [x] Record settlement contract address.
- [x] Add `UNDERWRITE_CONTRACT_ADDRESS` to `.env`.
- [x] Run `PREFLIGHT_PHASE=demo scripts/preflight-testnet.sh`.
- [x] Record agent account.
- [x] Record oracle public key.

## Policy And Claim Flow

- [x] Register `cargo_delay` risk policy on Testnet.
- [x] Run `scripts/register-policy.sh`.
- [x] Capture policy registration deploy hash.
- [x] Run `scripts/run-agent.sh`.
- [x] Confirm `validClaimAttestationHash` is written to `deployments/casper-testnet.json`.
- [x] Run `scripts/submit-valid-claim.sh`.
- [x] Submit valid claim attestation.
- [x] Capture valid claim deploy hash.
- [x] Confirm payout amount in minor units.
- [ ] Confirm settlement record exists.
- [ ] Confirm claimant token balance increased.

## Failure Evidence

- [x] Submit duplicate claim and capture rejection evidence.
- [x] Run `scripts/attempt-duplicate-claim.sh`.
- [x] Run `scripts/generate-stale-attestation.sh`.
- [x] Submit stale claim and capture rejection evidence.
- [x] Run `scripts/attempt-stale-claim.sh`.
- [ ] Submit wrong-oracle claim and capture rejection evidence.
- [ ] Submit over-limit payout and capture rejection evidence.
- [x] Save deploy hashes or node responses for duplicate and stale failure cases.

## Dashboard And Docs

- [x] Update `deployments/casper-testnet.example.json` into a real deployment JSON.
- [ ] Keep real `deployments/casper-testnet.json` uncommitted unless intentionally redacted.
- [x] Replace dashboard explorer links with real explorer URLs.
- [x] Add Testnet addresses and deploy hashes to README.
- [x] Add self-serve `Try Underwrite` Testnet demo UI.
- [x] Add guarded server-side demo endpoint.
- [ ] Add screenshots or terminal captures.
- [x] Run `scripts/run-testnet-demo.sh` if you want the full policy/agent/claim/rejection sequence in one command.
- [ ] Record a demo under five minutes.
- [ ] Show signed risk attestation in.
- [ ] Show agent attestation.
- [ ] Show Casper contract verification.
- [ ] Show vault payout.
- [ ] Show duplicate or stale rejection.
- [ ] If using test mode in the recording, set `UNDERWRITE_ENABLE_TESTNET_RUNNER=true` locally and confirm `.env` is not committed.

## Submission

- [ ] Confirm the product is framed as Underwrite Lite: a Casper-native risk settlement primitive.
- [ ] Explain that cargo delay is the first working template, not the whole product.
- [ ] Avoid marketplace, x402, NFT, real CSPR.trade integration, or broad insurance claims in public copy.
- [ ] Submit repository link.
- [ ] Submit demo video.
- [ ] Submit Testnet evidence.
- [ ] Submit dashboard or screenshots.
