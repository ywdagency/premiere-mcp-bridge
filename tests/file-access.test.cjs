const test = require('node:test');
const assert = require('node:assert/strict');
const { describeFileAccess, createDispatcher } = require('../build/lib/runtime.cjs');

test('file-access inspection omits paths by default and never enumerates or exposes saved tokens', () => {
  let pathReads = 0;
  const folder = { name: 'Fixture folder', token: 'never-return-token',
    get nativePath() { pathReads++; return '/test/fixture-root'; },
    getEntries() { assert.fail('Diagnostic must not enumerate'); } };
  const summary = describeFileAccess(folder);
  assert.equal(summary.granted, true);
  assert.equal(summary.pathIncluded, false);
  assert.deepEqual(summary.folder, { name: 'Fixture folder' });
  assert.equal(pathReads, 0);
  const detailed = describeFileAccess(folder, true);
  assert.deepEqual(detailed.folder, { name: 'Fixture folder', nativePath: '/test/fixture-root' });
  assert.equal(pathReads, 1);
  assert.equal(JSON.stringify(detailed).includes('never-return-token'), false);
  assert.equal(describeFileAccess(undefined, true).granted, false);
  assert.equal(describeFileAccess(undefined, true).pathIncluded, false);
});

test('MCP and UXP both validate read-only file diagnostics without reading a project or opening a picker', async (t) => {
  const { Client, InMemoryTransport } = await import('@modelcontextprotocol/client');
  const { createAdapter } = await import('../mcp/adapter.mjs');
  let folder, calls = 0;
  const dispatch = createDispatcher({ name: 'premierepro', version: '26.5.0', uxpVersion: 'test',
    getActiveProject() { assert.fail('Diagnostic does not inspect a project'); },
    getFileAccess(includePath) { return describeFileAccess(folder, includePath); } });
  const server = createAdapter({ readOnly: true, bridge: { async call(command, args) {
    calls++; return dispatch({ command, args });
  } } }).createServer();
  const client = new Client({ name: 'file-access-test', version: '1' });
  t.after(async () => { await client.close(); await server.close(); });
  const [a,b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 19);
  assert.equal(tools.find(x => x.name === 'premiere_get_file_access').annotations.readOnlyHint, true);
  const bad = await client.callTool({ name: 'premiere_get_file_access', arguments: { includePath: 'yes' } });
  assert.equal(bad.isError, true); assert.equal(calls, 0);
  await assert.rejects(dispatch({ command: 'get_file_access', args: { includePath: true, path: '/outside' } }));
  await assert.rejects(dispatch({ command: 'get_file_access', args: { includePath: 'yes' } }));
  const missing = await client.callTool({ name: 'premiere_get_file_access', arguments: {} });
  assert.equal(JSON.parse(missing.content[0].text).granted, false);
  folder = { name: 'Restored grant', nativePath: '/test/fixture-root' };
  const ok = await client.callTool({ name: 'premiere_get_file_access', arguments: { includePath: true } });
  const data = JSON.parse(ok.content[0].text);
  assert.equal(data.readOnly, true); assert.equal(data.folder.nativePath, folder.nativePath);
  folder = undefined;
  assert.equal((await dispatch({ command: 'get_file_access', args: {} })).granted, false);
});
