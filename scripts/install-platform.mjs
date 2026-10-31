import {access, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {win32} from 'node:path';
import {windowsEnvironment, windowsAbsolutePath} from '../mcp/platform-paths.mjs';

export const MAC_UPIA = '/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/macOS/UnifiedPluginInstallerAgent';
export function supportedPlatform(platform) {
  if (!['darwin', 'win32'].includes(platform))
    throw new Error('Installer onboarding supports macOS and Windows only. No system changes were made.');
}
export function installerCandidates({platform = process.platform, env = process.env} = {}) {
  supportedPlatform(platform);
  if (platform === 'darwin') return [MAC_UPIA];
  const common = ['CommonProgramW6432', 'CommonProgramFiles', 'CommonProgramFiles(x86)']
    .map(name => windowsEnvironment(env, name)).filter(Boolean);
  const program = windowsEnvironment(env, 'ProgramW6432') ?? windowsEnvironment(env, 'ProgramFiles');
  if (program && windowsAbsolutePath(program)) common.push(win32.join(program, 'Common Files'));
  const candidates = common.filter(windowsAbsolutePath).map(directory => win32.join(directory,
    'Adobe', 'Adobe Desktop Common', 'RemoteComponents', 'UPI', 'UnifiedPluginInstallerAgent',
    'UnifiedPluginInstallerAgent.exe'));
  const distinct = candidates.filter((path, index) => candidates.findIndex(other => other.toLowerCase() === path.toLowerCase()) === index);
  if (!distinct.length) throw new Error('Installer cannot resolve the Windows Adobe location. Check Creative Cloud Desktop and CommonProgramFiles.');
  return distinct;
}

export async function installReviewedPackage(snapshot, {
  platform = process.platform, env = process.env,
  inspect = lstat, accessible = access, execute = execFileSync,
} = {}) {
  for (const executable of installerCandidates({platform, env})) {
    try {
      const stat = await inspect(executable);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      await accessible(executable, constants.X_OK);
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) continue;
      throw error;
    }
    // Windows uses /install, not the macOS --install switch. No shell or PATH lookup.
    execute(executable, [platform === 'win32' ? '/install' : '--install', snapshot], {
      maxBuffer: 8 * 1024 * 1024, timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true,
    });
    return;
  }
  throw new Error('Installer could not find an executable Adobe UPIA. Install or repair Creative Cloud Desktop; no client configuration was changed.');
}
