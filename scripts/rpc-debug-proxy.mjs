#!/usr/bin/env node
import http from "node:http";

const listenHost = process.env.RPC_DEBUG_HOST ?? "127.0.0.1";
const listenPort = Number(process.env.RPC_DEBUG_PORT ?? "7777");
const target = process.env.RPC_DEBUG_TARGET ?? "https://node.testnet.casper.network/rpc";

const server = http.createServer(async (req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const body = Buffer.concat(chunks).toString("utf8");
    let method = "unknown";
    let parsedBody = null;
    try {
      parsedBody = JSON.parse(body);
      method = parsedBody.method ?? method;
    } catch {
      // Keep forwarding invalid JSON so the upstream error is visible.
    }

    console.log(`\n--> ${method}`);
    const pricingModes = [];
    collectPricingModes(parsedBody, pricingModes);
    for (const pricingMode of pricingModes) {
      console.log(`pricing_mode=${JSON.stringify(pricingMode)}`);
    }
    try {
      const upstream = await fetch(target, {
        method: req.method ?? "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const text = await upstream.text();
      console.log(`<-- HTTP ${upstream.status}`);
      if (text.includes('"error"')) {
        console.log(text);
      } else {
        console.log(text.slice(0, 600));
      }

      res.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      });
      res.end(text);
    } catch (error) {
      console.error(`<-- proxy error: ${error.message}`);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: error.message },
        }),
      );
    }
  });
});

server.listen(listenPort, listenHost, () => {
  console.log(`RPC debug proxy listening at http://${listenHost}:${listenPort}/rpc`);
  console.log(`Forwarding to ${target}`);
});

function collectPricingModes(value, output) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectPricingModes(item, output);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "pricing_mode") output.push(child);
    collectPricingModes(child, output);
  }
}
