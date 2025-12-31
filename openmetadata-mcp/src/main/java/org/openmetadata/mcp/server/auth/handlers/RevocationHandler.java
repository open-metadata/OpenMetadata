package org.openmetadata.mcp.server.auth.handlers;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.server.auth.middleware.ClientAuthenticator;

/**
 * Handler for OAuth token revocation requests.
 */
public class RevocationHandler {

  private final OAuthAuthorizationServerProvider provider;

  private final ClientAuthenticator clientAuthenticator;

  public RevocationHandler(
      OAuthAuthorizationServerProvider provider, ClientAuthenticator clientAuthenticator) {
    this.provider = provider;
    this.clientAuthenticator = clientAuthenticator;
  }

  /**
   * Handle a token revocation request.
   * @param params The request parameters
   * @return A CompletableFuture that completes when the token is revoked
   */
  public CompletableFuture<Void> handle(Map<String, String> params) {
    String token = params.get("token");
    String tokenTypeHint = params.get("token_type_hint");
    String clientId = params.get("client_id");
    String clientSecret = params.get("client_secret");

    if (token == null || clientId == null) {
      CompletableFuture<Void> future = new CompletableFuture<>();
      future.completeExceptionally(new IllegalArgumentException("Missing required parameters"));
      return future;
    }

    // Authenticate client
    return clientAuthenticator
        .authenticate(clientId, clientSecret)
        .thenCompose(
            client -> {
              // Try to load token based on token_type_hint
              if ("refresh_token".equals(tokenTypeHint)) {
                return provider
                    .loadRefreshToken(client, token)
                    .thenCompose(
                        refreshToken -> {
                          if (refreshToken != null
                              && refreshToken.getClientId().equals(client.getClientId())) {
                            return provider.revokeToken(refreshToken);
                          }
                          return CompletableFuture.completedFuture(null);
                        });
              } else if ("access_token".equals(tokenTypeHint) || tokenTypeHint == null) {
                return provider
                    .loadAccessToken(token)
                    .thenCompose(
                        accessToken -> {
                          if (accessToken != null
                              && accessToken.getClientId().equals(client.getClientId())) {
                            return provider.revokeToken(accessToken);
                          }
                          return CompletableFuture.completedFuture(null);
                        });
              } else {
                // Unknown token type hint
                return CompletableFuture.completedFuture(null);
              }
            });
  }
}
