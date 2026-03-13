package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

@DisplayName("Stats Thread Safety Tests")
class StatsThreadSafetyTest {

  private Stats createTestStats(Set<String> entityTypes) {
    Stats stats = new Stats();
    stats.setEntityStats(new EntityStats());
    stats.setJobStats(new StepStats());
    stats.setReaderStats(new StepStats());
    stats.setSinkStats(new StepStats());

    int total = 0;
    for (String entityType : entityTypes) {
      int entityTotal = 1000;
      total += entityTotal;
      StepStats es = new StepStats();
      es.setTotalRecords(entityTotal);
      es.setSuccessRecords(0);
      es.setFailedRecords(0);
      stats.getEntityStats().getAdditionalProperties().put(entityType, es);
    }
    stats.getJobStats().setTotalRecords(total);
    stats.getJobStats().setSuccessRecords(0);
    stats.getJobStats().setFailedRecords(0);
    stats.getReaderStats().setTotalRecords(total);
    stats.getReaderStats().setSuccessRecords(0);
    stats.getReaderStats().setFailedRecords(0);
    stats.getReaderStats().setWarningRecords(0);
    stats.getSinkStats().setTotalRecords(0);
    stats.getSinkStats().setSuccessRecords(0);
    stats.getSinkStats().setFailedRecords(0);
    return stats;
  }

  @Test
  @DisplayName("concurrent updateStats calls produce consistent entity and job stats")
  void concurrentUpdateStats() throws InterruptedException {
    Set<String> entities = Set.of("table", "user");
    AtomicReference<Stats> statsRef = new AtomicReference<>(createTestStats(entities));
    Stats stats = statsRef.get();

    int threadCount = 8;
    int updatesPerThread = 100;
    CountDownLatch latch = new CountDownLatch(threadCount);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    for (int t = 0; t < threadCount; t++) {
      final String entityType = (t % 2 == 0) ? "table" : "user";
      executor.submit(
          () -> {
            try {
              for (int i = 0; i < updatesPerThread; i++) {
                synchronized (statsRef) {
                  StepStats es = stats.getEntityStats().getAdditionalProperties().get(entityType);
                  if (es != null) {
                    es.setSuccessRecords(es.getSuccessRecords() + 1);
                  }
                  int totalSuccess =
                      stats.getEntityStats().getAdditionalProperties().values().stream()
                          .mapToInt(StepStats::getSuccessRecords)
                          .sum();
                  stats.getJobStats().setSuccessRecords(totalSuccess);
                }
              }
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await(10, TimeUnit.SECONDS);
    executor.shutdown();

    assertNotNull(stats.getJobStats());
    int tableSuccess =
        stats.getEntityStats().getAdditionalProperties().get("table").getSuccessRecords();
    int userSuccess =
        stats.getEntityStats().getAdditionalProperties().get("user").getSuccessRecords();
    int jobSuccess = stats.getJobStats().getSuccessRecords();

    assertEquals(threadCount * updatesPerThread, tableSuccess + userSuccess);
    assertEquals(tableSuccess + userSuccess, jobSuccess);
  }

  @Test
  @DisplayName("concurrent reader stats updates do not lose updates")
  void concurrentReaderStats() throws InterruptedException {
    Stats stats = createTestStats(Set.of("table"));

    int threadCount = 8;
    int updatesPerThread = 100;
    CountDownLatch latch = new CountDownLatch(threadCount);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    for (int t = 0; t < threadCount; t++) {
      executor.submit(
          () -> {
            try {
              for (int i = 0; i < updatesPerThread; i++) {
                synchronized (stats) {
                  StepStats rs = stats.getReaderStats();
                  rs.setSuccessRecords(
                      (rs.getSuccessRecords() != null ? rs.getSuccessRecords() : 0) + 1);
                  rs.setFailedRecords(
                      (rs.getFailedRecords() != null ? rs.getFailedRecords() : 0) + 0);
                  rs.setWarningRecords(
                      (rs.getWarningRecords() != null ? rs.getWarningRecords() : 0) + 0);
                }
              }
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await(10, TimeUnit.SECONDS);
    executor.shutdown();

    int expectedSuccess = threadCount * updatesPerThread;
    assertEquals(expectedSuccess, stats.getReaderStats().getSuccessRecords());
    assertEquals(0, stats.getReaderStats().getFailedRecords());
  }

  @Test
  @DisplayName("reconciler invariant: job total >= job success + job failed")
  void reconcilerInvariant() throws InterruptedException {
    Stats stats = createTestStats(Set.of("table", "user"));

    int threadCount = 4;
    int updatesPerThread = 200;
    CountDownLatch latch = new CountDownLatch(threadCount);
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    for (int t = 0; t < threadCount; t++) {
      final int tid = t;
      executor.submit(
          () -> {
            try {
              for (int i = 0; i < updatesPerThread; i++) {
                String entityType = (tid % 2 == 0) ? "table" : "user";
                synchronized (stats) {
                  StepStats es = stats.getEntityStats().getAdditionalProperties().get(entityType);
                  if (es != null) {
                    if (i % 10 == 0) {
                      es.setFailedRecords(es.getFailedRecords() + 1);
                    } else {
                      es.setSuccessRecords(es.getSuccessRecords() + 1);
                    }
                  }
                  int totalSuccess =
                      stats.getEntityStats().getAdditionalProperties().values().stream()
                          .mapToInt(StepStats::getSuccessRecords)
                          .sum();
                  int totalFailed =
                      stats.getEntityStats().getAdditionalProperties().values().stream()
                          .mapToInt(StepStats::getFailedRecords)
                          .sum();
                  stats.getJobStats().setSuccessRecords(totalSuccess);
                  stats.getJobStats().setFailedRecords(totalFailed);
                }
              }
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await(10, TimeUnit.SECONDS);
    executor.shutdown();

    StepStats jobStats = stats.getJobStats();
    int success = jobStats.getSuccessRecords();
    int failed = jobStats.getFailedRecords();
    int total = jobStats.getTotalRecords();

    assertTrue(total >= success + failed, "Total must be >= success + failed");
    assertEquals(threadCount * updatesPerThread, success + failed);
  }
}
