package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.atomic.AtomicReference;
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
    RequestLatencyContext.endRequest();
    RequestLatencyContext.reset();
  }

  @Test
  void testSimpleRequestWithDatabaseOperations() {
    String endpoint = "/v1/tables";

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

    RequestLatencyContext.endRequest();

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
    Timer serverTimer =
        Metrics.globalRegistry
            .find("request.latency.server")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(totalTimer, "Total timer should exist");
    assertNotNull(dbTimer, "DB timer should exist");
    assertNotNull(serverTimer, "Server timer should exist");

    assertEquals(1, totalTimer.count());
    assertEquals(1, dbTimer.count());
    assertEquals(1, serverTimer.count());

    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    assertTrue(totalMs >= 200, "Total time should be at least 200ms, got: " + totalMs);
    assertTrue(dbMs >= 140, "Database total should be at least 140ms, got: " + dbMs);
  }

  @Test
  void testComplexRequestWithAllComponents() {
    String endpoint = "/v1/tables";
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
    Timer searchTimer =
        Metrics.globalRegistry
            .find("request.latency.search")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();
    Timer serverTimer =
        Metrics.globalRegistry
            .find("request.latency.server")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(totalTimer);
    assertNotNull(dbTimer);
    assertNotNull(searchTimer);
    assertNotNull(serverTimer);

    assertEquals(1, totalTimer.count());
    assertEquals(1, dbTimer.count());
    assertEquals(1, searchTimer.count());
    assertEquals(1, serverTimer.count());
  }

  @Test
  void testAuthOperationTracking() {
    String endpoint = "/v1/tables";
    RequestLatencyContext.startRequest(endpoint, "GET");

    simulateWork(10);

    Timer.Sample authSample = RequestLatencyContext.startAuthOperation();
    simulateWork(50);
    RequestLatencyContext.endAuthOperation(authSample);

    simulateWork(20);

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(80);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(10);

    RequestLatencyContext.endRequest();

    Timer authTimer =
        Metrics.globalRegistry
            .find("request.latency.auth")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(authTimer, "Auth timer should exist");
    assertEquals(1, authTimer.count());
    double authMs = authTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    assertTrue(authMs >= 40, "Auth time should be at least 40ms, got: " + authMs);
  }

  @Test
  void testConcurrentRequests() throws InterruptedException {
    Thread thread1 = new Thread(() -> simulateRequest("/v1/thread1", 100, 50, 0));
    Thread thread2 = new Thread(() -> simulateRequest("/v1/thread2", 50, 100, 50));

    thread1.start();
    thread2.start();

    thread1.join();
    thread2.join();

    Timer timer1 =
        Metrics.timer("request.latency.total", "endpoint", "/v1/thread1", "method", "GET");
    Timer timer2 =
        Metrics.timer("request.latency.total", "endpoint", "/v1/thread2", "method", "GET");

    assertEquals(1, timer1.count());
    assertEquals(1, timer2.count());

    assertNotEquals(
        timer1.totalTime(java.util.concurrent.TimeUnit.NANOSECONDS),
        timer2.totalTime(java.util.concurrent.TimeUnit.NANOSECONDS));
  }

  private void simulateRequest(String endpoint, long dbTime, long searchTime, long serverTime) {
    RequestLatencyContext.startRequest(endpoint, "GET");

    if (serverTime > 0) {
      simulateWork(serverTime);
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
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "PATCH");

    simulateWork(20);

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(50);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    simulateWork(100);

    dbSample = RequestLatencyContext.startDatabaseOperation();
    simulateWork(80);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    simulateWork(200);
    RequestLatencyContext.endSearchOperation(searchSample);

    simulateWork(30);

    RequestLatencyContext.endRequest();

    Timer totalTimer =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", endpoint)
            .tag("method", "PATCH")
            .timer();
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "PATCH")
            .timer();
    Timer searchTimer =
        Metrics.globalRegistry
            .find("request.latency.search")
            .tag("endpoint", endpoint)
            .tag("method", "PATCH")
            .timer();
    Timer serverTimer =
        Metrics.globalRegistry
            .find("request.latency.server")
            .tag("endpoint", endpoint)
            .tag("method", "PATCH")
            .timer();

    assertNotNull(totalTimer);
    assertNotNull(dbTimer);
    assertNotNull(searchTimer);
    assertNotNull(serverTimer);

    double totalMs = totalTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double searchMs = searchTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double serverMs = serverTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

    assertTrue(totalMs >= 450, "Total time should be at least 450ms");
    assertTrue(dbMs >= 120, "Database time should be at least 120ms");
    assertTrue(searchMs >= 180, "Search time should be at least 180ms");
    assertTrue(serverMs >= 140, "Server time should be at least 140ms");
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

    Timer.Sample authSample = RequestLatencyContext.startAuthOperation();
    assertNull(authSample);

    assertDoesNotThrow(() -> RequestLatencyContext.endAuthOperation(null));
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
    assertEquals("/v1/tables", MetricUtils.classifyEndpoint("/v1/tables"));
    assertEquals("/v1/tables", MetricUtils.classifyEndpoint("/api/v1/tables/{id}"));
    assertEquals("/v1/search", MetricUtils.classifyEndpoint("/v1/search/query"));
    assertEquals("/v1/lineage", MetricUtils.classifyEndpoint("/v1/lineage/{id}"));
    assertEquals("/v1/domains", MetricUtils.classifyEndpoint("/v1/domains/{id}"));
    assertEquals("/v1/services", MetricUtils.classifyEndpoint("/v1/services/databaseServices"));
    assertEquals("other", MetricUtils.classifyEndpoint("/v1/unknownResource/{id}"));
    assertEquals("other", MetricUtils.classifyEndpoint("/health"));
  }

  @Test
  void testContextPropagationToChildThreads() throws InterruptedException {
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "PUT");
    simulateWork(10);

    RequestLatencyContext.RequestContext parentContext = RequestLatencyContext.getContext();
    assertNotNull(parentContext);

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

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "PUT")
            .timer();

    assertNotNull(dbTimer);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    assertTrue(dbMs >= 100, "DB time should accumulate from child threads, got: " + dbMs);
  }

  @Test
  void testWrapWithContextRunnable() throws InterruptedException {
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "PUT");

    Runnable wrapped =
        RequestLatencyContext.wrapWithContext(
            () -> {
              Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
              simulateWork(50);
              RequestLatencyContext.endDatabaseOperation(dbSample);
            });

    Thread child = new Thread(wrapped);
    child.start();
    child.join();

    RequestLatencyContext.endRequest();

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "PUT")
            .timer();

    assertNotNull(dbTimer);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    assertTrue(dbMs >= 40, "DB time should be tracked via wrapWithContext, got: " + dbMs);
  }

  @Test
  void testWrapWithContextSupplier() throws Exception {
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "GET");

    java.util.function.Supplier<String> wrapped =
        RequestLatencyContext.wrapWithContext(
            () -> {
              Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
              simulateWork(50);
              RequestLatencyContext.endDatabaseOperation(dbSample);
              return "result";
            });

    AtomicReference<String> result = new AtomicReference<>();
    Thread child =
        new Thread(
            () -> {
              result.set(wrapped.get());
            });
    child.start();
    child.join();

    RequestLatencyContext.endRequest();

    assertEquals("result", result.get());

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "GET")
            .timer();

    assertNotNull(dbTimer);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    assertTrue(dbMs >= 40, "DB time should be tracked via wrapWithContext supplier, got: " + dbMs);
  }

  @Test
  void testWrapWithContextReturnsOriginalWhenNoContext() {
    Runnable original = () -> {};
    Runnable wrapped = RequestLatencyContext.wrapWithContext(original);
    assertSame(original, wrapped, "Should return same runnable when no context");
  }

  @Test
  void testContextGetSetClear() {
    assertNull(RequestLatencyContext.getContext());

    RequestLatencyContext.startRequest("/v1/test", "GET");

    RequestLatencyContext.RequestContext context = RequestLatencyContext.getContext();
    assertNotNull(context);

    RequestLatencyContext.clearContext();
    assertNull(RequestLatencyContext.getContext());

    RequestLatencyContext.setContext(context);
    assertNotNull(RequestLatencyContext.getContext());

    RequestLatencyContext.endRequest();
  }

  @Test
  void testHighConcurrencyStressTest() throws InterruptedException {
    String endpoint = "/v1/stress/test";
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
                  startLatch.await();
                  RequestLatencyContext.setContext(parentContext);
                  try {
                    for (int j = 0; j < opsPerThread; j++) {
                      Timer.Sample sample = RequestLatencyContext.startDatabaseOperation();
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

    startLatch.countDown();
    doneLatch.await();

    RequestLatencyContext.endRequest();

    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", endpoint)
            .tag("method", "PUT")
            .timer();

    assertNotNull(dbTimer);
    double dbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    assertTrue(dbMs > 0, "DB time should be recorded under high concurrency");
  }

  @Test
  void testTimingAccuracyWithKnownDurations() throws InterruptedException {
    String endpoint = "/v1/timing/test";
    long expectedDbTime = 100;
    long expectedSearchTime = 75;
    long tolerance = 30;

    RequestLatencyContext.startRequest(endpoint, "GET");

    Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
    Thread.sleep(expectedDbTime);
    RequestLatencyContext.endDatabaseOperation(dbSample);

    Timer.Sample searchSample = RequestLatencyContext.startSearchOperation();
    Thread.sleep(expectedSearchTime);
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

    double actualDbMs = dbTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);
    double actualSearchMs = searchTimer.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS);

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
  void testNoHistogramBucketExplosion() {
    String endpoint = "/v1/tables";

    RequestLatencyContext.startRequest(endpoint, "GET");
    simulateWork(10);
    RequestLatencyContext.endRequest();

    long bucketMeters =
        Metrics.globalRegistry.getMeters().stream()
            .filter(m -> m.getId().getName().equals("request.latency.total"))
            .count();

    // With only SLO buckets (no publishPercentileHistogram), we should have exactly 1 timer
    // not dozens of histogram bucket meters
    assertTrue(
        bucketMeters <= 2,
        "Should not have histogram bucket explosion, found " + bucketMeters + " meters");
  }
}
