FROM rust:1-bookworm

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    nodejs \
    npm \
    pkg-config \
    libssl-dev \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN rustup toolchain install nightly-2026-06-25 --profile minimal \
  && rustup target add wasm32-unknown-unknown --toolchain nightly-2026-06-25

RUN cargo build -p underwrite-agent \
  && cargo build -p underwrite-contracts --features livenet \
    --bin deploy_testnet \
    --bin diagnose_testnet \
    --bin register_policy_testnet \
    --bin register_policy_self_testnet \
    --bin submit_claim_testnet \
    --bin submit_duplicate_claim_testnet \
    --bin submit_stale_claim_testnet

WORKDIR /app/web

RUN npm ci \
  && npm run build

WORKDIR /app

RUN chmod +x scripts/railway-entrypoint.sh \
  && mkdir -p /app/secrets /app/deployments/requests

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["scripts/railway-entrypoint.sh"]
CMD ["sh", "-c", "npm run start --prefix web -- -H 0.0.0.0 -p ${PORT:-3000}"]
