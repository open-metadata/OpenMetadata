# The ref-parser's js-yaml 4 resolution stays above the bare js-yaml resolution

- **Status:** Superseded by ADR:2026-11-19-ui-yarn-resolutions-pin-only-what-a-fresh-resolve-gets-wrong
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `generate-types` in `.github/workflows/typescript-type-generation.yml`, which runs
  `yarn parse-schema` on every merge-queue run (a pull request that touches only `package.json`
  does not trigger it before the queue)
- **Related:** #37982; openmetadata-collate#5682, which pins the same in collate-ui

## Context

`openmetadata-ui` resolves `@apidevtools/json-schema-ref-parser` to 15.3.6, the only fix for
CVE-2026-15195. Its only importer is the build script `parseSchemas.js`. 15.x does
`import yaml from "js-yaml"`, but the UI's `resolutions` force `js-yaml` to 5.x everywhere, and 5.x
has no default export. With the forced 5.x, `yarn parse-schema` fails when the ref-parser loads.

A scoped resolution, `"@apidevtools/json-schema-ref-parser/js-yaml": "4.3.2"`, keeps js-yaml 4
under the ref-parser only. Yarn 1 applies the first resolution whose pattern matches. The bare
`"js-yaml"` entry matches the ref-parser's js-yaml too, so it shadows the scoped entry if it comes
first. `package.json` cannot carry a comment saying so.

## Decision

In `openmetadata-ui/src/main/resources/ui/package.json` `resolutions`, the scoped
`@apidevtools/json-schema-ref-parser/js-yaml` entry stays **above** the bare `js-yaml` entry. Do not
alphabetise or reorder `resolutions` past it.

## Consequences

The rest of the UI stays on js-yaml 5. js-yaml 4.3.2 is installed only as the ref-parser's own
copy, at build time, and is outside the 5.x range the earlier js-yaml advisory covered.

Remove the scoped pin when the ref-parser moves to a release that depends on js-yaml 5:
16.x declares `js-yaml ^5.4.2`. collate-ui carries the same pin, and both UIs pin ref-parser 15.3.6
so they share its major, so drop the two pins in one change.
