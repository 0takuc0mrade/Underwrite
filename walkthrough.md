# Underwrite MVP Walkthrough

## What Changed

Underwrite now has a product-facing Wallet Mode plus a hardened Agent Request
Mode:

- Users can connect Casper Wallet from `/operate`.
- Users can register their own policy through `register_policy_self`.
- Users can request claim verification by signing an off-chain message.
- The backend verifies the wallet signature before running any agent workflow.
- The agent creates request-scoped evidence and claim attestation artifacts.
- The authorized server-side agent/relayer submits settlement to Casper.
- `/evidence` separates Wallet Mode, Agent Request Mode, and Operator Mode
  proof.

Operator Mode still exists as a local/admin fallback and remains guarded by
`UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true`.

## Files Touched

- `web/app/api/agent/request-verification/route.ts`
- `web/app/api/agent/request-verification/route.test.ts`
- `web/lib/agent-request.ts`
- `web/lib/agent-request-handler.ts`
- `web/app/underwrite-ui.tsx`
- `web/package.json`
- `web/tsconfig.json`
- `.gitignore`
- `scripts/clean-request-artifacts.sh`
- `README.md`
- `DEMO_SCRIPT.md`
- `SUBMISSION_SUMMARY.md`
- `docs/WALLET_MODE_PLAN.md`
- `walkthrough.md`

## How Agent Request Mode Works

1. The browser builds a request with policy ID, claimant public key, evidence
   ID/hash, nonce, timestamps, chain name, and contract hash.
2. Casper Wallet signs the request message off-chain.
3. `POST /api/agent/request-verification` receives the signed request.
4. The route checks `UNDERWRITE_ENABLE_AGENT_REQUESTS=true`.
5. The route validates all user-controlled fields before any command runs.
6. The backend verifies the wallet signature against the claimant public key.
7. The nonce is recorded through `AgentRequestStore`.
8. The backend writes request-scoped artifacts under `deployments/requests/`.
9. The Rust agent verifies evidence and emits a claim attestation.
10. The backend calls the fixed settlement script with safe argument arrays.
11. The response returns the real deploy hash and explorer link if Casper
    accepted the settlement transaction.

The route never accepts arbitrary script names or arbitrary paths from the
browser, and it never returns fake deploy hashes.

## Request Storage And Cleanup

Request nonce/idempotency tracking uses a file-backed store at:

```text
deployments/requests/request-store.json
```

Generated request artifacts are ignored by git:

```text
deployments/requests/
```

Clean old request artifacts with:

```bash
scripts/clean-request-artifacts.sh
```

The code includes an in-memory fallback only for local MVP/demo use. Hosted
production deployments should replace this with Redis, Postgres, SQLite, or
another durable shared store.

## How To Run The App

```bash
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful pages:

- `/` product overview
- `/operate` Wallet Mode and Operator Mode
- `/evidence` audit trail and explorer links
- `/policy` policy, vault, token, and account state
- `/agent` agent workflow explanation

## Test Wallet Mode

1. Open `/operate`.
2. Connect Casper Wallet.
3. Confirm the wallet public key appears.
4. Review the policy terms.
5. Register the policy with wallet signing.
6. Confirm the transaction hash or inspect the recorded proof on `/evidence`.

Known wallet-mode proof:

- Policy registration:
  `8779d088e9aa4bc70ed416c08805c778b2bdc4ff36b4be90c9e9589dfe52c6aa`
- Contract:
  `hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f`

## Test Agent Request Mode

Set the server flag:

```text
UNDERWRITE_ENABLE_AGENT_REQUESTS=true
```

Then:

1. Open `/operate`.
2. Connect the claimant wallet.
3. Click the Agent Request verification action.
4. Sign the off-chain request in Casper Wallet.
5. Wait for the backend to verify evidence and submit settlement.
6. Confirm the returned deploy hash and explorer link.

Known Agent Request proof:

- Settlement:
  `e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b`

## Test Operator Mode

Operator Mode is local/admin only. Enable it deliberately:

```text
UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true
```

Then use `/operate` or the scripts:

```bash
scripts/register-policy.sh
scripts/run-agent.sh
scripts/submit-valid-claim.sh
scripts/attempt-duplicate-claim.sh
scripts/attempt-stale-claim.sh
```

Private keys stay server-side in `.env`. Do not commit `.env`.

## Verification Commands

Frontend:

```bash
cd web
npm run test:agent-request
npm run typecheck
npm run lint
npm run build
```

Rust:

```bash
cargo test -p underwrite-agent
cargo test --workspace
cargo check -p underwrite-contracts --features livenet --bins
```

## Production Caveats

- The contracts are hackathon software and unaudited.
- Agent Request nonce storage is file-backed for MVP readiness, not a
  distributed production datastore.
- API rate limiting is in-memory and process-local.
- Hosted public deployments should use durable request storage, shared rate
  limiting, monitoring, and stricter operational controls.
- Vault funding UX is intentionally not included yet.
