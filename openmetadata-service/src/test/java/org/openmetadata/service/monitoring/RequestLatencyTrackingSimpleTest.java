package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Simple unit test for RequestLatencyContext to verify metrics recording.
 */
@Slf4j
class RequestLatencyTrackingSimpleTest {

  @BeforeEach
  void setup() {
    Metrics.globalRegistry.clear();
    Metrics.addRegistry(new SimpleMeterRegistry());
  }

  @Test
  void testRequestLatencyTracking() {
    String endpoint = "/api/v1/test";
    RequestLatencyContext.startRequest(endpoint);
    simulateWork(500);

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);
    simulateWork(30);
    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);
    Timer totalTimer = Metrics.timer("request.latency.total", "endpoint", normalizedEndpoint);
    assertNotNull(totalTimer);
    assertEquals(1, totalTimer.count(), "Should have recorded 1 request");

    Timer dbTimer = Metrics.timer("request.latency.database", "endpoint", normalizedEndpoint);
    assertNotNull(dbTimer);
    assertEquals(1, dbTimer.count(), "Should have recorded 1 database operation");

    Timer internalTimer = Metrics.timer("request.latency.internal", "endpoint", normalizedEndpoint);
    assertNotNull(internalTimer);
    assertEquals(1, internalTimer.count(), "Should have recorded internal processing");

    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double internalMs = internalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    LOG.info("Total time: {} ms", totalMs);
    LOG.info("Database time: {} ms", dbMs);
    LOG.info("Internal time: {} ms", internalMs);

    // Timing expectations: 500ms + 100ms + 30ms = 630ms total
    // DB time: 100ms during database operation
    // Internal time: 500ms (before DB) + 30ms (after DB) = 530ms
    // Allow generous bounds for system timing variations
    assertTrue(totalMs >= 500 && totalMs <= 1000, "Total time should be ~630ms, got: " + totalMs);
    assertTrue(dbMs >= 80 && dbMs <= 150, "Database time should be ~100ms, got: " + dbMs);
    assertTrue(
        internalMs >= 400 && internalMs <= 700,
        "Internal time should be ~530ms, got: " + internalMs);
  }
}
