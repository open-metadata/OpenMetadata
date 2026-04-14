package org.openmetadata.service.monitoring;

import java.time.Duration;
import java.util.Set;
import lombok.experimental.UtilityClass;

@UtilityClass
public class MetricUtils {

  private static final Set<String> MONITORED_RESOURCES =
      Set.of(
          "tables",
          "search",
          "users",
          "lineage",
          "glossaryTerms",
          "domains",
          "feed",
          "databases",
          "databaseSchemas",
          "dashboards",
          "pipelines",
          "topics",
          "tags",
          "classifications",
          "glossaries",
          "teams",
          "apps",
          "events",
          "containers",
          "dataQuality",
          "services");

  // Standard SLA buckets for all latency metrics
  public static final Duration[] LATENCY_SLA_BUCKETS = {
    Duration.ofMillis(10),
    Duration.ofMillis(25),
    Duration.ofMillis(50),
    Duration.ofMillis(100),
    Duration.ofMillis(250),
    Duration.ofMillis(500),
    Duration.ofSeconds(1),
    Duration.ofMillis(2500),
    Duration.ofSeconds(5),
    Duration.ofSeconds(30)
  };

  /**
   * Classifies a path template into a monitored resource or "other". Takes either a Jersey path
   * template (e.g., "/v1/tables/{id}") or a raw URI. Returns "/v1/{resource}" for monitored
   * resources, "other" for everything else.
   */
  public static String classifyEndpoint(String pathTemplate) {
    if (pathTemplate == null || pathTemplate.isEmpty()) {
      return "other";
    }

    int v1Pos = pathTemplate.indexOf("/v1/");
    if (v1Pos < 0) {
      return "other";
    }

    int resourceStart = v1Pos + 4;
    int resourceEnd = pathTemplate.indexOf('/', resourceStart);
    String resource =
        resourceEnd >= 0
            ? pathTemplate.substring(resourceStart, resourceEnd)
            : pathTemplate.substring(resourceStart);

    if (resource.isEmpty()) {
      return "other";
    }

    if (MONITORED_RESOURCES.contains(resource)) {
      return "/v1/" + resource;
    }
    return "other";
  }
}
