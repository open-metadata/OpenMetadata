package org.openmetadata.service.monitoring;

import com.codahale.metrics.MetricRegistry;
import com.codahale.metrics.Timer;
import org.openmetadata.service.util.MicrometerBundleSingleton;

/**
 * Demo showing how request latency metrics are captured and can be queried.
 * Run this after making some API calls to see the latency breakdown.
 */
public class LatencyMetricsDemo {

  public static void main(String[] args) {
    MetricRegistry registry = MicrometerBundleSingleton.getMetrics();

    System.out.println("=== OpenMetadata Request Latency Metrics ===\n");

    // Show all request latency timers
    registry
        .getTimers()
        .forEach(
            (name, timer) -> {
              if (name.startsWith("request.latency.") && timer.getCount() > 0) {
                printTimerStats(name, timer);
              }
            });

    // Show percentage breakdowns
    System.out.println("\n=== Request Time Percentage Breakdowns ===\n");
    registry
        .getHistograms()
        .forEach(
            (name, histogram) -> {
              if (name.startsWith("request.percentage.") && histogram.getCount() > 0) {
                System.out.printf("%s:\n", name);
                System.out.printf("  Average: %.1f%%\n", histogram.getSnapshot().getMean());
                System.out.printf("  Min: %.1f%%\n", histogram.getSnapshot().getMin());
                System.out.printf("  Max: %.1f%%\n", histogram.getSnapshot().getMax());
                System.out.println();
              }
            });

    // Show operation counts
    System.out.println("\n=== Operation Counts per Request ===\n");
    registry
        .getHistograms()
        .forEach(
            (name, histogram) -> {
              if (name.startsWith("request.operations.") && histogram.getCount() > 0) {
                System.out.printf("%s:\n", name);
                System.out.printf(
                    "  Average: %.1f operations/request\n", histogram.getSnapshot().getMean());
                System.out.printf(
                    "  Max: %.0f operations/request\n", histogram.getSnapshot().getMax());
                System.out.println();
              }
            });

    // Example of how these metrics would appear in Prometheus format
    System.out.println("\n=== Example Prometheus Format ===\n");
    printPrometheusExample();
  }

  private static void printTimerStats(String name, Timer timer) {
    System.out.printf("%s:\n", name);
    System.out.printf("  Count: %d requests\n", timer.getCount());
    System.out.printf("  Mean: %.2f ms\n", timer.getSnapshot().getMean() / 1_000_000);
    System.out.printf("  Median (P50): %.2f ms\n", timer.getSnapshot().getMedian() / 1_000_000);
    System.out.printf("  P75: %.2f ms\n", timer.getSnapshot().get75thPercentile() / 1_000_000);
    System.out.printf("  P95: %.2f ms\n", timer.getSnapshot().get95thPercentile() / 1_000_000);
    System.out.printf("  P99: %.2f ms\n", timer.getSnapshot().get99thPercentile() / 1_000_000);
    System.out.printf("  Max: %.2f ms\n", timer.getSnapshot().getMax() / 1_000_000);
    System.out.printf("  Rate: %.2f requests/sec\n", timer.getMeanRate());
    System.out.println();
  }

  private static void printPrometheusExample() {
    System.out.println("# HELP request_latency_total_seconds Total request processing time");
    System.out.println("# TYPE request_latency_total_seconds histogram");
    System.out.println(
        "request_latency_total_seconds_bucket{endpoint=\"/api/v1/tables\",le=\"0.01\"} 0");
    System.out.println(
        "request_latency_total_seconds_bucket{endpoint=\"/api/v1/tables\",le=\"0.05\"} 10");
    System.out.println(
        "request_latency_total_seconds_bucket{endpoint=\"/api/v1/tables\",le=\"0.1\"} 45");
    System.out.println(
        "request_latency_total_seconds_bucket{endpoint=\"/api/v1/tables\",le=\"0.5\"} 98");
    System.out.println(
        "request_latency_total_seconds_bucket{endpoint=\"/api/v1/tables\",le=\"1.0\"} 100");
    System.out.println(
        "request_latency_total_seconds_bucket{endpoint=\"/api/v1/tables\",le=\"+Inf\"} 100");
    System.out.println("request_latency_total_seconds_count{endpoint=\"/api/v1/tables\"} 100");
    System.out.println("request_latency_total_seconds_sum{endpoint=\"/api/v1/tables\"} 15.234");
    System.out.println();
    System.out.println("# HELP request_latency_database_seconds Time spent in database operations");
    System.out.println("# TYPE request_latency_database_seconds histogram");
    System.out.println(
        "request_latency_database_seconds{endpoint=\"/api/v1/tables\",quantile=\"0.5\"} 0.025");
    System.out.println(
        "request_latency_database_seconds{endpoint=\"/api/v1/tables\",quantile=\"0.95\"} 0.080");
    System.out.println(
        "request_latency_database_seconds{endpoint=\"/api/v1/tables\",quantile=\"0.99\"} 0.150");
    System.out.println();
    System.out.println("# HELP request_percentage_database Percentage of request time in database");
    System.out.println("# TYPE request_percentage_database gauge");
    System.out.println("request_percentage_database{endpoint=\"/api/v1/tables\"} 35.2");
    System.out.println("request_percentage_internal{endpoint=\"/api/v1/tables\"} 64.8");
  }
}
