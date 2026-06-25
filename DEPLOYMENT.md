# Casper Testnet Deployment

This document moves Underwrite from local verification to real Casper Testnet
evidence. It does not claim any deployment has happened until
`deployments/casper-testnet.json` contains real values captured from Testnet.

## Architecture

```text
signed risk attestation fixture
          |
          v
underwrite-agent
  -> claim attestation + attestation hash
          |
          v
UnderwriteSettlement on Casper Testnet
  -> policy/oracle/agent/freshness/replay/payout checks
          |
          v
SettlementToken vault
  -> claimant payout
```

The current automated Odra livenet binary deploys:

- `SettlementToken`
- `UnderwriteSettlement`
- initial token transfer into the settlement vault

Policy registration and claim submission still require a livenet call helper or
manual Odra/Casper tooling. The scripts in `scripts/` document each step and
record evidence without faking deploy hashes.

## Accounts Needed

- Casper Testnet deploy account with CSPR for gas
- Agent account authorized to call `settle_claim`
- Demo claimant account
- Oracle public key matching the signed fixture

The bundled fixture uses this demo oracle public key:

```text
fd1724385aa0c75b64fb78cd602fa1d991fdebf76b13c58ed702eac835e9f618
```

## Environment

Copy and edit:

```bash
cp .env.example .env
```

Required values:

```text
CASPER_NETWORK
CASPER_NODE_ADDRESS
CASPER_CHAIN_NAME
CASPER_ACCOUNT_SECRET_KEY_PATH
ODRA_CASPER_LIVENET_RPC_ADDRESS
ODRA_CASPER_LIVENET_CHAIN_NAME
ODRA_CASPER_LIVENET_SECRET_KEY_PATH
UNDERWRITE_AGENT_ACCOUNT
UNDERWRITE_ORACLE_PUBLIC_KEY
DEMO_CLAIMANT_ACCOUNT
DEPLOYMENT_OUTPUT
```

Do not commit `.env` or private keys.

## Build

```bash
scripts/build-contracts.sh
```

This runs `cargo test --workspace`. If `cargo-odra` is installed, it also runs
`cargo odra build` inside `contracts/`.

## Deploy Contracts And Fund Vault

```bash
scripts/deploy-testnet.sh
```

This calls the existing Odra livenet deploy binary:

```bash
cargo run -p underwrite-contracts --features livenet --bin deploy_testnet
```

Expected output includes:

```text
SettlementToken: <address>
UnderwriteSettlement: <address>
Vault: <address>
Agent: <address>
VaultFundingMinor: 50000000
```

Record those values:

```bash
node scripts/record-evidence.mjs set \
  token=<SettlementToken> \
  contract=<UnderwriteSettlement> \
  vault=<UnderwriteSettlement> \
  agent=<Agent>
```

## Register Demo Policy

```bash
scripts/register-policy.sh
```

The intended contract call is:

```text
register_policy(
  "MRC-CRG-2026-00481",
  DEMO_CLAIMANT_ACCOUNT,
  12500000,
  "USD",
  UNDERWRITE_ORACLE_PUBLIC_KEY
)
```

Current blocker: the repo does not yet include a livenet helper that rehydrates
the deployed contract address and calls `register_policy`. Use manual
Odra/Casper tooling or add that helper before claiming policy registration
evidence.

## Run Agent

```bash
scripts/run-agent.sh
```

This runs:

```bash
cargo run -p underwrite-agent -- fixtures/signed-risk-attestation.cargo-delay.json
```

It writes `deployments/latest-attestation.json` and records the
`validClaimAttestationHash` in `deployments/casper-testnet.json`.

## Submit Valid Claim

```bash
scripts/submit-claim.sh
```

Use values from `deployments/latest-attestation.json` to call:

```text
settle_claim(
  claim_id,
  policy_number,
  claimant,
  evidence_hash,
  status_code,
  delay_hours,
  payout_amount_minor,
  observed_at,
  expires_at,
  claim_id_signature,
  oracle_public_key
)
```

After the real deploy succeeds, record:

```bash
node scripts/record-evidence.mjs set \
  validDeploy=<valid-claim-deploy-hash> \
  explorerLinks.validClaim=<explorer-url>
```

## Duplicate And Stale/Invalid Rejection

Run:

```bash
scripts/attempt-duplicate-claim.sh
scripts/attempt-stale-claim.sh
```

These scripts describe the exact negative Testnet evidence to capture. The
local contract tests already prove these paths in OdraVM; the remaining work is
capturing real Testnet deploy hashes or node error responses.

Record real values only:

```bash
node scripts/record-evidence.mjs set duplicateDeploy=<hash-or-error-reference>
node scripts/record-evidence.mjs set staleDeploy=<hash-or-error-reference>
```

## Evidence File

The real evidence file is ignored by git:

```text
deployments/casper-testnet.json
```

Initialize or update it:

```bash
node scripts/record-evidence.mjs init
node scripts/record-evidence.mjs set key=value
node scripts/record-evidence.mjs note "manual policy registration pending"
```

The committed example shape is:

```text
deployments/casper-testnet.example.json
```

## Known Manual Steps

- Deploy hashes are not automatically returned by the current Odra deploy
  binary; capture them from node output, wallet tooling, or explorer search.
- Policy registration needs a livenet call helper or manual contract call.
- Claim submission needs a livenet call helper or manual contract call.
- Duplicate and stale rejection evidence must come from real Testnet attempts.

Until those steps are complete, leave the relevant fields empty or add a note.
