package org.openmetadata.mcp.server.auth.provider;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
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
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.ImpersonationContext;
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
 */
@Slf4j
public class ConnectorOAuthProvider implements OAuthAuthorizationServerProvider, AutoCloseable {

  private final SecretsManager secretsManager;
  private final DatabaseServiceRepository serviceRepository;
  private final HttpClient httpClient;
  private final String baseUrl;
  private final String defaultConnectorName;

  // Database-backed repositories for OAuth persistence
  private final org.openmetadata.mcp.server.auth.repository.OAuthClientRepository clientRepository;
  private final org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository
      codeRepository;
  private final org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository tokenRepository;

  /**
   * Creates a new ConnectorOAuthProvider.
   *
   * @param secretsManager SecretsManager for decrypting OAuth credentials
   * @param serviceRepository Repository for accessing database service configurations
   * @param baseUrl Base URL of the OpenMetadata server
   * @param defaultConnectorName Default connector to use when none specified (null in production)
   */
  public ConnectorOAuthProvider(
      SecretsManager secretsManager,
      DatabaseServiceRepository serviceRepository,
      String baseUrl,
      String defaultConnectorName) {
    this.secretsManager = secretsManager;
    this.serviceRepository = serviceRepository;
    this.httpClient = HttpClient.newBuilder().build();
    this.baseUrl = baseUrl;
    this.defaultConnectorName = defaultConnectorName;

    // Initialize database repositories
    this.clientRepository = new org.openmetadata.mcp.server.auth.repository.OAuthClientRepository();
    this.codeRepository =
        new org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository();
    this.tokenRepository = new org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository();

    LOG.info(
        "Initialized ConnectorOAuthProvider with database persistence and baseUrl: {}", baseUrl);
  }

  /**
   * Get the current authenticated user from thread-local impersonation context.
   *
   * <p>This method attempts to retrieve the authenticated user from ImpersonationContext which is
   * set by the JwtFilter during request processing. If no user is found in the context, it falls
   * back to "admin" as the default user for MCP operations.
   *
   * @return The username of the authenticated user, or "admin" if not available
   */
  private String getCurrentUser() {
    // Try to get impersonatedBy from thread-local context
    // ImpersonationContext is set by JwtFilter during request authentication
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    if (impersonatedBy != null && !impersonatedBy.isEmpty()) {
      LOG.debug("Using impersonatedBy user from context: {}", impersonatedBy);
      return impersonatedBy;
    }

    // Fallback to admin - MCP operations typically use service accounts
    // In future, this could be enhanced to extract user from JWT token passed in request
    LOG.warn(
        "No authenticated user found in ImpersonationContext, using 'admin' as default for MCP OAuth");
    return "admin";
  }

  @Override
  public CompletableFuture<Void> registerClient(OAuthClientInformation clientInfo)
      throws RegistrationException {
    clientRepository.register(clientInfo);
    LOG.info("Registered OAuth client: {}", clientInfo.getClientId());
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public CompletableFuture<OAuthClientInformation> getClient(String clientId) {
    OAuthClientInformation client = clientRepository.findByClientId(clientId);
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
      // Extract connector name from dedicated parameter or fall back to state parameter
      // Priority:
      // 1. connector_name parameter (for MCP Inspector compatibility)
      // 2. state parameter (if it looks like a connector name, not a random hash)
      // 3. Default connector (test-snowflake-mcp) for MCP Inspector
      String connectorName = params.getConnectorName();

      if (connectorName == null || connectorName.isEmpty()) {
        String state = params.getState();
        // Check if state looks like a random hash (64 hex chars) vs connector name
        if (state != null && !state.matches("[a-f0-9]{64}")) {
          connectorName = state;
        }
      }

      // If still no connector name, use configured default (if any)
      if (connectorName == null || connectorName.isEmpty()) {
        if (defaultConnectorName != null && !defaultConnectorName.isEmpty()) {
          connectorName = defaultConnectorName;
          LOG.info("No connector_name provided, using configured default: {}", connectorName);
        } else {
          throw new AuthorizeException(
              "invalid_request", "connector_name parameter is required (no default configured)");
        }
      }

      // Validate connector name format to prevent injection attacks
      if (!connectorName.matches("^[a-zA-Z0-9_-]+$")) {
        throw new AuthorizeException(
            "invalid_request",
            "Connector name contains invalid characters (only a-z, A-Z, 0-9, _, - allowed)");
      }

      LOG.info("Internal OAuth authorization requested for connector: {}", connectorName);

      // Load connector configuration from database
      DatabaseService service =
          serviceRepository.getByName(
              null, // No specific user context
              connectorName,
              new Fields(new HashSet<>(List.of("connection"))));

      if (service == null) {
        throw new AuthorizeException("invalid_request", "Connector not found: " + connectorName);
      }

      // Decrypt OAuth credentials via SecretsManager
      DatabaseConnection connection = service.getConnection();
      Object decryptedConfig =
          secretsManager.decryptServiceConnectionConfig(
              connection.getConfig(), service.getServiceType().value(), ServiceType.DATABASE);

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

      // Get current authenticated user
      String currentUser = getCurrentUser();

      // Generate MCP authorization code
      String authCode = UUID.randomUUID().toString();
      long expiresAt = Instant.now().plusSeconds(300).getEpochSecond(); // 5 min expiry
      List<String> scopes = params.getScopes() != null ? params.getScopes() : List.of();

      // Store authorization code in database (NOT storing sensitive connector access token)
      codeRepository.store(
          authCode,
          client.getClientId(),
          connectorName,
          currentUser,
          params.getCodeChallenge(),
          params.getCodeChallenge() != null ? "S256" : null,
          params.getRedirectUri(),
          scopes,
          expiresAt);

      LOG.info(
          "Internal OAuth authorization successful for connector: {} by user: {} - returning code directly (no redirect!)",
          connectorName,
          currentUser);

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
   * Extract OAuth credentials from connector configuration using plugin system.
   *
   * <p>This method uses the {@link org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPluginRegistry}
   * to automatically detect the appropriate plugin for the config and extract OAuth credentials.
   * This eliminates hardcoded if/else statements for each connector type.
   *
   * @param config The decrypted config object
   * @return OAuth credentials, or null if not configured or OAuth not supported for this connector
   */
  private OAuthCredentials extractOAuthCredentialsFromConfig(Object config) {
    // Use plugin registry to auto-detect and extract credentials
    org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPlugin plugin =
        org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPluginRegistry.getPluginForConfig(
            config);

    if (plugin != null) {
      LOG.debug("Using {} to extract OAuth credentials", plugin.getClass().getSimpleName());
      return plugin.extractCredentials(config);
    }

    LOG.debug(
        "No OAuth plugin found for config type: {}. OAuth may not be supported for this connector.",
        config != null ? config.getClass().getSimpleName() : "null");
    return null;
  }

  /**
   * Set OAuth credentials on connector configuration using plugin system.
   *
   * <p>This method uses the {@link org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPluginRegistry}
   * to automatically detect the appropriate plugin for the config and set OAuth credentials.
   * This eliminates hardcoded if/else statements for each connector type.
   *
   * @param config The configuration object to update
   * @param oauth The OAuth credentials to set
   */
  private void setOAuthCredentialsOnConfig(Object config, OAuthCredentials oauth) {
    // Use plugin registry to auto-detect and set credentials
    org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPlugin plugin =
        org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPluginRegistry.getPluginForConfig(
            config);

    if (plugin != null) {
      LOG.debug("Using {} to set OAuth credentials", plugin.getClass().getSimpleName());
      plugin.setCredentials(config, oauth);
    } else {
      LOG.warn(
          "No OAuth plugin found for config type: {}. Cannot update OAuth credentials.",
          config != null ? config.getClass().getSimpleName() : "null");
    }
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
            "Token refresh failed with status: " + response.statusCode() + " - " + response.body());
      }

      // Parse new token from response
      JsonNode tokenResponse = JsonUtils.getObjectMapper().readTree(response.body());

      // Validate required fields exist
      JsonNode accessTokenNode = tokenResponse.get("access_token");
      if (accessTokenNode == null || accessTokenNode.isNull()) {
        throw new RuntimeException("Token refresh response missing access_token field");
      }
      JsonNode expiresInNode = tokenResponse.get("expires_in");
      if (expiresInNode == null || expiresInNode.isNull()) {
        throw new RuntimeException("Token refresh response missing expires_in field");
      }

      // Update OAuth credentials with new token
      oauth.setAccessToken(accessTokenNode.asText());

      // Calculate new expiry time with validation
      long expiresIn = expiresInNode.asLong();
      if (expiresIn <= 0 || expiresIn > 31536000) { // Max 1 year
        throw new RuntimeException("Invalid expires_in value: " + expiresIn);
      }
      // Note: OAuthCredentials (from schema) uses Integer for expiresAt
      // This will overflow in 2038. TODO: Update JSON schema to use long
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
   * Build connector-specific token endpoint URL using plugin system.
   *
   * <p>This method uses the {@link org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPluginRegistry}
   * to automatically detect the appropriate plugin for the config and build the token endpoint URL.
   * This eliminates hardcoded if/else statements for each connector type.
   *
   * @param config Connector configuration object
   * @param oauth OAuth credentials (may contain explicit tokenEndpoint)
   * @return Token endpoint URL
   */
  private String buildTokenEndpoint(Object config, OAuthCredentials oauth) {
    // Use plugin registry to auto-detect and build token endpoint
    org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPlugin plugin =
        org.openmetadata.mcp.server.auth.plugins.OAuthConnectorPluginRegistry.getPluginForConfig(
            config);

    if (plugin != null) {
      LOG.debug("Using {} to build token endpoint", plugin.getClass().getSimpleName());
      return plugin.buildTokenEndpoint(config, oauth);
    }

    throw new IllegalArgumentException(
        "Cannot determine token endpoint for connector type: "
            + (config != null ? config.getClass().getSimpleName() : "null")
            + ". OAuth may not be supported for this connector type. "
            + "Please configure tokenEndpoint explicitly in OAuth credentials, "
            + "or ensure an OAuth plugin is registered for this connector.");
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
        LOG.info(
            "Refreshed OAuth credentials persisted to database for service: {}", service.getName());
      } catch (Exception dbEx) {
        LOG.error(
            "Failed to persist refreshed OAuth credentials to database for service: {}",
            service.getName(),
            dbEx);
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
    // Load authorization code from database
    org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAuthorizationCodeRecord dbCode =
        codeRepository.findByCode(authorizationCode);

    if (dbCode == null) {
      return CompletableFuture.completedFuture(null);
    }

    // Populate AuthorizationCode with all fields from database record
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authorizationCode);
    code.setClientId(dbCode.clientId());
    if (dbCode.redirectUri() != null && !dbCode.redirectUri().isEmpty()) {
      code.setRedirectUri(URI.create(dbCode.redirectUri()));
    }
    code.setCodeChallenge(dbCode.codeChallenge());
    // Note: AuthorizationCode class doesn't have codeChallengeMethod field
    // The PKCE verification in exchangeAuthorizationCode() always uses S256

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
      // Retrieve authorization code from database
      org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAuthorizationCodeRecord dbCode =
          codeRepository.findByCode(code.getCode());

      if (dbCode == null) {
        throw new TokenException("invalid_grant", "Invalid authorization code");
      }

      // TODO: SECURITY - Race Condition Vulnerability (95% confidence)
      // The check-and-use pattern here is not atomic. Between checking dbCode.used()
      // and calling codeRepository.markAsUsed() later in this method, another thread
      // could use the same code, violating OAuth 2.0 security requirements.
      //
      // Impact: Authorization code replay attacks possible.
      //
      // Fix Required: Use database-level atomic operation with row locking:
      //   UPDATE oauth_authorization_codes
      //   SET used = TRUE
      //   WHERE code = :code AND used = FALSE
      //   RETURNING *
      //
      // This ensures only one thread can successfully mark the code as used.
      // See: https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2

      // Check if already used
      if (dbCode.used()) {
        throw new TokenException("invalid_grant", "Authorization code already used");
      }

      // Check expiry
      if (Instant.now().getEpochSecond() > dbCode.expiresAt()) {
        codeRepository.delete(code.getCode());
        throw new TokenException("invalid_grant", "Authorization code expired");
      }

      // Get connector name and userName from database record
      String connectorName = dbCode.connectorName();
      String userName = dbCode.userName() != null ? dbCode.userName() : "admin";

      // Verify PKCE if code_challenge was provided during authorization
      if (dbCode.codeChallenge() != null) {
        String codeVerifier = code.getCodeVerifier();
        if (codeVerifier == null || codeVerifier.isEmpty()) {
          throw new TokenException(
              "invalid_request", "code_verifier is required when code_challenge was used");
        }

        try {
          // Compute SHA-256 hash of code_verifier and base64url encode it
          MessageDigest digest = MessageDigest.getInstance("SHA-256");
          byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.UTF_8));
          String computedChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

          if (!computedChallenge.equals(dbCode.codeChallenge())) {
            LOG.error(
                "PKCE verification failed - code_verifier does not match code_challenge for connector: {}",
                connectorName);
            throw new TokenException(
                "invalid_grant", "PKCE verification failed: code_verifier is incorrect");
          }

          LOG.info(
              "PKCE verification succeeded for connector: {}, client: {}",
              connectorName,
              client.getClientId());
        } catch (NoSuchAlgorithmException e) {
          LOG.error("Failed to verify PKCE code_challenge - SHA-256 algorithm not available", e);
          throw new TokenException("server_error", "Failed to verify code challenge");
        }
      }

      // Mark code as used in database
      codeRepository.markAsUsed(code.getCode());

      // userName already extracted from dbCode above (line 536)
      // Lookup user entity for token generation
      User user;
      try {
        user = Entity.getEntityByName(Entity.USER, userName, "id", Include.NON_DELETED);
      } catch (Exception e) {
        LOG.error("Failed to load user: {}, falling back to 'admin'", userName, e);
        userName = "admin";
        user = Entity.getEntityByName(Entity.USER, userName, "id", Include.NON_DELETED);
      }

      // Reload connector's OAuth credentials to get access token
      DatabaseService service =
          serviceRepository.getByName(
              null, connectorName, new Fields(new HashSet<>(List.of("connection"))));

      if (service == null) {
        throw new TokenException("server_error", "Connector not found: " + connectorName);
      }

      DatabaseConnection connection = service.getConnection();
      Object decryptedConfig =
          secretsManager.decryptServiceConnectionConfig(
              connection.getConfig(), service.getServiceType().value(), ServiceType.DATABASE);

      OAuthCredentials oauth = extractOAuthCredentialsFromConfig(decryptedConfig);
      if (oauth == null || oauth.getAccessToken() == null) {
        throw new TokenException(
            "server_error",
            "Connector OAuth credentials not found or invalid for: " + connectorName);
      }

      String connectorAccessToken = oauth.getAccessToken();

      LOG.info(
          "Exchanging authorization code for tokens - client: {}, user: {}, connector: {}",
          client.getClientId(),
          userName,
          connectorName);

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
      String mcpAccessToken = jwtAuthMechanism.getJWTToken();
      accessToken.setToken(
          mcpAccessToken); // Note: AccessToken uses setToken(), not setAccessToken()
      accessToken.setClientId(client.getClientId());
      accessToken.setScopes(dbCode.scopes());
      long accessTokenExpiresAt = Instant.now().plusSeconds(3600).getEpochSecond();
      accessToken.setExpiresAt(accessTokenExpiresAt);

      // Store access token in database with connector name for token->connector mapping
      tokenRepository.storeAccessToken(
          accessToken,
          client.getClientId(),
          connectorName, // Store connector name so we can reload credentials later
          userName,
          dbCode.scopes());

      LOG.info("Stored MCP access token in database, mapped to connector: {}", connectorName);

      // Create refresh token
      RefreshToken refreshToken = new RefreshToken();
      refreshToken.setToken(UUID.randomUUID().toString());
      refreshToken.setClientId(client.getClientId());
      refreshToken.setScopes(dbCode.scopes());
      long refreshTokenExpiresAt =
          Instant.now().plusSeconds(86400 * 30).getEpochSecond(); // 30 days
      refreshToken.setExpiresAt(refreshTokenExpiresAt);

      // Store refresh token in database
      tokenRepository.storeRefreshToken(
          refreshToken, client.getClientId(), connectorName, userName, dbCode.scopes());

      // Build OAuth token response
      OAuthToken oauthToken = new OAuthToken();
      oauthToken.setAccessToken(accessToken.getToken());
      oauthToken.setTokenType("Bearer");
      oauthToken.setExpiresIn(3600);
      oauthToken.setRefreshToken(refreshToken.getToken());
      oauthToken.setScope(String.join(" ", dbCode.scopes()));

      LOG.info("Successfully issued MCP access token for connector: {}", connectorName);

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
   * <p>This method:
   * <ol>
   *   <li>Looks up the MCP access token in the database
   *   <li>Extracts the connector name from the token record
   *   <li>Loads the connector's OAuth credentials from the database
   *   <li>Returns the connector's access token
   * </ol>
   *
   * @param mcpToken The MCP access token (OpenMetadata JWT)
   * @return The connector's OAuth access token, or null if not found
   */
  public String getConnectorToken(String mcpToken) {
    try {
      // Get connector name from token record
      String connectorName = tokenRepository.getConnectorNameForToken(mcpToken);
      if (connectorName == null) {
        LOG.warn("MCP token not found or no connector name associated");
        return null;
      }

      // Load connector's OAuth credentials from database
      DatabaseService service =
          serviceRepository.getByName(
              null, connectorName, new Fields(new HashSet<>(List.of("connection"))));

      if (service == null) {
        LOG.warn("Connector not found: {}", connectorName);
        return null;
      }

      DatabaseConnection connection = service.getConnection();
      Object decryptedConfig =
          secretsManager.decryptServiceConnectionConfig(
              connection.getConfig(), service.getServiceType().value(), ServiceType.DATABASE);

      OAuthCredentials oauth = extractOAuthCredentialsFromConfig(decryptedConfig);
      if (oauth == null || oauth.getAccessToken() == null) {
        LOG.warn("No OAuth credentials found for connector: {}", connectorName);
        return null;
      }

      return oauth.getAccessToken();

    } catch (Exception e) {
      LOG.error("Failed to retrieve connector token for MCP token", e);
      return null;
    }
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
    RefreshToken token = tokenRepository.findRefreshToken(refreshTokenString);
    return CompletableFuture.completedFuture(token);
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
      // Load refresh token from database
      RefreshToken storedToken = tokenRepository.findRefreshToken(refreshToken.getToken());

      if (storedToken == null) {
        throw new TokenException("invalid_grant", "Invalid refresh token");
      }

      // Check expiration
      if (storedToken.getExpiresAt() != null
          && Instant.now().isAfter(Instant.ofEpochMilli(storedToken.getExpiresAt()))) {
        tokenRepository.deleteRefreshToken(refreshToken.getToken());
        throw new TokenException("invalid_grant", "Refresh token expired");
      }

      // Get connector name from refresh token (need helper method similar to access tokens)
      String connectorName =
          tokenRepository.getConnectorNameForRefreshToken(refreshToken.getToken());

      // Generate new access token (reuse the same logic as initial token generation)
      // Get default bot user for MCP operations
      User botUser =
          Entity.getEntityByName(Entity.USER, "ingestion-bot", "id", Include.NON_DELETED);

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
      newAccessToken.setExpiresAt(Instant.now().plusSeconds(tokenExpirySeconds).getEpochSecond());

      // Store new access token in database
      tokenRepository.storeAccessToken(
          newAccessToken,
          client.getClientId(),
          connectorName != null ? connectorName : "unknown",
          botUser.getName(),
          scopes != null ? scopes : storedToken.getScopes());

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
    AccessToken accessToken = tokenRepository.findAccessToken(token);
    return CompletableFuture.completedFuture(accessToken);
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
        tokenRepository.deleteAccessToken(accessToken.getToken());
        LOG.info("Revoked access token");
      } else if (token instanceof RefreshToken refreshToken) {
        tokenRepository.revokeRefreshToken(refreshToken.getToken());
        LOG.info("Revoked refresh token");
      } else if (token instanceof String tokenString) {
        // Try both token types - delete access token and revoke refresh token
        try {
          tokenRepository.deleteAccessToken(tokenString);
        } catch (Exception e) {
          LOG.debug("Token {} not found as access token", tokenString);
        }
        try {
          tokenRepository.revokeRefreshToken(tokenString);
        } catch (Exception e) {
          LOG.debug("Token {} not found as refresh token", tokenString);
        }
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

  /**
   * Closes the HTTP client and releases resources.
   * This method should be called when the provider is no longer needed.
   */
  @Override
  public void close() {
    // Note: HttpClient doesn't implement Closeable in Java 11+
    // The executor and connection pool will be garbage collected
    // when this object is no longer referenced.
    // For explicit cleanup, applications using this class should manage
    // the lifecycle and call this method before shutdown.
    LOG.info("ConnectorOAuthProvider close() called - HttpClient resources will be GC'd");
  }
}
