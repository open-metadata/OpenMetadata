# UI yarn resolutions pin only what a fresh resolve gets wrong

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Harsh Vador
- **Guard:** reviewer
- **Related:** supersedes ADR:2026-11-17-ref-parser-js-yaml-resolution-precedes-bare-js-yaml;
  #38104

## Context

`openmetadata-ui` had 47 `resolutions` and `openmetadata-ui-core-components` had 16. Most were
added one advisory at a time and never removed. Yarn 1 applies a bare resolution to every copy of
the package in the tree, across majors, so several of them did harm:

- `minimatch: 3.1.5` was installed under `@swagger-api/apidom-reference`, which asks for `^10.2.1`
  and does `import { minimatch } from 'minimatch'`. 3.x has no such export.
- `semver: 7.5.2` was installed for `eslint-plugin-sonarjs`, which asks for `^7.8.5`.
- `js-yaml: ^5.5.0` was installed for dependents asking for `^3` and `^4`. It needed a second,
  order-sensitive resolution to keep `@apidevtools/json-schema-ref-parser` working.
- `nanoid: 3.3.17` was itself vulnerable (GHSA-2v37-7h3g-55p8, high).

Checked against the npm advisory database, the version each dependent's own declared range
resolves to today was not vulnerable for most pins. The lockfile already pins those versions.

## Decision

A `resolutions` entry in a UI `package.json` exists for one of two reasons only:

1. **Single instance.** The package must resolve to one copy for the app to work, and Yarn 1 does
   not dedupe across ranges. Those are `@types/react`, `prosemirror-model`, `prosemirror-state`,
   `prosemirror-transform`, `prosemirror-view`, `@codemirror/state`, `@codemirror/view` and
   `i18next`.
2. **No upstream fix.** The version a dependent's declared range resolves to has an advisory, and
   the dependent's latest release still declares that range. The entry is scoped to that dependent
   (`**/<dependent>/<package>`), not bare, so other dependents keep the major they declared. A bare
   pin is acceptable only when that dependent is the package's only requester in the tree.

Before adding an entry, upgrade the dependent, or delete the stale lockfile entry so Yarn
re-resolves it within its range. Use an entry only when neither works. An entry crosses a major
its dependent did not declare only under rule 2, when no release inside the declared range is
fixed, and only after checking that what the dependent imports still exists in the forced major.

## Consequences

`openmetadata-ui` goes from 47 resolutions to 13, and core-components from 16 to 5. Removing the
bare `js-yaml` pin also removes the scoped `@apidevtools/json-schema-ref-parser/js-yaml` pin.
collate-ui carries the same pair, and its companion change drops both too, as that record asked.
With both pairs gone, the ordering rule in
ADR:2026-11-17-ref-parser-js-yaml-resolution-precedes-bare-js-yaml no longer applies anywhere.

A new advisory on a transitive package now needs a check of who requests it before any pin is
added. A scoped entry has to be removed once its dependent ships a fixed range. Each remaining
scoped pin names its dependent, so that is a lookup, not an audit.
