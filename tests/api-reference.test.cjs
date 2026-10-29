const test = require('node:test'),
  assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { API_CONTRACTS, apiPolicy } = require('../build/lib/runtime.cjs');
const catalog = JSON.parse(readFileSync(resolve(__dirname, '../data/adobe-api.json')));
test('generated execution contracts match the complete licensed Adobe catalog and retain all array/tuple signatures', async () => {
  const all = [...catalog.classes.flatMap((c) => c.members), ...catalog.constants];
  assert.equal(catalog.classes.length, 73);
  assert.equal(all.length, 707);
  assert.equal(new Set(all.map((m) => m.id)).size, all.length);
  assert.match(catalog.provenance.commit, /^[a-f0-9]{40}$/);
  assert.equal(catalog.provenance.sdkVersion, '26.5.0');
  assert.match(
    readFileSync(resolve(__dirname, '../data/ADOBE-LICENSE.txt'), 'utf8'),
    /Apache License/,
  );
  const stripped = all.map(({ description, source, ...m }) => m);
  assert.deepEqual(
    [...API_CONTRACTS.classes.flatMap((c) => c.members), ...API_CONTRACTS.constants],
    stripped,
  );
  const byId = new Map(all.map((m) => [m.id, m]));
  assert.equal(byId.get('VideoTrack#getTrackItems').result.items.name, 'VideoClipTrackItem');
  assert.equal(byId.get('Project#getSequences').result.items.name, 'Sequence');
  assert.equal(byId.get('Transcript.transcribeClipProjectItem').since, '26.5');
  assert.equal(byId.get('Marker@guid').since, '26.3');
  assert.equal(apiPolicy(byId.get('Color@red')).mode, 'read');
  assert.ok(all.every((m) => m.parameters.every((p) => p.name && !/Parameters/.test(p.name))));
  const { sdkSignatures, clean } = await import('../scripts/adobe-reference.mjs');
  assert.equal(clean('Promise\\<[*Sequence[]*](sequence.md)\\>'), 'Promise<Sequence[]>');
  assert.equal(sdkSignatures('export type X = {};').X.constructor, undefined);
});
test('offline API search, describe, coverage and MCP resources work through real stdio without Premiere', async (t) => {
  const { Client } = await import('@modelcontextprotocol/client');
  const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
  const client = new Client({ name: 'api-reference-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve(__dirname, '../mcp/server.mjs')],
      env: {
        ...process.env,
        PREMIERE_MCP_BRIDGE_DIR: resolve(__dirname, '../build/nonexistent-reference-test'),
        PREMIERE_MCP_READ_ONLY: '1',
      },
    }),
  );
  const result = await client.callTool({
    name: 'premiere_api_coverage',
    arguments: { hostVersion: '26.5.0' },
  });
  assert.equal(result.structuredContent.members, 707);
  assert.equal(result.structuredContent.types, 73);
  const search = await client.callTool({
    name: 'premiere_api_search',
    arguments: { query: 'keyframe', className: 'ComponentParam' },
  });
  assert.ok(search.structuredContent.members.length > 0);
  const description = await client.callTool({
    name: 'premiere_api_describe',
    arguments: { id: 'SequenceEditor#createRemoveItemsAction' },
  });
  assert.equal(description.structuredContent.execution.tool, 'premiere_api_apply_actions');
  const resources = await client.listResources();
  assert.ok(resources.resources.some((r) => r.uri === 'premiere://api/index'));
  const resource = await client.readResource({
    uri:
      'premiere://api/member/' + encodeURIComponent('VideoClipTrackItem#createSetDisabledAction'),
  });
  assert.equal(JSON.parse(resource.contents[0].text).name, 'createSetDisabledAction');
  const missing = await client.callTool({
    name: 'premiere_api_describe',
    arguments: { id: 'arbitrary.eval' },
  });
  assert.equal(missing.isError, true);
});
