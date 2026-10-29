import { UxpBridge, UxpFile, UxpFolder } from './uxp-bridge';
import { PLUGIN_ID, PLUGIN_VERSION } from './identity';
export interface DataFolder extends UxpFolder { getEntries(): Promise<Array<UxpFile & { isFolder?: boolean }>>; }
export class AutoConnection {
  private timer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private enabled = false;
  private connected = false;
  private pending?: Promise<void>;
  constructor(private readonly getDataFolder: () => Promise<DataFolder>, private readonly bridge: UxpBridge,
    private readonly host: { name: string; version: string },
    private readonly ready: (connected: boolean, message: string, failed?: boolean) => void) {}
  async start(): Promise<void> {
    this.stop(); this.enabled = true;
    const epoch = this.epoch;
    this.ready(false, 'Waiting for your agent. Connection is automatic.');
    const previous = this.pending;
    this.pending = (async () => { await previous; if (epoch === this.epoch) await this.cycle(epoch); })();
    await this.pending;
  }
  stop(): void {
    this.enabled = false; this.connected = false; this.epoch++;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.bridge.stop();
  }
  lost(): void { this.connected = false; }
  private async cycle(epoch: number): Promise<void> {
    if (!this.enabled || epoch !== this.epoch) return;
    try {
      const data = await this.getDataFolder();
      if (!this.enabled || epoch !== this.epoch) return;
      const marker = await data.createFile('mcp-host.tmp', { overwrite: true });
      await marker.write(JSON.stringify({ pluginId: PLUGIN_ID, pluginVersion: PLUGIN_VERSION, protocolVersion: 1,
        host: this.host, heartbeatAt: Date.now() }));
      if (!this.enabled || epoch !== this.epoch) return;
      await data.renameEntry(marker, 'mcp-host.json', { overwrite: true });
      if (!this.connected) {
        const folder = (await data.getEntries()).find((entry) => entry.name === 'mcp-bridge' && entry.isFolder);
        if (folder && await this.bridge.start(folder as unknown as UxpFolder) && this.enabled && epoch === this.epoch) {
          this.connected = true;
          this.ready(true, 'Connected. Ready for agent requests.');
        }
      }
    } catch {
      if (!this.enabled || epoch !== this.epoch) return;
      this.connected = false;
      this.ready(false, 'Automatic connection is waiting for Premiere storage. Reload the plugin if this persists.', true);
    } finally {
      if (this.enabled && epoch === this.epoch) this.timer = setTimeout(() => { this.pending = this.cycle(epoch); }, 1000);
    }
  }
}
