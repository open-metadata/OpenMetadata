package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.service.util.OAuth2TokenManager;
import org.openmetadata.service.util.OAuth2TokenManager.OAuth2TokenException;

class OAuth2TokenManagerIT {

  private static HttpServer tokenServer;
  private static int serverPort;
  private static final AtomicInteger requestCount = new AtomicInteger(0);
  private static volatile int responseStatus = 200;
  private static volatile String responseBody =
      "{\"access_token\":\"test-token\",\"expires_in\":3600}";

  private final OAuth2TokenManager tokenManager = OAuth2TokenManager.getInstance();

  @BeforeAll
  static void startServer() throws IOException {
    tokenServer = HttpServer.create(new InetSocketAddress(0), 0);
    serverPort = tokenServer.getAddress().getPort();

    tokenServer.createContext(
        "/oauth/token",
        exchange -> {
          requestCount.incrementAndGet();
          sendResponse(exchange, responseStatus, responseBody);
        });

    tokenServer.start();
  }

  @AfterAll
  static void stopServer() {
    if (tokenServer != null) {
      tokenServer.stop(0);
    }
  }

  @AfterEach
  void tearDown() {
    tokenManager.invalidateToken(buildConfig("client1", "secret1"));
    tokenManager.invalidateToken(buildConfig("client2", "secret2"));
    requestCount.set(0);
    responseStatus = 200;
    responseBody = "{\"access_token\":\"test-token\",\"expires_in\":3600}";
  }

  @Test
  void getAccessToken_success_returnsToken() {
    responseBody = "{\"access_token\":\"tok123\",\"expires_in\":3600}";

    String token = tokenManager.getAccessToken(buildConfig("client1", "secret1"));

    assertEquals("tok123", token);
    assertEquals(1, requestCount.get());
  }

  @Test
  void getAccessToken_cached_noSecondHttpCall() {
    responseBody = "{\"access_token\":\"cached-tok\",\"expires_in\":3600}";

    WebhookOAuth2Config config = buildConfig("client1", "secret1");
    tokenManager.getAccessToken(config);
    String secondCall = tokenManager.getAccessToken(config);

    assertEquals("cached-tok", secondCall);
    assertEquals(1, requestCount.get());
  }

  @Test
  void getAccessToken_expired_fetchesNewToken() {
    responseBody = "{\"access_token\":\"tok1\",\"expires_in\":30}";

    WebhookOAuth2Config config = buildConfig("client1", "secret1");
    String first = tokenManager.getAccessToken(config);
    assertEquals("tok1", first);

    responseBody = "{\"access_token\":\"tok2\",\"expires_in\":3600}";
    // expires_in=30 minus 30s buffer = already expired
    String second = tokenManager.getAccessToken(config);
    assertEquals("tok2", second);
    assertEquals(2, requestCount.get());
  }

  @Test
  void invalidateToken_forcesRefetch() {
    responseBody = "{\"access_token\":\"tok-before\",\"expires_in\":3600}";

    WebhookOAuth2Config config = buildConfig("client1", "secret1");
    assertEquals("tok-before", tokenManager.getAccessToken(config));

    tokenManager.invalidateToken(config);

    responseBody = "{\"access_token\":\"tok-after\",\"expires_in\":3600}";
    assertEquals("tok-after", tokenManager.getAccessToken(config));
    assertEquals(2, requestCount.get());
  }

  @Test
  void getAccessToken_httpError_throwsException() {
    responseStatus = 400;
    responseBody = "{\"error\":\"invalid_request\"}";

    WebhookOAuth2Config config = buildConfig("client1", "secret1");

    OAuth2TokenException ex =
        assertThrows(OAuth2TokenException.class, () -> tokenManager.getAccessToken(config));
    assertTrue(ex.getMessage().contains("HTTP 400"));
  }

  @Test
  void getAccessToken_missingAccessToken_throwsException() {
    responseBody = "{\"token_type\":\"bearer\"}";

    WebhookOAuth2Config config = buildConfig("client1", "secret1");

    OAuth2TokenException ex =
        assertThrows(OAuth2TokenException.class, () -> tokenManager.getAccessToken(config));
    assertTrue(ex.getMessage().contains("access_token"));
  }

  @Test
  void getAccessToken_expiresInAsString_parsesCorrectly() {
    responseBody = "{\"access_token\":\"str-tok\",\"expires_in\":\"7200\"}";

    String token = tokenManager.getAccessToken(buildConfig("client1", "secret1"));

    assertEquals("str-tok", token);
  }

  @Test
  void getAccessToken_differentConfigs_separateCacheEntries() {
    responseBody = "{\"access_token\":\"tok-a\",\"expires_in\":3600}";

    WebhookOAuth2Config configA = buildConfig("client1", "secret1");
    String tokenA = tokenManager.getAccessToken(configA);
    assertEquals("tok-a", tokenA);

    responseBody = "{\"access_token\":\"tok-b\",\"expires_in\":3600}";

    WebhookOAuth2Config configB = buildConfig("client2", "secret2");
    String tokenB = tokenManager.getAccessToken(configB);
    assertEquals("tok-b", tokenB);

    assertNotEquals(tokenA, tokenB);
    assertEquals(2, requestCount.get());
  }

  private WebhookOAuth2Config buildConfig(String clientId, String clientSecret) {
    return new WebhookOAuth2Config()
        .withType(WebhookOAuth2Config.Type.OAUTH_2)
        .withTokenUrl(URI.create("http://localhost:" + serverPort + "/oauth/token"))
        .withClientId(clientId)
        .withClientSecret(clientSecret);
  }

  private static void sendResponse(HttpExchange exchange, int status, String body)
      throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream os = exchange.getResponseBody()) {
      os.write(bytes);
    }
  }

  private static Map<String, String> parseFormBody(HttpExchange exchange) throws IOException {
    String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    Map<String, String> params = new HashMap<>();
    for (String pair : body.split("&")) {
      String[] kv = pair.split("=", 2);
      if (kv.length == 2) {
        params.put(
            URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
            URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
      }
    }
    return params;
  }
}
