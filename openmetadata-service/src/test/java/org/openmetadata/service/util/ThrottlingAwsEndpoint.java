package org.openmetadata.service.util;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A local AWS endpoint that answers every call with a throttling error and counts the attempts a
 * client makes before giving up: the JSON protocol's ThrottlingException (Secrets Manager, SSM) or
 * S3's 503 SlowDown.
 */
public final class ThrottlingAwsEndpoint implements AutoCloseable {
  private static final byte[] JSON_THROTTLED =
      "{\"__type\":\"ThrottlingException\",\"message\":\"Rate exceeded\"}"
          .getBytes(StandardCharsets.UTF_8);
  private static final byte[] S3_SLOW_DOWN =
      "<Error><Code>SlowDown</Code><Message>Please reduce your request rate.</Message></Error>"
          .getBytes(StandardCharsets.UTF_8);

  private final HttpServer server;
  private final AtomicInteger attempts = new AtomicInteger();
  private final boolean s3;

  public ThrottlingAwsEndpoint() {
    this(false);
  }

  public static ThrottlingAwsEndpoint forS3() {
    return new ThrottlingAwsEndpoint(true);
  }

  private ThrottlingAwsEndpoint(final boolean s3) {
    this.s3 = s3;
    try {
      server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    } catch (IOException e) {
      throw new UncheckedIOException("Could not start the throttling AWS endpoint", e);
    }
    server.createContext("/", this::throttle);
    server.start();
  }

  public URI uri() {
    return URI.create("http://127.0.0.1:%d".formatted(server.getAddress().getPort()));
  }

  public int attempts() {
    return attempts.get();
  }

  private void throttle(final HttpExchange exchange) throws IOException {
    attempts.incrementAndGet();
    final byte[] response = s3 ? S3_SLOW_DOWN : JSON_THROTTLED;
    if (s3) {
      exchange.getResponseHeaders().add("Content-Type", "application/xml");
    } else {
      exchange.getResponseHeaders().add("Content-Type", "application/x-amz-json-1.1");
      exchange.getResponseHeaders().add("x-amzn-ErrorType", "ThrottlingException");
    }
    exchange.sendResponseHeaders(s3 ? 503 : 400, response.length);
    try (OutputStream body = exchange.getResponseBody()) {
      body.write(response);
    }
  }

  @Override
  public void close() {
    server.stop(0);
  }
}
