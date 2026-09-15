package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;
import org.openmetadata.it.perf.EntityBenchmarkControl.Heap;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.utils.JsonUtils;

@Isolated("Configures allocation observations through benchmark system properties")
class EntityBenchmarkAllocationTest {
  @TempDir Path directory;

  @Test
  void allocationWindowsExcludePreparationAndWarmup() throws Exception {
    final var allocated = new AtomicLong();
    final HttpServer server = server(allocated, allocated::get);
    try {
      measure(server);
      final var window =
          JsonUtils.readTree(
              Files.readString(directory.resolve("result.csv.read.allocation.json")));
      assertEquals(80_500, window.path("before").path("allocatedBytes").asLong());
      assertEquals(80_800, window.path("after").path("allocatedBytes").asLong());
      assertEquals(300, window.path("allocatedBytes").asLong());
      assertEquals(100, window.path("bytesPerOperation").asDouble());
      assertEquals(3, window.path("operations").asInt());
    } finally {
      server.stop(0);
    }
  }

  @Test
  void unsupportedAllocationCountersCannotProduceAcceptedMeasurements() throws Exception {
    final HttpServer server = server(new AtomicLong(), () -> -1);
    try {
      assertThrows(IOException.class, () -> measure(server));
      assertFalse(Files.exists(directory.resolve("result.csv.read.allocation.json")));
      assertFalse(Files.exists(directory.resolve("result.csv")));
    } finally {
      server.stop(0);
    }
  }

  @Test
  void counterRestartsInvalidateTheWindow() throws Exception {
    final var allocated = new AtomicLong();
    final var snapshots = new AtomicInteger();
    final HttpServer server =
        server(allocated, () -> snapshots.getAndIncrement() == 0 ? allocated.get() : 0);
    try {
      assertThrows(IOException.class, () -> measure(server));
      assertFalse(Files.exists(directory.resolve("result.csv.read.allocation.json")));
      assertFalse(Files.exists(directory.resolve("result.csv")));
    } finally {
      server.stop(0);
    }
  }

  private HttpServer server(final AtomicLong allocated, final LongSupplier counter)
      throws IOException {
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 8);
    server.createContext("/prepare", exchange -> allocate(exchange, allocated, 10_000));
    server.createContext("/read", exchange -> allocate(exchange, allocated, 100));
    server.createContext(
        "/heap",
        exchange -> {
          assertEquals(
              "Bearer private-control", exchange.getRequestHeaders().getFirst("Authorization"));
          reply(exchange, JsonUtils.pojoToJson(new Heap(1, 1, 1, 0, 0, counter.getAsLong())));
        });
    server.start();
    return server;
  }

  private void measure(final HttpServer server) throws Exception {
    final Path manifest = directory.resolve("manifest.json");
    final String address = "http://127.0.0.1:" + server.getAddress().getPort();
    Files.writeString(
        manifest,
        JsonUtils.pojoToJson(
            new EntityBenchmarkManifest(
                address,
                "api-token",
                List.of(
                    new Workload(
                        "read",
                        List.of(new Request("POST", "/prepare", Map.of(), "{}", 200)),
                        new Request("GET", "/read", Map.of(), null, 200))))));
    final Path control = directory.resolve("control.json");
    Files.writeString(
        control, JsonUtils.pojoToJson(new Endpoint(URI.create(address), "private-control")));
    runWithControls(manifest, control);
  }

  private void runWithControls(final Path manifest, final Path control) throws Exception {
    final String previousControl =
        System.setProperty("entityBenchmark.control", control.toString());
    final String previousAllocation = System.setProperty("entityBenchmark.allocations", "true");
    final String previousReset = System.setProperty("entityBenchmark.reset", "none");
    try {
      EntityApiBenchmark.main(
          new String[] {
            manifest.toString(),
            directory.resolve("result.csv").toString(),
            "3",
            "5",
            "1000",
            "read"
          });
    } finally {
      restore("entityBenchmark.control", previousControl);
      restore("entityBenchmark.allocations", previousAllocation);
      restore("entityBenchmark.reset", previousReset);
    }
  }

  private static void restore(final String name, final String value) {
    if (value == null) {
      System.clearProperty(name);
    } else {
      System.setProperty(name, value);
    }
  }

  private static void allocate(
      final HttpExchange exchange, final AtomicLong allocated, final long bytes)
      throws IOException {
    allocated.addAndGet(bytes);
    reply(exchange, "{}");
  }

  private static void reply(final HttpExchange exchange, final String body) throws IOException {
    try (exchange) {
      final byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
    }
  }
}
