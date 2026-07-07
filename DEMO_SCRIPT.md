# Underwrite Demo Script

Target length: 2 to 3 minutes.

## 0:00-0:20 - Open

"Underwrite is a Casper dApp for parametric risk settlement. Users connect their
Casper wallet to own policies. The Underwrite agent verifies signed evidence and
submits settlement claims. Casper enforces every payout rule."

Show the Next.js frontend:

```bash
cd web
npm run dev
```

Open `http://localhost:3000`.

## 0:20-0:45 - Product Model

"The product model separates responsibilities: your wallet owns the policy, the
agent checks the evidence, the contract enforces rules, the vault pays valid
claims, and an operator fallback exists for local administration."

Show the landing page product model cards.

## 0:45-1:20 - Wallet Mode

"On `/operate`, the default view is Wallet Mode. It shows a full workflow:
connect wallet, review policy terms, register policy with wallet signing,
request agent verification, and track the Casper settlement result."

Show `/operate` in Wallet Mode.

"Wallet-signed registration is implemented on Casper Testnet through
`register_policy_self`. Agent verification can be requested directly from
the browser through Agent Request Mode: the wallet signs an off-chain request,
the backend verifies that signature, the agent checks the evidence, and the
authorized relayer submits settlement to Casper."

Show the wallet capability panel, register a policy, and click request claim
verification. Wait for the deploy hash or show the recorded Agent Request
settlement hash if you are in proof-only mode.

## 1:20-1:50 - Operator Mode

Switch to Operator Mode on `/operate`.

"Operator Mode is the server-side administration path. It runs operations
through local scripts and requires `UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true`."

If local operator mode is enabled, run one operation. Otherwise show the
disabled state and say:

"Operator actions are disabled on this deployment for key safety. To execute
actions, run locally with your own funded Casper Testnet key."

## 1:50-2:15 - Evidence Page

"The evidence page is the audit log. It separates wallet policy registration,
Agent Request settlement, Operator Mode vault funding, duplicate replay
rejection, and stale-evidence rejection."

Show `/evidence` and open one explorer link.

## 2:15-2:40 - Policy and Agent Pages

"The policy page shows the contract hash, settlement token, vault, claimant,
agent, oracle key, payout rule, and network. The agent page explains how
evidence becomes a verified claim."

Show `/policy` and `/agent`.

## 2:40-3:00 - Close

"Underwrite separates user wallet actions from agent actions and
contract-enforced rules. Users can register policies with Casper Wallet,
request agent verification with an off-chain wallet signature, and verify the
result on Casper Testnet. Operator Mode remains available for local
administration."
