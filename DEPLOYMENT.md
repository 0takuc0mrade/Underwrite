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

The automated Odra livenet binaries now cover:

- `SettlementToken`
- `UnderwriteSettlement`
- initial token transfer into the settlement vault
- demo policy registration
- valid claim submission from the latest agent attestation
- duplicate claim attempt
- stale/invalid claim attempt

Odra does not currently expose every deploy hash through these helper binaries,
so scripts record statuses and leave hash fields empty until you capture real
hashes from node output or an explorer. Do not invent hashes.

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
ODRA_CASPER_LIVENET_NODE_ADDRESS
ODRA_CASPER_LIVENET_EVENTS_URL
ODRA_CASPER_LIVENET_CHAIN_NAME
ODRA_CASPER_LIVENET_SECRET_KEY_PATH
UNDERWRITE_AGENT_ACCOUNT
UNDERWRITE_ORACLE_PUBLIC_KEY
DEMO_CLAIMANT_ACCOUNT
UNDERWRITE_CONTRACT_ADDRESS
UNDERWRITE_POLICY_ID
UNDERWRITE_INSURED_VALUE_MINOR
UNDERWRITE_POLICY_CURRENCY
UNDERWRITE_ATTESTATION_PATH
DEPLOYMENT_OUTPUT
```

Do not commit `.env` or private keys.

## Build

```bash
scripts/build-contracts.sh
```

This runs `cargo test --workspace`. If `cargo-odra` is installed, it also runs
`cargo odra build` inside `contracts/`. For Testnet deployment artifacts,
`cargo-odra` is required:

```bash
cargo install cargo-odra
REQUIRE_CONTRACT_ARTIFACTS=1 scripts/build-contracts.sh
```

The Odra build writes artifacts to `contracts/wasm/`. The build script also
mirrors them to the workspace root `wasm/` directory because Odra livenet
deployment resolves `SettlementToken.wasm` and `UnderwriteSettlement.wasm`
relative to the command working directory.

`cargo-odra` also requires `wasm-opt` and `wasm-strip`. Install them with your
system package manager, or use user-local npm packages if you cannot use sudo:

```bash
npm install -g binaryen
npm install -g wabt
```

Without `REQUIRE_CONTRACT_ARTIFACTS=1`, the script remains usable for local
verification and clearly reports that artifacts were not produced.

## Preflight

Before the real Testnet run:

```bash
scripts/preflight-testnet.sh
```

The default `deploy` phase checks required binaries, `.env`, account/key values,
fixture files, deployment evidence shape, livenet binary compilation, and the
agent attestation path. It does not require `UNDERWRITE_CONTRACT_ADDRESS`,
because that value is created by deployment.

Odra's livenet client expects `ODRA_CASPER_LIVENET_NODE_ADDRESS` to point at the
JSON-RPC endpoint and `ODRA_CASPER_LIVENET_EVENTS_URL` to point at the event
stream. The helper scripts normalize missing `/rpc` suffixes for the RPC URL and
normalize the legacy `/events/main` event path to `/events`. The clean Testnet
values are:

```text
ODRA_CASPER_LIVENET_RPC_ADDRESS=https://node.testnet.casper.network/rpc
ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.casper.network/rpc
ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.casper.network/events
```

The workspace patches `odra-casper-rpc-client` locally under `vendor/` so Odra
livenet transactions use Casper Testnet's active pricing settings. The current
Testnet chainspec reports `pricing_handling = payment_limited`,
`max_gas_price = 1`, an install/upgrade lane gas limit of
`1_000_000_000_000`, and a block gas limit of `812_500_000_000`. The deployment
path therefore uses payment-limited pricing with `CASPER_GAS_PRICE_TOLERANCE=1`
and caps install gas at `812_500_000_000`.

After deployment, run the demo-phase preflight:

```bash
PREFLIGHT_PHASE=demo scripts/preflight-testnet.sh
```

The demo phase additionally requires `UNDERWRITE_CONTRACT_ADDRESS`.

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

This script calls:

```bash
cargo run -p underwrite-contracts --features livenet --bin register_policy_testnet
```

The helper rehydrates `UNDERWRITE_CONTRACT_ADDRESS`, parses
`DEMO_CLAIMANT_ACCOUNT`, converts the raw demo oracle key into Casper's public
key hex format, and calls `register_policy`. If Odra does not print the deploy
hash, capture it from the node/explorer and record it manually as a real value.

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
scripts/submit-valid-claim.sh
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

This script calls:

```bash
cargo run -p underwrite-contracts --features livenet --bin submit_claim_testnet
```

After the real deploy succeeds, record the explorer hash if Odra did not expose
it directly:

```bash
node scripts/record-evidence.mjs set \
  validDeploy=<valid-claim-deploy-hash> \
  explorerLinks.validClaim=<explorer-url>
```

## Duplicate And Stale/Invalid Rejection

Run:

```bash
scripts/attempt-duplicate-claim.sh
scripts/generate-stale-attestation.sh
scripts/attempt-stale-claim.sh
```

These scripts call:

```bash
cargo run -p underwrite-contracts --features livenet --bin submit_duplicate_claim_testnet
cargo run -p underwrite-contracts --features livenet --bin submit_stale_claim_testnet
```

The duplicate helper resubmits the latest claim and should fail with
`ClaimAlreadyProcessed` after the valid submission is accepted. The stale
generator signs a separate stale risk attestation, runs the agent on it, and
writes `deployments/latest-stale-attestation.json`. The stale helper submits
that separate claim so stale/expired rejection evidence is independent from the
duplicate-claim path.

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
node scripts/record-evidence.mjs note "valid claim submitted; explorer hash captured from Testnet output"
```

The committed example shape is:

```text
deployments/casper-testnet.example.json
```

## Captured Testnet Evidence

The 2026-06-28 Testnet run deployed and exercised the fixed settlement path.
The successful deployment used Casper Testnet chain `casper-test` and node
`https://node.testnet.casper.network/rpc`.

| Artifact | Value |
| --- | --- |
| Settlement token | `hash-b72d08a0ff2ad7653ca99c875b64290b521f150824473fa646388b6f85686b5a` |
| Underwrite settlement | `hash-9b94b24a2d92dce1d69df6c5d04eddf983b7894763a388f91c8aedc8ae523f6f` |
| Token deploy | `efadf65f932c36d6d20e8a794be33e9312d7fed4e180947376969388ea51d217` |
| Settlement deploy | `843e8ed8c6d0b8ed071dd5b97542367f147fcf9ababc114aed8149feb09bdad4` |
| Vault funding | `0d89bc6f277b1ff569cd64e04df350c36946749275a6ffe0302bfdbb3f4648a5` |
| Policy registration | `953dba5cebef2141b0f116c06a7e8a2ebd04c2f7e4b93f446d94db6ac6266efc` |
| Valid claim | `2129b97bdbee1d659a3dbe784420feb004ec6e411966ece3395e7828d824c23b` |
| Duplicate rejection | `9a4d4fa5700e0c19b5450a77618a01b1eef7945b42fa427d2a56ad6870d5ec3f` (`User error: 8`) |
| Stale rejection | `941dc7fbfc16936a442628dd2200f7b9b7d2f00a5b334b6e3f7171fb181c1b2f` (`User error: 11`) |
| Payout | 50%, `6250000` minor units |

## One-Command Demo Path

After contracts are deployed and `UNDERWRITE_CONTRACT_ADDRESS` is set:

```bash
scripts/run-testnet-demo.sh
```

This performs policy registration, valid agent attestation generation, valid
claim submission, duplicate attempt, stale attestation generation, stale attempt,
and evidence JSON updates.

## Frontend Test Mode

The Next.js frontend includes a self-serve Testnet demo at:

```text
web/app/api/demo/run/route.ts
```

The route accepts:

```json
{ "scenario": "valid", "claimantAccount": "account-hash-..." }
```

Supported scenarios are:

- `valid`: generates a fresh 75-hour cargo-delay report, registers the policy
  for the pasted claimant, asks the agent to verify the report, and submits the
  valid claim.
- `duplicate`: generates and submits a fresh valid claim first, then resubmits
  the same claim so Casper can block the duplicate.
- `expired`: generates an old signed report and submits it so Casper can block
  the expired claim.

For safety, real Testnet transactions are disabled unless the server `.env`
contains:

```text
UNDERWRITE_ENABLE_TESTNET_RUNNER=true
```

Keep the Testnet secret key server-side only. Do not expose `.env` values to
the browser. Generated web-demo payloads are written under
`deployments/web-demo/`, which is ignored by git.

## Known Manual Steps

- Deploy hashes are printed in node output by the patched livenet client. If a
  future run leaves evidence fields empty, capture them from node output,
  wallet tooling, or explorer search. Paste real values with:

  ```bash
  node scripts/record-evidence.mjs set validDeploy=<hash> explorerLinks.validClaim=<url>
  node scripts/record-evidence.mjs set duplicateDeploy=<hash-or-error-reference>
  node scripts/record-evidence.mjs set staleDeploy=<hash-or-error-reference>
  ```

- If `cargo-odra` is not installed, `scripts/build-contracts.sh` only runs tests
  and skips artifact generation honestly.
- Never enter placeholder hashes, fake explorer URLs, or guessed statuses.

Until those steps are complete, leave the relevant fields empty or add a note.
