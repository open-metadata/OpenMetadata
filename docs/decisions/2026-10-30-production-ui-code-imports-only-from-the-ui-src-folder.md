# Production UI code imports only from the UI's src folder

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `uiImportBoundary.test.ts`
- **Related:** ADR:2026-10-26-native-query-console-hides-only-unchanged-bundled-templates, PR #36190,
  issue #36189

## Context

Collate builds its UI from a copy of OpenMetadata's. Its `copy-om-to-collate` step copies only
`src/**` and `playwright/**` from `openmetadata-ui/src/main/resources/ui/` into
`collate-ui/src/main/resources/ui/src/openmetadata-ui/`. The UI folder's `public/`, `vite/` and
`package.json` are not copied, and neither is any other part of the repository. A relative import
that leaves `src/` resolves in OpenMetadata's build and to nothing in Collate's. PR #36190 imported
`sparqlQuerySettings.json` from `openmetadata-service` into production code, and Collate's release
build failed with `UNRESOLVED_IMPORT`.

## Decision

Production UI code resolves every relative import inside `openmetadata-ui/src/main/resources/ui/src/`,
because Collate copies only that folder into its own UI. Anything else it needs comes from a package.

Test files may import files outside `src/`, such as server fixtures, by relative path. Collate's
Jest ignores `src/openmetadata-ui/*`, and its build bundles only modules that production code
reaches, so no test file reaches Collate's build.

## Consequences

Data that the UI shares with the server is copied into `src/`, and a Jest test pins the copy to the
server file, as `OntologyStudio.constants.test.ts` does for the query console's seeds. Each copy
is a second file to change when the server file changes.

The guard reads `.ts`, `.tsx`, `.js` and `.jsx` files for `import ... from`, side-effect `import`,
`export ... from`, `import('...')` and `require('...')`, and `.less` and `.css` files for
`@import`, including `@import (reference)`, and `url(...)`. It does not check
`import.meta.glob`, `new URL(..., import.meta.url)`, a template-literal `import()`, or
`require.resolve`, and it also matches specifiers inside comments and strings. No production file
used any of those forms to leave `src/` when the guard was added. A reviewer checks them.

This would be revisited if Collate copied the whole UI folder or consumed OpenMetadata's UI as a
built package.
