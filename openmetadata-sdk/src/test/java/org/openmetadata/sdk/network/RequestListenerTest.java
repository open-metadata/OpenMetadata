package org.openmetadata.sdk.network;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/** Exercises the listener against a real local HTTP server rather than a mocked OkHttp. */
class RequestListenerTest {

  private static final String OK_BODY = "{\"status\":\"ok\"}";
  private static final long BODY_DELAY_MILLIS = 50;

  private HttpServer server;
  private final List<CompletedRequest> completed = new CopyOnWriteArrayList<>();

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/tables", exchange -> respond(exchange, 200, OK_BODY));
    server.createContext("/api/v1/missing", exchange -> respond(exchange, 404, "{}"));
    server.createContext("/api/v1/slow-body", RequestListenerTest::respondWithDelayedBody);
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void reportsMethodPathQueryStatusAndDurationOfASuccessfulCall() {
    final OpenMetadataHttpClient client = clientFor(baseUrl(), completed::add);

    client.executeForString(
        HttpMethod.GET,
        "/v1/tables",
        null,
        RequestOptions.builder().queryParam("fields", "columns").build());

    assertEquals(1, completed.size());
    final CompletedRequest request = completed.getFirst();
    assertEquals("GET", request.method());
    assertEquals("/api/v1/tables", request.path());
    assertEquals("fields=columns", request.query());
    assertEquals(200, request.statusCode());
    assertTrue(request.durationNanos() > 0);
  }

  /**
   * The reason this hooks {@code callEnd} rather than an interceptor: headers arrive at once here,
   * and the body only after a delay. An interceptor would report the fast part alone.
   */
  @Test
  void durationIncludesReadingTheBody() {
    final OpenMetadataHttpClient client = clientFor(baseUrl(), completed::add);

    client.executeForString(HttpMethod.GET, "/v1/slow-body", null);

    assertTrue(
        completed.getFirst().durationNanos() >= TimeUnit.MILLISECONDS.toNanos(BODY_DELAY_MILLIS));
  }

  @Test
  void reportsTheStatusOfAnErrorResponse() {
    final OpenMetadataHttpClient client = clientFor(baseUrl(), completed::add);

    assertThrows(
        OpenMetadataException.class,
        () -> client.executeForString(HttpMethod.GET, "/v1/missing", null));

    assertEquals(404, completed.getFirst().statusCode());
    assertTrue(completed.getFirst().failed());
  }

  @Test
  void reportsNoResponseWhenTheConnectionFails() throws IOException {
    final OpenMetadataHttpClient client = clientFor(unusedLocalUrl(), completed::add);

    assertThrows(
        OpenMetadataException.class,
        () -> client.executeForString(HttpMethod.GET, "/v1/tables", null));

    final CompletedRequest request = completed.getFirst();
    assertEquals(CompletedRequest.NO_RESPONSE, request.statusCode());
    assertNull(request.query());
    assertTrue(request.failed());
  }

  @Test
  void aThrowingListenerNeitherFailsTheCallNorStarvesTheOthers() {
    final RequestListener throwing =
        request -> {
          throw new IllegalStateException("listener bug");
        };
    final OpenMetadataHttpClient client = clientFor(baseUrl(), throwing, completed::add);

    final String body = client.executeForString(HttpMethod.GET, "/v1/tables", null);

    assertEquals(OK_BODY, body);
    assertEquals(1, completed.size());
  }

  @Test
  void reportsAsyncCalls() throws Exception {
    final CountDownLatch reported = new CountDownLatch(1);
    final OpenMetadataHttpClient client =
        clientFor(
            baseUrl(),
            request -> {
              completed.add(request);
              reported.countDown();
            });

    client.executeForStringAsync(HttpMethod.GET, "/v1/tables", null).get(5, TimeUnit.SECONDS);

    assertTrue(reported.await(5, TimeUnit.SECONDS));
    assertEquals("/api/v1/tables", completed.getFirst().path());
  }

  @Test
  void rejectsANullListener() {
    final OpenMetadataConfig.Builder builder = OpenMetadataConfig.builder().baseUrl(baseUrl());

    assertThrows(IllegalArgumentException.class, () -> builder.requestListener(null));
  }

  private static OpenMetadataHttpClient clientFor(
      final String baseUrl, final RequestListener... listeners) {
    final OpenMetadataConfig.Builder builder = OpenMetadataConfig.builder().baseUrl(baseUrl);
    for (final RequestListener listener : listeners) {
      builder.requestListener(listener);
    }
    return new OpenMetadataHttpClient(builder.build());
  }

  private String baseUrl() {
    return "http://127.0.0.1:" + server.getAddress().getPort() + "/api";
  }

  /** A port that was free a moment ago, so nothing is listening and the connect is refused. */
  private static String unusedLocalUrl() throws IOException {
    try (ServerSocket socket = new ServerSocket(0)) {
      return "http://127.0.0.1:" + socket.getLocalPort() + "/api";
    }
  }

  private static void respond(final HttpExchange exchange, final int status, final String body)
      throws IOException {
    final byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }

  /** Sends the headers immediately and the body {@link #BODY_DELAY_MILLIS} later. */
  private static void respondWithDelayedBody(final HttpExchange exchange) throws IOException {
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(200, 0);
    try (OutputStream out = exchange.getResponseBody()) {
      out.flush();
      Thread.sleep(BODY_DELAY_MILLIS);
      out.write(OK_BODY.getBytes(StandardCharsets.UTF_8));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
