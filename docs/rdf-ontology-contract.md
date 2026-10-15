# RDF projection and ontology contract

`openmetadata-spec/src/main/resources/rdf/ontology/openmetadata.ttl` declares the
predicates used by the metadata projection. Its `om:projectionStatus` annotations
make availability explicit:

| Status | Meaning |
| --- | --- |
| `om:Stored` | The projection writes the predicate when the corresponding field or relationship is populated. Queries work with `inference=none`. Optional fields need not be present on every entity. |
| `om:InferenceOnly` | The metadata projection does not supply this predicate. It is retained for custom inference, external ontology data, or an explicit export path described in its comment. Triples materialized by custom rules are returned with `inference=custom` only; `inference=none` reads asserted graphs. Enabling RDFS or OWL alone does not guarantee any matching triples. |

In particular, declaring an alias as `rdfs:subPropertyOf` an external property
does **not** infer the alias from triples using that external property. The
ontology preserves these vocabulary terms without advertising them as populated
metadata fields. Declarations of external predicates document projection usage;
their authoritative definitions remain in their original vocabularies.

## Change history and votes

`changeDescription` and `votes` are outside the metadata projection. The JSON-LD
context and SQL-to-SPARQL mappings do not advertise them, and the ontology does
not declare their proposed predicates as `om:Stored`. SPARQL with
`inference=none` cannot answer change-history questions, vote counts, or vote
direction from the graph.

Entity version APIs (`getVersion` and `listVersions`) own change history; an
entity's current `changeDescription` is not durable history by itself. Entity
reads with `fields=votes` return current vote counts and voter references. The
vote relationship store owns those values.

The relationship writer still projects each vote as a `<user> om:voted <entity>`
edge. The edge records who voted on an entity but not the vote direction, so
counting `om:voted` edges mixes up-votes and down-votes and is not a popularity
measure.

## Lineage direction

For a SQL lineage edge from `source` to `output`, both the live writer and the
RDF indexing app assert these triples:

```turtle
@prefix om: <https://open-metadata.org/ontology/> .
@prefix prov: <http://www.w3.org/ns/prov#> .

<output> om:upstream <source> ;
         prov:wasDerivedFrom <source> .
<source> om:downstream <output> .
```

Both OpenMetadata directions are stored, so direct queries need no reasoner.
`om:upstream` remains a subproperty of `prov:wasDerivedFrom`. It is not equivalent
to `dcat:qualifiedRelation`, which points to a reified relationship node rather
than the upstream asset.

Readers also accept legacy uppercase `om:UPSTREAM` triples, whose direction is
source to output. That predicate is deprecated. Live writes and reconciliation
remove the legacy edge and repair old live PROV edges while preserving a valid
reciprocal lineage edge. Graph exports normalize lineage predicates to match the
exported source-to-output orientation.

## Column-level lineage

A lineage edge's details node links each column mapping through
`om:hasColumnLineage`. Live lineage writes and the RDF indexing app write the same
triples, using the edge's details as currently stored:

```turtle
<details> om:hasColumnLineage <columnLineage> .
<columnLineage> a om:ColumnLineage ;
    om:fromColumn <https://open-metadata.org/entity/column/service.db.schema.customers.email> ;
    om:fromColumnFqn "service.db.schema.customers.email" ;
    om:toColumn <https://open-metadata.org/entity/column/service.db.schema.contacts.email> ;
    om:toColumnFqn "service.db.schema.contacts.email" .
```

`om:fromColumn` and `om:toColumn` reference the same column IRIs that `om:hasColumn`
mints for the table, so queries and inference rules can join column lineage with column
tags. Match by name with `om:fromColumnFqn` and `om:toColumnFqn`. Stores indexed before
2.1 hold FQN literals in `om:fromColumn` and `om:toColumn` until the lineage edge is
written again or the store is rebuilt.

### Traversal and paging

All columns downstream of one column, with the asset that owns each, one page at a time:

```sparql
PREFIX om: <https://open-metadata.org/ontology/>
SELECT DISTINCT ?column ?asset WHERE {
  ?start om:fullyQualifiedName "svc.db.schema.table.col" .
  ?start (^om:fromColumn/om:toColumn)+ ?c .
  ?c om:fullyQualifiedName ?column .
  ?c (^om:hasChildColumn)*/^om:hasColumn ?asset
} ORDER BY ?column ?asset LIMIT 250 OFFSET 0
```

Upstream swaps the path for `^om:toColumn/om:fromColumn`. Narrow the result with patterns on `?asset`,
for example `?asset a om:Table`, `?asset om:belongsToService/om:fullyQualifiedName "svc"`,
`?asset om:hasOwner/rdfs:label "growth"` or `?asset om:hasTier/om:tagFQN "Tier.Tier1"`. Page by
raising `OFFSET` by `LIMIT` until a page returns fewer rows than `LIMIT`. A cycle terminates, and a
column in a cycle reaches itself.

- **Join direction.** Walk up from the bound column as above. The forward form
  `?asset om:hasColumn/om:hasChildColumn* ?c` makes the query engine enumerate every node as a
  zero-length start; it took about 6.6 s per page on the test graph against about 50 ms.
- **Silent drops.** A mapping whose column is not a projected `om:Column` (for example because its
  table is not in the graph) has no `om:fullyQualifiedName` to join and produces no row.
- **Page size.** The MCP `sparql_query` tool caps its body at 80% of the server's `maxResponseChars` setting (80,000 bytes by default;
  an administrator can lower it). A row of a column and an
  asset IRI is about 205 bytes with realistic names, so 400 rows overflow the default and the tool publishes 250.
  When a page comes back `truncated`, lower `LIMIT` and repeat the same `OFFSET`.
- **Freshness.** Live lineage writes and `RdfIndexApp` both project column mappings. A rebuild refreshes older stores that still hold literal lineage endpoints.

Measured on a graph of 5,006 mappings (a six-hop chain, a fan-out of one column into 450, a rename hop,
a multi-source mapping, a cycle, a dashboard data model hop and a nested column): the 2,705 columns
downstream of the source column take 330 ms in memory, and 11 pages of 250 rows take 49 to 230 ms each
(about 51 KB per page) through the MCP `sparql_query` tool against Fuseki.

`om:hasChildColumn` is stored for nested table columns; traversing to their owning asset needs no inference.

## Domain membership

An asset's `domains` are projected as `om:belongsToDomain`, the predicate already used
for the singular `domain` field. `om:domains` is deprecated: the next projection of
each entity removes it, and a full rebuild removes it everywhere.

## Concept realizations

Each entry in a glossary term's `realizedIn` links the term to the asset twice: with
`om:mappedTo`, written from the stored realization relationship, and with a predicate
for the asset's role. A term whose class IRI is its authored `iri` repeats both on that IRI
in its own graph (see [Ontology graphs](#ontology-graphs-in-the-live-projection)):

| Role | Predicate |
|---|---|
| `PRIMARY_STORE` (the default) | `om:hasPrimaryStore` |
| `DERIVED` | `om:hasDerivedAsset` |
| `REPLICA` | `om:hasReplica` |

`om:realizedIn` is deprecated. Earlier releases stored realizations under it as a JSON
literal, which the term's next projection removes.

## Custom extension values

Extension keys are values instead of dynamically minted `om:ext_*` predicates.
The key and its typed value can be queried through a fixed vocabulary:

```sparql
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?asset ?costCenter WHERE {
  ?asset om:hasExtension/om:hasExtensionProperty ?entry .
  ?entry om:extensionKey "costCenter" ;
         om:extensionValue ?costCenter .
}
```

Replacing, removing, or deleting an entity's extension also removes its owned
extension entries. Unrelated entities and relationship hooks remain intact.
User-registered glossary relationship IRIs and custom ontology axioms still use
their configured vocabulary; they are not a finite part of the shipped core ontology.

## Glossary ontology projection

`GET /v1/glossaries/{id}/exportOntology`, `GET /v1/rdf/glossary/{id}/export`, and the
glossary-scoped `POST /v1/glossaries/{id}/sparql` build one glossary's ontology from the
database on each request; they do not read the knowledge graph. That projection is OWL 2
DL: OWL API, configured as the reasoner worker configures it, parses it without
placeholders or unconsumed triples, and its OWL 2 DL profile check reports nothing for
valid input (`GlossaryOntologyModelBuilderTest`, `OntologyExpressionRdfWriterTest`).

- **Declarations.** Every class, object property, data property, annotation property, and
  named individual the projection uses is declared. SKOS terms are declared with the kind
  the SKOS reference vocabulary gives them (`skos:broader` is an object property,
  `skos:prefLabel` an annotation property), and `om:mappedTo`, the realization roles and
  `om:fullyQualifiedName` with the kind `openmetadata.ttl` gives them. Built-in RDF, RDFS,
  OWL, and XSD vocabulary is never declared. The importer ignores these declarations when an
  export is imported again: an IRI in the SKOS, RDF, RDFS, OWL, XSD, or `om:` namespace
  never becomes a term or an attribute.
- **Reserved relationship types.** A relationship type whose predicate is built-in or SKOS
  vocabulary keeps that predicate's meaning instead of becoming an `owl:ObjectProperty`
  with the type's characteristics:

  | Type | Edge is read as | Not emitted any more |
  |---|---|---|
  | `subClassOf` (`rdfs:subClassOf`) | Subclass axiom; both terms are declared classes | `rdfs:subClassOf a owl:TransitiveProperty` |
  | `seeAlso` (`rdfs:seeAlso`) | Annotation | `rdfs:seeAlso a owl:SymmetricProperty` |
  | `broader`, `narrower`, `synonym` (SKOS) | SKOS object property assertion | Transitive or symmetric declarations; SKOS does not make `skos:broader` transitive |
  | `superClassOf` (`om:superClassOf`) | Transitive object property | `owl:inverseOf rdfs:subClassOf`; the inverse edge is stored as a `subClassOf` edge |

  The characteristics stay on the relationship types for OpenMetadata's own navigation and
  validation. A property chain or property disjointness that names reserved vocabulary
  cannot be expressed in OWL 2 DL, so saving such a type fails with 400; for one stored
  before that check, the projection omits the axiom and logs a warning. Saving also fails
  for a type that is transitive, chained, or the inverse of such a type and is also
  functional, inverse-functional, irreflexive, asymmetric, or disjoint with another type,
  and for disjointness with such a type (OWL 2 DL simple roles).
- **Hierarchy.** Every parent link is `skos:broader`/`skos:narrower`. It is also
  `rdfs:subClassOf` only when both terms are OWL classes, that is, neither has concept type
  `SKOS_CONCEPT`. A thesaurus imported as SKOS no longer gains subclass axioms it never
  stated.
- **Class IRIs.** A term's OWL class is its `iri` when set, otherwise its entity IRI
  (`GlossaryTermClassIri`). The live metadata projection keeps the entity IRI as the term
  record's subject, because tags, realizations, relations and deletes address the record
  by it; `om:iri` records the class IRI there. No `owl:sameAs` joins the two.
- **Datatypes.** Cardinalities are `xsd:nonNegativeInteger`. A qualified restriction uses
  `owl:onDataRange` when its value is a literal, its filler names a datatype, or its
  property is a term attribute, and `owl:onClass` otherwise. `xsd:date` is not in the OWL 2
  datatype map, so a `DATE` attribute without an explicit `datatypeIri` ranges over
  `xsd:dateTime`. An explicit `datatypeIri` is kept exactly; one outside the map fails the
  profile check instead of being rewritten.

An attribute of a `SKOS_CONCEPT`-only term is a data property without `rdfs:domain`, since
that term is an individual, not a class. Not yet DL-checked: annex triples, which are merged
unchanged. Every non-deleted axiom is included regardless of lifecycle state.

For ontology-scoped SPARQL with `inference=owl`, `skos:broader` is no longer transitive; use
`skos:broader+`. With `rdfs` or `owl`, a `SKOS_CONCEPT` term no longer has its parent as a
superclass.

The projection is computed per request, so the change applies as soon as the server is
upgraded. Nothing is stored in Fuseki, so no rebuild is needed. Annex rows recorded by
earlier imports are unchanged.

## Ontology graphs in the live projection

The live projection writes the OWL view of each ontology entity into a graph the entity owns,
under the RDF base URI (ADR:2026-10-14-ontology-entities-own-their-named-graphs):

| Graph | Content |
|---|---|
| `graph/axiom/{axiomId}` | The axiom in the OWL 2 RDF mapping, with declarations, as in the export |
| `graph/relationshipType/{typeId}` | The type's object property: characteristics, domain, range, inverse, chain, disjointness, deprecation |
| `graph/glossaryTerm/{termId}` | The term's `owl:Class`, `rdfs:subClassOf` its parent's class when both are OWL classes, its attributes as data properties, and, when the class IRI is not the entity IRI, `om:mappedTo` and the realization role on the class IRI |

Every create, update, replay and reindex replaces the graph whole in one transaction, so
editing an axiom leaves none of its old restriction or list triples. Deleting the entity
drops its graph, and deleting an asset removes its copies on class IRIs. The axiom record in
the knowledge graph keeps its type, subject, property, target and status, but no longer
carries `om:expressions` or `om:literal`.

Discovery reads the class hierarchy across these graphs at query time, never through
`owl:sameAs` (ADR:2026-10-14-mapped-assets-are-reached-from-the-term-class-iri):

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?asset WHERE {
  ?class rdfs:subClassOf* <https://example.org/model/Party> .
  ?class om:mappedTo ?asset .
}
```

The graphs follow the same class-IRI and hierarchy rules as the export, with all non-deleted
axioms and terms projected whatever their status; reasoning selects among them by closure, below.
Relations of the `subClassOf` type stay between entity IRIs in the knowledge graph.

## Reasoning closures and version manifests

Production reasoning uses Approved axioms and Approved terms only; Draft and In Review changes
are checked as isolated candidates
(ADR:2026-10-15-reasoning-closures-are-approved-graphs-pinned-by-a-content-manifest,
ADR:2026-10-15-candidate-checks-add-draft-graphs-to-the-approved-closure). The serving dataset
keeps every graph above; three kinds of control graph select among them. They use the
`omr:` namespace, `https://open-metadata.org/reasoning/`, and are never reasoner input.

### Member records

`{base}graph/ontology/members` holds one record per ontology graph, written in the same SPARQL
update as the graph, so a record always describes the content the store holds. A deleted owner
has neither graph nor record.

| Predicate | Object |
|---|---|
| `rdf:type` | `omr:OntologyGraph` |
| `omr:graphOf` | The owner's entity IRI |
| `omr:entityType` | `"ontologyAxiom"`, `"glossaryTerm"` or `"relationshipType"` |
| `omr:lifecycleStatus` | The owner's `entityStatus`, such as `"Approved"` or `"In Review"`; absent when it has none |
| `omr:glossary` | The owning glossary's entity IRI; axioms and terms only |
| `omr:contentDigest` | The graph digest, `"sha256:<hex>"`; absent when the graph is too symmetric to digest |
| `omr:digestAlgorithm` | `"om-graph-v2"`, the algorithm of `omr:contentDigest`; absent with it |
| `omr:tripleCount` | Triples in the graph, `xsd:integer` |
| `omr:definesProperty` | The predicate a relationship type defines |
| `omr:usesProperty` | Each other object property the graph declares |

The **graph digest** (`om-graph-v2`, `OntologyGraphCanonicalForm`) is SHA-256 over the graph's
canonical N-Triples, one triple per line, lines sorted in Java string order, each ending in
`\n`. Nothing in it depends on blank node labels, so two writes of the same axiom, and the
store's copy of either, digest equally:

1. *Refinement.* A blank node's first colour is the SHA-256 hex of its incident triples, each
   written `s p o` with the node itself as `_:self`, other blank nodes as `_:` and everything
   else in N-Triples, sorted and joined by `|`. Its next colour is the SHA-256 hex of its colour,
   `\n`, and the same text with other blank nodes written `_:<colour>`. Rounds stop at the first
   that does not increase the number of distinct colours, keeping the colours before it.
2. *Distinguishing.* While colours tie, take the smallest tied colour; for each node with it,
   set its colour to SHA-256(colour + `*`), refine and repeat; keep the result whose text sorts
   first. If no triple joins more than two blank nodes, none is inside a triple term and the joins
   form no cycle, only the first such node is tried: the tied nodes are then interchangeable.
3. *Text.* Each blank node is written `_:b<colour>`; a triple term as `<<( s p o )>>`.

More than 1024 distinguishing steps, or 10,000,000 incident-triple visits in refinement, and
the graph has no digest: its member record omits `omr:contentDigest` and `omr:digestAlgorithm`,
and no closure can pin it. The OWL 2 RDF mapping only writes trees of blank nodes, which never
reach the bounds. Shared test vectors live in
`openmetadata-service/src/test/resources/rdf/digest-vectors` and in the store's tests.

### Closures

A glossary's **closure** pins its Approved axiom and term graphs, the relationship-type graphs
whose `omr:definesProperty` a member uses (followed through the types those types use), and the
closure of each glossary in `ontologyConfiguration.imports`. Its **ontology IRI** is the
glossary's `ontologyConfiguration.baseIri`, or its entity IRI, as in the export. Only member
records with `omr:digestAlgorithm "om-graph-v2"` are pinned. The **closure digest**
(`om-closure-v2`) is SHA-256 over UTF-8 lines, each ending in `\n`:

```text
om-closure-v2
ontology <ontology IRI>
glossary <glossary entity IRI>
selection APPROVED                       (or CANDIDATE)
member <graph IRI> sha256:<graph digest> (one per pinned graph, in graph-IRI order)
import <imported ontology IRI> sha256:<its closure digest>   (import lines sorted)
```

Every line can be recomputed from a manifest and the manifests it imports. A closure with a
missing import, an import cycle, or an Approved or used relationship-type graph without an
`om-graph-v2` digest has nothing a manifest could record for it, so it is never published:
activation and candidate publication both answer 409 with the problems.

It changes when, and only when, a member's triples, the member set, an import's closure, the
ontology IRI or the selection does. The **version IRI** is the ontology IRI, without a trailing
`/` or `#`, followed by `/version/<hex>`, or `/candidate/<hex>` for a candidate.

### Manifests and activation

A closure's manifest is the graph `{base}graph/manifest/<hex of the closure digest>`:

```turtle
<ontologyIri> a owl:Ontology ;
    owl:versionIRI <versionIri> ;
    owl:imports <imported version IRI> .            # one per direct import
<versionIri> a omr:OntologyVersion ;
    omr:ontology <ontologyIri> ;
    omr:glossary <glossary entity IRI> ;
    omr:selection "APPROVED" ;                      # or "CANDIDATE"
    omr:closureDigest "sha256:..." ;
    omr:digestAlgorithm "om-closure-v2" ;
    omr:memberCount 2 ;
    omr:createdAt "2026-10-15T08:00:00Z"^^xsd:dateTime ;
    omr:importsManifest <imported manifest graph> ; # one per direct import
    omr:candidateGraph <graph> .                    # candidates only
<member graph IRI> omr:pinnedDigest "sha256:..." .  # one per pinned graph
```

A manifest is written to a staging graph and moved into place with its header in one update,
so a reader never sees one without the other. Reasoning input for a closure is the graphs its
manifest pins plus, recursively, those of each `omr:importsManifest`, with the `owl:Ontology`
header; a member whose current `omr:contentDigest` differs from its `omr:pinnedDigest` has
changed since the manifest was written.

`{base}graph/ontology/activations` names each glossary's active Approved version:
`<glossary entity IRI> omr:activeManifest <manifest graph> ; omr:activeVersion <version IRI> ;
omr:ontology <ontology IRI> ; omr:closureDigest "sha256:..."`. Manifests that no activation,
retained candidate, or manifest they import needs are dropped ten minutes after they are written;
the 32 newest candidate manifests are kept.

| Endpoint | Effect |
|---|---|
| `GET /v1/ontology/reasoning/status` | Included axiom and term graphs, excluded ones by reason, active closures |
| `GET /v1/ontology/reasoning/closures/{glossaryId}` | The Approved closure as it stands; writes nothing |
| `POST /v1/ontology/reasoning/closures/{glossaryId}/activation` | Publishes the manifests of the glossary and its imports and activates them; 409 with problems on a missing import, an import cycle, degraded projection, or Approved graphs the store does not hold yet |
| `POST /v1/ontology/reasoning/closures/{glossaryId}/candidates?entityId=&changeSetId=` | Publishes a candidate closure with the Draft and In Review graphs of those entities, and returns the `CHECK` request for it; production is unchanged. 409 with problems on a missing import, an import cycle, or a graph without a current digest |

A candidate `CHECK` request names the ontology IRI, `ontologySelection: CANDIDATE`, and the
candidate closure digest as `ontologyDigest`; the store reads the manifest named by that digest.

## Upgrading an existing RDF store

Ontology graphs and their member records appear as each axiom, relationship type and term is
next written; until then, activation reports incomplete projection. Member records written
before `om-graph-v2` have no `omr:digestAlgorithm` and are reported the same way until the
graph is written again or `RdfIndexApp` runs. A `RdfIndexApp` run writes
all of them; with `recreateIndex=true` it also removes the
`om:expressions` and `om:literal` JSON earlier releases stored on axiom records. No
database migration is needed.

Run a full `RdfIndexApp` rebuild with `recreateIndex=true` after upgrading to 2.0.2.
This replaces untouched legacy lineage and extension triples, including orphaned
extension data from older writers, and refreshes the ontology in the serving
dataset. Query extensions using the fixed key/value vocabulary above. The rebuild
uses the configured dataset strategy and durable live-write recovery process.

## Regression coverage

`RdfColumnLineageTraversalTest` builds a graph of about 5,000 column mappings through the two
production writers and checks the queries above against an oracle that walks the edge list in Java.
`RdfMcpKnowledgeGraphIT` pages the same shape through MCP as a non-administrator against Fuseki, and
projects one real lineage edge with a real reindex to show the synthetic shape matches real output.

`RdfOntologyContractTest` projects populated fields from every entity JSON Schema,
structured fixtures, every built-in relationship enum value, detailed lineage,
and every built-in glossary relationship definition. It checks predicate
coverage in both directions, checks `base.jsonld` and the nested SQL mappings
against stored projected predicates, pins pre-existing unprojected flat SQL
mappings as known gaps (the other JSON-LD contexts and those gaps are tracked in
issue #34307), and requires explicit annotations for unprojected
terms. A Java syntax-tree scan additionally checks constant predicates in
conditional mapper branches. The tests never derive the writer's predicate list
from the ontology itself.

`OntologyClosuresTest` projects axioms, terms and relationship types into an in-memory dataset
as live writes do and checks closure selection, digests, paging, manifests, activation, imports,
retention and candidates with real SPARQL; `RdfOntologyActivationIT` checks the same through the
REST API against Fuseki.

When adding a projection, update the ontology and extend the structured fixture
if needed. New schema fields are sampled automatically. Unregistered writer
predicates and new ontology declarations without a projection or explicit
availability annotation fail the contract checks. Lineage and extension tests
also execute the generated updates against Jena models; the integration test
checks live writes, repeated full rebuilds, and live deletion after rebuilding
through the server's SPARQL endpoint.
