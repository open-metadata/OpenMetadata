package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.ServiceUnavailableException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.LiveAsset;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Link;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.Target;
import org.openmetadata.service.ontology.NativeOntologyDataGraphService.VisibleSummary;
import org.openmetadata.service.util.RestUtil;

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

  @Test
  void exactCountsRetainOnlyTheFirstFourVisibleBindingsAcrossBatches() {
    final var conceptId = UUID.randomUUID();
    final var summary = new VisibleSummary(4);
    for (int index = 1; index <= 2501; index++) {
      final var row = binding(conceptId, index);
      summary.add(row, index % 2 == 0 ? new LiveAsset(row.assetId(), "Kafka") : null);
      assertEquals(index / 2, summary.assetCount());
      assertTrue(summary.preview().size() <= 4);
    }
    assertEquals(1250, summary.assetCount());
    assertEquals(
        List.of(2L, 4L, 6L, 8L),
        summary.preview().stream()
            .map(preview -> preview.row().assetId().getLeastSignificantBits())
            .toList());
  }

  @Test
  void thePreviewCursorFollowsTheLastReturnedAssetRatherThanTheScanTail() {
    final var concept = new OntologyConcept().withId(UUID.randomUUID()).withName("Customer");
    final var summary = new VisibleSummary(1);
    final var first = binding(concept.getId(), 1);
    final var last = binding(concept.getId(), 2000);
    summary.add(first, new LiveAsset(first.assetId(), "Kafka"));
    summary.add(last, new LiveAsset(last.assetId(), "Kafka"));
    final var cluster = summary.resolve(concept, Map.of(first.assetId(), reference(first)));
    assertEquals(2, cluster.getAssetCount());
    assertEquals(
        List.of(first.assetId()),
        cluster.getAssets().stream().map(asset -> asset.getAsset().getId()).toList());
    assertEquals(RestUtil.encodeCursor(first.assetId().toString()), cluster.getAfter());
  }

  @Test
  void previewHydrationLossFailsTheReadWithoutSkippingAnUnreturnedAsset() {
    final var concept = new OntologyConcept().withId(UUID.randomUUID()).withName("Customer");
    final var summary = new VisibleSummary(1);
    final var row = binding(concept.getId(), 1);
    summary.add(row, new LiveAsset(row.assetId(), "Kafka"));
    final var unavailable =
        assertThrows(ServiceUnavailableException.class, () -> summary.resolve(concept, Map.of()));
    assertEquals(503, unavailable.getResponse().getStatus());
    final var retried = summary.resolve(concept, Map.of(row.assetId(), reference(row)));
    assertEquals(1, retried.getAssetCount());
    assertNull(retried.getAfter());
  }

  @Test
  void anInvisibleSummaryRetainsNoBindings() {
    final var summary = new VisibleSummary(4);
    final var conceptId = UUID.randomUUID();
    for (int index = 0; index < 1501; index++) {
      summary.add(binding(conceptId, index), null);
    }
    assertEquals(0, summary.assetCount());
    assertEquals(List.of(), summary.preview());
  }

  private static BindingRow binding(UUID conceptId, long assetId) {
    return new BindingRow(
        conceptId, new UUID(0, assetId), OntologyBindingAssetType.TOPIC, "hash", List.of());
  }

  private static EntityReference reference(BindingRow row) {
    return new EntityReference().withId(row.assetId()).withType(row.assetType().value());
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
