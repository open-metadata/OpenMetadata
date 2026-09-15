package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.perf.EntityBenchmarkHttp.Context;
import org.openmetadata.it.perf.EntityBenchmarkHttp.Reply;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Checks;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Completion;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Request;
import org.openmetadata.it.perf.EntityBenchmarkManifest.Workload;
import org.openmetadata.schema.utils.JsonUtils;

class EntityBenchmarkAsyncTest {
  @TempDir Path directory;

  @Test
  void samplerDrainsAcceptedWorkAndIncludesCompletionInItsSeparateMeasurement() throws Exception {
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    final AtomicInteger reads = new AtomicInteger();
    final AtomicInteger totalReads = new AtomicInteger();
    server.createContext(
        "/bulk",
        exchange -> {
          reads.set(0);
          respond(
              exchange,
              202,
              "{\"status\":\"success\",\"numberOfRowsProcessed\":1,\"numberOfRowsPassed\":0,"
                  + "\"numberOfRowsFailed\":0,\"successRequest\":[{\"status\":202}]}");
        });
    server.createContext(
        "/row",
        exchange -> {
          totalReads.incrementAndGet();
          if (reads.incrementAndGet() == 1) {
            respond(exchange, 200, "{\"description\":\"Old\"}");
            return;
          }
          try {
            Thread.sleep(150);
          } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IOException(interrupted);
          }
          respond(exchange, 200, "{\"description\":\"Changed\"}");
        });
    server.start();
    try {
      for (final boolean completion : List.of(false, true)) {
        final String name = completion ? "completed" : "accepted";
        final var workload =
            new Workload(
                name,
                List.of(),
                Request.json("PUT", "/bulk", "[]", 202),
                new Checks(
                    1,
                    false,
                    new Completion(
                        List.of("/row"), Map.of("description", "Changed"), completion, 5000)));
        final Path manifest = directory.resolve(name + ".json");
        final Path result = directory.resolve(name + ".csv");
        Files.writeString(
            manifest,
            JsonUtils.pojoToJson(
                new EntityBenchmarkManifest(
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    "test-token",
                    List.of(workload))));
        EntityApiBenchmark.main(
            new String[] {manifest.toString(), result.toString(), "1", "0", "1000", ".*"});
        final String[] row = Files.readAllLines(result).get(1).split(",");
        assertEquals("0", row[2]);
        if (completion) assertTrue(Double.parseDouble(row[3]) >= 150);
      }
      assertEquals(4, totalReads.get());
    } finally {
      server.stop(0);
    }
  }

  @Test
  void acceptanceRequiresEveryRowToBeAcceptedWithoutFailures() {
    final Request request = Request.json("PUT", "/bulk?async=true", "[]", 202);
    final String accepted =
        "{\"status\":\"success\",\"numberOfRowsProcessed\":2,\"numberOfRowsPassed\":0,"
            + "\"numberOfRowsFailed\":0,\"successRequest\":[{\"status\":202},{\"status\":202}]}";
    assertTrue(new Reply(202, 0, accepted).accepted(request, 2));
    assertFalse(new Reply(202, 0, accepted).accepted(request, 3));
    assertFalse(new Reply(202, 0, accepted.replace("202}", "500}")).accepted(request, 2));
    assertFalse(new Reply(202, 0, "{}").accepted(request, 2));
    assertFalse(new Reply(202, 0, "invalid json").accepted(request, 2));
  }

  @Test
  void completionWaitsForEveryRowAndRejectsOldValuesOnExistingEntities() throws Exception {
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    final AtomicInteger firstReads = new AtomicInteger();
    final AtomicInteger secondReads = new AtomicInteger();
    server.createContext(
        "/first/unique",
        exchange -> {
          firstReads.incrementAndGet();
          respond(exchange, 200, "{\"description\":\"Changed asynchronously\"}");
        });
    server.createContext(
        "/second/unique",
        exchange -> {
          final int read = secondReads.incrementAndGet();
          respond(
              exchange,
              read == 1 ? 404 : 200,
              read < 3
                  ? "{\"description\":\"Old value\"}"
                  : "{\"description\":\"Changed asynchronously\"}");
        });
    server.start();
    try {
      final var completion =
          new Completion(
              List.of("/first/${sequence}", "/second/${sequence}"),
              Map.of("description", "Changed asynchronously"),
              true,
              5000);
      final long started = System.nanoTime();
      final long completed = client(server).await(completion, new Context("unique", null));
      assertTrue(completed >= started);
      assertEquals(1, firstReads.get());
      assertEquals(3, secondReads.get());
    } finally {
      server.stop(0);
    }
  }

  @Test
  void incompleteWorkIsBoundedByTheCompletionDeadline() throws Exception {
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/pending", exchange -> respond(exchange, 200, "{\"description\":\"Old value\"}"));
    server.start();
    try {
      final var completion =
          new Completion(List.of("/pending"), Map.of("description", "Changed"), false, 30);
      assertThrows(
          IOException.class, () -> client(server).await(completion, new Context("1", null)));
      assertThrows(
          IllegalArgumentException.class, () -> new Completion(List.of(), Map.of(), false, 30));
    } finally {
      server.stop(0);
    }
  }

  private static EntityBenchmarkHttp client(final HttpServer server) {
    return new EntityBenchmarkHttp(
        new EntityBenchmarkManifest(
            "http://127.0.0.1:" + server.getAddress().getPort(), "test-token", List.of()));
  }

  private static void respond(final HttpExchange exchange, final int status, final String body)
      throws IOException {
    final byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(status, bytes.length);
    try (var output = exchange.getResponseBody()) {
      output.write(bytes);
    }
  }
}
