const test = require('node:test');
const assert = require('node:assert/strict');
test('portable client generator uses caller paths and preserves unrelated Codex server entries', async () => {
  const { clientConfig, mergeCodex } = await import('../scripts/setup.mjs');
  const options = { nodePath: '/node with spaces/node', serverPath: '/clone/mcp/server.mjs', directory: '/docs/Premiere MCP Bridge', readOnly: true };
  const fragment = clientConfig('codex', options);
  const existing = '[mcp_servers.other]\ncommand = "keep"\n\n[mcp_servers.premiere_readonly]\ncommand = "old"\n\n[mcp_servers.another]\ncommand = "also-keep"\n';
  const result = mergeCodex(existing, fragment);
  assert.match(result, /command = "keep"/);
  assert.match(result, /command = "also-keep"/);
  assert.doesNotMatch(result, /premiere_readonly|command = "old"/);
  assert.equal((mergeCodex(result, fragment).match(/\[mcp_servers.premiere_bridge\]/g) ?? []).length, 1);
  const json = JSON.parse(clientConfig('claude', options));
  assert.equal(json.mcpServers.premiere.command, options.nodePath);
  assert.equal(json.mcpServers.premiere.env.PREMIERE_MCP_READ_ONLY, '1');
  assert.equal(JSON.parse(clientConfig('vscode', options)).servers.premiere.type, 'stdio');
});
