export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const contractHash =
    process.env.NEXT_PUBLIC_UNDERWRITE_CONTRACT_HASH ||
    process.env.UNDERWRITE_CONTRACT_ADDRESS ||
    "";
  const rpcUrl =
    process.env.NEXT_PUBLIC_CASPER_RPC_URL ||
    process.env.ODRA_CASPER_LIVENET_RPC_ADDRESS ||
    process.env.ODRA_CASPER_LIVENET_NODE_ADDRESS ||
    process.env.CASPER_NODE_ADDRESS ||
    "";
  const chainName =
    process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME ||
    process.env.ODRA_CASPER_LIVENET_CHAIN_NAME ||
    process.env.CASPER_CHAIN_NAME ||
    "casper-test";
  const explorerBaseUrl =
    process.env.NEXT_PUBLIC_CASPER_EXPLORER_BASE_URL ||
    process.env.CASPER_EXPLORER_BASE_URL ||
    "https://testnet.cspr.live";

  return Response.json({
    contractHash,
    rpcUrl,
    chainName,
    explorerBaseUrl
  });
}
