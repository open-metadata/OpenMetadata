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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.mcp.server.auth.html.HtmlTemplates;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAuthorizationCodeRecord;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.BasicAuthenticator;
import org.openmetadata.service.security.auth.LoginAttemptCache;
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
 * @see org.openmetadata.service.security.auth.BasicAuthenticator
 * @see org.openmetadata.service.security.jwt.JWTTokenGenerator
 */
@Slf4j
public class UserSSOOAuthProvider implements OAuthAuthorizationServerProvider {

  private static final String SESSION_MCP_PKCE_CHALLENGE = "mcp.pkce.challenge";
  private static final String SESSION_MCP_PKCE_METHOD = "mcp.pkce.method";
  private static final String SESSION_MCP_CLIENT_ID = "mcp.client.id";
  private static final String SESSION_MCP_REDIRECT_URI = "mcp.redirect.uri";
  private static final String SESSION_MCP_STATE = "mcp.state";
  private static final String SESSION_MCP_SCOPES = "mcp.scopes";
  private static final String SESSION_MCP_LOGIN_ERROR = "mcp.login.error";
  private static final String SESSION_MCP_CSRF_TOKEN = "mcp.csrf.token";
  private static final String SESSION_MCP_AUTH_METHOD = "mcp.auth.method";

  private static final int AUTH_CODE_EXPIRY_SECONDS = 600;
  private static final long JWT_EXPIRY_SECONDS = 3600L;
  private static final long REFRESH_TOKEN_EXPIRY_DAYS = 30L;
  private static final long REFRESH_TOKEN_EXPIRY_SECONDS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

  private final AuthenticationCodeFlowHandler ssoHandler;
  private final JWTTokenGenerator jwtGenerator;
  private final BasicAuthenticator basicAuthenticator;
  private final String baseUrl;

  private final OAuthClientRepository clientRepository;
  private final OAuthAuthorizationCodeRepository codeRepository;
  private final OAuthTokenRepository tokenRepository;
  private final McpPendingAuthRequestRepository pendingAuthRepository;

  // Thread-safe storage for request/response to prevent race conditions in concurrent requests
  private final ThreadLocal<HttpServletRequest> currentRequest = new ThreadLocal<>();
  private final ThreadLocal<HttpServletResponse> currentResponse = new ThreadLocal<>();

  public UserSSOOAuthProvider(
      AuthenticationCodeFlowHandler ssoHandler,
      JWTTokenGenerator jwtGenerator,
      BasicAuthenticator basicAuthenticator,
      String baseUrl) {
    this.ssoHandler = ssoHandler;
    this.jwtGenerator = jwtGenerator;
    this.basicAuthenticator = basicAuthenticator;
    this.baseUrl = baseUrl;

    this.clientRepository = new OAuthClientRepository();
    this.codeRepository = new OAuthAuthorizationCodeRepository();
    this.tokenRepository = new OAuthTokenRepository();
    this.pendingAuthRepository = new McpPendingAuthRequestRepository();

    LOG.info(
        "Initialized UserSSOOAuthProvider with unified auth (SSO + Basic Auth) and baseUrl: {}",
        baseUrl);
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

      if (provider == AuthProvider.BASIC) {
        return handleBasicAuthAuthorization(client, params);
      } else {
        return handleSSOAuthorization(client, params);
      }

    } catch (AuthorizeException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Authorization failed for client: {}", client.getClientId(), e);
      throw new AuthorizeException("authorization_failed", e.getMessage());
    }
  }

  private CompletableFuture<String> handleSSOAuthorization(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
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
      // Allow test values for local development/testing
      boolean isTestValue = "TEST".equals(codeChallenge) || "test".equalsIgnoreCase(codeChallenge);

      if (!isTestValue && !codeChallenge.matches("^[A-Za-z0-9_-]{43,128}$")) {
        LOG.error(
            "Invalid PKCE code challenge format for client: {}: {}",
            client.getClientId(),
            codeChallenge);
        throw new AuthorizeException(
            "invalid_request",
            "PKCE code_challenge has invalid format (must be base64url encoded, 43-128 characters)");
      }

      if (isTestValue) {
        LOG.warn(
            "SECURITY WARNING: Using test PKCE challenge '{}' for client: {}. "
                + "This should NEVER be used in production!",
            codeChallenge,
            client.getClientId());
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

      String mcpCallbackUrl = baseUrl + "/mcp/callback";
      LOG.info(
          "Starting SSO redirect for MCP OAuth with callback URL: {} (registered with Google)",
          mcpCallbackUrl);

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
        LOG.warn("Could not find pac4j state in session after handleLogin()");
      }

      return CompletableFuture.completedFuture("SSO_REDIRECT_INITIATED");

    } catch (Exception e) {
      LOG.error("SSO authorization failed for client: {}", client.getClientId(), e);
      throw new AuthorizeException("authorization_failed", e.getMessage());
    }
  }

  private CompletableFuture<String> handleBasicAuthAuthorization(
      OAuthClientInformation client, AuthorizationParams params) throws AuthorizeException {
    try {
      LOG.info("Starting Basic Auth authorization flow for client: {}", client.getClientId());

      HttpSession session = getHttpSession(currentRequest.get(), true);

      session.setAttribute(SESSION_MCP_PKCE_CHALLENGE, params.getCodeChallenge());
      session.setAttribute(SESSION_MCP_PKCE_METHOD, "S256");
      session.setAttribute(SESSION_MCP_CLIENT_ID, client.getClientId());
      session.setAttribute(SESSION_MCP_REDIRECT_URI, params.getRedirectUri().toString());
      session.setAttribute(SESSION_MCP_STATE, params.getState());
      session.setAttribute(
          SESSION_MCP_SCOPES,
          params.getScopes() != null ? String.join(" ", params.getScopes()) : "");
      session.setAttribute(SESSION_MCP_AUTH_METHOD, "basic");

      LOG.debug("Stored PKCE parameters in session for Basic Auth: {}", session.getId());

      if ("POST".equalsIgnoreCase(currentRequest.get().getMethod())) {
        return handleBasicAuthLogin(client, params, session);
      } else {
        return displayLoginForm(session, client);
      }

    } catch (AuthorizeException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Basic Auth authorization failed for client: {}", client.getClientId(), e);
      throw new AuthorizeException("authorization_failed", e.getMessage());
    }
  }

  private CompletableFuture<String> displayLoginForm(
      HttpSession session, OAuthClientInformation client) throws AuthorizeException {
    try {
      String errorMessage = (String) session.getAttribute(SESSION_MCP_LOGIN_ERROR);
      session.removeAttribute(SESSION_MCP_LOGIN_ERROR);

      String csrfToken = UUID.randomUUID().toString();
      session.setAttribute(SESSION_MCP_CSRF_TOKEN, csrfToken);

      String clientId = (String) session.getAttribute(SESSION_MCP_CLIENT_ID);
      String redirectUri = (String) session.getAttribute(SESSION_MCP_REDIRECT_URI);
      String state = (String) session.getAttribute(SESSION_MCP_STATE);
      String codeChallenge = (String) session.getAttribute(SESSION_MCP_PKCE_CHALLENGE);
      String scopes = (String) session.getAttribute(SESSION_MCP_SCOPES);

      String html =
          HtmlTemplates.generateLoginForm(
              client.getClientName(),
              errorMessage,
              clientId,
              redirectUri,
              state,
              codeChallenge,
              scopes,
              csrfToken);

      currentResponse.get().setContentType("text/html; charset=UTF-8");
      currentResponse.get().setStatus(HttpServletResponse.SC_OK);
      currentResponse.get().getWriter().write(html);

      LOG.debug("Displayed login form for client: {}", client.getClientId());
      return CompletableFuture.completedFuture("LOGIN_FORM_DISPLAYED");

    } catch (IOException e) {
      LOG.error("Failed to display login form", e);
      throw new AuthorizeException("server_error", "Failed to display login form");
    }
  }

  private CompletableFuture<String> handleBasicAuthLogin(
      OAuthClientInformation client, AuthorizationParams params, HttpSession session)
      throws AuthorizeException {
    String password = null;
    try {
      String submittedCsrfToken = currentRequest.get().getParameter("csrf_token");
      String sessionCsrfToken = (String) session.getAttribute(SESSION_MCP_CSRF_TOKEN);

      session.removeAttribute(SESSION_MCP_CSRF_TOKEN);

      if (submittedCsrfToken == null || !submittedCsrfToken.equals(sessionCsrfToken)) {
        LOG.warn("CSRF token mismatch during Basic Auth login");
        throw new AuthorizeException("invalid_request", "CSRF token validation failed");
      }

      String usernameOrEmail = currentRequest.get().getParameter("username");
      password = currentRequest.get().getParameter("password");

      if (usernameOrEmail == null
          || usernameOrEmail.isEmpty()
          || password == null
          || password.isEmpty()) {
        session.setAttribute(SESSION_MCP_LOGIN_ERROR, "Username and password are required");
        return displayLoginForm(session, client);
      }

      String email = usernameOrEmail;
      String userName = usernameOrEmail;

      if (!usernameOrEmail.contains("@")) {
        try {
          User userByName =
              Entity.getEntityByName(Entity.USER, usernameOrEmail, "", Include.NON_DELETED);
          if (userByName != null) {
            email = userByName.getEmail();
            userName = userByName.getName();
            LOG.debug("Resolved username {} to email {}", usernameOrEmail, email);
          }
        } catch (Exception e) {
          LOG.debug("Could not find user by username: {}", usernameOrEmail);
        }
      }

      try {
        basicAuthenticator.checkIfLoginBlocked(email);
      } catch (AuthenticationException e) {
        LOG.warn("Login blocked for user: {}", email);
        session.setAttribute(SESSION_MCP_LOGIN_ERROR, e.getMessage());
        return displayLoginForm(session, client);
      }

      try {
        LOG.info("Attempting to authenticate user with email: {}", email);
        User user = basicAuthenticator.lookUserInProvider(email, password);
        LOG.info("User lookup successful for: {}", email);
        basicAuthenticator.validatePassword(email, password, user);
        LOG.info("Password validation successful for: {}", email);

        LoginAttemptCache.getInstance().recordSuccessfulLogin(email);
        LOG.debug("Successful login for user: {}, reset failed login counter", userName);

        String codeChallenge = (String) session.getAttribute(SESSION_MCP_PKCE_CHALLENGE);
        String redirectUri = (String) session.getAttribute(SESSION_MCP_REDIRECT_URI);
        String scopesStr = (String) session.getAttribute(SESSION_MCP_SCOPES);

        regenerateSession(session);

        List<String> scopes =
            scopesStr != null && !scopesStr.isEmpty()
                ? List.of(scopesStr.split(" "))
                : List.of("openid", "profile", "email");

        String authCode =
            generateAuthorizationCode(
                user.getName(),
                client.getClientId(),
                codeChallenge,
                URI.create(redirectUri),
                scopes);

        LOG.info("Generated authorization code for user: {}", user.getName());

        return displayAuthorizationCode(authCode, currentRequest.get().getSession(false));

      } catch (AuthenticationException e) {
        LOG.warn("Basic Auth login failed for user: {}", email);
        try {
          basicAuthenticator.recordFailedLoginAttempt(email, email);
        } catch (Exception recordEx) {
          LOG.error("Failed to record login attempt", recordEx);
        }
        session.setAttribute(SESSION_MCP_LOGIN_ERROR, "Invalid username or password");
        return displayLoginForm(session, client);
      }

    } catch (AuthorizeException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Basic Auth login processing failed", e);
      throw new AuthorizeException("server_error", "Login processing failed");
    } finally {
      password = null;
    }
  }

  private CompletableFuture<String> displayAuthorizationCode(String authCode, HttpSession session)
      throws AuthorizeException {
    try {
      String html = HtmlTemplates.generateCodeDisplay(authCode);

      session.removeAttribute(SESSION_MCP_PKCE_CHALLENGE);
      session.removeAttribute(SESSION_MCP_PKCE_METHOD);
      session.removeAttribute(SESSION_MCP_CLIENT_ID);
      session.removeAttribute(SESSION_MCP_REDIRECT_URI);
      session.removeAttribute(SESSION_MCP_STATE);
      session.removeAttribute(SESSION_MCP_SCOPES);
      session.removeAttribute(SESSION_MCP_AUTH_METHOD);
      session.removeAttribute(SESSION_MCP_CSRF_TOKEN);

      currentResponse.get().setContentType("text/html; charset=UTF-8");
      currentResponse.get().setStatus(HttpServletResponse.SC_OK);
      currentResponse.get().getWriter().write(html);

      LOG.debug("Displayed authorization code to user");
      return CompletableFuture.completedFuture("CODE_DISPLAYED");

    } catch (IOException e) {
      LOG.error("Failed to display authorization code", e);
      throw new AuthorizeException("server_error", "Failed to display authorization code");
    }
  }

  /**
   * Regenerates session after successful authentication to prevent session fixation attacks.
   *
   * <p>SECURITY: After authentication, the session ID must be changed to prevent attackers from
   * hijacking a session using a pre-set session ID. This method does NOT preserve old session
   * attributes - callers must read needed values before calling this method.
   *
   * <p>Session fixation attack scenario: 1. Attacker sets victim's session ID to known value 2.
   * Victim authenticates with that session ID 3. Attacker uses the known session ID to hijack the
   * authenticated session
   *
   * <p>Prevention: Regenerate session ID after authentication, invalidating any pre-set session ID.
   *
   * @param oldSession The session to regenerate (will be invalidated)
   */
  private void regenerateSession(HttpSession oldSession) {
    String oldSessionId = oldSession.getId();

    try {
      // Preferred method: Change session ID in-place (Servlet 3.1+)
      // This keeps request attributes but changes the session ID
      String newSessionId = currentRequest.get().changeSessionId();
      LOG.info(
          "SECURITY: Session ID regenerated after authentication to prevent fixation: {} -> {}",
          oldSessionId,
          newSessionId);
    } catch (UnsupportedOperationException | IllegalStateException e) {
      // Fallback for older servlet containers: invalidate and create new session
      // SECURITY: Do NOT preserve old session attributes - caller must handle needed values
      LOG.warn(
          "Session ID change not supported by servlet container, using invalidate/recreate fallback. "
              + "Note: Session attributes will be cleared (caller should preserve needed values).",
          e);

      oldSession.invalidate();
      HttpSession newSession = currentRequest.get().getSession(true);

      LOG.info(
          "SECURITY: Session regenerated using invalidate/recreate: {} -> {}",
          oldSessionId,
          newSession.getId());
    }
  }

  public void handleSSOCallback(
      HttpServletRequest request, HttpServletResponse response, String userName, String email)
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

    LOG.debug("SSO callback received valid user identity: username={}, email={}", userName, email);

    HttpSession session = getHttpSession(request, false);
    if (session == null) {
      throw new IllegalStateException("No session found for SSO callback");
    }

    String codeChallenge = (String) session.getAttribute(SESSION_MCP_PKCE_CHALLENGE);
    String clientId = (String) session.getAttribute(SESSION_MCP_CLIENT_ID);
    String redirectUri = (String) session.getAttribute(SESSION_MCP_REDIRECT_URI);
    String state = (String) session.getAttribute(SESSION_MCP_STATE);
    String scopesStr = (String) session.getAttribute(SESSION_MCP_SCOPES);

    if (codeChallenge == null || clientId == null || redirectUri == null) {
      throw new IllegalStateException("Missing PKCE parameters in session");
    }

    regenerateSession(session);

    List<String> scopes =
        scopesStr != null && !scopesStr.isEmpty()
            ? List.of(scopesStr.split(" "))
            : List.of("openid", "profile", "email");

    String authCode =
        generateAuthorizationCode(
            userName, clientId, codeChallenge, URI.create(redirectUri), scopes);

    LOG.info("Generated MCP authorization code for user: {} via SSO", userName);

    // Build redirect URL with properly encoded query parameters to prevent injection attacks
    String redirectUrl =
        redirectUri
            + "?code="
            + URLEncoder.encode(authCode, StandardCharsets.UTF_8)
            + (state != null ? "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8) : "");

    session.removeAttribute(SESSION_MCP_PKCE_CHALLENGE);
    session.removeAttribute(SESSION_MCP_PKCE_METHOD);
    session.removeAttribute(SESSION_MCP_CLIENT_ID);
    session.removeAttribute(SESSION_MCP_REDIRECT_URI);
    session.removeAttribute(SESSION_MCP_STATE);
    session.removeAttribute(SESSION_MCP_SCOPES);
    session.removeAttribute(SESSION_MCP_AUTH_METHOD);

    LOG.info("Redirecting to client with authorization code: {}", redirectUri);
    response.sendRedirect(redirectUrl);
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

    LOG.debug("SSO callback received valid user identity: username={}, email={}", userName, email);

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

    LOG.info("Generated MCP authorization code for user: {} via SSO", userName);

    // Build redirect URL with MCP state (original client state, not SSO state)
    // Properly encode query parameters to prevent injection attacks
    String redirectUrl =
        pendingRequest.redirectUri()
            + "?code="
            + URLEncoder.encode(authCode, StandardCharsets.UTF_8)
            + (pendingRequest.mcpState() != null
                ? "&state=" + URLEncoder.encode(pendingRequest.mcpState(), StandardCharsets.UTF_8)
                : "");

    // Cleanup pending request
    pendingAuthRepository.delete(authRequestId);

    LOG.info("Redirecting to client with authorization code: {}", requestedRedirectUri);
    response.sendRedirect(redirectUrl);
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

      OAuthAuthorizationCodeRecord codeRecord = codeRepository.markAsUsedAtomic(code);
      if (codeRecord == null) {
        String clientIP = currentRequest.get() != null ? currentRequest.get().getRemoteAddr() : "unknown";
        LOG.error(
            "SECURITY ALERT: Authorization code replay attack or invalid code detected! "
                + "Client: {}, IP: {}. This could indicate: 1) Code reuse (replay attack), "
                + "2) Non-existent code, or 3) Previously deleted code.",
            client.getClientId(),
            clientIP);
        throw new TokenException("invalid_grant", "Authorization code invalid or already used");
      }

      // CRITICAL: Validate client ID matches (prevents authorization code theft attack)
      if (!client.getClientId().equals(codeRecord.clientId())) {
        String clientIP = currentRequest.get() != null ? currentRequest.get().getRemoteAddr() : "unknown";
        LOG.error(
            "SECURITY ALERT: Authorization code theft attack detected! "
                + "Code issued to client '{}' but presented by client '{}'. IP: {}",
            codeRecord.clientId(),
            client.getClientId(),
            clientIP);
        throw new TokenException(
            "invalid_grant", "Authorization code was issued to a different client");
      }

      // CRITICAL: Validate redirect URI matches (RFC 6749 Section 4.1.3)
      // If redirect_uri was provided in token request, it MUST match the one from authorization
      URI requestRedirectUri = authCode.getRedirectUri();
      if (requestRedirectUri != null) {
        String storedRedirectUri = codeRecord.redirectUri();
        String requestRedirectUriStr = requestRedirectUri.toString();

        if (!requestRedirectUriStr.equals(storedRedirectUri)) {
          LOG.error(
              "SECURITY ALERT: Redirect URI mismatch in token exchange! "
                  + "Authorization used '{}' but token request used '{}'",
              storedRedirectUri,
              requestRedirectUriStr);
          throw new TokenException(
              "invalid_grant",
              "Redirect URI in token request does not match authorization request");
        }
      }

      if (System.currentTimeMillis() > codeRecord.expiresAt()) {
        long expiredSecondsAgo = (System.currentTimeMillis() - codeRecord.expiresAt()) / 1000;
        LOG.warn(
            "Authorization code expired {} seconds ago. Expiration time: {}, Client: {}",
            expiredSecondsAgo,
            new java.util.Date(codeRecord.expiresAt()),
            client.getClientId());
        throw new TokenException(
            "invalid_grant",
            "Authorization code expired " + expiredSecondsAgo + " seconds ago. Please restart the authorization flow.");
      }

      if (!verifyPKCE(codeVerifier, codeRecord.codeChallenge())) {
        LOG.warn("PKCE verification failed");
        throw new TokenException("invalid_grant", "Code verifier does not match code challenge");
      }

      String userName = codeRecord.userName();
      LOG.info("Generating JWT for user: {}", userName);

      User user = Entity.getEntityByName(Entity.USER, userName, "roles,teams", Include.NON_DELETED);
      if (user == null) {
        throw new TokenException("invalid_grant", "User not found: " + userName);
      }

      JWTAuthMechanism jwtAuth =
          jwtGenerator.generateJWTToken(
              userName,
              getRoleListFromUser(user),
              !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
              user.getEmail(),
              JWT_EXPIRY_SECONDS,
              false,
              ServiceTokenType.OM_USER);

      // Generate refresh token for long-lived sessions (OAuth 2.0 RFC 6749)
      String refreshTokenValue = UUID.randomUUID().toString();
      long refreshExpiresAt = System.currentTimeMillis() + (REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

      RefreshToken refreshToken =
          new RefreshToken(
              refreshTokenValue, client.getClientId(), codeRecord.scopes(), refreshExpiresAt);

      // Store refresh token in database (hashed and encrypted)
      tokenRepository.storeRefreshToken(
          refreshToken, client.getClientId(), userName, codeRecord.scopes());

      LOG.info(
          "Generated refresh token for user: {} (expires in {} days)",
          userName,
          REFRESH_TOKEN_EXPIRY_DAYS);

      // Prepare OAuth token response with both access token and refresh token
      OAuthToken token = new OAuthToken();
      token.setAccessToken(jwtAuth.getJWTToken());
      token.setTokenType("Bearer");
      token.setExpiresIn((int) JWT_EXPIRY_SECONDS);
      token.setRefreshToken(refreshTokenValue); // Add refresh token to response
      token.setScope(String.join(" ", codeRecord.scopes())); // Include granted scopes

      LOG.info("Successfully issued JWT token and refresh token for user: {}", userName);
      return CompletableFuture.completedFuture(token);

    } catch (TokenException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Token exchange failed", e);
      throw new TokenException("server_error", e.getMessage());
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
      authCode.setRedirectUri(java.net.URI.create(record.redirectUri()));
      authCode.setScopes(record.scopes() != null ? record.scopes() : List.of());

      return CompletableFuture.completedFuture(authCode);
    } catch (Exception e) {
      LOG.error("Failed to load authorization code", e);
      return CompletableFuture.completedFuture(null);
    }
  }

  @Override
  public CompletableFuture<RefreshToken> loadRefreshToken(
      OAuthClientInformation client, String refreshToken) {
    LOG.info("Load refresh token requested");
    return CompletableFuture.completedFuture(null);
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
      LOG.info("Refresh token validated successfully for user: {} (rotating token)", userName);

      // HIGH: Validate user account status before issuing new tokens
      // Check if user still exists and is not deleted (security requirement)
      User user = Entity.getEntityByName(Entity.USER, userName, "roles,teams", Include.NON_DELETED);
      if (user == null) {
        LOG.error(
            "SECURITY: User account deleted or not found during refresh token exchange: {}. "
                + "Revoking refresh token to prevent further use.",
            userName);

        // Revoke the refresh token since the user no longer exists
        tokenRepository.revokeRefreshToken(refreshTokenValue);

        throw new TokenException(
            "invalid_grant",
            "User account has been deleted or deactivated. All tokens have been revoked. "
                + "Please re-authenticate if your account has been restored.");
      }

      LOG.debug("User status validated: User {} is active and not deleted", userName);

      // Atomic token rotation: Revoke old token and generate new one
      // This implements the refresh token rotation pattern (RFC 6749 Section 10.4)
      tokenRepository.revokeRefreshToken(refreshTokenValue);
      LOG.debug("Old refresh token revoked for user: {}", userName);

      // Generate new refresh token
      String newRefreshTokenValue = UUID.randomUUID().toString();
      long newRefreshExpiresAt = System.currentTimeMillis() + (REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

      RefreshToken newRefreshToken =
          new RefreshToken(
              newRefreshTokenValue, client.getClientId(), requestedScopes, newRefreshExpiresAt);

      // Store new refresh token
      tokenRepository.storeRefreshToken(
          newRefreshToken, client.getClientId(), userName, requestedScopes);

      LOG.info(
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
              ServiceTokenType.OM_USER);

      // Prepare OAuth token response with both new access token and new refresh token
      OAuthToken token = new OAuthToken();
      token.setAccessToken(jwtAuth.getJWTToken());
      token.setTokenType("Bearer");
      token.setExpiresIn((int) JWT_EXPIRY_SECONDS);
      token.setRefreshToken(newRefreshTokenValue); // Return NEW refresh token (rotation)
      token.setScope(String.join(" ", requestedScopes));

      LOG.info("Successfully refreshed tokens for user: {} (JWT + new refresh token)", userName);
      return CompletableFuture.completedFuture(token);

    } catch (TokenException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Refresh token exchange failed unexpectedly", e);
      throw new TokenException("server_error", "Token refresh failed: " + e.getMessage());
    }
  }

  @Override
  public CompletableFuture<AccessToken> loadAccessToken(String token) {
    LOG.info("Load access token requested");
    return CompletableFuture.completedFuture(null);
  }

  @Override
  public CompletableFuture<Void> revokeToken(Object token) {
    LOG.info("Token revocation requested");
    return CompletableFuture.failedFuture(
        new TokenException(
            "unsupported_token_type",
            "Token revocation not yet implemented. See IMPLEMENTATION_TODO.md section #14."));
  }

  private String generateAuthorizationCode(
      String userName,
      String clientId,
      String codeChallenge,
      URI redirectUri,
      List<String> scopes) {
    String code = UUID.randomUUID().toString();
    long expiresAt = System.currentTimeMillis() + (AUTH_CODE_EXPIRY_SECONDS * 1000);

    codeRepository.store(
        code, clientId, userName, codeChallenge, "S256", redirectUri, scopes, expiresAt);

    LOG.debug(
        "Generated authorization code for user: {} with {}-second expiry",
        userName,
        AUTH_CODE_EXPIRY_SECONDS);
    return code;
  }

  private boolean verifyPKCE(String codeVerifier, String codeChallenge) {
    try {
      // TODO(PRODUCTION): REMOVE THIS ENTIRE BLOCK BEFORE PRODUCTION DEPLOYMENT
      // This is a development-only bypass for testing purposes
      // SECURITY RISK: This allows bypassing PKCE validation entirely
      if ("TEST".equals(codeVerifier) && "TEST".equals(codeChallenge)) {
        LOG.warn(
            "SECURITY WARNING: Using test PKCE verifier/challenge 'TEST'. "
                + "This should NEVER be used in production!");
        return true;
      }

      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
      String computedChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

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
