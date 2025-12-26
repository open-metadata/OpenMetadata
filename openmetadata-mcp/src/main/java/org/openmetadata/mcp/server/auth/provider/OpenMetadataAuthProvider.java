package org.openmetadata.mcp.server.auth.provider;

import java.net.URI;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.UserUtil;

/**
 * OAuth provider that integrates with OpenMetadata's existing SSO authentication system. This
 * provider delegates user authentication to OpenMetadata's OIDC/SAML/LDAP providers and issues MCP
 * access tokens using OpenMetadata's JWT token generation.
 */
@Slf4j
public class OpenMetadataAuthProvider implements OAuthAuthorizationServerProvider {

  private final String baseUrl;
  private final Map<String, OAuthClientInformation> clients = new ConcurrentHashMap<>();
  private final Map<String, AuthorizationCode> authorizationCodes = new ConcurrentHashMap<>();
  private final Map<String, AccessToken> accessTokens = new ConcurrentHashMap<>();
  private final Map<String, RefreshToken> refreshTokens = new ConcurrentHashMap<>();
  private final Map<String, String> pendingAuthRequests = new ConcurrentHashMap<>();
  // Maps to track userId associated with codes and tokens
  private final Map<String, String> codeToUserId = new ConcurrentHashMap<>();
  private final Map<String, String> refreshTokenToUserId = new ConcurrentHashMap<>();

  /**
   * Creates a new OpenMetadataAuthProvider.
   *
   * @param baseUrl The base URL of the OpenMetadata server
   */
  public OpenMetadataAuthProvider(String baseUrl) {
    this.baseUrl = baseUrl;
    LOG.info("Initialized OpenMetadataAuthProvider with baseUrl: {}", baseUrl);
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

  @Override
  public CompletableFuture<String> authorize(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    try {
      // Store the original MCP client redirect URI so we can use it in the callback
      pendingAuthRequests.put(params.getState(), params.getRedirectUri().toString());

      // Get AuthenticationCodeFlowHandler instance to access IdP configuration
      AuthenticationCodeFlowHandler authHandler =
          AuthenticationCodeFlowHandler.getInstance(
              SecurityConfigurationManager.getCurrentAuthConfig(),
              SecurityConfigurationManager.getCurrentAuthzConfig());
      // TODO: Update to use correct API to get OIDC client from authHandler
      // OidcClient oidcClient = authHandler.getClient(); // Method doesn't exist
      throw new AuthorizeException(
          "not_implemented",
          "OpenMetadataAuthProvider is deprecated, use ConnectorOAuthProvider instead");

      /*
      // Build MCP callback URL that will be invoked after IdP authentication
      // String mcpCallbackUrl = baseUrl + "/mcp/auth/callback";

      // Build login parameters similar to handleLogin() in AuthenticationCodeFlowHandler
      Map<String, String> loginParams = new java.util.HashMap<>();
      loginParams.put("scope", oidcClient.getConfiguration().getScope());
      loginParams.put("response_type", oidcClient.getConfiguration().getResponseType());
      loginParams.put("response_mode", "query");
      loginParams.putAll(oidcClient.getConfiguration().getCustomParams());
      loginParams.put("client_id", oidcClient.getConfiguration().getClientId());

      // Set the redirect_uri to MCP callback (not the regular OpenMetadata callback)
      loginParams.put("redirect_uri", params.getRedirectUri().toString());

      // Add state from MCP OAuth flow
      if (params.getState() != null) {
        loginParams.put("state", params.getState());
      }

      // Build the IdP authorization URL (e.g., Google/Okta authorization endpoint)
      String idpAuthUrl =
          oidcClient.getConfiguration().getProviderMetadata().getAuthorizationEndpointURI()
              + "?"
              + buildQueryString(loginParams);

      LOG.info(
          "Redirecting MCP client to IdP: {}, final MCP redirect: {}",
          idpAuthUrl,
          params.getRedirectUri());

      return CompletableFuture.completedFuture(idpAuthUrl);
      */
    } catch (Exception e) {
      LOG.error("Error during authorization", e);
      throw new AuthorizeException("server_error", "Failed to initialize authorization");
    }
  }

  private String buildQueryString(Map<String, String> params) {
    return params.entrySet().stream()
        .map(
            entry ->
                java.net.URLEncoder.encode(entry.getKey(), java.nio.charset.StandardCharsets.UTF_8)
                    + "="
                    + java.net.URLEncoder.encode(
                        entry.getValue(), java.nio.charset.StandardCharsets.UTF_8))
        .collect(java.util.stream.Collectors.joining("&"));
  }

  /**
   * Called after successful OpenMetadata SSO authentication to generate authorization code.
   *
   * @param userId The OpenMetadata user ID
   * @param clientId The OAuth client ID
   * @param redirectUri The redirect URI
   * @param scopes The requested scopes
   * @param codeChallenge The PKCE code challenge
   * @return The generated authorization code
   */
  public CompletableFuture<AuthorizationCode> createAuthorizationCode(
      String userId, String clientId, URI redirectUri, List<String> scopes, String codeChallenge) {
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(UUID.randomUUID().toString());
    code.setClientId(clientId);
    code.setRedirectUri(redirectUri);
    code.setScopes(scopes);
    code.setCodeChallenge(codeChallenge);
    code.setExpiresAt(Instant.now().plusSeconds(300).getEpochSecond());

    authorizationCodes.put(code.getCode(), code);
    codeToUserId.put(code.getCode(), userId);
    LOG.info("Created authorization code for user: {} client: {}", userId, clientId);

    return CompletableFuture.completedFuture(code);
  }

  /**
   * Get the original MCP client redirect URI from the state parameter.
   *
   * @param state The OAuth state parameter
   * @return The original redirect URI, or null if not found
   */
  public String getOriginalRedirectUri(String state) {
    return pendingAuthRequests.get(state);
  }

  @Override
  public CompletableFuture<AuthorizationCode> loadAuthorizationCode(
      OAuthClientInformation client, String authorizationCode) {
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authorizationCode);
    return CompletableFuture.completedFuture(code);
  }

  @Override
  public CompletableFuture<OAuthToken> exchangeAuthorizationCode(
      OAuthClientInformation client, AuthorizationCode code) throws TokenException {
    String userId = codeToUserId.get(code.getCode());
    if (userId == null) {
      throw new TokenException("invalid_grant", "Invalid authorization code");
    }

    LOG.info(
        "Exchanging authorization code for tokens - client: {}, user: {}",
        client.getClientId(),
        userId);

    // Verify code
    AuthorizationCode storedCode = authorizationCodes.get(code.getCode());
    if (storedCode == null) {
      throw new TokenException("invalid_grant", "Invalid authorization code");
    }

    // Check expiry
    if (Instant.now().getEpochSecond() > storedCode.getExpiresAt()) {
      authorizationCodes.remove(code.getCode());
      codeToUserId.remove(code.getCode());
      throw new TokenException("invalid_grant", "Authorization code expired");
    }

    // Remove used code
    authorizationCodes.remove(code.getCode());

    // Get OpenMetadata user
    try {
      User user = Entity.getEntityByName(Entity.USER, userId, "id", Include.NON_DELETED);

      // Generate OpenMetadata JWT token using JWTTokenGenerator
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  user.getName(),
                  UserUtil.getRoleListFromUser(user),
                  user.getIsAdmin() != null && user.getIsAdmin(),
                  user.getEmail(),
                  3600, // 1 hour
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

      // Create refresh token
      RefreshToken refreshToken = new RefreshToken();
      refreshToken.setToken(UUID.randomUUID().toString());
      refreshToken.setClientId(client.getClientId());
      refreshToken.setScopes(storedCode.getScopes());

      refreshTokens.put(refreshToken.getToken(), refreshToken);
      refreshTokenToUserId.put(refreshToken.getToken(), userId);

      // Build OAuth token response
      OAuthToken oauthToken = new OAuthToken();
      oauthToken.setAccessToken(accessToken.getToken());
      oauthToken.setTokenType("Bearer");
      oauthToken.setExpiresIn(3600);
      oauthToken.setRefreshToken(refreshToken.getToken());
      if (storedCode.getScopes() != null) {
        oauthToken.setScope(String.join(" ", storedCode.getScopes()));
      }

      // Remove userId mapping for code as it's been consumed
      codeToUserId.remove(code.getCode());

      LOG.info("Successfully issued access token for user: {}", user.getName());
      return CompletableFuture.completedFuture(oauthToken);

    } catch (Exception e) {
      LOG.error("Error generating access token", e);
      throw new TokenException("server_error", "Failed to generate access token");
    }
  }

  @Override
  public CompletableFuture<RefreshToken> loadRefreshToken(
      OAuthClientInformation client, String refreshTokenString) {
    RefreshToken token = refreshTokens.get(refreshTokenString);
    return CompletableFuture.completedFuture(token);
  }

  @Override
  public CompletableFuture<OAuthToken> exchangeRefreshToken(
      OAuthClientInformation client, RefreshToken refreshToken, List<String> scopes)
      throws TokenException {
    RefreshToken storedToken = refreshTokens.get(refreshToken.getToken());
    if (storedToken == null) {
      throw new TokenException("invalid_grant", "Invalid refresh token");
    }

    if (!storedToken.getClientId().equals(client.getClientId())) {
      throw new TokenException("invalid_grant", "Token does not belong to this client");
    }

    String userId = refreshTokenToUserId.get(refreshToken.getToken());
    if (userId == null) {
      throw new TokenException("invalid_grant", "Invalid refresh token");
    }

    // Get OpenMetadata user and generate new token
    try {
      User user = Entity.getEntityByName(Entity.USER, userId, "id", Include.NON_DELETED);

      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  user.getName(),
                  UserUtil.getRoleListFromUser(user),
                  user.getIsAdmin() != null && user.getIsAdmin(),
                  user.getEmail(),
                  3600,
                  false,
                  ServiceTokenType.OM_USER);

      AccessToken accessToken = new AccessToken();
      accessToken.setToken(jwtAuthMechanism.getJWTToken());
      accessToken.setClientId(client.getClientId());
      accessToken.setScopes(scopes != null ? scopes : storedToken.getScopes());
      accessToken.setExpiresAt((int) Instant.now().plusSeconds(3600).getEpochSecond());
      accessToken.setAudience(Arrays.asList(baseUrl));

      accessTokens.put(accessToken.getToken(), accessToken);

      // Generate new refresh token
      refreshTokens.remove(refreshToken.getToken());
      refreshTokenToUserId.remove(refreshToken.getToken());

      RefreshToken newRefreshToken = new RefreshToken();
      newRefreshToken.setToken(UUID.randomUUID().toString());
      newRefreshToken.setClientId(client.getClientId());
      newRefreshToken.setScopes(accessToken.getScopes());

      refreshTokens.put(newRefreshToken.getToken(), newRefreshToken);
      refreshTokenToUserId.put(newRefreshToken.getToken(), userId);

      OAuthToken oauthToken = new OAuthToken();
      oauthToken.setAccessToken(accessToken.getToken());
      oauthToken.setTokenType("Bearer");
      oauthToken.setExpiresIn(3600);
      oauthToken.setRefreshToken(newRefreshToken.getToken());
      if (accessToken.getScopes() != null) {
        oauthToken.setScope(String.join(" ", accessToken.getScopes()));
      }

      LOG.info("Successfully refreshed token for user: {}", user.getName());
      return CompletableFuture.completedFuture(oauthToken);

    } catch (Exception e) {
      LOG.error("Error refreshing token", e);
      throw new TokenException("server_error", "Failed to refresh token");
    }
  }

  @Override
  public CompletableFuture<AccessToken> loadAccessToken(String token) {
    AccessToken accessToken = new AccessToken();
    accessToken.setToken(token);
    return CompletableFuture.completedFuture(accessToken);
  }

  @Override
  public CompletableFuture<Void> revokeToken(Object token) {
    if (token == null) {
      return CompletableFuture.completedFuture(null);
    }

    String tokenString = token.toString();

    // Try to revoke as access token
    AccessToken accessToken = accessTokens.remove(tokenString);
    if (accessToken != null) {
      LOG.info("Revoked access token");
      return CompletableFuture.completedFuture(null);
    }

    // Try to revoke as refresh token
    RefreshToken refreshToken = refreshTokens.remove(tokenString);
    if (refreshToken != null) {
      refreshTokenToUserId.remove(tokenString);
      LOG.info("Revoked refresh token");
      return CompletableFuture.completedFuture(null);
    }

    // Token not found, but that's okay per RFC 7009
    return CompletableFuture.completedFuture(null);
  }
}
