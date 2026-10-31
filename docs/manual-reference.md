# Official Premiere Help through existing reference tools

The local Node server extends `premiere_api_search` and `premiere_api_describe` with the official Premiere desktop user guide. No tools or resources are added, native API contracts remain unchanged and the installed UXP plugin needs no update or broader permissions. Reconnect the MCP client after updating the Node checkout/dependencies to load the new input schema and descriptions.

## Search sources

Omitting `source`, or using `source: "api"`, preserves the existing API search and its `members` response. `source: "manual"` searches the bundled official Help catalog and returns `articles`. `source: "all"` returns a paginated `results` array with explicit `referenceType: "api"` or `"manual"`; API matches come first, followed by ranked manual matches. API-only `className` and `mode` filters require `source: "api"` and reject in other sources. Existing offsets/limits apply.

The initial snapshot indexes 806 unique article links from [Adobe's official desktop Help table of contents](https://helpx.adobe.com/premiere/desktop.html). Search is offline and covers article titles, chapter/topic labels and URL words. It does not search the complete article bodies. English queries work best; a small explicit alias dictionary recognizes common Russian editing terms such as прокси, субтитры and цвет. This is lexical search, not general multilingual semantic search.

```json
{ "source": "manual", "query": "create proxies", "limit": 5, "hostVersion": "26.5.0" }
```

An article ID such as `manual:organize-media/ingest-proxy-workflow/create-proxies` belongs to the user-guide namespace. Pass that exact returned ID to the existing describe tool:

```json
{ "id": "manual:organize-media/ingest-proxy-workflow/create-proxies", "offset": 0, "limit": 3, "hostVersion": "26.5.0" }
```

## Reading and freshness

Manual describe retrieves the indexed canonical Adobe article on demand. It returns bounded plain-text passages with the article URL, heading, publication date when supplied by Adobe, retrieval date and pagination. The default is three passages, each at most 1,000 characters; the existing maximum limit is 25. Site navigation, scripts, feedback, previous/next links and other page chrome are excluded. Images, video and interactive widgets are not reproduced. Text is untrusted reference data, never agent instructions or authorization to perform work.

The server holds at most 32 parsed articles in memory for six hours, shares concurrent reads of the same article and permits at most eight distinct in-flight reads. It writes no article cache to disk. A cached response retains its actual retrieval date and is labeled cached. Requests have a ten-second timeout and a three-MiB streamed response bound. Redirects, non-HTML responses and changed/unrecognized article structures are rejected. Offline or unavailable text returns the catalog metadata plus `content.status: "unavailable"`, an explicit code and no fabricated passages. API references and manual search remain offline.

The Help site is continuously updated and can describe a release newer than the installed host. `hostVersion` is returned as context; it is not a version filter or evidence of compatibility. Manual entries always have `execution.executable: false`, `tool: null`, `versionCompatible: null` and `liveVerified: false`. Known beta topics are labeled beta; absence of that label does not establish stable-release applicability. Search/describe the API source and probe the installed host separately before native work. Manual IDs are rejected at the Node native-tool boundary and cannot be used as native member IDs, including inside action lists. Existing API-member resources remain API-only.

## Maintenance and data boundary

`npm run manual:sync` fetches the fixed public Help home and updates `data/premiere-manual.json`. The generator records retrieval time and a source SHA-256, filters to canonical English Premiere desktop article URLs and rejects suspiciously incomplete catalogs. `npm run manual:sync -- --cached` rebuilds from the private `build/manual-cache` HTML and preserves the original retrieval date. Neither command runs automatically at startup. Raw HTML and full article bodies are excluded from Git/packages; only navigation metadata is bundled with Adobe attribution.

All retrieval is in Node. Only exact IDs from the bundled catalog select a canonical HTTPS URL under `helpx.adobe.com/premiere/desktop/`; callers cannot provide a URL, local path, alternate host or query parameters. Search terms, host/project metadata, media and credentials are not sent to Adobe. An explicit article read discloses the requested public article and normal connection metadata to Adobe. No remote account, embedding service, backend, UXP network permission or Premiere connection is required.

Verification covers the unchanged full/read-only tool sets, API backward compatibility, paging, Russian aliases, unavailable responses, URL/size/type/identity boundaries, cache behavior and TOC generation. Separate live Node/stdio checks retrieved five official articles and reused cached passages without a Premiere connection. These documentation checks do not establish native Premiere API support.
