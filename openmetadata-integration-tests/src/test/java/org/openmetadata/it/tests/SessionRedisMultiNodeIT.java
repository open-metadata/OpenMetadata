/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
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
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SessionMultiNodeCluster;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Multi-node session lifecycle assertions when SessionService is routed to Redis (cache.provider
 * = redis). Mirrors the scenarios in {@link SessionMultiNodeIT} but asserts entirely through
 * HTTP — the {@code user_session} table is empty in this mode and Redis state is opaque to the
 * test harness.
 *
 * <p>Adds Redis-specific scenarios on top of the shared multi-node contract:
 *
 * <ul>
 *   <li>Revocation issued on node B is visible on node A within one HTTP round-trip (no 60s
 *       Caffeine cache lag — the JDBC path's mitigation is to reload from the store; we verify
 *       the Redis path matches that behavior).
 *   <li>CAS contention from two pods refreshing the same session simultaneously — exactly one
 *       wins and gets a fresh access token; the other should see HTTP 503 (refresh-in-progress)
 *       or HTTP 200 against the rotated session, never an inconsistent state.
 * </ul>
 */
@Tag("session")
@ExtendWith(TestNamespaceExtension.class)
@EnabledIf(value = "org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
class SessionRedisMultiNodeIT {

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
  void revocationOnOneNodeIsImmediatelyVisibleOnOther(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();

    login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));

    // First refresh on A primes A's session cache. With the Caffeine + Redis combo, the cache
    // would normally hold the entry for ~10s — long enough to mask a logout from another pod.
    JsonNode firstRefresh =
        post(client, cookies, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(firstRefresh.get("accessToken"));

    // Logout from B — Redis row deleted immediately.
    HttpResponse<String> logout =
        postRaw(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/logout", null);
    assertEquals(200, logout.statusCode());

    // Next request to A must see the revocation despite the Caffeine cache. SessionService
    // reloads from the store on getActiveSession to avoid the cache-lag race.
    HttpResponse<String> refreshAfterLogout =
        postRaw(client, cookies, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertEquals(401, refreshAfterLogout.statusCode());
  }

  @Test
  void simultaneousRefreshFromTwoNodesResolvesConsistently(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    SessionCookies cookies = new SessionCookies();
    HttpClient client = HttpClient.newHttpClient();
    login(client, cookies, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));

    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      Future<HttpResponse<String>> a =
          pool.submit(
              () ->
                  postRaw(client, cookies, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null));
      Future<HttpResponse<String>> b =
          pool.submit(
              () ->
                  postRaw(client, cookies, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null));
      HttpResponse<String> respA = a.get(15, TimeUnit.SECONDS);
      HttpResponse<String> respB = b.get(15, TimeUnit.SECONDS);

      // Exactly one should return 200 with a fresh access token. The other is allowed to be 200
      // (won the CAS retry) or 503 (saw the in-progress lease) — anything else (e.g. 500, 401)
      // means the CAS pathway is broken.
      assertTrue(
          isOkOrInProgress(respA),
          "Unexpected status from node A: " + respA.statusCode() + " body=" + respA.body());
      assertTrue(
          isOkOrInProgress(respB),
          "Unexpected status from node B: " + respB.statusCode() + " body=" + respB.body());
      assertTrue(
          respA.statusCode() == 200 || respB.statusCode() == 200,
          "At least one concurrent refresh must succeed");
    } catch (ExecutionException ee) {
      throw new AssertionError("Concurrent refresh threw", ee.getCause());
    } finally {
      pool.shutdownNow();
    }

    // After the dust settles a follow-up refresh must succeed cleanly.
    JsonNode finalRefresh =
        post(client, cookies, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(finalRefresh.get("accessToken"));
  }

  @Test
  void multipleBrowsersOnOneUserStayIsolatedAcrossNodes(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User user = createUser(ns);

    HttpClient client = HttpClient.newHttpClient();
    SessionCookies firstBrowser = new SessionCookies();
    SessionCookies secondBrowser = new SessionCookies();

    login(client, firstBrowser, cluster.nodeABaseUrl(), user.getEmail(), passwordFor(ns));
    login(client, secondBrowser, cluster.nodeBBaseUrl(), user.getEmail(), passwordFor(ns));

    assertNotEquals(firstBrowser.get("OM_SESSION"), secondBrowser.get("OM_SESSION"));

    HttpResponse<String> logoutResponse =
        postRaw(client, firstBrowser, cluster.nodeBBaseUrl() + "/api/v1/auth/logout", null);
    assertEquals(200, logoutResponse.statusCode());

    HttpResponse<String> revokedRefresh =
        postRaw(client, firstBrowser, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertEquals(401, revokedRefresh.statusCode());

    JsonNode activeRefresh =
        post(client, secondBrowser, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(activeRefresh.get("accessToken"));
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

    SessionCookies lastBrowser = new SessionCookies();
    for (int i = 0; i < 5; i++) {
      lastBrowser = new SessionCookies();
      String baseUrl = (i % 2 == 0) ? cluster.nodeBBaseUrl() : cluster.nodeABaseUrl();
      login(client, lastBrowser, baseUrl, user.getEmail(), passwordFor(ns));
    }

    HttpResponse<String> evictedRefresh =
        postRaw(client, firstBrowser, cluster.nodeBBaseUrl() + "/api/v1/auth/refresh", null);
    assertEquals(401, evictedRefresh.statusCode(), evictedRefresh.body());

    HttpResponse<String> evictedApi =
        getRawWithBearer(client, firstToken, cluster.nodeABaseUrl() + "/api/v1/users/loggedInUser");
    assertEquals(401, evictedApi.statusCode(), evictedApi.body());

    JsonNode survivorRefresh =
        post(client, lastBrowser, cluster.nodeABaseUrl() + "/api/v1/auth/refresh", null);
    assertNotNull(survivorRefresh.get("accessToken"));
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

  private static boolean isOkOrInProgress(HttpResponse<String> response) {
    return response.statusCode() == 200 || response.statusCode() == 503;
  }

  private User createUser(TestNamespace ns) {
    String username = ns.shortPrefix("session-redis-user");
    String password = passwordFor(ns);
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(username)
                .withEmail(username + "@example.com")
                .withDisplayName("Session Redis User " + username)
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
