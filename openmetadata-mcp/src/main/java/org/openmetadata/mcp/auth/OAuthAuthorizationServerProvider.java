package org.openmetadata.mcp.auth;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.mcp.auth.exception.AuthorizeException;
import org.openmetadata.mcp.auth.exception.RegistrationException;
import org.openmetadata.mcp.auth.exception.TokenException;

/**
 * Interface for OAuth authorization server providers.
 */
public interface OAuthAuthorizationServerProvider {

  /**
   * Retrieves client information by client ID.
   * @param clientId The ID of the client to retrieve.
   * @return A CompletableFuture that resolves to the client information, or null if the
   * client does not exist.
   */
  CompletableFuture<OAuthClientInformation> getClient(String clientId);

  /**
   * Saves client information as part of registering it.
   * @param clientInfo The client metadata to register.
   * @return A CompletableFuture that completes when the registration is done.
   * @throws RegistrationException If the client metadata is invalid.
   */
  CompletableFuture<Void> registerClient(OAuthClientInformation clientInfo)
      throws RegistrationException;

  /**
   * Called as part of the /authorize endpoint, and returns a URL that the client will
   * be redirected to.
   * @param client The client requesting authorization.
   * @param params The parameters of the authorization request.
   * @return A CompletableFuture that resolves to a URL to redirect the client to for
   * authorization.
   * @throws AuthorizeException If the authorization request is invalid.
   */
  CompletableFuture<String> authorize(OAuthClientInformation client, AuthorizationParams params)
      throws AuthorizeException;

  /**
   * Loads an AuthorizationCode by its code.
   * @param client The client that requested the authorization code.
   * @param authorizationCode The authorization code to get the challenge for.
   * @return A CompletableFuture that resolves to the AuthorizationCode, or null if not
   * found.
   */
  CompletableFuture<AuthorizationCode> loadAuthorizationCode(
      OAuthClientInformation client, String authorizationCode);

  /**
   * Exchanges an authorization code for an access token and refresh token.
   * @param client The client exchanging the authorization code.
   * @param authorizationCode The authorization code to exchange.
   * @return A CompletableFuture that resolves to the OAuth token, containing access and
   * refresh tokens.
   * @throws TokenException If the request is invalid.
   */
  CompletableFuture<OAuthToken> exchangeAuthorizationCode(
      OAuthClientInformation client, AuthorizationCode authorizationCode) throws TokenException;

  /**
   * Loads a RefreshToken by its token string.
   * @param client The client that is requesting to load the refresh token.
   * @param refreshToken The refresh token string to load.
   * @return A CompletableFuture that resolves to the RefreshToken object if found, or
   * null if not found.
   */
  CompletableFuture<RefreshToken> loadRefreshToken(
      OAuthClientInformation client, String refreshToken);

  /**
   * Exchanges a refresh token for an access token and refresh token.
   * @param client The client exchanging the refresh token.
   * @param refreshToken The refresh token to exchange.
   * @param scopes Optional scopes to request with the new access token.
   * @return A CompletableFuture that resolves to the OAuth token, containing access and
   * refresh tokens.
   * @throws TokenException If the request is invalid.
   */
  CompletableFuture<OAuthToken> exchangeRefreshToken(
      OAuthClientInformation client, RefreshToken refreshToken, List<String> scopes)
      throws TokenException;

  /**
   * Loads an access token by its token.
   * @param token The access token to verify.
   * @return A CompletableFuture that resolves to the AccessToken, or null if the token
   * is invalid.
   */
  CompletableFuture<AccessToken> loadAccessToken(String token);

  /**
   * Revokes an access or refresh token.
   * @param token The token to revoke.
   * @return A CompletableFuture that completes when the token is revoked.
   */
  CompletableFuture<Void> revokeToken(Object token);
}
