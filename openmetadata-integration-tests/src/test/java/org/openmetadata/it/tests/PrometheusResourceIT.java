package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.PrometheusText;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.utils.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class PrometheusResourceIT {

  private static final Logger LOG = LoggerFactory.getLogger(PrometheusResourceIT.class);

  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final String TABLE_ROUTE = "/v1/tables";
  private static final String JETTY_REQUESTS = "jetty_http_requests_total";
  private static final String JETTY_RESPONSES = "jetty_http_responses_total";
  private static final String JETTY_UTILIZATION = "jetty_threads_utilization_ratio";
  private static final String REQUEST_LATENCY_COUNT = "request_latency_total_seconds_count";

  @Test
  void publishesCanonicalMetricsAndPreservesDiagnostics() throws Exception {
    String before = fetchScrape();
    assertTrue(before.contains("# TYPE " + JETTY_REQUESTS + " counter"));
    assertTrue(before.contains("# TYPE " + JETTY_RESPONSES + " counter"));
    assertTrue(before.contains("# TYPE jetty_requests gauge"));
    assertTrue(before.contains("# TYPE jetty_responses_2xx gauge"));
    assertTrue(before.contains("# TYPE jetty_response_time_max_seconds gauge"));
    assertTrue(before.contains("# TYPE " + JETTY_UTILIZATION + " gauge"));

    assertEquals(200, applicationRequest("GET", TABLE_ROUTE + "?limit=1").statusCode());
    String firstTable = TABLE_ROUTE + "/" + UUID.randomUUID();
    String secondTable = TABLE_ROUTE + "/" + UUID.randomUUID();
    assertEquals(404, applicationRequest("GET", firstTable).statusCode());
    assertEquals(404, applicationRequest("GET", secondTable).statusCode());
    assertEquals(
        400,
        applicationRequest("POST", TABLE_ROUTE, HttpRequest.BodyPublishers.ofString("{}"))
            .statusCode());

    await()
        .atMost(Duration.ofSeconds(15))
        .untilAsserted(() -> verifyTraffic(before, fetchScrape()));
    verifyDiagnostics();
  }

  private void verifyTraffic(String before, String after) {
    assertTrue(
        PrometheusText.sum(after, JETTY_REQUESTS)
            >= PrometheusText.sum(before, JETTY_REQUESTS) + 4);
    verifyResponseDelta(before, after, "2xx", 1);
    verifyResponseDelta(before, after, "4xx", 3);
    verifyLatencyDelta(before, after, "GET", 3);
    verifyLatencyDelta(before, after, "POST", 1);
    assertFalse(PrometheusText.contains(after, REQUEST_LATENCY_COUNT, "endpoint", TABLE_ROUTE));
    double utilization = PrometheusText.sum(after, JETTY_UTILIZATION);
    assertTrue(utilization >= 0 && utilization <= 1);
  }

  private void verifyLatencyDelta(String before, String after, String method, int expected) {
    String[] tags = {"http_route", TABLE_ROUTE, "method", method};
    double beforeCount =
        PrometheusText.contains(before, REQUEST_LATENCY_COUNT, tags)
            ? PrometheusText.sum(before, REQUEST_LATENCY_COUNT, tags)
            : 0.0;
    assertTrue(PrometheusText.sum(after, REQUEST_LATENCY_COUNT, tags) >= beforeCount + expected);
  }

  private void verifyResponseDelta(String before, String after, String statusClass, int expected) {
    assertTrue(
        PrometheusText.sum(after, JETTY_RESPONSES, "status_class", statusClass)
            >= PrometheusText.sum(before, JETTY_RESPONSES, "status_class", statusClass) + expected);
  }

  private void verifyDiagnostics() throws Exception {
    HttpResponse<String> response = applicationRequest("GET", "/v1/system/diagnostics");
    assertEquals(200, response.statusCode());
    JsonNode diagnostics = JsonUtils.readTree(response.body());
    JsonNode jetty = diagnostics.path("jetty");
    double busy = jetty.get("threads_busy").doubleValue();
    double max = jetty.get("threads_max").doubleValue();
    assertTrue(jetty.has("queue_time_avg_ms"));
    assertTrue(jetty.get("threads_current").isNumber());
    double expectedPercent = max > 0 ? Math.round(Math.clamp(busy / max, 0, 1) * 1000) / 10.0 : 0;
    assertEquals(expectedPercent, jetty.get("utilization_pct").doubleValue());
    JsonNode latency = diagnostics.path("request_latency");
    assertTrue(latency.path("GET " + TABLE_ROUTE).path("count").asLong() >= 3);
    assertTrue(latency.path("POST " + TABLE_ROUTE).path("count").asLong() >= 1);
    assertTrue(latency.path("GET " + TABLE_ROUTE).path("avg_total_ms").isNumber());
  }

  private static String fetchScrape() throws Exception {
    URI uri = URI.create("http://localhost:" + TestSuiteBootstrap.getAdminPort() + "/prometheus");
    HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30)).GET().build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode());
    return response.body();
  }

  private static HttpResponse<String> applicationRequest(String method, String path)
      throws Exception {
    return applicationRequest(method, path, HttpRequest.BodyPublishers.noBody());
  }

  private static HttpResponse<String> applicationRequest(
      String method, String path, HttpRequest.BodyPublisher body) throws Exception {
    URI uri = URI.create(TestSuiteBootstrap.getBaseUrl() + "/api" + path);
    HttpRequest request =
        HttpRequest.newBuilder(uri)
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .method(method, body)
            .build();
    return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
  }

  @Test
  void testPrometheusEndpoint() throws Exception {
    int adminPort = TestSuiteBootstrap.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");
    connection.setConnectTimeout(15000);
    connection.setReadTimeout(30000);

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
  @org.junit.jupiter.api.Disabled(
      "Performance test is environment-dependent and flaky in parallel execution")
  void testPrometheusEndpointPerformance() throws Exception {
    int adminPort = TestSuiteBootstrap.getAdminPort();
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
        assertTrue(
            line.matches("# HELP [a-zA-Z_:][a-zA-Z0-9_:]* .*"), "Invalid HELP format: " + line);
      } else if (line.startsWith("# TYPE")) {
        typeCount++;
        assertTrue(
            line.matches("# TYPE [a-zA-Z_:][a-zA-Z0-9_:]* (counter|gauge|histogram|summary)"),
            "Invalid TYPE format: " + line);
      } else if (!line.isEmpty() && !line.startsWith("#")) {
        metricCount++;
        // Metric format: name{labels} value [timestamp]
        // Labels can contain values with curly braces (e.g., path="v1/users/{id}")
        // Values can be numeric, NaN, +Inf, or -Inf (valid Prometheus values)
        assertTrue(
            line.matches("^[a-zA-Z_:][a-zA-Z0-9_:]*(\\{.*\\})?\\s+([0-9.eE+-]+|NaN|[+-]?Inf)$")
                || line.matches(
                    "^[a-zA-Z_:][a-zA-Z0-9_:]*(\\{.*\\})?\\s+([0-9.eE+-]+|NaN|[+-]?Inf)\\s+[0-9]+$"),
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
    int adminPort = TestSuiteBootstrap.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/prometheus").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();

    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
      String response = reader.lines().collect(Collectors.joining("\n"));

      Set<String> metricFamilies = new HashSet<>();
      for (String line : response.split("\n")) {
        if (line.startsWith("# HELP ")) {
          String metricName = line.split(" ")[2];
          metricFamilies.add(metricName);
        }
      }

      assertTrue(
          metricFamilies.size() >= 40,
          "Expected at least 40 metric families, but found: " + metricFamilies.size());

      LOG.info("Found {} unique metric families", metricFamilies.size());
    } finally {
      connection.disconnect();
    }
  }
}
