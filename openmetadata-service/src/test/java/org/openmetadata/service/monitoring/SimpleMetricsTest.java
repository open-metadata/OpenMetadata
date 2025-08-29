package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@Slf4j
public class SimpleMetricsTest {

  @BeforeEach
  void setUp() {
    Metrics.globalRegistry.clear();
    Metrics.addRegistry(new SimpleMeterRegistry());
  }

  @Test
  void testDirectTimerCreation() {
    // Create a timer directly
    Timer timer =
        Timer.builder("test.timer")
            .tag("endpoint", "/test")
            .description("Test timer")
            .register(Metrics.globalRegistry);

    // Record some time
    timer.record(100, TimeUnit.MILLISECONDS);

    // Try to find it
    Timer foundTimer = Metrics.globalRegistry.find("test.timer").tag("endpoint", "/test").timer();

    assertNotNull(foundTimer, "Should find the timer we just created");
    assertEquals(1, foundTimer.count(), "Should have 1 recording");
    assertEquals(100.0, foundTimer.totalTime(TimeUnit.MILLISECONDS), 0.1);
  }

  @Test
  void testRequestLatencyContextBasic() {
    String endpoint = "/api/v1/test";

    // Start and end a request
    RequestLatencyContext.startRequest(endpoint, "GET");
    try {
      Thread.sleep(50);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    RequestLatencyContext.endRequest();

    // Log all meters
    LOG.info("All meters after request:");
    Metrics.globalRegistry
        .getMeters()
        .forEach(
            meter -> {
              LOG.info(
                  "  Meter: {} type: {} tags: {}",
                  meter.getId().getName(),
                  meter.getClass().getSimpleName(),
                  meter.getId().getTags());
            });

    // The normalized endpoint
    String normalized = MetricUtils.normalizeUri(endpoint);
    LOG.info("Normalized endpoint: {}", normalized);

    // Try different ways to find the timer
    Timer timer1 = Metrics.globalRegistry.find("request.latency.total").timer();
    LOG.info("Timer without tags: {}", timer1);

    Timer timer2 =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tag("endpoint", normalized)
            .tag("method", "GET")
            .timer();
    LOG.info("Timer with normalized endpoint: {}", timer2);

    Timer timer3 =
        Metrics.globalRegistry
            .find("request.latency.total")
            .tags("endpoint", normalized, "method", "GET")
            .timer();
    LOG.info("Timer with tags method: {}", timer3);

    // At least one should work
    assertTrue(
        timer1 != null || timer2 != null || timer3 != null, "Should find at least one timer");
  }
}
