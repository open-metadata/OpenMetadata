# Ontology terms describe themselves, and a caller reads one term at a time

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `RdfOntologyDescriptionContractTest`, `OntologyDocumentTest`,
  `OntologyDescribeToolTest#everyClassReadsBackWholeWithinTheResponseBudget`
- **Related:** ADR:2026-09-16-agent-sparql-execution, `docs/rdf-ontology-contract.md`

## Context
A model exploring the knowledge graph sees which predicates leave a node, not what is behind them.
Most predicates in `openmetadata.ttl` carried only a label and a projection status, so the meaning
lived in prompts kept in other repositories. The full Turtle file exceeds the MCP response
budget, so `ontology_describe` without a `resource` returned a truncated prefix.

## Decision
- Every predicate that is declared and either written by the projection fixtures or the writers'
  constant predicates, or marked `om:Stored`, has a non-blank `rdfs:comment`. Every `om:` class the
  projection types a node with is declared as an `owl:Class` with a comment.
- `rdfs:domain` and `rdfs:range` are asserted only when they hold for every use the projection makes.
  A predicate shared by several entity types leaves the domain open and says so in its comment.
  External vocabulary terms get a usage comment and no domain or range of ours.
- A stored predicate with an open domain records each class the projection writes it on with
  `schema:domainIncludes`, declared as an `owl:AnnotationProperty` so it entails nothing. It is the
  established schema.org pattern for "used on these classes", and an annotation keeps the file OWL
  2 DL and RDFS reasoning unchanged. Classes come from the projection fixtures; relationship edges,
  which the fixtures write between untyped nodes, take theirs from the repositories that create the
  rows. A typed subject outside the recorded classes fails the build.
- `ontology_describe` takes `term`: a prefixed name or IRI of the bundled ontology. A class returns
  its own statements, those of every property whose `rdfs:domain` is the class or a superclass, and
  the label and comment of every shared property whose `schema:domainIncludes` names one of them;
  a property returns its own statements. Shared properties are cut to label and comment so the
  largest class entry (`om:Table`) fits within the 80,000-byte default response budget.
  Each shared property's own entry gives its range and classes. The tool follows blank-node
  objects to preserve lists. It serves term entries from the same static file as the full ontology,
  without requiring a permission. Supply at most one of `term` and `resource`. An undeclared term is an
  argument error.
- `owl:versionInfo` moves once per release, with one changelog entry for everything in it. A
  release that adds terms and corrects domains is a minor bump, as 1.1.0 was; the knowledge-graph
  release that carries these descriptions is 2.1.0.

## Consequences
Adding a stored predicate or a projected type without a comment fails the build, and so does a
domain or literal range the projection contradicts. Class ranges are only checked against literal
values: the fixtures point every reference at one shared id, so object types cannot be verified. Recorded
classes for relationship edges are not verified by the fixtures for the same reason.
No term is exempt. A class entry grows with every property whose domain covers
it; `om:Table` is about two thirds of the default budget, and the budget test fails before a class
outgrows it.
