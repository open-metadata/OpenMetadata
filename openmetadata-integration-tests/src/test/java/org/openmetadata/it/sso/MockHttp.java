package org.openmetadata.it.sso;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;

/** HTTP plumbing shared by the in-JVM mock identity providers. */
@Slf4j
public final class MockHttp {
  public static final String LOCATION = "Location";
  public static final String AUTHORIZATION = "Authorization";
  private static final String CONTENT_TYPE = "Content-Type";
  private static final String JSON = "application/json";
  private static final String HEAD = "HEAD";
  private static final int NO_BODY = -1;
  private static final int FOUND = 302;
  private static final int HANDLER_THREADS = 4;

  private MockHttp() {}

  /**
   * Binds a server to the loopback interface without starting it, so its port (and therefore its
   * issuer URL) is known before the routes are registered. Callers publish it as {@code
   * http://localhost:port}: the server's outbound URL policy refuses loopback IP literals but
   * accepts host names.
   */
  public static LoopbackServer bindLoopbackServer() {
    try {
      HttpServer server =
          HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
      ExecutorService executor = Executors.newFixedThreadPool(HANDLER_THREADS, daemonThreads());
      server.setExecutor(executor);
      return new LoopbackServer(server, executor);
    } catch (IOException e) {
      throw new UncheckedIOException("Could not bind a mock identity provider", e);
    }
  }

  public static void respondJson(HttpExchange exchange, int status, String json)
      throws IOException {
    exchange.getResponseHeaders().set(CONTENT_TYPE, JSON);
    respond(exchange, status, json);
  }

  public static void respond(HttpExchange exchange, int status, String body) throws IOException {
    byte[] bytes = body.getBytes(UTF_8);
    boolean isHead = HEAD.equalsIgnoreCase(exchange.getRequestMethod());
    exchange.sendResponseHeaders(status, isHead ? NO_BODY : bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      if (!isHead) {
        out.write(bytes);
      }
    }
  }

  public static void redirect(HttpExchange exchange, String location) throws IOException {
    exchange.getResponseHeaders().set(LOCATION, location);
    exchange.sendResponseHeaders(FOUND, NO_BODY);
    exchange.close();
  }

  public static Map<String, String> queryParameters(HttpExchange exchange) {
    return decode(exchange.getRequestURI().getRawQuery());
  }

  public static Map<String, String> formParameters(HttpExchange exchange) throws IOException {
    return decode(new String(exchange.getRequestBody().readAllBytes(), UTF_8));
  }

  public static Map<String, String> decode(String encoded) {
    Map<String, String> parameters = new LinkedHashMap<>();
    if (encoded == null || encoded.isBlank()) {
      return parameters;
    }
    for (String pair : encoded.split("&")) {
      int separator = pair.indexOf('=');
      String name = separator < 0 ? pair : pair.substring(0, separator);
      String value = separator < 0 ? "" : pair.substring(separator + 1);
      parameters.put(URLDecoder.decode(name, UTF_8), URLDecoder.decode(value, UTF_8));
    }
    return parameters;
  }

  public static String encode(Map<String, String> parameters) {
    return parameters.entrySet().stream()
        .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
        .collect(Collectors.joining("&"));
  }

  public static String encode(String value) {
    return URLEncoder.encode(value, UTF_8);
  }

  public static String withQuery(String url, Map<String, String> parameters) {
    String separator = url.contains("?") ? "&" : "?";
    return url + separator + encode(parameters);
  }

  /** A size-capped, insertion-ordered map, so a mock never grows without bound. */
  public static <K, V> Map<K, V> boundedMap(int maxEntries) {
    return Collections.synchronizedMap(
        new LinkedHashMap<K, V>() {
          @Override
          protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > maxEntries;
          }
        });
  }

  // An exception thrown by a handler would otherwise reset the connection with no response,
  // which surfaces in the server under test as an opaque I/O error.
  private static HttpHandler failSafe(HttpHandler handler) {
    return exchange -> {
      try {
        handler.handle(exchange);
      } catch (IOException | RuntimeException e) {
        log.error("Mock identity provider failed on {}", exchange.getRequestURI(), e);
        respond(exchange, 500, "mock identity provider error: " + e.getMessage());
      }
    };
  }

  private static ThreadFactory daemonThreads() {
    return runnable -> {
      Thread thread = new Thread(runnable, "mock-idp");
      thread.setDaemon(true);
      return thread;
    };
  }

  /** A bound server and the executor that serves it; closing stops both. */
  public static final class LoopbackServer implements AutoCloseable {
    private final HttpServer server;
    private final ExecutorService executor;

    private LoopbackServer(HttpServer server, ExecutorService executor) {
      this.server = server;
      this.executor = executor;
    }

    public String localhostUrl() {
      return "http://localhost:" + server.getAddress().getPort();
    }

    public void start(Map<String, HttpHandler> routes) {
      routes.forEach((path, handler) -> server.createContext(path, failSafe(handler)));
      server.start();
    }

    @Override
    public void close() {
      server.stop(0);
      executor.shutdownNow();
    }
  }
}
