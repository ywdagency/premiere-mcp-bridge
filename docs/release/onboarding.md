# Clone-to-install release gate — historical 0.3.6 check

The subsequent 0.3.7 patch changes the plugin payload and needs its own installer/hash/activation checks. See [current status](candidate-0.3.8.md) and the [final fresh-checkout review](final-review-0.3.8.md).

This addition changes CLI/docs only, not the seven-file Premiere payload.
The reviewed 0.3.6 CCX SHA-256 remains
`037960f6dd13f6b3710992180c632f228a6aa6267de9b63711c34b7debdfa558`.
The installer validator compared its contents against this checkout's build.

The public route is matching tagged clone → npm ci → onboard --release
(validation only) → onboard --release --install → open installed panel/reconnect
client → doctor. It requires a published matching source/tag and exact CCX plus
checksum assets. Until publication use the candidate branch and reviewed local
files. Do not describe unavailable public assets as downloadable.

Stage the exact public asset filenames locally:

```sh
npm run release:assets -- --ccx /path/to/reviewed.ccx --sha256 REVIEWED_HASH
```

This verifies checksum/payload and writes a new
`artifacts/public-release/v0.3.6/` snapshot. It never creates a tag/release or
uploads files. The future GitHub release attaches both generated filenames.
Checksums detect mismatched bytes; they are not an Adobe signature or independent
proof of an uncompromised release channel.

Onboarding tests use synthetic archives and mocked installer/network calls.
They cover version pinning, missing/draft assets, hash/payload/entry rejection,
explicit install, client configuration, non-installing checks and privacy-safe
doctor results. Record clean-clone full tests and CI for the final commit.

Implementation 28341e6 passed npm ci and all 150 tests in a new clone whose path
contains spaces. Setup generated local read-only configuration without contacting
Premiere. These are source/fixture checks, separate from native behavior.

Before the owner's restart, the actual read-only doctor correctly rejected the
older 0.3.5 runtime and its six missing commands. After the owner restarted
Premiere and opened the panel, doctor passes: executing 0.3.6, all 38 host
commands present, project and active-sequence reads successful. Direct MCP also
exposes 41 tools. No reinstall, automatic restart or project mutation was issued
by this onboarding check. Doctor proves connection/version only. Bounded native
read/time checks are recorded in the [candidate report](native-check-0.3.6.md);
the [disposable native release plan](../tasks/final-build-0.3.6.md) remains open.

Keep private/unmerged until the owner chooses publication. Do not configure
another Adobe application or join bridge servers in this release.
