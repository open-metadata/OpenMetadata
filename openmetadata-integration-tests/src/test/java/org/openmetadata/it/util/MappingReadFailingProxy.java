package org.openmetadata.it.util;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Executors;

/**
 * Forwards HTTP to a search engine but answers every request that reads an index mapping itself,
 * with a 503 by default or with a 200 that is not JSON, as a gateway's error page would be, so a
 * test can see what happens when the live mapping cannot be read while the cluster still accepts
 * writes.
 */
public final class MappingReadFailingProxy implements AutoCloseable {
  private static final List<String> FORWARDED_HEADERS =
      List.of("Content-Type", "Accept", "Content-Encoding", "Accept-Encoding");

  /** Response headers the proxy's own server writes; the engine's product header is passed on. */
  private static final Set<String> HOP_BY_HOP_HEADERS =
      Set.of("content-length", "transfer-encoding", "connection", ":status");

  private static final byte[] FAILURE =
      "{\"error\":{\"type\":\"injected\",\"reason\":\"mapping read refused by the test proxy\"},\"status\":503}"
          .getBytes(StandardCharsets.UTF_8);

  private static final byte[] NOT_JSON =
      "<html><body>Gateway maintenance</body></html>".getBytes(StandardCharsets.UTF_8);

  private final HttpServer server;
  private final HttpClient client = HttpClient.newHttpClient();
  private final String target;
  private final int status;
  private final String contentType;
  private final byte[] reply;

  public MappingReadFailingProxy(String host, int port) throws IOException {
    this(host, port, 503, "application/json", FAILURE);
  }

  /** A proxy that answers a mapping read with 200 and an HTML page. */
  public static MappingReadFailingProxy answeringWithAPageThatIsNotJson(String host, int port)
      throws IOException {
    return new MappingReadFailingProxy(host, port, 200, "text/html", NOT_JSON);
  }

  private MappingReadFailingProxy(
      String host, int port, int status, String contentType, byte[] reply) throws IOException {
    this.status = status;
    this.contentType = contentType;
    this.reply = reply;
    target = "http://" + host + ":" + port;
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", this::handle);
    server.setExecutor(Executors.newCachedThreadPool());
    server.start();
  }

  public int port() {
    return server.getAddress().getPort();
  }

  private void handle(HttpExchange exchange) throws IOException {
    try (exchange) {
      if (readsAMapping(exchange)) {
        respond(exchange, status, contentType, reply);
      } else {
        forward(exchange);
      }
    }
  }

  private static boolean readsAMapping(HttpExchange exchange) {
    return "GET".equals(exchange.getRequestMethod())
        && exchange.getRequestURI().getPath().contains("/_mapping");
  }

  private void forward(HttpExchange exchange) throws IOException {
    byte[] body;
    try (InputStream in = exchange.getRequestBody()) {
      body = in.readAllBytes();
    }
    HttpRequest.Builder request =
        HttpRequest.newBuilder(URI.create(target + exchange.getRequestURI()))
            .method(exchange.getRequestMethod(), HttpRequest.BodyPublishers.ofByteArray(body));
    for (String header : FORWARDED_HEADERS) {
      String value = exchange.getRequestHeaders().getFirst(header);
      if (value != null) {
        request.header(header, value);
      }
    }
    HttpResponse<byte[]> response;
    try {
      response = client.send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IOException(e);
    }
    response.headers().map().entrySet().stream()
        .filter(header -> !HOP_BY_HOP_HEADERS.contains(header.getKey().toLowerCase(Locale.ROOT)))
        .forEach(header -> exchange.getResponseHeaders().put(header.getKey(), header.getValue()));
    String contentType = response.headers().firstValue("Content-Type").orElse("application/json");
    respond(exchange, response.statusCode(), contentType, response.body());
  }

  private static void respond(HttpExchange exchange, int status, String contentType, byte[] body)
      throws IOException {
    exchange.getResponseHeaders().set("Content-Type", contentType);
    boolean empty = body.length == 0 || "HEAD".equals(exchange.getRequestMethod());
    exchange.sendResponseHeaders(status, empty ? -1 : body.length);
    if (!empty) {
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(body);
      }
    }
  }

  @Override
  public void close() {
    server.stop(0);
  }
}
