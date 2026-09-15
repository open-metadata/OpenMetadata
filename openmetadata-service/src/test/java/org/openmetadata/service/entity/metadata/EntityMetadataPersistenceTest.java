package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;

class EntityMetadataPersistenceTest {
  @Test
  void singleWritesKeepTheirOrderAndShareThePreparedEntity() {
    final Table entity = new Table().withDescription("prepared");
    final List<String> stored = new ArrayList<>();
    final var persistence =
        new EntityMetadataPersistence<Table>(
            List.of(
                table -> table.setDescription(table.getDescription() + ":tags"),
                table -> stored.add(table.getDescription())),
            List.of(),
            List.of());
    persistence.store(entity);
    assertEquals(List.of("prepared:tags"), stored);
    assertEquals("prepared:tags", entity.getDescription());
  }

  @Test
  void bulkWritesKeepTheInputListAndStopBeforeLaterWritesOnFailure() {
    final List<Table> entities = List.of(new Table(), new Table());
    final List<Table> stored = new ArrayList<>();
    final var failure = new IllegalStateException("metadata write failed");
    final var persistence =
        new EntityMetadataPersistence<Table>(
            List.of(),
            List.of(
                values -> {
                  assertSame(entities, values);
                  stored.addAll(values);
                },
                values -> {
                  throw failure;
                },
                values -> stored.clear()),
            List.of());
    assertSame(
        failure, assertThrows(IllegalStateException.class, () -> persistence.storeMany(entities)));
    assertEquals(entities, stored);
  }

  @Test
  void emptyWritesSkipPoliciesButEmptyCleanupStillReachesEntityPolicy() {
    final List<String> operations = new ArrayList<>();
    final var persistence =
        new EntityMetadataPersistence<Table>(
            List.of(),
            List.of(values -> operations.add("write")),
            List.of(values -> operations.add("common"), values -> operations.add("specific")));
    persistence.storeMany(List.of());
    assertEquals(List.of(), operations);
    persistence.clearMany(List.of());
    assertEquals(List.of("common", "specific"), operations);
    assertThrows(NullPointerException.class, () -> persistence.storeMany(null));
  }

  @Test
  void singleAndCleanupFailuresPropagateWithoutRunningLaterPolicies() {
    final List<Table> stored = new ArrayList<>();
    final var failure = new IllegalStateException("metadata unavailable");
    final var persistence =
        new EntityMetadataPersistence<Table>(
            List.of(
                table -> {
                  throw failure;
                },
                stored::add),
            List.of(),
            List.of(
                values -> {
                  throw failure;
                },
                stored::addAll));
    assertSame(
        failure, assertThrows(IllegalStateException.class, () -> persistence.store(new Table())));
    assertSame(
        failure,
        assertThrows(
            IllegalStateException.class, () -> persistence.clearMany(List.of(new Table()))));
    assertEquals(List.of(), stored);
  }

  @Test
  void policiesAreCapturedAtConstructionWithoutCopyingEntityInputs() {
    final List<Table> stored = new ArrayList<>();
    final List<Consumer<Table>> single = new ArrayList<>(List.of(stored::add));
    final List<Consumer<List<Table>>> bulk = new ArrayList<>(List.of(stored::addAll));
    final List<Consumer<List<Table>>> cleanup = new ArrayList<>(List.of(stored::removeAll));
    final var persistence = new EntityMetadataPersistence<>(single, bulk, cleanup);
    single.clear();
    bulk.clear();
    cleanup.clear();
    final Table entity = new Table();
    persistence.store(entity);
    persistence.storeMany(List.of(entity));
    assertEquals(List.of(entity, entity), stored);
    persistence.clearMany(List.of(entity));
    assertEquals(List.of(), stored);
  }
}
