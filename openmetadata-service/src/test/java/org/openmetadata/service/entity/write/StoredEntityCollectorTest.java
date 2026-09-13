package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StoredEntityCollectorTest {
  @Test
  void nestedCollectionDoesNotConsumeTheOuterOperationsRows() {
    final StoredEntityCollector collector = new StoredEntityCollector();
    final StoredEntity first = entity("first");
    final StoredEntity nested = entity("nested");
    final StoredEntity last = entity("last");

    final List<StoredEntity> outer =
        collector.collect(
            () -> {
              collector.record(first);
              assertEquals(List.of(nested), collector.collect(() -> collector.record(nested)));
              collector.record(last);
            });

    assertEquals(List.of(first, last), outer);
    assertThrows(UnsupportedOperationException.class, () -> outer.add(nested));
  }

  @Test
  void failedAttemptsAndUncapturedWritesDoNotLeakIntoTheNextOperation() {
    final StoredEntityCollector collector = new StoredEntityCollector();
    final StoredEntity failed = entity("failed");
    final StoredEntity committed = entity("committed");
    assertThrows(
        IllegalStateException.class,
        () ->
            collector.collect(
                () -> {
                  collector.record(failed);
                  throw new IllegalStateException("Rollback");
                }));
    collector.record(failed);

    assertEquals(List.of(committed), collector.collect(() -> collector.record(committed)));
    assertTrue(collector.collect(() -> {}).isEmpty());
  }

  @Test
  void aRepeatedUpdateRetainsTheLastPersistedValueAndOriginalInsertionOrder() {
    final StoredEntityCollector collector = new StoredEntityCollector();
    final StoredEntity first = entity("first");
    final StoredEntity second = entity("second");
    final StoredEntity updated = new StoredEntity(first.id(), "renamed", "{\"name\":\"renamed\"}");

    final List<StoredEntity> result =
        collector.collect(
            () -> {
              collector.record(first);
              collector.record(second);
              collector.record(updated);
            });

    assertEquals(List.of(updated, second), result);
  }

  private StoredEntity entity(String name) {
    return new StoredEntity(UUID.randomUUID(), name, "{\"name\":\"" + name + "\"}");
  }
}
