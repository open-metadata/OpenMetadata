package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.ClientErrorException;
import java.net.URI;
import java.util.ArrayList;
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
import org.openmetadata.schema.type.OntologyConceptBindings;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.exception.BadRequestException;

class OntologyBindingRulesTest {
  @Test
  void replacingOneAssetPreservesAssociationsTheWriterDidNotSend() {
    final var hidden = asset();
    final var visible = asset();
    final var current = bindings(hidden, visible);
    final var updated =
        OntologyBindingRules.replace(
            current, asset().withAssetId(visible.getAssetId()).withColumns(List.of(column())), 0L);
    assertEquals(1L, updated.getRevision());
    assertEquals(hidden, updated.getAssets().getFirst());
    assertEquals(1, updated.getAssets().getLast().getColumns().size());
    assertEquals(2, updated.getAssets().size());
  }

  @Test
  void staleChangedWritesConflictButIdenticalRetriesDoNotAdvanceTheRevision() {
    final var asset = asset();
    final var current = bindings(asset).withRevision(4L);
    assertSame(current, OntologyBindingRules.replace(current, asset, 0L));
    final var failure =
        assertThrows(
            ClientErrorException.class, () -> OntologyBindingRules.replace(current, asset(), 0L));
    assertEquals(409, failure.getResponse().getStatus());
    assertThrows(
        ClientErrorException.class,
        () -> OntologyBindingRules.remove(current, asset.getAssetType(), asset.getAssetId(), 0L));
    assertEquals(List.of(asset), current.getAssets());
    assertSame(
        current, OntologyBindingRules.remove(current, asset.getAssetType(), UUID.randomUUID(), 0L));
    assertEquals(
        List.of(),
        OntologyBindingRules.remove(current, asset.getAssetType(), asset.getAssetId(), 4L)
            .getAssets());
  }

  @Test
  void equivalentColumnOrderIsAnIdempotentRetry() {
    final var first = column();
    final var second = column();
    final var asset = asset().withColumns(List.of(first, second));
    final var current = bindings(asset).withRevision(2L);
    assertSame(
        current,
        OntologyBindingRules.replace(
            current,
            new OntologyAssetBinding()
                .withAssetType(asset.getAssetType())
                .withAssetId(asset.getAssetId())
                .withColumns(List.of(second, first)),
            0L));
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
  void enforcesDocumentCapsWithoutDiscardingExistingData() {
    final var hundred =
        new OntologyConceptBindings()
            .withRevision(0L)
            .withAssets(IntStream.range(0, 100).mapToObj(index -> asset()).toList());
    assertThrows(
        BadRequestException.class, () -> OntologyBindingRules.replace(hundred, asset(), 0L));
    final var full = new ArrayList<OntologyAssetBinding>();
    IntStream.range(0, 5).forEach(index -> full.add(asset().withColumns(columns(100))));
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyBindingRules.replace(
                new OntologyConceptBindings().withRevision(0L).withAssets(full),
                asset().withColumns(List.of(column())),
                0L));
    assertEquals(5, full.size());
  }

  @Test
  void revisionMustBePresentAndExactlyRepresentable() {
    for (final Long invalid : new Long[] {null, -1L, 9_007_199_254_740_992L}) {
      assertThrows(BadRequestException.class, () -> OntologyBindingRules.requireRevision(invalid));
    }
    assertThrows(
        ClientErrorException.class,
        () ->
            OntologyBindingRules.replace(
                bindings().withRevision(9_007_199_254_740_991L), asset(), 9_007_199_254_740_991L));
  }

  private static OntologyConceptBindings bindings(OntologyAssetBinding... assets) {
    return new OntologyConceptBindings().withRevision(0L).withAssets(List.of(assets));
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
