package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.perf.EntityBenchmarkControl.Endpoint;

class EntityBenchmarkGateTest {
  @Test
  void timerStartsAfterTheAuthenticatedResetAcknowledgement() throws Exception {
    final HttpServer server = server();
    final AtomicLong acknowledged = new AtomicLong();
    server.createContext(
        "/cold",
        exchange -> {
          assertEquals("POST", exchange.getRequestMethod());
          assertEquals("Bearer test-token", exchange.getRequestHeaders().getFirst("Authorization"));
          acknowledged.set(System.nanoTime());
          reply(exchange, 200, "ok");
        });
    server.start();
    try {
      final var gate = new EntityBenchmarkGate(endpoint(server), "cold");
      final long started = gate.startRequest();
      assertTrue(acknowledged.get() > 0);
      assertTrue(started >= acknowledged.get());
    } finally {
      server.stop(0);
    }
  }

  @Test
  void deniedOrUnacknowledgedResetsInvalidateMeasurements() throws Exception {
    final HttpServer server = server();
    server.createContext("/cold", exchange -> reply(exchange, 403, "Forbidden"));
    server.createContext("/l1-cold", exchange -> reply(exchange, 200, "incomplete"));
    server.start();
    try {
      final var denied = new EntityBenchmarkGate(endpoint(server), "cold");
      final var unacknowledged = new EntityBenchmarkGate(endpoint(server), "l1-cold");
      assertThrows(IOException.class, denied::startRequest);
      assertThrows(IOException.class, unacknowledged::startRequest);
    } finally {
      server.stop(0);
    }
  }

  @Test
  void aColdRequestCannotSelectAnUnrelatedControlCommand() throws Exception {
    final HttpServer server = server();
    try {
      assertThrows(
          IllegalArgumentException.class,
          () -> new EntityBenchmarkGate(endpoint(server), "redis-pause"));
    } finally {
      server.stop(0);
    }
  }

  private static HttpServer server() throws IOException {
    return HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 1);
  }

  private static Endpoint endpoint(HttpServer server) {
    return new Endpoint(
        URI.create("http://127.0.0.1:" + server.getAddress().getPort()), "test-token");
  }

  private static void reply(HttpExchange exchange, int status, String text) throws IOException {
    try (exchange) {
      final byte[] body = text.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(status, body.length);
      exchange.getResponseBody().write(body);
    }
  }
}
