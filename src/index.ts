#!/usr/bin/env node
/**
 * Wildberries Seller API MCP Server.
 * Production-grade per-category rate limiting with 409 penalty protection.
 *
 * Usage:
 *   WB_API_TOKEN=... wildberries-mcp          # stdio transport
 *   WB_API_TOKEN=... wildberries-mcp --http    # Streamable HTTP transport (port 3000)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WBClient } from "./client.js";
import { toolDefinitions } from "./tools.js";
import { createServer, TOOL_COUNT } from "./server.js";

export const VERSION = "1.0.0";

const WB_API_TOKEN = process.env.WB_API_TOKEN;

if (!WB_API_TOKEN) {
  process.stderr.write(
    "ERROR: WB_API_TOKEN environment variable is required.\n" +
      "Get your API token at https://seller.wildberries.ru/supplier-settings/access-to-api\n",
  );
  process.exit(1);
}

const client = new WBClient({ token: WB_API_TOKEN });

// Transport selection
const cliArgs = process.argv.slice(2);
const useHttp = cliArgs.includes("--http");

if (useHttp) {
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const http = await import("node:http");

  const PORT = parseInt(process.env.PORT ?? "3000", 10);
  if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
    process.stderr.write(`ERROR: invalid PORT "${process.env.PORT}"\n`);
    process.exit(1);
  }

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/mcp" && req.method === "POST") {
      // Fresh stateless server+transport per request.
      const server = createServer(client, VERSION);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } else if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          version: VERSION,
          tools: Object.keys(toolDefinitions).length,
        }),
      );
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  httpServer.listen(PORT, () => {
    process.stderr.write(
      `[wildberries-mcp] Streamable HTTP server on http://localhost:${PORT}/mcp (${TOOL_COUNT} tools)\n`,
    );
  });
} else {
  const server = createServer(client, VERSION);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[wildberries-mcp] Connected via stdio (${TOOL_COUNT} tools)\n`);
}
