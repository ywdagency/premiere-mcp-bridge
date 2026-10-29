# Standalone Adobe bridge adapter contract

Status: version 1, `adobe-local-mcp-adapter`. Premiere implements this boundary;
After Effects adoption and cross-host verification must be reported separately.
The two products remain independent MCP servers. No combined server is installed,
no connection settings change, and neither adapter launches the other application.

## Node entrypoint

Each bridge provides `mcp/adapter.mjs` with a named `createAdapter(options = {})`
export. It returns `{ manifest, createServer() }`. `createServer()` returns a fresh,
unconnected MCP SDK server supporting the standard MCP transport interface
(`connect(transport)` and `close()`). The owner connects and closes each server.
Importing the module, creating an adapter, creating a server, MCP initialization,
and listing tools or reference resources must not discover/connect the host,
start polling, launch applications, edit content, or write IPC files. Offline API
reference reads remain available when the application is closed. Native tool calls
perform their own discovery and availability checks.

The manifest contains these required fields:

| Field | Premiere | After Effects target |
| --- | --- | --- |
| `contract` | `adobe-local-mcp-adapter` | same |
| `contractVersion` | `1` | same |
| `id` | `premiere` | `after-effects` |
| `toolPrefix` | `premiere_` | `ae_` |
| `resourceScheme` | `premiere` | `after-effects` |
| `serverName` | `premiere-mcp-bridge` | host-specific MCP server name |
| `serverVersion` | current package version | current package version |

Options are host-specific. Premiere accepts `bridge` (an injected existing
FileBridge-compatible transport) and `readOnly`; omitted values retain standalone
configuration defaults. `readOnly: true` omits write tools and cannot enable writes
in the native plugin. It is independent of the plugin's running/stopped state.
The standalone `mcp/server.mjs` CLI remains supported.

```js
import { createAdapter } from './mcp/adapter.mjs';

const adapter = createAdapter({ readOnly: true });
const server = adapter.createServer();
// The caller supplies an MCP transport; this does not launch Premiere.
await server.connect(transport);
// Close only this MCP connection. Do not stop the native host or other clients.
await server.close();
```

## Composition and routing

A future combined server can connect a separate MCP client to each adapter's
server with linked transports, or connect to the existing standalone processes
over stdio. It discovers and forwards standard tools, resources and resource
templates. No second public command schema or host-neutral API dispatcher is
needed. The current SDK version is an implementation detail; MCP negotiation
still applies. A contract-major mismatch must be rejected explicitly rather than
silently translated.

Every advertised tool name starts with its manifest's `toolPrefix`; resource and
template URI schemes match `resourceScheme`. Registration must reject duplicate
adapter IDs, tool names, resource URIs or templates before serving requests.
Prefix matching alone is not authorization: route only tools actually advertised
by that adapter. Unknown names/URIs fail closed, without fallback to another host.
Forward the original argument object, cancellation signal, content,
`structuredContent`, `isError`, annotations, schemas and reference provenance.
Preserve each server's instructions in the aggregate instructions with the host
identity attached; do not discard host-specific operating constraints.

One unavailable application must not prevent the other adapter or offline
references from being discovered. Native connection errors remain host-scoped.
No shared scheduler, process restart, bridge directory or Adobe plugin is required.

## State, safety and semantics

Native handles, project IDs, operation IDs, jobs, event subscriptions, cursors and
file grants belong to their originating adapter and native session. Even identical
strings from two adapters do not identify the same object. Never rewrite opaque
references, pass them between hosts, or infer cross-application asset identity.
Session reload invalidation remains host-specific. An adapter must not acquire
ownership of another client's work simply because a combined server routes calls.

Keep command-specific project preconditions, editing policy, source protection,
undo boundaries, backup requirements and file authorization. There is no common
editing toggle that can silently widen either host's access. No implicit saves,
application launches, UI changes or cross-host edits are introduced by composition.
No public arbitrary code, eval, shell or unrestricted native property traversal.

Writes retain their original caller-generated operation UUID and exact payload.
Timeout/cancellation/transport loss can leave the outcome uncertain; do not retry
under a new UUID, retry on a different adapter, or treat disconnect as rollback.
Recovery uses the original adapter's receipt semantics. Multi-host operations are
not atomic and require explicit separate outcomes. A job's queue acceptance is
not proof that native rendering finished; closing MCP does not cancel native jobs.

Host errors remain in their original MCP tool result. A future aggregator may
attach adapter identity outside that payload but must not turn uncertainty or
`isError` into success. Handles and user strings remain untrusted data.

Time units, native member IDs, parameter schemas, effects, expressions, transactions,
file grants and capabilities stay host-specific. Never convert Premiere integer
ticks to AE seconds, or rename sequence/comp parameters, as a hidden routing step.
Catalog coverage, executable policy, runtime probes and live verification remain
separate claims for each application.

## Compatibility checks

Each implementation must test MCP initialization/listing/offline references without
the native application, tool/resource namespace ownership, the read-only view,
native argument/result/error forwarding, independent server connections and
cancellation forwarding. Fixture tests do not establish live host support.
Premiere's adapter tests exercise two MCP client/server pairs and injected host
transports, without starting or modifying Premiere. Joint AE/Premiere composition
verification remains pending until both adapters implement this contract.
