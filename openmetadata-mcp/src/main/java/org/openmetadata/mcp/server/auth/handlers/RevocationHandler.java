package org.openmetadata.mcp.server.auth.handlers;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiPredicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;

/**
 * Handler for OAuth token revocation requests (RFC 7009).
 *
 * <p>This handler processes token revocation requests and ensures RFC 7009 compliance by:
 * - Returning success (200 OK) even if the token is not found
 * - Supporting both access and refresh token revocation
 * - Using token_type_hint to pick which token type is looked up first
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
   * token has been revoked successfully or if the client submitted an invalid token. A token issued
   * to another client is left alone and answered the same way, so the answer never tells a client
   * that someone else's token exists.
   * ADR:2026-10-29-mcp-access-tokens-are-stored-so-revoke-reaches-every-server
   *
   * @param token The token to revoke
   * @param tokenTypeHint Optional hint about the token type ("access_token" or "refresh_token")
   * @param clientId The authenticated client asking; only its own tokens are revoked
   * @return CompletableFuture that completes when revocation is done
   */
  public CompletableFuture<Void> revokeToken(String token, String tokenTypeHint, String clientId) {
    return CompletableFuture.runAsync(
        () -> {
          if (token == null || token.trim().isEmpty()) {
            LOG.debug("Revocation request with empty token");
            return;
          }

          // The hint only decides which lookup runs first: RFC 7009 section 2.1 extends the search
          // to the other type when the token is not found under the hinted one.
          List<BiPredicate<String, String>> lookups =
              "access_token".equals(tokenTypeHint)
                  ? List.of(
                      tokenRepository::revokeAccessTokenIssuedTo,
                      tokenRepository::revokeRefreshTokenIssuedTo)
                  : List.of(
                      tokenRepository::revokeRefreshTokenIssuedTo,
                      tokenRepository::revokeAccessTokenIssuedTo);

          boolean revoked = false;
          Exception lastError = null;
          for (BiPredicate<String, String> lookup : lookups) {
            if (!revoked) {
              try {
                revoked = lookup.test(token, clientId);
              } catch (Exception e) {
                // Database or other error - unexpected
                LOG.warn("Database error while revoking token: {}", e.getMessage());
                lastError = e;
              }
            }
          }

          if (!revoked && lastError != null) {
            // If we couldn't revoke and had a database error, propagate it
            throw new RuntimeException("Token revocation failed due to database error", lastError);
          }

          if (!revoked) {
            LOG.debug("Token not found in database (RFC 7009 compliance: return success)");
          }
        });
  }
}
