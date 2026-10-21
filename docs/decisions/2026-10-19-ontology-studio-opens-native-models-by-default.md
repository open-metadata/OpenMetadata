# Ontology Studio opens native models by default

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial); v2 2026-10-21 (bare route falls back to glossaries when no native ontology exists)
- **Deciders:** Studio implementation review
- **Guard:** `OntologyExplorerPage.test.tsx`, `useOntologyStudioModel.test.tsx`, reviewer
- **Related:** ADR:2026-10-16-native-ontologies-share-studio-and-memory-review, ADR:2026-10-17-glossaries-do-not-own-ontology-models

## Context

The bare Studio route opened glossary vocabulary. Native publication was available only after
selecting an ontology. This hid the native workflow behind a compatibility default and did not
match the supplied All ontologies design.

## Decision

The bare `/governance/ontology` route shows a read-only graph or tree of native working models.
`?ontology=<id>` selects one native ontology for its existing authoring and publication workflow.
Review & publish from the aggregate view requires selecting one ontology. It never publishes
multiple ontologies or reuses another ontology's edit permission.

Glossary compatibility remains explicit through `?scope=glossary:all` or
`?scope=glossary:<id>`. The one exception (v2): when the bare route finds no native ontology, it
replaces the URL with `?scope=glossary:all`, because an instance with glossaries but no native
ontologies otherwise opened an empty Studio. Choosing All ontologies from the scope menu writes
`?scope=ontology:all`, which never falls back and shows the empty native catalog. A `?draft=<id>` link without an ontology retains glossary review.
Failed native links expose recovery instead of silently switching to glossary data.

Aggregate loading is limited to 20 ontologies and 2,000 combined concepts, properties and axioms.
Counts are checked before loading definition bodies, and the definition limit is enforced while
loading pages. Owners load sequentially, with at most three definition requests in flight.
These limits bound client work while the API supplies individual ontology models. A failed or
oversized aggregate shows recovery or ontology selection, never a partial graph labeled All.

## Consequences

Studio reuses the native graph adapter and existing canvas, tree and publication components.
The aggregate does not infer new relationships between ontologies. Large catalogs must select an
individual ontology until a server aggregate API can provide bounded graph paging.

No glossary data is converted or deleted. The existing library remains vocabulary installation;
native library installation requires its own adapter and persistence tests.
