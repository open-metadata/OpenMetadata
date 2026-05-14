package org.openmetadata.mcp.server.auth.middleware;

import at.favre.lib.crypto.bcrypt.BCrypt;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;

/**
 * Authenticates OAuth clients by verifying client_id and client_secret.
 * Client secrets are stored as BCrypt hashes — only verification is possible, not recovery.
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

              // If client has a secret (stored as BCrypt hash), verify it
              if (client.getClientSecret() != null) {
                if (clientSecret == null) {
                  return CompletableFuture.failedFuture(
                      new AuthenticationException("Client secret required"));
                }

                BCrypt.Result result =
                    BCrypt.verifyer().verify(clientSecret.toCharArray(), client.getClientSecret());
                if (!result.verified) {
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
