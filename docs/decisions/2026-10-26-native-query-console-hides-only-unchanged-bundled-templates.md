# The native query console hides only unchanged bundled templates

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial) · v2 2026-10-30 (compare against the UI's own copy of the seeds)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `OntologyStudioQueryConsole.test.tsx`, `OntologyStudio.constants.test.ts` (the UI copy
  equals `sparqlQuerySettings.json`)
- **Related:** ADR:2026-10-19-ontology-studio-opens-native-models-by-default, PR #36190

## Context

The query console lists the shared SPARQL templates from the server's query settings. The bundled
seeds query glossary terms, which a native ontology's endpoint does not hold, so they return
nothing in a native scope. The console cannot tell a seed from a user's template by name alone,
because a user can edit a seed or save a template with the same name.

## Decision

In a native ontology scope, the query console hides a shared SPARQL template only when it is
field-for-field equal (`isEqual`) to a seed in `sparqlQuerySettings.json`, because those seeds
query glossary terms that a native ontology's endpoint does not hold. A template that was edited
in any field, including `id`, `name` or `savedAt`, or authored by a user, stays visible. Saving
preserves the hidden seeds.

The console compares against the UI's own copy of the seeds in `OntologyStudio.constants.ts`,
because production UI code cannot import files outside `openmetadata-ui/src/main/resources/ui/src/`.
Collate copies only that folder into its own UI. A Jest test pins the copy to
`sparqlQuerySettings.json`.

## Consequences

The template filter couples the display to the exact shape of the bundled seeds: if the server
stores a seed with an added or defaulted field, it shows again in native scopes.

A PR that changes only `sparqlQuerySettings.json` does not trigger the UI Jest job, because its
paths filter covers only the UI, so the nightly run catches drift after merge.

## Amendment 2026-10-30: the UI's own copy of the seeds

v1 imported `sparqlQuerySettings.json` from `openmetadata-service` into production UI code. Collate
copies only the UI's `src/` folder, so that relative path resolves to nothing there and its release
build failed. The console now compares against a UI copy, per
ADR:2026-10-30-production-ui-code-imports-only-from-the-ui-src-folder, and
`OntologyStudio.constants.test.ts` fails when the copy and the server seeds differ.
