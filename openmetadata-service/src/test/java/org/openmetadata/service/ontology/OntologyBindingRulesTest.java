package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.ClientErrorException;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.exception.BadRequestException;

class OntologyBindingRulesTest {
  private static final long MAX_REVISION = 9_007_199_254_740_991L;

  @Test
  void staleChangedWritesConflictAndTheRevisionAdvancesByOne() {
    assertEquals(5L, OntologyBindingRules.nextRevision(4L, 4L));
    final var stale =
        assertThrows(ClientErrorException.class, () -> OntologyBindingRules.nextRevision(4L, 0L));
    assertEquals(409, stale.getResponse().getStatus());
    assertThrows(ClientErrorException.class, () -> OntologyBindingRules.nextRevision(4L, 5L));
    assertThrows(
        ClientErrorException.class,
        () -> OntologyBindingRules.nextRevision(MAX_REVISION, MAX_REVISION));
  }

  @Test
  void equivalentColumnOrderIsTheSameBinding() {
    final var first = column();
    final var second = column();
    assertTrue(OntologyBindingRules.sameColumns(List.of(first, second), List.of(second, first)));
    assertTrue(OntologyBindingRules.sameColumns(null, List.of()));
    assertFalse(OntologyBindingRules.sameColumns(List.of(first), List.of(first, second)));
    final var otherPath =
        new OntologyColumnBinding()
            .withPropertyId(first.getPropertyId())
            .withColumnPath(List.of("other"));
    assertFalse(OntologyBindingRules.sameColumns(List.of(first), List.of(otherPath)));
  }

  @Test
  void columnCapacityIsPerConceptAndAssetsAreUncapped() {
    assertDoesNotThrow(() -> OntologyBindingRules.requireColumnCapacity(500));
    final var failure =
        assertThrows(
            BadRequestException.class, () -> OntologyBindingRules.requireColumnCapacity(501));
    assertEquals("Concept bindings exceed the 500 column limit", failure.getMessage());
    IntStream.range(0, 150)
        .forEach(index -> assertDoesNotThrow(() -> OntologyBindingRules.validate(asset())));
  }

  @Test
  void exactNestedSegmentsDoNotConfuseDotsQuotesAndCaseWithFqnSyntax() {
    final var leaf = new Column().withName("quoted\"name").withDataType(ColumnDataType.STRING);
    final var parent =
        new Column()
            .withName("customer.address")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(List.of(leaf));
    final var table = new Table().withColumns(List.of(parent));
    assertSame(
        leaf,
        OntologyBindingRules.resolveColumn(table, List.of("customer.address", "quoted\"name")));
    assertNull(OntologyBindingRules.resolveColumn(table, List.of("customer", "address")));
    assertNull(OntologyBindingRules.resolveColumn(table, List.of("Customer.address")));
    assertNull(OntologyBindingRules.resolveColumn(table, List.of("deleted")));
  }

  @Test
  void propertyMustBeDataAndInTheSameOntologyWithAnApplicableDomain() {
    final var owner = new EntityReference().withId(UUID.randomUUID());
    final var concept = new OntologyConcept().withOntology(owner).withIri(URI.create("urn:Child"));
    final var property =
        new OntologyProperty()
            .withOntology(owner)
            .withKind(OntologyPropertyKind.DATA)
            .withDomain(List.of(URI.create("urn:Parent")));
    final var ancestors = Set.of("urn:Child", "urn:Parent");
    assertTrue(OntologyBindingRules.isApplicable(concept, property, ancestors));
    assertFalse(OntologyBindingRules.isApplicable(concept, property, Set.of("urn:Child")));
    assertFalse(
        OntologyBindingRules.isApplicable(
            concept, property.withKind(OntologyPropertyKind.OBJECT), ancestors));
    assertFalse(
        OntologyBindingRules.isApplicable(
            concept,
            property
                .withKind(OntologyPropertyKind.DATA)
                .withOntology(new EntityReference().withId(UUID.randomUUID())),
            ancestors));
    assertFalse(
        OntologyBindingRules.isApplicable(
            concept, property.withOntology(owner).withDeleted(true), ancestors));
  }

  @Test
  void rejectsMalformedAndOversizedAssociations() {
    assertThrows(BadRequestException.class, () -> OntologyBindingRules.validate(null));
    assertThrows(
        BadRequestException.class, () -> OntologyBindingRules.validate(asset().withAssetId(null)));
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyBindingRules.validate(
                asset()
                    .withAssetType(OntologyBindingAssetType.DASHBOARD)
                    .withColumns(List.of(column()))));
    final var duplicate = column();
    assertThrows(
        BadRequestException.class,
        () -> OntologyBindingRules.validate(asset().withColumns(List.of(duplicate, duplicate))));
    assertDoesNotThrow(() -> OntologyBindingRules.validate(asset().withColumns(columns(100))));
    assertThrows(
        BadRequestException.class,
        () -> OntologyBindingRules.validate(asset().withColumns(columns(101))));
    for (final var path :
        List.of(
            List.<String>of(),
            List.of(" "),
            List.of("x\u0000y"),
            List.of("x".repeat(257)),
            IntStream.range(0, 33).mapToObj(index -> "x").toList())) {
      assertThrows(
          BadRequestException.class,
          () ->
              OntologyBindingRules.validate(
                  asset().withColumns(List.of(column().withColumnPath(path)))));
    }
  }

  @Test
  void revisionMustBePresentAndExactlyRepresentable() {
    for (final Long invalid : new Long[] {null, -1L, MAX_REVISION + 1}) {
      assertThrows(BadRequestException.class, () -> OntologyBindingRules.requireRevision(invalid));
    }
    assertDoesNotThrow(() -> OntologyBindingRules.requireRevision(MAX_REVISION));
  }

  private static OntologyAssetBinding asset() {
    return new OntologyAssetBinding()
        .withAssetId(UUID.randomUUID())
        .withAssetType(OntologyBindingAssetType.TABLE)
        .withColumns(List.of());
  }

  private static OntologyColumnBinding column() {
    return new OntologyColumnBinding()
        .withPropertyId(UUID.randomUUID())
        .withColumnPath(List.of("value"));
  }

  private static List<OntologyColumnBinding> columns(int count) {
    return IntStream.range(0, count).mapToObj(index -> column()).toList();
  }
}
