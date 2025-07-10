package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;

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
public class RequestLatencyTrackingSimpleTest {

  @BeforeEach
  void setup() {
    // Clear global registry and add a simple registry for testing
    Metrics.globalRegistry.clear();
    Metrics.addRegistry(new SimpleMeterRegistry());
  }

  @Test
  void testRequestLatencyTracking() throws InterruptedException {
    String endpoint = "/api/v1/test";

    // Simulate a request
    RequestLatencyContext.startRequest(endpoint);

    // Simulate internal processing
    Thread.sleep(50);

    // Simulate database operation
    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    Thread.sleep(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    // More internal processing
    Thread.sleep(30);

    // End request
    RequestLatencyContext.endRequest();

    // Verify metrics
    Timer totalTimer = Metrics.timer("request.latency.total", "endpoint", endpoint);
    assertNotNull(totalTimer);
    assertEquals(1, totalTimer.count(), "Should have recorded 1 request");

    Timer dbTimer = Metrics.timer("request.latency.database", "endpoint", endpoint);
    assertNotNull(dbTimer);
    assertEquals(1, dbTimer.count(), "Should have recorded 1 database operation");

    Timer internalTimer = Metrics.timer("request.latency.internal", "endpoint", endpoint);
    assertNotNull(internalTimer);
    assertEquals(1, internalTimer.count(), "Should have recorded internal processing");

    // Check timing
    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double internalMs = internalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    LOG.info("Total time: {} ms", totalMs);
    LOG.info("Database time: {} ms", dbMs);
    LOG.info("Internal time: {} ms", internalMs);

    // Total should be approximately 180ms
    assertTrue(totalMs >= 150 && totalMs <= 210, "Total time should be ~180ms, got: " + totalMs);

    // Database should be approximately 100ms
    assertTrue(dbMs >= 80 && dbMs <= 120, "Database time should be ~100ms, got: " + dbMs);

    // Internal should be approximately 80ms
    assertTrue(
        internalMs >= 60 && internalMs <= 100, "Internal time should be ~80ms, got: " + internalMs);
  }
}
