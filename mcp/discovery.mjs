import { readdir, lstat, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import protocol from '../build/lib/bridge-protocol.cjs';
const { BridgeError } = protocol;
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
export const PLUGIN_ID = manifest.id;
export function defaultStorageRoot() {
  if (process.platform === 'darwin') return join(homedir(), 'Library/Application Support/Adobe/UXP/PluginsStorage/PPRO');
  if (process.platform === 'win32' && process.env.APPDATA) return join(process.env.APPDATA, 'Adobe/UXP/PluginsStorage/PPRO');
  throw new BridgeError('AUTO_DISCOVERY_UNSUPPORTED', 'Automatic Premiere discovery is available on macOS and Windows.');
}
export async function discoverBridgeDirectory({ root = defaultStorageRoot(), now = Date.now(), hostVersion = process.env.PREMIERE_MCP_HOST_VERSION } = {}) {
  let versions;
  try { versions = await readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') throw new BridgeError('PLUGIN_NOT_LOADED', 'Load Premiere MCP Bridge in Premiere first. No folder selection is required.'); throw error; }
  const candidates = [];
  // Inspect only known host/version/channel paths and this exact plugin ID.
  for (const version of versions.filter((item) => item.isDirectory() && /^\d+(?:\.\d+)*$/.test(item.name)).slice(0, 100)) {
    if (hostVersion && version.name !== hostVersion) continue;
    for (const channel of ['Developer', 'External', 'Internal']) {
      const data = join(root, version.name, channel, PLUGIN_ID, 'PluginData');
      try {
        const stat = await lstat(join(data, 'mcp-host.json'));
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096 || process.getuid && stat.uid !== process.getuid()) continue;
        const info = JSON.parse(await readFile(join(data, 'mcp-host.json'), 'utf8'));
        if (info.pluginId !== PLUGIN_ID || info.protocolVersion !== 1 || typeof info.heartbeatAt !== 'number' ||
          info.heartbeatAt > now + 5000 || now - info.heartbeatAt > 10000) continue;
        candidates.push(join(data, 'mcp-bridge'));
      } catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code) && !(error instanceof SyntaxError)) throw error; }
    }
  }
  if (!candidates.length) throw new BridgeError('PLUGIN_NOT_LOADED', 'Premiere MCP Bridge is not running. Reload the plugin; the connection is automatic and needs no folder.');
  if (candidates.length > 1) throw new BridgeError('MULTIPLE_PREMIERE_HOSTS', 'More than one Premiere bridge is running. Close the other host or set PREMIERE_MCP_HOST_VERSION to its major version.');
  return candidates[0];
}
