# Underwrite Web

Next.js submission frontend for Underwrite.

## Run

```bash
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Evidence

The app renders the real Casper Testnet evidence from `app/evidence.ts`. The
hashes mirror `deployments/casper-testnet.json` and contain no secrets.

## Test Mode

The `Try Underwrite` section calls:

```text
POST /api/demo/run
```

Real Testnet transactions are server-side only and disabled by default. To run
the local self-serve demo, configure the repository `.env` and set:

```text
UNDERWRITE_ENABLE_TESTNET_RUNNER=true
```

Never expose the Testnet secret key to the browser. If the runner is disabled,
the UI returns a clear `not configured` message instead of fake hashes.
