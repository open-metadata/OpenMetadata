# Reasoning closures are the Approved ontology graphs, pinned by a content-addressed manifest

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyClosuresTest`, `OntologyGraphsTest` and `RdfOntologyActivationIT`
- **Related:** `docs/plans/2026-10-07-fuseki-native-reasoning.md` (semantic projection items 6
  and 7, phase 3, open decision 4), ADR:2026-10-14-ontology-entities-own-their-named-graphs,
  ADR:2026-10-15-candidate-checks-add-draft-graphs-to-the-approved-closure,
  ADR:2026-10-11-rdf-reasoning-job-requests-carry-the-fields-their-operation-needs

## Context

Every non-deleted axiom and term owned a graph, whatever its status, and nothing said which of
them reasoning should read. Production reasoning must use Approved axioms and Approved terms
only (open decision 4). Phase 4 captures reasoning input inside Fuseki, so the selection has to
be readable there, pin exact content, and cost the same for a closure of tens of thousands of
terms as for ten.

## Decision

- **Every graph stays projected; selection is explicit.** Draft, In Review and other graphs are
  still written, so the serving data says what was authored and candidate checks can use them.
  Beside each graph, in the same SPARQL update, OpenMetadata writes a member record in
  `{base}graph/ontology/members`: owner entity and type, lifecycle status, glossary, triple
  count, content digest, the predicate a relationship type defines and the object properties a
  graph uses. Approve, reject and revert are entity writes, so live writes, replay and reindex
  move membership with the content, atomically.
- **A closure** is a glossary's Approved axiom and term graphs, every relationship-type graph a
  member uses (followed through the types those types name), and the closures of its
  `ontologyConfiguration.imports`, each pinned by its digest. Relationship types are included
  whatever their status: they are shared vocabulary, and dropping a used type's axioms would
  silently change what Approved axioms mean. Deprecated terms are left out, as the user decision
  names Approved only.
- **Graph digest:** `sha256:` + SHA-256 of the graph's canonical N-Triples, blank nodes labelled
  by `RdfBlankNodeCanonicalizer`, lines sorted, each ending in a newline (`OntologyGraphDigest`).
  It is computed from the model OpenMetadata writes.
- **Closure digest (`om-closure-v1`):** SHA-256 of newline-terminated lines: the algorithm name,
  `ontology <iri>`, `glossary <iri>`, `selection APPROVED|CANDIDATE`, one
  `member <graph> <digest>` per pinned graph in graph-IRI order, then the sorted import lines
  (`import <ontology> <closure digest>`, `import-missing <glossary>`, `import-cycle <glossary>`).
  Member records are read 2000 at a time in graph-IRI order, so no closure is held in memory.
- **Manifest:** the graph `{base}graph/manifest/{digest hex}` holds the OWL header
  (`owl:Ontology`, `owl:versionIRI`, `owl:imports` of each imported version IRI), one
  `omr:pinnedDigest` per member, and an `omr:OntologyVersion` node with selection, digest,
  member count and imported manifests. It is written to a staging graph page by page and moved
  into place with its header in one update. The version IRI is the ontology IRI plus
  `/version/{hex}`; the ontology IRI follows the export (`GlossaryOntologyIri`).
- **Activation** (`POST /v1/ontology/reasoning/closures/{glossaryId}/activation`) publishes the
  manifests of a glossary and its imports and records each in `{base}graph/ontology/activations`.
  It is refused with 409 when an import is missing, imports form a cycle, live projection is
  degraded, or the store holds a different number of Approved axiom or term graphs than the
  metadata. A manifest that no activation, retained candidate or kept import needs is dropped
  after ten minutes.
- `GET /v1/ontology/reasoning/status` reports included axioms and terms and excluded counts by
  reason; `GET .../closures/{glossaryId}` reports one closure without writing.
- The control vocabulary lives under `https://open-metadata.org/reasoning/` (`omr:`), outside
  the catalog vocabulary, and never enters reasoner input.

## Consequences

Phase 4 captures the graphs a manifest names and can compare each member record's digest with
the pinned one to detect content that changed after activation. The phase 0 rule materializer
still reads Fuseki's union graph, Draft graphs included, until phase 5 moves rules onto snapshots.
Stores gain member records as entities are next written; until a `RdfIndexApp` run, activation
reports incomplete projection. Activations live in the serving dataset, so a blue/green rebuild
starts without them: phase 7 activates before each refresh. TDB2 may rewrite a literal's
lexical form, so a digest recomputed from the store must use the lexical forms OpenMetadata
wrote, which the projection keeps canonical.
