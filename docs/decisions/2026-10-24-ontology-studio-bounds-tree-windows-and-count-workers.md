# Ontology Studio bounds tree windows and count workers

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial) · v2 2026-11-06 (the model loader follows the 50,000-member release cap)
- **Deciders:** Ontology Studio implementation review
- **Guard:** `OntologyStudio.utils.test.ts`, `OntologyTreeView.test.tsx`, `useOntologyUnpublishedCount.test.tsx`, `useOntologyStudioModel.test.tsx`
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

## Consequences

Every hierarchy placement remains reachable with bounded derived rows. Navigating a window keeps
the user's disclosure choices. Permission concurrency is bounded, but an exact total still needs
one request per potentially contributing owner with the existing API. A server aggregate endpoint
could reduce that total in a future change without changing single-owner publication.

## Amendment v2 — 2026-11-06: the model loader follows the 50,000-member release cap

`useOntologyStudioModel` loads concepts, properties and axioms in pages of 1,000 and stopped at
ten pages per kind, the server's old 10,000-member release cap. The server cap is now 50,000
(ADR:2026-10-14-ontology-releases-seal-canonical-sql-members), so the loader allows 50 pages per
kind and `useOntologyStudioModel.test.tsx` opens a 35,000-concept ontology through 35 calls. The
tree window stays at 2,048 placements; this amendment changes how much the model holds, not how
much the tree renders. The API side of the load, measured by `NativeOntologyCapacityPerfIT` as the
same paged reads the hook issues, took 1,206 ms for 10,000 working definitions and
9,036 ms for 35,000. Browser render time at that size was not measured.
