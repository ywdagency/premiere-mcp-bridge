import type * as Premiere from '@adobe/premierepro';
import { BridgeError } from './bridge-protocol';
import { UxpBridge, UxpFile, UxpFolder } from './uxp-bridge';
import { AutoConnection } from './auto-connection';
import { PremiereApi } from './api-runtime';
import { PremiereControl } from './premiere-control';
import { PLUGIN_VERSION } from './identity';
import { describeFileAccess } from './file-access';
import { UpdateChecker } from './updates';

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
const { entrypoints, storage, host, versions, shell } = require('uxp');
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
let choosingMedia = false;
let folderHover = false;
let folderFocus = false;
const MEDIA_TOKEN = 'premiere-mcp-media-folder';
const mediaExtension =
  /\.(mp4|mov|mxf|avi|mkv|webm|mp3|wav|aif|aiff|flac|m4a|aac|jpg|jpeg|png|tif|tiff|webp|bmp|psd)$/i;
let updateStorage: Storage | undefined;
try { if (typeof localStorage !== 'undefined') updateStorage = localStorage; } catch { /* Optional update cache. */ }
const updates = new UpdateChecker({
  installedVersion: PLUGIN_VERSION, hostVersion: host.version, storage: updateStorage,
  fetcher: typeof fetch === 'function' ? fetch : undefined, onChange: render,
});
let openingVersion = false;

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
  const folderControl = document.getElementById('folder-control');
  const folderButton = document.getElementById('choose-media-folder') as HTMLButtonElement | null;
  const folderDisabled = restarting || choosingMedia;
  const folderName = (typeof mediaFolder?.name === 'string' ? mediaFolder.name : 'Approved folder')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 160);
  const folderHint = choosingMedia ? 'Choosing a folder…'
    : mediaError || (mediaFolder
      ? `Folder access granted\n${folderName} · Click to choose another folder.`
      : 'Choose a folder\nAllow a folder for import and file output. Timeline tools remain available.');
  if (folderControl) {
    folderControl.className = `action folder${mediaFolder ? ' granted' : ''}${folderDisabled ? ' disabled' : ''}`;
    folderControl.setAttribute('data-access', mediaFolder ? 'granted' : 'missing');
    folderControl.setAttribute('data-hover', String(folderHover));
  }
  if (folderButton) {
    folderButton.disabled = folderDisabled;
    folderButton.setAttribute('aria-label', folderHint);
  }
  const tooltip = document.getElementById('file-tooltip');
  const tooltipVisible = folderHover || folderFocus;
  if (tooltip) {
    tooltip.style.display = tooltipVisible ? 'block' : 'none';
    tooltip.setAttribute('aria-hidden', String(!tooltipVisible));
  }
  const tooltipTitle = document.getElementById('file-tooltip-title');
  const tooltipFolder = document.getElementById('file-tooltip-folder');
  const tooltipHelp = document.getElementById('file-tooltip-help');
  if (tooltipTitle) tooltipTitle.textContent = choosingMedia ? 'Choosing a folder…'
    : mediaError ? 'File access' : mediaFolder ? 'File access granted' : 'File access not granted';
  if (tooltipFolder) {
    tooltipFolder.textContent = folderName;
    tooltipFolder.style.display = mediaFolder && !mediaError && !choosingMedia ? 'block' : 'none';
  }
  if (tooltipHelp) tooltipHelp.textContent = choosingMedia ? 'Finish or cancel the Adobe folder dialog.'
    : mediaError || (mediaFolder ? 'Click to choose another folder.'
      : 'Choose a folder for import and file output. Timeline tools remain available.');
  const message = connectionError;
  const state = !connectionEnabled ? 'Stopped' : restarting ? activityText : connected ? 'Running' : 'Waiting for agent';
  const status = document.getElementById('status');
  if (status) {
    status.textContent = state;
    status.style.display = message ? 'none' : 'block';
  }
  const version = document.getElementById('plugin-version');
  if (version) {
    const indicator = updates.indicator;
    version.textContent = `v${PLUGIN_VERSION}`;
    version.setAttribute('data-update', indicator.state);
    version.setAttribute('href', indicator.url);
    version.setAttribute('title', indicator.title);
    version.setAttribute('aria-label', `Plugin version ${PLUGIN_VERSION}. ${indicator.title}`);
  }
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
  if (!connected || !connectionEnabled)
    throw new BridgeError('WRITES_DISABLED', 'Launch Premiere MCP Bridge first.');
  if (choosingMedia && mediaFolder)
    throw new BridgeError('FILE_ACCESS_PENDING', 'Folder selection is open. Finish or cancel it before a new file request. This request did not access a file.');
  if (!mediaFolder) {
    const generation = accessGeneration;
    await restoreMediaAccess(generation);
    if (generation !== accessGeneration || !connected || !connectionEnabled)
      throw new BridgeError('FILE_CHECK_ABORTED', 'File access was interrupted before authorization.');
  }
  if (!mediaFolder) {
    // Reject before file access instead of waiting past an IPC deadline for a picker.
    requestMediaAccess();
    throw new BridgeError(
      'MEDIA_FOLDER_REQUIRED',
      'Approve the folder dialog, then submit a new file request. This request did not access a file.',
    );
  }
  // Bind before asynchronous Entry traversal so a late result cannot join another request.
  const authorize = bridge.fileAuthorization(mediaFolder.nativePath, relative, mode);
  if (rootDirectory) return authorize();
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
      return authorize();
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
    if (last) return authorize();
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
    getUpdateStatus: () => updates.diagnostics,
    getFileAccess: (includePath) => describeFileAccess(mediaFolder, includePath),
    forgetFileAccess: forgetMediaAccess,
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
  auto.stop();
  restarting = true;
  activityText = activity;
  connectionError = '';
  mediaError = '';
  render();
  try {
    await restoreMediaAccess(generation);
    if (generation !== accessGeneration || !connectionEnabled) return;
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
  // Stop suspends transport; the existing user-approved folder/token survives.
  connectionError = '';
  mediaError = '';
  render();
}
function forgetMediaAccess(): void {
  // Invalidate late picker/restoration results before clearing the remembered grant.
  accessGeneration++;
  forget(MEDIA_TOKEN);
  mediaFolder = undefined;
  mediaError = '';
  render();
}
function requestMediaAccess(explicit = false): void {
  if (mediaRequest) return;
  if (explicit && bridge.requestActive) {
    mediaError = 'The agent is busy. Choose a folder after its current command finishes.';
    render();
    return;
  }
  choosingMedia = true;
  mediaError = '';
  render();
  mediaRequest = chooseMedia().finally(() => {
    mediaRequest = undefined;
    choosingMedia = false;
    render();
  });
}
async function chooseMedia(): Promise<void> {
  const generation = accessGeneration;
  try {
    const folder = await fs.getFolder({ initialDomain: storage.domains?.userDocuments });
    if (generation !== accessGeneration) return;
    if (folder) {
      if (!folder.isFolder) throw new BridgeError('INVALID_FILE_GRANT', 'Expected a folder.');
      if (typeof localStorage !== 'undefined') {
        const saved = await fs.createPersistentToken(folder);
        if (generation !== accessGeneration) return;
        localStorage.setItem(MEDIA_TOKEN, saved);
      }
      mediaFolder = folder;
      mediaError = '';
      render();
    } // Cancellation keeps the previous folder/token and normal bridge status.
  } catch {
    if (generation !== accessGeneration) return;
    mediaError = 'Folder selection failed. Click the folder button to try again.';
    render();
  }
}
async function restoreMediaAccess(generation: number): Promise<void> {
  const savedMedia = token(MEDIA_TOKEN);
  if (savedMedia) {
    try {
      const folder = await fs.getEntryForPersistentToken(savedMedia);
      if (generation !== accessGeneration || token(MEDIA_TOKEN) !== savedMedia) return;
      if (!folder?.isFolder)
        throw new BridgeError('INVALID_FILE_GRANT', 'The remembered entry is not a folder.');
      mediaFolder = folder;
    } catch {
      if (generation !== accessGeneration || token(MEDIA_TOKEN) !== savedMedia) return;
      // A disconnected volume or temporary restore failure must not erase consent.
      // Only a real file request may ask the user again; diagnostics never prompt.
      mediaFolder = undefined;
    }
  }
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
  wireAction('choose-media-folder', 'folder-control', () => requestMediaAccess(true), () => !restarting && !choosingMedia);
  const folderControl = document.getElementById('folder-control');
  const folderButton = document.getElementById('choose-media-folder');
  folderControl?.addEventListener('mouseenter', () => { folderHover = true; render(); });
  folderControl?.addEventListener('mouseleave', () => { folderHover = false; render(); });
  folderButton?.addEventListener('focus', () => { folderFocus = true; render(); });
  folderButton?.addEventListener('blur', () => { folderFocus = false; render(); });
  folderButton?.addEventListener('keydown', event => {
    if (event.key === 'Escape') { folderHover = false; folderFocus = false; render(); }
  });
  const version = document.getElementById('plugin-version');
  version?.addEventListener('click', event => {
    event.preventDefault();
    void openVersion();
  });
  version?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void openVersion(); }
  });
  render();
}
async function openVersion(): Promise<void> {
  if (openingVersion) return;
  openingVersion = true;
  const indicator = updates.indicator;
  try {
    const result = await shell.openExternal(indicator.url,
      indicator.state === 'neutral' ? 'Open the Premiere MCP Bridge repository in your browser.' : 'Open the Premiere MCP Bridge update release in your browser.');
    if (result !== '') throw new Error('Browser did not open.');
  } catch {
    document.getElementById('plugin-version')?.setAttribute('title', `Could not open GitHub. Open in your browser: ${indicator.url}`);
  } finally { openingVersion = false; }
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
      updates.start();
      void connect();
    },
    destroy() {
      updates.stop();
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
