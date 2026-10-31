# Contributing

Keep the bridge agent-independent and explicit. A command is a concrete Premiere operation, not an autonomous editing strategy. Prefer a small documented native API surface over arbitrary code execution.

## Add a command

Verify the exact method in [Adobe's live reference](docs/premiere-control-reference.md), record its minimum version and decide whether it changes host/UI state. Add a strict serializable contract to `src/command-catalog.ts`; the server derives its MCP schema and annotations from this catalog, and UXP validates it again.

Register a static handler in `src/dispatcher.ts` and implement host access in the appropriate narrow adapter. Reads must not select, activate, seek, save or mutate anything. Writes must preserve the project-ID check, running-bridge gate, operation receipts and applicable working-sequence/clip preconditions. Construct actions inside the synchronous locked transaction factory. Never use an async lock callback or let a native Action escape its scope.

Add focused tests for the behavior and meaningful failure modes: stale context, invalid arguments, unsupported host, authorization boundaries and uncertain outcomes. The control fixture enforces Adobe's action-creation lock requirement. Exercise real IPC and MCP SDK discovery for transport/contract changes. Extend documentation alongside the implementation.

Run `npm test`. Reload the built plugin and perform a separate live-host check on a disposable working copy. Record the actual Premiere/UXP versions and distinguish fixture coverage from live results. Do not call a tool supported in production based only on TypeScript compilation.

### Small example: a read-only sequence summary

This illustrative extension reuses the existing inspected sequence response; it adds no new native API. It is not a shipped tool. Add this entry inside `COMMANDS` in `src/command-catalog.ts`:

```ts
get_sequence_summary: {
  minVersion: '25.6',
  readOnly: true,
  fields: {},
  description: 'Read the active sequence identity and track counts without changing context.',
},
```

Add a static entry inside the dispatcher's `handlers` object:

```ts
get_sequence_summary: async () => {
  const snapshot = await inspectPremiere(host, 'get_active_sequence', {});
  const sequence = snapshot.activeSequence as Record<string, unknown> | null;
  return {
    readOnly: true,
    project: snapshot.project,
    summary: sequence ? {
      id: sequence.id,
      name: sequence.name,
      videoTrackCount: sequence.videoTrackCount,
      audioTrackCount: sequence.audioTrackCount,
    } : null,
  };
},
```

The server derives `premiere_get_sequence_summary` and its strict empty-argument schema from the catalog. The dispatcher independently validates its request. Test null context, valid summary, rejection of extra arguments and propagation of context-change errors through the existing fixture/stdio harness. Do not add a raw JavaScript escape hatch. For an actual new native method, first search/describe its exact catalog ID, verify the official source/minimum version, and implement the narrow host adapter rather than copying an assumed API name.

### Review workflow

Use a focused branch with a linked issue or clear acceptance criteria in the PR. Keep internal task checklists and execution logs local rather than adding one document per task to the repository. Keep a PR limited to one outcome, explain user-visible behavior and record verification plus remaining limits. The configured workflow, when enabled, runs on Ubuntu with Node.js 22 and 24 for pull requests and pushes to main. Respect the current repository Actions setting; configuration is not evidence of a completed run. Feature-branch pushes do not launch a duplicate workflow. Superseded runs for the same event and PR/ref are cancelled. Node setup has a two-minute limit within the existing five-minute job limit.

The manual `Bridge checks` workflow adds macOS only when `full_compatibility` is selected; the default manual run uses Ubuntu. This preserves the four-job Linux/macOS compatibility matrix for deliberate release checks while routine PR updates use two Linux jobs instead of eight duplicated jobs. Neither platform entry proves a live Premiere session. Path filters are intentionally omitted so documentation-only PRs still report checks when branch protection requires them. Prefer local `npm test`, `node scripts/stage-release.mjs` and `npm pack --dry-run --json` while Actions usage is restricted; do not push or dispatch a workflow under a local-only instruction.

Report security issues privately using [SECURITY.md](SECURITY.md). Bug reports and feature requests should use synthetic projects and sanitized evidence.

For release/documentation work, use [the release review checklist](docs/release/README.md). Do not perform native writes, exports or saves merely to validate wording. Record the exact tested commit/build before distributing a package.

## Repository hygiene

Do not commit media, transcripts, Premiere projects, local MCP configuration, absolute user paths, credentials, diagnostic dumps or operation receipts. `.gitignore` excludes personal artifacts and generated state; package files use an explicit allowlist. Check `npm pack --dry-run --json` before distributing. Never enable public repository visibility or publish a package as a side effect of a code change.

For a fork with a different installation identity, update `manifest.json` and `src/identity.ts` together and test automatic storage discovery. The current identity is stable to permit upgrades of existing development registrations. A new identity requires adding/loading the new manifest in UDT.

## Extend the catalog-backed native API

Read `docs/native-api.md`. Run `ADOBE_DOCS_REF=<Adobe commit> npm run docs:sync` to regenerate the licensed catalog and compact contracts (or `--cached` when the source cache already exists). Generated files are committed; the download cache is private build output. Parameter names/types and original Since labels come from the official Markdown, optionality from the matching installed SDK types. Keep compatibility corrections tied to an official source and preserve original labels. Do not infer availability from SDK types alone.

Review `src/api-policy.ts` for new native methods. An exact generated signature does not automatically justify granting mutation scope. Preserve actual ownership across getter/cast/union chains, particularly ProjectItem/media references from working clips. Construct Actions within synchronous locked transactions, use bridge-owned selection callbacks and typed event subscriptions, and retain operation receipts. Files require the current-request Node proof as well as UXP Entry checks; UXP lstat is not a link boundary. Add focused guard/IPC tests and record live tests separately in `data/live-verification.json` and the host report. Do not run global saves/preferences/cache/queue commands against an actively edited owner project just to claim coverage.

## Contribution license

For official user-guide metadata, run npm run manual:sync and review the title/topic/URL catalog and provenance. Cached refresh preserves the original retrieval time. Keep raw HTML/article bodies in ignored build/artifact folders. The manual source extends existing search/describe tools only; retain API defaults, tool counts, explicit reference-only status and URL/retrieval boundaries. See [manual reference](docs/manual-reference.md).

Bridge contributions are submitted under the repository's MIT license. Retain existing copyright/license notices and identify the source/license of any new third-party material. Adobe-derived catalog/contracts keep their separate Apache-2.0 notices. See [the open-source model](OPEN_SOURCE.md).

## Maintained files

Keep src/ for the UXP plugin, mcp/ for the local server, scripts/ for installation/build/developer commands, tests/ for reusable behavioral checks and examples/ for portable client examples. data/ contains the pinned Adobe reference, runtime verification and required third-party notices; src/generated/api-contracts.ts is the UXP execution allowlist, while data/adobe-api.json is the Node/offline reference. Both are consumed and must remain synchronized.

README.md is the product entrypoint, INSTALL.md the agent-led bootstrap, and docs/installation.md the detailed installation reference. Keep operating guidance in docs/user-guide.md and docs/agent-workflows.md. docs/release/ retains versioned real verification and one publication procedure, not superseded preparation diaries, private registry checkpoints or launch-copy drafts. Historical removed notes remain recoverable from Git. Do not remove a script or test simply because end users do not run it; inspect npm scripts, imports, CI and documented development workflows first.
