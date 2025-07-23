package org.openmetadata.service.monitoring;

import java.time.Duration;
import lombok.experimental.UtilityClass;

@UtilityClass
public class MetricUtils {
  // Standard SLA buckets for all latency metrics (10 buckets total)
  public static final Duration[] LATENCY_SLA_BUCKETS = {
    Duration.ofMillis(10), // 10ms
    Duration.ofMillis(25), // 25ms
    Duration.ofMillis(50), // 50ms
    Duration.ofMillis(100), // 100ms
    Duration.ofMillis(250), // 250ms
    Duration.ofMillis(500), // 500ms
    Duration.ofSeconds(1), // 1s
    Duration.ofMillis(2500), // 2.5s
    Duration.ofSeconds(5), // 5s
    Duration.ofSeconds(30) // 30s
  };
}
