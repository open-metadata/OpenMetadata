# The UI .nvmrc is the one Node pin, and raising it waits for Collate's Node pins

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `engines.node` in both UI `package.json` files (`yarn install` rejects an older Node); `scripts/check_prerequisites.sh` and `scripts/dev_setup.sh` read the floor from `.nvmrc`; reviewer for the hand-kept pins and the Collate merge order
- **Related:** [OpenMetadata #35921](https://github.com/open-metadata/OpenMetadata/issues/35921), [OpenMetadata #35923](https://github.com/open-metadata/OpenMetadata/pull/35923)

## Context

The Oct 2026 Node.js security release (22.23.4) found the repository's Node pins spread across
CI, two poms, three Dockerfiles, two devcontainers and two `.nvmrc` files, at three different
versions, all of them unpatched and one of them end-of-life. Every pin was bumped by hand, so each
one drifted on its own schedule.

## Decision

`openmetadata-ui/src/main/resources/ui/.nvmrc` is the single source of the Node version. Every
consumer that can read it does: `setup-node` through `node-version-file`, the Playwright sandbox
`docker run` image tags, the storybook image (as a build arg), the devcontainers (through nvm),
and the core-components `.nvmrc`, which is a symlink to it.

`engines.node` in `openmetadata-ui` and `openmetadata-ui-core-components` is `>=` that version,
so an unpatched Node fails `yarn install` instead of building quietly.

The pins that cannot read the file must match it by hand: `<nodeVersion>` in both poms
(frontend-maven-plugin 1.12.1 has no version-file support) and `docker/olivaw/Dockerfile`, whose
tarball is checksum-verified against pinned SHA256 values. The test-only `mock-oidc-provider`
image uses the floating `node:22-alpine` tag instead.

`openmetadata-collate` runs `yarn install` in this UI with its own Node pins. A PR that raises the
`.nvmrc` merges only together with, or after, the Collate change that raises Collate's Node pins,
and before Collate's submodule bump picks it up.

## Consequences

A Node bump is one `.nvmrc` edit plus the hand-kept pins listed above, and a stale hand-kept pin
fails loudly at `yarn install` rather than shipping an old Node. The cost is that developers and
downstream builds on an older Node 22.x are blocked until they upgrade; `make dev_setup` upgrades
them. Upgrading frontend-maven-plugin to a release that reads `.nvmrc` would remove the pom pins
from the hand-kept list.
