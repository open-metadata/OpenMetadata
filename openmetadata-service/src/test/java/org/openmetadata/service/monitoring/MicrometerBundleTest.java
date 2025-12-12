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

    // Mock config for all tests
    when(config.getClusterName()).thenReturn("test-cluster");
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
    assertTrue(bundle.getPrometheusMeterRegistry().getMeters().size() > 0);
    verify(jerseyEnv, times(1))
        .register(any(org.glassfish.jersey.internal.inject.AbstractBinder.class));
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
    registry.gauge("test_gauge", 42.0);

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
        bundle.getPrometheusMeterRegistry().getMeters().size() > 0,
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
