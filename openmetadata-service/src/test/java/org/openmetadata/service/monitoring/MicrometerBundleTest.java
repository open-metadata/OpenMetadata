package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.micrometer.core.instrument.FunctionCounter;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import jakarta.servlet.ServletRegistration;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.service.OpenMetadataApplicationConfig;

public class MicrometerBundleTest {

  @Mock private OpenMetadataApplicationConfig config;
  @Mock private Environment environment;
  @Mock private Bootstrap<?> bootstrap;
  @Mock private io.dropwizard.jersey.setup.JerseyEnvironment jerseyEnv;
  @Mock private io.dropwizard.core.setup.AdminEnvironment adminEnv;
  @Mock private ServletRegistration.Dynamic servletRegistration;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;

  private MicrometerBundle bundle;

  @BeforeEach
  public void setUp() {
    MockitoAnnotations.openMocks(this);
    bundle = new MicrometerBundle();

    // Setup mocks
    when(environment.jersey()).thenReturn(jerseyEnv);
    when(environment.admin()).thenReturn(adminEnv);
    when(adminEnv.addServlet(anyString(), any(jakarta.servlet.Servlet.class)))
        .thenReturn(servletRegistration);

    // Mock config for all tests
    when(config.getClusterName()).thenReturn("test-cluster");
  }

  @AfterEach
  void removeRegistry() {
    PrometheusMeterRegistry registry = bundle.getPrometheusMeterRegistry();
    if (registry != null) {
      Metrics.removeRegistry(registry);
      registry.close();
    }
  }

  @Test
  public void testInitialize() {
    // Initialize should create Prometheus registry
    bundle.initialize(bootstrap);

    assertNotNull(bundle.getPrometheusMeterRegistry());
    assertTrue(
        Metrics.globalRegistry.getRegistries().contains(bundle.getPrometheusMeterRegistry()));
  }

  @Test
  public void testRun() {
    // Initialize first
    bundle.initialize(bootstrap);

    // Run bundle
    bundle.run(config, environment);

    // Verify metrics were created
    assertNotNull(bundle.getOpenMetadataMetrics());
    assertNotNull(bundle.getPrometheusMeterRegistry());

    // The bundle creates real objects, not mocks, so we can't verify mock calls
    // Instead, verify that the objects were created correctly
    assertFalse(bundle.getPrometheusMeterRegistry().getMeters().isEmpty());
    verify(jerseyEnv, times(1))
        .register(any(org.glassfish.jersey.internal.inject.AbstractBinder.class));
  }

  @Test
  public void testRunConfiguresRequestLatencyPercentileHistogram() {
    EventMonitorConfiguration eventMonitorConfiguration = new EventMonitorConfiguration();
    eventMonitorConfiguration.setRequestLatencyPercentileHistogram(true);
    when(config.getEventMonitorConfiguration()).thenReturn(eventMonitorConfiguration);
    bundle.initialize(bootstrap);
    bundle.run(config, environment);

    String endpoint = "/v1/micrometer-bundle-histogram";
    RequestLatencyContext.startRequest(endpoint, "GET");
    RequestLatencyContext.endRequest();

    Timer timer =
        bundle
            .getPrometheusMeterRegistry()
            .find("request.latency.total")
            .tag("http_route", endpoint)
            .tag("method", "GET")
            .timer();
    assertNotNull(timer);
    assertTrue(
        timer.takeSnapshot().histogramCounts().length > MetricUtils.LATENCY_SLA_BUCKETS.length);
    RequestLatencyContext.reset();
  }

  @Test
  void renamesTheApplicationRouteOnlyInThePrometheusRegistry() {
    bundle.initialize(bootstrap);
    String route = "/v1/micrometer-bundle-route";
    Timer timer =
        Metrics.globalRegistry.timer("request.latency.total", "endpoint", route, "method", "GET");
    try {
      timer.record(12, TimeUnit.MILLISECONDS);
      String scrape = bundle.getPrometheusMeterRegistry().scrape();
      assertTrue(scrape.contains("http_route=\"" + route + "\""));
      assertFalse(scrape.contains("endpoint=\"" + route + "\""));
      assertEquals(
          1L,
          Metrics.globalRegistry
              .get("request.latency.total")
              .tag("endpoint", route)
              .timer()
              .count());
    } finally {
      Metrics.globalRegistry.remove(timer);
    }
  }

  @Test
  void exportsCpuSecondsFromTheExistingNanosecondsCounter() {
    AtomicLong cpuNanos = new AtomicLong(9_000_000_000L);
    PrometheusMeterRegistry registry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    try {
      registry.throwExceptionOnRegistrationFailure();
      FunctionCounter.builder("process.cpu.time", cpuNanos, AtomicLong::get)
          .baseUnit("ns")
          .register(registry);
      MicrometerBundle.registerProcessCpuSeconds(registry);

      String scrape = registry.scrape();
      assertTrue(scrape.contains("# TYPE process_cpu_seconds_total counter"));
      assertTrue(scrape.contains("process_cpu_seconds_total 9.0"));
      assertTrue(scrape.contains("process_cpu_time_ns_total 9.0E9"));
      cpuNanos.addAndGet(125_000_000L);
      assertTrue(registry.scrape().contains("process_cpu_seconds_total 9.125"));
    } finally {
      registry.close();
    }
  }

  @Test
  void leavesCpuTimeAbsentWhenTheJvmHasNoCounter() {
    PrometheusMeterRegistry registry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    try {
      MicrometerBundle.registerProcessCpuSeconds(registry);
      assertFalse(registry.scrape().contains("process_cpu_seconds_total"));
    } finally {
      registry.close();
    }
  }

  @Test
  public void testPrometheusEndpoint() {
    // Initialize and run bundle
    bundle.initialize(bootstrap);
    bundle.run(config, environment);

    // Get the Prometheus registry
    PrometheusMeterRegistry registry = bundle.getPrometheusMeterRegistry();

    // Add some test metrics
    registry.counter("test_counter", "type", "test").increment();
    AtomicReference<Double> testGauge = new AtomicReference<>(42.0);
    registry.gauge("test_gauge", testGauge, AtomicReference::get);

    // Scrape metrics
    String metrics = registry.scrape();

    // Verify metrics format - Prometheus converts dots to underscores
    assertTrue(metrics.contains("test_counter_total"), "Should contain test_counter_total metric");
    assertTrue(metrics.contains("type=\"test\""), "Should contain type tag");
    assertTrue(metrics.contains("test_gauge"), "Should contain test_gauge metric");

    // Verify the gauge value is present
    assertTrue(metrics.matches("(?s).*test_gauge.*42\\.0.*"), "Should contain gauge value 42.0");
  }

  @Test
  public void testSystemMetricsBinding() {
    // Initialize and run bundle
    bundle.initialize(bootstrap);
    bundle.run(config, environment);

    // Get metrics output
    String metrics = bundle.getPrometheusMeterRegistry().scrape();

    // Verify that we have metrics registered
    assertNotNull(metrics);
    assertFalse(metrics.isEmpty());

    // Verify at least some JVM metrics are present (names may vary by JVM version)
    assertTrue(
        metrics.contains("jvm") || metrics.contains("process"),
        "Should contain JVM or process metrics");

    // Verify the registry has meters registered
    assertTrue(
        !bundle.getPrometheusMeterRegistry().getMeters().isEmpty(),
        "Should have registered meters");
    assertTrue(metrics.length() > 1000, "Should have substantial metrics output");
  }

  @Test
  public void testOpenMetadataMetricsIntegration() {
    // Initialize and run bundle
    bundle.initialize(bootstrap);
    bundle.run(config, environment);

    // Get OpenMetadataMetrics instance
    OpenMetadataMetrics omMetrics = bundle.getOpenMetadataMetrics();
    assertNotNull(omMetrics);

    // Test recording some metrics
    omMetrics.recordEntityCreated("test");
    omMetrics.recordSearchQuery("test", 10);
    omMetrics.recordAuthenticationAttempt("basic");

    // Verify metrics are recorded - the counters should be incremented from their initial 0 values
    String metrics = bundle.getPrometheusMeterRegistry().scrape();
    // After recording, these counters should show > 0 values
    assertTrue(metrics.contains("entity_operations_total"));
    assertTrue(metrics.contains("search_queries_total"));
    assertTrue(metrics.contains("auth_attempts_total"));
    // Verify the metrics actually changed from default 0 values
    assertTrue(
        !metrics.contains(
                "entity_operations_total{application=\"openmetadata\",cluster=\"test-cluster\",operation=\"create\",type=\"test\"} 0.0")
            || metrics.contains(
                "entity_operations_total{application=\"openmetadata\",cluster=\"test-cluster\",operation=\"create\",type=\"test\"} 1.0"));
  }
}
