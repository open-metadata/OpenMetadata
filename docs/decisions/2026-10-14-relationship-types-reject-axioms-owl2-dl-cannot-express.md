# Relationship types reject property axioms OWL 2 DL cannot express when they are saved

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RelationshipTypeGraphValidatorTest` and `RdfOntologyProjectionIT`
- **Related:** `docs/plans/2026-10-07-fuseki-native-reasoning.md` (open decision 10),
  ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule

## Context

The projection silently dropped a property chain or property disjointness that named reserved
vocabulary, and saved types that broke the OWL 2 DL restrictions on simple roles, such as a
transitive functional type, so a closure containing them failed only at classification.

## Decision

Creating or updating a relationship type fails with 400 when:

- its predicate is RDF, RDFS, OWL, XSD or SKOS vocabulary and it has a property chain or property
  disjointness, or a chain member or disjoint type has such a predicate, or it is changed to such
  a predicate while another type names it in a chain or disjointness;
- it is not simple, that is transitive, defined by a chain, or the inverse of such a type, and it
  is also functional, inverse-functional, irreflexive or asymmetric, or disjoint with a type;
- it is disjoint with a type that is not simple, or it becomes not simple while another type is
  disjoint with it or is its inverse with one of those characteristics.

The seeded reserved types (`subClassOf`, `broader`, `narrower`, `seeAlso`, `synonym`) keep
`TRANSITIVE` and `SYMMETRIC` as navigation hints. A reserved type's characteristics, chain and
inverse are never projected, so they do not make it, or a type whose inverse it is, non-simple.
`RelationshipTypeResolver.isSimple`, which the axiom guard uses for cardinality restrictions,
applies the same rule.

## Consequences

Requests that were accepted before can now fail, with a message naming the type and the rule.
Stored types are not migrated: one that breaks a rule saves again only once fixed, and until then
the projection still omits a reserved chain or disjointness with a warning. Subproperty axioms
are not authorable, so no other way of becoming non-simple exists yet.
