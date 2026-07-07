# Railway Deployment

Underwrite deploys on Railway as one Docker-backed service:

```text
Next.js frontend
Next.js API routes
Rust agent and Odra livenet scripts
Casper key written server-side from base64
file-backed Agent Request nonce store on a Railway volume
```

Do not deploy this as a Railway Function or Bucket. Use **GitHub Repository**
so Railway builds the root `Dockerfile`.

## 1. Railway Service

1. Create a new Railway project.
2. Click **GitHub Repository**.
3. Select `0takuc0mrade/Underwrite`.
4. Let Railway detect the root `Dockerfile`.
5. Add a Railway volume mounted at:

```text
/app/deployments/requests
```

That volume stores:

```text
request-store.json
request-scoped payload files
request-scoped fixture files
request-scoped attestation files
```

## 2. Casper Key

Do not paste a raw PEM private key into frontend variables.

On your machine, encode the Testnet secret key:

```bash
base64 -w0 "/path/to/secret_key.pem"
```

In Railway, set:

```text
CASPER_SECRET_KEY_PEM_BASE64=<base64 output>
ODRA_CASPER_LIVENET_SECRET_KEY_PATH=/app/secrets/casper-secret-key.pem
CASPER_ACCOUNT_SECRET_KEY_PATH=/app/secrets/casper-secret-key.pem
```

The Docker entrypoint writes the decoded key to:

```text
/app/secrets/casper-secret-key.pem
```

The key remains server-side. It is never exposed to the browser.

## 3. Environment Variables

Start with public actions disabled:

```text
UNDERWRITE_ENABLE_AGENT_REQUESTS=false
UNDERWRITE_ENABLE_OPERATOR_ACTIONS=false
```

Core env:

```text
CASPER_NETWORK=casper-testnet
CASPER_NODE_ADDRESS=https://node.testnet.casper.network/rpc
CASPER_CHAIN_NAME=casper-test

ODRA_CASPER_LIVENET_RPC_ADDRESS=https://node.testnet.casper.network/rpc
ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.casper.network/rpc
ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.casper.network/events
ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test

UNDERWRITE_AGENT_ACCOUNT=<agent account-hash>
UNDERWRITE_ORACLE_PUBLIC_KEY=<oracle public key>
DEMO_CLAIMANT_ACCOUNT=<claimant account-hash>

UNDERWRITE_TOKEN_ADDRESS=hash-1f2857fd127ffe3014d06734b5df882cf084fdd50bfab36c1e4020533c56793d
UNDERWRITE_CONTRACT_ADDRESS=hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f
UNDERWRITE_VAULT_ADDRESS=hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f

UNDERWRITE_POLICY_ID=MRC-CRG-2026-00481
UNDERWRITE_INSURED_VALUE_MINOR=12500000
UNDERWRITE_POLICY_CURRENCY=USD

CASPER_EXPLORER_BASE_URL=https://testnet.cspr.live

NEXT_PUBLIC_CASPER_CHAIN_NAME=casper-test
NEXT_PUBLIC_CASPER_RPC_URL=https://node.testnet.casper.network/rpc
NEXT_PUBLIC_CASPER_EXPLORER_BASE_URL=https://testnet.cspr.live
NEXT_PUBLIC_UNDERWRITE_CONTRACT_HASH=hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f
```

When the hosted app loads correctly, enable Agent Request Mode:

```text
UNDERWRITE_ENABLE_AGENT_REQUESTS=true
```

Keep Operator Mode disabled on hosted public deployments unless you are
deliberately running an admin-only instance:

```text
UNDERWRITE_ENABLE_OPERATOR_ACTIONS=false
```

## 4. Hosted Smoke Test

1. Open the Railway URL.
2. Confirm `/`, `/operate`, `/evidence`, `/policy`, and `/agent` load.
3. Confirm `/operate` shows Wallet Mode.
4. Connect Casper Wallet.
5. Register a policy if using a fresh policy ID.
6. Click **Request Agent Verification**.
7. Sign the off-chain wallet request.
8. Wait for the returned Casper deploy hash.
9. Open the explorer link.
10. Check `/evidence` for the recorded wallet and agent proof.

## 5. Runtime Notes

- The container includes Rust/Cargo because Agent Request Mode runs the Rust
  agent and Odra livenet settlement scripts.
- Request nonce storage is file-backed on the Railway volume.
- This is MVP-safe for a single Railway service. For production, replace the
  file-backed store and in-memory rate limit with Postgres, Redis, SQLite, or
  another durable shared system.
- Do not commit `.env`, raw PEM keys, request artifacts, or generated
  deployment scratch files.
