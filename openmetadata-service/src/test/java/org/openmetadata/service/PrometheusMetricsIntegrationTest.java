package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.MicrometerBundleSingleton;

class PrometheusMetricsIntegrationTest {

  @BeforeAll
  static void setup() {
    MicrometerBundleSingleton.initLatencyEvents();
  }

  @Test
  void testPrometheusEndpointMetrics() {
    String metrics = MicrometerBundleSingleton.getPrometheusMeterRegistry().scrape();
    assertNotNull(metrics);
    assertFalse(metrics.isEmpty());

    Set<String> requiredMetricFamilies =
        new HashSet<>(
            Arrays.asList(
                "jvm_memory_used_bytes",
                "jvm_memory_committed_bytes",
                "jvm_memory_max_bytes",
                "jvm_threads_live_threads",
                "jvm_threads_daemon_threads",
                "jvm_classes_loaded_classes",
                "system_cpu_usage",
                "system_cpu_count",
                "process_uptime_seconds",
                "process_cpu_usage",
                "logback_events_total",
                "http_latency_requests_seconds",
                "jdbi_latency_requests_seconds"));

    Set<String> optionalMetricFamilies =
        new HashSet<>(
            Arrays.asList(
                "jvm_gc_pause_seconds",
                "jvm_gc_memory_allocated_bytes",
                "jvm_gc_memory_promoted_bytes",
                "jvm_threads_peak_threads",
                "jvm_buffer_count_buffers",
                "jvm_buffer_memory_used_bytes",
                "process_files_open_files",
                "process_files_max_files",
                "jvm_gc_overhead",
                "jvm_memory_usage_after_gc"));

    Set<String> actualMetricFamilies = extractMetricFamilies(metrics);

    // Check required metrics
    for (String required : requiredMetricFamilies) {
      assertTrue(
          actualMetricFamilies.contains(required), "Missing required metric family: " + required);
    }

    int optionalMetricsFound = 0;
    for (String optional : optionalMetricFamilies) {
      if (actualMetricFamilies.contains(optional)) {
        optionalMetricsFound++;
      }
    }
    assertTrue(
        optionalMetricsFound > 0, "Should have at least some optional JVM metrics, but found none");
  }

  @Test
  void testLegacyMetricsPresence() {
    var collectorRegistry = MicrometerBundleSingleton.getCollectorRegistry();
    assertNotNull(collectorRegistry);

    var metricFamilySamples = collectorRegistry.metricFamilySamples();
    Set<String> legacyMetrics = new HashSet<>();

    while (metricFamilySamples.hasMoreElements()) {
      var samples = metricFamilySamples.nextElement();
      legacyMetrics.add(samples.name);
    }

    assertTrue(
        legacyMetrics.contains("http_server_requests_sec"),
        "Legacy HTTP server requests metric should be present");
    assertTrue(
        legacyMetrics.contains("jdbi_requests_seconds"),
        "Legacy JDBI requests metric should be present");
    assertTrue(
        legacyMetrics.contains("pipeline_client_request_status"),
        "Legacy pipeline client status metric should be present");
  }

  @Test
  void testMetricFormat() {
    String metrics = MicrometerBundleSingleton.getPrometheusMeterRegistry().scrape();

    // Verify Prometheus text exposition format
    String[] lines = metrics.split("\n");
    boolean hasHelpLine = false;
    boolean hasTypeLine = false;
    boolean hasMetricLine = false;

    for (String line : lines) {
      if (line.startsWith("# HELP")) {
        hasHelpLine = true;
      } else if (line.startsWith("# TYPE")) {
        hasTypeLine = true;
      } else if (line.matches("^[a-zA-Z_:][a-zA-Z0-9_:]*.*")) {
        hasMetricLine = true;
      }
    }

    assertTrue(hasHelpLine, "Metrics should contain HELP lines");
    assertTrue(hasTypeLine, "Metrics should contain TYPE lines");
    assertTrue(hasMetricLine, "Metrics should contain actual metric lines");
  }

  @Test
  void testMetricLabels() {
    String metrics = MicrometerBundleSingleton.getPrometheusMeterRegistry().scrape();

    Pattern labelPattern =
        Pattern.compile("^([a-zA-Z_:][a-zA-Z0-9_:]*)\\{([^}]+)}\\s+([0-9.]+(?:[eE][+-]?[0-9]+)?)");
    boolean hasLabels = false;

    for (String line : metrics.split("\n")) {
      Matcher matcher = labelPattern.matcher(line);
      if (matcher.matches()) {
        hasLabels = true;
        String metricName = matcher.group(1);
        String labels = matcher.group(2);
        String value = matcher.group(3);

        assertNotNull(metricName);
        assertNotNull(labels);
        assertNotNull(value);

        // Verify label format
        assertTrue(labels.contains("="), "Labels should be in key=value format");
      }
    }

    assertTrue(hasLabels, "Should have metrics with labels");
  }

  private Set<String> extractMetricFamilies(String metrics) {
    Set<String> families = new HashSet<>();
    Pattern pattern = Pattern.compile("^# HELP ([a-zA-Z_:][a-zA-Z0-9_:]*)", Pattern.MULTILINE);
    Matcher matcher = pattern.matcher(metrics);

    while (matcher.find()) {
      families.add(matcher.group(1));
    }

    return families;
  }
}
