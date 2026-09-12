package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.metadata.EntityTimeSeries;
import org.openmetadata.service.entity.metadata.EntityTimeSeries.Window;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.util.FullyQualifiedName;

@Isolated("Temporarily decorates the application's transaction handler")
@ExtendWith(TestNamespaceExtension.class)
class EntityTimeSeriesIT {
  private static final String EXTENSION = "test.nativeTimeSeries";

  @Test
  void timestampReadsKeepInclusiveRangesOrderingLimitsAndMissingResults(TestNamespace ns) {
    final String fqn = ns.prefix("series") + ".\"quoted.part\"";
    final EntityTimeSeries series = series();
    try {
      insert(fqn, 10, 20, 30);
      assertEquals(20, timestamp(series.at(fqn, EXTENSION, 20L)));
      assertEquals(30, timestamp(series.latest(fqn, EXTENSION)));
      assertNull(series.at(fqn, EXTENSION, 15L));
      assertNull(series.latest(fqn, "missing.extension"));
      assertEquals(
          List.of(30L, 20L),
          timestamps(series.between(fqn, EXTENSION, Window.descending(20L, 30L))));
      assertEquals(
          List.of(10L, 20L),
          timestamps(series.between(fqn, EXTENSION, new Window(10L, 30L, OrderBy.ASC, 2))));
      assertEquals(
          List.of(30L),
          timestamps(series.between(fqn, EXTENSION, new Window(10L, 30L, OrderBy.DESC, 1))));
      assertTrue(series.between(fqn, EXTENSION, Window.descending(31L, 40L)).isEmpty());
    } finally {
      delete(fqn);
    }
  }

  @Test
  void batchReadsUseHashesAndLimitEachSeriesIndependently(TestNamespace ns) {
    final String first = ns.prefix("first");
    final String second = ns.prefix("second");
    final String missing = ns.prefix("missing");
    final EntityTimeSeries series = series();
    final List<String> hashes =
        List.of(first, second, missing).stream().map(FullyQualifiedName::buildHash).toList();
    try {
      insert(first, 10, 20, 30);
      insert(second, 15, 25);
      final var latest = series.latestBatch(hashes, EXTENSION);
      assertEquals(Set.of(hashes.getFirst(), hashes.get(1)), latest.keySet());
      assertEquals(30, timestamp(latest.get(hashes.getFirst())));
      assertEquals(25, timestamp(latest.get(hashes.get(1))));
      final var histories = series.latestBatch(hashes, EXTENSION, 2);
      assertEquals(latest.keySet(), histories.keySet());
      assertEquals(List.of(30L, 20L), timestamps(histories.get(hashes.getFirst())));
      assertEquals(List.of(25L, 15L), timestamps(histories.get(hashes.get(1))));
      assertTrue(series.latestBatch(List.of(), EXTENSION).isEmpty());
      assertThrows(IllegalArgumentException.class, () -> series.latestBatch(hashes, EXTENSION, 0));
    } finally {
      delete(first);
      delete(second);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void insertsAndDeletesJoinTheOwningTransaction(boolean rollback, TestNamespace ns) {
    final String fqn = ns.prefix("transaction" + rollback);
    final var repository = Entity.getEntityRepository(Entity.TABLE);
    final EntityTimeSeries series = repository.timeSeries();
    try {
      insert(fqn, 10, 20, 30);
      final Runnable mutation =
          () ->
              repository.executeInTransaction(
                  () -> {
                    repository.executeInTransaction(
                        () -> {
                          insert(fqn, 40);
                          series.deleteAt(fqn, EXTENSION, 20L);
                          series.deleteBefore(fqn, EXTENSION, 20L);
                          return null;
                        });
                    assertEquals(List.of(40L, 30L), read(fqn));
                    if (rollback) throw new IllegalStateException("Roll back the series mutations");
                    return null;
                  });
      try (var transactions = new TransactionCounter(Entity.getJdbi())) {
        if (rollback) assertThrows(IllegalStateException.class, mutation::run);
        else mutation.run();
        assertEquals(rollback ? 0 : 1, transactions.commits());
        assertEquals(rollback ? 1 : 0, transactions.rollbacks());
      }
      assertEquals(rollback ? List.of(30L, 20L, 10L) : List.of(40L, 30L), read(fqn));
    } finally {
      delete(fqn);
    }
  }

  private static EntityTimeSeries series() {
    return Entity.getEntityRepository(Entity.TABLE).timeSeries();
  }

  private static void insert(String fqn, long... timestamps) {
    for (final long timestamp : timestamps) {
      series().insert(fqn, EXTENSION, "pipelineStatus", "{\"timestamp\":" + timestamp + "}");
    }
  }

  private static List<Long> read(String fqn) {
    return timestamps(series().between(fqn, EXTENSION, Window.descending(0L, Long.MAX_VALUE)));
  }

  private static List<Long> timestamps(List<String> rows) {
    return rows.stream().map(EntityTimeSeriesIT::timestamp).toList();
  }

  private static long timestamp(String row) {
    return JsonUtils.readTree(row).get("timestamp").asLong();
  }

  private static void delete(String fqn) {
    Entity.getCollectionDAO().entityExtensionTimeSeriesDao().delete(fqn, EXTENSION);
  }
}
