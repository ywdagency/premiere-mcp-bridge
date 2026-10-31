// Adobe Help is reference data. Parse HTML without executing scripts or loading assets.
import { parse } from 'parse5';
import { createHash } from 'node:crypto';

export const MANUAL_HOME = 'https://helpx.adobe.com/premiere/desktop.html';
const ORIGIN = 'https://helpx.adobe.com';
const PREFIX = '/premiere/desktop/';
const ignored = new Set(['script', 'style', 'noscript', 'svg', 'nav', 'header', 'footer', 'aside', 'button', 'form', 'iframe', 'template']);
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value ?? '';
const clean = value => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
function text(node) {
  if (ignored.has(node.tagName)) return '';
  if (['br', 'hr'].includes(node.tagName)) return ' ';
  if (node.nodeName === '#text') return node.value;
  return (node.childNodes ?? []).map(text).join('');
}
function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.childNodes ?? []) { const result = find(child, predicate); if (result) return result; }
  return null;
}
function walk(node, callback, parents = []) {
  callback(node, parents);
  for (const child of node.childNodes ?? []) walk(child, callback, [...parents, node]);
}
export function canonicalManualUrl(value) {
  try {
    const url = new URL(value, MANUAL_HOME);
    if (url.origin !== ORIGIN || url.username || url.password || url.search ||
        !/^\/premiere\/desktop\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.html$/.test(url.pathname)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function manualId(url) {
  const canonical = canonicalManualUrl(url);
  if (!canonical) throw new Error('Expected an official Premiere desktop article.');
  return 'manual:' + new URL(canonical).pathname.slice(PREFIX.length, -5);
}
export function buildManualCatalog(html, fetchedAt = new Date().toISOString()) {
  const document = parse(html);
  const toc = find(document, n => n.tagName === 'ul' && attr(n, 'class').split(/\s+/).includes('tocList'));
  if (!toc) throw new Error('Official Help table of contents was not found.');
  const articles = new Map();
  walk(toc, (node, parents) => {
    if (node.tagName !== 'a') return;
    const url = canonicalManualUrl(attr(node, 'href'));
    const title = clean(text(node));
    if (!url || !title || articles.has(url)) return;
    const topics = parents.filter(n => n.tagName === 'li').map(li => {
      const label = (li.childNodes ?? []).find(n => ['label', 'a', 'span'].includes(n.tagName));
      return label ? clean(text(label)) : '';
    }).filter(value => value && value !== title && value.length <= 180);
    const id = manualId(url);
    if (id.length > 256 || title.length > 256) throw new Error('Official article metadata exceeds the reference contract.');
    articles.set(url, { id, title, topics: [...new Set(topics)], url });
  });
  if (articles.size < 100) throw new Error('Official Help catalog is unexpectedly incomplete.');
  return {
    schemaVersion: 1,
    provenance: {
      publisher: 'Adobe', product: 'Premiere desktop', language: 'en', source: MANUAL_HOME,
      fetchedAt, sourceSha256: createHash('sha256').update(html).digest('hex'),
      coverage: 'Unique official Premiere desktop article links in the Help table of contents.',
      indexedFields: ['title', 'topics', 'url'],
      contentPolicy: 'Article navigation metadata only. Full article bodies are retrieved from Adobe on demand, not bundled.',
    },
    articles: [...articles.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')),
  };
}
function chunks(value, maximum = 1000) {
  const result = [];
  let remaining = clean(value);
  while (remaining.length > maximum) {
    let end = remaining.lastIndexOf(' ', maximum);
    if (end < maximum / 2) end = maximum;
    result.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}
export function parseManualArticle(html, url) {
  if (!canonicalManualUrl(url)) throw new Error('Invalid official article URL.');
  const document = parse(html);
  const root = find(document, n => attr(n, 'id') === 'helpxNext-article-right-rail') ?? find(document, n => n.tagName === 'article');
  if (!root) throw new Error('Official article content boundary was not found.');
  const headingNode = find(root, n => n.tagName === 'h1');
  const title = headingNode ? clean(text(headingNode)) : '';
  if (!title) throw new Error('Official article title was not found.');
  const meta = name => attr(find(document, n => n.tagName === 'meta' && attr(n, 'name') === name) ?? {}, 'content');
  const published = meta('publishExternalUrl');
  if (published && canonicalManualUrl(published) !== canonicalManualUrl(url)) throw new Error('Official article identity differs from its catalog URL.');
  const publishedAt = Number.isFinite(Date.parse(meta('publishDate'))) ? new Date(meta('publishDate')).toISOString() : null;
  const passages = [];
  let heading = title;
  const push = value => { for (const part of chunks(value)) passages.push({ heading, text: part }); };
  function collect(node) {
    if (ignored.has(node.tagName) || attr(node, 'hidden') !== '' || node.attrs?.some(a => a.name === 'hidden') || attr(node, 'aria-hidden') === 'true') return;
    const classes = attr(node, 'class');
    if (/(?:last-updated|socialmedia|feedback|related-articles|relatedlinks|morelikethis|pagenavigationarrows|pna-target)/i.test(classes)) return;
    if (/^h[1-6]$/.test(node.tagName ?? '')) { heading = clean(text(node)) || heading; return; }
    if (['p', 'pre', 'figcaption', 'dt', 'dd'].includes(node.tagName)) { push(text(node)); return; }
    if (node.tagName === 'tr') { push((node.childNodes ?? []).filter(n => ['td', 'th'].includes(n.tagName)).map(n => clean(text(n))).join(' | ')); return; }
    if (node.tagName === 'li') {
      // Keep a list item's label without repeating nested paragraphs or sublists.
      function ownText(n) {
        if (n !== node && ['p', 'pre', 'ul', 'ol', 'table'].includes(n.tagName) || ignored.has(n.tagName)) return '';
        if (n.nodeName === '#text') return n.value;
        if (['br', 'hr'].includes(n.tagName)) return ' ';
        return (n.childNodes ?? []).map(ownText).join('');
      }
      push(ownText(node));
      for (const child of node.childNodes ?? []) collect(child);
      return;
    }
    for (const child of node.childNodes ?? []) collect(child);
  }
  collect(root);
  if (!passages.length) throw new Error('No readable official article content was found.');
  return { title, publishedAt, passages };
}

export async function fetchManualHtml(url, fetcher = fetch) {
  if (url !== MANUAL_HOME && canonicalManualUrl(url) !== url) throw new Error('Only canonical official Premiere Help URLs are permitted.');
  const response = await fetcher(url, { method: 'GET', credentials: 'omit', redirect: 'error',
    headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(10000) });
  const maximum = 3 * 1024 * 1024;
  if (!response.ok || response.url && response.url !== url ||
      !/^text\/html\b/i.test(response.headers.get('content-type') ?? '') ||
      Number(response.headers.get('content-length')) > maximum) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Official Help response does not meet the article contract.');
  }
  if (!response.body) throw new Error('Official Help response is empty.');
  const decoder = new TextDecoder();
  let bytes = 0, html = '';
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) throw new Error('Official Help response is too large.');
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
