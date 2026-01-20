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
    Metrics.globalRegistry.getRegistries().forEach(Metrics.globalRegistry::remove);

    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    Metrics.addRegistry(registry);
    RequestLatencyContext.endRequest(); // Clean up any lingering context

    try {
      clearStaticMaps();
    } catch (Exception e) {
      // Ignore
    }
  }

  private void clearStaticMaps() throws Exception {
    java.lang.reflect.Field requestTimersField =
        RequestLatencyContext.class.getDeclaredField("requestTimers");
    requestTimersField.setAccessible(true);
    ((java.util.concurrent.ConcurrentHashMap<?, ?>) requestTimersField.get(null)).clear();

    java.lang.reflect.Field databaseTimersField =
        RequestLatencyContext.class.getDeclaredField("databaseTimers");
    databaseTimersField.setAccessible(true);
    ((java.util.concurrent.ConcurrentHashMap<?, ?>) databaseTimersField.get(null)).clear();

    java.lang.reflect.Field searchTimersField =
        RequestLatencyContext.class.getDeclaredField("searchTimers");
    searchTimersField.setAccessible(true);
    ((java.util.concurrent.ConcurrentHashMap<?, ?>) searchTimersField.get(null)).clear();

    java.lang.reflect.Field internalTimersField =
        RequestLatencyContext.class.getDeclaredField("internalTimers");
    internalTimersField.setAccessible(true);
    ((java.util.concurrent.ConcurrentHashMap<?, ?>) internalTimersField.get(null)).clear();

    java.lang.reflect.Field percentageHoldersField =
        RequestLatencyContext.class.getDeclaredField("percentageHolders");
    percentageHoldersField.setAccessible(true);
    ((java.util.concurrent.ConcurrentHashMap<?, ?>) percentageHoldersField.get(null)).clear();
  }

  @Test
  void testSimpleRequestWithDatabaseOperations() {
    String endpoint = "/api/v1/tables/test_endpoint";

    RequestLatencyContext.startRequest(endpoint, "GET");
    simulateWork(50);

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(30);

    dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(80);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(20);

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);
    RequestLatencyContext.endRequest();

    LOG.info("Original endpoint: {}, Normalized: {}", endpoint, normalizedEndpoint);
    LOG.info("Available meters:");
    Metrics.globalRegistry
        .getMeters()
        .forEach(
            meter -> {
              LOG.info(
                  "  Meter: {} type: {} with tags: {}",
                  meter.getId().getName(),
                  meter.getClass().getSimpleName(),
                  meter.getId().getTags());
            });

    Timer totalTimer = null;
    Timer dbTimer = null;
    Timer internalTimer = null;

    // Method 1: Direct lookup with normalized endpoint and method
    totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();

    // If null, try without tags first to see if timer exists
    if (totalTimer == null) {
      Timer anyTotalTimer = Metrics.globalRegistry.find("request.latency.total").timer();
      if (anyTotalTimer != null) {
        LOG.info(
            "Found total timer without tag filter, tags: {}",
            Metrics.globalRegistry.find("request.latency.total").meters());
      }

      // Try iterating through all meters to find our timer
      for (io.micrometer.core.instrument.Meter meter : Metrics.globalRegistry.getMeters()) {
        if (meter.getId().getName().equals("request.latency.total")) {
          String endpointTag = meter.getId().getTag("endpoint");
          String methodTag = meter.getId().getTag("method");
          LOG.info(
              "Found request.latency.total with endpoint tag: {}, method tag: {}",
              endpointTag,
              methodTag);
          if (normalizedEndpoint.equals(endpointTag) && "GET".equals(methodTag)) {
            totalTimer = (Timer) meter;
            LOG.info("Matched timer for endpoint: {}, method: {}", normalizedEndpoint, "GET");
          }
        }
      }
    }

    // Similar approach for database timer
    dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();

    if (dbTimer == null) {
      for (io.micrometer.core.instrument.Meter meter : Metrics.globalRegistry.getMeters()) {
        if (meter.getId().getName().equals("request.latency.database")) {
          String endpointTag = meter.getId().getTag("endpoint");
          String methodTag = meter.getId().getTag("method");
          if (normalizedEndpoint.equals(endpointTag) && "GET".equals(methodTag)) {
            dbTimer = (Timer) meter;
          }
        }
      }
    }

    // Similar approach for internal timer
    internalTimer =
        Metrics.globalRegistry
            .find("request.latency.internal")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();

    if (internalTimer == null) {
      for (io.micrometer.core.instrument.Meter meter : Metrics.globalRegistry.getMeters()) {
        if (meter.getId().getName().equals("request.latency.internal")) {
          String endpointTag = meter.getId().getTag("endpoint");
          String methodTag = meter.getId().getTag("method");
          if (normalizedEndpoint.equals(endpointTag) && "GET".equals(methodTag)) {
            internalTimer = (Timer) meter;
          }
        }
      }
    }

    assertNotNull(totalTimer, "Total timer should exist for endpoint: " + normalizedEndpoint);
    assertNotNull(dbTimer, "DB timer should exist for endpoint: " + normalizedEndpoint);
    assertNotNull(internalTimer, "Internal timer should exist for endpoint: " + normalizedEndpoint);

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

  //  @Test Disabling this Test - Timings in CI and local are not accurate
  void testRequestWithSearchOperations() {
    String endpoint = "/api/v1/search/query";

    RequestLatencyContext.startRequest(endpoint, "GET");
    simulateWork(10); // Reduce internal time to 10ms (was 20ms)

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    simulateWork(200); // Increase search time to 200ms (was 150ms)
    RequestLatencyContext.endSearchOperation(searchSample);

    simulateWork(15); // Reduce internal time to 15ms (was 30ms)
    RequestLatencyContext.endRequest();

    Gauge searchGauge =
        Metrics.globalRegistry
            .find("request.percentage.search")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .gauge();
    Gauge internalGauge =
        Metrics.globalRegistry
            .find("request.percentage.internal")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .gauge();

    assertNotNull(searchGauge);
    assertNotNull(internalGauge);

    double searchPercentage = searchGauge.value();
    double internalPercentage = internalGauge.value();

    LOG.info("Search: {}%", searchPercentage);
    LOG.info("Internal: {}%", internalPercentage);

    // With 200ms search time out of 225ms total (10+200+15), search should be ~88% of total time
    // Even with CI timing variations, it should comfortably exceed 60%
    assertTrue(
        searchPercentage >= 60,
        "Search should be at least 60% of request time, got: " + searchPercentage);
  }

  @Test
  void testComplexRequestWithAllComponents() {
    String endpoint = "/api/v1/complex/operation";
    RequestLatencyContext.startRequest(endpoint, "GET");

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

    Timer timer1 =
        Metrics.timer("request.latency.total", "endpoint", "/api/v1/thread1", "method", "GET");
    Timer timer2 =
        Metrics.timer("request.latency.total", "endpoint", "/api/v1/thread2", "method", "GET");

    assertEquals(1, timer1.count());
    assertEquals(1, timer2.count());

    assertNotEquals(
        timer1.totalTime(java.util.concurrent.TimeUnit.NANOSECONDS),
        timer2.totalTime(java.util.concurrent.TimeUnit.NANOSECONDS),
        "Different threads should have different timings");
  }

  private void simulateRequest(String endpoint, long dbTime, long searchTime, long internalTime) {
    RequestLatencyContext.startRequest(endpoint, "GET");

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

  @Test
  void testPatchOperationWithDetailedBreakdown() {
    String endpoint = "/api/v1/tables/{id}";
    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);

    // Start PATCH request tracking
    RequestLatencyContext.startRequest(endpoint, "PATCH");

    // Simulate initial processing
    simulateWork(20);

    // Database operation for fetching entity
    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(50);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    // Internal processing (patch apply, validation)
    simulateWork(100);

    // Database operation for storing update
    dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(80);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    // Search index update
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    simulateWork(200);
    RequestLatencyContext.endSearchOperation(searchSample);

    // Final internal processing
    simulateWork(30);

    RequestLatencyContext.endRequest();

    // Verify metrics
    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PATCH")
            .timer();
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PATCH")
            .timer();
    Timer searchTimer =
        Metrics.globalRegistry
            .find("request.latency.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PATCH")
            .timer();
    Timer internalTimer =
        Metrics.globalRegistry
            .find("request.latency.internal")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PATCH")
            .timer();

    assertNotNull(totalTimer, "Total timer should exist");
    assertNotNull(dbTimer, "DB timer should exist");
    assertNotNull(searchTimer, "Search timer should exist");
    assertNotNull(internalTimer, "Internal timer should exist");

    assertEquals(1, totalTimer.count(), "Should have 1 request");
    assertEquals(1, dbTimer.count(), "Should have database operations");
    assertEquals(1, searchTimer.count(), "Should have search operations");
    assertEquals(1, internalTimer.count(), "Should have internal processing");

    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double searchMs = searchTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double internalMs = internalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    LOG.info("PATCH operation breakdown:");
    LOG.info("  Total time: {}ms", String.format("%.2f", totalMs));
    LOG.info("  Database time: {}ms (2 operations)", String.format("%.2f", dbMs));
    LOG.info("  Search time: {}ms", String.format("%.2f", searchMs));
    LOG.info("  Internal time: {}ms", String.format("%.2f", internalMs));

    // Verify expected ranges
    assertTrue(totalMs >= 450, "Total time should be at least 450ms");
    assertTrue(dbMs >= 120, "Database time should be at least 120ms");
    assertTrue(searchMs >= 180, "Search time should be at least 180ms");
    assertTrue(internalMs >= 140, "Internal time should be at least 140ms");

    // Check percentage gauges
    Gauge dbPercentage =
        Metrics.globalRegistry
            .find("request.percentage.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PATCH")
            .gauge();
    Gauge searchPercentage =
        Metrics.globalRegistry
            .find("request.percentage.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PATCH")
            .gauge();

    assertNotNull(dbPercentage);
    assertNotNull(searchPercentage);

    LOG.info("  Database: {}%", String.format("%.1f", dbPercentage.value()));
    LOG.info("  Search: {}%", String.format("%.1f", searchPercentage.value()));

    // Search should be the dominant component in this test (>35%)
    assertTrue(
        searchPercentage.value() > 35,
        "Search should be >35% of request time, got: " + searchPercentage.value());
  }

  @Test
  void testMetricsRecordedEvenOnError() {
    String endpoint = "/api/v1/tables/{id}";

    try {
      RequestLatencyContext.startRequest(endpoint, "GET");
      simulateWork(50);

      Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
      simulateWork(100);
      RequestLatencyContext.endDatabaseOperation(dbSample);

      throw new RuntimeException("Simulated error");
    } catch (RuntimeException e) {
      // Error occurred, but metrics should still be recorded
    } finally {
      RequestLatencyContext.endRequest();
    }

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);
    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(totalTimer, "Total timer should exist even after error");
    assertNotNull(dbTimer, "DB timer should exist even after error");
    assertEquals(1, totalTimer.count(), "Should have recorded 1 request");
    assertEquals(1, dbTimer.count(), "Should have recorded DB operation");
  }

  @Test
  void testNullRequestContext() {
    // Call endRequest without starting - should not throw
    assertDoesNotThrow(() -> RequestLatencyContext.endRequest());

    Timer.Sample sample = RequestLatencyContext.startDatabaseOperation();
    assertNull(sample, "Should return null when no context");

    assertDoesNotThrow(() -> RequestLatencyContext.endDatabaseOperation(null));

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    assertNull(searchSample, "Should return null when no context");

    assertDoesNotThrow(() -> RequestLatencyContext.endSearchOperation(null));
  }

  @Test
  void testZeroTimeOperations() {
    String endpoint = "/api/v1/tables/quick";

    RequestLatencyContext.startRequest(endpoint, "GET");

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    RequestLatencyContext.endDatabaseOperation(dbSample);

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    RequestLatencyContext.endSearchOperation(searchSample);

    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();
    Timer searchTimer =
        Metrics.globalRegistry
            .find("request.latency.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(dbTimer, "DB timer should exist even with zero time");
    assertNotNull(searchTimer, "Search timer should exist even with zero time");
  }

  @Test
  void testEndpointNormalizationEdgeCases() {
    assertEquals("/unknown", MetricUtils.normalizeUri(null));
    assertEquals("/unknown", MetricUtils.normalizeUri("")); // Empty string returns /unknown
    assertEquals("/", MetricUtils.normalizeUri("/"));
    assertEquals(
        "/api/v1/tables/{name}", // UUIDs are normalized to {name} based on the current
        // implementation
        MetricUtils.normalizeUri("/api/v1/tables/550e8400-e29b-41d4-a716-446655440000"));
    assertEquals("/api/v1/tables/{name}", MetricUtils.normalizeUri("/api/v1/tables/test%20table"));
    assertEquals(
        "/api/v1/tables/{name}", // Numeric IDs are also normalized to {name}
        MetricUtils.normalizeUri("/api/v1/tables/123456"));
    assertEquals("/api/v1/tables", MetricUtils.normalizeUri("/api/v1/tables?query=test&limit=10"));
  }

  @Test
  void testContextPropagationToChildThreads() throws InterruptedException {
    String endpoint = "/api/v1/tables/bulk";

    // Start request in parent thread
    RequestLatencyContext.startRequest(endpoint, "PUT");
    simulateWork(10);

    // Get context for propagation
    RequestLatencyContext.RequestContext parentContext = RequestLatencyContext.getContext();
    assertNotNull(parentContext, "Parent context should exist");

    // Simulate bulk operation with child threads
    Thread childThread1 =
        new Thread(
            () -> {
              RequestLatencyContext.setContext(parentContext);
              try {
                Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
                simulateWork(50);
                RequestLatencyContext.endDatabaseOperation(dbSample);
              } finally {
                RequestLatencyContext.clearContext();
              }
            });

    Thread childThread2 =
        new Thread(
            () -> {
              RequestLatencyContext.setContext(parentContext);
              try {
                Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
                simulateWork(75);
                RequestLatencyContext.endDatabaseOperation(dbSample);
              } finally {
                RequestLatencyContext.clearContext();
              }
            });

    childThread1.start();
    childThread2.start();
    childThread1.join();
    childThread2.join();

    simulateWork(10);
    RequestLatencyContext.endRequest();

    // Verify that DB time from both child threads was accumulated
    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .timer();

    assertNotNull(dbTimer, "DB timer should exist");
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    LOG.info(
        "Total DB time from child threads: {}ms (expected ~125ms)", String.format("%.2f", dbMs));

    // DB time should include operations from both child threads (50ms + 75ms = 125ms min)
    assertTrue(
        dbMs >= 100, "DB time should accumulate from child threads, expected ~125ms, got: " + dbMs);
  }

  @Test
  void testContextGetSetClear() {
    // Test getContext returns null when no context
    assertNull(RequestLatencyContext.getContext(), "Should return null when no context");

    // Start a request
    RequestLatencyContext.startRequest("/api/v1/test", "GET");

    // Get context should return non-null
    RequestLatencyContext.RequestContext context = RequestLatencyContext.getContext();
    assertNotNull(context, "Should return context after startRequest");

    // Clear context
    RequestLatencyContext.clearContext();
    assertNull(RequestLatencyContext.getContext(), "Should return null after clearContext");

    // Set context again
    RequestLatencyContext.setContext(context);
    assertNotNull(RequestLatencyContext.getContext(), "Should return context after setContext");

    // Clean up
    RequestLatencyContext.endRequest();
  }

  @Test
  void testBulkOperationSimulation() throws InterruptedException {
    // Simulates the actual bulk operation pattern used in EntityRepository
    String endpoint = "/api/v1/tables/bulk";
    int numEntities = 10;
    int dbTimePerEntity = 20; // ms

    RequestLatencyContext.startRequest(endpoint, "PUT");
    simulateWork(5); // Initial processing

    RequestLatencyContext.RequestContext parentContext = RequestLatencyContext.getContext();

    // Simulate parallel entity processing like BOUNDED_BULK_EXECUTOR
    java.util.List<Thread> threads = new java.util.ArrayList<>();
    for (int i = 0; i < numEntities; i++) {
      Thread thread =
          new Thread(
              () -> {
                RequestLatencyContext.setContext(parentContext);
                try {
                  // Each entity does a DB lookup and update
                  Timer.Sample dbSample1 = RequestLatencyContext.startDatabaseOperation();
                  simulateWork(dbTimePerEntity / 2); // findByName
                  RequestLatencyContext.endDatabaseOperation(dbSample1);

                  Timer.Sample dbSample2 = RequestLatencyContext.startDatabaseOperation();
                  simulateWork(dbTimePerEntity / 2); // update
                  RequestLatencyContext.endDatabaseOperation(dbSample2);
                } finally {
                  RequestLatencyContext.clearContext();
                }
              });
      threads.add(thread);
      thread.start();
    }

    // Wait for all threads
    for (Thread t : threads) {
      t.join();
    }

    simulateWork(5); // Final processing
    RequestLatencyContext.endRequest();

    // Verify metrics
    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .timer();
    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .timer();

    assertNotNull(dbTimer, "DB timer should exist");
    assertNotNull(totalTimer, "Total timer should exist");

    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    // Expected: 10 entities * 20ms DB time = 200ms total DB time
    // Due to parallelism, wall clock time is less, but accumulated DB time should be ~200ms
    LOG.info(
        "Bulk simulation: total={}ms, db={}ms, entities={}, expected db ~{}ms",
        String.format("%.0f", totalMs),
        String.format("%.0f", dbMs),
        numEntities,
        numEntities * dbTimePerEntity);

    // DB time should be at least 80% of expected (allowing for timing variance)
    double expectedDbTime = numEntities * dbTimePerEntity;
    assertTrue(
        dbMs >= expectedDbTime * 0.8,
        String.format(
            "DB time should be at least %.0fms (80%% of expected), got: %.0fms",
            expectedDbTime * 0.8, dbMs));

    // Verify operation count
    var dbOperations =
        Metrics.globalRegistry
            .find("request.operations.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .summary();
    assertNotNull(dbOperations, "Should have database operations summary");
    assertEquals(
        numEntities * 2,
        dbOperations.totalAmount(),
        "Should have " + (numEntities * 2) + " DB operations (2 per entity)");
  }

  @Test
  void testConcurrentDbAndSearchOperations() throws InterruptedException {
    String endpoint = "/api/v1/search/bulk";

    RequestLatencyContext.startRequest(endpoint, "POST");
    RequestLatencyContext.RequestContext parentContext = RequestLatencyContext.getContext();

    // Thread 1: DB operations
    Thread dbThread =
        new Thread(
            () -> {
              RequestLatencyContext.setContext(parentContext);
              try {
                for (int i = 0; i < 3; i++) {
                  Timer.Sample sample = RequestLatencyContext.startDatabaseOperation();
                  simulateWork(30);
                  RequestLatencyContext.endDatabaseOperation(sample);
                }
              } finally {
                RequestLatencyContext.clearContext();
              }
            });

    // Thread 2: Search operations
    Thread searchThread =
        new Thread(
            () -> {
              RequestLatencyContext.setContext(parentContext);
              try {
                for (int i = 0; i < 2; i++) {
                  Timer.Sample sample = RequestLatencyContext.startSearchOperation();
                  simulateWork(50);
                  RequestLatencyContext.endSearchOperation(sample);
                }
              } finally {
                RequestLatencyContext.clearContext();
              }
            });

    dbThread.start();
    searchThread.start();
    dbThread.join();
    searchThread.join();

    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);

    // Verify DB metrics
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "POST")
            .timer();
    assertNotNull(dbTimer, "DB timer should exist");
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    assertTrue(dbMs >= 70, "DB time should be at least 70ms (3 * 30ms * 0.8), got: " + dbMs);

    // Verify Search metrics
    Timer searchTimer =
        Metrics.globalRegistry
            .find("request.latency.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "POST")
            .timer();
    assertNotNull(searchTimer, "Search timer should exist");
    double searchMs = searchTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    assertTrue(
        searchMs >= 80, "Search time should be at least 80ms (2 * 50ms * 0.8), got: " + searchMs);

    // Verify operation counts
    var dbOps =
        Metrics.globalRegistry
            .find("request.operations.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "POST")
            .summary();
    var searchOps =
        Metrics.globalRegistry
            .find("request.operations.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "POST")
            .summary();

    assertEquals(3, dbOps.totalAmount(), "Should have 3 DB operations");
    assertEquals(2, searchOps.totalAmount(), "Should have 2 search operations");

    LOG.info(
        "Mixed operations: db={}ms (3 ops), search={}ms (2 ops)",
        String.format("%.0f", dbMs),
        String.format("%.0f", searchMs));
  }

  @Test
  void testHighConcurrencyStressTest() throws InterruptedException {
    // Stress test with many concurrent threads to catch race conditions
    String endpoint = "/api/v1/stress/test";
    int numThreads = 50;
    int opsPerThread = 5;

    RequestLatencyContext.startRequest(endpoint, "PUT");
    RequestLatencyContext.RequestContext parentContext = RequestLatencyContext.getContext();

    java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);
    java.util.concurrent.CountDownLatch doneLatch =
        new java.util.concurrent.CountDownLatch(numThreads);

    for (int i = 0; i < numThreads; i++) {
      new Thread(
              () -> {
                try {
                  startLatch.await(); // Wait for all threads to be ready
                  RequestLatencyContext.setContext(parentContext);
                  try {
                    for (int j = 0; j < opsPerThread; j++) {
                      Timer.Sample sample = RequestLatencyContext.startDatabaseOperation();
                      // Minimal work to focus on concurrency
                      Thread.sleep(1);
                      RequestLatencyContext.endDatabaseOperation(sample);
                    }
                  } finally {
                    RequestLatencyContext.clearContext();
                  }
                } catch (InterruptedException e) {
                  Thread.currentThread().interrupt();
                } finally {
                  doneLatch.countDown();
                }
              })
          .start();
    }

    // Start all threads simultaneously
    startLatch.countDown();
    // Wait for completion
    doneLatch.await();

    RequestLatencyContext.endRequest();

    // Verify operation count is correct despite high concurrency
    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);
    var dbOps =
        Metrics.globalRegistry
            .find("request.operations.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .summary();

    assertNotNull(dbOps, "DB operations summary should exist");
    int expectedOps = numThreads * opsPerThread;
    assertEquals(
        expectedOps,
        dbOps.totalAmount(),
        String.format(
            "Should have exactly %d DB operations (%d threads * %d ops), got: %.0f",
            expectedOps, numThreads, opsPerThread, dbOps.totalAmount()));

    LOG.info(
        "Stress test passed: {} threads, {} ops each, total ops recorded: {}",
        numThreads,
        opsPerThread,
        (int) dbOps.totalAmount());
  }

  @Test
  void testTimingAccuracyWithKnownDurations() throws InterruptedException {
    // Test that timing measurements are reasonably accurate
    String endpoint = "/api/v1/timing/test";
    long expectedDbTime = 100; // ms
    long expectedSearchTime = 75; // ms
    long tolerance = 30; // Allow 30ms variance for CI environments

    RequestLatencyContext.startRequest(endpoint, "GET");

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    Thread.sleep(expectedDbTime);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    Thread.sleep(expectedSearchTime);
    RequestLatencyContext.endSearchOperation(searchSample);

    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();
    Timer searchTimer =
        Metrics.globalRegistry
            .find("request.latency.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();

    double actualDbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double actualSearchMs = searchTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    LOG.info(
        "Timing accuracy: expected db={}ms got={}ms, expected search={}ms got={}ms",
        expectedDbTime,
        String.format("%.0f", actualDbMs),
        expectedSearchTime,
        String.format("%.0f", actualSearchMs));

    assertTrue(
        Math.abs(actualDbMs - expectedDbTime) <= tolerance,
        String.format(
            "DB time should be within %dms of %dms, got: %.0fms",
            tolerance, expectedDbTime, actualDbMs));
    assertTrue(
        Math.abs(actualSearchMs - expectedSearchTime) <= tolerance,
        String.format(
            "Search time should be within %dms of %dms, got: %.0fms",
            tolerance, expectedSearchTime, actualSearchMs));
  }

  @Test
  void testPercentageCalculation() {
    String endpoint = "/api/v1/percentage/test";

    RequestLatencyContext.startRequest(endpoint, "GET");

    // 100ms DB, 100ms search, ~100ms internal = ~33% each
    simulateWork(50); // Internal

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(100);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(50); // Internal

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    simulateWork(100);
    RequestLatencyContext.endSearchOperation(searchSample);

    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);

    Gauge dbPercent =
        Metrics.globalRegistry
            .find("request.percentage.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .gauge();
    Gauge searchPercent =
        Metrics.globalRegistry
            .find("request.percentage.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .gauge();
    Gauge internalPercent =
        Metrics.globalRegistry
            .find("request.percentage.internal")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .gauge();

    assertNotNull(dbPercent, "DB percentage gauge should exist");
    assertNotNull(searchPercent, "Search percentage gauge should exist");
    assertNotNull(internalPercent, "Internal percentage gauge should exist");

    double db = dbPercent.value();
    double search = searchPercent.value();
    double internal = internalPercent.value();
    double total = db + search + internal;

    LOG.info(
        "Percentages: db={}%, search={}%, internal={}%, total={}%",
        String.format("%.1f", db),
        String.format("%.1f", search),
        String.format("%.1f", internal),
        String.format("%.1f", total));

    // Total should be ~100%
    assertTrue(
        total >= 95 && total <= 105,
        String.format("Total percentage should be ~100%%, got: %.1f%%", total));

    // Each component should be roughly 25-40% given the timing
    assertTrue(db >= 20 && db <= 45, String.format("DB should be 20-45%%, got: %.1f%%", db));
    assertTrue(
        search >= 20 && search <= 45,
        String.format("Search should be 20-45%%, got: %.1f%%", search));
  }

  private void printDetailedMetrics(String endpoint) {
    LOG.info("\n=== Detailed Metrics for {} ===", endpoint);

    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();
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
            .tag("method", "GET")
            .gauge();
    Gauge searchGauge =
        Metrics.globalRegistry
            .find("request.percentage.search")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .gauge();
    Gauge internalGauge =
        Metrics.globalRegistry
            .find("request.percentage.internal")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
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
