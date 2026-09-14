package org.openmetadata.it.perf;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Callable;
import org.openmetadata.it.perf.EntityApiBenchmark.Measurement;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;
import org.openmetadata.it.perf.EntityBenchmarkControl.Heap;
import org.openmetadata.schema.utils.JsonUtils;

/** Whole-server allocation deltas exclude preparation and warmup, but include background work. */
final class EntityBenchmarkAllocation {
  record Window(
      int operations,
      double elapsedSeconds,
      Heap before,
      Heap after,
      long allocatedBytes,
      double bytesPerOperation) {}

  private EntityBenchmarkAllocation() {}

  static Measurement measure(final Path output, final Callable<Measurement> operation)
      throws Exception {
    if (!Boolean.getBoolean("entityBenchmark.allocations")) {
      return operation.call();
    }
    final Endpoint endpoint = EntityBenchmarkGate.configuredEndpoint();
    if (endpoint == null) {
      throw new IllegalArgumentException("Allocation observations need a control endpoint");
    }
    try (final var client = HttpClient.newHttpClient()) {
      final Heap before = snapshot(client, endpoint);
      final Measurement measured = operation.call();
      final Heap after = snapshot(client, endpoint);
      Files.writeString(output, JsonUtils.pojoToJson(window(measured, before, after)));
      return measured;
    }
  }

  private static Heap snapshot(final HttpClient client, final Endpoint endpoint)
      throws IOException, InterruptedException {
    final Heap heap =
        JsonUtils.readValue(
            EntityBenchmarkControlClient.send(client, endpoint, "heap"), Heap.class);
    if (heap.allocatedBytes() < 0) {
      throw new IOException("Server allocation counter is unavailable");
    }
    return heap;
  }

  private static Window window(final Measurement measured, final Heap before, final Heap after)
      throws IOException {
    final long allocated = after.allocatedBytes() - before.allocatedBytes();
    if (allocated < 0) {
      throw new IOException("Server allocation counter moved backwards");
    }
    return new Window(
        measured.samples(),
        measured.elapsedSeconds(),
        before,
        after,
        allocated,
        (double) allocated / measured.samples());
  }
}
