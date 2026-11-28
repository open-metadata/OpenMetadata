# UI installs run on a committed Yarn 4 release and take the registry from config, never from yarn.lock

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Shailesh Parmar
- **Guard:** `yarn --version` inside any UI project prints the `yarnPath` release; `yarn install --immutable` fails on a lockfile Yarn 4 did not write; reviewer for the settings below
- **Related:** [openmetadata-collate #7499](https://github.com/open-metadata/openmetadata-collate/issues/7499), ADR:2026-10-16-ci-yarn-installs-retry-transient-registry-errors, ADR:2026-10-22-ui-nvmrc-is-the-one-node-pin

## Context

Yarn 1 downloads every locked package from the absolute `resolved` URL written into `yarn.lock`
and ignores the configured registry for it. All lockfiles pointed at `registry.yarnpkg.com`, so a
CI job that set a mirror as its registry still fetched from the public registry, and failed with it
whenever that registry returned 5xx. No Yarn 1 setting, `package.json` field or `preinstall` hook
changes this; the only workaround was rewriting the lockfile in CI.

## Decision

Both yarn projects in this repository (`openmetadata-ui` and `openmetadata-ui-core-components`) run
Yarn 4, configured once in the root `.yarnrc.yml`:

- `yarnPath` names a release committed under `.yarn/releases/`. Any Yarn >= 1.22 on `PATH`,
  including the 1.22.18 frontend-maven-plugin installs and the one in `node:*` images, hands off
  to it, so no Corepack download or second registry is involved in starting Yarn.
- The Yarn 4 lockfile stores no registry host. The registry comes from `npmRegistryServer`:
  unset locally (public registry), and set by CI through `YARN_NPM_REGISTRY_SERVER` to point
  every install at a mirror.
- `nodeLinker: node-modules` keeps the `node_modules` layout Jest, Vite and the `link:`
  dependency on core-components rely on.
- `enableScripts: true` and `npmMinimalAgeGate: 0` keep Yarn 1 behaviour, which Yarn 4.18
  tightened by default. Tightening either is a separate decision, not part of this migration.
- `enableHardenedMode` keeps Yarn's default: on for GitHub Actions pull-request runs in a public
  repository, off elsewhere. Those installs re-resolve the lockfile against the registry
  (`--check-resolutions --refresh-lockfile`), so a fork PR cannot slip a tampered `resolution` or
  checksum past review.
- `.yarn/plugins/engines-node.cjs` keeps `yarn install` failing on a Node older than
  `engines.node`, which Yarn 4 no longer checks itself (ADR:2026-10-22-ui-nvmrc-is-the-one-node-pin).

A `resolutions` key names its parent directly (`eslint-plugin-sonarjs/minimatch`), never with a
`**/` prefix: Yarn 4 drops glob keys with only a YN0057 warning, so the pin silently stops applying.

Installs use Yarn 4 flags: `--immutable` replaces `--frozen-lockfile`, `--mode=skip-build`
replaces `--ignore-scripts`, and `YARN_HTTP_TIMEOUT` / `YARN_GLOBAL_FOLDER` replace
`--network-timeout` / `--cache-folder` (the global cache ignores `cacheFolder`), and
`yarn --silent <script>` becomes `yarn <script>`. Yarn 4 fails on `--ignore-scripts`, `--cache-folder`,
`yarn --silent <script>` and `yarn cache dir`; it accepts `--frozen-lockfile` with a deprecation
warning, and silently ignores `--network-timeout`, so a leftover one quietly drops to the default
timeout.
An install whose project directory is read-only (the sandboxed CI container) also sets
`YARN_INSTALL_STATE_PATH` to a writable path, passed with `docker --env` like the others, because
Yarn 4 writes `.yarn/install-state.gz` into the project.

`dependenciesMeta` sets `built: false` for `tree-sitter` and `tree-sitter-json`. Nothing in the UI
loads them, they come in through swagger's `apidom` parser adapters, and building either from
source needs a C toolchain. On linux arm64 neither has a working prebuild: `tree-sitter@0.21.1`
ships none, and `tree-sitter-json@0.24.8`'s `linux-arm64` binary is x86-64. Yarn 1 reached both
through optional dependencies and logged the failed build as a warning. Yarn 4 does not carry that
optional flag to the `tree-sitter-json` instance it creates for its peer dependency, so the failed
build fails the install on an arm64 runner without `make`, such as `openmetadata-collate`'s.

## Consequences

CI can move all installs to a mirror by configuration alone. The cost is a 3.8 MB release file in
the tree, and every Yarn upgrade is a reviewed change to that file and `yarnPath`. Hardened mode
makes OSS pull-request installs slower and fetches metadata for every locked package from the
registry; that is the price of checking untrusted lockfile changes. Private-repository builds,
including `openmetadata-collate`, do not run it.
`openmetadata-collate` runs installs in this tree with its own commands, so its CI must drop the
Yarn 1 flags before it picks up the submodule commit that introduces this.
