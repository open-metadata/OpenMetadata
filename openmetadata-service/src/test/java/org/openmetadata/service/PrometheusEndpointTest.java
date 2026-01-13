package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class PrometheusEndpointTest extends OpenMetadataApplicationTest {

  @Test
  void testPrometheusEndpointExists() throws Exception {
    int adminPort = APP.getAdminPort();

    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");

    int responseCode = connection.getResponseCode();
    assertEquals(200, responseCode, "Prometheus endpoint should return 200 OK");

    String contentType = connection.getContentType();
    assertNotNull(contentType);
    assertTrue(
        contentType.contains("text/plain"),
        "Prometheus endpoint should return text/plain content type");

    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
      String response = reader.lines().collect(Collectors.joining("\n"));

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
  void testPrometheusEndpointFormat() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();

    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
      String response = reader.lines().collect(Collectors.joining("\n"));

      assertTrue(response.contains("# HELP"), "Response should contain HELP comments");
      assertTrue(response.contains("# TYPE"), "Response should contain TYPE comments");

      assertTrue(
          response.matches("(?s).*\\w+\\{[^}]*\\}\\s+[0-9.eE+-]+.*"),
          "Response should contain metrics with labels");

      // Check for valid metric lines (either with or without labels)
      boolean hasValidMetricLines = false;
      String[] lines = response.split("\n");
      for (String line : lines) {
        if (!line.startsWith("#") && !line.trim().isEmpty()) {
          // Match metric lines with or without labels
          // Format: metric_name{labels} value OR metric_name value
          if (line.matches("^[a-zA-Z_:][a-zA-Z0-9_:]*(?:\\{[^}]*\\})?\\s+[0-9.eE+-]+.*")) {
            hasValidMetricLines = true;
            break;
          }
        }
      }
      assertTrue(hasValidMetricLines, "Response should contain valid metric lines");
    }
  }

  private void assertContainsMetric(String response, String metricName, String description) {
    assertTrue(
        response.contains(metricName),
        String.format("Prometheus endpoint should expose %s (%s)", metricName, description));
  }
}
