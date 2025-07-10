package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@Slf4j
class RequestLatencyContextTest {

  @BeforeEach
  void setUp() {
    Metrics.globalRegistry.clear();
    Metrics.addRegistry(new SimpleMeterRegistry());
  }

  @Test
  void testSimpleRequestWithDatabaseOperations() {
    String endpoint = "/api/v1/tables/test_endpoint";

    RequestLatencyContext.startRequest(endpoint);
    simulateWork(50);

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(30);

    dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(80);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(20);

    RequestLatencyContext.endRequest();
    Timer totalTimer = Metrics.timer("request.latency.total", "endpoint", endpoint);
    Timer dbTimer = Metrics.timer("request.latency.database", "endpoint", endpoint);
    Timer internalTimer = Metrics.timer("request.latency.internal", "endpoint", endpoint);

    assertEquals(1, totalTimer.count(), "Should have recorded 1 request");
    assertEquals(1, dbTimer.count(), "Should have recorded 1 request with database operations");
    assertEquals(1, internalTimer.count(), "Should have recorded internal processing");

    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double internalMs = internalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    LOG.info("Total time: {}ms", String.format("%.2f", totalMs));
    LOG.info("Database time: {}ms (2 operations)", String.format("%.2f", dbMs));
    LOG.info("Internal time: {}ms", String.format("%.2f", internalMs));

    assertTrue(totalMs >= 200, "Total time should be at least 200ms, got: " + totalMs);
    assertTrue(dbMs >= 140, "Database total should be at least 140ms, got: " + dbMs);
  }

  @Test
  void testRequestWithSearchOperations() {
    String endpoint = "/api/v1/search/query";

    RequestLatencyContext.startRequest(endpoint);
    simulateWork(20);

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    simulateWork(150);
    RequestLatencyContext.endSearchOperation(searchSample);

    simulateWork(30);
    RequestLatencyContext.endRequest();

    Gauge searchGauge =
        Metrics.globalRegistry.find("request.percentage.search").tag("endpoint", endpoint).gauge();
    Gauge internalGauge =
        Metrics.globalRegistry
            .find("request.percentage.internal")
            .tag("endpoint", endpoint)
            .gauge();

    assertNotNull(searchGauge);
    assertNotNull(internalGauge);

    double searchPercentage = searchGauge.value();
    double internalPercentage = internalGauge.value();

    LOG.info("Search: {}%", searchPercentage);
    LOG.info("Internal: {}%", internalPercentage);

    assertTrue(
        searchPercentage >= 60,
        "Search should be at least 60% of request time, got: " + searchPercentage);
  }

  @Test
  void testComplexRequestWithAllComponents() {
    String endpoint = "/api/v1/complex/operation";
    RequestLatencyContext.startRequest(endpoint);

    simulateWork(30);

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(50);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(20);

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    simulateWork(100);
    RequestLatencyContext.endSearchOperation(searchSample);

    simulateWork(25);

    dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(75);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(20);

    RequestLatencyContext.endRequest();

    // Total time should be ~320ms
    // DB: 125ms (39%)
    // Search: 100ms (31%)
    // Internal: 95ms (30%)

    printDetailedMetrics(endpoint);

    // Verify operation counts using DistributionSummary
    var dbOperations =
        Metrics.globalRegistry
            .find("request.operations.database")
            .tag("endpoint", endpoint)
            .summary();
    assertNotNull(dbOperations, "Should have database operations summary");
    assertEquals(
        1, dbOperations.count(), "Should have recorded 1 request with database operations");
    assertEquals(2, dbOperations.totalAmount(), "Should have 2 total database operations");

    var searchOperations =
        Metrics.globalRegistry
            .find("request.operations.search")
            .tag("endpoint", endpoint)
            .summary();
    assertNotNull(searchOperations, "Should have search operations summary");
    assertEquals(
        1, searchOperations.count(), "Should have recorded 1 request with search operations");
    assertEquals(1, searchOperations.totalAmount(), "Should have 1 total search operation");
  }

  @Test
  void testConcurrentRequests() throws InterruptedException {
    Thread thread1 = new Thread(() -> simulateRequest("/api/v1/thread1", 100, 50, 0));
    Thread thread2 = new Thread(() -> simulateRequest("/api/v1/thread2", 50, 100, 50));

    thread1.start();
    thread2.start();

    thread1.join();
    thread2.join();

    Timer timer1 = Metrics.timer("request.latency.total", "endpoint", "/api/v1/thread1");
    Timer timer2 = Metrics.timer("request.latency.total", "endpoint", "/api/v1/thread2");

    assertEquals(1, timer1.count());
    assertEquals(1, timer2.count());

    assertNotEquals(
        timer1.totalTime(java.util.concurrent.TimeUnit.NANOSECONDS),
        timer2.totalTime(java.util.concurrent.TimeUnit.NANOSECONDS),
        "Different threads should have different timings");
  }

  private void simulateRequest(String endpoint, long dbTime, long searchTime, long internalTime) {
    RequestLatencyContext.startRequest(endpoint);

    if (internalTime > 0) {
      simulateWork(internalTime);
    }

    if (dbTime > 0) {
      Timer.Sample sample = RequestLatencyContext.startDatabaseOperation();
      simulateWork(dbTime);
      RequestLatencyContext.endDatabaseOperation(sample);
    }

    if (searchTime > 0) {
      Timer.Sample sample = RequestLatencyContext.startSearchOperation();
      simulateWork(searchTime);
      RequestLatencyContext.endSearchOperation(sample);
    }

    RequestLatencyContext.endRequest();
  }

  private void printDetailedMetrics(String endpoint) {
    LOG.info("\n=== Detailed Metrics for {} ===", endpoint);

    Timer totalTimer = Metrics.timer("request.latency.total", "endpoint", endpoint);
    LOG.info("Total Request:");
    LOG.info(
        "  Mean: {}ms",
        String.format("%.2f", totalTimer.mean(java.util.concurrent.TimeUnit.MILLISECONDS)));
    LOG.info(
        "  Max: {}ms",
        String.format("%.2f", totalTimer.max(java.util.concurrent.TimeUnit.MILLISECONDS)));
    LOG.info("  Count: {}", totalTimer.count());

    Gauge dbGauge =
        Metrics.globalRegistry
            .find("request.percentage.database")
            .tag("endpoint", endpoint)
            .gauge();
    Gauge searchGauge =
        Metrics.globalRegistry.find("request.percentage.search").tag("endpoint", endpoint).gauge();
    Gauge internalGauge =
        Metrics.globalRegistry
            .find("request.percentage.internal")
            .tag("endpoint", endpoint)
            .gauge();

    if (dbGauge != null && searchGauge != null && internalGauge != null) {
      LOG.info("\nPercentage Breakdown:");
      LOG.info("  Database: {}%", String.format("%.1f", dbGauge.value()));
      LOG.info("  Search: {}%", String.format("%.1f", searchGauge.value()));
      LOG.info("  Internal: {}%", String.format("%.1f", internalGauge.value()));
      LOG.info(
          "  Total: {}%",
          String.format("%.1f", dbGauge.value() + searchGauge.value() + internalGauge.value()));
    }
    LOG.info("===========================\n");
  }
}
