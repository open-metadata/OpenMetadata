package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Chart;

class EntityPurgeTest {
  @Test
  void singlePurgeCommitsMetadataAndRowBeforePublishingMissingState() {
    final var fixture = new Fixture();
    final Chart chart = fixture.seed();
    fixture.service().delete("operator", chart);
    assertTrue(fixture.rows.isEmpty());
    assertTrue(fixture.metadata.isEmpty());
    assertEquals(List.of("operator"), fixture.actors);
    assertEquals(Set.of(chart.getId()), fixture.missing);
    assertEquals(List.of(chart.getId()), fixture.cancelled);
    assertEquals(List.of(true, false), fixture.cachedExistence);
    assertEquals(1, fixture.commits);
  }

  @Test
  void failedSingleRowDeleteRestoresMetadataAndSuppressesMissingPublication() {
    final var fixture = new Fixture();
    final Chart chart = fixture.seed();
    fixture.fail = true;
    assertThrows(IllegalStateException.class, () -> fixture.service().delete("operator", chart));
    assertEquals(Set.of(chart.getId()), fixture.rows);
    assertEquals(fixture.rows, fixture.metadata);
    assertTrue(fixture.missing.isEmpty());
    assertTrue(fixture.cancelled.isEmpty());
    assertEquals(List.of(true), fixture.cachedExistence);
    assertEquals(0, fixture.commits);
  }

  @Test
  void bulkPurgeKeepsInputOrderAndDuplicatesInOneTransaction() {
    final var fixture = new Fixture();
    final Chart first = fixture.seed();
    final Chart second = fixture.seed();
    fixture.service().deleteMany(List.of(second, first, second));
    assertTrue(fixture.rows.isEmpty());
    assertTrue(fixture.metadata.isEmpty());
    assertEquals(List.of(second.getId(), first.getId(), second.getId()), fixture.deleted);
    assertEquals(fixture.deleted, fixture.cancelled);
    assertEquals(1, fixture.commits);
    assertTrue(fixture.actors.isEmpty());
    assertTrue(fixture.cachedExistence.isEmpty());
    assertTrue(fixture.missing.isEmpty());
  }

  @Test
  void failedBulkPurgeRestoresEveryRowAndDependency() {
    final var fixture = new Fixture();
    final Chart first = fixture.seed();
    final Chart second = fixture.seed();
    fixture.fail = true;
    assertThrows(
        IllegalStateException.class, () -> fixture.service().deleteMany(List.of(first, second)));
    assertEquals(Set.of(first.getId(), second.getId()), fixture.rows);
    assertEquals(fixture.rows, fixture.metadata);
    assertTrue(fixture.cancelled.isEmpty());
    assertEquals(0, fixture.commits);
  }

  @Test
  void bootstrapBulkFallbackRetainsDirectPersistenceAndWorkflowCompletion() {
    final var fixture = new Fixture();
    fixture.transactionAvailable = false;
    final Chart chart = fixture.seed();
    fixture.service().deleteMany(List.of(chart));
    assertTrue(fixture.rows.isEmpty());
    assertTrue(fixture.metadata.isEmpty());
    assertEquals(List.of(chart.getId()), fixture.cancelled);
    assertEquals(0, fixture.commits);
  }

  private static final class Fixture {
    private final Set<UUID> rows = new HashSet<>();
    private final Set<UUID> metadata = new HashSet<>();
    private final Set<UUID> missing = new HashSet<>();
    private final List<UUID> deleted = new ArrayList<>();
    private final List<UUID> cancelled = new ArrayList<>();
    private final List<String> actors = new ArrayList<>();
    private final List<Boolean> cachedExistence = new ArrayList<>();
    private boolean transactionAvailable = true;
    private boolean active;
    private boolean fail;
    private int commits;

    private Chart seed() {
      final Chart chart = new Chart().withId(UUID.randomUUID());
      rows.add(chart.getId());
      metadata.add(chart.getId());
      return chart;
    }

    private EntityPurge<Chart> service() {
      return new EntityPurge<>(
          new EntityPurge.Rows<>(
              entity -> metadata.remove(entity.getId()),
              this::deleteRow,
              entities -> entities.forEach(entity -> metadata.remove(entity.getId())),
              ids -> ids.forEach(this::deleteRow)),
          new EntityPurge.Lifecycle<>(
              (actor, entity) -> {
                assertTrue(active);
                actors.add(actor);
              },
              entity -> cachedExistence.add(rows.contains(entity.getId())),
              entity -> {
                assertFalse(active);
                missing.add(entity.getId());
              },
              ids -> {
                assertFalse(active);
                cancelled.addAll(ids);
              }),
          this::transaction,
          () -> transactionAvailable);
    }

    private void deleteRow(UUID id) {
      assertFalse(metadata.contains(id));
      rows.remove(id);
      deleted.add(id);
      if (fail) {
        throw new IllegalStateException("row delete failed");
      }
    }

    private void transaction(Runnable work) {
      final Set<UUID> previousRows = new HashSet<>(rows);
      final Set<UUID> previousMetadata = new HashSet<>(metadata);
      active = true;
      try {
        work.run();
        commits++;
      } catch (RuntimeException failure) {
        rows.clear();
        rows.addAll(previousRows);
        metadata.clear();
        metadata.addAll(previousMetadata);
        throw failure;
      } finally {
        active = false;
      }
    }
  }
}
