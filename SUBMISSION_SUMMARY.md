# Underwrite Submission Summary

## One-Liner

Underwrite is a Casper-native risk settlement primitive that turns signed risk
attestations into deterministic, replay-safe vault payouts.

## Problem

RWA and DeFi apps need a small, verifiable way to settle measurable risk events
without building a full insurance marketplace. They need policy state,
authorized evidence, bounded payouts, replay protection, and auditable
settlement records.

## Solution

Underwrite registers a risk policy on Casper, verifies a signed cargo-delay
attestation with a Rust agent, calculates the deterministic payout, and submits
a claim attestation to an Odra settlement contract. The contract independently
checks policy existence, claimant match, oracle authorization, freshness,
expiry, replay state, and payout bounds.

The frontend presents three execution paths. Wallet Mode is the default user
path: connect Casper Wallet, review policy terms, register a policy with wallet
signing, request agent verification, and track the settlement result. Agent
Request Mode lets the user sign an off-chain request so the backend can verify
identity before the authorized agent submits settlement. Operator Mode remains
the server-side administration fallback for local execution through guarded
scripts.

Wallet-mode contract support exists through `register_policy_self`, which lets
a caller register a policy only for itself. The original owner/admin
`register_policy` remains intact for Operator Mode, and claim settlement
remains agent-authorized. Browser-wallet `register_policy_self` and
wallet-authenticated Agent Request settlement are implemented and backed by
real Casper Testnet evidence.

## Casper Integration

Underwrite deploys an Odra `UnderwriteSettlement` contract and a CEP-18
settlement token on Casper Testnet. The real Testnet demo registers policy
`MRC-CRG-2026-00481`, settles a valid claim, rejects a duplicate replay, and
rejects a stale claim.

Key evidence:

- Wallet-mode settlement contract: `hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f`
- Wallet-mode settlement token: `hash-1f2857fd127ffe3014d06734b5df882cf084fdd50bfab36c1e4020533c56793d`
- Wallet policy registration: `8779d088e9aa4bc70ed416c08805c778b2bdc4ff36b4be90c9e9589dfe52c6aa`
- Agent Request settlement: `e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b`
- Original Operator Mode settlement contract: `hash-9b94b24a2d92dce1d69df6c5d04eddf983b7894763a388f91c8aedc8ae523f6f`
- Valid claim: `2129b97bdbee1d659a3dbe784420feb004ec6e411966ece3395e7828d824c23b`
- Duplicate rejection: `9a4d4fa5700e0c19b5450a77618a01b1eef7945b42fa427d2a56ad6870d5ec3f`
- Stale rejection: `941dc7fbfc16936a442628dd2200f7b9b7d2f00a5b334b6e3f7171fb181c1b2f`

## Agentic Angle

The Rust agent is the autonomous bridge between signed evidence and Casper
settlement. It verifies oracle signatures, normalizes the risk attestation,
computes deterministic payout tiers, emits the claim package, and submits the
claim for contract-side enforcement.

## What Works Now

- Rust agent verification for signed cargo-delay risk attestations
- Deterministic payout tiers for cargo delay
- Odra settlement contract with policy registration, oracle checks, freshness,
  replay protection, payout bounds, and settlement records
- CEP-18 vault funding and valid claim settlement on Casper Testnet
- Real duplicate and stale rejection transactions on Casper Testnet
- Next.js product frontend with `/`, `/operate`, `/evidence`, `/policy`, and
  `/agent` pages
- `/operate` presents Wallet Mode (default) and Operator Mode with a toggle
- Wallet Mode shows a six-step workflow with honest status labels
- Wallet capability panel shows connection, public key, network, and signing
  detection
- Browser-wallet policy registration through `register_policy_self`
- Local operator mode through `POST /api/operations/run`, guarded by
  `UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true`
- Dashboard pages that render real Testnet evidence and explorer links without
  fake hashes
- Public **Agent Request Mode** allowing wallet-authenticated users to request
  claim verification and settlement without relying on Operator Mode.
- Wallet-signed off-chain message verification to securely associate requests
  with registered policies.
- File-backed request nonce/idempotency tracking under the ignored
  `deployments/requests/` runtime path, with in-memory fallback only for local
  MVP/demo use.
- In-memory rate limiting to reduce abuse of the agent API.
- Request-scoped agent fixtures that dynamically map a user's policy to the
  verification logic.
- Cleanup tooling for generated request artifacts.

## What Is Next

- Expand autonomous watcher connectors (e.g. API uptime pingers, DeFi hooks)
- Evaluate wallet-based vault funding after token distribution is clear
- Expand operational tooling for multiple policies and deploy accounts
- Harden contracts through review before any production funds
- Replace MVP file/in-memory request stores with production Redis, Postgres, or
  SQLite for hosted public usage
- Add more risk templates after the cargo-delay settlement path is fully
  productized
