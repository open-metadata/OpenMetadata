# The Ontology visual builder emits SPARQL that a shared fixture pins on both sides

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Ontology Studio maintainers
- **Guard:** `OntologyNativeVisualQueryTest` (Java, runs each fixture query in Jena) and `OntologyNativeQuery.utils.test.ts` (UI, asserts the builder emits each fixture query byte for byte), both reading `openmetadata-service/src/test/resources/ontology/native-visual-queries.json`
- **Related:** [#37606](https://github.com/open-metadata/OpenMetadata/issues/37606), [#37607](https://github.com/open-metadata/OpenMetadata/pull/37607)

## Context

The Query mode visual builder in Ontology Studio generates SPARQL in the browser
(`utils/governance/ontology/OntologyNativeQuery.utils.ts`). That query runs against the RDF the
server emits for native ontologies, so its shape is a contract between the UI and the server's RDF
writers. The design handoff added a Properties find, a user-chosen result limit and several
conditions per query; none of this was stated anywhere outside the PR description.

## Decision

- **Conditions are ANDed.** Each complete condition binds its own target variable (`?target`,
  `?target2`, …) and contributes its triple patterns to one `WHERE`; a condition missing its
  relation or target is left out of the query and reported to the user as ignored. The builder will
  not run, or open as SPARQL, until at least one condition is complete.
- **Concepts find** returns `?concept`, `?label` and `?parent`. Labels and superclasses are
  `OPTIONAL` and aggregated with `SAMPLE` under `GROUP BY ?concept`, so a concept with several
  labels or parents is still one row.
- **Properties find** matches a property by `rdfs:domain` and `rdfs:range` and returns
  `?propertyName`, `?domain` and `?range` (labels where present, else the IRI), grouped by
  `?property` the same way.
- **LIMIT** is one of 10, 50, 100 or 500 and defaults to 100, applied after grouping. Server-side
  bounds (ADR:2026-11-04-ontology-sparql-runs-in-a-bounded-worker) still apply on top of it.
- `native-visual-queries.json` holds one canonical query per pattern, including two conditions and
  a property-domain find. A change to the builder's output or to the server's RDF emission updates
  the fixture and must keep both tests passing.

## Consequences

Either side can change only together with the fixture, so a UI query shape the server's RDF cannot
answer, or an RDF change that breaks the builder, fails a test instead of returning empty results
in production. The fixture checks the label, parent and range columns only where an entry declares
`expected` values; older entries assert the matched concept alone. Supporting OR between
conditions, other limits or new finds means a new fixture entry and an amendment here.
