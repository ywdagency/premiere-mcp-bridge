// Composition boundary; host IPC and command validation stay in the existing server.
import { createServer } from "./server.mjs";
import protocol from "../build/lib/bridge-protocol.cjs";

export const manifest = Object.freeze({
  contract: "adobe-local-mcp-adapter",
  contractVersion: 1,
  id: "premiere",
  toolPrefix: "premiere_",
  resourceScheme: "premiere",
  serverName: "premiere-mcp-bridge",
  serverVersion: protocol.PLUGIN_VERSION,
});

/** Create independent, unconnected MCP servers without starting a host or transport. */
export function createAdapter({ bridge, readOnly } = {}) {
  return Object.freeze({
    manifest,
    createServer: () => createServer(bridge, { readOnly }),
  });
}
