/**
 * Wildberries MCP server factory.
 *
 * Tools are declared as JSON Schema in tools.ts and converted to Zod shapes at
 * registration (see schema.ts). The Zod shape is required by the MCP SDK
 * (`server.tool()` rejects raw JSON Schema) and gives automatic input
 * validation. Extracted into a factory so it can be unit-tested with an
 * injected WBClient and an in-memory transport.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WBClient } from "./client.js";
import { toolDefinitions, handleTool, type ToolName } from "./tools.js";
import { toolSchemaToZodShape } from "./schema.js";

export const TOOL_COUNT = Object.keys(toolDefinitions).length;

export function createServer(client: WBClient, version: string): McpServer {
  const server = new McpServer({ name: "wildberries-mcp", version });

  for (const [name, def] of Object.entries(toolDefinitions)) {
    const toolName = name as ToolName;
    server.tool(
      toolName,
      def.description,
      toolSchemaToZodShape(def.inputSchema),
      async (args: Record<string, unknown>) => {
        try {
          const result = await handleTool(client, toolName, args);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
