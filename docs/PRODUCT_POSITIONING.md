# Product Positioning

## Old Framing

Underwrite started as a narrow cargo-delay settlement demo:

```text
cargo delay insurance on Casper
```

That framing was useful for proving one end-to-end scenario, but it made the
product sound like a single vertical insurance app.

## New Framing

Underwrite Lite is a Casper-native risk settlement primitive for DeFi and RWA
apps:

```text
signed risk attestation
  -> autonomous agent verification
  -> deterministic payout calculation
  -> Casper authorization, freshness, and replay checks
  -> funded vault settlement
```

The product is still narrow, but the narrowness is now at the protocol layer:
verify a signed risk event, enforce deterministic bounds, and settle safely.

## Why The Pivot

Casper already has protocol tooling and smart contract infrastructure. The more
interesting gap is native risk, underwriting, trigger, and settlement
infrastructure that Casper DeFi and RWA builders can compose with.

Underwrite Lite fits that gap better than a full marketplace. It gives builders
a reusable settlement spine without claiming to solve underwriting, pricing,
distribution, or claims operations end to end.

## Why Cargo Delay Remains

Cargo delay remains the first working scenario because it is realistic,
measurable, and easy to verify:

- policy ID
- covered shipment or tracking reference
- delay hours
- signed oracle/evidence attestation
- deterministic payout tiers
- replay-safe settlement

In this repo, `cargo_delay` is the only fully implemented template. It proves
the generic spine without pretending the other templates are done.

## Possible Casper Ecosystem Complements

These are possible future templates or integrations, not implemented claims in
the current repo:

- CSPR.trade-style LP risk cover for pool incidents or liquidity shocks
- CSPR treasury drawdown cover for DAO or protocol treasury thresholds
- Liquid staking or validator risk cover for measurable validator incidents
- RWA invoice/default attestation cover for credit or receivables products

## In Scope For The Hackathon

- One working `cargo_delay` risk template
- Signed risk-attestation fixture
- Autonomous Rust agent verification
- Deterministic payout calculation
- Odra/Casper settlement contract tests
- Replay, freshness, oracle, agent, and payout-bound checks
- CEP-18-style vault payout path
- Clear Testnet deployment checklist and evidence placeholders

## Explicitly Out Of Scope

- x402
- Policy NFTs
- Live CSPR.trade integration
- Live CSPR.cloud indexing
- Complex AI risk scoring
- Insurance marketplace workflows
- Multi-chain settlement
- Production custody or real insurance payouts
