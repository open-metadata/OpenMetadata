package org.openmetadata.service.entity.bulk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class EntityBulkMetricsTest {
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

  @AfterEach
  void closeRegistry() {
    registry.close();
  }

  @Test
  void registersMetersOnlyWhenTheyAreUsed() {
    new EntityBulkMetrics("table", registry);
    assertTrue(registry.getMeters().isEmpty());
  }

  @Test
  void retainsEntityLatencyAndQueueTagsAndUnits() {
    final var metrics = new EntityBulkMetrics("table", registry);
    metrics.recordEntity(11, 2, true);
    metrics.recordEntity(19, 3, false);
    assertEquals(
        11,
        registry
            .get("bulk.entity.latency")
            .tags("entity", "table", "success", "true")
            .timer()
            .totalTime(TimeUnit.NANOSECONDS));
    assertEquals(
        19,
        registry
            .get("bulk.entity.latency")
            .tags("entity", "table", "success", "false")
            .timer()
            .totalTime(TimeUnit.NANOSECONDS));
    final var queue = registry.get("bulk.entity.queue_wait").tag("entity", "table").timer();
    assertEquals(2, queue.count());
    assertEquals(5, queue.totalTime(TimeUnit.NANOSECONDS));
  }

  @Test
  void retainsBatchCountsSizeSuccessPercentageAndDuration() {
    final var metrics = new EntityBulkMetrics("table", registry);
    metrics.recordBatch(4, 3, 100);
    metrics.recordBatch(2, 0, 150);
    assertEquals(
        250, registry.get("bulk.operation.latency").timer().totalTime(TimeUnit.NANOSECONDS));
    assertEquals(6, registry.get("bulk.operation.batch_size").summary().totalAmount());
    assertEquals(75, registry.get("bulk.operation.success_rate").summary().totalAmount());
    assertEquals(2, registry.get("bulk.operation.success_rate").summary().count());
    assertEquals(3, registry.get("bulk.operation.entities.success").counter().count());
    assertEquals(3, registry.get("bulk.operation.entities.failed").counter().count());
  }

  @Test
  void emptyBatchDoesNotProduceAnUndefinedSuccessPercentage() {
    new EntityBulkMetrics("table", registry).recordBatch(0, 0, 0);
    assertNull(registry.find("bulk.operation.success_rate").summary());
    assertEquals(0, registry.get("bulk.operation.entities.success").counter().count());
    assertEquals(0, registry.get("bulk.operation.entities.failed").counter().count());
  }

  @Test
  void sameEntityRepositoriesShareMetersWithoutMixingEntityTypes() {
    new EntityBulkMetrics("table", registry).recordEntity(1, 0, true);
    new EntityBulkMetrics("table", registry).recordEntity(2, 0, true);
    new EntityBulkMetrics("chart", registry).recordEntity(4, 0, true);
    assertEquals(
        3,
        registry
            .get("bulk.entity.latency")
            .tag("entity", "table")
            .timer()
            .totalTime(TimeUnit.NANOSECONDS));
    assertEquals(
        4,
        registry
            .get("bulk.entity.latency")
            .tag("entity", "chart")
            .timer()
            .totalTime(TimeUnit.NANOSECONDS));
  }

  @Test
  void publishesHistogramsOnlyForBatchLatency() {
    final var registry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    try {
      final var metrics = new EntityBulkMetrics("table", registry);
      metrics.recordEntity(1, 0, true);
      metrics.recordBatch(1, 1, 10);
      final String scrape = registry.scrape();
      assertTrue(scrape.contains("bulk_operation_latency_seconds_bucket"));
      assertFalse(scrape.contains("bulk_entity_latency_seconds_bucket"));
      assertFalse(scrape.contains("bulk_entity_queue_wait_seconds_bucket"));
    } finally {
      registry.close();
    }
  }

  @Test
  void concurrentRecordingKeepsEverySample() {
    final var metrics = new EntityBulkMetrics("table", registry);
    try (var executor = Executors.newFixedThreadPool(4)) {
      for (int index = 0; index < 100; index++) {
        executor.submit(() -> metrics.recordEntity(1, 0, true));
      }
    }
    assertEquals(100, registry.get("bulk.entity.latency").timer().count());
    assertEquals(100, registry.get("bulk.entity.queue_wait").timer().count());
    assertEquals(2, registry.getMeters().size());
  }
}
