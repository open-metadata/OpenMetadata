package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;

class EntityBenchmarkReadWorkloadsTest {
  @Test
  void detailWorkloadsExerciseBothLookupFormsAndBothPrincipals() throws Exception {
    final var table =
        new Table()
            .withId(UUID.randomUUID())
            .withFullyQualifiedName("service.database.schema.table")
            .withDatabaseSchema(
                new EntityReference().withFullyQualifiedName("service.database.schema"));
    final var workloads = EntityBenchmarkReadWorkloads.create(table, 100, "reader-token");
    final var details =
        workloads.stream()
            .filter(
                workload -> workload.name().matches("get\\.(reader\\.)?(minimal|expanded)\\..*"))
            .toList();
    assertEquals(8, details.size());
    final AtomicInteger readers = new AtomicInteger();
    final AtomicInteger names = new AtomicInteger();
    final HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/v1/tables", exchange -> serveDetail(exchange, table, readers, names));
    server.start();
    try {
      final var manifest =
          new EntityBenchmarkManifest(
              "http://127.0.0.1:" + server.getAddress().getPort(), "admin-token", details);
      final var http = new EntityBenchmarkHttp(manifest);
      for (final var workload : details) {
        final var reply =
            http.send(workload.request(), new EntityBenchmarkHttp.Context("read", null), true);
        assertTrue(reply.succeeds(workload.request(), workload.checks()), workload.name());
      }
      assertEquals(4, readers.get());
      assertEquals(4, names.get());
    } finally {
      server.stop(0);
    }
  }

  private static void serveDetail(
      final HttpExchange exchange,
      final Table table,
      final AtomicInteger readers,
      final AtomicInteger names)
      throws IOException {
    final String path = exchange.getRequestURI().getPath();
    final boolean byName = path.equals("/v1/tables/name/" + table.getFullyQualifiedName());
    final boolean byId = path.equals("/v1/tables/" + table.getId());
    final var authorization = exchange.getRequestHeaders().get("Authorization");
    final boolean reader = List.of("Bearer reader-token").equals(authorization);
    final boolean admin = List.of("Bearer admin-token").equals(authorization);
    final String query = exchange.getRequestURI().getQuery();
    final Set<String> expanded =
        Set.of("columns", "customMetrics", "extension", "owners", "followers", "domains", "tags");
    final boolean projection =
        query == null
            || (query.startsWith("fields=")
                && Set.of(query.substring("fields=".length()).split(",")).equals(expanded));
    if (reader) readers.incrementAndGet();
    if (byName) names.incrementAndGet();
    try (exchange) {
      exchange.sendResponseHeaders(
          (reader || admin) && (byId || byName) && projection ? 200 : 400, -1);
    }
  }
}
