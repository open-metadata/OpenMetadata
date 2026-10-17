# Glossary DATE attributes range over xsd:dateTime, and SKOS_CONCEPT parents are not superclasses

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial) · v2 2026-10-14 (`BOTH` parent links stay subclass;
  the live term graphs assert them too)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `GlossaryOntologyModelBuilderTest#mapsAttributesIntoTheOwl2DatatypeMap`,
  `GlossaryOntologyModelBuilderTest#assertsSubclassForHierarchyOnlyBetweenOwlClasses` and
  `OntologyGraphProjectionTest#termGraphAssertsSubclassOnlyBetweenOwlClasses`
- **Related:** [#35202](https://github.com/open-metadata/OpenMetadata/issues/35202),
  [#35203](https://github.com/open-metadata/OpenMetadata/pull/35203),
  ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule,
  ADR:2026-10-14-ontology-entities-own-their-named-graphs

## Context

Two defaults in the glossary ontology projection decide what a DL reasoner concludes. A DATE term
attribute ranged over `xsd:date`, which is not in the OWL 2 datatype map, so the OWL 2 DL profile
check rejected any glossary with one. Every glossary parent link became both `skos:broader` and
`rdfs:subClassOf`, so a SKOS concept, which is not an OWL class, was made a subclass of its parent.

## Decision

- A DATE attribute without an explicit `datatypeIri` ranges over `xsd:dateTime`: it is in the
  OWL 2 datatype map, and unlike `xsd:dateTimeStamp` it does not require a timezone. An explicitly
  authored `datatypeIri` is kept as written; if it is outside the datatype map, the profile check
  reports it instead of the projection rewriting it.
- A glossary parent link is always `skos:broader` / `skos:narrower`. It is also
  `rdfs:subClassOf` only when neither term has concept type `SKOS_CONCEPT`. Terms of type `BOTH`,
  the default for terms created in OpenMetadata, keep the subclass link.

## Consequences

The projection is built from the database per request, so both rules apply on upgrade without a
rebuild. Ontology-scoped SPARQL with `inference=owl` returns fewer superclasses for `SKOS_CONCEPT`
terms, and no longer treats `skos:broader` as transitive, as SKOS itself does not; queries that
need the hierarchy use `skos:broader+`. Whether `BOTH` parent links stay subsumption, or the
importer records the authored predicate and subclass follows only from it, is open decision 9 in
the plan; settling it amends this record.

## Amendment

v2 (2026-10-14) settles open decision 9: a parent link between two `BOTH` terms stays
`rdfs:subClassOf`. The importer does not record which predicate the source used for the
structural parent, and subclass is not derived from such a record. The live projection follows
the same rule: each term's graph (ADR:2026-10-14-ontology-entities-own-their-named-graphs) asserts
`rdfs:subClassOf` from its class to its parent's class when neither has concept type
`SKOS_CONCEPT`, so classification over Fuseki sees the hierarchy the export states.
