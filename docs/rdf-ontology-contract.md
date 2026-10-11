# RDF projection and ontology contract

`openmetadata-spec/src/main/resources/rdf/ontology/openmetadata.ttl` declares the
predicates used by the metadata projection. Its `om:projectionStatus` annotations
make availability explicit:

| Status | Meaning |
| --- | --- |
| `om:Stored` | The projection writes the predicate when the corresponding field or relationship is populated. Queries work with `inference=none`. Optional fields need not be present on every entity. |
| `om:InferenceOnly` | The metadata projection does not supply this predicate. It is retained for custom inference, external ontology data, or an explicit export path described in its comment. Enabling RDFS or OWL alone does not guarantee any matching triples. |

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

## Domain membership

An asset's `domains` are projected as `om:belongsToDomain`, the predicate already used
for the singular `domain` field. `om:domains` is deprecated: the next projection of
each entity removes it, and a full rebuild removes it everywhere.

## Concept realizations

Each entry in a glossary term's `realizedIn` links the term to the asset twice: with
`om:mappedTo`, written from the stored realization relationship, and with a predicate
for the asset's role:

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

## Upgrading an existing RDF store

Run a full `RdfIndexApp` rebuild with `recreateIndex=true` after upgrading to 2.0.2.
This replaces untouched legacy lineage and extension triples, including orphaned
extension data from older writers, and refreshes the ontology in the serving
dataset. Query extensions using the fixed key/value vocabulary above. The rebuild
uses the configured dataset strategy and durable live-write recovery process.

## Regression coverage

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
