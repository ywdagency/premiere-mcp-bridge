import { constants } from 'node:fs';
import { open, mkdir, lstat, realpath, link, rename, unlink, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { authorizePath } from './file-authorization.mjs';
import { discoverBridgeDirectory } from './discovery.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import protocol from '../build/lib/bridge-protocol.cjs';

const {
  BridgeError,
  BRIDGE_VERSION,
  BRIDGE_NAME,
  MARKER_FILE,
  MAX_RESPONSE_BYTES,
  MAX_REQUEST_BYTES,
  MAX_REQUEST_LIFETIME_MS,
  parseMarker,
  parseResponse,
  validateArgs,
} = protocol;

export const DEFAULT_BRIDGE_DIR = 'auto';
export function isLegacyMarkerValidation(command, error) {
  return command === 'api_apply_actions' && error?.code === 'INVALID_API_ARGUMENT' &&
    error.message.startsWith('Marker creation requires every preceding argument');
}

function assertPrivate(stat, directory = false) {
  if (
    (directory ? !stat.isDirectory() : !stat.isFile()) ||
    (process.getuid && stat.uid !== process.getuid()) ||
    (directory && process.platform !== 'win32' && (stat.mode & 0o077) !== 0)
  ) {
    throw new BridgeError(
      'UNSAFE_BRIDGE_PATH',
      'Bridge files must be regular and owned by this user inside a private 0700 folder.',
    );
  }
}

async function checkAncestors(path) {
  // Writable descendants cannot be reached through an owner-only ancestor.
  // Adobe creates 0775 storage folders under the user's 0700 Library: that is private.
  let current = await realpath(dirname(path));
  let exposedWritableParent = false;
  while (true) {
    const stat = await lstat(current);
    if (process.platform !== 'win32') {
      if (process.getuid && stat.uid !== process.getuid() && stat.uid !== 0) {
        throw new BridgeError(
          'UNSAFE_BRIDGE_PATH',
          'A parent of the bridge folder belongs to another user.',
        );
      }
      if (process.getuid && stat.uid === process.getuid() && (stat.mode & 0o077) === 0) return;
      if ((stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0) exposedWritableParent = true;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (exposedWritableParent)
    throw new BridgeError(
      'UNSAFE_BRIDGE_PATH',
      'A parent of the bridge folder can be reached and replaced by another user.',
    );
}

async function readPrivateJson(path, maximum) {
  const before = await lstat(path);
  assertPrivate(before); // Windows has no O_NOFOLLOW: reject links before opening, too.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await handle.stat();
    assertPrivate(stat);
    if (before.dev !== stat.dev || before.ino !== stat.ino)
      throw new BridgeError('UNSAFE_BRIDGE_PATH', 'Bridge file changed while opening it.');
    if (stat.size > maximum)
      throw new BridgeError('INVALID_RESPONSE', 'Bridge file exceeds the size limit.');
    const content = await handle.readFile('utf8');
    if (Buffer.byteLength(content) > maximum)
      throw new BridgeError('INVALID_RESPONSE', 'Bridge file exceeds the size limit.');
    return JSON.parse(content);
  } finally {
    await handle.close();
  }
}

export async function prepareBridge(directory = DEFAULT_BRIDGE_DIR) {
  if (directory === 'auto') directory = await discoverBridgeDirectory();
  if (!isAbsolute(directory))
    throw new BridgeError('INVALID_BRIDGE_PATH', 'Use an absolute bridge directory.');
  const path = resolve(directory);
  await mkdir(path, { recursive: true, mode: 0o700 });
  await checkAncestors(path);
  assertPrivate(await lstat(path), true); // Reject symlinks rather than following them.
  const markerPath = join(path, MARKER_FILE);
  try {
    await lstat(markerPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const temporary = join(path, `marker-${randomUUID()}.tmp`);
    try {
      await atomicWrite(temporary, {
        version: BRIDGE_VERSION,
        name: BRIDGE_NAME,
        bridgeId: randomUUID(),
      });
      try {
        await link(temporary, markerPath);
      } catch (linkError) {
        if (linkError.code !== 'EEXIST') throw linkError;
      }
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
  const marker = parseMarker(await readPrivateJson(markerPath, 4096));
  // Only stale protocol files are removed; never scan media or delete arbitrary entries.
  for (const name of await readdir(path)) {
    if (!/^(request|response)-[0-9a-f-]{36}\.(json|tmp)$/.test(name)) continue;
    const file = join(path, name);
    const stat = await lstat(file).catch(() => null);
    if (stat?.isFile() && Date.now() - stat.mtimeMs > 60000) await unlink(file).catch(() => {});
  }
  return { directory: path, marker };
}

async function atomicWrite(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = await open(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
    0o600,
  );
  try {
    await handle.writeFile(JSON.stringify(value), 'utf8');
    await handle.close();
    await rename(temporary, path);
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export class FileBridge {
  constructor(directory = DEFAULT_BRIDGE_DIR, { timeoutMs = 30000, pollMs = 50 } = {}) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > MAX_REQUEST_LIFETIME_MS) {
      throw new BridgeError(
        'INVALID_TIMEOUT',
        'Bridge timeout must be an integer between 50 and 30000 ms.',
      );
    }
    this.directory = directory;
    this.timeoutMs = timeoutMs;
    this.pollMs = pollMs;
  }

  async call(command, args = {}, signal) {
    try {
      validateArgs(command, args); // Independent of the UXP dispatcher.
    } catch (error) {
      // A stricter new marker policy must not hide a previously journaled outcome.
      // Base fields, UUID and bounded JSON were validated before this semantic error.
      if (!isLegacyMarkerValidation(command, error)) throw error;
      return this.recoverLegacyMarker(command, args, error);
    }
    if (signal?.aborted) throw new BridgeError('REQUEST_CANCELLED', 'The request was cancelled.');
    const { directory, marker } = await prepareBridge(this.directory);
    const request = {
      version: BRIDGE_VERSION,
      bridgeId: marker.bridgeId,
      id: randomUUID(),
      command,
      args,
      expiresAt: Date.now() + this.timeoutMs,
    };
    const requestPath = join(directory, `request-${request.id}.json`);
    const responsePath = join(directory, `response-${request.id}.json`);
    if (Buffer.byteLength(JSON.stringify(request)) > MAX_REQUEST_BYTES)
      throw new BridgeError('INVALID_REQUEST', 'Request exceeds the protocol size limit.');
    await atomicWrite(requestPath, request);
    const processedChecks = new Set();
    try {
      while (Date.now() < request.expiresAt) {
        if (signal?.aborted)
          throw new BridgeError('REQUEST_CANCELLED', 'The request was cancelled.');
        for (const name of (await readdir(directory))
          .filter((name) =>
            new RegExp(`^pathcheck-${request.id}-[1-9][0-9]{0,3}\\.json$`).test(name),
          )
          .slice(0, 32)) {
          if (processedChecks.has(name)) continue;
          const file = join(directory, name);
          let check;
          try {
            check = await readPrivateJson(file, 16384);
          } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
          }
          let proof;
          try {
            proof = { ok: true, ...(await authorizePath(check, request)) };
          } catch (error) {
            proof = {
              ok: false,
              error: {
                code: error.code ?? 'FILE_CHECK_FAILED',
                message:
                  error instanceof BridgeError
                    ? error.message
                    : 'The granted file could not be checked safely.',
              },
            };
          }
          await atomicWrite(join(directory, name.replace('pathcheck-', 'pathproof-')), {
            version: 1,
            bridgeId: marker.bridgeId,
            requestId: request.id,
            counter: check.counter,
            ...proof,
          });
          processedChecks.add(name);
        }
        try {
          const response = parseResponse(
            await readPrivateJson(responsePath, MAX_RESPONSE_BYTES),
            request,
          );
          if (!response.ok) throw new BridgeError(response.error.code, response.error.message, response.error.diagnostics);
          return response.result;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        await delay(this.pollMs, undefined, { signal }).catch((error) => {
          if (error.name === 'AbortError')
            throw new BridgeError('REQUEST_CANCELLED', 'The request was cancelled.');
          throw error;
        });
      }
      throw new BridgeError(
        'BRIDGE_TIMEOUT',
        'No UXP response. Open the Premiere MCP Bridge panel and check Launch. Connection is automatic; there is no bridge-folder selection or path setting.',
      );
    } catch (error) {
      if (
        args.operationId &&
        ['BRIDGE_TIMEOUT', 'REQUEST_CANCELLED', 'INVALID_RESPONSE'].includes(error.code)
      ) {
        throw new BridgeError(
          'OPERATION_OUTCOME_UNKNOWN',
          `Operation ${args.operationId} has no confirmed response. Recover using the same operationId and identical arguments; never retry under a new ID.`,
        );
      }
      throw error;
    } finally {
      const checks = (await readdir(directory).catch(() => []))
        .filter((name) =>
          new RegExp(`^path(check|proof)-${request.id}-[1-9][0-9]{0,3}\\.(json|tmp)$`).test(name),
        )
        .map((name) => join(directory, name));
      await Promise.all(
        [requestPath, responsePath, ...checks].map((path) => unlink(path).catch(() => {})),
      );
    }
  }

  async recoverLegacyMarker(command, args, validationError) {
    let directory, marker, receipt;
    try {
      directory = this.directory === DEFAULT_BRIDGE_DIR
        ? await discoverBridgeDirectory() : resolve(this.directory);
      assertPrivate(await lstat(directory), true);
      await checkAncestors(directory);
      marker = parseMarker(await readPrivateJson(join(directory, MARKER_FILE), 4096));
      receipt = await readPrivateJson(join(directory, `operation-${args.operationId}.json`), MAX_RESPONSE_BYTES);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'PLUGIN_NOT_LOADED'].includes(error.code)) throw validationError;
      throw error;
    }
    if (receipt.version !== 1 || receipt.bridgeId !== marker.bridgeId ||
        receipt.operationId !== args.operationId)
      throw new BridgeError('OPERATION_OUTCOME_UNKNOWN', 'The historical receipt identity could not be verified.');
    const stable = value => Array.isArray(value) ? value.map(stable)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
    if (receipt.payload !== JSON.stringify({ command, args: stable(args) }))
      throw new BridgeError('OPERATION_ID_CONFLICT', 'This operationId was used with different arguments.');
    if (receipt.state !== 'completed')
      throw new BridgeError('OPERATION_OUTCOME_UNKNOWN', 'The historical operation has no confirmed outcome. Do not retry under a new ID.');
    const request = { version: BRIDGE_VERSION, bridgeId: marker.bridgeId, id: randomUUID(), command, args,
      expiresAt: Date.now() + this.timeoutMs };
    const response = parseResponse({ ...receipt.outcome, version: BRIDGE_VERSION,
      bridgeId: marker.bridgeId, id: request.id }, request);
    if (!response.ok)
      throw new BridgeError(response.error.code, response.error.message, response.error.diagnostics);
    return { ...response.result, operationReplayed: true };
  }
}
