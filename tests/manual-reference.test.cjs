const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const URL = 'https://helpx.adobe.com/premiere/desktop/organize-media/ingest-proxy-workflow/create-proxies.html';
const ID = 'manual:organize-media/ingest-proxy-workflow/create-proxies';
const catalog = JSON.parse(readFileSync(resolve(__dirname, '../data/premiere-manual.json')));
const html = (paragraphs = ['Fixture introduction.', 'Fixture procedure.'], url = URL) => `<!doctype html><html><head>
  <meta name="publishDate" content="2026-01-07T12:00:00Z"><meta name="publishExternalUrl" content="${url}"></head><body>
  <nav>OUTSIDE_NAVIGATION</nav><main><div id="helpxNext-article-right-rail"><h1>Fixture article</h1>
  <div class="last-updated">OUTSIDE_DATE</div><script>NEVER_EXECUTE_SCRIPT</script>
  <h2>Fixture section</h2>${paragraphs.map(p => `<p>${p}</p>`).join('')}
  <p hidden>HIDDEN_BODY</p><aside>OUTSIDE_ASIDE</aside><div class="socialmediashare"><p>OUTSIDE_SOCIAL</p></div>
  </div></main><footer>OUTSIDE_FOOTER</footer></body></html>`;
const response = (body = html(), options = {}) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...options });
async function fixture(options = {}) {
  const { createManualReference } = await import('../mcp/manual.mjs');
  let time = Date.parse('2026-10-31T08:00:00Z'), calls = 0;
  const reference = createManualReference({ catalog: options.catalog ?? catalog, now: () => time,
    fetcher: async (url, init) => {
      calls++; assert.ok(catalog.articles.some(a => a.url === url) || options.catalog?.articles.some(a => a.url === url));
      assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error');
      assert.equal('body' in init, false); assert.equal(new globalThis.URL(url).search, ''); assert.ok(init.signal);
      return options.fetcher ? options.fetcher(url, init) : response(html(undefined, url));
    } });
  return { reference, calls: () => calls, advance(ms) { time += ms; } };
}

test('bundled catalog is complete navigation metadata with stable IDs, citations and no article bodies', async () => {
  const { canonicalManualUrl, manualId } = await import('../mcp/manual-html.mjs');
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(catalog.articles.length >= 800);
  assert.equal(new Set(catalog.articles.map(a => a.id)).size, catalog.articles.length);
  assert.match(catalog.provenance.sourceSha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(Date.parse(catalog.provenance.fetchedAt)));
  assert.deepEqual(catalog.provenance.indexedFields, ['title', 'topics', 'url']);
  for (const article of catalog.articles) {
    assert.equal(canonicalManualUrl(article.url), article.url);
    assert.equal(manualId(article.url), article.id);
    assert.deepEqual(Object.keys(article).sort(), ['id', 'title', 'topics', 'url']);
    assert.ok(article.id.length <= 256);
  }
  const proxy = catalog.articles.find(a => a.id === ID);
  assert.equal(proxy.url, URL); assert.equal(proxy.title, 'Create proxies');
});

test('offline search ranks relevant articles, recognizes common Russian terms and keeps manual execution unavailable', async () => {
  const f = await fixture();
  for (const query of ['create proxies', 'как создать прокси']) {
    const result = f.reference.search({ query, limit: 3, hostVersion: '26.5.0' });
    assert.equal(result.source, 'manual'); assert.equal(result.articles[0].id, ID);
    assert.ok(result.articles.every(a => a.referenceType === 'manual' && a.execution.executable === false && a.execution.tool === null));
    assert.ok(result.articles.every(a => a.execution.versionCompatible === null && a.versionContext.hostVersion === '26.5.0'));
  }
  for (const [query, title] of [['color management', /color management/i], ['субтитры', /caption/i], ['lumetri', /lumetri/i]])
    assert.match(f.reference.search({ query, limit: 1 }).articles[0].title, title);
  assert.equal(f.reference.search({ query: 'unfindablezzzzzzzzzz' }).page.total, 0);
  const one = f.reference.search({ query: 'proxy', limit: 2 });
  const two = f.reference.search({ query: 'proxy', limit: 2, offset: one.page.nextOffset });
  assert.ok(one.page.total > 2); assert.ok(!two.articles.some(a => one.articles.some(b => a.id === b.id)));
  assert.equal(f.calls(), 0, 'Search cannot contact Adobe or Premiere');
});

test('article parsing excludes site chrome/scripts, preserves useful text, tables and lists, and chunks long paragraphs', async () => {
  const { parseManualArticle } = await import('../mcp/manual-html.mjs');
  const input = html(['A <strong>bold</strong> step &amp; another action.', 'Line one<br>Line two', 'word '.repeat(600)]).replace('</h2>', '</h2><ul><li>List fixture</li><li>Parent label<ul><li>Child fixture</li></ul></li></ul><table><tr><th>Item</th><th>Value</th></tr><tr><td>Fixture</td><td>7</td></tr></table>');
  const value = parseManualArticle(input, URL);
  assert.equal(value.title, 'Fixture article'); assert.equal(value.publishedAt, '2026-01-07T12:00:00.000Z');
  const text = value.passages.map(p => p.text).join('\n');
  assert.match(text, /A bold step & another action/); assert.match(text, /List fixture/); assert.match(text, /Fixture \| 7/);
  assert.match(text, /Line one Line two/); assert.equal(text.match(/Parent label/g).length, 1); assert.equal(text.match(/Child fixture/g).length, 1);
  assert.doesNotMatch(text, /OUTSIDE_|HIDDEN_|NEVER_EXECUTE/);
  assert.ok(value.passages.every(p => p.text.length <= 1000));
  assert.throws(() => parseManualArticle('<main><h1>Access challenge</h1><p>Not an article</p></main>', URL));
  assert.throws(() => parseManualArticle(html(undefined, URL.replace('create-proxies', 'different')), URL));
});

test('describe retrieves the exact article, pages text, cites Adobe, and caches repeated/concurrent reads without host support claims', async () => {
  const f = await fixture({ fetcher: () => response(html(Array.from({ length: 7 }, (_, i) => `Fixture paragraph ${i}.`))) });
  const [one, shared] = await Promise.all([f.reference.describe({ id: ID, limit: 2, hostVersion: '26.5.0' }), f.reference.describe({ id: ID, limit: 2 })]);
  assert.equal(f.calls(), 1); assert.equal(one.content.status, 'available'); assert.equal(shared.content.status, 'available');
  assert.equal(one.page.total, 7); assert.equal(one.page.nextOffset, 2);
  assert.equal(one.content.passages[0].citation, URL); assert.equal(one.content.passages[0].heading, 'Fixture section');
  assert.equal(one.execution.executable, false); assert.equal(one.execution.versionCompatible, null);
  const two = await f.reference.describe({ id: ID, offset: 2, limit: 2 });
  assert.equal(two.content.cached, true); assert.equal(two.content.retrievedAt, one.content.retrievedAt);
  assert.equal(two.content.passages[0].index, 2); assert.equal(f.calls(), 1);
  assert.equal((await f.reference.describe({ id: ID, offset: 100 })).content.passages.length, 0);
  f.advance(6 * 60 * 60 * 1000); await f.reference.describe({ id: ID }); assert.equal(f.calls(), 2);
  f.advance(-1); await f.reference.describe({ id: ID }); assert.equal(f.calls(), 3, 'Clock rollback invalidates future cached text');
});

test('unavailable/challenged/changed articles retain metadata with an explicit unavailable status and never fabricated text', async () => {
  const cases = [async () => { throw new Error('private error must not escape'); },
    () => response('', { status: 404 }), () => response('{}', { headers: { 'content-type': 'application/json' } }),
    () => response('<main>Challenge page</main>'), () => response(html(undefined, URL.replace('create-proxies', 'changed')))];
  for (const fetcher of cases) {
    const f = await fixture({ fetcher }); const result = await f.reference.describe({ id: ID });
    assert.equal(result.url, URL); assert.equal(result.content.status, 'unavailable');
    assert.equal(result.content.code, 'MANUAL_CONTENT_UNAVAILABLE'); assert.deepEqual(result.content.passages, []);
    assert.equal(result.page.total, null); assert.doesNotMatch(JSON.stringify(result), /private error/);
  }
});

test('only known official catalog IDs can cause requests; arbitrary URLs, traversal and polluted catalog fields reject', async () => {
  const { createManualReference } = await import('../mcp/manual.mjs');
  const { canonicalManualUrl, fetchManualHtml } = await import('../mcp/manual-html.mjs');
  const f = await fixture();
  for (const id of ['manual:../../secret', 'manual:https://evil.test', 'https://helpx.adobe.com/premiere/desktop/anything.html', 'manual:constructor', 'manual:unknown'])
    await assert.rejects(f.reference.describe({ id }));
  assert.equal(f.calls(), 0);
  for (const url of ['http://helpx.adobe.com/premiere/desktop/a.html', 'https://helpx.adobe.com.evil.test/premiere/desktop/a.html',
    'https://user@helpx.adobe.com/premiere/desktop/a.html', 'https://helpx.adobe.com/premiere/desktop/a.html?q=secret',
    'https://helpx.adobe.com/premiere/desktop/%2e%2e/a.html', 'file:///private/secret', 'https://helpx.adobe.com/premiere/mobile/a.html']) {
    assert.equal(canonicalManualUrl(url), null);
    await assert.rejects(fetchManualHtml(url, () => assert.fail('Invalid URLs must reject before fetch')));
  }
  const article = catalog.articles[0];
  for (const changed of [{ ...article, url: 'https://evil.test' }, { ...article, id: 'manual:unknown' }, { ...article, body: 'Do not bundle full article text' }])
    assert.throws(() => createManualReference({ catalog: { ...catalog, articles: [changed] } }));
  assert.throws(() => createManualReference({ catalog: { ...catalog, articles: [article, article] } }));
});

test('bounded fetch cancels oversized/incorrect responses and does not follow redirects', async () => {
  const { fetchManualHtml } = await import('../mcp/manual-html.mjs');
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(3 * 1024 * 1024 + 1)); }, cancel() { cancelled = true; } });
  await assert.rejects(fetchManualHtml(URL, async () => new Response(body, { headers: { 'content-type': 'text/html' } })));
  assert.equal(cancelled, true);
  const redirect = response(); Object.defineProperty(redirect, 'url', { value: 'https://evil.test' });
  await assert.rejects(fetchManualHtml(URL, async () => redirect));
  await assert.rejects(fetchManualHtml(URL, async () => response('', { headers: { 'content-type': 'text/html', 'content-length': '99999999' } })));
});

test('catalog generator uses the official TOC, filters non-desktop links, de-duplicates and retains source retrieval date', async () => {
  const { buildManualCatalog, MANUAL_HOME } = await import('../mcp/manual-html.mjs');
  const links = Array.from({ length: 101 }, (_, i) => `<li><a href="/premiere/desktop/get-started/topic-${i}.html">Fixture ${i}</a></li>`).join('');
  const input = `<ul class="tocList"><li><label>Get started</label><ul>${links}<li><a href="/premiere/mobile/a.html">Mobile</a></li><li><a href="/premiere/desktop/get-started/topic-0.html">Duplicate</a></li></ul></li></ul><p>BODY_NOT_BUNDLED</p>`;
  const value = buildManualCatalog(input, '2026-10-31T08:00:00.000Z');
  assert.equal(value.articles.length, 101); assert.equal(value.provenance.source, MANUAL_HOME);
  assert.equal(value.provenance.fetchedAt, '2026-10-31T08:00:00.000Z');
  assert.deepEqual(value.articles[0].topics, ['Get started']); assert.doesNotMatch(JSON.stringify(value), /BODY_NOT_BUNDLED|Mobile|Duplicate/);
  assert.throws(() => buildManualCatalog('<main>Challenge</main>'));
  assert.throws(() => buildManualCatalog('<ul class="tocList"></ul>'));
});

test('existing MCP tools retain exact names/count and API defaults; manual/all routing and strict contracts stay Node-only', async t => {
  const { Client, InMemoryTransport } = await import('@modelcontextprotocol/client');
  const { createAdapter } = await import('../mcp/adapter.mjs');
  const { COMMAND_LIST } = require('../build/lib/command-catalog.cjs');
  const { search, describe } = await import('../mcp/reference.mjs');
  assert.deepEqual(search({ query: 'keyframe', className: 'ComponentParam' }), search({ source: 'api', query: 'keyframe', className: 'ComponentParam' }));
  assert.equal(describe({ id: 'SequenceEditor#createRemoveItemsAction' }).execution.tool, 'premiere_api_apply_actions');
  const mixed = search({ source: 'all', query: 'proxy', limit: 30 });
  assert.ok(mixed.results.some(r => r.referenceType === 'api')); assert.ok(mixed.results.some(r => r.referenceType === 'manual'));
  let hostCalls = 0;
  for (const readOnly of [false, true]) {
    const server = createAdapter({ readOnly, bridge: { call() { hostCalls++; assert.fail('Reference tools must not use Premiere'); } } }).createServer();
    const client = new Client({ name: 'manual-reference-fixture', version: '1' });
    t.after(async () => { await client.close(); await server.close(); });
    const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
    const tools = (await client.listTools()).tools;
    const expected = [...COMMAND_LIST.filter(c => !readOnly || c.readOnly).map(c => 'premiere_' + c.command), 'premiere_api_search', 'premiere_api_describe', 'premiere_api_coverage'];
    assert.deepEqual(tools.map(tool => tool.name).sort(), expected.sort());
    assert.equal(tools.find(tool => tool.name === 'premiere_api_search').annotations.openWorldHint, false);
    assert.equal(tools.find(tool => tool.name === 'premiere_api_describe').annotations.openWorldHint, true);
    const found = await client.callTool({ name: 'premiere_api_search', arguments: { source: 'manual', query: 'create proxies', limit: 2 } });
    assert.equal(found.structuredContent.articles[0].id, ID);
    for (const args of [{ source: 'unknown' }, { source: 'manual', className: 'Sequence' }, { source: 'all', mode: 'action' },
      { source: 'manual', url: URL }, { source: 'manual', limit: 31 }, { source: 'manual', offset: -1 }])
      assert.equal((await client.callTool({ name: 'premiere_api_search', arguments: args })).isError, true);
    assert.equal((await client.callTool({ name: 'premiere_api_describe', arguments: { id: 'manual:unknown' } })).isError, true);
    const blocked = await client.callTool({ name: 'premiere_api_read', arguments: { memberId: ID } });
    assert.equal(blocked.isError, true); assert.equal(blocked.structuredContent.error.code, 'REFERENCE_ONLY');
    if (!readOnly) {
      const operation = { projectId: 'fixture-project', operationId: require('node:crypto').randomUUID() };
      for (const [name, args] of [
        ['premiere_api_construct', { memberId: ID }],
        ['premiere_api_mutate', { ...operation, memberId: ID }],
        ['premiere_api_start_job', { ...operation, memberId: ID }],
        ['premiere_api_apply_actions', { ...operation, actions: [{ memberId: ID, parameters: [] }] }],
      ]) {
        const result = await client.callTool({ name, arguments: args });
        assert.equal(result.isError, true); assert.equal(result.structuredContent.error.code, 'REFERENCE_ONLY');
      }
    }
    await assert.rejects(client.readResource({ uri: 'premiere://api/member/' + encodeURIComponent(ID) }));
  }
  assert.equal(hostCalls, 0);
});
