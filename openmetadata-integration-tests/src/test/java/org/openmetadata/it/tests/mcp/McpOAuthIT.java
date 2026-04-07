package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
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
  }
}
