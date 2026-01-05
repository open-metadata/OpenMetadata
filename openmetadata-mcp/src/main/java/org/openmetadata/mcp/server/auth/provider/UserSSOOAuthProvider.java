package org.openmetadata.mcp.server.auth.provider;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.AuthorizationParams;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthToken;
import org.openmetadata.mcp.auth.TokenRequest;
import org.openmetadata.mcp.auth.exception.AuthorizeException;
import org.openmetadata.mcp.auth.exception.RegistrationException;
import org.openmetadata.mcp.auth.exception.TokenException;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * MVP/Prototype OAuth provider for user SSO authentication with MCP.
 *
 * <p>This is a simplified working prototype that demonstrates the concept of integrating
 * OpenMetadata's existing SSO system with MCP OAuth. Full implementation details are tracked in:
 * openmetadata-mcp/docs/IMPLEMENTATION_TODO.md
 *
 * <p><b>Key Concept:</b> Instead of managing connector OAuth credentials (Snowflake/Databricks),
 * this provider:
 *
 * <ol>
 *   <li>Delegates user authentication to OpenMetadata's SSO (Google, Okta, Azure, etc.)
 *   <li>Issues OpenMetadata JWT tokens after successful SSO login
 *   <li>Maps authorization codes to user identities (not connectors)
 *   <li>Maintains backward compatibility with PAT authentication
 * </ol>
 *
 * <p><b>Status:</b> MVP - Needs completion of authorize() and exchangeAuthorizationCode() methods.
 *
 * <p><b>TODO:</b> See IMPLEMENTATION_TODO.md sections #1-8 for critical implementation tasks.
 *
 * @see org.openmetadata.service.security.AuthenticationCodeFlowHandler
 * @see org.openmetadata.service.security.jwt.JWTTokenGenerator
 */
@Slf4j
public class UserSSOOAuthProvider implements OAuthAuthorizationServerProvider {

  private final AuthenticationCodeFlowHandler ssoHandler;
  private final JWTTokenGenerator jwtGenerator;
  private final String baseUrl;

  // Database repositories for OAuth persistence
  private final OAuthClientRepository clientRepository;
  private final OAuthAuthorizationCodeRepository codeRepository;
  private final OAuthTokenRepository tokenRepository;

  /**
   * Creates a new UserSSOOAuthProvider.
   *
   * @param ssoHandler Handler for OpenMetadata SSO authentication (Google, Okta, Azure, etc.)
   * @param jwtGenerator Generator for OpenMetadata JWT tokens
   * @param baseUrl Base URL of the OpenMetadata server (e.g., http://localhost:8585)
   */
  public UserSSOOAuthProvider(
      AuthenticationCodeFlowHandler ssoHandler, JWTTokenGenerator jwtGenerator, String baseUrl) {
    this.ssoHandler = ssoHandler;
    this.jwtGenerator = jwtGenerator;
    this.baseUrl = baseUrl;

    // Initialize database repositories
    this.clientRepository = new OAuthClientRepository();
    this.codeRepository = new OAuthAuthorizationCodeRepository();
    this.tokenRepository = new OAuthTokenRepository();

    LOG.info(
        "Initialized UserSSOOAuthProvider with user SSO authentication and baseUrl: {}", baseUrl);
  }

  @Override
  public CompletableFuture<Void> registerClient(OAuthClientInformation clientInfo)
      throws RegistrationException {
    // Client registration implementation (works as-is from oauth-mcp)
    clientRepository.register(clientInfo);
    LOG.info("Registered OAuth client: {}", clientInfo.getClientId());
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public CompletableFuture<OAuthClientInformation> getClient(String clientId) {
    // Client retrieval implementation (works as-is from oauth-mcp)
    OAuthClientInformation client = clientRepository.findByClientId(clientId);
    return CompletableFuture.completedFuture(client);
  }

  /**
   * CRITICAL METHOD: Initiates SSO authentication flow for user.
   *
   * <p><b>TODO:</b> This is the heart of the SSO integration. Implementation needed:
   *
   * <ol>
   *   <li>Store PKCE challenge, state, redirect_uri in HTTP session
   *   <li>Call ssoHandler.handleLogin() to get SSO provider redirect URL
   *   <li>Redirect user to SSO provider (Google/Okta/Azure) for authentication
   *   <li>SSO provider redirects back to /mcp/callback with SSO authorization code
   *   <li>SSOCallbackHandler exchanges SSO code for ID token
   *   <li>Extract user identity from ID token
   *   <li>Generate MCP authorization code linked to user_name
   *   <li>Store code in oauth_authorization_codes table with user_name
   *   <li>Redirect to client's redirect_uri with MCP authorization code
   * </ol>
   *
   * <p><b>Reference:</b> See IMPLEMENTATION_TODO.md section #1 for detailed requirements.
   *
   * @param client The OAuth client information (e.g., claude-desktop)
   * @param params Authorization parameters (code_challenge, redirect_uri, state, scope)
   * @return CompletableFuture with SSO redirect URL (NOT an authorization code directly)
   * @throws AuthorizeException if SSO authentication fails
   */
  @Override
  public CompletableFuture<String> authorize(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    try {
      LOG.info(
          "Starting SSO authorization flow for client: {} with PKCE challenge",
          client.getClientId());

      // TODO: CRITICAL - Implement SSO redirect logic
      // 1. Store PKCE params in session (code_challenge, state, redirect_uri)
      // 2. Build SSO authorization URL via ssoHandler
      // 3. Return redirect URL to SSO provider
      //
      // For now, return a placeholder that will fail gracefully
      throw new AuthorizeException(
          "MVP_NOT_IMPLEMENTED",
          "User SSO OAuth is not fully implemented yet. "
              + "See openmetadata-mcp/docs/IMPLEMENTATION_TODO.md section #1 for implementation details. "
              + "Current state: MVP skeleton only.");

    } catch (Exception e) {
      LOG.error("SSO authorization failed for client: {}", client.getClientId(), e);
      throw new AuthorizeException("authorization_failed", e.getMessage());
    }
  }

  /**
   * CRITICAL METHOD: Exchanges authorization code for JWT token.
   *
   * <p><b>TODO:</b> Implement token exchange with user identity.
   *
   * <ol>
   *   <li>Retrieve authorization code from database
   *   <li>Verify PKCE: SHA-256(code_verifier) == stored code_challenge
   *   <li>Atomically mark code as used (prevent replay attacks)
   *   <li>Extract user_name from authorization code record
   *   <li>Generate OpenMetadata JWT via jwtGenerator.generateJWTToken(user_name, ...)
   *   <li>Store access token in oauth_access_tokens with user_name
   *   <li>Return OAuth token response with JWT as access_token
   * </ol>
   *
   * <p><b>Reference:</b> See IMPLEMENTATION_TODO.md section #4 for detailed requirements.
   *
   * @param request Token request containing authorization code and PKCE code_verifier
   * @return OAuth token with JWT access_token and refresh_token
   * @throws TokenException if token exchange fails
   */
  @Override
  public CompletableFuture<OAuthToken> exchangeAuthorizationCode(TokenRequest request)
      throws TokenException {
    try {
      LOG.info("Exchanging authorization code for JWT token with PKCE validation");

      // TODO: CRITICAL - Implement token exchange logic
      // 1. Load authorization code from database
      // 2. Verify PKCE code_verifier
      // 3. Mark code as used atomically
      // 4. Extract user_name from code
      // 5. Generate JWT with user identity
      // 6. Return OAuth token response
      //
      // For now, return a placeholder that will fail gracefully
      throw new TokenException(
          "MVP_NOT_IMPLEMENTED",
          "Token exchange not fully implemented yet. "
              + "See openmetadata-mcp/docs/IMPLEMENTATION_TODO.md section #4 for implementation details.");

    } catch (Exception e) {
      LOG.error("Token exchange failed", e);
      throw new TokenException("invalid_grant", e.getMessage());
    }
  }

  /**
   * Refreshes an access token using a refresh token.
   *
   * <p><b>TODO:</b> Implement refresh token flow.
   *
   * <p><b>Reference:</b> See IMPLEMENTATION_TODO.md section #13 for detailed requirements.
   *
   * @param refreshToken The refresh token to use
   * @return New OAuth token with refreshed access_token
   * @throws TokenException if refresh fails
   */
  @Override
  public CompletableFuture<OAuthToken> refreshAccessToken(String refreshToken)
      throws TokenException {
    LOG.info("Refresh token flow requested");

    // TODO: Implement refresh token flow
    // 1. Validate refresh token from database
    // 2. Extract user_name from refresh token
    // 3. Generate new JWT with same user identity
    // 4. Rotate refresh token (optional but recommended)
    // 5. Return new access_token
    throw new TokenException(
        "MVP_NOT_IMPLEMENTED",
        "Refresh token flow not implemented yet. " + "See IMPLEMENTATION_TODO.md section #13.");
  }

  /**
   * Revokes a token (logout).
   *
   * <p><b>TODO:</b> Implement token revocation.
   *
   * <p><b>Reference:</b> See IMPLEMENTATION_TODO.md section #14 for detailed requirements.
   *
   * @param token The token to revoke
   * @throws TokenException if revocation fails
   */
  @Override
  public CompletableFuture<Void> revokeToken(String token) throws TokenException {
    LOG.info("Token revocation requested");

    // TODO: Implement token revocation
    // 1. Mark token as revoked in database
    // 2. Invalidate any associated refresh tokens
    // 3. Clear any cached token data
    throw new TokenException(
        "MVP_NOT_IMPLEMENTED",
        "Token revocation not implemented yet. " + "See IMPLEMENTATION_TODO.md section #14.");
  }

  /**
   * Helper method to generate authorization code.
   *
   * <p>This is a utility method that will be used by the authorize() method once implemented.
   *
   * @param userName Username from SSO authentication
   * @param clientId OAuth client ID
   * @param codeChallenge PKCE code challenge
   * @param redirectUri Client redirect URI
   * @param scopes Requested scopes
   * @return Generated authorization code
   */
  private String generateAuthorizationCode(
      String userName,
      String clientId,
      String codeChallenge,
      URI redirectUri,
      List<String> scopes) {
    String code = UUID.randomUUID().toString();
    long expiresAt = System.currentTimeMillis() + (10 * 60 * 1000); // 10 minutes

    codeRepository.store(
        code,
        clientId,
        userName, // Key change: store user_name instead of connector_name
        userName, // user_name field
        codeChallenge,
        "S256", // Always use S256 for PKCE
        redirectUri,
        scopes,
        expiresAt);

    LOG.debug("Generated authorization code for user: {} with 10-minute expiry", userName);
    return code;
  }

  /**
   * Helper method to generate JWT token for user.
   *
   * <p>This is a utility method that will be used by exchangeAuthorizationCode() once
   * implemented.
   *
   * @param userName Username to generate token for
   * @param expiryInSeconds Token expiry duration in seconds
   * @return Generated JWT token string
   */
  private String generateJWTForUser(String userName, int expiryInSeconds) {
    // TODO: Call jwtGenerator.generateJWTToken() with proper parameters
    // - userName: from authorization code
    // - roles: fetch from user service
    // - isAdmin: fetch from user service
    // - email: fetch from user service
    // - expiryInSeconds: 3600 (1 hour) or configurable
    // - isBot: false (this is a user token, not a bot token)
    // - tokenType: OM_USER

    LOG.debug("Generating JWT for user: {} with {}s expiry", userName, expiryInSeconds);

    // Placeholder - actual implementation needed
    throw new UnsupportedOperationException(
        "JWT generation not implemented. See IMPLEMENTATION_TODO.md section #1.");
  }

  /**
   * Helper method to verify PKCE code verifier.
   *
   * @param codeVerifier Code verifier from client
   * @param codeChallenge Code challenge from authorization request
   * @return true if PKCE verification succeeds
   */
  private boolean verifyPKCE(String codeVerifier, String codeChallenge) {
    try {
      // Compute SHA-256 hash of code_verifier
      java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
      byte[] hash =
          digest.digest(codeVerifier.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
      String computedChallenge =
          java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

      boolean matches = computedChallenge.equals(codeChallenge);
      if (!matches) {
        LOG.warn("PKCE verification failed: computed challenge does not match stored challenge");
      }
      return matches;

    } catch (Exception e) {
      LOG.error("PKCE verification error", e);
      return false;
    }
  }
}
