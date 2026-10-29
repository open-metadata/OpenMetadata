# The native query console hides only unchanged bundled templates

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `OntologyStudioQueryConsole.test.tsx`
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

## Consequences

The template filter couples the display to the exact shape of the bundled seeds: if the server
stores a seed with an added or defaulted field, it shows again in native scopes.
