# Ontology Studio bounds tree windows and count workers, and hides only unchanged bundled templates

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `OntologyStudio.utils.test.ts`, `OntologyTreeView.test.tsx`, `useOntologyUnpublishedCount.test.tsx`, `OntologyStudioQueryConsole.test.tsx`
- **Related:** ADR:2026-10-19-ontology-studio-opens-native-models-by-default

## Context

A native concept may have several parents. Unfolding every path through a layered hierarchy can
produce exponentially more placements than definitions. The unpublished total must cover every
editable ontology even when the aggregate model exceeds its separate loading limit.

## Decision

The native tree retains one window of at most 2,048 placements, plus the ancestor context needed
to render that window. Iterative path cursors provide Previous and Next navigation without
retaining preceding windows. This size accommodates the ordinary 2,000-definition aggregate.
Disclosure overrides belong to placements and persist until the model or filter changes.
Expand all changes the disclosure default without materializing every path. External selection
uses a shortest path over the canonical adjacency index. Glossary compatibility keeps its
existing representation.

Unpublished counts use at most four concurrent entity-permission requests. Known zero and deleted
owners need no request. The full scope list remains independent of the aggregate graph limit.
An unknown permission or an editable owner's missing count makes the total unavailable. Account
changes cancel the active job queue and discard its query result. Target selection authorizes its
owner independently of the count.

In a native ontology scope, the query console hides a shared SPARQL template only when it is
field-for-field equal (`isEqual`) to a seed in `sparqlQuerySettings.json`, because those seeds
query glossary terms that a native ontology's endpoint does not hold. A template that was edited
in any field, including `id`, `name` or `savedAt`, or authored by a user, stays visible. Saving
preserves the hidden seeds.

## Consequences

Every hierarchy placement remains reachable with bounded derived rows. Navigating a window keeps
the user's disclosure choices. Permission concurrency is bounded, but an exact total still needs
one request per potentially contributing owner with the existing API. The template filter couples
the display to the exact shape of the bundled seeds: if the server stores a seed with an added or
defaulted field, it shows again in native scopes. A server aggregate endpoint
could reduce the permission-request total in a future change without changing single-owner
publication.
