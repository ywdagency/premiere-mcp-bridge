import type * as Premiere from '@adobe/premierepro';
import { BridgeError } from './bridge-protocol';
import { UxpBridge, UxpFile, UxpFolder } from './uxp-bridge';
import { AutoConnection } from './auto-connection';
import { PremiereApi } from './api-runtime';
import { PremiereControl } from './premiere-control';
import { PLUGIN_VERSION } from './identity';

declare function require(name: string): any;
interface GrantedFolder extends UxpFolder {
  name: string;
  nativePath: string;
  isFolder: boolean;
}
interface MediaEntry extends UxpFile {
  getMetadata(): Promise<{ size: number }>;
  nativePath: string;
  isFolder: boolean;
  getEntries(): Promise<MediaEntry[]>;
}
const ppro = require('premierepro') as Premiere.premierepro;
const { entrypoints, storage, host, versions } = require('uxp');
const fs = storage.localFileSystem;
let mediaFolder: GrantedFolder | undefined;
let connected = false;
let connectionEnabled = true;
let restarting = false;
let activityText = 'Starting…';
let wired = false;
let connectionError = '';
let mediaError = '';
let accessGeneration = 0;
let mediaRequest: Promise<void> | undefined;
const MEDIA_TOKEN = 'premiere-mcp-media-folder';
const mediaExtension =
  /\.(mp4|mov|mxf|avi|mkv|webm|mp3|wav|aif|aiff|flac|m4a|aac|jpg|jpeg|png|tif|tiff|webp|bmp|psd)$/i;

function render(): void {
  const connection = document.getElementById('toggle-connection');
  if (connection) {
    connection.textContent = connectionEnabled ? 'Stop' : 'Launch';
    const label = document.getElementById('connection-label');
    if (label) label.textContent = connection.textContent;
    const control = document.getElementById('connection-control');
    if (control) control.className = connectionEnabled ? 'action' : 'action launch';
  }
  const reload = document.getElementById('reload-bridge') as HTMLButtonElement | null;
  if (reload) reload.disabled = restarting;
  const reloadControl = document.getElementById('reload-control');
  if (reloadControl) reloadControl.className = restarting ? 'action reload disabled' : 'action reload';
  const message = connectionError || mediaError;
  const state = !connectionEnabled ? 'Stopped' : restarting ? activityText : connected ? 'Running' : 'Waiting for agent';
  const status = document.getElementById('status');
  if (status) {
    status.textContent = state;
    status.style.display = message ? 'none' : 'block';
  }
  const version = document.getElementById('plugin-version');
  if (version) version.textContent = `v${PLUGIN_VERSION}`;
  document.getElementById('bridge-status')?.setAttribute('data-state', message ? 'error' : state);
  const error = document.getElementById('error');
  if (error) {
    error.textContent = message;
    error.style.display = message ? 'block' : 'none';
  }
}
function report(_message: string, failed = false): void {
  if (failed) {
    connectionError = 'Connection unavailable. Press Reload.';
    auto.lost();
    connected = false;
  }
  render();
}
function token(key: string): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
}
function forget(key: string): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
}
async function resolveMedia(paths: string[]): Promise<string[]> {
  if (paths.some((path) => !mediaExtension.test(path)))
    throw new BridgeError(
      'MEDIA_TYPE_NOT_ALLOWED',
      'Only supported media file extensions may be imported.',
    );
  return Promise.all(paths.map((path) => resolveApiPath(path, 'read')));
}
async function resolveApiPath(
  relative: string,
  mode: 'read' | 'write' | 'directory',
): Promise<string> {
  const rootDirectory = relative === '.' && mode === 'directory';
  if (
    !rootDirectory &&
    (!relative ||
      relative.length > 1024 ||
      relative.includes('\\') ||
      relative.split('/').some(
        (part) => !part || part === '.' || part === '..' || part.includes(':') || part.includes(String.fromCharCode(0)),
      ))
  )
    throw new BridgeError(
      'INVALID_API_ARGUMENT',
      'Paths must be relative inside the granted folder, without traversal.',
    );
  if (!mediaFolder) {
    if (!connected || !connectionEnabled)
      throw new BridgeError('WRITES_DISABLED', 'Launch Premiere MCP Bridge first.');
    // Reject before file access instead of waiting past an IPC deadline for a picker.
    requestMediaAccess();
    throw new BridgeError(
      'MEDIA_FOLDER_REQUIRED',
      'Approve the folder dialog, then submit a new file request. This request did not access a file.',
    );
  }
  if (rootDirectory)
    return bridge.authorizeFile(mediaFolder.nativePath, relative, mode);
  const rootPath = mediaFolder.nativePath;
  const parts = relative.split('/');
  const base = mediaFolder.nativePath.replace(/\\/g, '/').replace(/\/$/, '');
  let folder = mediaFolder as unknown as MediaEntry;
  for (let i = 0; i < parts.length; i++) {
    const entry = (await folder.getEntries()).find((v) => v.name === parts[i]);
    const last = i === parts.length - 1;
    if (last && mode === 'write') {
      if (entry)
        throw new BridgeError(
          'OUTPUT_EXISTS',
          'Output already exists; overwriting is not allowed.',
        );
      return bridge.authorizeFile(rootPath, relative, mode);
    }
    if (!entry)
      throw new BridgeError('FILE_NOT_FOUND', 'The requested granted entry does not exist.');
    const native = entry.nativePath.replace(/\\/g, '/');
    if (!native.startsWith(base + '/'))
      throw new BridgeError(
        'MEDIA_OUTSIDE_GRANT',
        'The resolved entry is outside the granted folder.',
      );
    if (
      (!last && !entry.isFolder) ||
      (last && (mode === 'directory' ? !entry.isFolder : !entry.isFile))
    )
      throw new BridgeError(
        'INVALID_API_ARGUMENT',
        'Granted entry has the wrong file/folder type.',
      );
    if (last) return bridge.authorizeFile(rootPath, relative, mode);
    folder = entry;
  }
  throw new BridgeError('INVALID_API_ARGUMENT', 'Invalid granted path.');
}
async function readApiText(relative: string): Promise<string> {
  await resolveApiPath(relative, 'read');
  let entry = mediaFolder as unknown as MediaEntry;
  for (const part of relative.split('/'))
    entry = (await entry.getEntries()).find((v) => v.name === part)!;
  const stats = await entry.getMetadata();
  if (typeof stats.size !== 'number' || stats.size > 1048576)
    throw new BridgeError('TEXT_FILE_TOO_LARGE', 'Text inputs are limited to 1 MiB.');
  const text = await entry.read();
  if (typeof text !== 'string' || text.includes(String.fromCharCode(0)))
    throw new BridgeError('INVALID_TEXT_FILE', 'Expected UTF-8 text without NUL.');
  return text;
}
const control = new PremiereControl({
  getActiveProject: () => ppro.Project.getActiveProject(),
  tickTime: (ticks) => ppro.TickTime.createWithTicks(ticks),
  clipType: ppro.Constants.TrackItemType.CLIP,
  writesEnabled: () => connected && connectionEnabled,
  projectItem: (item) => ppro.ProjectItem.cast(item),
  resolveMedia,
  mediaGranted: () => !!mediaFolder,
});
const api = new PremiereApi(
  {
    module: ppro,
    version: host.version,
    getActiveProject: () => ppro.Project.getActiveProject(),
    writesEnabled: () => connected && connectionEnabled,
    path: resolveApiPath,
    readText: readApiText,
  },
  control,
);
const bridge = new UxpBridge(
  {
    getActiveProject: () => ppro.Project.getActiveProject(),
    name: host.name,
    version: host.version,
    uxpVersion: versions.uxp,
    clipConstants: {
      clipType: ppro.Constants.TrackItemType.CLIP,
      displayFormats: ppro.Constants.VideoDisplayFormatType,
    },
  },
  report,
  control,
  api,
);

const auto = new AutoConnection(
  () => fs.getDataFolder(),
  bridge,
  { name: host.name, version: host.version },
  (ready, message, failed) => {
    connected = ready;
    if (ready) connectionError = '';
    report(message, failed);
  },
);
async function connect(): Promise<void> {
  await startBridge('Starting…');
}
async function reloadBridge(): Promise<void> {
  await startBridge('Reloading…');
}
async function startBridge(activity: string): Promise<void> {
  const generation = ++accessGeneration;
  connectionEnabled = true;
  connected = false;
  restarting = true;
  activityText = activity;
  connectionError = '';
  mediaError = '';
  render();
  try {
    await auto.start();
  } finally {
    if (generation === accessGeneration) {
      restarting = false;
      render();
    }
  }
}
function disconnect(): void {
  accessGeneration++;
  auto.stop();
  connectionEnabled = false;
  connected = false;
  restarting = false;
  mediaFolder = undefined;
  forget(MEDIA_TOKEN);
  connectionError = '';
  mediaError = '';
  render();
}
function requestMediaAccess(): void {
  if (mediaRequest) return;
  mediaRequest = chooseMedia().finally(() => { mediaRequest = undefined; });
}
async function chooseMedia(): Promise<void> {
  const generation = accessGeneration;
  try {
    const folder = await fs.getFolder({ initialDomain: storage.domains?.userDocuments });
    if (generation !== accessGeneration) return;
    if (folder) {
      if (typeof localStorage !== 'undefined') {
        const saved = await fs.createPersistentToken(folder);
        if (generation !== accessGeneration) return;
        localStorage.setItem(MEDIA_TOKEN, saved);
      }
      mediaFolder = folder;
      mediaError = '';
      render();
    } else {
      mediaError = 'File access was not granted.';
      render();
    }
  } catch {
    if (generation !== accessGeneration) return;
    mediaError = 'File access failed. Retry the file request.';
    render();
  }
}
async function restore(): Promise<void> {
  const generation = accessGeneration;
  const savedMedia = token(MEDIA_TOKEN);
  if (savedMedia) {
    try {
      const folder = await fs.getEntryForPersistentToken(savedMedia);
      if (generation !== accessGeneration) return;
      mediaFolder = folder;
    } catch {
      if (generation !== accessGeneration) return;
      forget(MEDIA_TOKEN);
      mediaFolder = undefined;
    }
  }
  if (generation === accessGeneration && connectionEnabled) await connect();
  render();
}
function wire(): void {
  if (wired) {
    render();
    return;
  }
  wired = true;
  wireAction('toggle-connection', 'connection-control', () => {
    if (connectionEnabled) disconnect();
    else void connect();
  });
  wireAction('reload-bridge', 'reload-control', () => void reloadBridge(), () => !restarting);
  render();
}
function wireAction(buttonId: string, controlId: string, action: () => void, enabled = () => true): void {
  const button = document.getElementById(buttonId);
  const control = document.getElementById(controlId);
  const activate = () => {
    if (!enabled()) return;
    button?.focus?.();
    action();
  };
  control?.addEventListener('click', activate);
  button?.addEventListener('click', event => {
    event?.stopPropagation();
    activate();
  });
  button?.addEventListener('focus', () => control?.setAttribute('data-focus', 'true'));
  button?.addEventListener('blur', () => control?.setAttribute('data-focus', 'false'));
}
entrypoints.setup({
  plugin: {
    create() {
      void restore();
    },
    destroy() {
      accessGeneration++;
      connectionEnabled = false;
      connected = false;
      api.dispose();
      auto.stop();
    },
  },
  commands: {
    connectReadOnlyMcp: connect,
    disconnectReadOnlyMcp: disconnect,
    reloadBridge,
  },
  panels: { premiereAutoEditorPanel: { create: wire, show: render } },
});
