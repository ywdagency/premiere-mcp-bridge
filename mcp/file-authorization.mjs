import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve, relative, sep } from 'node:path';
import protocol from '../build/lib/bridge-protocol.cjs';
const { BridgeError, onlyKeys } = protocol;
export async function authorizePath(check, request) {
  onlyKeys(check, ['version', 'bridgeId', 'requestId', 'counter', 'root', 'relative', 'mode']);
  if (
    check.version !== 1 ||
    check.bridgeId !== request.bridgeId ||
    check.requestId !== request.id ||
    !Number.isSafeInteger(check.counter) ||
    check.counter < 1 ||
    check.counter > 1000
  )
    throw new BridgeError(
      'INVALID_FILE_CHECK',
      'File-check identity does not match the current request.',
    );
  if (
    typeof check.root !== 'string' ||
    check.root.length > 4096 ||
    !isAbsolute(check.root) ||
    typeof check.relative !== 'string' ||
    check.relative.length > 1024 ||
    !check.relative ||
    check.relative.includes('\\') ||
    (!(check.mode === 'directory' && check.relative === '.') &&
      check.relative
        .split('/')
        .some((p) => !p || p === '.' || p === '..' || p.includes(':') || p.includes('\0'))) ||
    !['read', 'write', 'directory'].includes(check.mode)
  )
    throw new BridgeError('INVALID_FILE_CHECK', 'Invalid granted file path.');
  const root = resolve(check.root);
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
    throw new BridgeError('LINK_NOT_ALLOWED', 'The granted root must be a real directory.');
  if (check.mode === 'directory' && check.relative === '.') return { nativePath: root };
  const realRoot = await realpath(root);
  const parts = check.relative.split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    const last = i === parts.length - 1;
    const info = await lstat(current).catch((error) => {
      if (last && check.mode === 'write' && error.code === 'ENOENT') return null;
      throw error;
    });
    if (!info) return { nativePath: current };
    if (info.isSymbolicLink())
      throw new BridgeError(
        'LINK_NOT_ALLOWED',
        'Symbolic links are not allowed in granted file operations.',
      );
    const canonical = await realpath(current),
      rel = relative(realRoot, canonical);
    if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel))
      throw new BridgeError('MEDIA_OUTSIDE_GRANT', 'Resolved file is outside the granted folder.');
    if (last && check.mode === 'write')
      throw new BridgeError('OUTPUT_EXISTS', 'Output already exists; overwriting is not allowed.');
    if (
      (!last && !info.isDirectory()) ||
      (last && (check.mode === 'directory' ? !info.isDirectory() : !info.isFile()))
    )
      throw new BridgeError('INVALID_FILE_TYPE', 'Granted entry has the wrong file/folder type.');
  }
  return { nativePath: current };
}
