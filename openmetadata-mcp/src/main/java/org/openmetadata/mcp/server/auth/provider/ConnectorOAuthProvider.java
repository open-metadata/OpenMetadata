package org.openmetadata.mcp.server.auth.provider;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.AccessToken;
import org.openmetadata.mcp.auth.AuthorizationCode;
import org.openmetadata.mcp.auth.AuthorizationParams;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthToken;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.auth.exception.AuthorizeException;
import org.openmetadata.mcp.auth.exception.RegistrationException;
import org.openmetadata.mcp.auth.exception.TokenException;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.DatabricksConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.secrets.SecretsManager;
// import org.openmetadata.service.security.SecurityContext; // Requires openmetadata-service
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.UserUtil;

/**
 * OAuth provider that performs internal, redirect-free OAuth using stored connector credentials.
 *
 * <p>This provider enables MCP clients to authenticate without browser redirects by:
 *
 * <ol>
 *   <li>Loading pre-configured OAuth credentials from OpenMetadata's database
 *   <li>Automatically refreshing expired access tokens using stored refresh tokens
 *   <li>Performing all OAuth exchanges server-side
 * </ol>
 *
 * <p><b>Key Difference from OpenMetadataAuthProvider:</b> This provider does NOT redirect users
 * to external Identity Providers (Google/Okta/Azure). Instead, it uses OAuth credentials that were
 * provisioned once during connector setup to obtain access tokens on behalf of users.
 *
 * <p><b>Workflow:</b>
 *
 * <ol>
 *   <li>Admin provisions connector OAuth credentials via UI (one-time setup)
 *   <li>Credentials stored encrypted in database via SecretsManager
 *   <li>MCP client connects with connector_name parameter
 *   <li>Server loads credentials, refreshes token if needed (internal)
 *   <li>Server returns authorization code (no redirect!)
 *   <li>Client exchanges code for MCP access token
 * </ol>
 *
 * @see OpenMetadataAuthProvider for the redirect-based OAuth flow
 */
@Slf4j
public class ConnectorOAuthProvider implements OAuthAuthorizationServerProvider {

  private final SecretsManager secretsManager;
  private final DatabaseServiceRepository serviceRepository;
  private final HttpClient httpClient;
  private final String baseUrl;

  // In-memory stores for OAuth flow (TODO: Move to Redis/Database for production)
  private final Map<String, OAuthClientInformation> clients = new ConcurrentHashMap<>();
  private final Map<String, ConnectorAuthorizationCode> authorizationCodes =
      new ConcurrentHashMap<>();
  private final Map<String, AccessToken> accessTokens = new ConcurrentHashMap<>();
  private final Map<String, RefreshToken> refreshTokens = new ConcurrentHashMap<>();
  private final Map<String, String> mcpTokenToConnectorToken = new ConcurrentHashMap<>();

  /**
   * Creates a new ConnectorOAuthProvider.
   *
   * @param secretsManager SecretsManager for decrypting OAuth credentials
   * @param serviceRepository Repository for accessing database service configurations
   * @param baseUrl Base URL of the OpenMetadata server
   */
  public ConnectorOAuthProvider(
      SecretsManager secretsManager,
      DatabaseServiceRepository serviceRepository,
      String baseUrl) {
    this.secretsManager = secretsManager;
    this.serviceRepository = serviceRepository;
    this.httpClient = HttpClient.newBuilder().build();
    this.baseUrl = baseUrl;
    LOG.info("Initialized ConnectorOAuthProvider with baseUrl: {}", baseUrl);
  }

  @Override
  public CompletableFuture<Void> registerClient(OAuthClientInformation clientInfo)
      throws RegistrationException {
    clients.put(clientInfo.getClientId(), clientInfo);
    LOG.info("Registered OAuth client: {}", clientInfo.getClientId());
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public CompletableFuture<OAuthClientInformation> getClient(String clientId) {
    OAuthClientInformation client = clients.get(clientId);
    return CompletableFuture.completedFuture(client);
  }

  /**
   * CRITICAL METHOD: Performs 100% internal OAuth without user redirects.
   *
   * <p>This method:
   *
   * <ol>
   *   <li>Extracts connector_name from the request (passed via state parameter)
   *   <li>Loads connector OAuth credentials from database
   *   <li>Checks if access token is expired
   *   <li>If expired, refreshes token using stored refresh token (SERVER-SIDE)
   *   <li>Generates authorization code mapped to connector token
   *   <li>Returns authorization code directly (NO REDIRECT!)
   * </ol>
   *
   * @param client The OAuth client information
   * @param params Authorization parameters (state contains connector_name)
   * @return Authorization code (NOT a redirect URL!)
   * @throws AuthorizeException if connector not found or OAuth not configured
   */
  @Override
  public CompletableFuture<String> authorize(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    try {
      // Extract connector name from state parameter
      // MCP client passes: GET /authorize?...&state=snowflake_prod
      String connectorName = params.getState();

      if (connectorName == null || connectorName.isEmpty()) {
        throw new AuthorizeException(
            "invalid_request",
            "connector_name parameter required for internal OAuth. "
                + "Pass connector name via state parameter.");
      }

      LOG.info("Internal OAuth authorization requested for connector: {}", connectorName);

      // Load connector configuration from database
      DatabaseService service =
          serviceRepository.getByName(
              null, // No specific user context
              connectorName,
              new Fields(new HashSet<>(List.of("connection"))));

      if (service == null) {
        throw new AuthorizeException(
            "invalid_request", "Connector not found: " + connectorName);
      }

      // Decrypt OAuth credentials via SecretsManager
      DatabaseConnection connection = service.getConnection();
      Object decryptedConfig =
          secretsManager.decryptServiceConnectionConfig(
              connection.getConfig(),
              service.getServiceType().value(),
              ServiceType.DATABASE);

      // Extract OAuth credentials from decrypted config
      OAuthCredentials oauth = extractOAuthCredentialsFromConfig(decryptedConfig);

      if (oauth == null) {
        throw new AuthorizeException(
            "invalid_request",
            "Connector does not have OAuth configured: "
                + connectorName
                + ". Please setup OAuth via OpenMetadata UI.");
      }

      // Check if access token is expired and refresh if needed (INTERNAL)
      if (isTokenExpired(oauth)) {
        LOG.info("Access token expired for {}, refreshing internally", connectorName);
        oauth = refreshAccessTokenInternal(oauth, decryptedConfig, connectorName);

        // Update stored credentials with new token
        updateStoredOAuthCredentials(service, oauth, decryptedConfig);
      } else {
        LOG.info("Access token still valid for connector: {}", connectorName);
      }

      // Generate MCP authorization code
      String authCode = UUID.randomUUID().toString();

      // Create authorization code entity
      ConnectorAuthorizationCode codeEntity = new ConnectorAuthorizationCode();
      codeEntity.setCode(authCode);
      codeEntity.setConnectorAccessToken(oauth.getAccessToken());
      codeEntity.setConnectorName(connectorName);
      codeEntity.setClientId(client.getClientId());
      codeEntity.setRedirectUri(params.getRedirectUri());
      codeEntity.setScopes(params.getScopes() != null ? params.getScopes() : List.of());
      codeEntity.setCodeChallenge(params.getCodeChallenge());
      codeEntity.setExpiresAt(Instant.now().plusSeconds(300).getEpochSecond()); // 5 min expiry

      authorizationCodes.put(authCode, codeEntity);

      LOG.info(
          "Internal OAuth authorization successful for connector: {} - returning code directly (no redirect!)",
          connectorName);

      // Return authorization code directly (NOT a redirect URL!)
      return CompletableFuture.completedFuture(authCode);

    } catch (AuthorizeException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Internal OAuth authorization failed", e);
      throw new AuthorizeException("server_error", "Internal OAuth failed: " + e.getMessage());
    }
  }

  /**
   * Extract OAuth credentials from connector configuration.
   *
   * @param config The decrypted config object
   * @return OAuth credentials, or null if not configured
   */
  private OAuthCredentials extractOAuthCredentialsFromConfig(Object config) {
    if (config instanceof SnowflakeConnection) {
      return ((SnowflakeConnection) config).getOauth();
    }
    // TODO: Add Databricks and other connectors once their OAuth schema is defined
    // Databricks uses different auth structure - needs schema update first
    return null;
  }

  /**
   * Set OAuth credentials on connector configuration.
   *
   * @param config The configuration object to update
   * @param oauth The OAuth credentials to set
   */
  private void setOAuthCredentialsOnConfig(Object config, OAuthCredentials oauth) {
    if (config instanceof SnowflakeConnection) {
      ((SnowflakeConnection) config).setOauth(oauth);
    }
    // TODO: Add Databricks and other connectors once their OAuth schema is defined
  }

  /**
   * Check if access token is expired or about to expire soon.
   *
   * @param oauth OAuth credentials containing expiry timestamp
   * @return true if token is expired or will expire within 60 seconds
   */
  private boolean isTokenExpired(OAuthCredentials oauth) {
    if (oauth.getExpiresAt() == null) {
      // If no expiry set, assume expired for safety
      return true;
    }
    // Refresh if expired or expiring within 60 seconds
    long currentTime = Instant.now().getEpochSecond();
    long expiresAt = oauth.getExpiresAt();
    return currentTime >= (expiresAt - 60);
  }

  /**
   * Refresh access token using stored refresh token. THIS IS INTERNAL - No user interaction!
   *
   * <p>This method calls the connector's OAuth token endpoint directly using the stored refresh
   * token, client ID, and client secret. The user is never involved in this process.
   *
   * @param oauth Current OAuth credentials (with expired access token)
   * @param config Connector configuration object (for extracting token endpoint)
   * @param connectorName Name of the connector (for logging)
   * @return Updated OAuth credentials with fresh access token
   */
  private OAuthCredentials refreshAccessTokenInternal(
      OAuthCredentials oauth, Object config, String connectorName) {
    try {
      // Build token endpoint URL (connector-specific)
      String tokenEndpoint = buildTokenEndpoint(config, oauth);

      LOG.info(
          "Calling connector token endpoint internally: {} for connector: {}",
          tokenEndpoint,
          connectorName);

      // Build request body for token refresh
      String requestBody =
          "grant_type=refresh_token"
              + "&refresh_token="
              + URLEncoder.encode(oauth.getRefreshToken(), StandardCharsets.UTF_8)
              + "&client_id="
              + URLEncoder.encode(oauth.getClientId(), StandardCharsets.UTF_8)
              + "&client_secret="
              + URLEncoder.encode(oauth.getClientSecret(), StandardCharsets.UTF_8);

      // Make HTTP call to connector's OAuth server (SERVER-SIDE)
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(tokenEndpoint))
              .header("Content-Type", "application/x-www-form-urlencoded")
              .header("Accept", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(requestBody))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        LOG.error(
            "Token refresh failed for connector: {} - Status: {}, Body: {}",
            connectorName,
            response.statusCode(),
            response.body());
        throw new RuntimeException(
            "Token refresh failed with status: "
                + response.statusCode()
                + " - "
                + response.body());
      }

      // Parse new token from response
      JsonNode tokenResponse = JsonUtils.getObjectMapper().readTree(response.body());

      // Update OAuth credentials with new token
      oauth.setAccessToken(tokenResponse.get("access_token").asText());

      // Calculate new expiry time
      long expiresIn = tokenResponse.get("expires_in").asLong();
      oauth.setExpiresAt((int) Instant.now().plusSeconds(expiresIn).getEpochSecond());

      // Some providers return new refresh token on each refresh
      if (tokenResponse.has("refresh_token")) {
        String newRefreshToken = tokenResponse.get("refresh_token").asText();
        LOG.info("Connector provided new refresh token, updating stored credentials");
        oauth.setRefreshToken(newRefreshToken);
      }

      LOG.info(
          "Token refresh successful for connector: {}, new expiry: {}",
          connectorName,
          Instant.ofEpochSecond(oauth.getExpiresAt()));

      return oauth;

    } catch (Exception e) {
      LOG.error("Failed to refresh access token internally for connector: {}", connectorName, e);
      throw new RuntimeException("Internal token refresh failed: " + e.getMessage(), e);
    }
  }

  /**
   * Build connector-specific token endpoint URL.
   *
   * @param config Connector configuration object
   * @param oauth OAuth credentials (may contain explicit tokenEndpoint)
   * @return Token endpoint URL
   */
  private String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
    // Check if explicitly configured
    URI tokenEndpointUri = oauth.getTokenEndpoint();
    if (tokenEndpointUri != null) {
      return tokenEndpointUri.toString();
    }

    // Otherwise, build from connector configuration
    if (config instanceof SnowflakeConnection) {
      SnowflakeConnection sf = (SnowflakeConnection) config;
      // Snowflake token endpoint format
      return "https://" + sf.getAccount() + ".snowflakecomputing.com/oauth/token-request";
    }
    // TODO: Add Databricks and other connectors once OAuth is supported

    throw new IllegalArgumentException(
        "Cannot determine token endpoint for connector type: "
            + (config != null ? config.getClass().getSimpleName() : "null")
            + ". Please configure tokenEndpoint explicitly in OAuth credentials.");
  }

  /**
   * Update stored OAuth credentials after token refresh.
   *
   * @param service Database service to update
   * @param newOauth Updated OAuth credentials
   * @param decryptedConfig Decrypted config object (to avoid re-decrypting)
   */
  private void updateStoredOAuthCredentials(
      DatabaseService service, OAuthCredentials newOauth, Object decryptedConfig) {
    try {
      // Update config with new OAuth credentials
      setOAuthCredentialsOnConfig(decryptedConfig, newOauth);

      // Encrypt before storing
      Object encryptedConfig =
          secretsManager.encryptServiceConnectionConfig(
              decryptedConfig,
              service.getServiceType().value(),
              service.getName(),
              ServiceType.DATABASE);

      service.getConnection().setConfig(encryptedConfig);

      // Save to database - persist refreshed OAuth credentials
      service.setUpdatedAt(System.currentTimeMillis());
      service.setUpdatedBy("system"); // Auto-refresh is a system operation

      try {
        serviceRepository.persistOAuthCredentials(service);
        LOG.info("Refreshed OAuth credentials persisted to database for service: {}", service.getName());
      } catch (Exception dbEx) {
        LOG.error("Failed to persist refreshed OAuth credentials to database for service: {}", service.getName(), dbEx);
        // Don't fail the request - token refresh succeeded, storage update is best-effort
        // The in-memory token will work for this session
      }

    } catch (Exception e) {
      LOG.error("Failed to update stored OAuth credentials for service: {}", service.getName(), e);
      // Don't fail the request - token refresh succeeded, storage update is best-effort
      // The in-memory token will work for this session
    }
  }

  @Override
  public CompletableFuture<AuthorizationCode> loadAuthorizationCode(
      OAuthClientInformation client, String authorizationCode) {
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authorizationCode);
    return CompletableFuture.completedFuture(code);
  }

  /**
   * Exchange authorization code for MCP access token.
   *
   * <p>This generates an OpenMetadata JWT token that the MCP client will use for subsequent
   * requests. The JWT is mapped to the connector's access token internally.
   *
   * @param client OAuth client information
   * @param code Authorization code to exchange
   * @return OAuth token response with access token, refresh token, etc.
   * @throws TokenException if code is invalid or expired
   */
  @Override
  public CompletableFuture<OAuthToken> exchangeAuthorizationCode(
      OAuthClientInformation client, AuthorizationCode code) throws TokenException {
    try {
      // Retrieve connector auth code
      ConnectorAuthorizationCode storedCode = authorizationCodes.get(code.getCode());

      if (storedCode == null) {
        throw new TokenException("invalid_grant", "Invalid authorization code");
      }

      // Check expiry
      if (Instant.now().getEpochSecond() > storedCode.getExpiresAt()) {
        authorizationCodes.remove(code.getCode());
        throw new TokenException("invalid_grant", "Authorization code expired");
      }

      // Verify PKCE if provided
      // TODO: Implement PKCE verification once code_verifier is available in token exchange
      if (storedCode.getCodeChallenge() != null) {
        LOG.debug("PKCE code_challenge was present during authorization");
      }

      // Remove used code (one-time use)
      authorizationCodes.remove(code.getCode());

      // Get current user from security context
      // TODO: Integrate with SecurityContext once openmetadata-service dependency is available
      String userName = "admin"; // Default user for MCP operations

      User user = Entity.getEntityByName(Entity.USER, userName, "id", Include.NON_DELETED);

      LOG.info(
          "Exchanging authorization code for tokens - client: {}, user: {}, connector: {}",
          client.getClientId(),
          userName,
          storedCode.getConnectorName());

      // Generate OpenMetadata JWT token for MCP usage (1 hour expiry)
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  user.getName(),
                  new HashSet<>(UserUtil.getRoleListFromUser(user)),
                  user.getIsAdmin() != null && user.getIsAdmin(),
                  user.getEmail(),
                  3600, // 1 hour MCP token
                  false, // Not a bot
                  ServiceTokenType.OM_USER);

      // Create access token
      AccessToken accessToken = new AccessToken();
      accessToken.setToken(jwtAuthMechanism.getJWTToken());
      accessToken.setClientId(client.getClientId());
      accessToken.setScopes(storedCode.getScopes());
      accessToken.setExpiresAt((int) Instant.now().plusSeconds(3600).getEpochSecond());
      accessToken.setAudience(Arrays.asList(baseUrl));

      accessTokens.put(accessToken.getToken(), accessToken);

      // Map MCP JWT token → Connector access token
      // This allows MCP tools to use connector credentials when making data queries
      mcpTokenToConnectorToken.put(
          jwtAuthMechanism.getJWTToken(), storedCode.getConnectorAccessToken());

      LOG.info(
          "Mapped MCP token to connector token for connector: {}", storedCode.getConnectorName());

      // Create refresh token
      RefreshToken refreshToken = new RefreshToken();
      refreshToken.setToken(UUID.randomUUID().toString());
      refreshToken.setClientId(client.getClientId());
      refreshToken.setScopes(storedCode.getScopes());

      refreshTokens.put(refreshToken.getToken(), refreshToken);

      // Build OAuth token response
      OAuthToken oauthToken = new OAuthToken();
      oauthToken.setAccessToken(accessToken.getToken());
      oauthToken.setTokenType("Bearer");
      oauthToken.setExpiresIn(3600);
      oauthToken.setRefreshToken(refreshToken.getToken());
      oauthToken.setScope(String.join(" ", storedCode.getScopes()));

      LOG.info(
          "Successfully issued MCP access token for connector: {}", storedCode.getConnectorName());

      return CompletableFuture.completedFuture(oauthToken);

    } catch (TokenException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Token exchange failed", e);
      throw new TokenException("server_error", "Token exchange failed: " + e.getMessage());
    }
  }

  /**
   * Get connector access token for a given MCP token.
   *
   * <p>This allows MCP tools to retrieve the underlying connector OAuth token when making data
   * queries.
   *
   * @param mcpToken The MCP access token (OpenMetadata JWT)
   * @return The connector's OAuth access token, or null if not found
   */
  public String getConnectorToken(String mcpToken) {
    return mcpTokenToConnectorToken.get(mcpToken);
  }

  /**
   * Loads a refresh token by its token string.
   *
   * @param client The client requesting the refresh token
   * @param refreshTokenString The refresh token string to load
   * @return A CompletableFuture that resolves to the RefreshToken, or null if not found
   */
  @Override
  public CompletableFuture<RefreshToken> loadRefreshToken(
      OAuthClientInformation client, String refreshTokenString) {
    return CompletableFuture.completedFuture(refreshTokens.get(refreshTokenString));
  }

  /**
   * Exchanges a refresh token for a new access token.
   *
   * @param client The client exchanging the refresh token
   * @param refreshToken The refresh token to exchange
   * @param scopes Optional scopes to request with the new access token
   * @return A CompletableFuture that resolves to the OAuth token with new access token
   * @throws TokenException if the refresh token is invalid or expired
   */
  @Override
  public CompletableFuture<OAuthToken> exchangeRefreshToken(
      OAuthClientInformation client, RefreshToken refreshToken, List<String> scopes)
      throws TokenException {
    try {
      RefreshToken storedToken = refreshTokens.get(refreshToken.getToken());

      if (storedToken == null) {
        throw new TokenException("invalid_grant", "Invalid refresh token");
      }

      // Check expiration
      if (storedToken.getExpiresAt() != null
          && Instant.now().isAfter(Instant.ofEpochMilli(storedToken.getExpiresAt()))) {
        refreshTokens.remove(refreshToken.getToken());
        throw new TokenException("invalid_grant", "Refresh token expired");
      }

      // Generate new access token (reuse the same logic as initial token generation)
      // Get default bot user for MCP operations
      User botUser = Entity.getEntityByName(Entity.USER, "ingestion-bot", "id", Include.NON_DELETED);

      // Generate JWT token (1 hour expiry)
      int tokenExpirySeconds = 3600;
      JWTAuthMechanism jwtMech =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  botUser.getName(),
                  new HashSet<>(UserUtil.getRoleListFromUser(botUser)),
                  botUser.getIsAdmin() != null && botUser.getIsAdmin(),
                  botUser.getEmail(),
                  tokenExpirySeconds,
                  true, // is a bot
                  ServiceTokenType.BOT);

      String mcpAccessToken = jwtMech.getJWTToken();

      // Create new access token
      AccessToken newAccessToken = new AccessToken();
      newAccessToken.setToken(mcpAccessToken);
      newAccessToken.setClientId(client.getClientId());
      newAccessToken.setScopes(scopes != null ? scopes : storedToken.getScopes());
      newAccessToken.setExpiresAt(
          (int) Instant.now().plusSeconds(tokenExpirySeconds).getEpochSecond());

      accessTokens.put(mcpAccessToken, newAccessToken);

      // Create OAuth token response
      OAuthToken oauthToken = new OAuthToken();
      oauthToken.setAccessToken(mcpAccessToken);
      oauthToken.setTokenType("Bearer");
      oauthToken.setExpiresIn(tokenExpirySeconds);
      oauthToken.setRefreshToken(refreshToken.getToken()); // Return same refresh token
      // OAuthToken uses singular 'scope' field (space-separated string)
      if (scopes != null && !scopes.isEmpty()) {
        oauthToken.setScope(String.join(" ", scopes));
      }

      LOG.info("Successfully refreshed MCP access token for client: {}", client.getClientId());

      return CompletableFuture.completedFuture(oauthToken);

    } catch (TokenException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Refresh token exchange failed", e);
      throw new TokenException("server_error", "Refresh token exchange failed: " + e.getMessage());
    }
  }

  /**
   * Loads an access token by its token string.
   *
   * @param token The access token string to load
   * @return A CompletableFuture that resolves to the AccessToken, or null if the token is invalid
   */
  @Override
  public CompletableFuture<AccessToken> loadAccessToken(String token) {
    return CompletableFuture.completedFuture(accessTokens.get(token));
  }

  /**
   * Revokes an access or refresh token.
   *
   * @param token The token to revoke (can be AccessToken, RefreshToken, or token string)
   * @return A CompletableFuture that completes when the token is revoked
   */
  @Override
  public CompletableFuture<Void> revokeToken(Object token) {
    try {
      if (token instanceof AccessToken accessToken) {
        accessTokens.remove(accessToken.getToken());
        mcpTokenToConnectorToken.remove(accessToken.getToken());
        LOG.info("Revoked access token");
      } else if (token instanceof RefreshToken refreshToken) {
        refreshTokens.remove(refreshToken.getToken());
        LOG.info("Revoked refresh token");
      } else if (token instanceof String tokenString) {
        // Try both maps
        accessTokens.remove(tokenString);
        refreshTokens.remove(tokenString);
        mcpTokenToConnectorToken.remove(tokenString);
        LOG.info("Revoked token: {}", tokenString);
      } else {
        LOG.warn("Unknown token type for revocation: {}", token.getClass());
      }
      return CompletableFuture.completedFuture(null);
    } catch (Exception e) {
      LOG.error("Failed to revoke token", e);
      return CompletableFuture.failedFuture(e);
    }
  }

  /** Internal class to store connector-specific authorization code details. */
  private static class ConnectorAuthorizationCode {
    private String code;
    private String connectorAccessToken;
    private String connectorName;
    private String clientId;
    private URI redirectUri;
    private List<String> scopes;
    private String codeChallenge;
    private long expiresAt;

    public String getCode() {
      return code;
    }

    public void setCode(String code) {
      this.code = code;
    }

    public String getConnectorAccessToken() {
      return connectorAccessToken;
    }

    public void setConnectorAccessToken(String connectorAccessToken) {
      this.connectorAccessToken = connectorAccessToken;
    }

    public String getConnectorName() {
      return connectorName;
    }

    public void setConnectorName(String connectorName) {
      this.connectorName = connectorName;
    }

    public String getClientId() {
      return clientId;
    }

    public void setClientId(String clientId) {
      this.clientId = clientId;
    }

    public URI getRedirectUri() {
      return redirectUri;
    }

    public void setRedirectUri(URI redirectUri) {
      this.redirectUri = redirectUri;
    }

    public List<String> getScopes() {
      return scopes;
    }

    public void setScopes(List<String> scopes) {
      this.scopes = scopes;
    }

    public String getCodeChallenge() {
      return codeChallenge;
    }

    public void setCodeChallenge(String codeChallenge) {
      this.codeChallenge = codeChallenge;
    }

    public long getExpiresAt() {
      return expiresAt;
    }

    public void setExpiresAt(long expiresAt) {
      this.expiresAt = expiresAt;
    }
  }
}
