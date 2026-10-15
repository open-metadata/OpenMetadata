# Mapped assets are reached from a term's class IRI, without owl:sameAs

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyGraphProjectionTest#mappedTableIsFoundThroughASubclassChain` and
  `RdfOntologyProjectionIT#mappedTableIsFoundThroughTheSubclassChain`
- **Related:** `docs/plans/2026-10-07-fuseki-native-reasoning.md` (asset associations, semantic
  projection items 4 and 5), ADR:2026-10-14-ontology-entities-own-their-named-graphs,
  ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule

## Context

Discovery evaluates `?c rdfs:subClassOf* :Party . ?c om:mappedTo ?asset` at read time over the
class hierarchy. Class axioms name a term by its class IRI, its authored `iri` when set, while the
live `om:mappedTo` edge and the realization role hang off the term record's entity IRI. For a term
with an authored IRI the two never met, so the query found nothing.

## Decision

- A term's graph repeats each realization on the class IRI, as `om:mappedTo` plus the role
  predicate (`om:hasPrimaryStore`, `om:hasDerivedAsset`, `om:hasReplica`), when the class IRI is
  not the entity IRI. When they are the same, the record's own edges already serve the query.
- The term graph also asserts `rdfs:subClassOf` from the term's class to its parent's class when
  both are OWL classes, so parent links take part in the hierarchy as authored axioms do.
- Rejected: `owl:sameAs` between record and class, which identifies a catalog record with a
  class for every consumer; an `om:termClass` link from record to class, which leaves the query
  needing a join through the record; and a mapping per ancestor class, which the plan forbids.

## Consequences

The query above returns a table mapped to any subclass of `:Party`, whichever IRI the classes
use. The mapping never types the asset as an instance of the class. Removing a realization is a
term update, which replaces the term's graph; deleting an asset removes the copies on class IRIs.
The copies live in term graphs, so `GRAPH <knowledge>` queries do not see them.
