package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.utils.JsonUtils;

@Isolated("Configures the benchmark's cache lifecycle through system properties")
class EntityBenchmarkColdStartTest {
  @TempDir Path directory;

  @Test
  void resetsOnceAfterWarmupAndPreservesConcurrentMeasuredArrivals() throws Exception {
    final var reads = new AtomicInteger();
    final var resets = new AtomicInteger();
    final var inFlight = new AtomicInteger();
    final var maximum = new AtomicInteger();
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 16);
    try (final var workers = Executors.newFixedThreadPool(4)) {
      server.setExecutor(workers);
      server.createContext(
          "/read",
          exchange -> {
            reads.incrementAndGet();
            maximum.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
            try {
              Thread.sleep(25);
              reply(exchange, 200, "{}");
            } catch (InterruptedException interrupted) {
              Thread.currentThread().interrupt();
              throw new IOException(interrupted);
            } finally {
              inFlight.decrementAndGet();
            }
          });
      server.createContext(
          "/cold",
          exchange -> {
            assertEquals(4, reads.get());
            assertEquals(
                "Bearer private-control", exchange.getRequestHeaders().getFirst("Authorization"));
            resets.incrementAndGet();
            maximum.set(0);
            reply(exchange, 200, "ok");
          });
      server.start();
      try {
        measure(server);
        assertEquals(1, resets.get());
        assertEquals(12, reads.get());
        assertTrue(maximum.get() > 1);
        assertTrue(
            Files.readString(directory.resolve("result.csv")).contains(",none,32,open-loop"));
        final var lifecycle =
            JsonUtils.readTree(Files.readString(directory.resolve("result.csv.read.cache.json")));
        assertEquals("cold-start", lifecycle.path("lifecycle").asText());
        assertEquals("cold", lifecycle.path("reset").asText());
      } finally {
        server.stop(0);
      }
    }
  }

  @Test
  void aDeniedColdStartCannotProduceMeasuredResults() throws Exception {
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 8);
    final var reads = new AtomicInteger();
    server.createContext(
        "/read",
        exchange -> {
          reads.incrementAndGet();
          reply(exchange, 200, "{}");
        });
    server.createContext("/cold", exchange -> reply(exchange, 403, "Forbidden"));
    server.start();
    try {
      assertThrows(IOException.class, () -> measure(server));
      assertEquals(4, reads.get());
      assertFalse(Files.exists(directory.resolve("result.csv")));
    } finally {
      server.stop(0);
    }
  }

  private void measure(final HttpServer server) throws Exception {
    final String address = "http://127.0.0.1:" + server.getAddress().getPort();
    final Path manifest = directory.resolve("manifest.json");
    final Path control = directory.resolve("control.json");
    Files.writeString(
        manifest,
        JsonUtils.pojoToJson(
            new EntityBenchmarkManifest(
                address,
                "api-token",
                List.of(
                    new Workload(
                        "read", List.of(), new Request("GET", "/read", Map.of(), null, 200))))));
    Files.writeString(
        control, JsonUtils.pojoToJson(new Endpoint(URI.create(address), "private-control")));
    final Map<String, String> settings =
        Map.of(
            "entityBenchmark.control",
            control.toString(),
            "entityBenchmark.reset",
            "none",
            "entityBenchmark.coldStart",
            "cold",
            "entityBenchmark.scheduling",
            "open-loop",
            "entityBenchmark.warmupRate",
            "100");
    final Map<String, String> previous = new HashMap<>();
    settings.forEach((name, value) -> previous.put(name, System.setProperty(name, value)));
    try {
      EntityApiBenchmark.main(
          new String[] {
            manifest.toString(),
            directory.resolve("result.csv").toString(),
            "8",
            "4",
            "1000",
            "read"
          });
    } finally {
      previous.forEach(
          (name, value) -> {
            if (value == null) System.clearProperty(name);
            else System.setProperty(name, value);
          });
    }
  }

  private static void reply(final HttpExchange exchange, final int status, final String value)
      throws IOException {
    try (exchange) {
      final byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(status, bytes.length);
      exchange.getResponseBody().write(bytes);
    }
  }
}
