# Candidate 0.3.7 — file-access diagnostics

This unpublished Premiere-only patch closes a first-run diagnostic gap found
during the 0.3.6 release checks. Automatic bridge discovery worked, and the host
restored a file-folder grant, but the agent could only see a boolean. Asking a
user to remember a hidden folder was not an adequate installation workflow.

`premiere_get_file_access` now inspects that existing session grant. It neither
opens a picker nor restores a panel setting, enumerates files or changes access.
Explicit `includePath: true` returns the private native root so an agent can
prepare or map local files to granted relative paths. Default output omits the
absolute path. Saved tokens are never returned. Normal UXP Entry and Node broker
checks still apply independently to each later file operation. No manifest
permissions or network access were added.

The source exposes 42 tools: 39 host commands and three offline references.
Inspection-only discovery exposes 19 tools. Both protocol boundaries reject
unknown fields and invalid includePath types. Bundled-plugin/real-filesystem and
real-MCP fixture checks cover absent/restored/revoked grants, default privacy,
opt-in path output and absence of picker/project access. These are fixtures,
separate from native installation and execution.

The earlier [0.3.6 native report](native-check-0.3.6.md) remains valid for its exact
build: activated runtime, doctor, protected context/clip reads and 16 exact-time
assertions. It is not evidence that this patch is installed. The fresh 0.3.7 CCX has seven allowlisted files, matches the built stage and
passes archive/path/secret checks. Its SHA-256 is
`dd2a86e98a3d6a98448788cd9b6593918db8224d2353c25b4d86edcbfcafd18d`.
All 153 automated tests pass; the 128-file source has no broken local Markdown
links, private paths or Gitleaks findings. Official installation and the actual
runtime/command check are still required. Do not reuse a 0.3.6 installer or report its successful activation
as a 0.3.7 pass.

After activation, use the new diagnostic to locate the existing granted folder
and create a unique synthetic subfolder. Continue isolated import/edit/backups,
durable recovery, deliberate synthetic-project saves/lifecycle and interchange
exports. Keep the owner's existing project read-only and retain verified backups.
No AE bridge work, global cache/preference changes or existing AME queue work is
part of this patch. Visual/audio quality still requires owner review.

The repository remains private, draft and unmerged. No tag, public installer
assets, automatic updater or public release is created by this preparation.
