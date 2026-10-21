# TypeScript codegen runs quicktype through npx at one exact version, with no root package.json

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** reviewer (the pin is duplicated in two scripts); the "no types generated" step in
  `.github/workflows/typescript-type-generation.yml` catches a branch still on the old setup
- **Related:** PR #35736

## Context

The repo-root `package.json` and `yarn.lock` existed only to install quicktype for
`openmetadata-ui/src/main/resources/ui/json2ts*.sh`. Every Dependabot/security bump of the root
lockfile was maintenance on a package nothing else used, and the type-generation workflow had to
`yarn install` at the root and symlink `node_modules` into the UI folder.

## Decision

- There is no repo-root `package.json`/`yarn.lock`. `json2ts.sh` and `json2ts-generate-all.sh` each
  resolve the quicktype binary once with `npx --yes -p quicktype@<version> -c 'command -v quicktype'`.
- The version is an exact pin and **must be identical in both scripts**; bumping quicktype means
  editing both, then running `json2ts-generate-all.sh -l true` and committing the regenerated types.
- quicktype's transitive dependencies are deliberately left unlocked and resolve fresh from npm.

## Consequences

- No lockfile to maintain for a single codegen tool. Output stays deterministic because quicktype
  pins `quicktype-core` and `typescript` exactly.
- Reverses the earlier lockfile-frozen install: a compromised patch release in quicktype's tree
  would run in the type-generation job, which pushes with a PAT. Revisit — e.g. a small lockfile
  under `tooling/` installed with `npm ci --ignore-scripts` — if that job's trust boundary widens or
  a transitive upgrade ever changes generated output.
