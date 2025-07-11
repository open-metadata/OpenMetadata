package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import jakarta.servlet.ServletRegistration;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

    // Configure application
    when(config.getClusterName()).thenReturn("test-cluster");

    // Run bundle
    bundle.run(config, environment);

    // Verify metrics were created
    assertNotNull(bundle.getOpenMetadataMetrics());
    assertNotNull(bundle.getPrometheusMeterRegistry());

    // Verify filters were registered
    verify(jerseyEnv, times(2)).register(any());
  }

  @Test
  public void testPrometheusEndpoint() throws Exception {
    // Initialize and run bundle
    bundle.initialize(bootstrap);
    when(config.getClusterName()).thenReturn("test-cluster");
    bundle.run(config, environment);

    // Get the Prometheus registry
    PrometheusMeterRegistry registry = bundle.getPrometheusMeterRegistry();

    // Add some test metrics
    registry.counter("test.counter", "type", "test").increment();
    registry.gauge("test.gauge", 42.0);

    // Scrape metrics
    String metrics = registry.scrape();

    // Verify metrics format
    assertTrue(metrics.contains("# HELP test_counter"));
    assertTrue(metrics.contains("# TYPE test_counter counter"));
    assertTrue(metrics.contains("test_counter{type=\"test\""));
    assertTrue(metrics.contains("# HELP test_gauge"));
    assertTrue(metrics.contains("# TYPE test_gauge gauge"));
    assertTrue(metrics.contains("test_gauge 42.0"));
  }

  @Test
  public void testSystemMetricsBinding() {
    // Initialize and run bundle
    bundle.initialize(bootstrap);
    bundle.run(config, environment);

    // Get metrics output
    String metrics = bundle.getPrometheusMeterRegistry().scrape();

    // Verify system metrics are present
    assertTrue(metrics.contains("jvm_memory_used_bytes"));
    assertTrue(metrics.contains("jvm_gc_pause_seconds"));
    assertTrue(metrics.contains("jvm_threads_live_threads"));
    assertTrue(metrics.contains("system_cpu_usage"));
    assertTrue(metrics.contains("process_uptime_seconds"));
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

    // Verify metrics are recorded
    String metrics = bundle.getPrometheusMeterRegistry().scrape();
    assertTrue(metrics.contains("entity_operations_total{operation=\"create\",type=\"test\"}"));
    assertTrue(metrics.contains("search_queries_total"));
    assertTrue(metrics.contains("auth_attempts_total"));
  }
}
