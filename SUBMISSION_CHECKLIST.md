# Underwrite Submission Checklist

Use this as the practical path from local prototype to Casper Testnet
submission.

## Repository

- [ ] Configure GitHub remote.
- [ ] Push `main`.
- [ ] Confirm README renders cleanly.
- [ ] Confirm no secrets are committed.
- [ ] Confirm `.env` remains ignored.

## Local Verification

- [ ] Install pinned nightly toolchain.
- [ ] Run `cargo test -p underwrite-agent`.
- [ ] Run `cargo test --workspace`.
- [ ] Run `cargo run -p underwrite-agent -- fixtures/signed-observation.json`.
- [ ] Save attestation output.
- [ ] Save test output logs.

## Contract Deployment

- [ ] Fund Casper Testnet deploy account.
- [ ] Build Odra contracts.
- [ ] Deploy `SettlementToken`.
- [ ] Deploy `UnderwriteSettlement`.
- [ ] Fund the settlement vault.
- [ ] Record settlement token address.
- [ ] Record settlement contract address.
- [ ] Record agent account.
- [ ] Record oracle public key.

## Policy And Claim Flow

- [ ] Register policy on Testnet.
- [ ] Capture policy registration deploy hash.
- [ ] Run agent on signed fixture.
- [ ] Submit valid claim attestation.
- [ ] Capture valid claim deploy hash.
- [ ] Confirm payout amount in minor units.
- [ ] Confirm settlement record exists.
- [ ] Confirm claimant token balance increased.

## Failure Evidence

- [ ] Submit duplicate claim and capture rejection evidence.
- [ ] Submit stale claim and capture rejection evidence.
- [ ] Submit wrong-oracle claim and capture rejection evidence.
- [ ] Submit over-limit payout and capture rejection evidence.
- [ ] Save deploy hashes or node responses for each failure case.

## Dashboard And Docs

- [ ] Update `deployments/casper-testnet.example.json` into a real deployment JSON.
- [ ] Replace dashboard pending explorer link with real explorer URL.
- [ ] Add Testnet addresses and deploy hashes to README.
- [ ] Add screenshots or terminal captures.
- [ ] Record a demo under five minutes.
- [ ] Show signed evidence in.
- [ ] Show agent attestation.
- [ ] Show Casper contract verification.
- [ ] Show vault payout.
- [ ] Show duplicate or stale rejection.

## Submission

- [ ] Confirm the product is framed as Underwrite Lite.
- [ ] Avoid marketplace, x402, NFT, or broad insurance claims in public copy.
- [ ] Submit repository link.
- [ ] Submit demo video.
- [ ] Submit Testnet evidence.
- [ ] Submit dashboard or screenshots.
