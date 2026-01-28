package org.openmetadata.mcp.oauth;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Integration tests for OAuth 2.0 Dynamic Client Registration (RFC 7591).
 */
public class ClientRegistrationIntegrationTest extends OpenMetadataApplicationTest {

  private static String CONFIG_PATH_OVERRIDE =
      ResourceHelpers.resourceFilePath("test-config-mcp.yaml");

  private static ObjectMapper objectMapper;

  @Override
  @NotNull
  protected DropwizardAppExtension<OpenMetadataApplicationConfig> getApp(
      ConfigOverride[] configOverridesArray) {
    return new DropwizardAppExtension<>(
        OpenMetadataApplication.class, CONFIG_PATH_OVERRIDE, configOverridesArray);
  }

  @BeforeAll
  void setUp() {
    objectMapper = new ObjectMapper();
  }

  @Test
  void testSuccessfulClientRegistration() throws Exception {
    // Prepare registration request per RFC 7591
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put(
        "redirect_uris",
        Arrays.asList("https://example.com/callback", "https://example.com/oauth/callback"));
    registrationRequest.put("client_name", "Test OAuth Client");
    registrationRequest.put("grant_types", Arrays.asList("authorization_code", "refresh_token"));
    registrationRequest.put("response_types", Arrays.asList("code"));
    registrationRequest.put("scope", "openid profile email");
    registrationRequest.put("token_endpoint_auth_method", "client_secret_post");

    // Make registration request
    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    Response response =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    // Verify response
    assertThat(response.getStatus()).isEqualTo(201); // Created

    String responseBody = response.readEntity(String.class);
    JsonNode clientInfo = objectMapper.readTree(responseBody);

    // Verify client_id and client_secret are generated
    assertThat(clientInfo.has("client_id")).isTrue();
    assertThat(clientInfo.has("client_secret")).isTrue();
    assertThat(clientInfo.get("client_id").asText()).isNotEmpty();
    assertThat(clientInfo.get("client_secret").asText()).isNotEmpty();

    // Verify metadata echoed back
    assertThat(clientInfo.get("client_name").asText()).isEqualTo("Test OAuth Client");
    assertThat(clientInfo.get("token_endpoint_auth_method").asText())
        .isEqualTo("client_secret_post");

    // Verify redirect_uris
    JsonNode redirectUris = clientInfo.get("redirect_uris");
    assertThat(redirectUris.isArray()).isTrue();
    assertThat(redirectUris.size()).isEqualTo(2);
    assertThat(redirectUris.get(0).asText()).isEqualTo("https://example.com/callback");

    // Verify grant_types
    JsonNode grantTypes = clientInfo.get("grant_types");
    assertThat(grantTypes.isArray()).isTrue();
    assertThat(grantTypes.size()).isEqualTo(2);

    // Verify timestamps
    assertThat(clientInfo.has("client_id_issued_at")).isTrue();
    assertThat(clientInfo.get("client_id_issued_at").asLong()).isGreaterThan(0);
    assertThat(clientInfo.get("client_secret_expires_at").asLong()).isEqualTo(0); // Never expires
  }

  @Test
  void testRegistrationWithMissingRedirectUris() throws Exception {
    // Registration request missing required redirect_uris
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("client_name", "Test Client");
    registrationRequest.put("grant_types", Arrays.asList("authorization_code"));

    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    Response response =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    // Verify error response
    assertThat(response.getStatus()).isEqualTo(400); // Bad Request

    String responseBody = response.readEntity(String.class);
    JsonNode error = objectMapper.readTree(responseBody);

    assertThat(error.has("error")).isTrue();
    assertThat(error.get("error").asText()).isEqualTo("invalid_redirect_uri");
    assertThat(error.has("error_description")).isTrue();
    assertThat(error.get("error_description").asText())
        .contains("At least one redirect_uri must be provided");
  }

  @Test
  void testRegistrationWithUnsupportedGrantType() throws Exception {
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("redirect_uris", Arrays.asList("https://example.com/callback"));
    registrationRequest.put("client_name", "Test Client");
    registrationRequest.put(
        "grant_types", Arrays.asList("password", "client_credentials")); // Unsupported

    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    Response response =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    assertThat(response.getStatus()).isEqualTo(400);

    String responseBody = response.readEntity(String.class);
    JsonNode error = objectMapper.readTree(responseBody);

    assertThat(error.get("error").asText()).isEqualTo("invalid_client_metadata");
    assertThat(error.get("error_description").asText()).contains("Unsupported grant_type");
  }

  @Test
  void testRegistrationWithUnsupportedResponseType() throws Exception {
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("redirect_uris", Arrays.asList("https://example.com/callback"));
    registrationRequest.put("client_name", "Test Client");
    registrationRequest.put(
        "response_types", Arrays.asList("token", "id_token")); // Only "code" supported

    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    Response response =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    assertThat(response.getStatus()).isEqualTo(400);

    String responseBody = response.readEntity(String.class);
    JsonNode error = objectMapper.readTree(responseBody);

    assertThat(error.get("error").asText()).isEqualTo("invalid_client_metadata");
    assertThat(error.get("error_description").asText()).contains("Unsupported response_type");
  }

  @Test
  void testRegistrationWithMinimalMetadata() throws Exception {
    // Only required fields
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("redirect_uris", Arrays.asList("https://minimal.example.com/callback"));

    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    Response response =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    assertThat(response.getStatus()).isEqualTo(201);

    String responseBody = response.readEntity(String.class);
    JsonNode clientInfo = objectMapper.readTree(responseBody);

    // Verify defaults are applied
    assertThat(clientInfo.has("client_id")).isTrue();
    assertThat(clientInfo.has("client_secret")).isTrue();

    // Verify default grant_types
    JsonNode grantTypes = clientInfo.get("grant_types");
    assertThat(grantTypes.size()).isEqualTo(2);
    assertThat(grantTypes.toString()).contains("authorization_code");
    assertThat(grantTypes.toString()).contains("refresh_token");

    // Verify default response_types
    JsonNode responseTypes = clientInfo.get("response_types");
    assertThat(responseTypes.size()).isEqualTo(1);
    assertThat(responseTypes.get(0).asText()).isEqualTo("code");

    // Verify default auth method
    assertThat(clientInfo.get("token_endpoint_auth_method").asText())
        .isEqualTo("client_secret_post");
  }

  @Test
  void testRegistrationWithLocalhostRedirectUri() throws Exception {
    // Test localhost redirect URI (common for development)
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put(
        "redirect_uris",
        Arrays.asList("http://localhost:3000/callback", "http://127.0.0.1:3000/callback"));
    registrationRequest.put("client_name", "Development Client");

    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    Response response =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    assertThat(response.getStatus()).isEqualTo(201);

    String responseBody = response.readEntity(String.class);
    JsonNode clientInfo = objectMapper.readTree(responseBody);

    JsonNode redirectUris = clientInfo.get("redirect_uris");
    assertThat(redirectUris.size()).isEqualTo(2);
    assertThat(redirectUris.get(0).asText()).isEqualTo("http://localhost:3000/callback");
    assertThat(redirectUris.get(1).asText()).isEqualTo("http://127.0.0.1:3000/callback");
  }

  @Test
  void testRegistrationWithOptionalMetadata() throws Exception {
    // Test with all optional metadata fields
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("redirect_uris", Arrays.asList("https://example.com/callback"));
    registrationRequest.put("client_name", "Full Metadata Client");
    registrationRequest.put("client_uri", "https://example.com");
    registrationRequest.put("logo_uri", "https://example.com/logo.png");
    registrationRequest.put("contacts", Arrays.asList("admin@example.com", "support@example.com"));
    registrationRequest.put("tos_uri", "https://example.com/terms");
    registrationRequest.put("policy_uri", "https://example.com/privacy");
    registrationRequest.put("software_id", "example-app");
    registrationRequest.put("software_version", "1.0.0");
    registrationRequest.put("scope", "openid profile email offline_access");

    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    Response response =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    assertThat(response.getStatus()).isEqualTo(201);

    String responseBody = response.readEntity(String.class);
    JsonNode clientInfo = objectMapper.readTree(responseBody);

    // Verify optional fields are preserved
    assertThat(clientInfo.get("client_name").asText()).isEqualTo("Full Metadata Client");
    assertThat(clientInfo.get("client_uri").asText()).isEqualTo("https://example.com");
    assertThat(clientInfo.get("logo_uri").asText()).isEqualTo("https://example.com/logo.png");
    assertThat(clientInfo.get("tos_uri").asText()).isEqualTo("https://example.com/terms");
    assertThat(clientInfo.get("policy_uri").asText()).isEqualTo("https://example.com/privacy");
    assertThat(clientInfo.get("software_id").asText()).isEqualTo("example-app");
    assertThat(clientInfo.get("software_version").asText()).isEqualTo("1.0.0");
    assertThat(clientInfo.get("scope").asText()).isEqualTo("openid profile email offline_access");

    JsonNode contacts = clientInfo.get("contacts");
    assertThat(contacts.size()).isEqualTo(2);
    assertThat(contacts.get(0).asText()).isEqualTo("admin@example.com");
  }

  @Test
  void testRegistrationGeneratesUniqueClientIds() throws Exception {
    Map<String, Object> registrationRequest = new HashMap<>();
    registrationRequest.put("redirect_uris", Arrays.asList("https://example.com/callback"));
    registrationRequest.put("client_name", "Test Client");

    WebTarget target =
        APP.client().target("http://localhost:" + APP.getLocalPort()).path("/api/v1/mcp/register");

    // Register first client
    Response response1 =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    String clientId1 =
        objectMapper.readTree(response1.readEntity(String.class)).get("client_id").asText();

    // Register second client with same metadata
    Response response2 =
        target
            .request(MediaType.APPLICATION_JSON)
            .post(Entity.json(objectMapper.writeValueAsString(registrationRequest)));

    String clientId2 =
        objectMapper.readTree(response2.readEntity(String.class)).get("client_id").asText();

    // Verify different client IDs
    assertThat(clientId1).isNotEqualTo(clientId2);
  }
}
