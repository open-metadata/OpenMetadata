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

    // First phase - internal processing
    simulateWork(100);

    // Database operation phase
    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    // Second phase - more internal processing
    simulateWork(50);

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

    // Test the relative proportions rather than absolute timing
    // DB operations should be ~40% of total time (100ms out of 250ms)
    // Internal time should be ~60% of total time (150ms out of 250ms)
    double dbPercentage = (dbMs / totalMs) * 100;
    double internalPercentage = (internalMs / totalMs) * 100;

    LOG.info("DB percentage: {}%", String.format("%.2f", dbPercentage));
    LOG.info("Internal percentage: {}%", String.format("%.2f", internalPercentage));

    // Verify basic timing integrity
    assertTrue(totalMs > 0, "Total time should be positive");
    assertTrue(dbMs > 0, "Database time should be positive");
    assertTrue(internalMs > 0, "Internal time should be positive");

    // Verify that DB + Internal ≈ Total (within 5% margin)
    double sumPercentage = dbPercentage + internalPercentage;
    assertTrue(
        sumPercentage >= 95 && sumPercentage <= 105,
        "Sum of DB and internal percentages should be approximately 100%, got: " + sumPercentage);

    // Verify that internal time is roughly 60% of total (±15%)
    assertTrue(
        internalPercentage >= 45 && internalPercentage <= 75,
        "Internal time should be ~60% of total time, got: " + internalPercentage + "%");
  }
}
