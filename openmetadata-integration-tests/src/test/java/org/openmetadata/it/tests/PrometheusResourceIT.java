package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for Prometheus metrics endpoint.
 *
 * <p>Tests the Prometheus metrics endpoint to verify that metrics are exposed in the correct
 * format and contain expected metric names. The Prometheus endpoint exposes application metrics
 * in the Prometheus text exposition format for monitoring and observability.
 *
 * <p>Test isolation: Uses TestNamespace extension for test isolation Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PrometheusResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void test_getPrometheusMetrics(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    assertNotNull(metricsResponse, "Prometheus metrics response should not be null");
    assertFalse(metricsResponse.isEmpty(), "Prometheus metrics response should not be empty");
  }

  @Test
  void test_prometheusMetricsFormat(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    assertTrue(
        metricsResponse.contains("# HELP") || metricsResponse.contains("# TYPE"),
        "Prometheus metrics should contain HELP or TYPE comments");

    String[] lines = metricsResponse.split("\n");
    assertTrue(lines.length > 0, "Metrics should contain multiple lines");

    boolean hasMetricLine = false;
    for (String line : lines) {
      if (!line.startsWith("#") && !line.trim().isEmpty()) {
        hasMetricLine = true;
        break;
      }
    }
    assertTrue(hasMetricLine, "Should contain at least one metric line");
  }

  @Test
  void test_prometheusMetricsContainJvmMetrics(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    assertTrue(
        metricsResponse.contains("jvm_") || metricsResponse.contains("process_"),
        "Prometheus metrics should contain JVM or process metrics");
  }

  @Test
  void test_prometheusMetricsContainSystemMetrics(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    boolean hasSystemMetrics =
        metricsResponse.contains("jvm_memory_")
            || metricsResponse.contains("jvm_threads_")
            || metricsResponse.contains("system_cpu_")
            || metricsResponse.contains("process_uptime_");

    assertTrue(hasSystemMetrics, "Should contain system-level metrics");
  }

  @Test
  void test_prometheusMetricsContainApplicationMetrics(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    boolean hasApplicationMetrics =
        metricsResponse.contains("http_")
            || metricsResponse.contains("jdbi_")
            || metricsResponse.contains("application");

    assertTrue(hasApplicationMetrics, "Should contain application-specific metrics");
  }

  @Test
  void test_prometheusMetricsHaveLabels(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    boolean hasLabels = metricsResponse.contains("{") && metricsResponse.contains("}");
    assertTrue(hasLabels, "Metrics should contain labels (curly braces)");

    boolean hasApplicationLabel =
        metricsResponse.contains("application=\"openmetadata\"")
            || metricsResponse.contains("application");
    assertTrue(
        hasApplicationLabel,
        "Metrics should contain application label or reference to application");
  }

  @Test
  void test_prometheusMetricsNumericValues(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    String[] lines = metricsResponse.split("\n");
    boolean hasNumericValue = false;

    for (String line : lines) {
      if (!line.startsWith("#") && !line.trim().isEmpty()) {
        String[] parts = line.trim().split("\\s+");
        if (parts.length >= 2) {
          try {
            Double.parseDouble(parts[parts.length - 1]);
            hasNumericValue = true;
            break;
          } catch (NumberFormatException e) {
          }
        }
      }
    }

    assertTrue(hasNumericValue, "Metrics should contain numeric values");
  }

  @Test
  void test_prometheusMetricsAccessible(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    assertNotNull(metricsResponse, "Prometheus endpoint should be accessible");
    assertTrue(
        metricsResponse.length() > 100, "Metrics response should contain substantial content");
  }

  @Test
  void test_prometheusMetricsConsistency(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String firstResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    String secondResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    assertNotNull(firstResponse, "First metrics response should not be null");
    assertNotNull(secondResponse, "Second metrics response should not be null");

    boolean hasSimilarContent = firstResponse.contains("jvm_") && secondResponse.contains("jvm_");
    assertTrue(
        hasSimilarContent,
        "Both responses should contain similar metric types (e.g., jvm_ metrics)");
  }

  @Test
  void test_prometheusMetricsHelpComments(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    String[] lines = metricsResponse.split("\n");
    int helpCommentCount = 0;

    for (String line : lines) {
      if (line.startsWith("# HELP")) {
        helpCommentCount++;
      }
    }

    assertTrue(
        helpCommentCount > 0, "Prometheus metrics should contain HELP comments describing metrics");
  }

  @Test
  void test_prometheusMetricsTypeComments(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    String[] lines = metricsResponse.split("\n");
    int typeCommentCount = 0;

    for (String line : lines) {
      if (line.startsWith("# TYPE")) {
        typeCommentCount++;
      }
    }

    assertTrue(
        typeCommentCount > 0,
        "Prometheus metrics should contain TYPE comments defining metric types");
  }

  @Test
  void test_prometheusMetricsValidTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String metricsResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/status/prometheus",
                null,
                RequestOptions.builder().build());

    boolean hasValidTypes =
        metricsResponse.contains("gauge")
            || metricsResponse.contains("counter")
            || metricsResponse.contains("histogram")
            || metricsResponse.contains("summary");

    assertTrue(
        hasValidTypes,
        "Metrics should contain valid Prometheus metric types (gauge, counter, histogram, summary)");
  }
}
