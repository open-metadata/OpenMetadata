# Native relations instantiate registry relationship types

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** IndependentOntologyInverseIT, OntologyNativeRelation.utils.test.ts, RelationshipTypePicker.component.test.tsx
- **Related:** #35987, ADR:2026-10-14-ontology-definitions-have-independent-entity-storage, ADR:2026-10-17-glossaries-do-not-own-ontology-models, ADR:2026-10-19-native-ontology-imports-use-working-drafts

## Context

The native Studio let an author draw a relation between two classes, but the picker minted an ad-hoc object property for every new label, with a UUID-based IRI, no inverse, and no link to the shared relationship-type registry. The registry already seeds reciprocal pairs such as `partOf` with `hasPart` and `broader` with `narrower`, and admins extend it with custom types for glossaries. `owl:inverseOf` is symmetric, yet a native property stored its `inverse` IRI on one side only, imported OWL often states the pair in one direction, and the concept inspector labelled an incoming relation with the outgoing predicate. Two vocabularies for the same idea, and a model that could not say `Has Part · Account` from the target's side, were the result.

## Decision

The native relation picker offers the registry's types. **Core · OWL/SKOS** lists the `CORE` and `OWL_SKOS` categories. **Custom · admin-defined** lists the `CUSTOM` types and the ontology's own object properties that no registry type backs. Each option shows its inverse. Picking a type from class A to class B instantiates it as native object properties: one with the type's exact `rdfPredicate` as its IRI and one with the inverse type's predicate, linked through `inverse` and reused by IRI when the ontology already has them, followed by the axiom `A SubClassOf T some B`. No axiom is written on B, because `A SubClassOf hasPart some B` does not entail `B SubClassOf partOf some A`; the inspector reads the relation from either side through the inverse. `subClassOf` and `superClassOf` map onto the existing `SUBCLASS_OF` axiom. Types whose predicate is an annotation property, such as `rdfs:seeAlso`, are not offered, because a restriction on an annotation property is outside OWL 2 DL.

Native properties stay native entities, per ADR:2026-10-14-ontology-definitions-have-independent-entity-storage. The registry supplies names, predicates, and inverses; it does not define or own the properties, and a native property carries no reference to a registry type. The match between the two is the exact predicate IRI, which is how imports already keep SKOS predicates, per ADR:2026-10-19-native-ontology-imports-use-working-drafts.

The server keeps native inverses reciprocal on write. Setting `inverse` from P to Q also sets it from Q to P in the same transaction and working revision. Clearing or deleting one side clears the other. A statement made in one direction, whether by the API or by an applied import, is normalized rather than refused. An `inverse` IRI that names no live object property is still refused.

The picker's create option appears only for users who can create a `RelationshipType`. It creates a `CUSTOM` registry type with its inverse through the registry API and then instantiates the pair. The picker no longer mints native properties inline.

## Consequences

Glossaries and native ontologies share one vocabulary of relation names, predicates, and inverses, and a custom type created from the Studio is available to glossary pickers as well. Exported releases carry `owl:inverseOf` in both directions. A registry type edited after instantiation does not rename the native properties made from it; they are independent definitions with their own display names, per the records above. A data steward, who has no `Create` on `relationshipType`, sees the registry's types but no create option.
