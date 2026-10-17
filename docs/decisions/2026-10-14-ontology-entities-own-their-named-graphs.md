# Ontology axioms, relationship types and glossary-term classes each own a named graph that is replaced whole

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyGraphProjectionTest`, `OntologyGraphsTest`, `RdfRepositoryOntologyGraphTest`
  and `RdfOntologyProjectionIT`
- **Related:** `docs/plans/2026-10-07-fuseki-native-reasoning.md` (semantic projection items 2
  and 3, phase 3), ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule,
  ADR:2026-10-14-mapped-assets-are-reached-from-the-term-class-iri

## Context

The live projection wrote an ontology axiom as JSON literals (`om:expressions`, `om:literal`) on
its record in the shared knowledge graph, so Fuseki held no OWL for it, and relationship-type
axioms and term attributes were not projected live at all. Writing their OWL 2 RDF mapping into
the knowledge graph would not work either: entity writes delete by subject and predicate, which
leaves a replaced restriction's blank nodes and RDF lists behind, and an attribute declaration's
subject is the property, not the term.

## Decision

- Under the RDF base URI, beside `graph/inferred/`, each entity owns one graph:

  | Graph | Content |
  |---|---|
  | `graph/axiom/{axiomId}` | The axiom in the OWL 2 RDF mapping, with declarations (`OntologyExpressionRdfWriter`) |
  | `graph/relationshipType/{typeId}` | The type's object property and its axioms (`RelationshipTypeRdfWriter`) |
  | `graph/glossaryTerm/{termId}` | The term's class declaration, `rdfs:subClassOf` its parent's class when both are OWL classes, its attributes as data properties, and its realizations on the class IRI when that is not the entity IRI |

  Per relationship type, not per glossary: types are global and few, and a type's graph changes
  only when the type does. Per term, not per glossary: a glossary-wide graph would rewrite every
  term on each edit. The term record keeps its SKOS and catalog view in the knowledge graph.
- A graph is replaced by one SPARQL update, `DROP SILENT GRAPH` followed by one `INSERT DATA`,
  sent through `executeSparqlUpdate`. Fuseki applies it as one transaction, and the update passes
  through the same storage decorators as every live write: asserted-graph tracking, inference
  invalidation, and blue/green capture and replay. Graph Store `PUT` was not used: the bounded
  Graph Store handler appends to the knowledge graph only, and a `PUT` would bypass rebuild
  capture unless the storage interface grew a new operation. Updates are packed up to
  `maxUpdatePayloadBytes`; one larger graph is sent alone.
- A soft-deleted entity projects an empty graph, which drops it; a hard delete drops it too, and
  any entity's delete removes triples in term graphs that point at it.
- The live write (`RdfRepository.createOrUpdate`, after the record), the reindex
  (`RdfBatchProcessor`, after each batch's records) and replay all replace the graphs. Writing a
  relationship type also replaces the graphs of types whose inverse, chain, disjointness or
  replacement name it.
- An axiom's restriction is a data restriction when its property is an attribute of a term in the
  axiom's glossary, as in the export.
- A term attribute names its term as `rdfs:domain` only when the term is an OWL class; a
  `SKOS_CONCEPT` term is an individual, so in the export too its attributes have no domain.
- The axiom record no longer carries `om:expressions` or `om:literal`. No reader depends on them:
  no OpenMetadata server, UI or MCP code queries them, and a code search of `ai-platform` and
  `openmetadata-collate` on 2026-10-14 found none. Both stay declared, deprecated, in
  `openmetadata.ttl`, and an axiom's next write removes them.

## Consequences

An edit leaves no orphaned restriction or list triples, and a reasoner can read an ontology from
Fuseki graph by graph. Existing stores gain the graphs as each entity is next written; a
`RdfIndexApp` run writes all of them, and with `recreateIndex=true` also removes every old JSON
literal. No SQL migration is needed.

The number of named graphs grows with terms, axioms and types. While materialized inference is
enabled, asserted-only reads name every non-inferred graph in `FROM`
(ADR:2026-10-11-asserted-only-rdf-reads-name-every-non-inferred-graph), so their query text grows
with it until phase 4 retires that rule. Entity-graph exploration matches `GRAPH ?g` patterns, so
it now also shows a term's parent as a `subClassOf` edge.

Known gaps: a term graph reads its parent's class IRI and concept type when the term is written,
so changing them on the parent reaches children only when they are next written or reindexed. An
axiom written before the attribute it restricts declares that property an object property until
the axiom is rewritten; the OWL 2 DL profile check reports the punning. Relations of the
`subClassOf` type stay between entity IRIs in the knowledge graph.

Lifecycle activation, imports and version manifests can select graphs by these IRIs: a closure is
a set of axiom, term and type graphs, and a manifest can pin each graph with a digest of its
triples. Candidate checks need graphs outside the serving dataset.
