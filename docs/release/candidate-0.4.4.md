# Preview 0.4.4 verification

This preview combines the explicit Project-panel organization
tools with all changes from the installed 0.4.3 selected-video-track authorization
build. Its original plugin bundle was compared byte-for-byte with the matching
0.4.3 source build before integration. The complete scoped authorization checks
and regression tests are retained; the source worktree supplying them is unchanged.

The plugin ID, manifest permissions, persistent-folder token key and operation
receipt format remain unchanged. The update never uninstalls or clears plugin
storage. Project-bin organization does not grant timeline or asset-content edit
rights and has no disk-media, relink, selection or save operations.

## Verification on 2026-10-31 (America/Vancouver)

All 232 automated tests pass, including the retained 0.4.3 scoped authorization
tests and new organization/IPC/MCP tests. The reviewed eight-file CCX has SHA-256
`bf578942cb1eb9de0e4e6677d860fe23940e27f5310bd3a662543d60500e1fe8`.
Adobe UPIA confirms installation and the installed payload matches the reviewed
source. All 752 backed-up plugin-storage files were byte-identical immediately
after installation. The owner subsequently restarted Premiere and reopened the
project; actual MCP capabilities confirm 0.4.4, both organization commands and
restored folder approval without a picker. Doctor passes with no missing commands.

Under the owner's explicit request, native organization created nine bins and
moved all 218 existing items in 14 undoable transactions. Complete recursive
readback verifies every original ID/name and intended parent, with exactly nine
new bins and no loose original items at the root. Original sequence items,
shared media, Dynamic Link items, rendered files, stills and generated elements
were organized without granting content-edit/deletion ownership. No disk-media,
relink/import, timeline-content, selection/activation or save command was invoked.

The 12 sequence identities/names and active-sequence metadata/playhead are
unchanged. All 135 video clips and 207 of 208 total active clips were compared
through exact positions, source ranges, media identities, speed/direction and
track metadata. One pre-existing audio clip read failure at global offset 207
remains unchanged; that clip's details could not be verified. File contents were
not hashed and picture/sound were not reviewed. The project is left unsaved.

Native bin rename, moving populated bins, Premiere Undo and another scoped
timeline edit were not exercised by this organization task. Their fixture
coverage and earlier evidence remain separate from the live checks above.
The matching local MCP configuration points to the combined source while
preserving its environment, access mode, timeouts and unrelated entries; already
connected clients need their normal MCP refresh to discover added tool schemas.
The public release binds this reviewed payload to the exact v0.4.4 source tag.
Raw project metadata, paths, source snapshots, storage backups and operation
receipts remain private.
