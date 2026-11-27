/*
 *  Copyright 2026 Collate
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
package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.auth0.jwt.JWT;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.CredentialFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.schema.entity.teams.User;

/**
 * An access token the MCP OAuth server mints names {@code /mcp} in {@code aud} (RFC 8707): it is
 * accepted there and refused by the REST API and the push-feed handshake. Tokens OpenMetadata signs
 * without {@code aud} keep working on all three.
 * ADR:2026-11-25-mcp-oauth-binds-tokens-to-the-canonical-resource
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class McpTokenAudienceIT extends McpTestBase {
  private static final String PUSH_FEED_HANDSHAKE = "/api/v1/push/feed/?EIO=4&transport=polling";
  private static final String ISSUED_FOR_ANOTHER_RESOURCE =
      "Token was issued for another resource.";

  @Test
  void anMcpAccessTokenIsAcceptedAtMcpAndRefusedByRestAndThePushFeed(TestNamespace ns)
      throws Exception {
    User user = null;
    try {
      user = CredentialFixtures.createUser(ns, "mcpaud");
      String accessToken = mcpAccessTokenFor(user, ns);
      assertThat(JWT.decode(accessToken).getAudience()).containsExactly(protectedResource());

      assertThat(CredentialFixtures.mcpInitialize(accessToken).statusCode()).isEqualTo(200);

      HttpResponse<String> rest =
          CredentialFixtures.get(CredentialFixtures.LOGGED_IN_USER, accessToken);
      assertThat(rest.statusCode()).as(rest.body()).isEqualTo(401);
      assertThat(rest.body()).contains(ISSUED_FOR_ANOTHER_RESOURCE);

      assertThat(pushFeedHandshakeWithHeader(accessToken).statusCode()).isEqualTo(401);
      assertThat(pushFeedHandshakeWithQueryToken(accessToken).statusCode()).isEqualTo(401);
    } finally {
      hardDeleteIfCreated(user);
    }
  }

  /** Login tokens, bot tokens and personal access tokens carry no {@code aud}: as before. */
  @Test
  void tokensWithoutAnAudienceStillWorkOnRestThePushFeedAndMcp(TestNamespace ns) throws Exception {
    User user = null;
    User bot = null;
    try {
      user = CredentialFixtures.createUser(ns, "noaud");
      bot = CredentialFixtures.createBot(ns, "noaudbot");
      List<String> unboundTokens =
          List.of(
              CredentialFixtures.loginToken(user),
              CredentialFixtures.botToken(bot),
              CredentialFixtures.createPat(user, ns.prefix("pat")).getJwtToken());

      for (String token : unboundTokens) {
        assertThat(JWT.decode(token).getClaim("aud").isMissing()).isTrue();
        HttpResponse<String> rest =
            CredentialFixtures.get(CredentialFixtures.LOGGED_IN_USER, token);
        assertThat(rest.statusCode()).as(rest.body()).isEqualTo(200);
        HttpResponse<String> handshake = pushFeedHandshakeWithHeader(token);
        assertThat(handshake.statusCode()).as(handshake.body()).isEqualTo(200);
        assertThat(CredentialFixtures.mcpInitialize(token).statusCode()).isEqualTo(200);
      }
    } finally {
      hardDeleteIfCreated(bot);
      hardDeleteIfCreated(user);
    }
  }

  /**
   * Signs {@code user} in the way an MCP client keeps a session going: a refresh grant on {@code
   * /mcp/token} mints the access token, as it does after every sign-in.
   */
  private String mcpAccessTokenFor(User user, TestNamespace ns) throws Exception {
    JsonNode client = registerClient(ns);
    String clientId = client.get("client_id").asText();
    String refreshToken = UUID.randomUUID().toString();
    long expiresAt = System.currentTimeMillis() + Duration.ofHours(1).toMillis();
    new OAuthTokenRepository()
        .storeRefreshToken(
            new RefreshToken(refreshToken, clientId, List.of(), expiresAt),
            clientId,
            user.getName(),
            List.of());
    String form =
        "grant_type=refresh_token&refresh_token="
            + refreshToken
            + "&client_id="
            + clientId
            + "&client_secret="
            + client.get("client_secret").asText();
    HttpResponse<String> granted =
        send(post("/mcp/token", "application/x-www-form-urlencoded", form));
    assertThat(granted.statusCode()).as(granted.body()).isEqualTo(200);
    return OBJECT_MAPPER.readTree(granted.body()).get("access_token").asText();
  }

  private JsonNode registerClient(TestNamespace ns) throws Exception {
    String registration =
        OBJECT_MAPPER.writeValueAsString(
            Map.of(
                "client_name", ns.prefix("audience-client"),
                "redirect_uris", List.of("http://127.0.0.1:9090/callback"),
                "grant_types", List.of("authorization_code", "refresh_token"),
                "response_types", List.of("code"),
                "token_endpoint_auth_method", "client_secret_post"));
    HttpResponse<String> registered = send(post("/mcp/register", "application/json", registration));
    assertThat(registered.statusCode()).as(registered.body()).isEqualTo(201);
    return OBJECT_MAPPER.readTree(registered.body());
  }

  private String protectedResource() throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(getMcpUrl("/mcp/.well-known/oauth-protected-resource")))
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    return OBJECT_MAPPER.readTree(send(request).body()).get("resource").asText();
  }

  private static HttpResponse<String> pushFeedHandshakeWithHeader(String token) throws Exception {
    return send(
        HttpRequest.newBuilder(URI.create(TestSuiteBootstrap.getBaseUrl() + PUSH_FEED_HANDSHAKE))
            .header("Authorization", "Bearer " + token)
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build());
  }

  /** Browsers cannot set headers on a WebSocket upgrade, so the UI may pass the token this way. */
  private static HttpResponse<String> pushFeedHandshakeWithQueryToken(String token)
      throws Exception {
    String url =
        TestSuiteBootstrap.getBaseUrl()
            + PUSH_FEED_HANDSHAKE
            + "&token="
            + URLEncoder.encode(token, StandardCharsets.UTF_8);
    return send(
        HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30)).GET().build());
  }

  private HttpRequest post(String path, String contentType, String body) {
    return HttpRequest.newBuilder(URI.create(getMcpUrl(path)))
        .header("Content-Type", contentType)
        .timeout(Duration.ofSeconds(30))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
  }

  private static HttpResponse<String> send(HttpRequest request) throws Exception {
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static void hardDeleteIfCreated(User user) {
    if (user != null) {
      SdkClients.adminClient()
          .users()
          .delete(user.getId().toString(), Map.of("hardDelete", "true"));
    }
  }
}
