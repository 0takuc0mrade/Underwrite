import { NextResponse } from "next/server";
// @ts-ignore
import { DeployUtil, CasperServiceByJsonRPC } from "casper-js-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { deployJson: unknown };
  try {
    body = (await request.json()) as { deployJson: unknown };
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON body." }, { status: 400 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_CASPER_RPC_URL;
  if (!rpcUrl) {
    return NextResponse.json({ status: "error", message: "Server is missing Casper RPC URL configuration." }, { status: 500 });
  }

  try {
    const rpcPayload = {
      jsonrpc: "2.0",
      id: new Date().getTime(),
      method: "account_put_deploy",
      params: body.deployJson
    };

    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcPayload)
    });
    
    const rpcData = await rpcRes.json();
    if (rpcData.error) {
      const detailedMessage = rpcData.error.data ? `${rpcData.error.message}: ${rpcData.error.data}` : rpcData.error.message;
      throw new Error(detailedMessage || "RPC Node rejected the deploy.");
    }
    
    return NextResponse.json({
      status: "success",
      deployHash: rpcData.result.deploy_hash,
      message: "Deploy successfully submitted."
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to submit deploy.";
    return NextResponse.json(
      { 
        status: "error", 
        message: errorMsg === "fetch failed" 
          ? "Casper Testnet node connection failed. The network might be congested or dropping connections. Please try again." 
          : errorMsg 
      },
      { status: 500 }
    );
  }
}
