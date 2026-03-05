package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.simulateWork;

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
    Metrics.globalRegistry.clear();
    Metrics.globalRegistry.getRegistries().forEach(Metrics.globalRegistry::remove);

    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    Metrics.addRegistry(registry);

    RequestLatencyContext.endRequest();
    RequestLatencyContext.reset();
  }

  @Test
  void testMetricsRecordedEvenOnError() {
    String endpoint = "/v1/tables";

    try {
      RequestLatencyContext.startRequest(endpoint, "GET");
      simulateWork(50);

      Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
      simulateWork(100);
      RequestLatencyContext.endDatabaseOperation(dbSample);

      throw new RuntimeException("Simulated error");
    } catch (RuntimeException e) {
      // Expected
    } finally {
      RequestLatencyContext.endRequest();
    }

    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(totalTimer, "Total timer should exist even after error");
    assertNotNull(dbTimer, "DB timer should exist even after error");
    assertEquals(1, totalTimer.count());
    assertEquals(1, dbTimer.count());
  }

  @Test
  void testNullRequestContext() {
    assertDoesNotThrow(() -> RequestLatencyContext.endRequest());

    Timer.Sample sample = RequestLatencyContext.startDatabaseOperation();
    assertNull(sample);

    assertDoesNotThrow(() -> RequestLatencyContext.endDatabaseOperation(null));

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    assertNull(searchSample);

    assertDoesNotThrow(() -> RequestLatencyContext.endSearchOperation(null));
  }

  @Test
  void testZeroTimeOperations() {
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "GET");

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    RequestLatencyContext.endDatabaseOperation(dbSample);

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    RequestLatencyContext.endSearchOperation(searchSample);

    RequestLatencyContext.endRequest();

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();
    Timer searchTimer =
        Metrics.globalRegistry
            .find("request.latency.search")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(dbTimer);
    assertNotNull(searchTimer);
  }

  @Test
  void testClassifyEndpoint() {
    assertEquals("other", MetricUtils.classifyEndpoint(null));
    assertEquals("other", MetricUtils.classifyEndpoint(""));
    assertEquals("other", MetricUtils.classifyEndpoint("/"));
    assertEquals("/v1/tables", MetricUtils.classifyEndpoint("/v1/tables/{id}"));
    assertEquals("/v1/tables", MetricUtils.classifyEndpoint("/api/v1/tables/{id}"));
    assertEquals("/v1/search", MetricUtils.classifyEndpoint("/v1/search/query"));
    assertEquals("/v1/lineage", MetricUtils.classifyEndpoint("/v1/lineage/{id}"));
    assertEquals("other", MetricUtils.classifyEndpoint("/v1/unknownResource/{id}"));
    assertEquals("other", MetricUtils.classifyEndpoint("/health"));
  }

  @Test
  void testMultipleStartsWithoutEnd() {
    String endpoint1 = "/v1/tables/{id}";
    String endpoint2 = "/v1/tables/{id}";

    RequestLatencyContext.startRequest(endpoint1, "GET");
    simulateWork(50);

    RequestLatencyContext.startRequest(endpoint2, "GET");
    simulateWork(100);
    RequestLatencyContext.endRequest();

    Timer timer2 =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", endpoint2)
            .tag("method", "GET")
            .timer();

    assertNotNull(timer2);
    assertEquals(1, timer2.count());
  }

  @Test
  void testVeryLongEndpointClassifiedCorrectly() {
    String longEndpoint =
        "/api/v1/tables/" + "a".repeat(50) + "/columns/" + "b".repeat(50) + "/details";

    String classified = MetricUtils.classifyEndpoint(longEndpoint);
    assertEquals("/v1/tables", classified, "Long endpoint should classify to its resource");

    RequestLatencyContext.startRequest(classified, "GET");
    simulateWork(50);
    RequestLatencyContext.endRequest();

    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", "/v1/tables")
            .tag("method", "GET")
            .timer();
    assertNotNull(totalTimer);
    assertEquals(1, totalTimer.count());
  }

  @Test
  void testEndRequestWithNoOperations() {
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "GET");
    simulateWork(100);
    RequestLatencyContext.endRequest();

    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(totalTimer);
    assertEquals(1, totalTimer.count());
  }

  @Test
  void testNestedDatabaseOperations() {
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "GET");

    Timer.Sample db1 = RequestLatencyContext.startDatabaseOperation();
    simulateWork(50);

    Timer.Sample db2 = RequestLatencyContext.startDatabaseOperation();
    simulateWork(30);
    RequestLatencyContext.endDatabaseOperation(db2);

    RequestLatencyContext.endDatabaseOperation(db1);

    RequestLatencyContext.endRequest();

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(dbTimer);
    assertEquals(1, dbTimer.count());
    assertTrue(dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS) >= 70);
  }
}
