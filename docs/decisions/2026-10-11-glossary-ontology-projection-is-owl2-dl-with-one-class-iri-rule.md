# The glossary ontology projection is OWL 2 DL with one class-IRI rule

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `GlossaryOntologyModelBuilderTest` (`projectsTheGlossaryAsOwl2Dl`,
  `namesClassesByAuthoredIriElseEntityIri`,
  `neverDeclaresReservedVocabularyAsPropertiesWithCharacteristics`,
  `omitsPropertyAxiomsThatWouldRedefineReservedVocabulary`) and
  `OntologyExpressionRdfWriterTest#roundTripsThroughOwlApiAsDlValidOwl`
- **Related:** [#35202](https://github.com/open-metadata/OpenMetadata/issues/35202),
  [#35203](https://github.com/open-metadata/OpenMetadata/pull/35203),
  [open-metadata/jena#1](https://github.com/open-metadata/jena/pull/1),
  `docs/plans/2026-10-07-fuseki-native-reasoning.md` (semantic projection, items 1, 4 and 8)

## Context

The reasoner worker in the `openmetadata/fuseki` image (open-metadata/jena) loads the glossary
ontology projection with OWL API 5.5.1 and classifies it with HermiT or ELK. It rejects a closure
that is outside OWL 2 DL instead of dropping axioms. The projection used to declare reserved
predicates as OWL properties with characteristics (`rdfs:subClassOf a owl:TransitiveProperty`, a
symmetric `rdfs:seeAlso`), typed cardinalities `xsd:int`, and named a term's class differently in
the exporter (`term.iri`) and the live projection (entity IRI), so the worker could not load it.

## Decision

- The projection is OWL 2 DL as OWL API 5.5.1 reads it with the worker's loader settings
  (non-strict parsing, imports never fetched so a missing import fails the load, no punning
  repair), with no placeholder entities and no triple the OWL 2 RDF mapping cannot consume: every
  class, property and individual is declared, cardinalities are `xsd:nonNegativeInteger`, and
  data restrictions use `owl:onDataRange`.
- A glossary term's OWL class IRI is its `iri` when set, otherwise its entity IRI
  (`<base>entity/glossaryTerm/<id>`) — `GlossaryTermClassIri`. No `owl:sameAs` joins the class
  to the entity record; the live projection keeps the entity IRI as the record's identity.
- A relationship type whose predicate is RDF, RDFS, OWL, XSD or SKOS vocabulary keeps that
  predicate's own meaning: it never receives characteristics or an inverse, and property chains
  and disjointness that name such a predicate are omitted with a warning. Built-in vocabulary is
  never declared; `om:` and SKOS terms get the kinds `openmetadata.ttl` and SKOS give them.

## Consequences

The worker can classify any closure this projection produces, and the OWL API tests fail on any
change that would break that. Linking a class to its catalog record needs an explicit,
non-`owl:sameAs` relation, which the discovery bridge in a later phase 3 slice adds. Changing the
class-IRI rule or the reserved-vocabulary handling changes the worker's input and needs a new
record; whether the seeded reserved types keep their characteristics is open decision 10 in the
plan.
