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
coverage in both directions and requires explicit annotations for unprojected
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
