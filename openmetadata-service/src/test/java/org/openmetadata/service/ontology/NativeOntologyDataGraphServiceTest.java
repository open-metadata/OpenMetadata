package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Link;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Target;

class NativeOntologyDataGraphServiceTest {
  private static final URI RELATES_TO = URI.create("http://example.org/model#relatesTo");
  private static final URI OWNS = URI.create("http://example.org/model/owns");
  private static final URI CUSTOMER = URI.create("http://example.org/model#Customer");
  private static final URI ORDER = URI.create("http://example.org/model#Order");
  private static final URI INVOICE = URI.create("http://example.org/model#Invoice");

  @Test
  void anAssertionYieldsItsPropertyAndTarget() {
    final var axiom =
        new OntologyAxiom()
            .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
            .withSubjectIri(CUSTOMER)
            .withPropertyIri(RELATES_TO)
            .withTargetIri(ORDER);
    assertEquals(
        List.of(new Target(RELATES_TO, ORDER)), NativeOntologyDataGraphService.targets(axiom));
    assertEquals(List.of(), NativeOntologyDataGraphService.targets(axiom.withTargetIri(null)));
  }

  @Test
  void restrictionsInsideIntersectionsAndUnionsYieldEveryNamedFiller() {
    final var axiom =
        new OntologyAxiom()
            .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
            .withSubjectIri(CUSTOMER)
            .withExpressions(
                List.of(
                    named(INVOICE),
                    intersection(
                        restriction(RELATES_TO, union(named(ORDER), named(INVOICE))),
                        restriction(OWNS, named(ORDER)),
                        restriction(null, named(ORDER)),
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.RESTRICTION)
                            .withPropertyIri(OWNS)
                            .withRestrictionKind(OntologyRestrictionKind.SOME)
                            .withFiller(
                                new OntologyExpression()
                                    .withKind(OntologyExpressionKind.ONE_OF)))));
    assertEquals(
        List.of(
            new Target(RELATES_TO, ORDER),
            new Target(RELATES_TO, INVOICE),
            new Target(OWNS, ORDER)),
        NativeOntologyDataGraphService.targets(axiom));
  }

  @Test
  void anUndeclaredOrHiddenPropertyIsLabelledByItsLocalName() {
    final var link = new Link(UUID.randomUUID(), UUID.randomUUID(), RELATES_TO);
    final var edge = link.edge(null);
    assertEquals("relatesTo", edge.getLabel());
    assertNull(edge.getProperty());
    assertEquals(link.from(), edge.getFromConceptId());
    assertEquals(link.to(), edge.getToConceptId());
    assertEquals(RELATES_TO, edge.getPropertyIri());
    assertEquals("owns", new Link(link.from(), link.to(), OWNS).edge(null).getLabel());
    assertEquals(
        "relatesTo", NativeOntologyDataGraphService.localName(URI.create("urn:relatesTo")));
    assertEquals("urn:model:", NativeOntologyDataGraphService.localName(URI.create("urn:model:")));
  }

  @Test
  void aDeclaredPropertyIsLabelledByItsDisplayNameThenName() {
    final var link = new Link(UUID.randomUUID(), UUID.randomUUID(), RELATES_TO);
    final var property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("relatesTo")
            .withFullyQualifiedName("model.relatesTo")
            .withIri(RELATES_TO);
    assertEquals("relatesTo", link.edge(property).getLabel());
    final var labelled = link.edge(property.withDisplayName("Relates to"));
    assertEquals("Relates to", labelled.getLabel());
    assertEquals(property.getId(), labelled.getProperty().getId());
  }

  private static OntologyExpression named(URI classIri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(classIri);
  }

  private static OntologyExpression restriction(URI propertyIri, OntologyExpression filler) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(propertyIri)
        .withRestrictionKind(OntologyRestrictionKind.SOME)
        .withFiller(filler);
  }

  private static OntologyExpression intersection(OntologyExpression... operands) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.INTERSECTION)
        .withOperands(List.of(operands));
  }

  private static OntologyExpression union(OntologyExpression... operands) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.UNION)
        .withOperands(List.of(operands));
  }
}
