# Local architecture and recovery

The Node MCP server and UXP plugin exchange JSON in a private `mcp-bridge` child of the plugin's own `getDataFolder()` storage. Adobe documents this storage as available without user interaction. No picker or network permission is needed for connecting the bridge.

## Automatic discovery

The plugin writes a small `mcp-host.json` heartbeat into its own data storage. Node examines only Premiere host-version folders, known installation channels and the exact manifest plugin ID under Adobe's PluginsStorage tree. It ignores stale heartbeats and refuses ambiguous active hosts. Discovery's directory convention is an implementation adapter, not an Adobe guarantee about future filesystem layout; update/test this adapter if Adobe changes storage placement.

On macOS the inspected root is `~/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO`; Windows uses `%APPDATA%/Adobe/UXP/PluginsStorage/PPRO` and remains unverified in a real host. `PREMIERE_MCP_HOST_VERSION` resolves multiple major host versions. The optional `PREMIERE_MCP_BRIDGE_DIR` is an advanced server/test override, not a user-facing folder workflow.

Premiere can instantiate a development plugin lazily. Open its panel or invoke its Launch command once after loading. Background reads then work with the panel closed. A manifest change requires Unload/Load in UDT; ordinary code changes can use Reload. The installation/entrypoint IDs are retained for existing development registrations; the product is Premiere MCP Bridge.

## Protocol

The marker is `{version:1,name:"premiere-mcp-bridge",bridgeId:"UUID-v4"}`. Requests have `version`, `bridgeId`, UUID v4 `id`, registered `command`, validated `args`, and `expiresAt`. Requests expire within 30 seconds. Responses match version/bridge/request identity and contain either `{ok:true,result}` or `{ok:false,error:{code,message}}`.

Requests are limited to 16384 UTF-8 bytes and responses to 65536 bytes. Node publishes requests through an atomic rename; UXP writes responses to a temporary file before renaming. Private folder permissions and owner/type checks protect IPC. Adobe's group-writable storage directories are acceptable only when enclosed by an owner-only ancestor; the bridge directory itself remains owner-only. No permissions on Adobe's shared directories are weakened.

Import errors additionally carry optional `error.diagnostics`: `phase` (`preparation`, `path_validation`, `native_import`, `result_registration`), `step`, `nativeCallStarted`, and `originalError` (`type`, `code`, `message`). Exception type/code/message are limited to 64/128/512 characters, control characters become spaces, numeric codes are retained, and stacks/native objects are omitted. Both protocol endpoints validate these fields. They remain untrusted diagnostic text and may contain host-provided file details; keep receipts private.

An unexpected exception before `project.importFiles()` yields `IMPORT_PREPARATION_FAILED`; existing guard codes are preserved. Once that native call starts, unexpected exceptions remain `OPERATION_OUTCOME_UNKNOWN`, including failures registering an otherwise successful import. `nativeCallStarted` describes entry to the import method, not success or rollback. Registration records only uniquely matched new media assets; failure reading a candidate's media path is reported rather than silently discarded. Unsupported non-clip casts are still skipped without granting ownership. This adds no native API or permission; `Project#importFiles` retains Adobe's 25.6 minimum and existing arguments.

## Write journal

Before executing a write, UXP creates `operation-<UUID>.json` with a canonical command/argument payload and a started state. It records a completed success/error outcome atomically afterward. Matching completed receipts are replayed, mismatched payloads reject, and incomplete receipts block automatic re-execution. Receipts are not deleted by stale request cleanup.

A cancellation, lost response, expired wait or plugin crash cannot promise rollback. The server returns an uncertain outcome for writes when delivery/execution cannot be established. Reuse the same operation ID and arguments for recovery; never blindly assign a new ID. A same-ID result describes the original operation, not a fresh inspection of the current project.

Completed import failures retain diagnostics in the receipt and return the identical error details through Node and MCP on recovery, without another native call. Historical receipts lacking diagnostics are returned unchanged; missing original exceptions cannot be recovered by updating the code. A lost/incomplete receipt or transport timeout still cannot establish whether the native call started.

## Boundaries

One plugin pump serializes commands. The protocol is intended for a trusted local user, not hostile same-user processes or remote/multi-tenant access. The bridge UUID routes traffic; it is not a network authentication secret. Names and paths returned by Premiere remain untrusted data for the AI agent.

Read snapshots and write preconditions are optimistic. Native async getters cannot all run inside a synchronous project-lock callback. Keep Premiere idle while an agent operates; simultaneous manual changes can still race a read. Project locks and synchronous transaction callbacks protect action creation/execution, not an entire AI planning conversation.

See [security](../SECURITY.md), [the command reference](commands.md) and [live compatibility evidence](adobe-uxp-compatibility.md).

## Typed native object adapter and file broker

The generated Adobe execution contracts are a second allowlist beneath the static command dispatcher. Opaque typed handles carry project/sequence/asset ownership and observed clip boundaries. A working clip's shared media item never inherits timeline edit permission. Native drafts are separate from project state. Action plans are recursively canonicalized in durable receipts; replay resolves a saved outcome before trying old handles.

Path-dependent calls use private `pathcheck-<request-id>-<counter>.json` challenges and matched `pathproof-...json` responses. The UXP side supplies only its actual picker-granted root (or plugin-owned folder in the isolated verification harness). The Node caller services challenges while awaiting the parent response, verifies identity/strict fields and uses real lstat/realpath checks. No unscoped filesystem endpoint or new manifest permission is added. No native file operation starts without a current proof. Challenges remain stable until UXP consumes their proof, avoiding races in UXP's directory enumeration. Both peers clean only files for that request. Native path APIs still have a filesystem check/use interval; this is a trusted-local-user bridge, not a sandbox against a hostile same-user process.

Async jobs return session job IDs and pollable native Promise outcomes. A successful EncoderManager Promise can mean queue acceptance; do not confuse it with render-complete events. Event subscriptions own their callbacks and retain a bounded scalar-only ring. Actual plugin unload/reload loses these registries and does not cancel Premiere/AME work. Panel transport Reload retains them. The complete catalog, policy and live verification are independently discoverable; see [native API](native-api.md).
