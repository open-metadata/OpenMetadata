package org.openmetadata.mcp.server.auth.middleware;

import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.AccessToken;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;

/**
 * Authenticator for OAuth bearer tokens.
 */
public class BearerAuthenticator {

  private final OAuthAuthorizationServerProvider provider;

  private final String expectedAudience;

  public BearerAuthenticator(OAuthAuthorizationServerProvider provider) {
    this(provider, null);
  }

  public BearerAuthenticator(OAuthAuthorizationServerProvider provider, String expectedAudience) {
    this.provider = provider;
    this.expectedAudience = expectedAudience;
  }

  /**
   * Authenticate a request using a bearer token.
   * @param authHeader The Authorization header value
   * @return A CompletableFuture that resolves to the authenticated access token
   */
  public CompletableFuture<AccessToken> authenticate(String authHeader) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      return CompletableFuture.failedFuture(
          new AuthenticationException("Missing or invalid Authorization header"));
    }

    String token = authHeader.substring("Bearer ".length()).trim();
    if (token.isEmpty()) {
      return CompletableFuture.failedFuture(new AuthenticationException("Empty bearer token"));
    }

    return provider
        .loadAccessToken(token)
        .thenCompose(
            accessToken -> {
              if (accessToken == null) {
                return CompletableFuture.failedFuture(
                    new AuthenticationException("Invalid access token"));
              }

              // Check if token has expired
              if (accessToken.getExpiresAt() != null
                  && accessToken.getExpiresAt() < System.currentTimeMillis() / 1000) {
                return CompletableFuture.failedFuture(
                    new AuthenticationException("Access token has expired"));
              }

              // Validate audience if expectedAudience is configured (RFC 8707)
              if (expectedAudience != null && !expectedAudience.isEmpty()) {
                if (accessToken.getAudience() == null
                    || !accessToken.getAudience().contains(expectedAudience)) {
                  return CompletableFuture.failedFuture(
                      new AuthenticationException(
                          "Token audience mismatch - token not intended for this resource server"));
                }
              }

              return CompletableFuture.completedFuture(accessToken);
            });
  }

  /**
   * Exception thrown when bearer authentication fails.
   */
  public static class AuthenticationException extends Exception {

    public AuthenticationException(String message) {
      super(message);
    }
  }
}
