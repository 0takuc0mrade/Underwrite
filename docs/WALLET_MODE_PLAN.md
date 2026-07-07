# Underwrite Casper Wallet Mode Implementation Plan

## Current Operator Mode

Underwrite currently keeps a guarded Operator Mode:

- The frontend connects Casper Wallet for claimant/operator identity.
- State-changing deploys are submitted by local server-side Odra scripts.
- `/api/operations/run` invokes those scripts only when `UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true`.
- Private keys stay in `.env` on the server and are never exposed to the browser.
- The Underwrite agent verifies signed evidence and produces claim attestations.

This mode remains useful for local administration, hackathon demos, and recovery
flows. It must not be removed while Wallet Mode is introduced.

## Wallet Mode Direction

Wallet Mode should let users own the actions that belong to them while keeping
claim settlement safe:

- Users connect Casper Wallet.
- Users sign policy creation for their own claimant account.
- Users may fund a policy or vault if the token/funding model gives them tokens.
- Users request claim verification by signing an off-chain authorization.
- The Underwrite agent verifies evidence and creates a claim attestation.
- The authorized agent/relayer submits settlement claims.
- Casper enforces policy rules, oracle trust, freshness, replay protection,
  payout bounds, and vault settlement.

## Contract Support Added

The existing owner/admin endpoint remains:

```text
register_policy(...)
```

It still calls `assert_owner()` and is the Operator Mode path.

Wallet Mode support is introduced through a separate endpoint:

```text
register_policy_self(policy_number, claimant, insured_value_minor, currency, oracle_public_key)
```

This endpoint requires:

```text
caller == claimant
```

That means a wallet user can register a policy for themselves, but cannot
register a policy for another claimant. `settle_claim` remains agent-gated and
still calls `assert_agent()`.

## User Wallet Actions

Recommended wallet-signed actions:

- `register_policy_self`: user creates their own policy.
- Optional vault/policy funding: only if the CEP-18 test token flow gives the
  wallet user transferable tokens or a faucet/mint helper exists.
- Claim verification request: user signs an off-chain message proving ownership
  of the claimant account before the agent processes evidence.

## Agent Actions

These should remain agent/relayer-controlled:

- Verify signed evidence.
- Calculate deterministic payout.
- Create claim attestation.
- Submit `settle_claim` if the protocol requires the authorized agent gate.

This preserves the contract-side safety model: users can own policies, but a
trusted agent path still protects settlement.

## Server/Operator Actions

These remain available as admin/local fallback:

- `scripts/register-policy.sh`
- `scripts/register-policy-self.sh` for testing the new self-registration path
- `scripts/run-agent.sh`
- `scripts/submit-valid-claim.sh`
- duplicate and stale rejection helpers

Operator Mode should remain guarded by `UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true`.

## Required Frontend Changes

Implemented frontend shape:

- `/operate` presents Wallet Mode (default) and Operator Mode with a toggle.
- Wallet Mode shows a six-step workflow with explicit ready/running/success
  states.
- A wallet capability panel shows connection status, public key, network, and
  signing detection.
- Wallet policy registration builds the `register_policy_self` deploy for
  Casper Wallet signing.
- Agent Request Mode asks the wallet to sign an off-chain verification request
  before the backend runs the agent.
- Operator Mode preserves all existing server-side operator controls.

## Agent Request API

Implemented:

- `POST /api/agent/request-verification` accepts a wallet-signed off-chain
  request.
- The route is guarded by `UNDERWRITE_ENABLE_AGENT_REQUESTS=true`, separate
  from privileged Operator Mode.
- The backend validates policy ID, claimant public key, evidence/scenario ID,
  nonce, timestamps, chain name, contract hash, and wallet signature before any
  script runs.
- Script execution uses fixed command names and safe argument arrays. Users
  cannot choose scripts or file paths.
- Request nonce/idempotency tracking is abstracted behind `AgentRequestStore`.
  The MVP store is file-backed at `deployments/requests/request-store.json`,
  with in-memory fallback only for local demo use if durable storage is
  unavailable.
- The route creates request-scoped payload, fixture, and attestation artifacts
  under `deployments/requests/`.
- Generated request artifacts are ignored by git and can be cleaned with
  `scripts/clean-request-artifacts.sh`.
- `/api/operations/run` remains the local/admin Operator Mode route guarded by
  `UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true`.

## Deployment And Evidence Notes

The existing Operator Mode Casper Testnet evidence remains valid for the
original deployed contract version.

Wallet Mode and Agent Request Mode also have separate Testnet evidence:

- Contract: `hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f`
- Token: `hash-1f2857fd127ffe3014d06734b5df882cf084fdd50bfab36c1e4020533c56793d`
- Wallet policy registration:
  `8779d088e9aa4bc70ed416c08805c778b2bdc4ff36b4be90c9e9589dfe52c6aa`
- Agent Request settlement:
  `e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b`

These are rendered by `/evidence` from
`web/public/evidence/wallet-mode-testnet.json`. Do not overwrite evidence with
fake hashes; add new records only after real Testnet transactions exist.

## Risks And Limitations

- Browser wallet signing depends on Casper Wallet/provider API compatibility.
- Users need Testnet CSPR for gas.
- Vault funding may not be wallet-feasible unless users can obtain or mint the
  CEP-18 settlement token.
- The agent remains a trusted component for final settlement submission.
- File-backed request storage is sufficient for this MVP but should be replaced
  by Redis, Postgres, SQLite, or another durable shared store before serious
  hosted public use.
- Current API rate limiting is in-memory and process-local.

## Recommended MVP Implementation Order

1. ~~Add `register_policy_self` contract support while preserving `register_policy`.~~ Done.
2. ~~Add tests for admin registration, self-registration, mismatch rejection, and
   existing claim safety paths.~~ Done.
3. ~~Add a livenet helper script for self-registration testing.~~ Done.
4. ~~Redeploy the wallet-mode contract version to Casper Testnet.~~ Done.
5. ~~Update the frontend to show Wallet Mode UI without sending deploys.~~ Done.
6. ~~Implement frontend support for browser-signed `register_policy_self`.~~ Done.
7. ~~Add off-chain wallet-signed claim requests for the agent (Agent Request Mode).~~ Done. (Allows users to request verification securely).
8. ~~Add request-store abstraction, Agent Request validation tests, and request
   artifact cleanup.~~ Done.
9. Evaluate wallet-based vault funding only after token distribution is clear.
