const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { apiFixture } = require('./helpers/api-fixture.cjs');
const { folderAdapter } = require('./helpers/bridge-fixture.cjs');
const { UxpBridge, BridgeError, parseResponse, createDispatcher } = require('../build/lib/runtime.cjs');

async function setup(t) {
  const { FileBridge, prepareBridge } = await import('../mcp/file-bridge.mjs');
  const directory = await fs.mkdtemp(join(tmpdir(), 'premiere-import-diagnostics-'));
  const { marker } = await prepareBridge(directory);
  const f = apiFixture();
  const args = { projectId: f.project.guid, operationId: randomUUID(),
    paths: Array.from({ length: 10 }, (_, i) => `asset-${i}.png`) };
  const counts = { native: 0, paths: 0, resolve: 0, snapshot: 0 };
  const getItems = f.root.getItems;
  f.root.getItems = async () => { counts.snapshot++; return getItems(); };
  f.apiHost.path = async (path) => { counts.paths++; return `/granted/${path}`; };
  f.host.resolveMedia = async (paths) => { counts.resolve++; return paths.map(p => `/granted/${p}`); };
  const imported = () => args.paths.map((p, i) => ({ kind: 'clip', getId: () => `new-${i}`,
    getMediaFilePath: async () => `/granted/${p}` }));
  f.project.importFiles = async (...nativeArgs) => {
    // Exercise the actual durable journal boundary, not a mocked receipt method.
    const receipt = JSON.parse(await fs.readFile(join(directory, `operation-${args.operationId}.json`), 'utf8'));
    assert.equal(receipt.state, 'started');
    counts.native++;
    assert.deepEqual(nativeArgs, [args.paths.map(p => `/granted/${p}`), true, f.root, false]);
    f.root.items.push(...imported());
    return true;
  };
  const makeUxp = () => new UxpBridge(f.inspectHost, () => {}, f.control, f.api);
  let uxp = makeUxp();
  await uxp.start(folderAdapter(directory));
  t.after(async () => { uxp.stop(); await fs.rm(directory, { recursive: true, force: true }); });
  return { f, directory, marker, args, counts, imported,
    bridge: new FileBridge(directory, { timeoutMs: 10000, pollMs: 5 }),
    restart: async () => { uxp.stop(); uxp = makeUxp(); await uxp.start(folderAdapter(directory)); },
    receipt: async () => JSON.parse(await fs.readFile(join(directory, `operation-${args.operationId}.json`), 'utf8')),
  };
}

test('ten-file import is called once, registers assets and replays durably without host access', async t => {
  const s = await setup(t);
  const result = await s.bridge.call('import_media', s.args);
  assert.deepEqual(result.imported, s.args.paths);
  assert.equal(result.saved, false);
  assert.equal(s.counts.native, 1);
  assert.equal(s.counts.paths, 10);
  assert.equal(s.counts.resolve, 1);
  assert.equal(s.f.api.ownedAssets.size, 10);
  const counts = { ...s.counts };
  await s.restart();
  s.f.host.getActiveProject = async () => assert.fail('Recovery must use the receipt');
  assert.deepEqual(await s.bridge.call('import_media', s.args), { ...result, operationReplayed: true });
  assert.deepEqual(s.counts, counts);
  assert.equal((await s.receipt()).state, 'completed');
});

test('staged exceptions survive dispatcher, receipt, IPC and repeated recovery with zero re-execution', async t => {
  const cases = [
    ['snapshot root', 'preparation', 'snapshot_root', false, (s, e) => { s.f.project.getRootItem = async () => { throw e; }; }],
    ['snapshot IDs', 'preparation', 'snapshot_ids', false, (s, e) => { s.f.media.getId = () => { throw e; }; }],
    ['snapshot paths', 'path_validation', 'snapshot_paths', false, (s, e) => { s.f.apiHost.path = async () => { throw e; }; }],
    ['media resolver', 'path_validation', 'resolve_media', false, (s, e) => { s.f.host.resolveMedia = async () => { throw e; }; }],
    ['root cast argument', 'preparation', 'cast_import_root', false, (s, e) => { s.f.host.projectItem = () => { throw e; }; }],
    ['native method lookup', 'preparation', 'import_method', false, (s, e) => {
      Object.defineProperty(s.f.project, 'importFiles', { get() { throw e; } });
    }],
    ['native throw', 'native_import', 'import_files', true, (s, e) => { s.f.project.importFiles = () => { s.counts.native++; throw e; }; }],
    ['native rejection', 'native_import', 'import_files', true, (s, e) => { s.f.project.importFiles = async () => { s.counts.native++; throw e; }; }],
    ['capture enumeration', 'result_registration', 'capture_items', true, (s, e) => {
      const get = s.f.root.getItems; s.f.root.getItems = async () => { if (s.counts.native) throw e; return get(); };
    }],
    ['capture identity', 'result_registration', 'capture_identity', true, (s, e) => {
      const call = s.f.project.importFiles; s.f.project.importFiles = async (...args) => {
        await call(...args); s.f.root.items.at(-1).getId = () => { throw e; }; return true;
      };
    }],
    ['capture media path', 'result_registration', 'capture_media_path', true, (s, e) => {
      const call = s.f.project.importFiles; s.f.project.importFiles = async (...args) => {
        await call(...args); s.f.root.items.at(-1).getMediaFilePath = async () => { throw e; }; return true;
      };
    }],
    ['result invalidation', 'result_registration', 'invalidate_handles', true, (s, e) => {
      s.f.api.afterLegacyWrite = () => { throw e; };
    }],
  ];
  for (const [name, phase, step, started, inject] of cases) await t.test(name, async t => {
    const s = await setup(t);
    const error = Object.assign(new TypeError(`Synthetic ${name} failure`), { code: 'E_IMPORT_TEST' });
    inject(s, error);
    let first;
    await assert.rejects(s.bridge.call('import_media', s.args), e => {
      first = e;
      assert.equal(e.code, started ? 'OPERATION_OUTCOME_UNKNOWN' : 'IMPORT_PREPARATION_FAILED');
      assert.deepEqual(e.diagnostics, { phase, step, nativeCallStarted: started,
        originalError: { type: 'TypeError', code: 'E_IMPORT_TEST', message: error.message } });
      return true;
    });
    assert.equal(s.counts.native, started ? 1 : 0);
    const receipt = await s.receipt();
    assert.equal(receipt.state, 'completed');
    assert.deepEqual(receipt.outcome.error.diagnostics, first.diagnostics);
    const counts = { ...s.counts };
    await s.restart();
    s.f.host.getActiveProject = async () => assert.fail('Recovery must not enter the host');
    await assert.rejects(s.bridge.call('import_media', s.args), e => {
      assert.equal(e.code, first.code); assert.equal(e.message, first.message);
      assert.deepEqual(e.diagnostics, first.diagnostics); return true;
    });
    assert.deepEqual(s.counts, counts);
    await assert.rejects(s.bridge.call('import_media', { ...s.args, paths: ['other.png'] }), { code: 'OPERATION_ID_CONFLICT' });
  });
});

test('guard error codes stay intact; native false remains uncertain and legacy receipts gain no invented diagnostics', async t => {
  const s = await setup(t);
  s.f.host.resolveMedia = async () => { throw new BridgeError('FILE_ACCESS_DENIED', 'Synthetic denied path'); };
  await assert.rejects(s.bridge.call('import_media', s.args), e => {
    assert.equal(e.code, 'FILE_ACCESS_DENIED');
    assert.equal(e.diagnostics.nativeCallStarted, false);
    assert.equal(e.diagnostics.originalError.code, 'FILE_ACCESS_DENIED'); return true;
  });
  const legacy = await s.receipt();
  delete legacy.outcome.error.diagnostics;
  legacy.outcome.error = { code: 'OPERATION_OUTCOME_UNKNOWN', message: 'The host write did not return a confirmed outcome. Inspect Premiere before another edit.' };
  await fs.writeFile(join(s.directory, `operation-${s.args.operationId}.json`), JSON.stringify(legacy));
  await assert.rejects(s.bridge.call('import_media', s.args), e => {
    assert.equal(e.code, legacy.outcome.error.code); assert.equal(e.message, legacy.outcome.error.message);
    assert.equal(e.diagnostics, undefined); return true;
  });
  assert.equal(s.counts.native, 0);
  await fs.writeFile(join(s.directory, `operation-${s.args.operationId}.json`), JSON.stringify({ ...legacy, state: 'started' }));
  await assert.rejects(s.bridge.call('import_media', s.args), { code: 'OPERATION_OUTCOME_UNKNOWN' });
  assert.equal(s.counts.native, 0);
  const other = await setup(t);
  other.f.project.importFiles = async () => { other.counts.native++; return false; };
  await assert.rejects(other.bridge.call('import_media', other.args), e => {
    assert.equal(e.code, 'OPERATION_OUTCOME_UNKNOWN');
    assert.equal(e.diagnostics.phase, 'native_import'); assert.equal(e.diagnostics.nativeCallStarted, true); return true;
  });
});

test('diagnostics bound untrusted exception fields and protocol rejects malformed diagnostics', async t => {
  const s = await setup(t);
  s.f.host.projectItem = () => { throw { name: 'N'.repeat(100), code: 37, message: 'x\n\u0000'.repeat(600), stack: 'must not escape' }; };
  let diagnostics;
  await assert.rejects(s.bridge.call('import_media', s.args), e => {
    diagnostics = e.diagnostics;
    assert.equal(diagnostics.originalError.type.length, 64);
    assert.equal(diagnostics.originalError.code, 37);
    assert.equal(diagnostics.originalError.message.length, 512);
    assert.equal(/[\u0000-\u001f]/.test(diagnostics.originalError.message), false);
    assert.equal('stack' in diagnostics.originalError, false); return true;
  });
  const request = { bridgeId: s.marker.bridgeId, id: randomUUID() };
  const response = { version: 1, ...request, ok: false, error: { code: 'TEST', message: 'test', diagnostics } };
  assert.deepEqual(parseResponse(response, request).error.diagnostics, diagnostics);
  for (const patch of [{ phase: 'invalid' }, { nativeCallStarted: 'false' }, { step: 'a'.repeat(97) },
    { originalError: { type: 'Error', code: null, message: 'a'.repeat(513) } },
    { originalError: { type: 'Error', code: {}, message: 'test' } }, { stack: 'unexpected' }]) {
    assert.throws(() => parseResponse({ ...response, error: { ...response.error, diagnostics: { ...diagnostics, ...patch } } }, request), { code: 'INVALID_RESPONSE' });
  }
  // Exotic host throws must never replace the first error with a serializer error.
  const dispatch = createDispatcher(s.f.inspectHost, s.f.control, s.f.api);
  for (const thrown of ['native string', null, 42, Object.defineProperties({}, {
    name: { get() { throw new Error('getter'); } }, code: { get() { throw new Error('getter'); } }, message: { get() { throw new Error('getter'); } },
  })]) {
    s.f.host.projectItem = () => { throw thrown; };
    await assert.rejects(dispatch({ command: 'import_media', args: s.args, expiresAt: Date.now() + 3000 }), e => {
      assert.equal(e.diagnostics.nativeCallStarted, false); return true;
    });
  }
});

test('stdio MCP exposes identical structured/text diagnostics on initial failure and same-ID recovery', async t => {
  const s = await setup(t);
  s.f.project.importFiles = async () => { s.counts.native++; throw Object.assign(new RangeError('Synthetic native rejection'), { code: 19 }); };
  const { Client } = await import('@modelcontextprotocol/client');
  const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
  const client = new Client({ name: 'import-diagnostics-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [resolve(__dirname, '../mcp/server.mjs')], env: { ...process.env,
      PREMIERE_MCP_BRIDGE_DIR: s.directory, PREMIERE_MCP_TIMEOUT_MS: '10000' } }));
  const request = { name: 'premiere_import_media', arguments: s.args };
  const first = await client.callTool(request), replay = await client.callTool(request);
  assert.equal(first.isError, true);
  assert.equal(first.structuredContent.error.diagnostics.originalError.type, 'RangeError');
  assert.equal(first.structuredContent.error.diagnostics.originalError.code, 19);
  assert.equal(first.structuredContent.error.diagnostics.nativeCallStarted, true);
  assert.deepEqual(first.structuredContent, JSON.parse(first.content[0].text));
  assert.deepEqual(replay.structuredContent, first.structuredContent);
  assert.equal(s.counts.native, 1);
});
