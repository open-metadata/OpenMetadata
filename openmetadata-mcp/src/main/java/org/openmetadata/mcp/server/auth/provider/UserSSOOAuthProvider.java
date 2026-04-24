package org.openmetadata.mcp.server.auth.provider;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.getHttpSession;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.mcp.server.auth.handlers.RevocationHandler;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.mcp.server.auth.util.UriUtils;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAuthorizationCodeRecord;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * Unified OAuth provider for user authentication with MCP supporting both SSO and Basic Auth.
 *
 * <p>This provider integrates OpenMetadata's authentication system with MCP OAuth. It auto-detects
 * the authentication method based on OpenMetadata configuration and handles:
 *
 * <ol>
 *   <li><b>SSO Flow:</b> Redirects to SSO provider (Google, Okta, Azure, etc.), handles callback,
 *       and generates authorization codes
 *   <li><b>Basic Auth Flow:</b> Displays login form, validates username/password, displays
 *       authorization code to user for manual copy
 *   <li>Generates MCP authorization codes linked to authenticated users
 *   <li>Issues OpenMetadata JWT tokens after code exchange
 *   <li>Maintains PKCE security for public clients
 * </ol>
 *
 * <p><b>Key Design:</b> Single provider that auto-detects authentication method from
 * SecurityConfigurationManager. Authorization codes map to user identities (user_name), enabling
 * seamless authentication for tools like Claude Desktop.
 *
 * @see org.openmetadata.service.security.AuthenticationCodeFlowHandler
 * @see org.openmetadata.service.security.auth.AuthenticatorHandler
 * @see org.openmetadata.service.security.jwt.JWTTokenGenerator
 */
@Slf4j
public class UserSSOOAuthProvider implements OAuthAuthorizationServerProvider {

  private static final int AUTH_CODE_EXPIRY_SECONDS = 600;

  // Short-lived access tokens (10 minutes) limit the exposure window when a refresh token
  // is revoked. Since JWTs are stateless and cannot be individually invalidated, a shorter
  // TTL ensures that a revoked session loses access within 10 minutes. MCP clients handle
  // automatic token refresh seamlessly using the long-lived refresh token.
  private static final long JWT_EXPIRY_SECONDS = 600L;

  private static final long REFRESH_TOKEN_EXPIRY_DAYS = 30L;
  private static final long REFRESH_TOKEN_EXPIRY_SECONDS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

  private final JWTTokenGenerator jwtGenerator;
  private final AuthenticatorHandler credentialAuthenticator;

  private final OAuthClientRepository clientRepository;
  private final OAuthAuthorizationCodeRepository codeRepository;
  private final OAuthTokenRepository tokenRepository;
  private final McpPendingAuthRequestRepository pendingAuthRepository;
  private final RevocationHandler revocationHandler;

  // Thread-safe storage for request/response to prevent race conditions in concurrent requests
  private final ThreadLocal<HttpServletRequest> currentRequest = new ThreadLocal<>();
  private final ThreadLocal<HttpServletResponse> currentResponse = new ThreadLocal<>();

  // Cryptographically secure random number generator for authorization codes and tokens
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  public UserSSOOAuthProvider(
      JWTTokenGenerator jwtGenerator, AuthenticatorHandler credentialAuthenticator) {
    this.jwtGenerator = jwtGenerator;
    this.credentialAuthenticator = credentialAuthenticator;

    this.clientRepository = new OAuthClientRepository();
    this.codeRepository = new OAuthAuthorizationCodeRepository();
    this.tokenRepository = new OAuthTokenRepository();
    this.pendingAuthRepository = new McpPendingAuthRequestRepository();
    this.revocationHandler = new RevocationHandler(tokenRepository);

    LOG.info("Initialized UserSSOOAuthProvider with unified auth (SSO + Basic Auth)");
  }

  public AuthenticatorHandler getCredentialAuthenticator() {
    return credentialAuthenticator;
  }

  /**
   * Gets the SSO handler from SecurityConfigurationManager. This is resolved dynamically from
   * database configuration, allowing configuration changes without server restart.
   */
  private AuthenticationCodeFlowHandler getSsoHandler() {
    try {
      return AuthenticationCodeFlowHandler.getInstance();
    } catch (Exception e) {
      LOG.warn("SSO handler not available: {}", e.getMessage());
      return null;
    }
  }

  /**
   * Gets the base URL from MCP configuration or system settings. This is resolved dynamically from
   * database configuration.
   */
  private String getBaseUrl() {
    try {
      org.openmetadata.schema.api.configuration.MCPConfiguration mcpConfig =
          org.openmetadata.service.security.auth.SecurityConfigurationManager.getCurrentMcpConfig();
      if (mcpConfig != null && mcpConfig.getBaseUrl() != null) {
        return mcpConfig.getBaseUrl();
      }
    } catch (Exception e) {
      LOG.warn("Failed to get base URL from MCP config: {}", e.getMessage());
    }

    // Fallback to system settings
    try {
      org.openmetadata.service.jdbi3.SystemRepository systemRepo =
          org.openmetadata.service.Entity.getSystemRepository();
      org.openmetadata.schema.settings.Settings baseUrlSettings =
          systemRepo.getOMBaseUrlConfigInternal();
      if (baseUrlSettings != null) {
        org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration baseUrlConfig =
            (org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration)
                baseUrlSettings.getConfigValue();
        if (baseUrlConfig != null) {
          return baseUrlConfig.getOpenMetadataUrl();
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to get base URL from system settings: {}", e.getMessage());
    }

    LOG.error(
        "No base URL configured in MCP settings or system settings. "
            + "Falling back to http://localhost:8585 — this is only suitable for local development. "
            + "Configure a proper base URL for production deployments.");
    return "http://localhost:8585";
  }

  /**
   * Sets the request context for the current thread.
   *
   * <p>IMPORTANT: Must call {@link #clearRequestContext()} after request processing to prevent
   * memory leaks.
   */
  public void setRequestContext(HttpServletRequest request, HttpServletResponse response) {
    this.currentRequest.set(request);
    this.currentResponse.set(response);
  }

  /** Clears the request context from the current thread to prevent memory leaks. */
  public void clearRequestContext() {
    this.currentRequest.remove();
    this.currentResponse.remove();
  }

  @Override
  public CompletableFuture<Void> registerClient(OAuthClientInformation clientInfo)
      throws RegistrationException {
    clientRepository.register(clientInfo);
    LOG.info("Registered OAuth client: {}", clientInfo.getClientId());
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public CompletableFuture<OAuthClientInformation> getClient(String clientId) {
    OAuthClientInformation client = clientRepository.findByClientId(clientId);
    return CompletableFuture.completedFuture(client);
  }

  @Override
  public CompletableFuture<String> authorize(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    try {
      if (currentRequest.get() == null || currentResponse.get() == null) {
        throw new AuthorizeException(
            "server_error", "Request context not set. Cannot proceed with authorization.");
      }

      AuthProvider provider = SecurityConfigurationManager.getCurrentAuthConfig().getProvider();
      LOG.info(
          "Starting authorization flow for client: {} with auth provider: {}",
          client.getClientId(),
          provider);

      if (provider == AuthProvider.BASIC || provider == AuthProvider.LDAP) {
        return handleBasicAuthAuthorization(client, params);
      } else {
        return handleSSOAuthorization(client, params);
      }

    } catch (AuthorizeException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Authorization failed for client: {}", client.getClientId(), e);
      throw new AuthorizeException("authorization_failed", "Authorization request failed");
    }
  }

  private CompletableFuture<String> handleSSOAuthorization(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    AuthenticationCodeFlowHandler ssoHandler = getSsoHandler();
    if (ssoHandler == null) {
      throw new AuthorizeException(
          "server_error", "SSO authentication is not available. SSO handler not initialized.");
    }

    try {
      LOG.info(
          "Starting SSO authorization flow for client: {} with PKCE challenge",
          client.getClientId());

      // Validate PKCE code challenge before storage
      String codeChallenge = params.getCodeChallenge();
      if (codeChallenge == null || codeChallenge.trim().isEmpty()) {
        LOG.error(
            "Missing PKCE code challenge in authorization request for client: {}",
            client.getClientId());
        throw new AuthorizeException(
            "invalid_request", "PKCE code_challenge is required but was not provided");
      }

      // Validate code challenge format: base64url encoded, 43-128 characters (per RFC 7636)
      if (!codeChallenge.matches("^[A-Za-z0-9_-]{43,128}$")) {
        LOG.error(
            "Invalid PKCE code challenge format for client: {}: {}",
            client.getClientId(),
            codeChallenge);
        throw new AuthorizeException(
            "invalid_request",
            "PKCE code_challenge has invalid format (must be base64url encoded, 43-128 characters)");
      }

      // Validate redirect URI against registered URIs (OAuth 2.0 security requirement)
      URI validatedRedirectUri;
      try {
        validatedRedirectUri = client.validateRedirectUri(params.getRedirectUri());
      } catch (Exception e) {
        LOG.error(
            "Redirect URI validation failed for client {}: {}",
            client.getClientId(),
            e.getMessage());
        throw new AuthorizeException(
            "invalid_request",
            "Redirect URI '"
                + params.getRedirectUri()
                + "' is not registered for this client. Register this URI before using it.");
      }

      // Store PKCE params in database (survives cross-domain redirect cookie loss)
      List<String> scopes =
          params.getScopes() != null ? params.getScopes() : List.of("openid", "profile", "email");
      String authRequestId =
          pendingAuthRepository.createPendingRequest(
              client.getClientId(),
              codeChallenge,
              "S256",
              validatedRedirectUri.toString(),
              params.getState(),
              scopes,
              null,
              null,
              null);

      LOG.debug("Created pending auth request: {}", authRequestId);

      // Use serverUrl + "/mcp/callback" as the redirectUri parameter for MCP flow detection.
      // AuthenticationCodeFlowHandler.handleLogin() matches this against expectedMcpCallback
      // to detect MCP flow, then uses the SSO-registered callback URL for the actual redirect_uri
      // sent to the SSO provider. After auth, AuthCallbackServlet forwards to /mcp/callback.
      String serverUrl =
          SecurityConfigurationManager.getCurrentAuthConfig().getOidcConfiguration().getServerUrl();
      String mcpCallbackUrl = serverUrl + "/mcp/callback";
      LOG.info("Starting SSO redirect for MCP OAuth (MCP callback: {})", mcpCallbackUrl);

      HttpServletRequest wrappedRequest =
          new HttpServletRequestWrapper(currentRequest.get()) {
            @Override
            public String getParameter(String name) {
              if ("redirectUri".equals(name)) {
                return mcpCallbackUrl;
              }
              return super.getParameter(name);
            }

            @Override
            public Map<String, String[]> getParameterMap() {
              Map<String, String[]> params = new HashMap<>(super.getParameterMap());
              params.put("redirectUri", new String[] {mcpCallbackUrl});
              return params;
            }
          };

      HttpSession session = getHttpSession(currentRequest.get(), true);
      session.setAttribute("mcp.auth.request.id", authRequestId);

      ssoHandler.handleLogin(wrappedRequest, currentResponse.get());

      // After handleLogin(), pac4j has stored its state in the session
      // Extract pac4j session attributes and store in database
      // Note: pac4j stores State and CodeVerifier as objects, not strings
      String pac4jState = null;
      String pac4jNonce = null;
      String pac4jCodeVerifier = null;

      java.util.Enumeration<String> attrNames = session.getAttributeNames();
      while (attrNames.hasMoreElements()) {
        String attrName = attrNames.nextElement();
        Object value = session.getAttribute(attrName);
        LOG.debug(
            "Session attribute: {} = {} (type: {})",
            attrName,
            value,
            value != null ? value.getClass().getName() : "null");

        if (attrName.contains("state") || attrName.contains("State")) {
          // State is stored as com.nimbusds.oauth2.sdk.id.State object
          if (value instanceof com.nimbusds.oauth2.sdk.id.State stateObj) {
            pac4jState = stateObj.getValue();
            LOG.debug("Found pac4j state: {}", pac4jState);
          } else if (value instanceof String) {
            pac4jState = (String) value;
            LOG.debug("Found pac4j state (string): {}", pac4jState);
          }
        } else if (attrName.contains("nonce") || attrName.contains("Nonce")) {
          // Nonce is stored as String
          if (value instanceof String) {
            pac4jNonce = (String) value;
            LOG.debug("Found pac4j nonce");
          }
        } else if (attrName.contains("CodeVerifier")
            || attrName.contains("codeVerifier")
            || attrName.contains("pkce")) {
          // CodeVerifier is stored as com.nimbusds.oauth2.sdk.pkce.CodeVerifier object
          if (value instanceof com.nimbusds.oauth2.sdk.pkce.CodeVerifier verifierObj) {
            pac4jCodeVerifier = verifierObj.getValue();
            LOG.debug("Found pac4j code verifier");
          } else if (value instanceof String) {
            pac4jCodeVerifier = (String) value;
            LOG.debug("Found pac4j code verifier (string)");
          }
        }
      }

      if (pac4jState != null) {
        pendingAuthRepository.updatePac4jSession(
            authRequestId, pac4jState, pac4jNonce, pac4jCodeVerifier);
        LOG.info("Stored pac4j session data in database for auth request: {}", authRequestId);
      } else {
        LOG.error("Could not find pac4j state in session after handleLogin()");
        throw new AuthorizeException("server_error", "Failed to initialize SSO session state");
      }

      return CompletableFuture.completedFuture("SSO_REDIRECT_INITIATED");

    } catch (AuthorizeException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("SSO authorization failed for client: {}", client.getClientId(), e);
      throw new AuthorizeException("authorization_failed", "SSO authorization failed");
    }
  }

  private CompletableFuture<String> handleBasicAuthAuthorization(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    try {
      LOG.info("Starting Basic Auth authorization flow for client: {}", client.getClientId());

      // Validate redirect URI against registered URIs
      URI validatedRedirectUri;
      try {
        validatedRedirectUri = client.validateRedirectUri(params.getRedirectUri());
      } catch (Exception e) {
        LOG.error(
            "Redirect URI validation failed for client {}: {}",
            client.getClientId(),
            e.getMessage());
        throw new AuthorizeException(
            "invalid_request",
            "Redirect URI '" + params.getRedirectUri() + "' is not registered for this client.");
      }

      // Validate PKCE code challenge before storage (same validation as SSO path)
      String codeChallenge = params.getCodeChallenge();
      if (codeChallenge == null || codeChallenge.trim().isEmpty()) {
        throw new AuthorizeException(
            "invalid_request", "PKCE code_challenge is required but was not provided");
      }
      if (!codeChallenge.matches("^[A-Za-z0-9_-]{43,128}$")) {
        throw new AuthorizeException(
            "invalid_request",
            "PKCE code_challenge has invalid format (must be base64url encoded, 43-128 characters)");
      }

      // Store PKCE params in DB (same as SSO flow — survives cross-domain redirects)
      List<String> scopes =
          params.getScopes() != null ? params.getScopes() : List.of("openid", "profile", "email");
      String authRequestId =
          pendingAuthRepository.createPendingRequest(
              client.getClientId(),
              codeChallenge,
              "S256",
              validatedRedirectUri.toString(),
              params.getState(),
              scopes,
              null,
              null,
              null);

      LOG.debug("Created pending auth request for Basic Auth: {}", authRequestId);

      // Return redirect URL — MCP client opens this in user's browser
      String loginUrl = getBaseUrl() + "/mcp/login?auth_request_id=" + authRequestId;
      return CompletableFuture.completedFuture(loginUrl);

    } catch (AuthorizeException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Basic Auth authorization failed for client: {}", client.getClientId(), e);
      throw new AuthorizeException("authorization_failed", "Basic Auth authorization failed");
    }
  }

  /**
   * Handle SSO callback using database-backed state lookup. This method survives cross-domain
   * redirects where HTTP session cookies may be lost due to SameSite cookie policies.
   *
   * @param request The HTTP request from Google callback
   * @param response The HTTP response to redirect to client
   * @param userName The authenticated user's username from Google ID token
   * @param email The authenticated user's email from Google ID token
   * @param ssoState The state parameter from Google callback (contains "mcp:{authRequestId}")
   */
  public void handleSSOCallbackWithDbState(
      HttpServletRequest request,
      HttpServletResponse response,
      String userName,
      String email,
      String ssoState)
      throws Exception {

    // HIGH: Validate user identity from SSO provider
    if (userName == null || userName.trim().isEmpty()) {
      LOG.error("SECURITY ALERT: SSO callback received null or empty username");
      throw new IllegalStateException(
          "Invalid SSO response: username is required but was not provided by identity provider");
    }

    if (email == null || email.trim().isEmpty()) {
      LOG.error("SECURITY ALERT: SSO callback received null or empty email for user: {}", userName);
      throw new IllegalStateException(
          "Invalid SSO response: email is required but was not provided by identity provider");
    }

    LOG.debug("SSO callback received valid user identity");

    // Verify user exists in OpenMetadata BEFORE generating an auth code.
    // Without this check, non-OM users who authenticate via SSO see the success page
    // but then fail silently at token exchange with a confusing "invalid_grant" error.
    // getEntityByName throws EntityNotFoundException (never returns null).
    try {
      Entity.getEntityByName(Entity.USER, userName, "", Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      LOG.warn("SSO-authenticated user not found in OpenMetadata. Denying access.");
      LOG.debug("Denied user details: {}", userName);
      response.setStatus(HttpServletResponse.SC_FORBIDDEN);
      response.setContentType("text/html; charset=UTF-8");
      response
          .getWriter()
          .write(
              "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">"
                  + "<style>"
                  + "body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;"
                  + "display:flex;justify-content:center;align-items:center;min-height:100vh;"
                  + "margin:0;background:#f5f5f5;color:#333}"
                  + ".card{text-align:center;background:#fff;border-radius:12px;"
                  + "padding:48px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:480px}"
                  + "h1{color:#c62828;margin:0 0 12px}"
                  + "p{margin:4px 0;color:#666}"
                  + "</style></head><body>"
                  + "<div class=\"card\">"
                  + "<h1>Access Denied</h1>"
                  + "<p>Your account is not registered in OpenMetadata.</p>"
                  + "<p>Please contact your administrator to get access.</p>"
                  + "<p style=\"font-size:13px;margin-top:16px\">You can close this window.</p>"
                  + "</div></body></html>");
      return;
    }

    // Extract authRequestId from composite state
    if (ssoState == null || !ssoState.startsWith("mcp:")) {
      throw new IllegalStateException("Invalid or missing MCP state in SSO callback");
    }

    String authRequestId = ssoState.substring(4); // Remove "mcp:" prefix
    LOG.debug("Looking up pending auth request: {}", authRequestId);

    // Lookup pending request from database
    McpPendingAuthRequest pendingRequest = pendingAuthRepository.findByAuthRequestId(authRequestId);
    if (pendingRequest == null) {
      throw new IllegalStateException(
          "Pending auth request not found or expired: " + authRequestId);
    }

    // Load client to validate redirect URI (security: prevent open redirect)
    OAuthClientInformation client = clientRepository.findByClientId(pendingRequest.clientId());
    if (client == null) {
      throw new IllegalStateException(
          "Client not found for pending auth request: " + pendingRequest.clientId());
    }

    // Validate redirect URI against registered URIs to prevent open redirect attacks
    URI requestedRedirectUri = URI.create(pendingRequest.redirectUri());
    try {
      client.validateRedirectUri(requestedRedirectUri);
    } catch (Exception e) {
      LOG.error(
          "SECURITY ALERT: Redirect URI validation failed in SSO callback for client {}: {}. "
              + "This may indicate an attack or configuration error.",
          client.getClientId(),
          e.getMessage());
      throw new IllegalStateException(
          "Redirect URI validation failed: "
              + e.getMessage()
              + ". The redirect URI may have been tampered with.",
          e);
    }

    // Generate MCP authorization code
    String authCode =
        generateAuthorizationCode(
            userName,
            pendingRequest.clientId(),
            pendingRequest.codeChallenge(),
            requestedRedirectUri,
            pendingRequest.scopes());

    LOG.debug("Generated MCP authorization code via SSO");

    // Build redirect URL with MCP state (original client state, not SSO state)
    // Properly encode query parameters to prevent injection attacks
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("code", authCode);
    if (pendingRequest.mcpState() != null) {
      queryParams.put("state", pendingRequest.mcpState());
    }
    String redirectUrl = UriUtils.constructRedirectUri(pendingRequest.redirectUri(), queryParams);

    // Serve an HTML success page that auto-redirects to the client callback.
    // A raw 302 redirect leaves the SSO provider's login page visible in the browser
    // (e.g., Azure's "Enter password" form stuck with loading dots). By serving our own
    // HTML page first, the browser replaces the SSO page with a clear success message.
    LOG.info("Serving success page with redirect to client callback");
    serveSuccessPage(response, redirectUrl);

    // Best-effort cleanup — failure here doesn't affect the user
    try {
      pendingAuthRepository.delete(authRequestId);
    } catch (Exception e) {
      LOG.warn(
          "Failed to clean up pending auth request {}, will be removed by cleanup job: {}",
          authRequestId,
          e.getMessage());
    }
  }

  @Override
  public CompletableFuture<OAuthToken> exchangeAuthorizationCode(
      OAuthClientInformation client, AuthorizationCode authCode) throws TokenException {
    try {
      LOG.info("Exchanging authorization code for JWT token with PKCE validation");

      String code = authCode.getCode();
      String codeVerifier = authCode.getCodeVerifier();

      if (code == null || code.isEmpty()) {
        throw new TokenException("invalid_request", "Missing authorization code");
      }

      if (codeVerifier == null || codeVerifier.isEmpty()) {
        throw new TokenException("invalid_request", "Missing code_verifier (PKCE required)");
      }

      // RFC 7636: code_verifier must be 43-128 characters
      if (codeVerifier.length() < 43 || codeVerifier.length() > 128) {
        throw new TokenException(
            "invalid_request", "code_verifier must be between 43 and 128 characters per RFC 7636");
      }

      // Look up the code record first (read-only) to validate expiry before consuming it.
      // This prevents burning valid codes on expired requests.
      OAuthAuthorizationCodeRecord codeRecord = codeRepository.findByCode(code);
      if (codeRecord == null) {
        String clientIP =
            currentRequest.get() != null ? currentRequest.get().getRemoteAddr() : "unknown";
        LOG.error(
            "SECURITY ALERT: Authorization code not found! "
                + "Client: {}, IP: {}. Code may be non-existent or previously deleted.",
            client.getClientId(),
            clientIP);
        throw new TokenException("invalid_grant", "Authorization code invalid or already used");
      }

      // Check expiry BEFORE atomic consumption so expired codes aren't burned
      if (System.currentTimeMillis() > codeRecord.expiresAt()) {
        long expiredSecondsAgo = (System.currentTimeMillis() - codeRecord.expiresAt()) / 1000;
        LOG.warn(
            "Authorization code expired {} seconds ago. Expiration time: {}, Client: {}",
            expiredSecondsAgo,
            new java.util.Date(codeRecord.expiresAt()),
            client.getClientId());
        throw new TokenException(
            "invalid_grant",
            "Authorization code expired "
                + expiredSecondsAgo
                + " seconds ago. Please restart the authorization flow.");
      }

      // Atomically mark as used — prevents replay attacks.
      // NOTE: Consuming BEFORE PKCE verification is intentional per RFC 6749 §4.1.2 (single-use).
      // If PKCE verification fails after consumption, the client must restart the flow. This is
      // the safer tradeoff: consuming after PKCE would allow unlimited retry attacks on intercepted
      // codes (attacker brute-forces code_verifier). See also RFC 7636 §4.6.
      OAuthAuthorizationCodeRecord usedRecord = codeRepository.markAsUsedAtomic(code);
      if (usedRecord == null) {
        String clientIP =
            currentRequest.get() != null ? currentRequest.get().getRemoteAddr() : "unknown";
        LOG.error(
            "SECURITY ALERT: Authorization code replay attack detected! "
                + "Client: {}, IP: {}. Code was already used by a concurrent request.",
            client.getClientId(),
            clientIP);
        throw new TokenException("invalid_grant", "Authorization code invalid or already used");
      }

      // CRITICAL: Validate client ID matches (prevents authorization code theft attack)
      if (!client.getClientId().equals(usedRecord.clientId())) {
        String clientIP =
            currentRequest.get() != null ? currentRequest.get().getRemoteAddr() : "unknown";
        LOG.error(
            "SECURITY ALERT: Authorization code theft attack detected! "
                + "Code issued to client '{}' but presented by client '{}'. IP: {}",
            usedRecord.clientId(),
            client.getClientId(),
            clientIP);
        throw new TokenException(
            "invalid_grant", "Authorization code was issued to a different client");
      }

      // CRITICAL: Validate redirect URI matches (RFC 6749 Section 4.1.3)
      // redirect_uri is always stored during authorization — reject if missing as a safety net
      String storedRedirectUri = usedRecord.redirectUri();
      URI requestRedirectUri = authCode.getRedirectUri();
      if (storedRedirectUri == null || storedRedirectUri.isEmpty()) {
        LOG.error(
            "SECURITY ALERT: Authorization code has no stored redirect_uri. "
                + "This should never happen — the authorization endpoint always stores redirect_uri.");
        throw new TokenException(
            "server_error", "Authorization code has no associated redirect URI");
      }
      if (requestRedirectUri == null) {
        throw new TokenException(
            "invalid_request",
            "redirect_uri is required when it was included in the authorization request");
      }
      if (!requestRedirectUri.toString().equals(storedRedirectUri)) {
        LOG.error(
            "SECURITY ALERT: Redirect URI mismatch in token exchange! "
                + "Authorization used '{}' but token request used '{}'",
            storedRedirectUri,
            requestRedirectUri);
        throw new TokenException(
            "invalid_grant", "Redirect URI in token request does not match authorization request");
      }

      if (!verifyPKCE(codeVerifier, usedRecord.codeChallenge())) {
        LOG.warn("PKCE verification failed");
        throw new TokenException("invalid_grant", "Code verifier does not match code challenge");
      }

      String userName = usedRecord.userName();
      LOG.debug("Generating JWT token");

      User user;
      try {
        user = Entity.getEntityByName(Entity.USER, userName, "roles,teams", Include.NON_DELETED);
      } catch (EntityNotFoundException e) {
        throw new TokenException("invalid_grant", "User not found or deactivated");
      }

      JWTAuthMechanism jwtAuth =
          jwtGenerator.generateJWTToken(
              userName,
              getRoleListFromUser(user),
              !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
              user.getEmail(),
              JWT_EXPIRY_SECONDS,
              false,
              ServiceTokenType.OM_USER,
              usedRecord.scopes());

      // Generate cryptographically secure refresh token (32 bytes = 256 bits) for long-lived
      // sessions (OAuth 2.0 RFC 6749)
      String refreshTokenValue = generateSecureToken(32);
      long refreshExpiresAt = System.currentTimeMillis() + (REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

      RefreshToken refreshToken =
          new RefreshToken(
              refreshTokenValue, client.getClientId(), usedRecord.scopes(), refreshExpiresAt);

      // Store refresh token in database (hashed and encrypted)
      tokenRepository.storeRefreshToken(
          refreshToken, client.getClientId(), userName, usedRecord.scopes());

      LOG.debug(
          "Generated refresh token for user: {} (expires in {} days)",
          userName,
          REFRESH_TOKEN_EXPIRY_DAYS);

      // Prepare OAuth token response with both access token and refresh token
      OAuthToken token = new OAuthToken();
      token.setAccessToken(jwtAuth.getJWTToken());
      token.setTokenType("Bearer");
      token.setExpiresIn((int) JWT_EXPIRY_SECONDS);
      token.setRefreshToken(refreshTokenValue);
      token.setScope(String.join(" ", usedRecord.scopes()));

      LOG.debug("Successfully issued JWT and refresh token");
      return CompletableFuture.completedFuture(token);

    } catch (TokenException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Token exchange failed", e);
      throw new TokenException("server_error", "Token exchange failed");
    }
  }

  @Override
  public CompletableFuture<AuthorizationCode> loadAuthorizationCode(
      OAuthClientInformation client, String code) {
    try {
      OAuthAuthorizationCodeRecord record = codeRepository.findByCode(code);
      if (record == null) {
        return CompletableFuture.completedFuture(null);
      }

      AuthorizationCode authCode = new AuthorizationCode();
      authCode.setCode(record.code());
      authCode.setClientId(record.clientId());
      authCode.setCodeChallenge(record.codeChallenge());
      authCode.setExpiresAt(record.expiresAt());
      authCode.setRedirectUri(
          record.redirectUri() != null ? java.net.URI.create(record.redirectUri()) : null);
      authCode.setScopes(record.scopes() != null ? record.scopes() : List.of());

      return CompletableFuture.completedFuture(authCode);
    } catch (Exception e) {
      LOG.error("Failed to load authorization code", e);
      return CompletableFuture.failedFuture(e);
    }
  }

  @Override
  public CompletableFuture<RefreshToken> loadRefreshToken(
      OAuthClientInformation client, String refreshToken) {
    // Refresh token validation happens in exchangeRefreshToken which verifies JWT directly
    // This method is not used in the current implementation
    return CompletableFuture.failedFuture(
        new UnsupportedOperationException(
            "loadRefreshToken not implemented - use exchangeRefreshToken instead"));
  }

  @Override
  public CompletableFuture<OAuthToken> exchangeRefreshToken(
      OAuthClientInformation client, RefreshToken refreshToken, List<String> scopes)
      throws TokenException {
    try {
      LOG.info("Exchanging refresh token for new access token (client: {})", client.getClientId());

      String refreshTokenValue = refreshToken.getToken();
      if (refreshTokenValue == null || refreshTokenValue.isEmpty()) {
        throw new TokenException("invalid_request", "Missing refresh token");
      }

      // Load refresh token from database
      RefreshToken tokenRecord = tokenRepository.findRefreshToken(refreshTokenValue);
      if (tokenRecord == null) {
        LOG.warn("Refresh token not found - may have been revoked or expired");
        throw new TokenException("invalid_grant", "Refresh token is invalid, revoked, or expired");
      }

      // Validate token is not expired
      if (System.currentTimeMillis() > tokenRecord.getExpiresAt()) {
        LOG.warn("Refresh token expired for user: {}", tokenRecord.getUserName());
        throw new TokenException(
            "invalid_grant",
            "Refresh token has expired. Please re-authenticate to obtain a new token.");
      }

      // Validate client ID matches the original authorization
      if (!client.getClientId().equals(tokenRecord.getClientId())) {
        LOG.error(
            "Client ID mismatch: token issued to {}, requested by {}",
            tokenRecord.getClientId(),
            client.getClientId());
        throw new TokenException(
            "invalid_grant",
            "Refresh token was issued to a different client. Cross-client token use is not allowed.");
      }

      // Validate scope downgrading (cannot request more scopes than originally granted)
      List<String> originalScopes = tokenRecord.getScopes();
      List<String> requestedScopes =
          (scopes != null && !scopes.isEmpty()) ? scopes : originalScopes;

      if (!originalScopes.containsAll(requestedScopes)) {
        LOG.warn(
            "Scope expansion attempted: original={}, requested={}",
            originalScopes,
            requestedScopes);
        throw new TokenException(
            "invalid_scope",
            "Requested scopes exceed originally granted scopes. Scope expansion is not allowed.");
      }

      String userName = tokenRecord.getUserName();
      LOG.debug("Refresh token validated successfully (rotating token)");

      User user;
      try {
        user = Entity.getEntityByName(Entity.USER, userName, "roles,teams", Include.NON_DELETED);
      } catch (EntityNotFoundException e) {
        LOG.warn("User account not found during refresh token exchange. Revoking token.");
        tokenRepository.revokeRefreshToken(refreshTokenValue);
        throw new TokenException(
            "invalid_grant",
            "User account has been deleted or deactivated. Please re-authenticate.");
      }

      LOG.debug("User status validated, proceeding with token rotation");

      // Generate cryptographically secure new refresh token (32 bytes = 256 bits)
      String newRefreshTokenValue = generateSecureToken(32);
      long newRefreshExpiresAt = System.currentTimeMillis() + (REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

      RefreshToken newRefreshToken =
          new RefreshToken(
              newRefreshTokenValue, client.getClientId(), requestedScopes, newRefreshExpiresAt);

      // Atomic CAS rotation: atomically revoke the old token, then store the new one.
      // If a concurrent request already consumed this token, CAS fails and we reject.
      try {
        tokenRepository.rotateRefreshToken(
            refreshTokenValue, newRefreshToken, client.getClientId(), userName, requestedScopes);
      } catch (OAuthTokenRepository.TokenRotationException e) {
        LOG.warn("Concurrent refresh token use detected for user: {}", userName);
        throw new TokenException("invalid_grant", "Refresh token has already been used");
      }
      LOG.debug("Refresh token rotated for user: {}", userName);

      LOG.debug(
          "New refresh token generated for user: {} (expires in {} days)",
          userName,
          REFRESH_TOKEN_EXPIRY_DAYS);

      JWTAuthMechanism jwtAuth =
          jwtGenerator.generateJWTToken(
              userName,
              getRoleListFromUser(user),
              !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
              user.getEmail(),
              JWT_EXPIRY_SECONDS,
              false,
              ServiceTokenType.OM_USER,
              requestedScopes);

      // Prepare OAuth token response with both new access token and new refresh token
      OAuthToken token = new OAuthToken();
      token.setAccessToken(jwtAuth.getJWTToken());
      token.setTokenType("Bearer");
      token.setExpiresIn((int) JWT_EXPIRY_SECONDS);
      token.setRefreshToken(newRefreshTokenValue); // Return NEW refresh token (rotation)
      token.setScope(String.join(" ", requestedScopes));

      LOG.debug("Successfully refreshed tokens (JWT + new refresh token)");
      return CompletableFuture.completedFuture(token);

    } catch (TokenException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Refresh token exchange failed unexpectedly", e);
      throw new TokenException("server_error", "Token refresh failed");
    }
  }

  @Override
  public CompletableFuture<AccessToken> loadAccessToken(String token) {
    // Access token validation happens through JwtFilter which verifies JWT directly
    // This method is not used in the current implementation
    return CompletableFuture.failedFuture(
        new UnsupportedOperationException(
            "loadAccessToken not implemented - tokens are validated via JwtFilter"));
  }

  @Override
  public CompletableFuture<Void> revokeToken(Object token) {
    LOG.info("Token revocation requested");
    if (token == null) {
      return CompletableFuture.failedFuture(
          new TokenException("invalid_request", "Token cannot be null"));
    }

    String tokenString = token.toString();
    return revocationHandler.revokeToken(tokenString, null);
  }

  public String createAuthorizationCode(
      String userName,
      String clientId,
      String codeChallenge,
      URI redirectUri,
      List<String> scopes) {
    return generateAuthorizationCode(userName, clientId, codeChallenge, redirectUri, scopes);
  }

  private String generateAuthorizationCode(
      String userName,
      String clientId,
      String codeChallenge,
      URI redirectUri,
      List<String> scopes) {
    // Generate cryptographically secure authorization code (32 bytes = 256 bits)
    String code = generateSecureToken(32);
    long expiresAt = System.currentTimeMillis() + (AUTH_CODE_EXPIRY_SECONDS * 1000);

    codeRepository.store(
        code, clientId, userName, codeChallenge, "S256", redirectUri, scopes, expiresAt);

    LOG.debug(
        "Generated authorization code for user: {} with {}-second expiry",
        userName,
        AUTH_CODE_EXPIRY_SECONDS);
    return code;
  }

  /**
   * Generates a cryptographically secure random token using SecureRandom.
   * Used for authorization codes, refresh tokens, and CSRF tokens.
   *
   * @param numBytes Number of random bytes to generate (e.g., 32 for 256 bits of entropy)
   * @return URL-safe base64-encoded random string
   */
  private static String generateSecureToken(int numBytes) {
    byte[] tokenBytes = new byte[numBytes];
    SECURE_RANDOM.nextBytes(tokenBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
  }

  /**
   * Serves an HTML success page that auto-redirects to the client callback URL.
   * A raw 302 redirect leaves the SSO provider's login page visible in the browser
   * (e.g., Azure's "Enter password" form stuck with loading dots). By serving our own
   * HTML page first, the browser replaces the SSO page with a clear success message.
   */
  private void serveSuccessPage(HttpServletResponse response, String redirectUrl)
      throws IOException {
    response.setStatus(HttpServletResponse.SC_OK);
    response.setContentType("text/html; charset=UTF-8");

    // Escape for two different contexts: HTML attribute and JavaScript string literal.
    // The redirect URL is constructed from validated inputs (UriUtils.constructRedirectUri),
    // but defense-in-depth requires proper context-aware escaping.
    String htmlSafe = escapeForHtmlAttribute(redirectUrl);
    String jsSafe = escapeForJavaScriptString(redirectUrl);

    response
        .getWriter()
        .write(
            "<!DOCTYPE html><html><head>"
                + "<meta charset=\"UTF-8\">"
                + "<meta http-equiv=\"refresh\" content=\"1;url="
                + htmlSafe
                + "\">"
                + "<style>"
                + "body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;"
                + "display:flex;justify-content:center;align-items:center;min-height:100vh;"
                + "margin:0;background:#f5f5f5;color:#333}"
                + ".card{text-align:center;background:#fff;border-radius:12px;"
                + "padding:48px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}"
                + "h1{color:#2e7d32;margin:0 0 12px}"
                + "p{margin:4px 0;color:#666}"
                + "</style></head><body>"
                + "<div class=\"card\">"
                + "<h1>Authentication Successful</h1>"
                + "<p>Redirecting back to your application...</p>"
                + "<p style=\"font-size:13px;margin-top:16px\">"
                + "If you are not redirected automatically, you can close this window.</p>"
                + "</div>"
                + "<script>setTimeout(function(){window.location.href=\""
                + jsSafe
                + "\"},500);</script>"
                + "</body></html>");
  }

  private static String escapeForHtmlAttribute(String value) {
    return value
        .replace("&", "&amp;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")
        .replace("<", "&lt;")
        .replace(">", "&gt;");
  }

  private static String escapeForJavaScriptString(String value) {
    return value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("<", "\\x3c")
        .replace(">", "\\x3e");
  }

  private boolean verifyPKCE(String codeVerifier, String codeChallenge) {
    if (codeVerifier == null || codeChallenge == null) {
      LOG.warn("PKCE verification failed: code_verifier or code_challenge is null");
      return false;
    }
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
      String computedChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

      // Use timing-safe comparison to prevent timing attacks on PKCE challenges
      boolean matches =
          MessageDigest.isEqual(
              computedChallenge.getBytes(StandardCharsets.UTF_8),
              codeChallenge.getBytes(StandardCharsets.UTF_8));
      if (!matches) {
        LOG.warn("PKCE verification failed: computed challenge does not match stored challenge");
      }
      return matches;

    } catch (NoSuchAlgorithmException e) {
      LOG.error("PKCE verification system error: SHA-256 not available", e);
      throw new IllegalStateException("SHA-256 algorithm not available", e);
    }
  }
}
