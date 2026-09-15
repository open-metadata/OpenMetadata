package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.EventType.ENTITY_RESTORED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.DELETED;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.exception.EntityNotFoundException;

class EntityRestoreServiceTest {
  private static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(1234), ZoneOffset.UTC);
  private final UUID id = UUID.randomUUID();
  private final List<Include> reads = new ArrayList<>();
  private final List<UUID> containedChildren = new ArrayList<>();
  private final List<UUID> additionalChildren = new ArrayList<>();
  private Table stored = new Table().withId(id).withDeleted(true).withVersion(0.2);
  private boolean countsInvalidated;
  private boolean failUpdate;

  @Test
  void restoresAfterChildrenWithIndependentHydratedSnapshotAndAudit() {
    stored.setColumns(new ArrayList<>(List.of(new Column().withName("original"))));
    final Table original = stored;
    final var response = service().restore("editor", id);
    assertEquals(ENTITY_RESTORED, response.getChangeType());
    assertEquals(List.of(ALL, DELETED), reads);
    assertEquals(List.of(id), containedChildren);
    assertEquals(List.of(id), additionalChildren);
    assertTrue(original.getDeleted());
    assertNotSame(original, stored);
    assertNotSame(original.getColumns(), stored.getColumns());
    assertEquals("original", original.getColumns().getFirst().getName());
    assertEquals("updated", stored.getColumns().getFirst().getName());
    assertEquals("editor", stored.getUpdatedBy());
    assertEquals(1234L, stored.getUpdatedAt());
    assertEquals("parent", stored.getDatabaseSchema().getName());
    assertEquals("inherited", stored.getDescription());
    assertFalse(stored.getDeleted());
    assertTrue(countsInvalidated);
  }

  @Test
  void alreadyRestoredParentStillReconcilesContainedAndAdditionalChildren() {
    stored.setDeleted(false);
    assertNull(service().restore("editor", id));
    assertEquals(List.of(ALL, DELETED), reads);
    assertEquals(List.of(id), containedChildren);
    assertEquals(List.of(id), additionalChildren);
    assertFalse(countsInvalidated);
  }

  @Test
  void missingParentFailsBeforeAnyChildIsRestored() {
    stored = null;
    assertThrows(EntityNotFoundException.class, () -> service().restore("editor", id));
    assertEquals(List.of(ALL), reads);
    assertTrue(containedChildren.isEmpty());
    assertTrue(additionalChildren.isEmpty());
    assertFalse(countsInvalidated);
  }

  @Test
  void failedUpdateDoesNotInvalidateCountsOrRunAdditionalChildren() {
    failUpdate = true;
    assertThrows(IllegalStateException.class, () -> service().restore("editor", id));
    assertTrue(stored.getDeleted());
    assertEquals(List.of(id), containedChildren);
    assertTrue(additionalChildren.isEmpty());
    assertFalse(countsInvalidated);
  }

  @Test
  void missingDependencyDuringMutationRetainsExistingReconciliationBehavior() {
    final var service =
        new EntityRestoreService<>(
            "table",
            new EntityRestoreService.Preparation<Table>(
                this::find,
                entity -> {
                  throw new EntityNotFoundException("Dangling dependency");
                },
                entity -> {}),
            children(),
            new EntityRestoreService.Mutation<>(
                Table.class, this::update, () -> countsInvalidated = true),
            CLOCK);
    assertNull(service.restore("editor", id));
    assertEquals(List.of(id), additionalChildren);
    assertTrue(stored.getDeleted());
    assertFalse(countsInvalidated);
  }

  private EntityRestores<Table> service() {
    return new EntityRestoreService<>(
        "table",
        new EntityRestoreService.Preparation<>(
            this::find,
            entity -> entity.setDatabaseSchema(new EntityReference().withName("parent")),
            entity -> entity.setDescription("inherited")),
        children(),
        new EntityRestoreService.Mutation<>(
            Table.class, this::update, () -> countsInvalidated = true),
        CLOCK);
  }

  private EntityRestoreService.Children children() {
    return new EntityRestoreService.Children(
        (entityId, actor) -> containedChildren.add(entityId),
        (entityId, actor) -> additionalChildren.add(entityId));
  }

  private Table find(UUID entityId, Include include) {
    reads.add(include);
    if (stored == null || include == DELETED && !Boolean.TRUE.equals(stored.getDeleted())) {
      throw new EntityNotFoundException("Missing table " + entityId);
    }
    return stored;
  }

  private void update(Table original, Table updated) {
    assertEquals(List.of(id), containedChildren);
    assertTrue(additionalChildren.isEmpty());
    if (failUpdate) {
      throw new IllegalStateException("Transaction rolled back");
    }
    updated.setDeleted(false);
    if (updated.getColumns() != null) {
      updated.getColumns().getFirst().setName("updated");
    }
    stored = updated;
  }
}
