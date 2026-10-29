import { execFileSync } from 'node:child_process';
import { rmSync, renameSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

const run = (name, args) =>
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL(`../node_modules/${name}`, import.meta.url)), ...args],
    { cwd: root, stdio: 'inherit' },
  );
run('typescript/bin/tsc', ['-p', 'tsconfig.json']);
const { build } = await import('esbuild');
rmSync(new URL('../build/lib.next', import.meta.url), { recursive: true, force: true });
mkdirSync(new URL('../dist', import.meta.url), { recursive: true });
await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  target: 'es2020',
  external: ['premierepro', 'uxp'],
  outfile: 'dist/main.next.js',
  absWorkingDir: root,
});
await build({
  entryPoints: [
    'src/bridge-protocol.ts',
    'src/command-catalog.ts',
    'src/premiere-inspection.ts',
    'src/clip-inspection.ts',
    'src/uxp-bridge.ts',
    'src/premiere-control.ts',
    'src/dispatcher.ts',
    'src/runtime.ts',
    'src/auto-connection.ts',
    'src/api-policy.ts',
  ],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outdir: 'build/lib.next',
  outExtension: { '.js': '.cjs' },
  absWorkingDir: root,
});

rmSync(new URL('../build/lib', import.meta.url), { recursive: true, force: true });
renameSync(new URL('../build/lib.next', import.meta.url), new URL('../build/lib', import.meta.url));
renameSync(
  new URL('../dist/main.next.js', import.meta.url),
  new URL('../dist/main.js', import.meta.url),
);
