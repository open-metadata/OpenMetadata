package org.openmetadata.mcp.server.auth.handlers;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.OAuthSetupRequest;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Servlet handler for OAuth setup endpoint.
 *
 * <p>Allows admins to complete one-time OAuth setup for a connector:
 *
 * <ol>
 *   <li>Admin initiates OAuth in browser (external to OpenMetadata)
 *   <li>After OAuth approval, admin receives authorization code
 *   <li>Admin sends code to this endpoint
 *   <li>This endpoint exchanges code for tokens with connector's OAuth server
 *   <li>Tokens are encrypted and stored in connector configuration
 * </ol>
 *
 * <p>After this one-time setup, MCP clients can connect without any user interaction.
 */
@Slf4j
public class OAuthSetupHandler extends HttpServlet {

  private final SecretsManager secretsManager;
  private final DatabaseServiceRepository serviceRepository;
  private final HttpClient httpClient;

  public OAuthSetupHandler(
      SecretsManager secretsManager, DatabaseServiceRepository serviceRepository) {
    this.secretsManager = secretsManager;
    this.serviceRepository = serviceRepository;
    this.httpClient = HttpClient.newHttpClient();
  }

  /**
   * Handle OAuth setup POST request.
   *
   * <p>Expected JSON body:
   *
   * <pre>
   * {
   *   "connectorName": "snowflake_prod",
   *   "authorizationCode": "code_from_oauth_provider",
   *   "redirectUri": "http://localhost:3000/oauth/callback",
   *   "clientId": "your_client_id",
   *   "clientSecret": "your_client_secret",
   *   "tokenEndpoint": "https://account.snowflakecomputing.com/oauth/token-request" // optional
   * }
   * </pre>
   */
  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {

    try {
      // Parse request body
      OAuthSetupRequest request =
          JsonUtils.getObjectMapper().readValue(req.getReader(), OAuthSetupRequest.class);

      LOG.info("OAuth setup requested for connector: {}", request.getConnectorName());

      // Validate request
      if (request.getConnectorName() == null || request.getAuthorizationCode() == null) {
        sendError(resp, 400, "connector_name and authorization_code are required");
        return;
      }

      // Load connector from database with all fields
      DatabaseService service =
          serviceRepository.getByName(
              null, request.getConnectorName(), new Fields(new HashSet<>(List.of("*"))));

      if (service == null) {
        sendError(resp, 404, "Connector not found: " + request.getConnectorName());
        return;
      }

      LOG.info("Loaded service: {}, connection type: {}",
          service.getName(),
          service.getConnection() != null ? service.getConnection().getClass().getName() : "null");

      // Exchange authorization code for tokens
      OAuthCredentials tokens =
          exchangeAuthorizationCode(request, service.getConnection().getConfig());

      // Store tokens in connector configuration
      storeOAuthCredentials(service, tokens);

      // Return success
      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("application/json");
      resp.getWriter()
          .write(
              JsonUtils.getObjectMapper()
                  .writeValueAsString(
                      new OAuthSetupResponse(
                          "success",
                          "OAuth credentials stored successfully for " + request.getConnectorName(),
                          Instant.ofEpochSecond(tokens.getExpiresAt()).toString())));

      LOG.info("OAuth setup completed successfully for connector: {}", request.getConnectorName());

    } catch (Exception e) {
      LOG.error("OAuth setup failed", e);
      sendError(resp, 500, "OAuth setup failed: " + e.getMessage());
    }
  }

  /**
   * Exchange authorization code for access/refresh tokens.
   *
   * @param request OAuth setup request with authorization code
   * @param connectionConfig Connection configuration (for determining token endpoint)
   * @return OAuth credentials with tokens
   */
  private OAuthCredentials exchangeAuthorizationCode(
      OAuthSetupRequest request, Object connectionConfig) throws Exception {

    // Determine token endpoint
    String tokenEndpoint = request.getTokenEndpoint();
    if (tokenEndpoint == null || tokenEndpoint.isEmpty()) {
      tokenEndpoint = inferTokenEndpoint(connectionConfig);
    }

    LOG.info("Exchanging authorization code with token endpoint: {}", tokenEndpoint);

    // Build token request
    String requestBody =
        "grant_type=authorization_code"
            + "&code="
            + URLEncoder.encode(request.getAuthorizationCode(), StandardCharsets.UTF_8)
            + "&redirect_uri="
            + URLEncoder.encode(request.getRedirectUri(), StandardCharsets.UTF_8)
            + "&client_id="
            + URLEncoder.encode(request.getClientId(), StandardCharsets.UTF_8)
            + "&client_secret="
            + URLEncoder.encode(request.getClientSecret(), StandardCharsets.UTF_8);

    HttpRequest httpRequest =
        HttpRequest.newBuilder()
            .uri(java.net.URI.create(tokenEndpoint))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Accept", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

    HttpResponse<String> response =
        httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      throw new RuntimeException(
          "Token exchange failed with status "
              + response.statusCode()
              + ": "
              + response.body());
    }

    // Parse token response
    JsonNode tokenResponse = JsonUtils.getObjectMapper().readTree(response.body());

    // Create OAuth credentials
    OAuthCredentials credentials = new OAuthCredentials();
    credentials.setClientId(request.getClientId());
    credentials.setClientSecret(request.getClientSecret());
    credentials.setAccessToken(tokenResponse.get("access_token").asText());
    credentials.setRefreshToken(tokenResponse.get("refresh_token").asText());
    credentials.setTokenEndpoint(URI.create(tokenEndpoint));

    long expiresIn = tokenResponse.has("expires_in") ? tokenResponse.get("expires_in").asLong() : 3600;
    credentials.setExpiresAt((int) Instant.now().plusSeconds(expiresIn).getEpochSecond());

    if (request.getScopes() != null && !request.getScopes().isEmpty()) {
      credentials.setScopes(Arrays.asList(request.getScopes().split(" ")));
    }

    LOG.info("Successfully obtained OAuth tokens, expires at: {}", credentials.getExpiresAt());

    return credentials;
  }

  /**
   * Infer token endpoint from connector configuration.
   *
   * @param connectionConfig Connection configuration object
   * @return Token endpoint URL
   */
  private String inferTokenEndpoint(Object connectionConfig) {
    if (connectionConfig instanceof SnowflakeConnection) {
      SnowflakeConnection sf = (SnowflakeConnection) connectionConfig;
      return "https://" + sf.getAccount() + ".snowflakecomputing.com/oauth/token-request";
    }
    // Add more connector types as needed

    throw new IllegalArgumentException(
        "Cannot infer token endpoint for connector type: "
            + connectionConfig.getClass().getSimpleName()
            + ". Please provide tokenEndpoint explicitly.");
  }

  /**
   * Store OAuth credentials in connector configuration.
   *
   * @param service Database service to update
   * @param credentials OAuth credentials to store
   */
  private void storeOAuthCredentials(DatabaseService service, OAuthCredentials credentials)
      throws Exception {

    // Get current connection
    DatabaseConnection connection = service.getConnection();

    // Decrypt connection config
    Object decryptedConfig =
        secretsManager.decryptServiceConnectionConfig(
            connection.getConfig(),
            service.getServiceType().value(),
            ServiceType.DATABASE);

    // Set OAuth credentials based on connector type
    if (decryptedConfig instanceof SnowflakeConnection) {
      ((SnowflakeConnection) decryptedConfig).setOauth(credentials);
    }
    // Add more connector types as needed

    // Encrypt connection config
    Object encryptedConfig =
        secretsManager.encryptServiceConnectionConfig(
            decryptedConfig,
            service.getServiceType().value(),
            service.getName(),
            ServiceType.DATABASE);

    // Update connection with encrypted config
    connection.setConfig(encryptedConfig);
    service.setConnection(connection);

    // Save to database - persist OAuth credentials
    service.setUpdatedAt(System.currentTimeMillis());
    service.setUpdatedBy("admin"); // OAuth setup is admin operation

    try {
      serviceRepository.persistOAuthCredentials(service);
      LOG.info("OAuth credentials encrypted and persisted to database for service: {}", service.getName());
    } catch (Exception e) {
      LOG.error("Failed to persist OAuth credentials to database for service: {}", service.getName(), e);
      throw new Exception("Failed to save OAuth credentials to database: " + e.getMessage(), e);
    }
  }

  private void sendError(HttpServletResponse resp, int status, String message) throws IOException {
    resp.setStatus(status);
    resp.setContentType("application/json");
    resp.getWriter()
        .write(
            JsonUtils.getObjectMapper()
                .writeValueAsString(new OAuthSetupResponse("error", message, null)));
  }

  /** Response object for OAuth setup. */
  private static class OAuthSetupResponse {
    public String status;
    public String message;
    public String tokenExpiry;

    public OAuthSetupResponse(String status, String message, String tokenExpiry) {
      this.status = status;
      this.message = message;
      this.tokenExpiry = tokenExpiry;
    }
  }
}
