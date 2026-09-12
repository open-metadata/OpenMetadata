package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Checks;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.utils.JsonUtils;

@Isolated("Configures benchmark scheduling through system properties")
class EntityBenchmarkProtocolTest {
  @TempDir Path directory;

  @Test
  void workloadCredentialsReplaceTheDefaultAuthorizationHeader() throws Exception {
    final HttpServer server = server();
    server.createContext(
        "/reader",
        exchange -> {
          final boolean authorized =
              List.of("Bearer reader-token")
                  .equals(exchange.getRequestHeaders().get("Authorization"));
          respond(exchange, authorized ? 200 : 401, "{}");
        });
    server.start();
    try {
      final var request =
          new Request("GET", "/reader", Map.of("authorization", "Bearer reader-token"), null, 200);
      measure(server, new Workload("reader", List.of(), request), 2, 1);
      assertTrue(Files.readString(directory.resolve("result.csv")).contains("reader,2,0,"));
    } finally {
      server.stop(0);
    }
  }

  @Test
  void requestsWithoutCredentialsUseTheManifestAuthorizationHeader() throws Exception {
    final HttpServer server = server();
    server.createContext(
        "/admin",
        exchange -> {
          final boolean authorized =
              List.of("Bearer test-token")
                  .equals(exchange.getRequestHeaders().get("Authorization"));
          respond(exchange, authorized ? 200 : 401, "{}");
        });
    server.start();
    try {
      final var request = request("GET", "/admin", null, 200);
      measure(server, new Workload("admin", List.of(), request), 2, 1);
      assertTrue(Files.readString(directory.resolve("result.csv")).contains("admin,2,0,"));
    } finally {
      server.stop(0);
    }
  }

  @Test
  void singleClientMeasurementsAdvanceAfterEachResponseWithoutArrivalRateDelays() throws Exception {
    final HttpServer server = server();
    final AtomicInteger received = new AtomicInteger();
    server.createContext(
        "/read",
        exchange -> {
          received.incrementAndGet();
          respond(exchange, 200, "{}");
        });
    server.start();
    final String previous = System.setProperty("entityBenchmark.scheduling", "single-client");
    try {
      final var workload = new Workload("read", List.of(), request("GET", "/read", null, 200));
      assertTimeoutPreemptively(
          Duration.ofSeconds(10), () -> measure(server, workload, 3, 1, "0.01"));
      assertEquals(4, received.get());
      final String result = Files.readString(directory.resolve("result.csv"));
      assertTrue(result.contains("read,3,0,"));
      assertTrue(result.contains(",none,1,single-client\n"));
    } finally {
      if (previous == null) {
        System.clearProperty("entityBenchmark.scheduling");
      } else {
        System.setProperty("entityBenchmark.scheduling", previous);
      }
      server.stop(0);
    }
  }

  @Test
  void rejectedRequestsRetainTheirStatusAndSubmissionDelays() throws Exception {
    final HttpServer server = server();
    server.createContext("/read", exchange -> respond(exchange, 503, "{}"));
    server.start();
    final String previous = System.setProperty("entityBenchmark.concurrency", "1");
    try {
      final var workload = new Workload("read", List.of(), request("GET", "/read", null, 200));
      assertThrows(IllegalStateException.class, () -> measure(server, workload, 2, 0, "1000000"));
      final List<String> trace =
          Files.readAllLines(directory.resolve("result.csv.read.requests.csv"));
      assertEquals("sequence,latency_ms,submission_delay_ms,http_status,success", trace.getFirst());
      assertEquals(3, trace.size());
      final String[] first = trace.get(1).split(",");
      final String[] second = trace.getLast().split(",");
      for (final String[] sample : List.of(first, second)) {
        assertEquals("503", sample[3]);
        assertEquals("false", sample[4]);
        assertTrue(Double.parseDouble(sample[2]) >= 0);
        assertTrue(Double.parseDouble(sample[2]) < Double.parseDouble(sample[1]));
      }
      assertTrue(Double.parseDouble(second[2]) >= Double.parseDouble(first[1]) - 0.001);
    } finally {
      if (previous == null) {
        System.clearProperty("entityBenchmark.concurrency");
      } else {
        System.setProperty("entityBenchmark.concurrency", previous);
      }
      server.stop(0);
    }
  }

  @Test
  void everyBulkRowMustPassBeforeAcceptingTheMeasurement() throws Exception {
    final HttpServer server = server();
    server.createContext(
        "/bulk",
        exchange ->
            respond(
                exchange,
                200,
                "{\"status\":\"success\",\"numberOfRowsProcessed\":3,"
                    + "\"numberOfRowsPassed\":3,\"numberOfRowsFailed\":0}"));
    server.start();
    try {
      final var workload =
          new Workload(
              "bulk.complete", List.of(), request("PUT", "/bulk", "[]", 200), new Checks(3, false));
      measure(server, workload, 2, 1);
      assertTrue(Files.readString(directory.resolve("result.csv")).contains("bulk.complete,2,0,"));
      final var incomplete =
          new Workload(
              "bulk.incomplete",
              List.of(),
              request("PUT", "/bulk", "[]", 200),
              new Checks(4, false));
      assertThrows(IllegalStateException.class, () -> measure(server, incomplete, 1, 0));
    } finally {
      server.stop(0);
    }
  }

  @Test
  void aSuccessfulHttpStatusWithFailedBulkRowsInvalidatesTheMeasurement() throws Exception {
    final HttpServer server = server();
    server.createContext(
        "/bulk",
        exchange ->
            respond(
                exchange,
                200,
                "{\"status\":\"partialSuccess\",\"numberOfRowsProcessed\":2,"
                    + "\"numberOfRowsPassed\":1,\"numberOfRowsFailed\":1}"));
    server.start();
    try {
      final var workload =
          new Workload(
              "bulk.partial", List.of(), request("PUT", "/bulk", "[]", 200), new Checks(2, false));
      assertThrows(IllegalStateException.class, () -> measure(server, workload, 1, 0));
      assertTrue(Files.readString(directory.resolve("result.csv")).contains("bulk.partial,1,1,"));
      final String sample =
          Files.readAllLines(directory.resolve("result.csv.bulk.partial.requests.csv")).getLast();
      assertTrue(sample.endsWith(",200,false"));
    } finally {
      server.stop(0);
    }
  }

  @Test
  void restoreSamplesUseTheirOwnSetupIdsIncludingWarmup() throws Exception {
    final HttpServer server = server();
    final Map<String, Row> rows = new ConcurrentHashMap<>();
    final AtomicInteger restored = new AtomicInteger();
    server.createContext("/tables", exchange -> handleTable(exchange, rows, restored));
    server.start();
    try {
      final var setup =
          List.of(
              request("POST", "/tables", "{\"name\":\"table_${sequence}\"}", 201),
              request("DELETE", "/tables/name/table_${sequence}", null, 200));
      final var workload =
          new Workload(
              "restore",
              setup,
              request("PUT", "/tables/restore", "{\"id\":\"${entityId}\"}", 200),
              new Checks(null, true));
      measure(server, workload, 2, 1);
      assertEquals(3, rows.size());
      assertEquals(3, restored.get());
      assertTrue(rows.values().stream().noneMatch(Row::deleted));
      assertTrue(Files.readString(directory.resolve("result.csv")).contains("restore,2,0,"));
    } finally {
      server.stop(0);
    }
  }

  private void measure(HttpServer server, Workload workload, int samples, int warmup)
      throws Exception {
    measure(server, workload, samples, warmup, "1000");
  }

  private void measure(HttpServer server, Workload workload, int samples, int warmup, String rate)
      throws Exception {
    final Path manifest = directory.resolve("manifest.json");
    Files.writeString(
        manifest,
        JsonUtils.pojoToJson(
            new EntityBenchmarkManifest(
                "http://127.0.0.1:" + server.getAddress().getPort(),
                "test-token",
                List.of(workload))));
    EntityApiBenchmark.main(
        new String[] {
          manifest.toString(),
          directory.resolve("result.csv").toString(),
          Integer.toString(samples),
          Integer.toString(warmup),
          rate,
          ".*"
        });
  }

  private static void handleTable(
      HttpExchange exchange, Map<String, Row> rows, AtomicInteger restored) throws IOException {
    switch (exchange.getRequestMethod()) {
      case "POST" -> {
        final String name =
            JsonUtils.readTree(
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8))
                .get("name")
                .asText();
        final Row row = new Row(UUID.randomUUID(), false);
        assertEquals(null, rows.putIfAbsent(name, row));
        assertTrue(rows.size() <= 3);
        respond(exchange, 201, "{\"id\":\"" + row.id() + "\"}");
      }
      case "DELETE" -> {
        final String name = exchange.getRequestURI().getPath().substring("/tables/name/".length());
        final Row row = rows.get(name);
        assertFalse(row.deleted());
        rows.put(name, new Row(row.id(), true));
        respond(exchange, 200, "{}");
      }
      case "PUT" -> restore(exchange, rows, restored);
      default -> respond(exchange, 400, "{}");
    }
  }

  private static void restore(HttpExchange exchange, Map<String, Row> rows, AtomicInteger restored)
      throws IOException {
    final UUID id =
        UUID.fromString(
            JsonUtils.readTree(
                    new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8))
                .get("id")
                .asText());
    final String name =
        rows.entrySet().stream()
            .filter(entry -> entry.getValue().id().equals(id))
            .findFirst()
            .orElseThrow()
            .getKey();
    assertTrue(rows.get(name).deleted());
    rows.put(name, new Row(id, false));
    restored.incrementAndGet();
    respond(exchange, 200, "{}");
  }

  private static HttpServer server() throws IOException {
    return HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
  }

  private static Request request(String method, String path, String body, int status) {
    return new Request(method, path, Map.of("Content-Type", "application/json"), body, status);
  }

  private static void respond(HttpExchange exchange, int status, String body) throws IOException {
    final byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(status, bytes.length);
    try (var output = exchange.getResponseBody()) {
      output.write(bytes);
    }
  }

  private record Row(UUID id, boolean deleted) {}
}
