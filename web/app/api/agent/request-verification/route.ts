import { createAgentRequestHandler } from "../../../../lib/agent-request-handler.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createAgentRequestHandler();
