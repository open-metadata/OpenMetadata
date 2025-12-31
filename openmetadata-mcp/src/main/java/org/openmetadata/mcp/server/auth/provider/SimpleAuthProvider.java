package org.openmetadata.mcp.server.auth.provider;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
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

/**
 * Simple in-memory auth provider implementation.
 */
public class SimpleAuthProvider implements OAuthAuthorizationServerProvider {

  private final Map<String, OAuthClientInformation> clients = new ConcurrentHashMap<>();

  private final Map<String, AuthorizationCode> authCodes = new ConcurrentHashMap<>();

  private final Map<String, RefreshToken> refreshTokens = new ConcurrentHashMap<>();

  private final Map<String, AccessToken> accessTokens = new ConcurrentHashMap<>();

  private final Map<String, String> stateMapping = new ConcurrentHashMap<>();

  private final String resourceServerAudience;

  public SimpleAuthProvider() {
    this(null);
  }

  public SimpleAuthProvider(String resourceServerAudience) {
    this.resourceServerAudience = resourceServerAudience;
  }

  @Override
  public CompletableFuture<OAuthClientInformation> getClient(String clientId) {
    return CompletableFuture.completedFuture(clients.get(clientId));
  }

  @Override
  public CompletableFuture<Void> registerClient(OAuthClientInformation clientInfo)
      throws RegistrationException {
    clients.put(clientInfo.getClientId(), clientInfo);
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public CompletableFuture<String> authorize(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    // Generate a random authorization code
    String code = UUID.randomUUID().toString();

    // Store state mapping
    if (params.getState() != null) {
      stateMapping.put(params.getState(), client.getClientId());
    }

    // Create and store the authorization code
    AuthorizationCode authCode = new AuthorizationCode();
    authCode.setCode(code);
    authCode.setClientId(client.getClientId());
    authCode.setScopes(params.getScopes());
    authCode.setExpiresAt(Instant.now().plusSeconds(600).getEpochSecond());
    authCode.setCodeChallenge(params.getCodeChallenge());
    authCode.setRedirectUri(params.getRedirectUri());
    authCode.setRedirectUriProvidedExplicitly(params.isRedirectUriProvidedExplicitly());

    authCodes.put(code, authCode);

    // Build the redirect URL with the code
    String redirectUri = params.getRedirectUri().toString();
    String state = params.getState();
    String url = redirectUri + "?code=" + code;
    if (state != null) {
      url += "&state=" + state;
    }

    return CompletableFuture.completedFuture(url);
  }

  @Override
  public CompletableFuture<AuthorizationCode> loadAuthorizationCode(
      OAuthClientInformation client, String authorizationCode) {
    return CompletableFuture.completedFuture(authCodes.get(authorizationCode));
  }

  @Override
  public CompletableFuture<OAuthToken> exchangeAuthorizationCode(
      OAuthClientInformation client, AuthorizationCode authorizationCode) throws TokenException {
    // Remove the used authorization code
    authCodes.remove(authorizationCode.getCode());

    // Generate tokens (using UUID for test provider - production should use real JWT)
    // NOTE: This is a test/example provider only. Production implementations should generate
    // proper JWT tokens with signatures and appropriate claims.
    String accessTokenValue = "TEST_ACCESS_TOKEN_" + UUID.randomUUID().toString();
    String refreshTokenValue = "TEST_REFRESH_TOKEN_" + UUID.randomUUID().toString();

    // Create access token with audience claim (RFC 8707)
    AccessToken accessToken = new AccessToken();
    accessToken.setToken(accessTokenValue);
    accessToken.setClientId(client.getClientId());
    accessToken.setScopes(authorizationCode.getScopes());
    accessToken.setExpiresAt(Instant.now().plusSeconds(3600).getEpochSecond());
    if (resourceServerAudience != null) {
      accessToken.setAudience(List.of(resourceServerAudience));
    }

    // Create refresh token
    RefreshToken refreshToken = new RefreshToken();
    refreshToken.setToken(refreshTokenValue);
    refreshToken.setClientId(client.getClientId());
    refreshToken.setScopes(authorizationCode.getScopes());
    refreshToken.setExpiresAt(Instant.now().plusSeconds(86400).getEpochSecond());

    // Store tokens
    accessTokens.put(accessTokenValue, accessToken);
    refreshTokens.put(refreshTokenValue, refreshToken);

    // Create OAuth token response
    OAuthToken token = new OAuthToken();
    token.setAccessToken(accessTokenValue);
    token.setRefreshToken(refreshTokenValue);
    token.setExpiresIn(3600);
    token.setScope(
        authorizationCode.getScopes() == null
            ? ""
            : String.join(" ", authorizationCode.getScopes()));

    return CompletableFuture.completedFuture(token);
  }

  @Override
  public CompletableFuture<RefreshToken> loadRefreshToken(
      OAuthClientInformation client, String refreshToken) {
    return CompletableFuture.completedFuture(refreshTokens.get(refreshToken));
  }

  @Override
  public CompletableFuture<OAuthToken> exchangeRefreshToken(
      OAuthClientInformation client, RefreshToken refreshToken, List<String> scopes)
      throws TokenException {
    // Remove the used refresh token
    refreshTokens.remove(refreshToken.getToken());

    // Generate new tokens (test provider only)
    String accessTokenValue = "TEST_ACCESS_TOKEN_" + UUID.randomUUID().toString();
    String refreshTokenValue = "TEST_REFRESH_TOKEN_" + UUID.randomUUID().toString();

    // Create access token with audience claim (RFC 8707)
    AccessToken accessToken = new AccessToken();
    accessToken.setToken(accessTokenValue);
    accessToken.setClientId(client.getClientId());
    accessToken.setScopes(scopes);
    accessToken.setExpiresAt(Instant.now().plusSeconds(3600).getEpochSecond());
    if (resourceServerAudience != null) {
      accessToken.setAudience(List.of(resourceServerAudience));
    }

    // Create refresh token
    RefreshToken newRefreshToken = new RefreshToken();
    newRefreshToken.setToken(refreshTokenValue);
    newRefreshToken.setClientId(client.getClientId());
    newRefreshToken.setScopes(scopes);
    newRefreshToken.setExpiresAt(Instant.now().plusSeconds(86400).getEpochSecond());

    // Store tokens
    accessTokens.put(accessTokenValue, accessToken);
    refreshTokens.put(refreshTokenValue, newRefreshToken);

    // Create OAuth token response
    OAuthToken token = new OAuthToken();
    token.setAccessToken(accessTokenValue);
    token.setRefreshToken(refreshTokenValue);
    token.setExpiresIn(3600);
    token.setScope(String.join(" ", scopes));

    return CompletableFuture.completedFuture(token);
  }

  @Override
  public CompletableFuture<AccessToken> loadAccessToken(String token) {
    return CompletableFuture.completedFuture(accessTokens.get(token));
  }

  @Override
  public CompletableFuture<Void> revokeToken(Object token) {
    if (token instanceof AccessToken) {
      accessTokens.remove(((AccessToken) token).getToken());
    } else if (token instanceof RefreshToken) {
      refreshTokens.remove(((RefreshToken) token).getToken());
    }
    return CompletableFuture.completedFuture(null);
  }
}
