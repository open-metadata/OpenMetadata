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
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.service.util.OAuth2TokenManager;
import org.openmetadata.service.util.OAuth2TokenManager.OAuth2TokenException;

class OAuth2TokenManagerIT {

  private static HttpServer tokenServer;
  private static int serverPort;

  private static final Map<String, ClientBehavior> clientBehaviors = new ConcurrentHashMap<>();

  private final OAuth2TokenManager tokenManager = OAuth2TokenManager.getInstance();

  record ClientBehavior(int status, String body, AtomicInteger requestCount) {
    static ClientBehavior ok(String accessToken, int expiresIn) {
      return new ClientBehavior(
          200,
          String.format("{\"access_token\":\"%s\",\"expires_in\":%s}", accessToken, expiresIn),
          new AtomicInteger(0));
    }

    static ClientBehavior ok(String accessToken, String expiresIn) {
      return new ClientBehavior(
          200,
          String.format("{\"access_token\":\"%s\",\"expires_in\":\"%s\"}", accessToken, expiresIn),
          new AtomicInteger(0));
    }

    static ClientBehavior error(int status, String errorBody) {
      return new ClientBehavior(status, errorBody, new AtomicInteger(0));
    }

    static ClientBehavior bodyOnly(String body) {
      return new ClientBehavior(200, body, new AtomicInteger(0));
    }
  }

  @BeforeAll
  static void startServer() throws IOException {
    tokenServer = HttpServer.create(new InetSocketAddress(0), 0);
    serverPort = tokenServer.getAddress().getPort();

    tokenServer.createContext(
        "/oauth/token",
        exchange -> {
          String body =
              new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
          String clientId = extractFormParam(body, "client_id");

          ClientBehavior behavior = clientBehaviors.get(clientId);
          if (behavior == null) {
            sendResponse(exchange, 400, "{\"error\":\"unknown_client\"}");
            return;
          }

          behavior.requestCount().incrementAndGet();
          sendResponse(exchange, behavior.status(), behavior.body());
        });

    tokenServer.start();
  }

  @AfterAll
  static void stopServer() {
    if (tokenServer != null) {
      tokenServer.stop(0);
    }
  }

  @Test
  void getAccessToken_success_returnsToken() {
    String clientId = uniqueClientId();
    clientBehaviors.put(clientId, ClientBehavior.ok("tok123", 3600));

    WebhookOAuth2Config config = buildConfig(clientId);
    String token = tokenManager.getAccessToken(config);

    assertEquals("tok123", token);
    assertEquals(1, clientBehaviors.get(clientId).requestCount().get());
  }

  @Test
  void getAccessToken_cached_noSecondHttpCall() {
    String clientId = uniqueClientId();
    clientBehaviors.put(clientId, ClientBehavior.ok("cached-tok", 3600));

    WebhookOAuth2Config config = buildConfig(clientId);
    tokenManager.getAccessToken(config);
    String secondCall = tokenManager.getAccessToken(config);

    assertEquals("cached-tok", secondCall);
    assertEquals(1, clientBehaviors.get(clientId).requestCount().get());
  }

  @Test
  void getAccessToken_expired_fetchesNewToken() {
    String clientId = uniqueClientId();
    clientBehaviors.put(clientId, ClientBehavior.ok("tok1", 30));

    WebhookOAuth2Config config = buildConfig(clientId);
    String first = tokenManager.getAccessToken(config);
    assertEquals("tok1", first);

    // expires_in=30 minus 30s buffer = already expired, next call refetches
    clientBehaviors.put(clientId, ClientBehavior.ok("tok2", 3600));
    String second = tokenManager.getAccessToken(config);
    assertEquals("tok2", second);
  }

  @Test
  void invalidateToken_forcesRefetch() {
    String clientId = uniqueClientId();
    AtomicInteger totalRequests = new AtomicInteger(0);
    clientBehaviors.put(clientId, ClientBehavior.ok("tok-before", 3600));

    WebhookOAuth2Config config = buildConfig(clientId);
    assertEquals("tok-before", tokenManager.getAccessToken(config));
    totalRequests.addAndGet(clientBehaviors.get(clientId).requestCount().get());

    tokenManager.invalidateToken(config);

    clientBehaviors.put(clientId, ClientBehavior.ok("tok-after", 3600));
    assertEquals("tok-after", tokenManager.getAccessToken(config));
    totalRequests.addAndGet(clientBehaviors.get(clientId).requestCount().get());
    assertEquals(2, totalRequests.get());
  }

  @Test
  void getAccessToken_httpError_throwsException() {
    String clientId = uniqueClientId();
    clientBehaviors.put(clientId, ClientBehavior.error(400, "{\"error\":\"invalid_request\"}"));

    WebhookOAuth2Config config = buildConfig(clientId);

    OAuth2TokenException ex =
        assertThrows(OAuth2TokenException.class, () -> tokenManager.getAccessToken(config));
    assertTrue(ex.getMessage().contains("HTTP 400"));
  }

  @Test
  void getAccessToken_missingAccessToken_throwsException() {
    String clientId = uniqueClientId();
    clientBehaviors.put(clientId, ClientBehavior.bodyOnly("{\"token_type\":\"bearer\"}"));

    WebhookOAuth2Config config = buildConfig(clientId);

    OAuth2TokenException ex =
        assertThrows(OAuth2TokenException.class, () -> tokenManager.getAccessToken(config));
    assertTrue(ex.getMessage().contains("access_token"));
  }

  @Test
  void getAccessToken_expiresInAsString_parsesCorrectly() {
    String clientId = uniqueClientId();
    clientBehaviors.put(clientId, ClientBehavior.ok("str-tok", "7200"));

    String token = tokenManager.getAccessToken(buildConfig(clientId));

    assertEquals("str-tok", token);
  }

  @Test
  void getAccessToken_differentConfigs_separateCacheEntries() {
    String clientIdA = uniqueClientId();
    String clientIdB = uniqueClientId();
    clientBehaviors.put(clientIdA, ClientBehavior.ok("tok-a", 3600));
    clientBehaviors.put(clientIdB, ClientBehavior.ok("tok-b", 3600));

    String tokenA = tokenManager.getAccessToken(buildConfig(clientIdA));
    String tokenB = tokenManager.getAccessToken(buildConfig(clientIdB));

    assertEquals("tok-a", tokenA);
    assertEquals("tok-b", tokenB);
    assertNotEquals(tokenA, tokenB);
    assertEquals(1, clientBehaviors.get(clientIdA).requestCount().get());
    assertEquals(1, clientBehaviors.get(clientIdB).requestCount().get());
  }

  private static String uniqueClientId() {
    return "test-client-" + UUID.randomUUID();
  }

  private WebhookOAuth2Config buildConfig(String clientId) {
    return new WebhookOAuth2Config()
        .withType(WebhookOAuth2Config.Type.OAUTH_2)
        .withTokenUrl(URI.create("http://localhost:" + serverPort + "/oauth/token"))
        .withClientId(clientId)
        .withClientSecret("secret");
  }

  private static String extractFormParam(String body, String param) {
    for (String pair : body.split("&")) {
      String[] kv = pair.split("=", 2);
      if (kv.length == 2 && kv[0].equals(param)) {
        return java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
      }
    }
    return "";
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
}
