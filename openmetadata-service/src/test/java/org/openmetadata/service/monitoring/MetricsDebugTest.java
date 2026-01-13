package org.openmetadata.service.monitoring;

import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import org.junit.jupiter.api.Test;

public class MetricsDebugTest {

  @Test
  public void debugMetricsOutput() {
    // Create a new registry
    PrometheusMeterRegistry registry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);

    // Add JVM metrics
    new io.micrometer.core.instrument.binder.jvm.JvmMemoryMetrics().bindTo(registry);
    new io.micrometer.core.instrument.binder.jvm.JvmGcMetrics().bindTo(registry);
    new io.micrometer.core.instrument.binder.jvm.JvmThreadMetrics().bindTo(registry);

    // Get the output
    String output = registry.scrape();

    // Print first 2000 characters to see what's there
    System.out.println("=== METRICS OUTPUT ===");
    System.out.println(output.substring(0, Math.min(output.length(), 2000)));

    // Check for specific metrics
    System.out.println("\n=== CHECKING FOR SPECIFIC METRICS ===");
    System.out.println(
        "Contains 'jvm_memory_used_bytes': " + output.contains("jvm_memory_used_bytes"));
    System.out.println("Contains 'area=\"heap\"': " + output.contains("area=\"heap\""));
    System.out.println(
        "Contains 'jvm_memory_used_bytes{area=\"heap\"': "
            + output.contains("jvm_memory_used_bytes{area=\"heap\""));

    // Find all lines with jvm_memory
    System.out.println("\n=== JVM MEMORY LINES ===");
    String[] lines = output.split("\n");
    for (String line : lines) {
      if (line.contains("jvm_memory") && !line.startsWith("#")) {
        System.out.println(line);
      }
    }
  }
}
