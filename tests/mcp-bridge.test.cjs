const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const { UxpBridge } = require("../build/lib/runtime.cjs");
const { folderAdapter, hostFixture } = require("./helpers/bridge-fixture.cjs");

async function setup(t, connect = true) {
  const { FileBridge, prepareBridge } = await import("../mcp/file-bridge.mjs");
  const directory = await fs.mkdtemp(join(tmpdir(), "premiere-mcp-test-"));
  const prepared = await prepareBridge(directory);
  const reports = [];
  const uxp = new UxpBridge(hostFixture(), (...args) => reports.push(args));
  if (connect) await uxp.start(folderAdapter(directory));
  t.after(async () => { uxp.stop(); await fs.rm(directory, { recursive: true, force: true }); });
  return { ...prepared, FileBridge, uxp, reports, bridge: new FileBridge(directory, { timeoutMs: 10000, pollMs: 5 }) };
}

test("real filesystem transport round-trips concurrent reads through the actual UXP dispatcher", async (t) => {
  const { bridge, directory, reports } = await setup(t);
  const [project, sequence] = await Promise.all([bridge.call("get_project"), bridge.call("get_active_sequence")]);
  assert.equal(project.project.name, "Transport fixture");
  assert.equal("path" in project.project, false);
  assert.equal(sequence.activeSequence.audioTrackCount, 2);
  assert.equal(project.readOnly, true);
  assert.equal(reports.some(([, failed]) => failed), false);
  assert.deepEqual(await fs.readdir(directory), ["bridge.json"]);
});

test("missing/disconnected plugin times out explicitly and removes pending requests", async (t) => {
  const { FileBridge, directory, uxp } = await setup(t, false);
  const bridge = new FileBridge(directory, { timeoutMs: 60, pollMs: 5 });
  await assert.rejects(bridge.call("get_project"), { code: "BRIDGE_TIMEOUT" });
  await uxp.start(folderAdapter(directory));
  uxp.stop();
  await assert.rejects(bridge.call("get_active_sequence"), { code: "BRIDGE_TIMEOUT" });
  assert.deepEqual(await fs.readdir(directory), ["bridge.json"]);
});

test("picker folder entries connect even when direct blob-path lookup fails", async (t) => {
  const { directory, uxp, bridge } = await setup(t, false);
  const folder = folderAdapter(directory);
  folder.getEntry = async () => { throw new Error("Could not find an entry of 'blob:/blob-1/bridge.json'"); };
  await uxp.start(folder);
  assert.equal((await bridge.call("get_project")).project.name, "Transport fixture");
});

test("selecting a parent or empty folder explains the missing marker before touching Premiere", async (t) => {
  const { directory } = await setup(t, false);
  const host = hostFixture();
  host.getActiveProject = async () => { assert.fail("Wrong folder must not access Premiere"); };
  const uxp = new UxpBridge(host, () => {});
  const empty = join(directory, "wrong-folder");
  await fs.mkdir(empty);
  await assert.rejects(uxp.start(folderAdapter(empty)), (error) =>
    error.code === "INVALID_BRIDGE" && error.message.includes("no bridge.json") && error.message.includes("not its parent"));
});

test("plugin rejects unregistered/expired/mismatched files without reading the host", async (t) => {
  const { directory, marker, uxp } = await setup(t, false);
  uxp.stop();
  const host = hostFixture();
  host.getActiveProject = () => { assert.fail("Rejected requests must not access Premiere"); };
  const guarded = new UxpBridge(host, () => {});
  await guarded.start(folderAdapter(directory));
  t.after(() => guarded.stop());
  for (const patch of [{ command: "save_project" }, { expiresAt: Date.now() - 1 }, { id: randomUUID() }, { script: "app.save()" }]) {
    const id = randomUUID();
    const request = { version: 1, bridgeId: marker.bridgeId, id, command: "get_project", args: {}, expiresAt: Date.now() + 1000, ...patch };
    await fs.writeFile(join(directory, `request-${id}.json`), JSON.stringify(request));
    await guarded.pollOnce();
    const response = JSON.parse(await fs.readFile(join(directory, `response-${id}.json`), "utf8"));
    assert.equal(response.ok, false);
    await fs.unlink(join(directory, `response-${id}.json`));
  }
});

test("stop during a pending host read prevents publishing its result", async (t) => {
  const { directory, marker } = await setup(t, false);
  let release;
  let entered;
  const started = new Promise((r) => { entered = r; });
  const host = hostFixture();
  host.getActiveProject = async () => { entered(); await new Promise((r) => { release = r; }); return null; };
  const uxp = new UxpBridge(host, () => {});
  await uxp.start(folderAdapter(directory));
  const id = randomUUID();
  await fs.writeFile(join(directory, `request-${id}.json`), JSON.stringify({ version: 1, bridgeId: marker.bridgeId,
    id, command: "get_project", args: {}, expiresAt: Date.now() + 1000 }));
  const pump = uxp.pollOnce();
  await started;
  uxp.stop();
  host.getActiveProject = async () => null;
  release();
  await pump;
  assert.equal((await fs.readdir(directory)).some((name) => name.startsWith("response-")), false);
});

test("server refuses shared/symlink bridge folders and wrong protocol markers", async (t) => {
  const { directory } = await setup(t, false);
  const { prepareBridge } = await import("../mcp/file-bridge.mjs");
  const shared = join(directory, "shared");
  await fs.mkdir(shared, { mode: 0o755 });
  await assert.rejects(prepareBridge(shared), { code: "UNSAFE_BRIDGE_PATH" });
  const linked = join(directory, "linked");
  await fs.symlink(directory, linked);
  await assert.rejects(prepareBridge(linked), { code: "UNSAFE_BRIDGE_PATH" });
  await fs.writeFile(join(directory, "bridge.json"), JSON.stringify({ version: 1, name: "other-app", bridgeId: randomUUID() }));
  await assert.rejects(prepareBridge(directory), { code: "INVALID_BRIDGE" });
});

test("server rejects forged response identity and cancellation cleans up IPC", async (t) => {
  const { bridge, directory, marker } = await setup(t, false);
  const running = bridge.call("get_project");
  let name;
  for (let attempt = 0; attempt < 100 && !name; attempt++) {
    name = (await fs.readdir(directory)).find((n) => /^request-.*\.json$/.test(n));
    if (!name) await delay(5);
  }
  assert.ok(name);
  const request = JSON.parse(await fs.readFile(join(directory, name), "utf8"));
  await fs.writeFile(join(directory, `response-${request.id}.json`), JSON.stringify({ version: 1, bridgeId: marker.bridgeId,
    id: randomUUID(), ok: true, result: {} }));
  await assert.rejects(running, { code: "INVALID_RESPONSE" });
  const controller = new AbortController();
  const cancelled = bridge.call("get_project", {}, controller.signal);
  await delay(20);
  controller.abort();
  await assert.rejects(cancelled, { code: "REQUEST_CANCELLED" });
  assert.deepEqual(await fs.readdir(directory), ["bridge.json"]);
});

test("stdio MCP handshake, discovery and tool contracts work end to end; annotations distinguish writes", async (t) => {
  const { directory } = await setup(t);
  const { Client } = await import("@modelcontextprotocol/client");
  const { StdioClientTransport } = await import("@modelcontextprotocol/client/stdio");
  const client = new Client({ name: "premiere-mcp-test", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [resolve(__dirname, "../mcp/server.mjs")],
    env: { ...process.env, PREMIERE_MCP_BRIDGE_DIR: directory, PREMIERE_MCP_TIMEOUT_MS: "10000" }
  });
  t.after(() => client.close());
  await client.connect(transport);
  const { tools } = await client.listTools();
  const { COMMAND_LIST } = require("../build/lib/command-catalog.cjs");
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...COMMAND_LIST.map((spec) => `premiere_${spec.command}`),'premiere_api_search','premiere_api_describe','premiere_api_coverage'].sort());
  assert.ok(tools.filter((tool) => tool.name.startsWith("premiere_get_")).every((tool) => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint));
  assert.equal(tools.find((tool) => tool.name === "premiere_trim_clip").annotations.readOnlyHint, false);
  const result = await client.callTool({ name: "premiere_get_project", arguments: {} });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.equal(result.structuredContent.project.name, "Transport fixture");
  const seq = await client.callTool({ name: "premiere_get_active_sequence", arguments: {} });
  assert.ok(!seq.isError, JSON.stringify(seq));
  assert.equal(seq.structuredContent.activeSequence.videoTrackCount, 1);
  const withPath = await client.callTool({ name: "premiere_get_project", arguments: { includePath: true } });
  assert.equal(withPath.structuredContent.project.path, "/test/private.prproj");
  const clips = await client.callTool({ name: "premiere_get_sequence_clips", arguments: { limit: 1 } });
  assert.ok(!clips.isError, JSON.stringify(clips));
  assert.equal(clips.structuredContent.clips[0].name, "Shot A");
  assert.equal(clips.structuredContent.clips[0].timelineStart.timecode, "00:00:00:00");
  assert.equal(clips.structuredContent.page.nextOffset, 1);
  const next = await client.callTool({ name: "premiere_get_sequence_clips", arguments: {
    offset: 1, limit: 1, sequenceId: clips.structuredContent.activeSequence.id
  } });
  assert.equal(next.structuredContent.clips[0].name, "Shot B");
  const badClipArgs = await client.callTool({ name: "premiere_get_sequence_clips", arguments: { trackIndex: 0 } });
  assert.equal(badClipArgs.isError, true);
  const rejected = await client.callTool({ name: "premiere_get_project", arguments: { script: "save()" } });
  assert.equal(rejected.isError, true);
  await assert.rejects(client.callTool({ name: "save_project", arguments: {} }));
});

async function bundledPanel(t, options = {}) {
  const { directory, bridge, FileBridge } = await setup(t, false);
  const vm = require("node:vm");
  const host = hostFixture();
  const project = await host.getActiveProject();
  project.getRootItem = async () => ({ getItems: async () => [] });
  const html = await fs.readFile(resolve(__dirname, '../index.html'), 'utf8');
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
    textContent: '', style: {}, attributes: {}, listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
  }]));
  const document = { getElementById: (id) => elements.get(id) ?? null };
  const saved = options.saved ?? new Map(options.savedMedia ? [['premiere-mcp-media-folder', 'saved-media']] : []);
  const localStorage = { getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) };
  let entrypoints;
  let pickerCalls = 0;
  const dataDirectory = join(directory, 'PluginData');
  await fs.mkdir(dataDirectory);
  const dataFolder = folderAdapter(dataDirectory);
  const mediaFolder = { ...folderAdapter(directory), name: 'Private fixture folder', nativePath: directory, isFolder: true };
  const storage = { getDataFolder: async () => dataFolder,
    getFolder: async () => { pickerCalls++; return mediaFolder; },
    createPersistentToken: async () => 'saved-media',
    getEntryForPersistentToken: async () => mediaFolder,
    ...options.storage };
  const readEntries = dataFolder.getEntries;
  dataFolder.getEntries = async () => [...await readEntries(), { ...folderAdapter(directory), name: 'mcp-bridge', isFolder: true, isFile: false }];
  vm.runInNewContext(options.bundle ?? await fs.readFile(resolve(__dirname, "../dist/main.js"), "utf8"), {
    document, localStorage, console, setTimeout, clearTimeout,
    require(name) {
      if (name === "premierepro") return { Project: { getActiveProject: host.getActiveProject },
        Constants: { TrackItemType: { CLIP: 1 }, VideoDisplayFormatType: host.clipConstants.displayFormats } };
      if (name === "uxp") return { host, versions: { uxp: host.uxpVersion },
        entrypoints: { setup(value) {
          // Observed in Premiere 26.5: setup throws before registering commands
          // if plugin.destroy is supplied without plugin.create.
          assert.equal(typeof value.plugin.create, "function", "Premiere requires plugin.create");
          entrypoints = value;
          entrypoints.plugin.create();
        } },
        storage: { localFileSystem: storage }
      };
      assert.fail(`Unexpected runtime module ${name}`);
    }
  });
  t.after(() => entrypoints.plugin.destroy());
  entrypoints.panels.premiereAutoEditorPanel.create();
  return { bridge, FileBridge, directory, elements, entrypoints, storage, saved, mediaFolder,
    pickerCalls: () => pickerCalls };
}

test('bundled plugin reports absent and restored file access without adding controls or opening a picker', async (t) => {
  const fresh = await bundledPanel(t);
  const none = await fresh.bridge.call('get_file_access', { includePath: true });
  assert.equal(none.granted, false);
  assert.equal(none.pathIncluded, false);
  assert.equal(fresh.pickerCalls(), 0);
  assert.equal(fresh.saved.size, 0);
  const restored = await bundledPanel(t, { savedMedia: true });
  const summary = await restored.bridge.call('get_file_access');
  assert.equal(summary.granted, true);
  assert.equal('nativePath' in summary.folder, false);
  const detail = await restored.bridge.call('get_file_access', { includePath: true });
  assert.equal(detail.folder.nativePath, restored.directory);
  assert.equal(restored.pickerCalls(), 0);
  assert.equal(restored.saved.size, 1);
});

test('Stop blocks transport while preserving the folder approval and Launch reuses it without a picker', async (t) => {
  const { bridge, FileBridge, directory, elements, entrypoints, saved, pickerCalls } = await bundledPanel(t);
  assert.equal((await bridge.call('get_capabilities')).writesEnabled, true);
  assert.equal(pickerCalls(), 0, 'Launching must not ask for file access');
  assert.deepEqual([...elements.keys()], ['connection-control', 'toggle-connection', 'connection-label', 'reload-control', 'reload-bridge', 'bridge-status', 'status', 'error', 'plugin-version']);
  assert.equal(elements.get('toggle-connection').textContent, 'Stop');
  assert.equal(elements.get('status').textContent, 'Running');
  assert.equal(elements.get('plugin-version').textContent, 'v' + JSON.parse(await fs.readFile(resolve(__dirname, '../manifest.json'), 'utf8')).version);
  assert.equal(elements.get('error').style.display, 'none');
  await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal((await bridge.call('get_capabilities')).mediaFolderGranted, true);
  assert.equal(saved.size, 1);
  elements.get('toggle-connection').listeners.click();
  assert.equal(elements.get('toggle-connection').textContent, 'Launch');
  assert.equal(elements.get('status').textContent, 'Stopped');
  await assert.rejects(new FileBridge(directory, { timeoutMs: 60, pollMs: 5 }).call('get_project'), { code: 'BRIDGE_TIMEOUT' });
  assert.equal(saved.size, 1);
  elements.get('toggle-connection').listeners.click();
  const capabilities = await bridge.call('get_capabilities');
  assert.equal(capabilities.writesEnabled, true);
  assert.equal(capabilities.mediaFolderGranted, true);
  assert.equal(pickerCalls(), 1, 'Stop/Launch must not ask for an already approved folder');
});

test('a new plugin runtime and version restore the same saved approval without opening a picker', async (t) => {
  // Optional immutable previous-release bundle for the separate local upgrade check.
  const previous = process.env.PREMIERE_TEST_PREVIOUS_BUNDLE;
  const first = await bundledPanel(t, { bundle: previous ? await fs.readFile(previous, 'utf8') : undefined });
  const originalVersion = (await first.bridge.call('get_capabilities')).bridgeVersion;
  await fs.writeFile(join(first.directory, 'upgrade.txt'), 'Retained folder content');
  const entries = first.mediaFolder.getEntries;
  first.mediaFolder.getEntries = async () => (await entries()).map(entry => ({ ...entry,
    nativePath: join(first.directory, entry.name),
    getMetadata: async () => ({ size: (await fs.stat(join(first.directory, entry.name))).size }),
  }));
  await assert.rejects(first.bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal(first.saved.get('premiere-mcp-media-folder'), 'saved-media');
  first.entrypoints.plugin.destroy();
  const retained = { saved: first.saved, storage: { getEntryForPersistentToken: async () => first.mediaFolder } };
  const restarted = await bundledPanel(t, retained);
  assert.equal((await restarted.bridge.call('get_file_access')).granted, true);
  assert.equal((await restarted.bridge.call('get_file_access', { includePath: true })).folder.nativePath, first.directory);
  if (previous) assert.notEqual((await restarted.bridge.call('get_capabilities')).bridgeVersion, originalVersion);
  assert.equal(restarted.pickerCalls(), 0);
  restarted.entrypoints.plugin.destroy();
  const upgraded = await bundledPanel(t, retained);
  assert.equal((await upgraded.bridge.call('get_capabilities')).mediaFolderGranted, true);
  assert.equal((await upgraded.bridge.call('api_load_text', { path: 'upgrade.txt' })).characters,
    'Retained folder content'.length, 'Restored approval must still pass Entry and Node file checks');
  assert.equal(upgraded.pickerCalls(), 0);
  assert.equal(upgraded.saved.size, 1);
});

test('Stop or explicit forgetting during persistent-token creation cannot commit a late picker result', async (t) => {
  for (const action of ['stop', 'forget']) {
    await t.test(action, async t => {
      const p = await bundledPanel(t);
      await p.bridge.call('get_capabilities');
      let finish, entered;
      const started = new Promise(r => { entered = r; });
      p.storage.createPersistentToken = () => { entered(); return new Promise(r => { finish = r; }); };
      await assert.rejects(p.bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
      await started;
      if (action === 'stop') p.entrypoints.commands.disconnectReadOnlyMcp();
      else await p.bridge.call('forget_file_access', { projectId: 'project-fixture', operationId: randomUUID(), confirm: true });
      finish('late-token'); await delay(0);
      await p.entrypoints.commands.connectReadOnlyMcp();
      assert.equal((await p.bridge.call('get_file_access')).granted, false);
      assert.equal(p.saved.size, 0);
    });
  }
});

test('an unavailable remembered token asks again only for an explicit file request', async (t) => {
  const p = await bundledPanel(t, { savedMedia: true, storage: {
    getEntryForPersistentToken: async () => { throw new Error('Invalid token'); },
  } });
  assert.equal((await p.bridge.call('get_file_access')).granted, false);
  assert.equal(p.pickerCalls(), 0);
  await assert.rejects(p.bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal(p.pickerCalls(), 1);
  assert.equal((await p.bridge.call('get_file_access')).granted, true);
});

test('forget_file_access requires explicit confirmation/current project and journals revocation separately from Stop', async (t) => {
  const p = await bundledPanel(t, { savedMedia: true });
  const args = { projectId: 'project-fixture', operationId: randomUUID(), confirm: true };
  assert.equal((await p.bridge.call('get_file_access')).granted, true);
  await assert.rejects(p.bridge.call('forget_file_access', { ...args, confirm: false }), { code: 'EXPLICIT_AUTHORIZATION_REQUIRED' });
  await assert.rejects(p.bridge.call('forget_file_access', { ...args, operationId: randomUUID(), projectId: 'stale' }), { code: 'ACTIVE_CONTEXT_CHANGED' });
  assert.equal(p.saved.size, 1);
  const revoke = { ...args, operationId: randomUUID() };
  assert.equal((await p.bridge.call('forget_file_access', revoke)).fileAccessForgotten, true);
  assert.equal((await p.bridge.call('get_file_access')).granted, false);
  assert.equal(p.saved.size, 0);
  assert.equal(p.pickerCalls(), 0, 'Explicit forgetting must not itself prompt');
  await assert.rejects(p.bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal((await p.bridge.call('get_file_access')).granted, true);
  assert.equal((await p.bridge.call('forget_file_access', revoke)).operationReplayed, true);
  assert.equal((await p.bridge.call('get_file_access')).granted, true, 'Recovery of an old revoke cannot delete a later approval');
});

test('restoration failure keeps the token and prompts only on an actual file request', async (t) => {
  const p = await bundledPanel(t, { savedMedia: true, storage: {
    getEntryForPersistentToken: async () => { throw new Error('Volume temporarily unavailable'); },
  } });
  assert.equal((await p.bridge.call('get_file_access')).granted, false);
  assert.equal(p.saved.size, 1, 'A transient error must not erase remembered consent');
  assert.equal(p.pickerCalls(), 0);
  p.storage.getEntryForPersistentToken = async () => p.mediaFolder;
  await p.entrypoints.commands.reloadBridge();
  assert.equal((await p.bridge.call('get_file_access')).granted, true);
  assert.equal(p.pickerCalls(), 0);
});

test('Stop during token restoration cannot revive transport; the next Launch can restore again', async (t) => {
  let resolve;
  const p = await bundledPanel(t, { savedMedia: true, storage: {
    getEntryForPersistentToken: () => new Promise(r => { resolve = r; }),
  } });
  p.entrypoints.commands.disconnectReadOnlyMcp();
  resolve(p.mediaFolder);
  await delay(0);
  assert.equal(p.elements.get('status').textContent, 'Stopped');
  assert.equal(p.saved.size, 1);
  p.storage.getEntryForPersistentToken = async () => p.mediaFolder;
  await p.entrypoints.commands.connectReadOnlyMcp();
  assert.equal((await p.bridge.call('get_file_access')).granted, true);
  assert.equal(p.pickerCalls(), 0);
});

test('first file request asks once and rejects before access; the next granted request reads through the broker', async (t) => {
  const { bridge, directory, pickerCalls, mediaFolder } = await bundledPanel(t);
  await fs.writeFile(join(directory, 'grant.txt'), 'Granted fixture text');
  const list = mediaFolder.getEntries;
  mediaFolder.getEntries = async () => Promise.all((await list()).map(async entry => ({ ...entry,
    nativePath: join(directory, entry.name),
    getMetadata: async () => ({ size: (await fs.stat(join(directory, entry.name))).size }),
  })));
  await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal(pickerCalls(), 1);
  const result = await bridge.call('api_load_text', { path: 'grant.txt' });
  assert.equal(result.characters, 'Granted fixture text'.length);
  assert.equal(pickerCalls(), 1, 'Granted calls do not keep asking');
});

test('invalid paths do not open a picker; picker cancellation/failure leaves transport and default editing available', async (t) => {
  const { bridge, elements, storage, pickerCalls } = await bundledPanel(t);
  await bridge.call('get_capabilities');
  for (const path of ['../private.txt', '/private.txt', 'folder/../private.txt'])
    await assert.rejects(bridge.call('api_load_text', { path }), { code: 'INVALID_API_ARGUMENT' });
  assert.equal(pickerCalls(), 0);
  storage.getFolder = async () => null;
  await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal(elements.get('error').textContent, 'File access was not granted.');
  storage.getFolder = async () => { throw new Error('Private native details'); };
  await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal(elements.get('error').textContent, 'File access failed. Retry the file request.');
  const c = await bridge.call('get_capabilities');
  assert.equal(c.mediaFolderGranted, false);
  assert.equal(c.writesEnabled, true);
});

test('a file permission preflight failure is a completed receipt and is never retried under the same write ID', async (t) => {
  const { bridge, directory, pickerCalls } = await bundledPanel(t);
  await bridge.call('get_capabilities');
  await assert.rejects(bridge.call('import_media', {
    projectId: 'stale-project', operationId: randomUUID(), paths: ['clip.mov'],
  }), { code: 'ACTIVE_CONTEXT_CHANGED' });
  assert.equal(pickerCalls(), 0, 'A stale project must not open a permission dialog');
  const args = { projectId: 'project-fixture', operationId: randomUUID(), paths: ['clip.mov'] };
  await assert.rejects(bridge.call('import_media', args), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal((await bridge.call('get_capabilities')).mediaFolderGranted, true);
  await assert.rejects(bridge.call('import_media', args), { code: 'MEDIA_FOLDER_REQUIRED' });
  const receipt = JSON.parse(await fs.readFile(join(directory, `operation-${args.operationId}.json`), 'utf8'));
  assert.equal(receipt.state, 'completed');
  assert.equal(receipt.outcome.error.code, 'MEDIA_FOLDER_REQUIRED');
  await assert.rejects(bridge.call('import_media', { ...args, operationId: randomUUID() }), { code: 'FILE_NOT_FOUND' });
});

test('Stop invalidates a pending picker and never restores its file access or saved token', async (t) => {
  const { bridge, entrypoints, storage, saved, mediaFolder } = await bundledPanel(t);
  await bridge.call('get_capabilities');
  let finish;
  storage.getFolder = () => new Promise(resolve => { finish = resolve; });
  await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  entrypoints.commands.disconnectReadOnlyMcp();
  finish(mediaFolder);
  await delay(0);
  await entrypoints.commands.connectReadOnlyMcp();
  assert.equal((await bridge.call('get_capabilities')).mediaFolderGranted, false);
  assert.equal(saved.size, 0);
});

test('a slow picker never holds the file request beyond its deadline or opens repeated dialogs', async (t) => {
  const { bridge, entrypoints, storage } = await bundledPanel(t);
  await bridge.call('get_capabilities');
  let finish;
  let calls = 0;
  storage.getFolder = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  for (let i = 0; i < 2; i++)
    await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal(calls, 1);
  entrypoints.commands.disconnectReadOnlyMcp();
  finish(null);
  await delay(0);
});

test('Reload restores transport after storage failure and enables editing only when connected', async (t) => {
  const { bridge, elements, entrypoints, storage } = await bundledPanel(t);
  await bridge.call('get_capabilities');
  const getDataFolder = storage.getDataFolder;
  let finish;
  storage.getDataFolder = () => new Promise(resolve => { finish = resolve; });
  const reloading = entrypoints.commands.reloadBridge();
  await delay(0);
  assert.equal(elements.get('status').textContent, 'Reloading…');
  assert.equal(elements.get('reload-bridge').disabled, true);
  const data = await getDataFolder();
  finish({ ...data, getEntries: async () => [] });
  await reloading;
  assert.equal(elements.get('status').textContent, 'Waiting for agent');
  assert.equal(elements.get('reload-bridge').disabled, false);
  storage.getDataFolder = async () => { throw new Error('Private storage diagnostics'); };
  await entrypoints.commands.reloadBridge();
  assert.equal(elements.get('error').textContent, 'Connection unavailable. Press Reload.');
  assert.equal(elements.get('status').style.display, 'none');
  assert.equal(elements.get('bridge-status').attributes['data-state'], 'error');
  storage.getDataFolder = getDataFolder;
  await entrypoints.commands.reloadBridge();
  assert.equal(elements.get('error').style.display, 'none');
  assert.equal(elements.get('status').style.display, 'block');
  assert.equal(elements.get('status').textContent, 'Running');
  assert.equal((await bridge.call('get_capabilities')).writesEnabled, true);
  entrypoints.commands.disconnectReadOnlyMcp();
  await entrypoints.commands.reloadBridge();
  assert.equal((await bridge.call('get_capabilities')).writesEnabled, true);
});

test('Reload preserves typed handles and file access when the external MCP server is restarted', async (t) => {
  const { bridge, directory, entrypoints } = await bundledPanel(t);
  await bridge.call('get_capabilities');
  await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  const { Client } = await import('@modelcontextprotocol/client');
  const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
  async function startClient() {
    const client = new Client({ name: 'panel-recovery', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: [resolve(__dirname, '../mcp/server.mjs')],
      env: { ...process.env, PREMIERE_MCP_BRIDGE_DIR: directory, PREMIERE_MCP_TIMEOUT_MS: '10000' } }));
    t.after(() => client.close());
    return client;
  }
  const first = await startClient();
  const context = (await first.callTool({ name: 'premiere_api_context', arguments: {} })).structuredContent;
  await first.close();
  await entrypoints.commands.reloadBridge();
  const restarted = await startClient();
  const caps = await restarted.callTool({ name: 'premiere_get_capabilities', arguments: {} });
  assert.equal(caps.structuredContent.mediaFolderGranted, true);
  assert.equal(caps.structuredContent.writesEnabled, true);
  const result = await restarted.callTool({ name: 'premiere_api_read', arguments: {
    memberId: 'Project@name', target: context.project.$ref, parameters: {} } });
  assert.equal(!!result.isError, false, 'A pre-reload native handle remains valid');
});

test('a late storage failure cannot show an error after Stop', async (t) => {
  const { bridge, elements, entrypoints, storage } = await bundledPanel(t);
  await bridge.call('get_capabilities');
  let fail;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  storage.getDataFolder = () => new Promise((resolve, reject) => { fail = reject; entered(); });
  const connecting = entrypoints.commands.reloadBridge();
  await started;
  entrypoints.commands.disconnectReadOnlyMcp();
  fail(new Error('Private storage diagnostics'));
  await connecting;
  assert.equal(elements.get('toggle-connection').textContent, 'Launch');
  assert.equal(elements.get('error').style.display, 'none');
});

test('expired remembered access stays quiet until a file request requires a fresh grant', async (t) => {
  const { bridge, elements, pickerCalls, saved } = await bundledPanel(t, { savedMedia: true,
    storage: { getEntryForPersistentToken: async () => { throw new Error('Expired grant'); } } });
  const c = await bridge.call('get_capabilities');
  assert.equal(c.writesEnabled, true);
  assert.equal(c.mediaFolderGranted, false);
  assert.equal(elements.get('error').style.display, 'none');
  assert.equal(saved.size, 1);
  assert.equal(pickerCalls(), 0);
  await assert.rejects(bridge.call('api_load_text', { path: 'grant.txt' }), { code: 'MEDIA_FOLDER_REQUIRED' });
  assert.equal(pickerCalls(), 1);
});

test('read-only client configuration hides every mutation tool at MCP discovery', async (t) => {
  const { directory } = await setup(t);
  const { Client } = await import('@modelcontextprotocol/client');
  const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
  const client = new Client({ name: 'readonly-contract-test', version: '0.2.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(__dirname, '../mcp/server.mjs')],
    env: { ...process.env, PREMIERE_MCP_BRIDGE_DIR: directory, PREMIERE_MCP_READ_ONLY: '1' } }));
  const { tools } = await client.listTools();
  assert.equal(tools.length, require('../build/lib/command-catalog.cjs').COMMAND_LIST.filter(t=>t.readOnly).length+3);
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint));
  await assert.rejects(client.callTool({ name: 'premiere_create_sequence', arguments: {} }));
});
