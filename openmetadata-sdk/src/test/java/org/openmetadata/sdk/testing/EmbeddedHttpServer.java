package org.openmetadata.sdk.testing;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Loopback HTTP server for SDK tests. It records every request it receives and answers with a
 * stubbed response, so a service is exercised through a real {@link OpenMetadataHttpClient} and
 * real JSON deserialization rather than a mocked transport.
 */
public final class EmbeddedHttpServer implements AutoCloseable {

  private static final String LOOPBACK_HOST = "127.0.0.1";
  private static final String API_ROOT = "/api";
  private static final int NO_RESPONSE_BODY = -1;
  private static final StubResponse UNSTUBBED =
      StubResponse.json(500, "{\"code\":500,\"message\":\"No stub response configured\"}");

  private final HttpServer server;
  private final List<ReceivedRequest> received = new CopyOnWriteArrayList<>();
  private volatile Function<ReceivedRequest, StubResponse> responder = request -> UNSTUBBED;

  private EmbeddedHttpServer(HttpServer server) {
    this.server = server;
  }

  /**
   * Starts a server on an ephemeral loopback port that answers requests under {@code apiPath},
   * given relative to the API root (for example {@code /v1/pipelines}). Requests outside it get the
   * server's own 404, so a service calling the wrong resource fails instead of reading a stub.
   */
  public static EmbeddedHttpServer start(String apiPath) throws IOException {
    final HttpServer httpServer = HttpServer.create(new InetSocketAddress(LOOPBACK_HOST, 0), 0);
    final EmbeddedHttpServer embeddedServer = new EmbeddedHttpServer(httpServer);
    httpServer.createContext(API_ROOT + apiPath, embeddedServer::handle);
    httpServer.start();
    return embeddedServer;
  }

  public void respond(int status, String jsonBody) {
    respondWith(request -> StubResponse.json(status, jsonBody));
  }

  public void respondNoContent() {
    respondWith(request -> StubResponse.noContent());
  }

  public void respondWith(Function<ReceivedRequest, StubResponse> responder) {
    this.responder = responder;
  }

  public List<ReceivedRequest> requests() {
    return List.copyOf(received);
  }

  public void clearRequests() {
    received.clear();
  }

  public String baseUrl() {
    return "http://" + LOOPBACK_HOST + ":" + server.getAddress().getPort() + API_ROOT;
  }

  public OpenMetadataHttpClient httpClient() {
    return new OpenMetadataHttpClient(config());
  }

  public OpenMetadataClient client() {
    return new OpenMetadataClient(config());
  }

  @Override
  public void close() {
    server.stop(0);
  }

  private OpenMetadataConfig config() {
    return OpenMetadataConfig.builder().baseUrl(baseUrl()).build();
  }

  private void handle(HttpExchange exchange) throws IOException {
    try (exchange) {
      final ReceivedRequest request =
          new ReceivedRequest(
              exchange.getRequestMethod(),
              exchange.getRequestURI().getRawPath(),
              exchange.getRequestURI().getRawQuery());
      received.add(request);
      writeResponse(exchange, responder.apply(request));
    }
  }

  private static void writeResponse(HttpExchange exchange, StubResponse response)
      throws IOException {
    if (response.hasBody()) {
      final byte[] bytes = response.body().getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "application/json");
      exchange.sendResponseHeaders(response.status(), bytes.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(bytes);
      }
    } else {
      exchange.sendResponseHeaders(response.status(), NO_RESPONSE_BODY);
    }
  }

  /** A request as it arrived on the wire: the path and query are still percent-encoded. */
  public record ReceivedRequest(String method, String rawPath, String rawQuery) {

    /**
     * Decodes the query with form semantics, so {@code +} and {@code %20} both read as a space and
     * assertions compare the values the caller passed rather than how the client encoded them. A
     * key without {@code =} maps to an empty value. A repeated key fails the test instead of
     * silently keeping one of its values, since none of the endpoints under test send one.
     */
    public Map<String, String> query() {
      final Map<String, String> decoded = new LinkedHashMap<>();
      for (String pair : queryPairs()) {
        final int separator = pair.indexOf('=');
        final String key = decode(separator < 0 ? pair : pair.substring(0, separator));
        final String value = separator < 0 ? "" : decode(pair.substring(separator + 1));
        if (decoded.putIfAbsent(key, value) != null) {
          throw new IllegalStateException(
              "Query parameter '%s' is repeated in '%s'".formatted(key, rawQuery));
        }
      }
      return Collections.unmodifiableMap(decoded);
    }

    private List<String> queryPairs() {
      return nullOrEmpty(rawQuery) ? List.of() : List.of(rawQuery.split("&"));
    }

    private static String decode(String component) {
      return URLDecoder.decode(component, StandardCharsets.UTF_8);
    }
  }

  /** The status and JSON body to answer with; a {@code null} body sends no body at all. */
  public record StubResponse(int status, String body) {
    private static final int NO_CONTENT = 204;

    public static StubResponse json(int status, String body) {
      return new StubResponse(status, body);
    }

    public static StubResponse noContent() {
      return new StubResponse(NO_CONTENT, null);
    }

    private boolean hasBody() {
      return body != null && status != NO_CONTENT;
    }
  }
}
