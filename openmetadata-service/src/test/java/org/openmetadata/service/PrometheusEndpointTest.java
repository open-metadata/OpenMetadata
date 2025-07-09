package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import io.dropwizard.testing.junit5.DropwizardExtensionsSupport;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(DropwizardExtensionsSupport.class)
public class PrometheusEndpointTest {

  private static final DropwizardAppExtension<OpenMetadataApplicationConfig> APP =
      new DropwizardAppExtension<>(
          OpenMetadataApplicationTestApp.class,
          ResourceHelpers.resourceFilePath("openmetadata-test.yaml"));

  @Test
  public void testPrometheusEndpointExists() throws Exception {
    // Get admin port from configuration
    int adminPort = APP.getAdminPort();

    // Make request to Prometheus endpoint
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");

    // Verify response code
    int responseCode = connection.getResponseCode();
    assertEquals(200, responseCode, "Prometheus endpoint should return 200 OK");

    // Verify content type
    String contentType = connection.getContentType();
    assertNotNull(contentType);
    assertTrue(
        contentType.contains("text/plain"),
        "Prometheus endpoint should return text/plain content type");

    // Read response
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
      String response = reader.lines().collect(Collectors.joining("\n"));

      // Verify response contains expected metrics
      assertContainsMetric(response, "jvm_memory_used_bytes", "JVM memory metrics");
      assertContainsMetric(response, "jvm_gc_pause_seconds", "JVM GC metrics");
      assertContainsMetric(response, "jvm_threads_live_threads", "JVM thread metrics");
      assertContainsMetric(response, "system_cpu_usage", "System CPU metrics");
      assertContainsMetric(response, "process_uptime_seconds", "Process uptime metrics");
      assertContainsMetric(response, "http_latency_requests_seconds", "HTTP latency metrics");
      assertContainsMetric(response, "jdbi_latency_requests_seconds", "JDBI latency metrics");
      assertContainsMetric(response, "http_server_requests_sec", "HTTP server request metrics");
      assertContainsMetric(response, "jdbi_requests_seconds", "JDBI request metrics");
      assertContainsMetric(response, "pipeline_client_request_status", "Pipeline client metrics");
    }
  }

  @Test
  public void testPrometheusEndpointFormat() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();

    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
      String response = reader.lines().collect(Collectors.joining("\n"));

      // Verify Prometheus text format
      assertTrue(response.contains("# HELP"), "Response should contain HELP comments");
      assertTrue(response.contains("# TYPE"), "Response should contain TYPE comments");

      // Verify metric format (metric_name{labels} value)
      assertTrue(
          response.matches("(?s).*\\w+\\{[^}]*\\}\\s+[0-9.]+.*"),
          "Response should contain metrics with labels");
      assertTrue(
          response.matches("(?s).*\\w+\\s+[0-9.]+.*"),
          "Response should contain metrics without labels");
    }
  }

  private void assertContainsMetric(String response, String metricName, String description) {
    assertTrue(
        response.contains(metricName),
        String.format("Prometheus endpoint should expose %s (%s)", metricName, description));
  }

  // Test application that extends OpenMetadataApplication
  public static class OpenMetadataApplicationTestApp extends OpenMetadataApplication {
    // Uses the parent class implementation
  }
}
