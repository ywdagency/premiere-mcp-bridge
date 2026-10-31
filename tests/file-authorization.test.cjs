const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path'),
  { tmpdir } = require('node:os'),
  { randomUUID } = require('node:crypto');
async function setup(t) {
  const root = await fs.mkdtemp(join(tmpdir(), 'premiere-grant-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(join(root, 'sub'));
  await fs.writeFile(join(root, 'input.txt'), 'input');
  const request = { id: randomUUID(), bridgeId: randomUUID() };
  const check = {
    version: 1,
    bridgeId: request.bridgeId,
    requestId: request.id,
    counter: 1,
    root,
    relative: 'input.txt',
    mode: 'read',
  };
  const { authorizePath } = await import('../mcp/file-authorization.mjs');
  return { root, request, check, authorizePath };
}
test('Node file broker independently verifies existing inputs, output parents and no-overwrite paths', async (t) => {
  const { root, request, check, authorizePath } = await setup(t);
  assert.equal((await authorizePath(check, request)).nativePath, join(root, 'input.txt'));
  assert.equal(
    (await authorizePath({ ...check, relative: '.', mode: 'directory' }, request)).nativePath,
    root,
  );
  assert.equal(
    (await authorizePath({ ...check, relative: 'sub/output.png', mode: 'write' }, request))
      .nativePath,
    join(root, 'sub/output.png'),
  );
  await assert.rejects(authorizePath({ ...check, mode: 'write' }, request), {
    code: 'OUTPUT_EXISTS',
  });
  await assert.rejects(authorizePath({ ...check, relative: '../input.txt' }, request), {
    code: 'INVALID_FILE_CHECK',
  });
  await assert.rejects(authorizePath({ ...check, relative: '/etc/passwd' }, request), {
    code: 'INVALID_FILE_CHECK',
  });
  await assert.rejects(authorizePath({ ...check, requestId: randomUUID() }, request), {
    code: 'INVALID_FILE_CHECK',
  });
});
test('real lstat blocks symlink files, linked parents and a linked granted root independently of UXP behavior', async (t) => {
  const { root, request, check, authorizePath } = await setup(t);
  await fs.symlink(join(root, 'input.txt'), join(root, 'link.txt'));
  await fs.symlink(join(root, 'sub'), join(root, 'linked-dir'), 'dir');
  await fs.symlink(root, join(root, 'sub', 'linked-root'), 'dir');
  for (const relative of ['link.txt', 'linked-dir/new.png'])
    await assert.rejects(
      authorizePath(
        { ...check, relative, mode: relative.endsWith('.png') ? 'write' : 'read' },
        request,
      ),
      { code: 'LINK_NOT_ALLOWED' },
    );
  await assert.rejects(
    authorizePath({ ...check, root: join(root, 'sub', 'linked-root') }, request),
    { code: 'LINK_NOT_ALLOWED' },
  );
});
test('real IPC services a UXP file challenge with a matched proof and cleans only its own challenge files', async (t) => {
  const { root } = await setup(t);
  const { FileBridge, prepareBridge } = await import('../mcp/file-bridge.mjs');
  const { UxpBridge } = require('../build/lib/runtime.cjs');
  const { controlFixture } = require('./helpers/control-fixture.cjs');
  const { folderAdapter } = require('./helpers/bridge-fixture.cjs');
  const { PremiereControl } = require('../build/lib/runtime.cjs');
  const directory = join(root, 'bridge');
  await prepareBridge(directory);
  const f = controlFixture();
  let uxp;
  f.host.resolveMedia = async (paths) =>
    Promise.all(paths.map((path) => uxp.authorizeFile(root, path, 'read')));
  uxp = new UxpBridge(f.inspectHost, () => {}, new PremiereControl(f.host));
  await uxp.start(folderAdapter(directory));
  t.after(() => uxp.stop());
  const bridge = new FileBridge(directory, { timeoutMs: 2500, pollMs: 5 });
  const result = await bridge.call('import_media', {
    projectId: f.project.guid,
    operationId: randomUUID(),
    paths: ['input.txt'],
  });
  assert.equal(result.saved, false);
  assert.equal(f.imports[0][0][0], join(root, 'input.txt'));
  assert.equal(
    (await fs.readdir(directory)).some((name) => /^path(check|proof)-/.test(name)),
    false,
  );
});

test('parallel file requests respect a UXP storage adapter that rejects overlapping proof lifecycles', async (t) => {
  const { root } = await setup(t);
  const { FileBridge, prepareBridge } = await import('../mcp/file-bridge.mjs');
  const { UxpBridge, PremiereControl } = require('../build/lib/runtime.cjs');
  const { controlFixture } = require('./helpers/control-fixture.cjs');
  const { folderAdapter } = require('./helpers/bridge-fixture.cjs');
  const directory = join(root, 'bridge'); await prepareBridge(directory);
  await fs.writeFile(join(root, 'second.txt'), 'second');
  const folder = folderAdapter(directory), create = folder.createFile, entries = folder.getEntries;
  let active = 0, maximum = 0;
  folder.createFile = async (name, options) => {
    if (name.startsWith('pathcheck-')) {
      if (active) throw Object.assign(new Error('no such file or directory'), { code: -2 });
      maximum = Math.max(maximum, ++active);
    }
    return create(name, options);
  };
  folder.getEntries = async () => (await entries()).map(entry => {
    const remove = entry.delete;
    return { ...entry, delete: async () => {
      await remove();
      if (entry.name.startsWith('pathproof-')) active--;
    } };
  });
  const f = controlFixture(); let uxp;
  f.host.resolveMedia = paths => Promise.all(paths.map(path => uxp.authorizeFile(root, path, 'read')));
  uxp = new UxpBridge(f.inspectHost, () => {}, new PremiereControl(f.host));
  await uxp.start(folder); t.after(() => uxp.stop());
  const result = await new FileBridge(directory, { timeoutMs: 2500, pollMs: 5 }).call('import_media', {
    projectId: f.project.guid, operationId: randomUUID(), paths: ['input.txt', 'second.txt'],
  });
  assert.equal(result.saved, false);
  assert.equal(f.imports.length, 1);
  assert.equal(maximum, 1); assert.equal(active, 0);
  assert.equal((await fs.readdir(directory)).some(n => /^path(check|proof)-/.test(n)), false);
  await assert.rejects(new FileBridge(directory, { timeoutMs: 2500, pollMs: 5 }).call('import_media', {
    projectId: f.project.guid, operationId: randomUUID(), paths: ['missing.txt', 'second.txt'],
  }));
  assert.equal(f.imports.length, 1, 'A denied first path must never import');
  assert.equal(active, 0);
  await new FileBridge(directory, { timeoutMs: 2500, pollMs: 5 }).call('import_media', {
    projectId: f.project.guid, operationId: randomUUID(), paths: ['input.txt', 'second.txt'],
  });
  assert.equal(f.imports.length, 2, 'A failed request must release the queue for the next request');
  assert.equal(maximum, 1); assert.equal(active, 0);
});

test('a file authorization captured before async traversal cannot join a later MCP request', async (t) => {
  const { root } = await setup(t);
  const { FileBridge, prepareBridge } = await import('../mcp/file-bridge.mjs');
  const { UxpBridge, PremiereControl } = require('../build/lib/runtime.cjs');
  const { controlFixture } = require('./helpers/control-fixture.cjs');
  const { folderAdapter } = require('./helpers/bridge-fixture.cjs');
  const directory = join(root, 'bridge'); await prepareBridge(directory);
  const f = controlFixture(); let captured, uxp;
  f.host.resolveMedia = async () => {
    captured = uxp.fileAuthorization(root, 'input.txt', 'read');
    throw new Error('Synthetic asynchronous traversal failure');
  };
  uxp = new UxpBridge(f.inspectHost, () => {}, new PremiereControl(f.host));
  await uxp.start(folderAdapter(directory)); t.after(() => uxp.stop());
  const bridge = new FileBridge(directory, { timeoutMs: 2500, pollMs: 5 });
  const args = () => ({ projectId: f.project.guid, operationId: randomUUID(), paths: ['input.txt'] });
  await assert.rejects(bridge.call('import_media', args()));
  f.host.resolveMedia = async () => [await captured()];
  await assert.rejects(bridge.call('import_media', args()), error =>
    error.diagnostics?.originalError?.code === 'FILE_CHECK_ABORTED');
  assert.equal(f.imports.length, 0);
  assert.equal((await fs.readdir(directory)).some(n => /^path(check|proof)-/.test(n)), false);
  f.host.resolveMedia = async () => [await uxp.authorizeFile(root, 'input.txt', 'read')];
  await bridge.call('import_media', args()); assert.equal(f.imports.length, 1);
});
