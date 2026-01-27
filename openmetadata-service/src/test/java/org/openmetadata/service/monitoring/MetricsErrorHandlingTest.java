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
public class MetricsErrorHandlingTest {

  @BeforeEach
  void setUp() {
    // Clear any existing registries
    Metrics.globalRegistry.clear();
    // Clear all registries to avoid conflicts
    Metrics.globalRegistry.getRegistries().forEach(Metrics.globalRegistry::remove);

    // Add a new simple registry for testing
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    Metrics.addRegistry(registry);

    // Also ensure RequestLatencyContext is clean
    // This is important because it uses static maps
    RequestLatencyContext.endRequest(); // Clean up any lingering context

    // Clear the static maps in RequestLatencyContext via reflection if needed
    try {
      clearStaticMaps();
    } catch (Exception e) {
      // Ignore
    }
  }

  private void clearStaticMaps() throws Exception {
    // Use reflection to clear static maps in RequestLatencyContext
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
  void testMetricsRecordedEvenOnError() {
    String endpoint = "/api/v1/tables/{id}";

    try {
      RequestLatencyContext.startRequest(endpoint, "GET");

      // Simulate some work
      simulateWork(50);

      // Database operation
      Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
      simulateWork(100);
      RequestLatencyContext.endDatabaseOperation(dbSample);

      // Simulate an error occurring
      throw new RuntimeException("Simulated error");
    } catch (RuntimeException e) {
      // Error occurred, but metrics should still be recorded
    } finally {
      RequestLatencyContext.endRequest();
    }

    // Verify metrics were recorded despite the error
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

    // Try database operation without context
    Timer.Sample sample = RequestLatencyContext.startDatabaseOperation();
    assertNull(sample, "Should return null when no context");

    // Try ending database operation with null sample
    assertDoesNotThrow(() -> RequestLatencyContext.endDatabaseOperation(null));

    // Try search operation without context
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    assertNull(searchSample, "Should return null when no context");

    // Try ending search operation with null sample
    assertDoesNotThrow(() -> RequestLatencyContext.endSearchOperation(null));
  }

  @Test
  void testZeroTimeOperations() {
    String endpoint = "/api/v1/tables/quick";

    RequestLatencyContext.startRequest(endpoint, "GET");

    // Database operation with no time
    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    RequestLatencyContext.endDatabaseOperation(dbSample);

    // Search operation with no time
    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    RequestLatencyContext.endSearchOperation(searchSample);

    RequestLatencyContext.endRequest();

    // Verify metrics exist even with zero time
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
    // Test various edge cases for endpoint normalization
    testEndpointNormalization(null, "/unknown");
    testEndpointNormalization(
        "", "/unknown"); // Empty string returns /unknown to avoid blank endpoints
    testEndpointNormalization("/", "/");
    testEndpointNormalization(
        "/api/v1/tables/550e8400-e29b-41d4-a716-446655440000", "/api/v1/tables/{name}");
    testEndpointNormalization("/api/v1/tables/test%20table", "/api/v1/tables/{name}");
    testEndpointNormalization("/api/v1/tables/123456", "/api/v1/tables/{name}");
    testEndpointNormalization("/api/v1/tables?query=test&limit=10", "/api/v1/tables");
  }

  private void testEndpointNormalization(String input, String expected) {
    String normalized = MetricUtils.normalizeUri(input);
    assertEquals(expected, normalized, "Failed for input: " + input);
  }

  @Test
  void testMultipleStartsWithoutEnd() {
    String endpoint1 = "/api/v1/tables/first";
    String endpoint2 = "/api/v1/tables/second";

    // Start first request
    RequestLatencyContext.startRequest(endpoint1, "GET");
    simulateWork(50);

    // Start second request without ending first (simulating thread reuse)
    RequestLatencyContext.startRequest(endpoint2, "GET");
    simulateWork(100);
    RequestLatencyContext.endRequest();

    // Verify only second request is recorded
    String normalizedEndpoint2 = MetricUtils.normalizeUri(endpoint2);
    Timer timer2 =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", normalizedEndpoint2)
            .tag("method", "GET")
            .timer();

    assertNotNull(timer2);
    assertEquals(1, timer2.count());
  }

  @Test
  void testVeryLongEndpoint() {
    // Test endpoint longer than 100 characters
    String longEndpoint =
        "/api/v1/tables/" + "a".repeat(50) + "/columns/" + "b".repeat(50) + "/details";

    RequestLatencyContext.startRequest(longEndpoint, "GET");
    simulateWork(50);
    RequestLatencyContext.endRequest();

    // Should be truncated
    String normalized = MetricUtils.normalizeUri(longEndpoint);
    LOG.info(
        "Long endpoint normalization: '{}' -> '{}' (length: {})",
        longEndpoint,
        normalized,
        normalized.length());

    // The long endpoint gets normalized to /api/v1/tables/{name}/columns/{name}/details
    // This is shorter than 100 chars so no truncation happens
    assertEquals(
        "/api/v1/tables/{name}/columns/{name}/details",
        normalized,
        "Long endpoint should be normalized to use placeholders");
    assertTrue(normalized.length() <= 105, "Normalized endpoint should not be too long");

    Timer timer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", normalized)
            .tag("method", "GET")
            .timer();
    assertNotNull(timer);
  }

  @Test
  void testPercentageCalculationWithZeroTotal() {
    String endpoint = "/api/v1/instant";

    RequestLatencyContext.startRequest(endpoint, "GET");
    // End immediately without any operations
    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);

    // Percentages should handle zero total time gracefully
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

    // With zero total time, percentages might not be created or should be 0
    if (dbPercent != null) {
      assertTrue(
          Double.isNaN(dbPercent.value()) || dbPercent.value() == 0.0,
          "DB percentage should be NaN or 0 with zero total time");
    }
  }

  @Test
  void testNestedDatabaseOperations() {
    String endpoint = "/api/v1/tables/nested";

    RequestLatencyContext.startRequest(endpoint, "GET");

    // Start first DB operation
    Timer.Sample db1 = RequestLatencyContext.startDatabaseOperation();
    simulateWork(50);

    // Start nested DB operation (should be ignored or handled gracefully)
    Timer.Sample db2 = RequestLatencyContext.startDatabaseOperation();
    simulateWork(30);
    RequestLatencyContext.endDatabaseOperation(db2);

    // End first DB operation
    RequestLatencyContext.endDatabaseOperation(db1);

    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(dbTimer);
    assertEquals(1, dbTimer.count());
    // Total time should include both operations
    assertTrue(dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS) >= 70);
  }

  @Test
  void testOperationCountsWithNoOperations() {
    String endpoint = "/api/v1/tables/noops";

    RequestLatencyContext.startRequest(endpoint, "GET");
    simulateWork(100);
    RequestLatencyContext.endRequest();

    String normalizedEndpoint = MetricUtils.normalizeUri(endpoint);

    // Should not create operation count summaries if no operations
    var dbOperations =
        Metrics.globalRegistry
            .find("request.operations.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .summary();
    var searchOperations =
        Metrics.globalRegistry
            .find("request.operations.search")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "GET")
            .summary();

    assertNull(dbOperations, "Should not create DB operations summary with 0 operations");
    assertNull(searchOperations, "Should not create search operations summary with 0 operations");
  }
}
