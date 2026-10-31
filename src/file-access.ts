import { BridgeError } from './bridge-protocol';

export interface FileAccessFolder {
  readonly name: string;
  readonly nativePath: string;
}

/** Inspect an existing session grant only; never prompt, enumerate or grant access. */
export function describeFileAccess(folder: FileAccessFolder | undefined, includePath = false): Record<string, unknown> {
  const result: Record<string, unknown> = {
    granted: !!folder,
    pathIncluded: !!folder && includePath,
    approvalRequiredOnFileRequest: !folder,
    validation: 'Session grant only; each file operation still validates its Entry and Node broker authorization.',
  };
  if (!folder) return result;
  const info: Record<string, unknown> = { name: folder.name.slice(0, 256) };
  if (includePath) {
    const path = folder.nativePath;
    if (typeof path !== 'string' || !path || path.length > 4096 || path.includes(String.fromCharCode(0)))
      throw new BridgeError('FILE_ACCESS_UNAVAILABLE', 'The current grant path could not be reported safely.');
    info.nativePath = path;
  }
  result.folder = info;
  return result;
}
