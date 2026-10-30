# Production UI code imports only from the UI's src folder

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial) · v2 2026-10-30 (both Collate copy steps; the guard reads
  Tailwind at-rules and `data-uri()`)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `uiImportBoundary.test.ts`
- **Related:** ADR:2026-10-26-native-query-console-hides-only-unchanged-bundled-templates, PR #36190,
  issue #36189

## Context

Collate builds its UI from a copy of OpenMetadata's. Its `copy-om-to-collate` step copies the
`src/**` of `openmetadata-ui/src/main/resources/ui/`, except three test-setup files, into
`collate-ui/src/main/resources/ui/src/openmetadata-ui/`. A separate `copy-om-playwright-to-collate`
step copies `playwright/**`, which holds only end-to-end tests, into the same folder. The UI
folder's `public/`, `vite/` and `package.json` are not copied, and neither is any other part of the
repository. A relative import that leaves `src/` for any folder except `playwright/` resolves in
OpenMetadata's build and to nothing in Collate's, and production code never imports end-to-end
tests. PR #36190 imported `sparqlQuerySettings.json` from `openmetadata-service` into production
code, and Collate's release build failed with `UNRESOLVED_IMPORT`.

## Decision

Production UI code resolves every relative import inside `openmetadata-ui/src/main/resources/ui/src/`,
because it is the only part of the UI folder that Collate copies into its UI build apart from the
end-to-end tests in `playwright/`. Anything else it needs comes from a package.

Test files may import files outside `src/`, such as server fixtures, by relative path. Collate's
Jest ignores `src/openmetadata-ui/*`, and its build bundles only modules that production code
reaches, so no test file reaches Collate's build.

## Consequences

Data that the UI shares with the server is copied into `src/`, and a Jest test pins the copy to the
server file, as `OntologyStudio.constants.test.ts` does for the query console's seeds. Each copy
is a second file to change when the server file changes.

The guard reads `.ts`, `.tsx`, `.js` and `.jsx` files for `import ... from`, side-effect `import`,
`export ... from`, `import('...')` and `require('...')`, and `.less` and `.css` files for
`@import`, including `@import (reference)`, Tailwind's `@source`, `@reference`, `@plugin` and
`@config`, `url(...)` and Less's `data-uri(...)`. It does not check `import.meta.glob`,
`new URL(..., import.meta.url)`, a template-literal `import()` or `require.resolve` in scripts. In
style files it does not check a specifier without a leading `./` or `../`, which Less resolves
through `less.paths`, `image-set('...')` without `url(`, a comment between an at-rule and its path,
an upper-case at-rule or function name, `@source not`, a `data-uri()` whose first argument is not a
quoted string, a path built with a Less escape or variable, Less's `image-size()`, `image-width()`
and `image-height()`, Tailwind's `source(...)` option, or any other function or option that takes a
path. In any file it accepts a path that climbs above the UI folder and comes back into `src/`,
such as `../../../ui/src/constants/constants`, which resolves in OpenMetadata and to nothing in
Collate. It also matches specifiers inside comments and strings. No production file used any of
those forms to leave `src/` when the guard was added. A reviewer checks them.

This would be revisited if Collate copied the whole UI folder or consumed OpenMetadata's UI as a
built package.

## Amendment 2026-10-30: both copy steps, and Tailwind at-rules

v1 said `copy-om-to-collate` copies `src/**` and `playwright/**`. That step copies `src/**`, and
`copy-om-playwright-to-collate` copies `playwright/**`. The rule is unchanged. The guard now also
reads Tailwind's `@source`, `@reference`, `@plugin` and `@config` and Less's `data-uri(...)`, because
`src/styles/tailwind.css` already uses `@source` and `@plugin`, and a relative path in any of them
that leaves `src/` for any folder except `playwright/` resolves to nothing in Collate.
