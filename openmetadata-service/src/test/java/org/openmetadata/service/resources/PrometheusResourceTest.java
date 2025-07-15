package org.openmetadata.service.resources;

import static org.junit.jupiter.api.Assertions.*;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
class PrometheusResourceTest extends OpenMetadataApplicationTest {

  @Test
  void testPrometheusEndpoint() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(5000);

    try {
      int responseCode = connection.getResponseCode();
      assertEquals(200, responseCode, "Prometheus endpoint should return 200 OK");

      String contentType = connection.getContentType();
      assertNotNull(contentType, "Content type should not be null");
      assertTrue(
          contentType.contains("text/plain"),
          "Content type should be text/plain, but was: " + contentType);
      assertTrue(
          contentType.contains("version=0.0.4"), "Content type should include Prometheus version");

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
        String response = reader.lines().collect(Collectors.joining("\n"));
        assertFalse(response.isEmpty(), "Prometheus response should not be empty");
        verifyMetricCategories(response);
        verifySpecificMetrics(response);
        verifyPrometheusFormat(response);
      }
    } finally {
      connection.disconnect();
    }
  }

  @Test
  void testPrometheusEndpointPerformance() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();

    long startTime = System.currentTimeMillis();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");
    int responseCode = connection.getResponseCode();
    long duration = System.currentTimeMillis() - startTime;
    assertEquals(200, responseCode);
    assertTrue(
        duration < 1000,
        "Prometheus endpoint should respond within 1 second, took: " + duration + "ms");
    connection.disconnect();
  }

  private void verifyMetricCategories(String response) {
    assertTrue(response.contains("jvm_memory_used_bytes"), "Should contain JVM memory metrics");
    assertTrue(response.contains("jvm_threads_live_threads"), "Should contain JVM thread metrics");
    assertTrue(
        response.contains("jvm_classes_loaded_classes"),
        "Should contain JVM class loading metrics");
    boolean hasGcMetrics =
        response.contains("jvm_gc_pause_seconds")
            || response.contains("jvm_gc_live_data_size_bytes")
            || response.contains("jvm_gc_overhead");
    assertTrue(hasGcMetrics, "Should contain at least some JVM GC metrics");
    assertTrue(response.contains("system_cpu_usage"), "Should contain system CPU metrics");
    assertTrue(
        response.contains("process_uptime_seconds"), "Should contain process uptime metrics");

    if (!response.contains("process_files_open_files")) {
      LOG.warn("File descriptor metrics not available on this system");
    }
    assertTrue(
        response.contains("http_latency_requests_seconds"), "Should contain HTTP latency metrics");
    assertTrue(
        response.contains("jdbi_latency_requests_seconds"), "Should contain JDBI latency metrics");
    assertTrue(response.contains("http_server_requests_sec"), "Should contain legacy HTTP metrics");
    assertTrue(response.contains("jdbi_requests_seconds"), "Should contain legacy JDBI metrics");
    assertTrue(
        response.contains("pipeline_client_request_status"),
        "Should contain pipeline client metrics");
    assertTrue(response.contains("logback_events_total"), "Should contain logback metrics");
  }

  private void verifySpecificMetrics(String response) {
    assertTrue(
        response.contains("jvm_memory_used_bytes{") && response.contains("area=\"heap\""),
        "JVM memory metrics should have area labels");
    boolean hasGcLabels =
        response.matches("(?s).*jvm_gc_pause_seconds\\{action=\".*")
            || response.matches("(?s).*jvm_gc_pause_seconds\\{cause=\".*")
            || response.matches("(?s).*jvm_gc_live_data_size_bytes.*");
    assertTrue(hasGcLabels, "Should have some GC metrics with labels");
    assertTrue(
        response.matches("(?s).*system_cpu_count\\{[^}]*\\}\\s+[0-9.]+.*"),
        "CPU count should have a numeric value");
    boolean hasJdbiHistogram =
        response.contains("jdbi_requests_seconds_bucket")
            || response.contains("jdbi_requests_seconds_count")
            || response.contains("jdbi_requests_seconds_sum");
    assertTrue(hasJdbiHistogram, "JDBI histogram should have metrics (bucket, count, or sum)");

    boolean hasHttpHistogram = false;
    String[] httpMetricVariants = {
      "http_server_requests_sec_bucket",
      "http_server_requests_sec_count",
      "http_server_requests_sec_sum",
      "http_server_requests_sec{",
      "http_server_requests_sec "
    };

    for (String variant : httpMetricVariants) {
      if (response.contains(variant)) {
        hasHttpHistogram = true;
        break;
      }
    }
    if (!hasHttpHistogram && response.contains("# TYPE http_server_requests_sec")) {
      LOG.info("HTTP histogram metric is declared but has no data yet");
      hasHttpHistogram = true;
    }
    assertTrue(hasHttpHistogram, "HTTP histogram should have metrics declaration or data");
  }

  private void verifyPrometheusFormat(String response) {
    String[] lines = response.split("\n");

    int helpCount = 0;
    int typeCount = 0;
    int metricCount = 0;

    for (String line : lines) {
      if (line.startsWith("# HELP")) {
        helpCount++;
        // Verify HELP format: # HELP metric_name description
        assertTrue(
            line.matches("# HELP [a-zA-Z_:][a-zA-Z0-9_:]* .*"), "Invalid HELP format: " + line);
      } else if (line.startsWith("# TYPE")) {
        typeCount++;
        // Verify TYPE format: # TYPE metric_name type
        assertTrue(
            line.matches("# TYPE [a-zA-Z_:][a-zA-Z0-9_:]* (counter|gauge|histogram|summary)"),
            "Invalid TYPE format: " + line);
      } else if (!line.isEmpty() && !line.startsWith("#")) {
        metricCount++;
        assertTrue(
            line.matches("^[a-zA-Z_:][a-zA-Z0-9_:]*(\\{[^}]*})?\\s+[0-9.eE+-]+$")
                || line.matches("^[a-zA-Z_:][a-zA-Z0-9_:]*(\\{[^}]*})?\\s+[0-9.]+\\s+[0-9]+$"),
            "Invalid metric format: " + line);
      }
    }

    assertTrue(helpCount > 0, "Should have HELP lines");
    assertTrue(typeCount > 0, "Should have TYPE lines");
    assertTrue(metricCount > 0, "Should have metric value lines");

    LOG.info(
        "Prometheus format validation - HELP: {}, TYPE: {}, Metrics: {}",
        helpCount,
        typeCount,
        metricCount);
  }

  @Test
  void testPrometheusMetricCount() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();

    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
      String response = reader.lines().collect(Collectors.joining("\n"));

      // Count unique metric families
      Set<String> metricFamilies = new HashSet<>();
      for (String line : response.split("\n")) {
        if (line.startsWith("# HELP ")) {
          String metricName = line.split(" ")[2];
          metricFamilies.add(metricName);
        }
      }

      // We expect at least 40 different metric families
      assertTrue(
          metricFamilies.size() >= 40,
          "Expected at least 40 metric families, but found: " + metricFamilies.size());

      LOG.info("Found {} unique metric families", metricFamilies.size());
    } finally {
      connection.disconnect();
    }
  }
}
