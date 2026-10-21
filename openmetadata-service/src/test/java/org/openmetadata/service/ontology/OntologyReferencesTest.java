package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.service.exception.BadRequestException;

class OntologyReferencesTest {
  private static final EntityReference OWNER =
      new EntityReference().withId(UUID.randomUUID()).withType("ontology");

  @Test
  void propertiesIndexEveryReferenceRoleWithoutIndexingTheirOwnDeclaration() {
    OntologyProperty property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withOntology(OWNER)
            .withIri(iri("declared"))
            .withDomain(List.of(iri("shared")))
            .withRange(List.of(iri("shared")))
            .withInverse(iri("inverse"))
            .withPropertyChain(List.of(iri("first"), iri("second"), iri("first")))
            .withDisjointWith(List.of(iri("disjoint")))
            .withEnumValues(
                List.of(new OntologyLiteral().withValue("value").withDatatypeIri(iri("datatype"))));
    List<OntologyReference> references = OntologyReferences.collect(property);
    assertEquals(
        Set.of(
            "DOMAIN:shared",
            "RANGE:shared",
            "INVERSE:inverse",
            "PROPERTY_CHAIN:first",
            "PROPERTY_CHAIN:second",
            "DISJOINT_PROPERTY:disjoint",
            "DATATYPE:datatype"),
        keys(references));
    for (OntologyReference reference : references) {
      assertEquals(OWNER.getId(), reference.getOntologyId());
      assertEquals(property.getId(), reference.getSource().getId());
      assertEquals("ontologyProperty", reference.getSource().getType());
    }
  }

  @Test
  void mappingsPreserveCaseDistinctIrisAndDeduplicateOnlyTheSameRoleAndSpelling() {
    OntologyConcept concept =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withOntology(OWNER)
            .withConceptMappings(
                List.of(
                    mapping("urn:Example:Customer", "urn:example:scheme"),
                    mapping("urn:example:Customer", "urn:example:scheme"),
                    mapping("urn:example:Customer", null)));
    assertEquals(
        Set.of(
            "MAPPING_TARGET:Example:Customer",
            "MAPPING_TARGET:example:Customer",
            "MAPPING_SCHEME:example:scheme"),
        keys(OntologyReferences.collect(concept)));
  }

  @Test
  void nestedExpressionsAndAssertionsIncludeIndividualsPropertiesAndDatatypes() {
    OntologyExpression nested =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.INTERSECTION)
            .withOperands(
                List.of(
                    new OntologyExpression()
                        .withKind(OntologyExpressionKind.NAMED_CLASS)
                        .withClassIri(iri("class")),
                    new OntologyExpression()
                        .withKind(OntologyExpressionKind.RESTRICTION)
                        .withPropertyIri(iri("nestedProperty"))
                        .withFiller(
                            new OntologyExpression()
                                .withKind(OntologyExpressionKind.ONE_OF)
                                .withIndividualIris(List.of(iri("one"), iri("two")))),
                    new OntologyExpression()
                        .withKind(OntologyExpressionKind.RESTRICTION)
                        .withPropertyIri(iri("valueProperty"))
                        .withIndividualIri(iri("value")),
                    new OntologyExpression()
                        .withKind(OntologyExpressionKind.RESTRICTION)
                        .withPropertyIri(iri("dataProperty"))
                        .withLiteral(
                            new OntologyLiteral().withValue("1").withDatatypeIri(iri("type")))));
    OntologyAxiom axiom =
        new OntologyAxiom()
            .withId(UUID.randomUUID())
            .withOntology(OWNER)
            .withSubjectIri(iri("subject"))
            .withPropertyIri(iri("assertedProperty"))
            .withTargetIri(iri("target"))
            .withLiteral(new OntologyLiteral().withValue("2").withDatatypeIri(iri("type")))
            .withExpressions(List.of(nested));
    assertEquals(
        Set.of(
            "AXIOM_SUBJECT:subject",
            "PROPERTY:assertedProperty",
            "INDIVIDUAL:target",
            "CLASS_EXPRESSION:class",
            "PROPERTY:nestedProperty",
            "INDIVIDUAL:one",
            "INDIVIDUAL:two",
            "PROPERTY:valueProperty",
            "INDIVIDUAL:value",
            "PROPERTY:dataProperty",
            "DATATYPE:type"),
        keys(OntologyReferences.collect(axiom)));
  }

  @Test
  void removedDefinitionsAndNamespacesHaveNoOutgoingReferences() {
    assertTrue(OntologyReferences.collect(new Ontology().withId(OWNER.getId())).isEmpty());
    assertTrue(
        OntologyReferences.collect(
                new OntologyConcept()
                    .withDeleted(true)
                    .withConceptMappings(List.of(mapping("urn:target", null))))
            .isEmpty());
  }

  @Test
  void indexingRejectsRelativeReferencesAndBoundsExpressionTraversal() {
    OntologyProperty property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withOntology(OWNER)
            .withInverse(URI.create("relative"));
    assertThrows(BadRequestException.class, () -> OntologyReferences.collect(property));
    OntologyExpression cyclic = new OntologyExpression().withKind(OntologyExpressionKind.UNION);
    cyclic.setOperands(List.of(cyclic));
    OntologyAxiom axiom =
        new OntologyAxiom()
            .withId(UUID.randomUUID())
            .withOntology(OWNER)
            .withExpressions(List.of(cyclic));
    assertThrows(BadRequestException.class, () -> OntologyReferences.collect(axiom));
  }

  private static ConceptMapping mapping(String target, String scheme) {
    return new ConceptMapping()
        .withConceptIri(URI.create(target))
        .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)
        .withSchemeIri(scheme == null ? null : URI.create(scheme));
  }

  private static URI iri(String value) {
    return URI.create("urn:" + value);
  }

  private static Set<String> keys(List<OntologyReference> references) {
    return references.stream()
        .map(
            reference ->
                reference.getRole().value() + ":" + reference.getIri().toString().substring(4))
        .collect(Collectors.toSet());
  }
}
