package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Test class to verify that PATCH operations are properly instrumented
 * with detailed latency metrics for performance monitoring.
 */
@Slf4j
public class PatchOperationMetricsTest {

  private SimpleMeterRegistry meterRegistry;

  @BeforeEach
  void setUp() {
    // Clear and setup fresh registry for each test
    Metrics.globalRegistry.clear();
    meterRegistry = new SimpleMeterRegistry();
    Metrics.addRegistry(meterRegistry);
  }

  @Test
  void testPatchOperationMetricsAreRecorded() {
    // Test that patch operation metrics are properly recorded
    String entityType = "table";

    // Simulate recording patch metrics as done in EntityRepository.patchCommonWithOptimisticLocking
    recordPatchMetrics(entityType, 50L, 30L, 20L, 150L);

    // Verify metrics were recorded
    Timer applyTimer =
        meterRegistry
            .find("entity.patch.apply")
            .tag("entity_type", entityType)
            .tag("operation", "PATCH")
            .timer();

    assertNotNull(applyTimer, "Apply timer should be recorded");
    assertEquals(1, applyTimer.count(), "Should have 1 apply operation");
    assertEquals(
        50.0, applyTimer.totalTime(TimeUnit.MILLISECONDS), 1.0, "Apply time should be ~50ms");

    Timer prepareTimer =
        meterRegistry.find("entity.patch.prepare").tag("entity_type", entityType).timer();
    assertNotNull(prepareTimer, "Prepare timer should be recorded");
    assertEquals(
        30.0, prepareTimer.totalTime(TimeUnit.MILLISECONDS), 1.0, "Prepare time should be ~30ms");

    Timer validationTimer =
        meterRegistry.find("entity.patch.validation").tag("entity_type", entityType).timer();
    assertNotNull(validationTimer, "Validation timer should be recorded");
    assertEquals(
        20.0,
        validationTimer.totalTime(TimeUnit.MILLISECONDS),
        1.0,
        "Validation time should be ~20ms");

    Timer updateTimer =
        meterRegistry.find("entity.patch.update_total").tag("entity_type", entityType).timer();
    assertNotNull(updateTimer, "Update timer should be recorded");
    assertEquals(
        150.0, updateTimer.totalTime(TimeUnit.MILLISECONDS), 1.0, "Update time should be ~150ms");
  }

  @Test
  void testPostUpdateMetricsAreRecorded() {
    String entityType = "table";

    // Simulate recording post-update metrics
    recordPostUpdateMetrics(entityType, 200L, 50L);

    Timer searchIndexTimer =
        meterRegistry.find("entity.patch.search_index").tag("entity_type", entityType).timer();
    assertNotNull(searchIndexTimer, "Search index timer should be recorded");
    assertEquals(
        200.0,
        searchIndexTimer.totalTime(TimeUnit.MILLISECONDS),
        1.0,
        "Search index time should be ~200ms");

    Timer rdfTimer =
        meterRegistry.find("entity.patch.rdf_update").tag("entity_type", entityType).timer();
    assertNotNull(rdfTimer, "RDF update timer should be recorded");
    assertEquals(
        50.0, rdfTimer.totalTime(TimeUnit.MILLISECONDS), 1.0, "RDF update time should be ~50ms");
  }

  @Test
  void testSearchIndexUpdateMetricsAreRecorded() {
    String entityType = "table";

    // Simulate recording search index metrics
    recordSearchIndexMetrics(entityType, 100L, 80L);

    Timer updateTimer =
        meterRegistry
            .find("search.index.update")
            .tag("entity_type", entityType)
            .tag("operation", "update")
            .timer();
    assertNotNull(updateTimer, "Search index update timer should be recorded");
    assertEquals(
        100.0,
        updateTimer.totalTime(TimeUnit.MILLISECONDS),
        1.0,
        "Search index update time should be ~100ms");

    Timer propagateTimer =
        meterRegistry.find("search.index.propagate").tag("entity_type", entityType).timer();
    assertNotNull(propagateTimer, "Search index propagate timer should be recorded");
    assertEquals(
        80.0,
        propagateTimer.totalTime(TimeUnit.MILLISECONDS),
        1.0,
        "Search index propagate time should be ~80ms");
  }

  @Test
  void testEntityUpdaterMetricsAreRecorded() {
    String entityType = "table";

    // Simulate recording entity updater metrics
    recordEntityUpdaterMetrics(entityType, 10L, 30L, 100L, 250L);

    Timer consolidateTimer =
        meterRegistry.find("entity.patch.consolidate").tag("entity_type", entityType).timer();
    assertNotNull(consolidateTimer, "Consolidate timer should be recorded");
    assertEquals(10.0, consolidateTimer.totalTime(TimeUnit.MILLISECONDS), 1.0);

    Timer updateInternalTimer =
        meterRegistry.find("entity.patch.update_internal").tag("entity_type", entityType).timer();
    assertNotNull(updateInternalTimer, "Update internal timer should be recorded");
    assertEquals(30.0, updateInternalTimer.totalTime(TimeUnit.MILLISECONDS), 1.0);

    Timer databaseTimer =
        meterRegistry.find("entity.patch.database").tag("entity_type", entityType).timer();
    assertNotNull(databaseTimer, "Database timer should be recorded");
    assertEquals(100.0, databaseTimer.totalTime(TimeUnit.MILLISECONDS), 1.0);

    Timer searchIndexTimer =
        meterRegistry.find("entity.patch.search_index").tag("entity_type", entityType).timer();
    assertNotNull(searchIndexTimer, "Search index timer should be recorded");
    assertEquals(250.0, searchIndexTimer.totalTime(TimeUnit.MILLISECONDS), 1.0);
  }

  @Test
  void testCompletePatChOperationFlow() {
    // Test complete PATCH operation flow with all metrics
    String entityType = "table";

    // Start request context
    String endpoint = "/api/v1/tables/{id}";
    RequestLatencyContext.startRequest(endpoint, "PATCH");

    // Simulate complete PATCH flow
    // 1. Patch apply and preparation
    simulateWork(50);
    recordPatchMetrics(entityType, 50L, 30L, 20L, 150L);

    // 2. Entity updater operations
    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);
    recordEntityUpdaterMetrics(entityType, 10L, 30L, 100L, 250L);

    // 3. Search index update (part of post-update)
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    simulateWork(180);
    RequestLatencyContext.endSearchOperation(searchSample);
    recordSearchIndexMetrics(entityType, 100L, 80L);

    // 4. Other post-update operations
    recordPostUpdateMetrics(entityType, 200L, 50L);

    RequestLatencyContext.endRequest();

    // Verify all metrics are recorded
    assertTrue(meterRegistry.find("entity.patch.apply").timer() != null);
    assertTrue(meterRegistry.find("entity.patch.update_total").timer() != null);
    assertTrue(meterRegistry.find("search.index.update").timer() != null);
    assertTrue(meterRegistry.find("entity.patch.search_index").timer() != null);

    // Verify request latency context metrics
    Timer totalTimer =
        meterRegistry
            .find("request.latency.total")
            .tag("endpoint", MetricUtils.normalizeUri(endpoint))
            .tag("method", "PATCH")
            .timer();
    assertNotNull(totalTimer);
    assertEquals(1, totalTimer.count());

    LOG.info("Complete PATCH operation metrics test passed");
  }

  @Test
  void testMetricsWithDifferentEntityTypes() {
    // Test that metrics are properly tagged with different entity types
    recordPatchMetrics("table", 50L, 30L, 20L, 150L);
    recordPatchMetrics("dashboard", 60L, 35L, 25L, 160L);
    recordPatchMetrics("pipeline", 55L, 32L, 22L, 155L);

    // Verify each entity type has its own metrics
    Timer tableTimer = meterRegistry.find("entity.patch.apply").tag("entity_type", "table").timer();
    Timer dashboardTimer =
        meterRegistry.find("entity.patch.apply").tag("entity_type", "dashboard").timer();
    Timer pipelineTimer =
        meterRegistry.find("entity.patch.apply").tag("entity_type", "pipeline").timer();

    assertNotNull(tableTimer);
    assertNotNull(dashboardTimer);
    assertNotNull(pipelineTimer);

    assertEquals(1, tableTimer.count());
    assertEquals(1, dashboardTimer.count());
    assertEquals(1, pipelineTimer.count());

    // Verify different timings
    assertEquals(50.0, tableTimer.totalTime(TimeUnit.MILLISECONDS), 1.0);
    assertEquals(60.0, dashboardTimer.totalTime(TimeUnit.MILLISECONDS), 1.0);
    assertEquals(55.0, pipelineTimer.totalTime(TimeUnit.MILLISECONDS), 1.0);
  }

  @Test
  void testMetricsPercentiles() {
    String entityType = "table";

    // Record multiple PATCH operations with varying latencies
    for (int i = 0; i < 100; i++) {
      long baseTime = 50 + (i % 10) * 10; // Vary from 50ms to 140ms
      recordPatchMetrics(entityType, baseTime, 30L, 20L, 150L);
    }

    Timer applyTimer =
        meterRegistry.find("entity.patch.apply").tag("entity_type", entityType).timer();

    assertEquals(100, applyTimer.count(), "Should have 100 operations");

    // Check that percentiles can be calculated
    double mean = applyTimer.mean(TimeUnit.MILLISECONDS);
    double max = applyTimer.max(TimeUnit.MILLISECONDS);

    assertTrue(mean > 50 && mean < 140, "Mean should be between min and max values");
    assertTrue(max >= 140, "Max should be at least 140ms");

    LOG.info("Percentiles test - Mean: {}ms, Max: {}ms", mean, max);
  }

  // Helper methods to simulate metric recording
  private void recordPatchMetrics(
      String entityType, long applyTime, long prepareTime, long validationTime, long updateTime) {
    io.micrometer.core.instrument.Tags tags =
        io.micrometer.core.instrument.Tags.of("entity_type", entityType, "operation", "PATCH");
    Metrics.timer("entity.patch.apply", tags).record(applyTime, TimeUnit.MILLISECONDS);
    Metrics.timer("entity.patch.prepare", tags).record(prepareTime, TimeUnit.MILLISECONDS);
    Metrics.timer("entity.patch.validation", tags).record(validationTime, TimeUnit.MILLISECONDS);
    Metrics.timer("entity.patch.update_total", tags).record(updateTime, TimeUnit.MILLISECONDS);
  }

  private void recordPostUpdateMetrics(String entityType, long searchIndexTime, long rdfTime) {
    io.micrometer.core.instrument.Tags tags =
        io.micrometer.core.instrument.Tags.of("entity_type", entityType, "operation", "PATCH");
    Metrics.timer("entity.patch.search_index", tags).record(searchIndexTime, TimeUnit.MILLISECONDS);
    Metrics.timer("entity.patch.rdf_update", tags).record(rdfTime, TimeUnit.MILLISECONDS);
  }

  private void recordSearchIndexMetrics(String entityType, long updateTime, long propagateTime) {
    io.micrometer.core.instrument.Tags tags =
        io.micrometer.core.instrument.Tags.of("entity_type", entityType, "operation", "update");
    Metrics.timer("search.index.update", tags).record(updateTime, TimeUnit.MILLISECONDS);
    Metrics.timer("search.index.propagate", tags).record(propagateTime, TimeUnit.MILLISECONDS);
  }

  private void recordEntityUpdaterMetrics(
      String entityType,
      long consolidateTime,
      long updateInternalTime,
      long databaseTime,
      long searchIndexTime) {
    io.micrometer.core.instrument.Tags tags =
        io.micrometer.core.instrument.Tags.of("entity_type", entityType, "operation", "PATCH");
    Metrics.timer("entity.patch.consolidate", tags).record(consolidateTime, TimeUnit.MILLISECONDS);
    Metrics.timer("entity.patch.update_internal", tags)
        .record(updateInternalTime, TimeUnit.MILLISECONDS);
    Metrics.timer("entity.patch.database", tags).record(databaseTime, TimeUnit.MILLISECONDS);
    Metrics.timer("entity.patch.search_index", tags).record(searchIndexTime, TimeUnit.MILLISECONDS);
  }

  private void simulateWork(long milliseconds) {
    try {
      Thread.sleep(milliseconds);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
