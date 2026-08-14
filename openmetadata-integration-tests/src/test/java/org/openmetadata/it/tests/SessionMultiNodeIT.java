package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SessionMultiNodeCluster;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

@Tag("session")
@ExtendWith(TestNamespaceExtension.class)
// Gated to DB-backed sessions. The assertions here read directly from the user_session table
// (sessionCountForUser, loadSession, persistSession), which produce no rows when SessionService
// is routed to Redis by SessionStoreFactory. SessionRedisMultiNodeIT covers the same scenarios
// against Redis through HTTP-only checks.
@org.junit.jupiter.api.condition.DisabledIf(
    value = "org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled",
    disabledReason = "Sessions live in Redis on this profile; see SessionRedisMultiNodeIT")
class SessionMultiNodeIT {

  @Test
  void refreshAndLogoutAreSharedAcrossNodes(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    JsonNode loginResponse =
        login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    assertNotNull(loginResponse.get("accessToken"));
    assertFalse(cookies.get("OM_SESSION").isBlank());

    JsonNode refreshResponse =
        post(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(refreshResponse.get("accessToken"));

    HttpResponse<String> logoutResponse =
        postRaw(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/logout", null);
    assertEquals(200, logoutResponse.statusCode());

    HttpResponse<String> refreshAfterLogout =
        postRaw(client, cookies, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertEquals(401, refreshAfterLogout.statusCode());

    List<String> statuses =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT status FROM user_session WHERE userId = :userId")
                        .bind("userId", user.getId().toString())
                        .mapTo(String.class)
                        .list());
    assertTrue(statuses.contains("REVOKED"));
  }

  @Test
  void refreshOnAnotherNodeReusesTheSameSessionRow(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    String sessionId = cookies.get("OM_SESSION");

    JsonNode refreshResponse =
        post(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(refreshResponse.get("accessToken"));

    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    long sessionCount =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM user_session WHERE userId = :userId")
                    .bind("userId", user.getId().toString())
                    .mapTo(Long.class)
                    .one());
    assertEquals(1L, sessionCount);

    String persistedSessionId =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT id FROM user_session WHERE userId = :userId")
                    .bind("userId", user.getId().toString())
                    .mapTo(String.class)
                    .one());
    assertEquals(sessionId, persistedSessionId);
  }

  @Test
  void sequentialRefreshSucceedsOnBothNodesWithTokenAndCookie(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    JsonNode loginResponse =
        login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    String sessionId = cookies.get("OM_SESSION");
    String tokenFromLogin = loginResponse.get("accessToken").asText();

    HttpResponse<String> refreshOnA =
        postRawWithBearer(
            client, cookies, tokenFromLogin, cluster.nodeABaseUrl() + "/api/v1/auth/refresh");
    assertEquals(200, refreshOnA.statusCode(), refreshOnA.body());
    String tokenFromA = JsonUtils.readTree(refreshOnA.body()).get("accessToken").asText();
    assertEquals(sessionId, cookies.get("OM_SESSION"));

    HttpResponse<String> refreshOnB =
        postRawWithBearer(
            client, cookies, tokenFromA, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh");
    assertEquals(200, refreshOnB.statusCode(), refreshOnB.body());
    assertNotNull(JsonUtils.readTree(refreshOnB.body()).get("accessToken"));
    assertEquals(sessionId, cookies.get("OM_SESSION"));

    assertEquals(1L, sessionCountForUser(user));
    UserSession persisted = loadSession(sessionId);
    assertEquals(SessionStatus.ACTIVE, persisted.getStatus());
    assertTrue(safeVersion(persisted) >= 2L, "Each cross-node refresh must bump the CAS version");
  }

  @Test
  void sessionBoundTokenIssuedOnOneNodeIsHonoredAndRevokedOnOther(TestNamespace ns)
      throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    JsonNode loginResponse =
        login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    String accessToken = loginResponse.get("accessToken").asText();

    HttpResponse<String> meOnB =
        getRawWithBearer(
            client, accessToken, cluster.nodeBBaseUrl() + "/api/v1/users/loggedInUser");
    assertEquals(200, meOnB.statusCode(), meOnB.body());
    assertEquals(user.getId().toString(), JsonUtils.readTree(meOnB.body()).get("id").asText());

    HttpResponse<String> logout =
        postRaw(client, cookies, cluster.nodeABaseUrl() + "/api/v1/auth/logout", null);
    assertEquals(200, logout.statusCode());

    HttpResponse<String> meOnBAfterLogout =
        getRawWithBearer(
            client, accessToken, cluster.nodeBBaseUrl() + "/api/v1/users/loggedInUser");
    assertEquals(401, meOnBAfterLogout.statusCode(), meOnBAfterLogout.body());
  }

  @Test
  void refreshReturnsRetryAfterWhenLeaseIsHeldAcrossNodes(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    UserSession currentSession = loadSession(cookies.get("OM_SESSION"));
    persistSession(
        currentSession.toBuilder()
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(System.currentTimeMillis() + 10_000)
            .updatedAt(System.currentTimeMillis())
            .version(safeVersion(currentSession) + 1)
            .build());

    HttpResponse<String> response =
        postRaw(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null);

    assertEquals(503, response.statusCode());
    assertTrue(response.headers().firstValue("Retry-After").isPresent());
    assertEquals(
        "Session refresh already in progress",
        JsonUtils.readTree(response.body()).get("error").asText());
  }

  @Test
  void refreshRecoversStaleLeaseAcrossNodes(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    UserSession currentSession = loadSession(cookies.get("OM_SESSION"));
    persistSession(
        currentSession.toBuilder()
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(System.currentTimeMillis() - 1_000)
            .updatedAt(System.currentTimeMillis())
            .version(safeVersion(currentSession) + 1)
            .build());

    JsonNode refreshResponse =
        post(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null);

    assertNotNull(refreshResponse.get("accessToken"));
    assertEquals(SessionStatus.ACTIVE, loadSession(cookies.get("OM_SESSION")).getStatus());
  }

  @Test
  void multipleSessionsRemainIsolatedAcrossNodes(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    HttpClient client = HttpClient.newHttpClient();
    SessionCookies firstBrowser = new SessionCookies();
    SessionCookies secondBrowser = new SessionCookies();

    login(client, firstBrowser, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    login(client, secondBrowser, cluster.nodeBBaseUrl(), user.getEmail(), passwordFor(ns));

    assertNotEquals(firstBrowser.get("OM_SESSION"), secondBrowser.get("OM_SESSION"));
    assertEquals(2L, sessionCountForUser(user));

    HttpResponse<String> logoutResponse =
        postRaw(client, firstBrowser, cluster.nodeBBaseUrl() + "/api/v1/auth/logout", null);
    assertEquals(200, logoutResponse.statusCode());

    HttpResponse<String> revokedRefresh =
        postRaw(client, firstBrowser, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertEquals(401, revokedRefresh.statusCode());

    JsonNode activeRefresh =
        post(client, secondBrowser, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(activeRefresh.get("accessToken"));

    List<String> statuses =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT status FROM user_session WHERE userId = :userId")
                        .bind("userId", user.getId().toString())
                        .mapTo(String.class)
                        .list());
    assertEquals(1L, statuses.stream().filter("ACTIVE"::equals).count());
    assertEquals(1L, statuses.stream().filter("REVOKED"::equals).count());
  }

  @Test
  void expiredSessionIsRejectedForRefreshAndApiAcrossNodes(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    JsonNode loginResponse =
        login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    String accessToken = loginResponse.get("accessToken").asText();
    String sessionId = cookies.get("OM_SESSION");

    UserSession current = loadSession(sessionId);
    long past = System.currentTimeMillis() - 60_000L;
    persistSession(
        current.toBuilder()
            .expiresAt(past)
            .idleExpiresAt(past)
            .updatedAt(System.currentTimeMillis())
            .version(safeVersion(current) + 1)
            .build());

    HttpResponse<String> refreshOnB =
        postRawWithBearer(
            client, cookies, accessToken, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh");
    assertEquals(401, refreshOnB.statusCode(), refreshOnB.body());

    HttpResponse<String> apiOnB =
        getRawWithBearer(
            client, accessToken, cluster.nodeBBaseUrl() + "/api/v1/users/loggedInUser");
    assertEquals(401, apiOnB.statusCode(), apiOnB.body());
  }

  @Test
  void sessionLimitEvictsLeastRecentlyUsedAcrossNodes(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);
    HttpClient client = HttpClient.newHttpClient();

    SessionCookies firstBrowser = new SessionCookies();
    JsonNode firstLogin =
        login(client, firstBrowser, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    String firstToken = firstLogin.get("accessToken").asText();

    for (int i = 0; i < 5; i++) {
      SessionCookies extra = new SessionCookies();
      String baseUrl = (i % 2 == 0) ? cluster.nodeBBaseUrl() : cluster.nodeABaseUrl();
      login(client, extra, baseUrl, user.getEmail(), passwordFor(ns));
    }

    HttpResponse<String> evictedRefresh =
        postRaw(client, firstBrowser, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null);
    assertEquals(401, evictedRefresh.statusCode(), evictedRefresh.body());

    HttpResponse<String> evictedApi =
        getRawWithBearer(client, firstToken, cluster.nodeABaseUrl() + "/api/v1/users/loggedInUser");
    assertEquals(401, evictedApi.statusCode(), evictedApi.body());

    assertEquals(5L, sessionStatusCount(user, SessionStatus.ACTIVE));
    assertTrue(sessionStatusCount(user, SessionStatus.REVOKED) >= 1L);
  }

  @Test
  void tokenIssuedBeforeRefreshStaysValidUnderSameSession(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    JsonNode loginResponse =
        login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    String preRefreshToken = loginResponse.get("accessToken").asText();

    JsonNode refreshOnB =
        post(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(refreshOnB.get("accessToken"));

    HttpResponse<String> apiOnA =
        getRawWithBearer(
            client, preRefreshToken, cluster.nodeABaseUrl() + "/api/v1/users/loggedInUser");
    assertEquals(200, apiOnA.statusCode(), apiOnA.body());
  }

  private long sessionStatusCount(User user, SessionStatus status) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM user_session WHERE userId = :userId AND status = :status")
                    .bind("userId", user.getId().toString())
                    .bind("status", status.name())
                    .mapTo(Long.class)
                    .one());
  }

  private User createUser(TestNamespace ns) {
    String username = ns.shortPrefix("session-user");
    String password = passwordFor(ns);
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(username)
                .withEmail(username + "@example.com")
                .withDisplayName("Session User " + username)
                .withPassword(password)
                .withConfirmPassword(password)
                .withCreatePasswordType(CreateUser.CreatePasswordType.ADMIN_CREATE)
                .withIsBot(false));
  }

  private String passwordFor(TestNamespace ns) {
    return "Str0ng!" + ns.shortPrefix();
  }

  private JsonNode login(
      HttpClient client, SessionCookies cookies, String baseUrl, String email, String password)
      throws Exception {
    LoginRequest loginRequest =
        new LoginRequest()
            .withEmail(email)
            .withPassword(
                Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8)));
    return post(
        client, cookies, baseUrl + "/api/v1/auth/login", JsonUtils.pojoToJson(loginRequest));
  }

  private JsonNode post(HttpClient client, SessionCookies cookies, String url, String body)
      throws Exception {
    HttpResponse<String> response = postRaw(client, cookies, url, body);
    assertEquals(200, response.statusCode(), response.body());
    return JsonUtils.readTree(response.body());
  }

  private HttpResponse<String> postRaw(
      HttpClient client, SessionCookies cookies, String url, String body) throws Exception {
    HttpRequest.Builder requestBuilder =
        HttpRequest.newBuilder(URI.create(url)).header("Content-Type", "application/json");
    if (!cookies.isEmpty()) {
      requestBuilder.header("Cookie", cookies.asHeaderValue());
    }
    if (body == null) {
      requestBuilder.POST(HttpRequest.BodyPublishers.noBody());
    } else {
      requestBuilder.POST(HttpRequest.BodyPublishers.ofString(body));
    }
    HttpResponse<String> response =
        client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
    cookies.capture(response);
    return response;
  }

  private HttpResponse<String> postRawWithBearer(
      HttpClient client, SessionCookies cookies, String bearerToken, String url) throws Exception {
    HttpRequest.Builder requestBuilder =
        HttpRequest.newBuilder(URI.create(url))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + bearerToken)
            .POST(HttpRequest.BodyPublishers.noBody());
    if (!cookies.isEmpty()) {
      requestBuilder.header("Cookie", cookies.asHeaderValue());
    }
    HttpResponse<String> response =
        client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
    cookies.capture(response);
    return response;
  }

  private HttpResponse<String> getRawWithBearer(HttpClient client, String bearerToken, String url)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(url))
            .header("Authorization", "Bearer " + bearerToken)
            .GET()
            .build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private UserSession loadSession(String sessionId) {
    String json =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM user_session WHERE id = :id")
                        .bind("id", sessionId)
                        .mapTo(String.class)
                        .one());
    return JsonUtils.readValue(json, UserSession.class);
  }

  private void persistSession(UserSession session) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              String sql =
                  isPostgres(handle)
                      ? "UPDATE user_session SET json = CAST(:json AS jsonb) WHERE id = :id"
                      : "UPDATE user_session SET json = CAST(:json AS JSON) WHERE id = :id";
              handle
                  .createUpdate(sql)
                  .bind("id", session.getId())
                  .bind("json", JsonUtils.pojoToJson(session))
                  .execute();
            });
  }

  private long sessionCountForUser(User user) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM user_session WHERE userId = :userId")
                    .bind("userId", user.getId().toString())
                    .mapTo(Long.class)
                    .one());
  }

  private boolean isPostgres(org.jdbi.v3.core.Handle handle) {
    try {
      return handle
          .getConnection()
          .getMetaData()
          .getDatabaseProductName()
          .toLowerCase()
          .contains("postgres");
    } catch (SQLException e) {
      throw new IllegalStateException("Failed to determine database type", e);
    }
  }

  private long safeVersion(UserSession session) {
    return session.getVersion() == null ? 0L : session.getVersion();
  }

  private static final class SessionCookies {
    private final Map<String, String> values = new LinkedHashMap<>();

    private void capture(HttpResponse<?> response) {
      response.headers().allValues("set-cookie").forEach(this::captureSetCookie);
    }

    private void captureSetCookie(String header) {
      int separator = header.indexOf(';');
      String pair = separator >= 0 ? header.substring(0, separator) : header;
      int equalsIndex = pair.indexOf('=');
      if (equalsIndex <= 0) {
        return;
      }
      String name = pair.substring(0, equalsIndex).trim();
      if (name.isEmpty() || name.startsWith("$")) {
        return;
      }
      values.put(name, pair.substring(equalsIndex + 1));
    }

    private String get(String name) {
      String value = values.get(name);
      if (value == null) {
        throw new AssertionError(name + " cookie not found");
      }
      return value;
    }

    private boolean isEmpty() {
      return values.isEmpty();
    }

    private String asHeaderValue() {
      return values.entrySet().stream()
          .map(entry -> entry.getKey() + "=" + entry.getValue())
          .collect(Collectors.joining("; "));
    }
  }
}
