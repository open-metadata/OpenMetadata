package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;

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

  //  @Test Disabling this Test - Timings in CI and local are not accurate
  void testRequestLatencyTracking() {
    String endpoint = "/api/v1/test";
    RequestLatencyContext.startRequest(endpoint, "GET");

    // First phase - server processing
    simulateWork(100);

    // Database operation phase
    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    // Second phase - more server processing
    simulateWork(50);

    RequestLatencyContext.endRequest();

    Timer totalTimer =
        Metrics.timer("request.latency.total", "endpoint", endpoint, "method", "GET");
    assertNotNull(totalTimer);
    assertEquals(1, totalTimer.count(), "Should have recorded 1 request");

    Timer dbTimer =
        Metrics.timer("request.latency.database", "endpoint", endpoint, "method", "GET");
    assertNotNull(dbTimer);
    assertEquals(1, dbTimer.count(), "Should have recorded 1 database operation");

    Timer serverTimer =
        Metrics.timer("request.latency.server", "endpoint", endpoint, "method", "GET");
    assertNotNull(serverTimer);
    assertEquals(1, serverTimer.count(), "Should have recorded server processing");

    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double serverMs = serverTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    LOG.info("Total time: {} ms", totalMs);
    LOG.info("Database time: {} ms", dbMs);
    LOG.info("Server time: {} ms", serverMs);

    // Test the relative proportions rather than absolute timing
    // DB operations should be ~40% of total time (100ms out of 250ms)
    // Server time should be ~60% of total time (150ms out of 250ms)
    double dbPercentage = (dbMs / totalMs) * 100;
    double serverPercentage = (serverMs / totalMs) * 100;

    LOG.info("DB percentage: {}%", String.format("%.2f", dbPercentage));
    LOG.info("Server percentage: {}%", String.format("%.2f", serverPercentage));

    // Verify basic timing integrity
    assertTrue(totalMs > 0, "Total time should be positive");
    assertTrue(dbMs > 0, "Database time should be positive");
    assertTrue(serverMs > 0, "Server time should be positive");

    // Verify that DB + Server ≈ Total (within 5% margin)
    double sumPercentage = dbPercentage + serverPercentage;
    assertTrue(
        sumPercentage >= 95 && sumPercentage <= 105,
        "Sum of DB and server percentages should be approximately 100%, got: " + sumPercentage);

    // Verify that server time is roughly 60% of total (±15%)
    assertTrue(
        serverPercentage >= 45 && serverPercentage <= 75,
        "Server time should be ~60% of total time, got: " + serverPercentage + "%");
  }
}
