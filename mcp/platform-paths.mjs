import {win32} from 'node:path';

export function windowsEnvironment(env, name) {
  const key = Object.keys(env).find(key => key.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : env[key];
}

// Reject current-drive-relative and device namespace paths; never expand shell text.
export function windowsAbsolutePath(value) {
  if (typeof value !== 'string' || value.includes('\0') || !win32.isAbsolute(value)) return false;
  if (/^[a-z]:[\\/]/i.test(value)) return true;
  return /^\\\\(?![?.][\\/])[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(value);
}

export function validGrantedRelativePath(value, mode, platform = process.platform) {
  if (typeof value !== 'string' || !value || value.length > 1024 || value.includes('\\')) return false;
  if (value === '.' && mode === 'directory') return true;
  return !value.split('/').some(part => !part || part === '.' || part === '..' || /[:\0]/.test(part) ||
    (platform === 'win32' && (/[<>"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) ||
      /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])$/i.test(part.split('.')[0].replace(/ +$/, '')))));
}
