const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = join(__dirname, '..');
const files = ['manifest.json', 'index.html', 'styles.css', 'dist/main.js', 'LICENSE', 'assets/folder.svg',
  'data/ADOBE-LICENSE.txt', 'data/ADOBE-COPYRIGHT.txt'];

async function fixture(t) {
  const dir = await fs.mkdtemp(join(tmpdir(), 'bridge-release-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const path of ['scripts', 'build/lib', 'dist', 'data', 'assets'])
    await fs.mkdir(join(dir, path), { recursive: true });
  await fs.copyFile(join(root, 'scripts/stage-release.mjs'), join(dir, 'scripts/stage-release.mjs'));
  await fs.writeFile(join(dir, 'package.json'), JSON.stringify({version: '1.2.3', type: 'module'}));
  for (const path of files) await fs.writeFile(join(dir, path), path);
  await fs.writeFile(join(dir, 'manifest.json'), JSON.stringify({version: '1.2.3'}));
  await fs.writeFile(join(dir, 'build/lib/bridge-protocol.cjs'), "exports.PLUGIN_VERSION = '1.2.3';\n");
  return { dir, run: () => spawnSync(process.execPath, [join(dir, 'scripts/stage-release.mjs')], {encoding: 'utf8'}) };
}

test('release identity and public entry documents match the built candidate', async () => {
  const pkg = require('../package.json'), manifest = require('../manifest.json');
  const { PLUGIN_VERSION } = require('../build/lib/bridge-protocol.cjs');
  const { COMMAND_LIST } = require('../build/lib/command-catalog.cjs');
  assert.equal(pkg.version, manifest.version);
  assert.equal(pkg.version, require('../package-lock.json').packages[''].version);
  assert.equal(pkg.version, PLUGIN_VERSION);
  assert.equal(pkg.private, true);
  assert.deepEqual(manifest.requiredPermissions, { localFileSystem: 'request',
    network: { domains: ['https://raw.githubusercontent.com'] }, launchProcess: { schemes: ['https'] } });
  for (const path of ['README.md', 'docs/release/README.md', `docs/release/candidate-${pkg.version}.md`])
    assert.ok((await fs.readFile(join(root, path), 'utf8')).includes(pkg.version), `${path} must identify this candidate`);
  const readme = await fs.readFile(join(root, 'README.md'), 'utf8');
  assert.ok(readme.includes(`**${COMMAND_LIST.length + 3} MCP tools**`));
});

test('release stage copies only eight plugin inputs, records matching hashes and refuses overwrite', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(join(f.dir, '.env'), 'PRIVATE_TEST_SENTINEL');
  await fs.writeFile(join(f.dir, 'private.prproj'), 'PRIVATE_TEST_SENTINEL');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const parent = join(f.dir, 'artifacts/release/1.2.3');
  const inventory = JSON.parse(await fs.readFile(join(parent, 'plugin-inventory.json'), 'utf8'));
  assert.equal(inventory.version, '1.2.3');
  assert.equal(inventory.builtProtocolVersion, '1.2.3');
  assert.deepEqual(inventory.files.map(f => f.path), files);
  const staged = (await fs.readdir(join(parent, 'plugin'), {recursive: true, withFileTypes: true}))
    .filter(f => f.isFile());
  assert.equal(staged.length, 8);
  for (const entry of inventory.files) {
    const bytes = await fs.readFile(join(parent, 'plugin', entry.path));
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(entry.bytes, bytes.length);
    assert.ok(!bytes.toString().includes('PRIVATE_TEST_SENTINEL'));
  }
  assert.notEqual(f.run().status, 0);
});

test('release staging rejects mismatched or missing build identity before creating a package', async (t) => {
  const f = await fixture(t);
  for (const content of ["exports.PLUGIN_VERSION = '1.2.2';", 'exports.UNRELATED = true;']) {
    await fs.writeFile(join(f.dir, 'build/lib/bridge-protocol.cjs'), content);
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /versions differ/);
    await assert.rejects(fs.access(join(f.dir, 'artifacts')));
  }
});
