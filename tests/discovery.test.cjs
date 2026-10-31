const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
test('automatic discovery uses only this plugin, rejects stale hosts and refuses ambiguous hosts', async (t) => {
  const { discoverBridgeDirectory, PLUGIN_ID } = await import('../mcp/discovery.mjs');
  const root = await fs.mkdtemp(join(tmpdir(), 'premiere-discovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const now = Date.now();
  const data = join(root, '26', 'Developer', PLUGIN_ID, 'PluginData');
  await fs.mkdir(data, { recursive: true });
  const heartbeat = { pluginId: PLUGIN_ID, protocolVersion: 1, heartbeatAt: now };
  await fs.writeFile(join(data, 'mcp-host.json'), JSON.stringify({ ...heartbeat, heartbeatAt: now - 11000 }));
  await assert.rejects(discoverBridgeDirectory({ root, now }), { code: 'PLUGIN_NOT_LOADED' });
  await fs.writeFile(join(data, 'mcp-host.json'), JSON.stringify(heartbeat));
  assert.equal(await discoverBridgeDirectory({ root, now }), join(data, 'mcp-bridge'));
  const other = join(root, '25', 'External', PLUGIN_ID, 'PluginData');
  await fs.mkdir(other, { recursive: true });
  await fs.writeFile(join(other, 'mcp-host.json'), JSON.stringify(heartbeat));
  await assert.rejects(discoverBridgeDirectory({ root, now }), { code: 'MULTIPLE_PREMIERE_HOSTS' });
  assert.equal(await discoverBridgeDirectory({ root, now, hostVersion: '26' }), join(data, 'mcp-bridge'));
  await fs.writeFile(join(other, 'mcp-host.json'), JSON.stringify({ ...heartbeat, pluginId: 'another-plugin' }));
  assert.equal(await discoverBridgeDirectory({ root, now }), join(data, 'mcp-bridge'));
});

test('private UXP storage can sit below writable directories protected by an owner-only ancestor',
  {skip:process.platform === 'win32' ? 'Unix permission modes; NTFS ACLs require separate native verification' : false}, async (t) => {
  const { prepareBridge } = await import('../mcp/file-bridge.mjs');
  const root = await fs.mkdtemp(join(tmpdir(), 'premiere-private-parent-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const adobe = join(root, 'AdobeStorage');
  await fs.mkdir(adobe, { mode: 0o775 }); await fs.chmod(adobe, 0o775);
  assert.equal((await prepareBridge(join(adobe, 'bridge'))).directory, join(adobe, 'bridge'));
  const exposed = await fs.mkdtemp(join(await fs.realpath('/tmp'), 'premiere-exposed-parent-'));
  t.after(() => fs.rm(exposed, { recursive: true, force: true }));
  await fs.chmod(exposed, 0o777);
  await assert.rejects(prepareBridge(join(exposed, 'bridge')), { code: 'UNSAFE_BRIDGE_PATH' });
});
