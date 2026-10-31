package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Execution(ExecutionMode.SAME_THREAD)
public class McpOAuthIT extends McpTestBase {

  private static String registeredClientId;
  private static String registeredClientSecret;

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
  }

  @Test
  @Order(1)
  void testWellKnownOAuthMetadata() throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/.well-known/oauth-authorization-server")))
            .header("Accept", "application/json")
            .GET()
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(200);

    JsonNode metadata = OBJECT_MAPPER.readTree(response.body());
    assertThat(metadata.has("issuer")).isTrue();
    assertThat(metadata.has("authorization_endpoint")).isTrue();
    assertThat(metadata.has("token_endpoint")).isTrue();
    assertThat(metadata.has("registration_endpoint")).isTrue();
    assertThat(metadata.has("revocation_endpoint")).isTrue();
    assertThat(metadata.has("response_types_supported")).isTrue();
    assertThat(metadata.has("grant_types_supported")).isTrue();
    assertThat(metadata.has("code_challenge_methods_supported")).isTrue();

    assertThat(metadata.get("response_types_supported").toString()).contains("code");
    assertThat(metadata.get("code_challenge_methods_supported").toString()).contains("S256");
  }

  @Test
  @Order(1)
  void testOpenIdConfigurationAppendedToIssuer_servesOpenIdDiscoveryMetadata() throws Exception {
    JsonNode openIdConfiguration = getJson("/mcp/.well-known/openid-configuration");

    assertThat(openIdConfiguration)
        .isEqualTo(getJson("/mcp/.well-known/oauth-authorization-server"));
    // Required by OpenID Connect Discovery; the TypeScript MCP SDK rejects the document without
    // them
    assertThat(openIdConfiguration.get("jwks_uri").asText()).endsWith("/api/v1/system/config/jwks");
    assertThat(openIdConfiguration.get("subject_types_supported").toString()).contains("public");
    assertThat(openIdConfiguration.has("id_token_signing_alg_values_supported")).isTrue();
  }

  private JsonNode getJson(String path) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl(path)))
            .header("Accept", "application/json")
            .GET()
            .timeout(Duration.ofSeconds(30))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).isEqualTo(200);
    return OBJECT_MAPPER.readTree(response.body());
  }

  @Test
  @Order(2)
  void testWellKnownProtectedResourceMetadata() throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/.well-known/oauth-protected-resource")))
            .header("Accept", "application/json")
            .GET()
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(200);

    JsonNode metadata = OBJECT_MAPPER.readTree(response.body());
    assertThat(metadata.has("resource")).isTrue();
    assertThat(metadata.has("authorization_servers")).isTrue();
    assertThat(metadata.has("resource_signing_alg_values_supported")).isFalse();
  }

  @Test
  @Order(3)
  void testDynamicClientRegistration() throws Exception {
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("client_name", "MCP IT Test Client");
    registrationRequest.put("redirect_uris", List.of("http://127.0.0.1:9090/callback"));
    registrationRequest.put("grant_types", List.of("authorization_code", "refresh_token"));
    registrationRequest.put("response_types", List.of("code"));
    registrationRequest.put("token_endpoint_auth_method", "client_secret_post");

    String body = OBJECT_MAPPER.writeValueAsString(registrationRequest);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/register")))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(201);

    JsonNode clientInfo = OBJECT_MAPPER.readTree(response.body());
    assertThat(clientInfo.has("client_id")).isTrue();
    assertThat(clientInfo.has("client_secret")).isTrue();
    assertThat(clientInfo.has("client_id_issued_at")).isTrue();
    assertThat(clientInfo.get("client_name").asText()).isEqualTo("MCP IT Test Client");

    registeredClientId = clientInfo.get("client_id").asText();
    registeredClientSecret = clientInfo.get("client_secret").asText();
  }

  @Test
  @Order(4)
  void testRegistrationMissingRedirectUris_returns400() throws Exception {
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("client_name", "Bad Client");

    String body = OBJECT_MAPPER.writeValueAsString(registrationRequest);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/register")))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(400);
  }

  @Test
  @Order(5)
  void testRegistrationBlockedScheme_returns400() throws Exception {
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("client_name", "Evil Client");
    registrationRequest.put("redirect_uris", List.of("javascript:alert(1)"));

    String body = OBJECT_MAPPER.writeValueAsString(registrationRequest);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/register")))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(400);
  }

  @Test
  @Order(6)
  void testAuthorizeMissingParams_returnsError() throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/authorize")))
            .header("Accept", "application/json")
            .GET()
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(400);
  }

  @Test
  @Order(7)
  void testTokenEndpoint_getMethod_returns404() throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/token")))
            .header("Accept", "application/json")
            .GET()
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    // Token endpoint only handles POST; GET falls through to 404
    assertThat(response.statusCode()).isEqualTo(404);
  }

  @Test
  @Order(8)
  void testTokenEndpoint_invalidGrantType_returns400() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");

    String formBody =
        "grant_type=client_credentials"
            + "&client_id="
            + registeredClientId
            + "&client_secret="
            + registeredClientSecret;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/token")))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(400);
  }

  @Test
  @Order(9)
  void testTokenEndpoint_missingGrantType_returns400() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");

    String formBody =
        "client_id=" + registeredClientId + "&client_secret=" + registeredClientSecret;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/token")))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(400);
  }

  @Test
  @Order(10)
  void testTokenEndpoint_unknownClient_returns401() throws Exception {
    String formBody = "grant_type=authorization_code&client_id=nonexistent&client_secret=fake";
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/token")))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(401);
  }

  @Test
  @Order(11)
  void testRevocationEndpoint_invalidToken_returns200() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");

    String formBody =
        "token=invalid-token&token_type_hint=access_token"
            + "&client_id="
            + registeredClientId
            + "&client_secret="
            + registeredClientSecret;

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/revoke")))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    // RFC 7009: revocation endpoint returns 200 even for invalid tokens
    assertThat(response.statusCode()).isEqualTo(200);
  }

  @Test
  @Order(12)
  void testMcpEndpointWithoutAuth_returns401() throws Exception {
    Map<String, Object> toolCall = McpTestUtils.createSearchMetadataToolCall("test", 5, "table");

    String requestBody = OBJECT_MAPPER.writeValueAsString(toolCall);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(401);
    // The unauthenticated POST /mcp is the first request an app-directory reviewer makes. It used
    // to answer with a serialized McpError - a RuntimeException - and shipped a 13.8 KB body with a
    // 60-frame stack trace naming our classes, the Jetty internals and the exact JRE build.
    assertThat(response.body())
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":null,"
                + "\"error\":{\"code\":-32001,\"message\":\"Missing bearer token\"}}");
    // RFC 6750 section 3: a request that presented no credentials gets no error parameter.
    assertThat(challengeOf(response)).startsWith("Bearer ").doesNotContain("error=");
  }

  @Test
  @Order(13)
  void testMcpEndpointWithInvalidToken_returns401() throws Exception {
    Map<String, Object> toolCall = McpTestUtils.createSearchMetadataToolCall("test", 5, "table");

    String requestBody = OBJECT_MAPPER.writeValueAsString(toolCall);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", "Bearer invalid-jwt-token")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    assertThat(response.statusCode()).isEqualTo(401);
    assertThat(response.body())
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":null,"
                + "\"error\":{\"code\":-32001,\"message\":\"Invalid or expired bearer token\"}}");
    // RFC 6750 section 3.1: a token was supplied and rejected, so the challenge says so.
    assertThat(challengeOf(response)).contains("error=\"invalid_token\"");
  }

  @Test
  @Order(14)
  void testRefresh_rotatedTokenKeepsTheEndOfTheGrant() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");
    long grantEnd = System.currentTimeMillis() + Duration.ofDays(5).toMillis();
    String refreshToken = seedRefreshToken(List.of(), grantEnd);

    HttpResponse<String> response = refresh(refreshToken);

    assertThat(response.statusCode()).isEqualTo(200);
    String rotated = OBJECT_MAPPER.readTree(response.body()).get("refresh_token").asText();
    assertThat(new OAuthTokenRepository().findRefreshToken(rotated).getExpiresAt())
        .isEqualTo(grantEnd);
  }

  @Test
  @Order(15)
  void testRefreshOfAGrantHoldingUnknownScopes_keepsOnlyTheKnownOnes() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");
    List<String> granted =
        Stream.concat(
                Stream.of("openid"), IntStream.range(0, 200).mapToObj(index -> "scope" + index))
            .toList();
    String refreshToken =
        seedRefreshToken(granted, System.currentTimeMillis() + Duration.ofDays(1).toMillis());

    HttpResponse<String> response = refresh(refreshToken);

    assertThat(response.statusCode()).isEqualTo(200);
    String rotated = OBJECT_MAPPER.readTree(response.body()).get("refresh_token").asText();
    assertThat(new OAuthTokenRepository().findRefreshToken(rotated).getScopes())
        .containsExactly("openid");
  }

  /** A revoked access token is refused on the next call; clients often send no type hint. */
  @Test
  @Order(16)
  void testRevokedAccessToken_isRefusedOnTheNextCall() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");
    String refreshToken =
        seedRefreshToken(List.of(), System.currentTimeMillis() + Duration.ofDays(1).toMillis());
    HttpResponse<String> refreshed = refresh(refreshToken);
    assertThat(refreshed.statusCode()).isEqualTo(200);
    String accessToken = OBJECT_MAPPER.readTree(refreshed.body()).get("access_token").asText();
    assertThat(listTools(accessToken).statusCode()).isEqualTo(200);

    assertThat(revoke(accessToken).statusCode()).isEqualTo(200);

    assertThat(listTools(accessToken).statusCode()).isEqualTo(401);
  }

  /** Revoking a refresh token ends the access tokens of its grant too (RFC 7009 section 2.1). */
  @Test
  @Order(17)
  void testRevokedRefreshToken_endsItsAccessTokens() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");
    String seeded =
        seedRefreshToken(List.of(), System.currentTimeMillis() + Duration.ofDays(1).toMillis());
    JsonNode tokens = OBJECT_MAPPER.readTree(refresh(seeded).body());
    String accessToken = tokens.get("access_token").asText();
    assertThat(listTools(accessToken).statusCode()).isEqualTo(200);

    assertThat(revoke(tokens.get("refresh_token").asText()).statusCode()).isEqualTo(200);

    assertThat(listTools(accessToken).statusCode()).isEqualTo(401);
  }

  /**
   * Grants are keyed by user name, so deleting a user ends them, and a sign-in waiting for its
   * consent, before the name can be reused. The grant is held under another spelling of the name,
   * as rows written before grants used the account's own name can be.
   */
  @Test
  @Order(18)
  void testDeletedUsersGrant_doesNotPassToANewUserWithTheSameName() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");
    String name = "mcp_grant_" + UUID.randomUUID().toString().substring(0, 8);
    String providerSpelling = name.toUpperCase(Locale.ROOT);
    User user = null;
    try {
      user = createUser(name);
      String code = seedAuthorizationCode(providerSpelling);
      String waitingConsent = seedWaitingConsent(providerSpelling);
      JsonNode tokens =
          OBJECT_MAPPER.readTree(
              refresh(seedRefreshToken(providerSpelling, List.of(), inADay())).body());
      String accessToken = tokens.get("access_token").asText();
      assertThat(listTools(accessToken).statusCode()).isEqualTo(200);

      hardDelete(user);
      user = null;
      user = createUser(name);

      assertThat(listTools(accessToken).statusCode()).isEqualTo(401);
      assertThat(refresh(tokens.get("refresh_token").asText()).statusCode()).isEqualTo(400);
      assertThat(new OAuthAuthorizationCodeRepository().findByCode(code)).isNull();
      assertThat(new McpPendingAuthRequestRepository().findByAuthRequestId(waitingConsent))
          .isNull();
    } finally {
      hardDeleteIfCreated(user);
    }
  }

  /** A soft delete ends the grant too, and restoring the user does not bring it back. */
  @Test
  @Order(19)
  void testSoftDeletedUsersGrant_staysEndedAfterRestore() throws Exception {
    Assumptions.assumeTrue(
        registeredClientId != null, "Skipped: dynamic client registration (Order 3) did not run");
    User user = null;
    try {
      user = createUser("mcp_grant_" + UUID.randomUUID().toString().substring(0, 8));
      JsonNode tokens =
          OBJECT_MAPPER.readTree(
              refresh(seedRefreshToken(user.getName(), List.of(), inADay())).body());
      String accessToken = tokens.get("access_token").asText();

      SdkClients.adminClient().users().delete(user.getId().toString());
      assertThat(listTools(accessToken).statusCode()).isEqualTo(401);
      SdkClients.adminClient().users().restore(user.getId());

      assertThat(refresh(tokens.get("refresh_token").asText()).statusCode()).isEqualTo(400);
    } finally {
      hardDeleteIfCreated(user);
    }
  }

  private static long inADay() {
    return System.currentTimeMillis() + Duration.ofDays(1).toMillis();
  }

  private static void hardDelete(User user) {
    SdkClients.adminClient().users().delete(user.getId().toString(), Map.of("hardDelete", "true"));
  }

  private static void hardDeleteIfCreated(User user) {
    if (user != null) {
      hardDelete(user);
    }
  }

  /** A sign-in that passed the identity provider and waits on the consent page. */
  private static String seedWaitingConsent(String userName) {
    McpPendingAuthRequestRepository pending = new McpPendingAuthRequestRepository();
    String authRequestId =
        pending.createPendingRequest(
            registeredClientId,
            "codeChallenge-123456789012345678901234567890123456789012",
            "S256",
            "http://127.0.0.1:9090/callback",
            null,
            List.of("openid"),
            null,
            null,
            null);
    assertThat(pending.storeConsent(authRequestId, UUID.randomUUID().toString(), userName))
        .isTrue();
    return authRequestId;
  }

  private static String seedAuthorizationCode(String userName) {
    String code = UUID.randomUUID().toString();
    new OAuthAuthorizationCodeRepository()
        .store(
            code,
            registeredClientId,
            userName,
            "codeChallenge-123456789012345678901234567890123456789012",
            "S256",
            URI.create("http://127.0.0.1:9090/callback"),
            List.of("openid"),
            System.currentTimeMillis() + Duration.ofMinutes(5).toMillis());
    return code;
  }

  private static User createUser(String name) {
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(name).withEmail(name + "@example.com"));
  }

  private HttpResponse<String> revoke(String token) throws Exception {
    String formBody =
        "token="
            + token
            + "&client_id="
            + registeredClientId
            + "&client_secret="
            + registeredClientSecret;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/revoke")))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
            .timeout(Duration.ofSeconds(30))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> listTools(String accessToken) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", "Bearer " + accessToken)
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}"))
            .timeout(Duration.ofSeconds(30))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  /**
   * Stores a refresh token for admin granting {@code scopes} and ending at {@code expiresAt}, as a
   * sign-in would.
   */
  private static String seedRefreshToken(List<String> scopes, long expiresAt) {
    return seedRefreshToken("admin", scopes, expiresAt);
  }

  private static String seedRefreshToken(String userName, List<String> scopes, long expiresAt) {
    String value = UUID.randomUUID().toString();
    new OAuthTokenRepository()
        .storeRefreshToken(
            new RefreshToken(value, registeredClientId, scopes, expiresAt),
            registeredClientId,
            userName,
            scopes);
    return value;
  }

  private HttpResponse<String> refresh(String refreshToken) throws Exception {
    String formBody =
        "grant_type=refresh_token&refresh_token="
            + refreshToken
            + "&client_id="
            + registeredClientId
            + "&client_secret="
            + registeredClientSecret;
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp/token")))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formBody))
            .timeout(Duration.ofSeconds(30))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static String challengeOf(HttpResponse<String> response) {
    return response.headers().firstValue("WWW-Authenticate").orElse("");
  }
}
