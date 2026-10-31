# Open-source model

Premiere MCP Bridge's own code and documentation use the [MIT license](LICENSE). The repository is currently private while the preview is prepared; making the reviewed source public will make this an openly available MIT project. Merely making a repository public is not a substitute for its license. package.json keeps private:true to prevent accidental npm-registry publication; that flag does not restrict the MIT license or the planned GitHub source/CCX distribution.

MIT permits use, modification, redistribution and commercial use, including distributing modified versions under different terms. Redistributed copies must retain the MIT copyright/license notice. MIT does not require downstream modifications to be public and supplies no warranty. See the [MIT summary and text](https://choosealicense.com/licenses/mit/).

This permissive model fits the intended developer preview: other agents, editors and studios can inspect, fork and extend the bridge with a clear license. YWD Agency attribution identifies who built the project; it is not an Adobe endorsement or a promise of exclusive control over forks. Custom integration or support services can be offered separately; the code license does not promise those services or a response SLA.

## Third-party boundaries

Adobe-derived API reference/contracts retain their [Apache-2.0 license](data/ADOBE-LICENSE.txt) and [copyright notice](data/ADOBE-COPYRIGHT.txt). Node dependencies retain their own licenses. The MIT label does not relicense Adobe material, Premiere, codecs, user media or third-party SDKs. Adobe and AI-client accounts/licenses are separate. Read [third-party notices](docs/third-party-notices.md).

## Contributions and support

Use [CONTRIBUTING.md](CONTRIBUTING.md) for command contracts, tests, native verification and repository hygiene. Contributions to the bridge are submitted under its MIT license; retain upstream notices and identify the license/source of added third-party material. Contributors retain their copyrights.

Use the bug/feature templates for synthetic reproducible issues. Report vulnerabilities privately using [SECURITY.md](SECURITY.md). The preview includes an explicit [tested scope](docs/release/final-review-0.3.8.md); open source does not mean every Premiere API, client or platform is certified.
