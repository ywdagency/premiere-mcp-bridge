import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_BRIDGE_DIR } from '../mcp/file-bridge.mjs';

export function clientConfig(client, { nodePath, serverPath, directory, readOnly = false }) {
  const env = { ...(directory && directory !== 'auto' ? { PREMIERE_MCP_BRIDGE_DIR: directory } : {}), ...(readOnly ? { PREMIERE_MCP_READ_ONLY: '1' } : {}) };
  if (client === 'codex') return `[mcp_servers.premiere_bridge]\ncommand = ${JSON.stringify(nodePath)}\nargs = [${JSON.stringify(serverPath)}]\nstartup_timeout_sec = 10\ntool_timeout_sec = 20\n\n[mcp_servers.premiere_bridge.env]\n${Object.entries(env).map(([key, value]) => `${key} = ${JSON.stringify(value)}`).join('\n')}\n`;
  const server = { command: nodePath, args: [serverPath], env };
  if (client === 'vscode') return JSON.stringify({ servers: { premiere: { type: 'stdio', ...server } } }, null, 2) + '\n';
  if (['json', 'claude', 'cursor'].includes(client)) return JSON.stringify({ mcpServers: { premiere: server } }, null, 2) + '\n';
  throw new Error('Supported clients: codex, json, claude, cursor, vscode');
}
export function mergeCodex(existing, fragment) {
  // Replace only this bridge's current/previous project-local registrations.
  const own = /(?:^|\n)\[mcp_servers\.(?:premiere_bridge|premiere_readonly)(?:\.env)?\][\s\S]*?(?=\n\[|$)/g;
  return existing.replace(own, '').trimEnd() + '\n\n' + fragment;
}
export async function setup(argv = process.argv.slice(2)) {
  let client = 'codex';
  let directory = process.env.PREMIERE_MCP_BRIDGE_DIR ?? DEFAULT_BRIDGE_DIR;
  let readOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--client') client = argv[++i];
    else if (argv[i] === '--bridge-dir') directory = argv[++i];
    else if (argv[i] === '--read-only') readOnly = true;
    else throw new Error('Usage: npm run setup -- [--client codex|json|claude|cursor|vscode] [--bridge-dir /absolute/folder] [--read-only]');
  }
  if (!directory || directory !== 'auto' && !isAbsolute(directory)) throw new Error('Bridge directory must be an absolute path.');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const serverPath = join(root, 'mcp/server.mjs');
  const config = clientConfig(client, { nodePath: process.execPath, serverPath, directory: directory === 'auto' ? 'auto' : resolve(directory), readOnly });
  if (client === 'codex') {
    const target = join(root, '.codex/config.toml');
    let existing = '';
    try { existing = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, mergeCodex(existing, config), { mode: 0o600 });
    await chmod(target, 0o600);
    console.log(`Updated local Codex config: ${target}`);
  } else process.stdout.write(config);
  console.error('MCP configuration generated without contacting Premiere. Install the reviewed matching CCX with npm run onboard, or use UDT only for development. Open the panel once and reconnect the client; npm run doctor checks the executing version.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await setup(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
