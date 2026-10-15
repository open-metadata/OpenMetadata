# Reasoning closures are the Approved ontology graphs, pinned by a content-addressed manifest

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial) · v2 2026-10-15 (label-independent graph digest
  `om-graph-v2`; closure digest `om-closure-v2` without import-problem lines; unpinnable closures
  are never published, candidates included)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyClosuresTest`, `OntologyGraphsTest`, `OntologyGraphDigestTest` (vectors
  shared with the store's `GraphDigestTest`) and `RdfOntologyActivationIT`
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
  It is computed from the model OpenMetadata writes. *Replaced by `om-graph-v2` in amendment v2.*
- **Closure digest (`om-closure-v1`):** SHA-256 of newline-terminated lines: the algorithm name,
  `ontology <iri>`, `glossary <iri>`, `selection APPROVED|CANDIDATE`, one
  `member <graph> <digest>` per pinned graph in graph-IRI order, then the sorted import lines
  (`import <ontology> <closure digest>`, `import-missing <glossary>`, `import-cycle <glossary>`).
  Member records are read 2000 at a time in graph-IRI order, so no closure is held in memory.
  *Replaced by `om-closure-v2`, which has no `import-missing` or `import-cycle` line, in
  amendment v2.*
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

## Amendment v2 (2026-10-15): digests the store can recompute

### Context

The store recomputes both digests from what it holds (jena `openmetadata/fuseki`, `Capture` and
`GraphDigest`) and refuses a capture whose digests differ. Two gaps let it disagree with
OpenMetadata about content that had not changed:

- `RdfBlankNodeCanonicalizer` ordered blank nodes whose refined hashes tie by their labels.
  The store labels blank nodes differently, so for any tie that is not a symmetry (and for some
  that are: two copies of a nested restriction pair their inner nodes either way) the two sides
  computed different digests and the capture reported `GENERATION_MISMATCH` for unchanged
  content. Measured on the shared vectors: relabelling `nested-twins.ttl` 30 times gave 8
  different v1 outputs, `cycles.ttl` 30. Its refinement also stopped after 16 rounds, before a
  long chain of otherwise identical blank nodes is told apart.
- `om-closure-v1` hashed `import-missing` and `import-cycle` lines, which no manifest records, and
  candidate publication did not refuse such closures. A published candidate manifest with a
  missing import therefore had a digest the store could never recompute.

### Decision

- **Graph digest `om-graph-v2`** (`OntologyGraphCanonicalForm`): colour refinement to a stable
  partition (a node's next colour hashes its own colour and its incident triples with neighbours'
  colours; rounds stop when the number of colours stops growing, so no fixed round cap), then,
  while colours tie, the RDFC-1.0-style distinguishing step: for each node of the smallest tied
  colour, recolour it, refine, recurse, and keep the lexicographically smallest N-Triples text.
  Blank nodes are written `_:b<colour>`. When the blank nodes form a forest (each triple joins at
  most two, none is inside a triple term, the joins are acyclic) colour refinement's ties are
  exactly the graph's symmetries, so one node per tie is tried and the cost stays polynomial;
  every graph the OWL 2 RDF mapping writes is such a forest.
- **Bounds:** at most 1024 distinguishing steps and 10,000,000 incident-triple visits per graph.
  Past either the graph has no digest (`TooSymmetricException`) rather than one that depends on
  labels. Both counts are properties of the graph, not of its labels, so OpenMetadata and the
  store refuse the same graphs.
- **Chosen over** defining the digest only for graphs refinement fully separates and refusing
  the rest: two identical axioms' blank trees (or any duplicated subtree) never separate, and
  that rule would refuse ordinary content; the forest rule digests them at the same cost.
- **Marker:** a member record now carries `omr:digestAlgorithm "om-graph-v2"` beside
  `omr:contentDigest`. A closure pins only records with that marker; an Approved or used
  relationship-type graph without it is reported as `INCOMPLETE_PROJECTION`, naming the graphs,
  so records an earlier build wrote are re-digested by `RdfIndexApp`, never pinned with a digest
  the store would compute differently. A graph too symmetric to digest is still projected (the
  entity write keeps its content) with neither predicate, and reported the same way.
- **Closure digest `om-closure-v2`:** the v1 lines with v2 graph digests and only
  `import <ontology> <closure digest>` import lines. `om-closure-v1` manifests are refused by a
  store that implements v2, so an old manifest is never misread.
- **No manifest for an unpinnable closure:** activation still refuses any problem with 409.
  Candidate publication now refuses with 409, carrying the closure and its problems, when any
  closure in it has a missing import, an import cycle or a graph without a current digest;
  incomplete counts and degraded projection still only warn on a candidate. Publication has no
  other path.
- `RdfBlankNodeCanonicalizer` is unchanged: annex checksums, entity diffs and the importer use
  its output, and none of them is compared across implementations.

### Consequences

The store's `GraphDigest` implements the same steps and pins the same vectors. Stores projected
by an earlier build of this branch report incomplete projection until `RdfIndexApp` runs. A
`GET` of a closure with an import problem still reports a digest, over the imports that resolve;
it is never published, so no reasoning job can name it.
