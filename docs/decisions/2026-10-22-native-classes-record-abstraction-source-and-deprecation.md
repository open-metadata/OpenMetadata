# Native classes record abstraction, source, and deprecation as standard RDF annotations

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyReleaseProjectionTest`, `NativeOntologyRdfImporterTest`, `OntologyStructureValidatorTest`, `OntologyReleaseComparisonTest`, `IndependentOntologyClassModelIT`, `NativeOntologyMemoryIT`
- **Related:** #35988, ADR:2026-10-14-ontology-definitions-have-independent-entity-storage

## Context

Ontology Studio authors classes that have no direct instances, cite the standard their definition
comes from, and retire in favor of a successor. Native concepts and properties had no fields for
these facts, so a release export could not state them, and a release diff showed a retirement as
an ordinary change. The Studio also lists a new class as one change row with its parents and
property count, which the flat working diff cannot supply.

## Decision

- Concepts carry `abstract`, `definitionSource`, `deprecated`, and `replacedBy`. Properties carry
  `deprecated` and `replacedBy`. `abstract` and `deprecated` default to false. The class layer stays
  on the ontology.
- `replacedBy` names another definition of the same kind in the same ontology, never the definition
  itself. The reference index records it with the role `REPLACED_BY`, so deleting the replacement is
  refused like any other dangling reference.
- Releases project the fields as `om:abstract true`, `dct:source <iri>`, `owl:deprecated true`, and
  `dct:isReplacedBy <iri>`, where `om:` is `https://open-metadata.org/ontology/`. OWL has no
  abstract-class construct, so `om:abstract` is an annotation property. False and absent values
  project nothing. Native import reads the same four predicates and requires `xsd:boolean` values
  and IRIs.
- A data enumeration needs at least two allowed values. An empty list means no enumeration. The
  schema states this as `not: {minItems: 1, maxItems: 1}`, because `minItems: 2` would reject the
  empty default. `OntologyPropertyRepository` enforces it on every write, with the message
  `An enumeration needs at least two allowed values`. A one-value enumeration stored before this
  rule stays editable until its values change.
- A member whose `deprecated` turned true diffs as `DEPRECATED` in release and working diffs.
  Clearing the flag, or editing a deprecated member, is `CHANGED`.
- `GET /ontologies/{id}/working/diff?groupBy=concept` returns `groups` and an empty `data`. A group
  names a concept, its own change type or `CHANGED` when only its axioms or properties changed, the
  labels of its named `SUBCLASS_OF` parents, the count of properties whose domain includes it, and
  its member changes. An axiom joins its subject. A property joins the first concept in its domain
  that this ontology declares. A change that belongs to no concept, such as the ontology root or an
  axiom about an external subject, forms a group without a concept, so the groups cover every
  working change. Groups sort by label and then IRI, and concept-less groups come last. Paging
  counts groups. The cursor is bound to the working and activation revisions like the plain cursor,
  and uses its own prefix, so neither cursor is accepted by the other view.

## Consequences

Other OWL tools can read the exported deprecation and source. Releases captured before this change
compare unchanged, because both sides of a comparison read the new fields with their defaults.
Clients that read grouped changes must handle a group without a concept. Grouping reads the same
working content and active release as the plain diff and adds no queries.
