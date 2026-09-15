package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;

class EntityLifecyclePublisherTest {
  @Test
  void createdEntityPublishesBeforeClearingCountAndMissingMarkers() {
    final Fixture fixture = new Fixture();
    final Table entity = table("created");
    fixture.publisher.created(entity);
    assertEquals(
        List.of("create:created", "rdf:created", "count", "present:created"), fixture.results);
  }

  @Test
  void createdBatchKeepsFirstIdentityAndProtectsRdfFromDispatcherListChanges() {
    final Fixture fixture = new Fixture();
    final Table first = table("first");
    final Table second = table("second");
    final List<Table> input =
        Arrays.asList(first, null, new Table(), table("duplicate").withId(first.getId()), second);
    fixture.consumeCreatedBatch = true;
    fixture.publisher.createdMany(input);
    assertEquals(
        List.of("create:first", "create:second", "rdf:first", "rdf:second", "count"),
        fixture.results);
    assertEquals(5, input.size());
  }

  @Test
  void absentAndUnusableCreateBatchesHaveNoPublishedEffects() {
    final Fixture fixture = new Fixture();
    fixture.publisher.createdMany(null);
    fixture.publisher.createdMany(List.of());
    fixture.publisher.createdMany(Arrays.asList(null, new Table()));
    fixture.publisher.updatedMany(null);
    fixture.publisher.updatedMany(List.of());
    assertTrue(fixture.results.isEmpty());
  }

  @Test
  void updatesRetainDuplicateOrderAndPublishCacheBeforeBatchEvents() {
    final Fixture fixture = new Fixture();
    final Table entity = table("updated");
    fixture.publisher.updated(entity);
    fixture.publisher.updatedMany(List.of(entity, entity));
    assertEquals(
        List.of(
            "update:updated",
            "rdf:updated",
            "cache:updated",
            "cache:updated",
            "update:updated",
            "update:updated",
            "rdf:updated",
            "rdf:updated"),
        fixture.results);
  }

  @Test
  void failedPublicationStopsLaterEffectsWithoutHidingTheFailure() {
    final Fixture fixture = new Fixture();
    fixture.failCreation = true;
    assertThrows(IllegalStateException.class, () -> fixture.publisher.created(table("failed")));
    assertTrue(fixture.results.isEmpty());
    fixture.failCreation = false;
    fixture.publisher.created(table("next"));
    assertEquals(List.of("create:next", "rdf:next", "count", "present:next"), fixture.results);
  }

  @Test
  void softDeleteAndRestoreKeepRdfWhileHardDeleteRemovesIt() {
    final Fixture fixture = new Fixture();
    final Table entity = table("deleted");
    fixture.publisher.deleted(entity, false);
    fixture.publisher.publishDeletion(entity, false);
    fixture.publisher.publishRestoration(entity);
    fixture.publisher.deleted(entity, true);
    fixture.publisher.publishDeletion(entity, true);
    assertEquals(
        List.of(
            "count",
            "soft:true:deleted",
            "soft:false:deleted",
            "rdf-delete:deleted",
            "count",
            "delete:deleted"),
        fixture.results);
  }

  private static Table table(String name) {
    return new Table().withId(UUID.randomUUID()).withName(name);
  }

  private static final class Fixture {
    private final List<String> results = new ArrayList<>();
    private boolean consumeCreatedBatch;
    private boolean failCreation;
    private final EntityLifecyclePublisher<Table> publisher =
        new EntityLifecyclePublisher<>(
            new EntityLifecyclePublisher.Writes<>(
                this::created,
                this::createdMany,
                entity -> add("update", entity),
                entities -> entities.forEach(entity -> add("update", entity))),
            new EntityLifecyclePublisher.Deletes<>(
                entity -> add("delete", entity),
                (entity, deleted) -> add("soft:" + deleted, entity)),
            new EntityLifecyclePublisher.Projections<>(
                entity -> add("rdf", entity),
                entity -> add("rdf-delete", entity),
                () -> results.add("count"),
                entity -> add("present", entity),
                entities -> entities.forEach(entity -> add("cache", entity))));

    private void created(EntityInterface entity) {
      if (failCreation) {
        throw new IllegalStateException("Event publication failed");
      }
      add("create", entity);
    }

    private void createdMany(List<EntityInterface> entities) {
      entities.forEach(this::created);
      if (consumeCreatedBatch) {
        entities.clear();
      }
    }

    private void add(String kind, EntityInterface entity) {
      results.add(kind + ":" + entity.getName());
    }
  }
}
