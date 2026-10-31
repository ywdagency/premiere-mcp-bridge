# Licensing and third-party material

Premiere MCP Bridge's own code and documentation are licensed under [MIT](../LICENSE). The existing contributors copyright remains unchanged. YWD Agency attribution identifies the project; it does not replace third-party notices or imply an Adobe endorsement.

The pinned Adobe DOM reference in `data/adobe-api.json` and the generated execution contracts in `src/generated/api-contracts.ts` derive from Adobe's official reference. Keep [ADOBE-LICENSE.txt](../data/ADOBE-LICENSE.txt) and [ADOBE-COPYRIGHT.txt](../data/ADOBE-COPYRIGHT.txt) with redistributed copies. The generated files retain their provenance/notice information; the original copyright text is Adobe's upstream notice for that source material, not a statement that Adobe owns this entire bridge.

Catalog provenance is embedded in `data/adobe-api.json`. `npm run docs:sync` refreshes the catalog and contracts together; `ADOBE_DOCS_REF` can pin the upstream commit. Review source/license changes before accepting regenerated output. The compact contracts do not make every catalog member executable or compatible with the running host.

Node dependencies retain their own licenses in their installed distributions. The development Premiere SDK supplies types; it does not grant rights to Premiere software, user media, codecs or other Adobe assets. Dependency installation and the user's Adobe/AI-client accounts remain separate from the bridge's license. Do not bundle private media/projects, SDK account material or third-party assets into demo/release files.

The separate data/premiere-manual.json contains Adobe Help navigation metadata and canonical source links with Adobe attribution, not copied article bodies. User-guide text is retrieved from Adobe on demand; the DOM reference's Apache-2.0 notice does not relicense the Help website. The Node HTML parser parse5 is an MIT-licensed dependency and retains its own distribution license; it is not added to the UXP installer. Raw downloaded HTML stays in ignored developer artifacts/build caches.

The minimal plugin stage includes MIT and Adobe notices. A source/runtime package must include these same notices as well as the generated reference it distributes. See [release packaging](release/README.md) for the archive review process.
