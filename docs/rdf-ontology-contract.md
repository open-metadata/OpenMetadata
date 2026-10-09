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

## Column lineage

`RdfIndexApp` writes one node per column mapping, linked from the lineage details of its
table edge. The projection writes the columns' fully qualified names as **plain string
literals**, not IRIs (`RdfRepository.buildLineageModel`):

```turtle
<output> om:upstream <source> ; prov:wasDerivedFrom <source> .
<source> om:downstream <output> ; om:hasLineageDetails <details> .
<details> om:hasColumnLineage <details/columnLineage/col_0> .
<details/columnLineage/col_0> a om:ColumnLineage ;
    om:fromColumn "svc.db.schema.source.c1", "svc.db.schema.source.c2" ;
    om:toColumn   "svc.db.schema.output.col" ;
    om:transformFunction "..." .
```

One mapping can have several `om:fromColumn` values. Columns are separate resources, which is how a
literal reaches its owning asset: `<asset> om:hasColumn <col>`, `<col> om:fullyQualifiedName "fqn"`,
and nested columns hang off their parent with `om:hasChildColumn`. The ontology and the
`ColumnLineageShape` SHACL shape still describe `om:fromColumn` and `om:toColumn` as column IRIs; the
projection does not write them that way, so that shape does not match what is projected (tracked in
#34864). Literal matching is exact: only an untyped plain literal equals `"fqn"`.

### Traversal and paging

All columns downstream of one column, with the asset that owns each, one page at a time:

```sparql
PREFIX om: <https://open-metadata.org/ontology/>
SELECT DISTINCT ?column ?asset WHERE {
  "svc.db.schema.table.col" (^om:fromColumn/om:toColumn)+ ?column .
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
- **Freshness.** Column mappings reach the graph only on an `RdfIndexApp` run. A live
  `PUT /v1/lineage` projects the table edge but not its `LineageDetails`, so a new mapping appears
  after the next reindex.

Measured on a graph of 5,006 mappings (a six-hop chain, a fan-out of one column into 450, a rename hop,
a multi-source mapping, a cycle, a dashboard data model hop and a nested column): the 2,705 columns
downstream of the source column take 330 ms in memory, and 11 pages of 250 rows take 49 to 230 ms each
(about 51 KB per page) through the MCP `sparql_query` tool against Fuseki.

`om:hasChildColumn` is projected for nested table columns even though the ontology labels it
`om:InferenceOnly`: a real `RdfIndexApp` run over a table with a struct column writes it, so queries
need no inference. The MCP description test lists it as a justified exception, and the stale label
is tracked in #34864.

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
