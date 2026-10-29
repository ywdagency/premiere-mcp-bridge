// Local release preparation only. Never imported by the MCP server or UXP plugin.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const { PLUGIN_VERSION } = createRequire(import.meta.url)('../build/lib/bridge-protocol.cjs');
if (process.argv.length > 2) throw new Error('Usage: node scripts/stage-release.mjs');
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Expected a numeric development version.');
if (pkg.version !== manifest.version || pkg.version !== PLUGIN_VERSION)
  throw new Error('Package, manifest and built protocol versions differ. Rebuild before staging.');

const files = [
  'manifest.json', 'index.html', 'styles.css', 'dist/main.js', 'LICENSE',
  'data/ADOBE-LICENSE.txt', 'data/ADOBE-COPYRIGHT.txt',
];
// Read every input before creating output. The destination must be new.
const inputs = await Promise.all(files.map(async (path) => ({ path, bytes: await readFile(join(root, path)) })));
const parent = join(root, 'artifacts/release', pkg.version);
const stage = join(parent, 'plugin');
await mkdir(parent, { recursive: true });
await mkdir(stage); // EEXIST deliberately prevents overwriting a previous review snapshot.
const inventory = [];
for (const { path, bytes } of inputs) {
  const target = join(stage, path);
  await mkdir(dirname(target), { recursive: true });
  if (!bytes.equals(await readFile(join(root, path))))
    throw new Error('Source changed during staging; discard this incomplete stage and rebuild.');
  await writeFile(target, bytes, { flag: 'wx' });
  const copied = await readFile(target);
  if (!bytes.equals(copied)) throw new Error('Source changed during staging; discard this incomplete stage and rebuild.');
  inventory.push({ path, bytes: copied.length, sha256: createHash('sha256').update(copied).digest('hex') });
}
await writeFile(join(parent, 'plugin-inventory.json'), JSON.stringify({
  version: pkg.version,
  builtProtocolVersion: PLUGIN_VERSION,
  status: 'local-review-snapshot-not-an-installed-or-published-release',
  files: inventory,
}, null, 2) + '\n', { flag: 'wx' });
console.log(`Staged ${files.length} allowlisted plugin files in artifacts/release/${pkg.version}/plugin.`);
console.log('Package this staged manifest with UDT; inspect and test the resulting CCX separately.');
