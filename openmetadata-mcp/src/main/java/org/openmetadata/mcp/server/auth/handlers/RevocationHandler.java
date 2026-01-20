package org.openmetadata.mcp.server.auth.handlers;

import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;

/**
 * Handler for OAuth token revocation requests (RFC 7009).
 *
 * <p>This handler processes token revocation requests and ensures RFC 7009 compliance by:
 * - Returning success (200 OK) even if the token is not found
 * - Supporting both access and refresh token revocation
 * - Honoring token_type_hint when provided
 */
@Slf4j
public class RevocationHandler {

  private final OAuthTokenRepository tokenRepository;

  public RevocationHandler(OAuthTokenRepository tokenRepository) {
    this.tokenRepository = tokenRepository;
  }

  /**
   * Revoke a token (access or refresh).
   *
   * <p>RFC 7009 compliance: The authorization server responds with HTTP status code 200 if the
   * token has been revoked successfully or if the client submitted an invalid token.
   *
   * @param token The token to revoke
   * @param tokenTypeHint Optional hint about the token type ("access_token" or "refresh_token")
   * @return CompletableFuture that completes when revocation is done
   */
  public CompletableFuture<Void> revokeToken(String token, String tokenTypeHint) {
    return CompletableFuture.runAsync(
        () -> {
          try {
            if (token == null || token.trim().isEmpty()) {
              LOG.debug("Revocation request with empty token");
              return;
            }

            boolean revoked = false;

            if ("refresh_token".equals(tokenTypeHint) || tokenTypeHint == null) {
              try {
                tokenRepository.revokeRefreshToken(token);
                LOG.debug("Successfully revoked refresh token");
                revoked = true;
              } catch (Exception e) {
                LOG.debug("Token not found as refresh token: {}", e.getMessage());
              }
            }

            if (!revoked && ("access_token".equals(tokenTypeHint) || tokenTypeHint == null)) {
              try {
                tokenRepository.deleteAccessToken(token);
                LOG.debug("Successfully revoked access token");
                revoked = true;
              } catch (Exception e) {
                LOG.debug("Token not found as access token: {}", e.getMessage());
              }
            }

            if (!revoked) {
              LOG.debug("Token not found in database (RFC 7009 compliance: return success)");
            }
          } catch (Exception e) {
            LOG.error("Error during token revocation: {}", e.getMessage(), e);
          }
        });
  }
}
