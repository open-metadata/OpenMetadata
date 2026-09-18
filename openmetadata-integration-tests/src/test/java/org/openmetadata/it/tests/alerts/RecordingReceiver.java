package org.openmetadata.it.tests.alerts;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** A local HTTP endpoint that records every request the alert pipeline sends to it. */
final class RecordingReceiver implements AutoCloseable {

  record Received(String path, String method, String body, boolean signed) {}

  private static final String SIGNATURE_HEADER = "X-OM-Signature";
  private static final byte[] EMPTY_JSON = "{}".getBytes(StandardCharsets.UTF_8);

  private final HttpServer server;
  private final List<Received> received = new CopyOnWriteArrayList<>();
  private final Map<String, Integer> statusByPath = new ConcurrentHashMap<>();

  RecordingReceiver() throws IOException {
    server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext("/", this::record);
    server.start();
  }

  void answer(String path, int status) {
    statusByPath.put(path, status);
  }

  // The name, not 127.0.0.1: outgoing requests to a loopback address are refused by the server.
  String url(String path) {
    return "http://localhost:" + port() + path;
  }

  int port() {
    return server.getAddress().getPort();
  }

  List<Received> received() {
    return List.copyOf(received);
  }

  private void record(HttpExchange exchange) throws IOException {
    String path = exchange.getRequestURI().getPath();
    String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    boolean signed = exchange.getRequestHeaders().containsKey(SIGNATURE_HEADER);
    received.add(new Received(path, exchange.getRequestMethod(), body, signed));
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(statusByPath.getOrDefault(path, 200), EMPTY_JSON.length);
    exchange.getResponseBody().write(EMPTY_JSON);
    exchange.close();
  }

  @Override
  public void close() {
    server.stop(0);
  }
}
