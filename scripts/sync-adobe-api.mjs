import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { generateReference } from './adobe-reference.mjs';
const cache = 'build/adobe-reference';
await mkdir(cache, { recursive: true });
if (!process.argv.includes('--cached')) {
  const ref = process.env.ADOBE_DOCS_REF ?? 'main';
  const headers = { 'User-Agent': 'Premiere-MCP-Bridge' };
  async function json(url) {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`Adobe documentation fetch failed: ${r.status}`);
    return r.json();
  }
  const commit = await json(
    `https://api.github.com/repos/AdobeDocs/uxp-premiere-pro/commits/${encodeURIComponent(ref)}`,
  );
  const tree = await json(
    `https://api.github.com/repos/AdobeDocs/uxp-premiere-pro/git/trees/${commit.sha}?recursive=1`,
  );
  const paths = tree.tree
    .filter(
      (n) =>
        n.type === 'blob' &&
        n.path.startsWith('src/pages/ppro-reference/') &&
        n.path.endsWith('.md'),
    )
    .map((n) => n.path);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (cursor < paths.length) {
        const path = paths[cursor++];
        const r = await fetch(
          `https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/${commit.sha}/${path}`,
        );
        if (!r.ok) throw new Error(`${r.status}: ${path}`);
        const target = join(cache, 'pages', path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, await r.text());
      }
    }),
  );
  for (const path of ['LICENSE', 'COPYRIGHT']) {
    const r = await fetch(
      `https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/${commit.sha}/${path}`,
    );
    if (!r.ok) throw new Error(`Missing Adobe ${path}`);
    await writeFile(join(cache, path), await r.text());
  }
  await writeFile(
    join(cache, 'provenance.json'),
    JSON.stringify({
      repository: 'https://github.com/AdobeDocs/uxp-premiere-pro',
      commit: commit.sha,
      tree: commit.commit.tree.sha,
      fetchedAt: new Date().toISOString(),
    }),
  );
}
await generateReference(cache);
