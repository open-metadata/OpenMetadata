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

## Glossary and native ontology boundaries

Glossary terms retain configurable relations, external mappings and their existing tag assignments.
The unreleased `realizedIn`, class-kind and property-authoring fields have been removed. Native
ontology definitions use their own entities and approved release graph; native links to data assets
are a separate follow-up. See ADR:2026-10-17-glossaries-do-not-own-ontology-models.

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
glossary-scoped `POST /v1/glossaries/{id}/sparql` build one glossary's vocabulary from the
database on each request; they do not read the knowledge graph. That projection is OWL 2
DL: OWL API, configured as the reasoner worker configures it, parses it without
placeholders or unconsumed triples, and its OWL 2 DL profile check reports nothing for
valid input (`GlossaryOntologyModelBuilderTest`).

- **Declarations.** Every class, object property, data property, annotation property, and
  named individual the projection uses is declared. SKOS terms are declared with the kind
  the SKOS reference vocabulary gives them (`skos:broader` is an object property,
  `skos:prefLabel` an annotation property), and
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
  cannot be expressed in OWL 2 DL; the projection omits that axiom and logs a warning.
- **Hierarchy.** A glossary parent link is `skos:broader`/`skos:narrower`. It does not invent
  a subclass axiom. Explicit configured relation predicates retain their released meaning.
- **Identity.** A term uses its authored `iri`, otherwise its entity IRI
  (`GlossaryTermClassIri`). The live metadata projection keeps the entity IRI as the record's
  subject, because tags, relations and deletes address that record. `om:iri` records its external
  IRI; no `owl:sameAs` joins the two.
- **Properties and axioms.** Native ontology properties and axioms are projected from the active
  approved release. Glossaries do not author them. RDF import retains ordinary glossary custom
  properties under the existing administrator permission check and preserves unrepresented RDF
  in the annex. Annex triples are merged unchanged and are not DL-checked.

Glossary projection is computed per request. Native activation replaces the ontology's active
release graph in Fuseki; see ADR:2026-10-15-fuseki-holds-only-the-active-ontology-release.
Development installations that used the retired glossary realization fields need an RDF rebuild
alongside the SQL cleanup to remove their old triples.

## Upgrading an existing RDF store

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

When adding a projection, update the ontology and extend the structured fixture
if needed. New schema fields are sampled automatically. Unregistered writer
predicates and new ontology declarations without a projection or explicit
availability annotation fail the contract checks. Lineage and extension tests
also execute the generated updates against Jena models; the integration test
checks live writes, repeated full rebuilds, and live deletion after rebuilding
through the server's SPARQL endpoint.
