package org.openmetadata.it.perf;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import org.openmetadata.schema.utils.JsonUtils;

/** Clears caches after JVM warmup without serializing the measured arrivals. */
final class EntityBenchmarkColdStart {
  private record Reset(String lifecycle, String reset, long acknowledgedAt) {}

  private EntityBenchmarkColdStart() {}

  static void beforeMeasurement(final Path output) throws IOException, InterruptedException {
    final String reset = System.getProperty("entityBenchmark.coldStart");
    if (reset == null) return;
    requireColdStart(reset);
    final var endpoint = EntityBenchmarkGate.configuredEndpoint();
    if (endpoint == null) {
      throw new IllegalArgumentException("Cold-start observations need a control endpoint");
    }
    try (final var client = HttpClient.newHttpClient()) {
      if (!"ok".equals(EntityBenchmarkControlClient.send(client, endpoint, reset))) {
        throw new IOException("Cold-start cache reset was not acknowledged");
      }
      Files.writeString(
          output, JsonUtils.pojoToJson(new Reset("cold-start", reset, System.currentTimeMillis())));
    }
  }

  private static void requireColdStart(final String reset) {
    if ((!"cold".equals(reset) && !"l1-cold".equals(reset))
        || !"none".equals(System.getProperty("entityBenchmark.reset"))) {
      throw new IllegalArgumentException(
          "Cold-start requires cold/l1-cold and per-request reset=none");
    }
  }
}
