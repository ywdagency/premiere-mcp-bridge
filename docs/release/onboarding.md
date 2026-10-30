# Clone-to-install release gate

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

The actual read-only doctor observed running 0.3.5 while expecting 0.3.6, with six
commands missing. It correctly failed. No reinstall, restart or project mutation
was issued here. Owner-controlled Premiere restart/installed-panel activation
and the [native release plan](../tasks/final-build-0.3.6.md) remain required.
A future doctor pass proves connection/version only, not all API behavior.

Keep private/unmerged until the owner chooses publication. Do not configure
another Adobe application or join bridge servers in this release.
