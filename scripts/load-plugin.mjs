// Development convenience: talks only to Adobe UDT's existing local CLI service.
// Not imported by, or exposed through, the MCP server.
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const port = Number(process.env.PREMIERE_UDT_PORT ?? 14001);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local UDT service port.');
const socket = new WebSocket(`ws://127.0.0.1:${port}/socket/cli`);
let host;
const timeout = setTimeout(() => { console.error('Adobe UXP Developer Tools did not respond. Start UDT and Premiere, then retry.'); socket.close(); process.exitCode = 1; }, 15000);
socket.onerror = () => { console.error('Cannot reach Adobe UXP Developer Tools. Start it first.'); clearTimeout(timeout); process.exitCode = 1; };
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.command === 'didAddRuntimeClient' && data.app?.appId === 'premierepro') {
    if (host) { console.error('Multiple Premiere hosts are connected to UDT. Load the plugin in the intended host manually.'); socket.close(); clearTimeout(timeout); process.exitCode = 1; return; }
    host = data;
  }
  if (data.command === 'didCompleteConnection') {
    if (!host) { console.error('Premiere is not connected to UDT. Start Premiere and enable its Developer Mode.'); socket.close(); clearTimeout(timeout); process.exitCode = 1; return; }
    socket.send(JSON.stringify({ command: 'proxy', clientId: host.id, requestId: 1,
      message: { command: 'Plugin', action: 'load', params: { provider: { type: 'disk', path: root } }, breakOnStart: false, isPlaygroundPlugin: false } }));
  }
  if (data.command === 'reply' && data.requestId === 1) {
    clearTimeout(timeout);
    if (data.error || data.success === false || !data.pluginSessionId) { console.error(data.error ?? data.errorMessage ?? 'Adobe did not confirm plugin loading. Use UDT Load manually.'); process.exitCode = 1; }
    else console.log(`Loaded ${manifest.name} in Premiere ${host.app.appVersion}. The bridge connects automatically.`);
    socket.close();
  }
};
