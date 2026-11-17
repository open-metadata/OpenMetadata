# Ontology property hierarchies are superproperty fields on the property

- **Status:** Accepted
- **Revisions:** v1 2026-11-07 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `OntologyStructureValidatorTest`, `OntologyPropertyRulesTest`, `OntologyReleaseProjectionTest`, `NativeOntologyRdfImporterTest`, `UpstreamOntologyImportTest`, `OntologyPackSlicePlanTest`, `IndependentOntologyPropertyHierarchyIT`, `RdfOntologyPropertyHierarchyIT`, `NativeOntologyPackInstallJobIT`
- **Related:** ADR:2026-10-19-native-ontology-imports-use-working-drafts, ADR:2026-10-14-ontology-definitions-have-independent-entity-storage, ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule

## Context
Every published vocabulary states `rdfs:subPropertyOf`. The FIBO production quickstart has 799
links, FHIR R5 274, schema.org 212 and the GS1 Web Vocabulary 92. The native model had no place
for them, so the importer skipped and reported each one, exports lost them, and a native ontology
could not say that `hasChild` specializes `hasRelative`.

Class hierarchies are `OntologyAxiom` entities of type `SUBCLASS_OF`, because a subclass axiom
can name a class expression. A property hierarchy only ever links named properties, and the
property's other axioms that link named properties (`inverse`, `propertyChain`,
`disjointWith`) are fields on the property. The links also change how OWL 2 DL treats the
property: a composite property makes every superproperty above it non-simple, and the regular
order on chains must respect the hierarchy.

## Decision
- `OntologyProperty.superProperties` is a set of semantic IRIs (`uniqueItems`, default `[]`),
  the `rdfs:subPropertyOf` statements of the property. It is a field, not an axiom entity, for
  the reason the other property axioms are fields: it links named properties only, it is part of
  the property's own declaration, and the write closure, the reference index
  (`OntologyReferenceRole.SUPER_PROPERTY`), the release diff, the CSV codec and the RDF export
  all read it as one more property field. No storage migration: the field lives in the entity
  JSON, and the reference index rebuilds from it.
- Every superproperty must be a declared property of the same kind (object, data or annotation)
  or a vocabulary property of that kind (`owl:topObjectProperty`, `rdfs:comment`, ...). A
  property cannot name itself (`OntologyPropertyRules`), and the links of an ontology cannot
  form a cycle (`SUBPROPERTY_CYCLE`). OWL 2 DL admits a cycle as a statement of equivalence; the
  native model refuses it, because Studio shows the hierarchy as a tree and an equivalence is a
  different statement (`owl:equivalentProperty`, which stays skipped on import).
- Simplicity follows OWL 2 DL section 11.1: a property with a chain, a transitive property, and
  every property above one of them through `superProperties` and inverses is non-simple. A
  non-simple property cannot be functional, inverse-functional, asymmetric or irreflexive, cannot
  be disjoint with another property, and cannot carry a cardinality or self restriction. The
  violation is reported on the property that carries the characteristic
  (`NON_SIMPLE_PROPERTY /characteristics`) and on each property whose own superproperty link
  makes such an ancestor non-simple (`NON_SIMPLE_PROPERTY /superProperties`), so editing only the
  subproperty is refused too.
- Regularity follows section 11.2 literally: the order is built from the chain axioms alone, and
  a property is irregular when a chain places it below one of its own subproperties or inverses
  of them, or when the chain order loops. Superproperty links on their own never break the order;
  `a ⊑ b, b ⊑ inv(a)` is legal, as the OWL API's `OWL2DLProfile` agrees.
- Import keeps `rdfs:subPropertyOf` between declared properties of the same kind. A link to a
  property that neither the file nor the target declares is dropped and counted under
  `UNDECLARED_REFERENCE`; a link to a property of another kind, or to the property itself, is
  dropped under `UNSUPPORTED_STRUCTURE`, and so is every link on a cycle, since a cycle states
  equivalence. The property itself still imports, unlike a property
  whose domain or range names an undeclared class, because GS1 and FHIR name external
  superproperties on most of their properties and refusing the property would refuse the
  vocabulary. The fixed-point refusal loop of the importer prunes links after each pass, so a
  link to a refused superproperty is dropped rather than refusing the subproperty.
- The library install plan orders a subproperty after its superproperties, as it already orders
  a property after its inverse, chain members and disjoint partners.
- The release export writes `rdfs:subPropertyOf` with the superproperty declared by the kind's
  OWL class. The CSV format gains a `superProperties` column after `disjointWith` (28 columns);
  the older headers are refused, as every earlier widening was.

## Consequences
- The FIBO production quickstart now keeps 787 of its 799 links (10 name blank-node or inverse
  expressions, 2 name undeclared properties), schema.org 210 of 212 (one names an undeclared
  property, one a property of another kind), and FHIR R5 none of its 274, which all name the
  external W5 vocabulary. GS1 keeps 1 of 92: 30 name schema.org properties the pack does not
  ship, and 61 belong to the link-type properties, which import refuses because each is an object
  property whose range is the datatype `xsd:anyURI`. None of the four states a cycle, and no
  definition of those files is refused because of the hierarchy. The counts are links in the
  planned import, not links the reader keeps.
- A property hierarchy is a tree or a DAG, never a cycle; a vocabulary that states equivalent
  properties through a cycle imports without the cycle's links. Revisit if a shipped standard
  needs property equivalence, which would be an `equivalentProperties` field with its own rules.
- Studio edits the links in the property editor as a same-kind picker. A property tree view is
  not part of this record.
