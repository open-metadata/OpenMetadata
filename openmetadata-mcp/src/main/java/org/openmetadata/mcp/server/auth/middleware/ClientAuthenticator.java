package org.openmetadata.mcp.server.auth.middleware;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;

/**
 * Authenticator for OAuth clients.
 */
public class ClientAuthenticator {

  private final OAuthAuthorizationServerProvider provider;

  public ClientAuthenticator(OAuthAuthorizationServerProvider provider) {
    this.provider = provider;
  }

  /**
   * Authenticate a client using client ID and optional client secret.
   * @param clientId The client ID
   * @param clientSecret The client secret (may be null)
   * @return A CompletableFuture that resolves to the authenticated client information
   */
  public CompletableFuture<OAuthClientInformation> authenticate(
      String clientId, String clientSecret) {
    if (clientId == null) {
      return CompletableFuture.failedFuture(
          new AuthenticationException("Missing client_id parameter"));
    }

    return provider
        .getClient(clientId)
        .thenCompose(
            client -> {
              if (client == null) {
                return CompletableFuture.failedFuture(
                    new AuthenticationException("Client not found"));
              }

              // If client has a secret, verify it using constant-time comparison
              if (client.getClientSecret() != null) {
                if (clientSecret == null) {
                  return CompletableFuture.failedFuture(
                      new AuthenticationException("Client secret required"));
                }

                // Use MessageDigest.isEqual() for constant-time comparison to prevent timing
                // attacks
                byte[] expectedBytes = client.getClientSecret().getBytes(StandardCharsets.UTF_8);
                byte[] providedBytes = clientSecret.getBytes(StandardCharsets.UTF_8);

                if (!MessageDigest.isEqual(expectedBytes, providedBytes)) {
                  return CompletableFuture.failedFuture(
                      new AuthenticationException("Invalid client secret"));
                }
              }

              return CompletableFuture.completedFuture(client);
            });
  }

  /**
   * Exception thrown when client authentication fails.
   */
  public static class AuthenticationException extends Exception {

    public AuthenticationException(String message) {
      super(message);
    }
  }
}
