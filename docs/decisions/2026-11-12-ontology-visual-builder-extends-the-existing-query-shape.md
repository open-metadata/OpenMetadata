# The Ontology visual builder extends its existing query shape and caps results at a chosen limit

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Ontology Studio maintainers
- **Guard:** `OntologyNativeQuery.utils.test.ts` (one condition at the default limit equals the existing canonical query; extra conditions and limits extend it)
- **Related:** [#37606](https://github.com/open-metadata/OpenMetadata/issues/37606), [#37607](https://github.com/open-metadata/OpenMetadata/pull/37607)

## Context

The design handoff gives the Query mode visual builder several conditions, a Properties find and a
result limit. The builder writes SPARQL in the browser, and the query it already wrote for one
condition is checked against canonical RDF. The new options had to arrive without changing that
query or anything on the server.

## Decision

- One condition at the default limit emits exactly the query the builder emitted before.
- Each further condition adds one `VALUES ?targetN` line and one pattern; all conditions are ANDed.
  A condition missing its relation or target is left out and reported as ignored, and the builder
  does not run until at least one condition is complete.
- A Properties find matches `rdfs:domain` / `rdfs:range` and returns one row per property.
- The limit is one of 10, 50, 100 or 500 (`QUERY_LIMITS`) and defaults to 100, the limit the builder
  always used. Server-side query bounds (ADR:2026-11-04-ontology-sparql-runs-in-a-bounded-worker)
  still apply on top of it.

## Consequences

No server or contract change is needed, and existing single-condition queries behave as before.
Multi-condition and Properties queries are covered by UI tests only; a different shape for the
single-condition query, other limits or OR between conditions need an amendment here.
