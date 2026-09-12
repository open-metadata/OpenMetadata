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
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.SessionMultiNodeCluster;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Bot tokens and personal access tokens are validated against per-pod caches (2-minute TTL). A
 * revocation on one pod reaches the others only through the Redis cache-invalidation channel, so
 * these scenarios need two nodes sharing a Redis: node B is primed with the token, node A revokes
 * it, and node B must reject it on the very next request — not after the TTL.
 *
 * <p>Gated to the Redis profile: without pub/sub the JDBC deployment has no cross-pod channel and
 * the other pod is only guaranteed to catch up when its cache entry expires.
 */
@ExtendWith(TestNamespaceExtension.class)
@EnabledIf(value = "org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
class TokenRevocationRedisMultiNodeIT {
  private static final String LOGGED_IN_USER = "/api/v1/users/loggedInUser";
  private static final long USER_TOKEN_TTL_SECONDS = 3600;
  private final HttpClient client = HttpClient.newHttpClient();

  @Test
  void botTokenRevokedOnOneNodeIsRejectedByTheOtherOnTheNextRequest(TestNamespace ns)
      throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User bot = createBot(ns);
    String botToken = generateBotToken(cluster.nodeABaseUrl(), bot, JWTTokenExpiry.Seven);
    assertOk(get(cluster.nodeBBaseUrl() + LOGGED_IN_USER, botToken)); // primes node B's cache

    assertOk(
        put(
            cluster.nodeABaseUrl() + "/api/v1/users/revokeToken",
            SdkClients.getAdminToken(),
            "{\"id\":\"" + bot.getId() + "\"}"));

    assertUnauthorized(get(cluster.nodeBBaseUrl() + LOGGED_IN_USER, botToken));
  }

  @Test
  void botTokenRotatedOnOneNodeInvalidatesTheOldTokenOnTheOther(TestNamespace ns) throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User bot = createBot(ns);
    String firstToken = generateBotToken(cluster.nodeABaseUrl(), bot, JWTTokenExpiry.Seven);
    assertOk(get(cluster.nodeBBaseUrl() + LOGGED_IN_USER, firstToken));

    // A different expiry keeps the second token distinct even when minted within the same second
    // (JWT timestamps have second precision, so same claims + same second = same token).
    String secondToken = generateBotToken(cluster.nodeABaseUrl(), bot, JWTTokenExpiry.Thirty);
    assertNotEquals(firstToken, secondToken);

    assertUnauthorized(get(cluster.nodeBBaseUrl() + LOGGED_IN_USER, firstToken));
    assertOk(get(cluster.nodeBBaseUrl() + LOGGED_IN_USER, secondToken));
  }

  @Test
  void personalAccessTokenRevokedOnOneNodeIsRejectedByTheOtherOnTheNextRequest(TestNamespace ns)
      throws Exception {
    SessionMultiNodeCluster cluster = SessionMultiNodeCluster.getInstance();
    User owner = createUser(ns);
    String ownerToken =
        JwtAuthProvider.tokenFor(
            owner.getEmail(), owner.getEmail(), new String[] {}, USER_TOKEN_TTL_SECONDS);
    HttpResponse<String> created =
        put(
            cluster.nodeABaseUrl() + "/api/v1/users/security/token",
            ownerToken,
            "{\"tokenName\":\"" + ns.prefix("pat") + "\",\"JWTTokenExpiry\":\"OneHour\"}");
    assertOk(created);
    PersonalAccessToken pat = JsonUtils.readValue(created.body(), PersonalAccessToken.class);
    assertOk(get(cluster.nodeBBaseUrl() + LOGGED_IN_USER, pat.getJwtToken()));

    assertOk(
        put(
            cluster.nodeABaseUrl() + "/api/v1/users/security/token/revoke",
            ownerToken,
            "{\"tokenIds\":[\"" + pat.getToken() + "\"]}"));

    assertUnauthorized(get(cluster.nodeBBaseUrl() + LOGGED_IN_USER, pat.getJwtToken()));
  }

  /** The bot's name must equal its email local-part: that is how JwtFilter resolves and caches it. */
  private User createBot(TestNamespace ns) {
    String localPart = "revokebot" + ns.shortPrefix();
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(localPart)
                .withEmail(localPart + "@test.com")
                .withIsBot(true)
                .withAuthenticationMechanism(authMechanism));
  }

  private User createUser(TestNamespace ns) {
    String localPart = "patowner" + ns.shortPrefix();
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(localPart).withEmail(localPart + "@open-metadata.org"));
  }

  private String generateBotToken(String baseUrl, User bot, JWTTokenExpiry expiry)
      throws Exception {
    HttpResponse<String> response =
        put(
            baseUrl + "/api/v1/users/generateToken/" + bot.getId(),
            SdkClients.getAdminToken(),
            "{\"JWTTokenExpiry\":\"" + expiry.value() + "\"}");
    assertOk(response);
    return JsonUtils.readValue(response.body(), JWTAuthMechanism.class).getJWTToken();
  }

  private HttpResponse<String> get(String url, String bearerToken) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(url))
            .header("Authorization", "Bearer " + bearerToken)
            .GET()
            .build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> put(String url, String bearerToken, String body) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(url))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + bearerToken)
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static void assertOk(HttpResponse<String> response) {
    assertEquals(200, response.statusCode(), response.body());
  }

  private static void assertUnauthorized(HttpResponse<String> response) {
    assertEquals(401, response.statusCode(), response.body());
  }
}
