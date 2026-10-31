// Developer-only catalog refresh. Never called at server startup or by host tools.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildManualCatalog, fetchManualHtml, MANUAL_HOME } from '../mcp/manual-html.mjs';

export async function syncManual({ cached = false } = {}) {
  const cache = new URL('../build/manual-cache/home.html', import.meta.url);
  const metadata = new URL('../build/manual-cache/provenance.json', import.meta.url);
  const html = cached ? await readFile(cache, 'utf8') : await fetchManualHtml(MANUAL_HOME);
  const fetchedAt = cached ? JSON.parse(await readFile(metadata, 'utf8')).fetchedAt : new Date().toISOString();
  if (typeof fetchedAt !== 'string' || !Number.isFinite(Date.parse(fetchedAt))) throw new Error('Missing original catalog retrieval date. Refresh online first.');
  const catalog = buildManualCatalog(html, fetchedAt);
  if (!cached) {
    await mkdir(new URL('../build/manual-cache/', import.meta.url), { recursive: true });
    await writeFile(cache, html); await writeFile(metadata, JSON.stringify({ fetchedAt }) + '\n');
  }
  await writeFile(new URL('../data/premiere-manual.json', import.meta.url), JSON.stringify(catalog, null, 2) + '\n');
  return { articles: catalog.articles.length, provenance: catalog.provenance };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).some(arg => arg !== '--cached') || process.argv.length > 3) throw new Error('Usage: node scripts/sync-premiere-manual.mjs [--cached]');
  console.log(JSON.stringify(await syncManual({ cached: process.argv.includes('--cached') }), null, 2));
}
