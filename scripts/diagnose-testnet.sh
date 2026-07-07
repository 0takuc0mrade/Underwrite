#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
else
  echo "No .env file found; using existing environment variables."
fi

rpc_address="${ODRA_CASPER_LIVENET_RPC_ADDRESS:-${ODRA_CASPER_LIVENET_NODE_ADDRESS:-${CASPER_NODE_ADDRESS:-}}}"
rpc_address="${rpc_address%/}"
if [[ "$rpc_address" != */rpc ]]; then
  rpc_address="${rpc_address}/rpc"
fi
node_base="${rpc_address%/rpc}"
events_url="${ODRA_CASPER_LIVENET_EVENTS_URL:-${node_base}/events}"
events_url="${events_url%/}"
if [[ "$events_url" == */events/main ]]; then
  events_url="${events_url%/main}"
fi

export ODRA_CASPER_LIVENET_RPC_ADDRESS="$rpc_address"
export ODRA_CASPER_LIVENET_NODE_ADDRESS="$rpc_address"
export ODRA_CASPER_LIVENET_EVENTS_URL="$events_url"

: "${ODRA_CASPER_LIVENET_CHAIN_NAME:?missing ODRA_CASPER_LIVENET_CHAIN_NAME}"
: "${ODRA_CASPER_LIVENET_SECRET_KEY_PATH:?missing ODRA_CASPER_LIVENET_SECRET_KEY_PATH}"

echo "==> Derived deployer identity"
identity="$(cargo run -q -p underwrite-contracts --features livenet --bin diagnose_testnet)"
echo "$identity"
public_key="$(printf '%s\n' "$identity" | awk -F= '/^publicKey=/{print $2}')"

echo "==> Checking node status"
curl -fsS \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"info_get_status","params":[]}' \
  "$rpc_address" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const r=JSON.parse(s).result; console.log(`chain=${r.chainspec_name}`); console.log(`height=${r.last_added_block_info.height}`);})'

echo "==> Checking event stream"
curl -fsS -N --max-time 5 "$events_url" |
  head -n 2 || true

echo "==> Checking deployer account exists"
account_payload="$(node -e "console.log(JSON.stringify({jsonrpc:'2.0',id:1,method:'state_get_account_info',params:{public_key:'$public_key'}}))")"
curl -fsS \
  -H 'Content-Type: application/json' \
  -d "$account_payload" \
  "$rpc_address" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const json=JSON.parse(s); if(json.error){ console.error(JSON.stringify(json.error,null,2)); process.exit(1); } console.log(`mainPurse=${json.result.account.main_purse}`);})'

echo "==> Checking deployer balance"
balance_payload="$(node -e "console.log(JSON.stringify({jsonrpc:'2.0',id:1,method:'query_balance',params:{state_identifier:null,purse_identifier:{main_purse_under_public_key:'$public_key'}}}))")"
curl -fsS \
  -H 'Content-Type: application/json' \
  -d "$balance_payload" \
  "$rpc_address" |
  node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const json=JSON.parse(s); if(json.error){ console.error(JSON.stringify(json.error,null,2)); process.exit(1); } console.log(`balanceMotes=${json.result.balance}`); console.log(`balanceCSPR=${Number(json.result.balance)/1_000_000_000}`);})'
