package org.openmetadata.mcp.server.auth.handlers;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthToken;
import org.openmetadata.mcp.auth.exception.TokenException;
import org.openmetadata.mcp.server.auth.middleware.ClientAuthenticator;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.pac4j.oidc.client.OidcClient;

/**
 * Handler for OAuth token requests.
 */
public class TokenHandler {

  private final OAuthAuthorizationServerProvider provider;

  private final ClientAuthenticator clientAuthenticator;

  public TokenHandler(
      OAuthAuthorizationServerProvider provider, ClientAuthenticator clientAuthenticator) {
    this.provider = provider;
    this.clientAuthenticator = clientAuthenticator;
  }

  /**
   * Handle a token request.
   * @param params The request parameters
   * @return A CompletableFuture that resolves to an OAuth token
   */
  public CompletableFuture<OAuthToken> handle(Map<String, String> params) {
    AuthenticationCodeFlowHandler authHandler =
        AuthenticationCodeFlowHandler.getInstance(
            SecurityConfigurationManager.getCurrentAuthConfig(),
            SecurityConfigurationManager.getCurrentAuthzConfig());
    OidcClient oidcClient = authHandler.getClient();
    String grantType = params.get("grant_type");
    String clientId = // params.get("client_id");
        oidcClient.getConfiguration().getClientId();
    String clientSecret = // params.get("client_secret");
        oidcClient.getConfiguration().getSecret();

    if (grantType == null || clientId == null) {
      return CompletableFuture.failedFuture(
          new TokenException("invalid_request", "Missing required parameters"));
    }

    // Authenticate client
    return clientAuthenticator
        .authenticate(clientId, clientSecret)
        .thenCompose(
            client -> {
              // Check if grant type is supported
              if (!client.getGrantTypes().contains(grantType)) {
                return CompletableFuture.failedFuture(
                    new TokenException(
                        "unsupported_grant_type",
                        "Unsupported grant type (supported grant types are "
                            + client.getGrantTypes()
                            + ")"));
              }

              // Handle different grant types
              if ("authorization_code".equals(grantType)) {
                return handleAuthorizationCode(client, params);
              } else if ("refresh_token".equals(grantType)) {
                return handleRefreshToken(client, params);
              } else {
                return CompletableFuture.failedFuture(
                    new TokenException("unsupported_grant_type", "Unsupported grant type"));
              }
            });
  }

  /**
   * Handle authorization code grant type.
   * @param client The authenticated client
   * @param params The request parameters
   * @return A CompletableFuture that resolves to an OAuth token
   */
  private CompletableFuture<OAuthToken> handleAuthorizationCode(
      OAuthClientInformation client, Map<String, String> params) {

    String code = params.get("code");
    String redirectUri = params.get("redirect_uri");
    String codeVerifier = params.get("code_verifier");

    if (code == null || codeVerifier == null) {
      return CompletableFuture.failedFuture(
          new TokenException("invalid_request", "Missing required parameters"));
    }

    // Load authorization code
    return provider
        .loadAuthorizationCode(client, code)
        .thenCompose(
            authCode -> {
              //              if (authCode == null ||
              // !authCode.getClientId().equals(client.getClientId())) {
              //                return CompletableFuture.failedFuture(
              //                    new TokenException("invalid_grant", "Authorization code does not
              // exist"));
              //              }
              //
              //              // Check if code has expired
              //              if (authCode.getExpiresAt() < Instant.now().getEpochSecond()) {
              //                return CompletableFuture.failedFuture(
              //                    new TokenException("invalid_grant", "Authorization code has
              // expired"));
              //              }

              // Verify redirect URI matches
              if (authCode.isRedirectUriProvidedExplicitly()) {
                if (redirectUri == null
                    || !redirectUri.equals(authCode.getRedirectUri().toString())) {
                  return CompletableFuture.failedFuture(
                      new TokenException(
                          "invalid_request",
                          "Redirect URI did not match the one used when creating auth code"));
                }
              }

              // Verify PKCE code verifier
              try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.UTF_8));
                String hashedCodeVerifier =
                    Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

                if (!hashedCodeVerifier.equals(authCode.getCodeChallenge())) {
                  return CompletableFuture.failedFuture(
                      new TokenException("invalid_grant", "Incorrect code_verifier"));
                }
              } catch (NoSuchAlgorithmException e) {
                return CompletableFuture.failedFuture(
                    new TokenException("server_error", "Failed to verify code challenge"));
              }

              // Exchange authorization code for tokens
              try {
                return provider.exchangeAuthorizationCode(client, authCode);
              } catch (TokenException e) {
                return CompletableFuture.failedFuture(e);
              }
            });
  }

  /**
   * Handle refresh token grant type.
   * @param client The authenticated client
   * @param params The request parameters
   * @return A CompletableFuture that resolves to an OAuth token
   */
  private CompletableFuture<OAuthToken> handleRefreshToken(
      OAuthClientInformation client, Map<String, String> params) {

    String refreshTokenStr = params.get("refresh_token");
    String scope = params.get("scope");

    if (refreshTokenStr == null) {
      return CompletableFuture.failedFuture(
          new TokenException("invalid_request", "Missing refresh_token parameter"));
    }

    // Load refresh token
    return provider
        .loadRefreshToken(client, refreshTokenStr)
        .thenCompose(
            refreshToken -> {
              if (refreshToken == null
                  || !refreshToken.getClientId().equals(client.getClientId())) {
                return CompletableFuture.failedFuture(
                    new TokenException("invalid_grant", "Refresh token does not exist"));
              }

              // Check if token has expired
              if (refreshToken.getExpiresAt() != null
                  && refreshToken.getExpiresAt() < Instant.now().getEpochSecond()) {
                return CompletableFuture.failedFuture(
                    new TokenException("invalid_grant", "Refresh token has expired"));
              }

              // Parse scopes if provided
              List<String> scopes =
                  scope != null ? Arrays.asList(scope.split(" ")) : refreshToken.getScopes();

              // Validate requested scopes against refresh token scopes
              if (scopes != null) {
                for (String s : scopes) {
                  if (!refreshToken.getScopes().contains(s)) {
                    return CompletableFuture.failedFuture(
                        new TokenException(
                            "invalid_scope",
                            "Cannot request scope `" + s + "` not provided by refresh token"));
                  }
                }
              }

              // Exchange refresh token for new tokens
              try {
                return provider.exchangeRefreshToken(client, refreshToken, scopes);
              } catch (TokenException e) {
                return CompletableFuture.failedFuture(e);
              }
            });
  }
}
