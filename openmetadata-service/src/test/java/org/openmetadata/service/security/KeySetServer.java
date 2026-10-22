package org.openmetadata.service.security;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.util.Arrays;
import java.util.Base64;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** A key set on a loopback port that counts its requests, or holds every one unanswered. */
final class KeySetServer implements AutoCloseable {
  private static final String NO_KEYS = "{\"keys\":[]}";

  private final HttpServer server;
  private final ExecutorService executor = Executors.newCachedThreadPool();
  private final AtomicReference<String> body;
  private final AtomicInteger requests = new AtomicInteger();
  private final CountDownLatch closed = new CountDownLatch(1);

  private KeySetServer(String body) throws IOException {
    this.body = new AtomicReference<>(body);
    server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    server.createContext("/jwks", this::respond);
    server.setExecutor(executor);
    server.start();
  }

  static KeySetServer publishing(String keyId) throws IOException, GeneralSecurityException {
    return new KeySetServer(keySetJson(keyId, newPublicKey()));
  }

  static KeySetServer neverAnswering() throws IOException {
    return new KeySetServer(null);
  }

  /** From now on the set carries only {@code keyId}, under a new key. */
  void publish(String keyId) throws GeneralSecurityException {
    body.set(keySetJson(keyId, newPublicKey()));
  }

  URL url() throws IOException {
    return URI.create("http://localhost:" + server.getAddress().getPort() + "/jwks").toURL();
  }

  int requests() {
    return requests.get();
  }

  static RSAPublicKey newPublicKey() throws GeneralSecurityException {
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    return (RSAPublicKey) generator.generateKeyPair().getPublic();
  }

  static String keySetJson(String keyId, RSAPublicKey key) {
    return String.format(
        "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"%s\",\"use\":\"sig\",\"alg\":\"RS256\","
            + "\"n\":\"%s\",\"e\":\"%s\"}]}",
        keyId, base64Url(key.getModulus()), base64Url(key.getPublicExponent()));
  }

  private static String base64Url(BigInteger value) {
    byte[] bytes = value.toByteArray();
    byte[] unsigned = bytes[0] == 0 ? Arrays.copyOfRange(bytes, 1, bytes.length) : bytes;
    return Base64.getUrlEncoder().withoutPadding().encodeToString(unsigned);
  }

  private void respond(HttpExchange exchange) throws IOException {
    requests.incrementAndGet();
    String published = body.get();
    if (published == null) {
      awaitClose();
    }
    byte[] bytes = (published == null ? NO_KEYS : published).getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(200, bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }

  private void awaitClose() {
    try {
      closed.await(30, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  @Override
  public void close() {
    closed.countDown();
    server.stop(0);
    executor.shutdownNow();
  }
}
