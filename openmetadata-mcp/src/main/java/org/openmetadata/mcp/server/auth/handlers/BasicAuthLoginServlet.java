package org.openmetadata.mcp.server.auth.handlers;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.html.HtmlTemplates;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.mcp.server.auth.util.UriUtils;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.LoginAttemptCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Servlet that handles the Basic Auth login flow for MCP OAuth.
 *
 * <p>MCP clients (Claude Desktop, Cursor) proxy the /mcp/authorize request and expect a 302
 * redirect to a browser-openable URL. This servlet serves that browser-facing login page.
 *
 * <p><b>Flow:</b>
 *
 * <ol>
 *   <li>/mcp/authorize stores PKCE params in DB and returns redirect to /mcp/login?auth_request_id=XXX
 *   <li>GET /mcp/login — renders the login form in the user's browser
 *   <li>POST /mcp/login — validates credentials, generates auth code, redirects to client callback
 * </ol>
 */
@Slf4j
public class BasicAuthLoginServlet extends HttpServlet {

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final String SESSION_CSRF_TOKEN = "mcp.login.csrf";
  private static final String SESSION_AUTH_REQUEST_ID = "mcp.login.auth_request_id";

  private final UserSSOOAuthProvider authProvider;
  private final AuthenticatorHandler authenticator;
  private final McpPendingAuthRequestRepository pendingAuthRepository;
  private final OAuthClientRepository clientRepository;

  public BasicAuthLoginServlet(
      UserSSOOAuthProvider authProvider, AuthenticatorHandler authenticator) {
    this.authProvider = authProvider;
    this.authenticator = authenticator;
    this.pendingAuthRepository = new McpPendingAuthRequestRepository();
    this.clientRepository = new OAuthClientRepository();
  }

  @Override
  public void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
    try {
      String authRequestId = request.getParameter("auth_request_id");
      if (authRequestId == null || authRequestId.isEmpty()) {
        response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing auth_request_id");
        return;
      }

      McpPendingAuthRequest pending = pendingAuthRepository.findByAuthRequestId(authRequestId);
      if (pending == null) {
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Invalid or expired auth request. Please restart the authorization flow.");
        return;
      }

      // Generate CSRF token and store in session along with auth_request_id
      String csrfToken = generateSecureToken(32);
      HttpSession session = request.getSession(true);
      session.setAttribute(SESSION_CSRF_TOKEN, csrfToken);
      session.setAttribute(SESSION_AUTH_REQUEST_ID, authRequestId);

      // Look up client name for display
      String clientName = "An application";
      var client = clientRepository.findByClientId(pending.clientId());
      if (client != null && client.getClientName() != null) {
        clientName = client.getClientName();
      }

      String html = HtmlTemplates.generateLoginForm(clientName, null, csrfToken);
      response.setContentType("text/html; charset=UTF-8");
      response.setStatus(HttpServletResponse.SC_OK);
      response.getWriter().write(html);

    } catch (Exception e) {
      LOG.error("Failed to render login form", e);
      response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Failed to load login page");
    }
  }

  @Override
  public void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
    String password = null;
    try {
      HttpSession session = request.getSession(false);
      if (session == null) {
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "No session found. Please restart the authorization flow.");
        return;
      }

      // Validate CSRF token (timing-safe)
      String submittedCsrf = request.getParameter("csrf_token");
      String sessionCsrf = (String) session.getAttribute(SESSION_CSRF_TOKEN);
      session.removeAttribute(SESSION_CSRF_TOKEN);

      byte[] expectedBytes =
          sessionCsrf != null ? sessionCsrf.getBytes(StandardCharsets.UTF_8) : new byte[0];
      byte[] providedBytes =
          submittedCsrf != null ? submittedCsrf.getBytes(StandardCharsets.UTF_8) : new byte[0];
      if (!MessageDigest.isEqual(expectedBytes, providedBytes)) {
        LOG.warn("CSRF token mismatch during Basic Auth login");
        response.sendError(HttpServletResponse.SC_FORBIDDEN, "CSRF validation failed");
        return;
      }

      // Get auth_request_id from session
      String authRequestId = (String) session.getAttribute(SESSION_AUTH_REQUEST_ID);
      if (authRequestId == null) {
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Session expired. Please restart the authorization flow.");
        return;
      }

      // Lookup pending request from DB
      McpPendingAuthRequest pending = pendingAuthRepository.findByAuthRequestId(authRequestId);
      if (pending == null) {
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Authorization request expired. Please restart the flow.");
        return;
      }

      String usernameOrEmail = request.getParameter("username");
      password = request.getParameter("password");

      if (usernameOrEmail == null
          || usernameOrEmail.isEmpty()
          || password == null
          || password.isEmpty()) {
        renderLoginFormWithError(request, response, pending, "Username and password are required");
        return;
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
          }
        } catch (Exception e) {
          LOG.debug("Could not find user by username: {}", usernameOrEmail);
        }
      }

      try {
        authenticator.checkIfLoginBlocked(email);
      } catch (AuthenticationException e) {
        LOG.warn("Login blocked for user", e);
        renderLoginFormWithError(request, response, pending, "Login blocked");
        return;
      }

      try {
        // lookUserInProvider validates credentials for LDAP (via LDAP bind) but NOT for
        // BasicAuth (just finds user). Call validatePassword separately for non-LDAP providers.
        User user = authenticator.lookUserInProvider(email, password);
        org.openmetadata.schema.services.connections.metadata.AuthProvider provider =
            SecurityConfigurationManager.getCurrentAuthConfig().getProvider();
        if (provider != org.openmetadata.schema.services.connections.metadata.AuthProvider.LDAP) {
          authenticator.validatePassword(email, password, user);
        }
        LoginAttemptCache.getInstance().recordSuccessfulLogin(email);
        LOG.debug("Successful basic auth login for MCP");

        // Regenerate session to prevent fixation
        request.changeSessionId();

        // Generate authorization code
        List<String> scopes = pending.scopes();
        if (scopes == null || scopes.isEmpty()) {
          scopes = List.of("openid", "profile", "email");
        }

        String authCode =
            authProvider.createAuthorizationCode(
                user.getName(),
                pending.clientId(),
                pending.codeChallenge(),
                URI.create(pending.redirectUri()),
                scopes);

        // Redirect to client callback with code + state
        // Redirect BEFORE deleting pending request — if delete throws, the user still
        // gets their auth code. The pending request will be cleaned up by the cleanup job.
        Map<String, String> queryParams = new HashMap<>();
        queryParams.put("code", authCode);
        if (pending.mcpState() != null) {
          queryParams.put("state", pending.mcpState());
        }
        String redirectUrl = UriUtils.constructRedirectUri(pending.redirectUri(), queryParams);

        LOG.info("Basic Auth login successful, redirecting to client callback");
        response.sendRedirect(redirectUrl);

        // Best-effort cleanup — failure here doesn't affect the user
        try {
          pendingAuthRepository.delete(authRequestId);
        } catch (Exception deleteEx) {
          LOG.warn(
              "Failed to clean up pending auth request {}, will be removed by cleanup job: {}",
              authRequestId,
              deleteEx.getMessage());
        }

      } catch (AuthenticationException e) {
        LOG.warn("Basic Auth login failed");
        try {
          authenticator.recordFailedLoginAttempt(email, email);
        } catch (Exception recordEx) {
          LOG.error("Failed to record login attempt for security tracking", recordEx);
        }
        renderLoginFormWithError(request, response, pending, "Invalid username or password");
      }

    } catch (Exception e) {
      LOG.error("Basic Auth login processing failed", e);
      response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Login processing failed");
    } finally {
      password = null;
    }
  }

  private void renderLoginFormWithError(
      HttpServletRequest request,
      HttpServletResponse response,
      McpPendingAuthRequest pending,
      String errorMessage)
      throws IOException {

    // Generate new CSRF token for the re-rendered form
    String csrfToken = generateSecureToken(32);
    HttpSession session = request.getSession(true);
    session.setAttribute(SESSION_CSRF_TOKEN, csrfToken);

    String clientName = "An application";
    var client = clientRepository.findByClientId(pending.clientId());
    if (client != null && client.getClientName() != null) {
      clientName = client.getClientName();
    }

    String html = HtmlTemplates.generateLoginForm(clientName, errorMessage, csrfToken);
    response.setContentType("text/html; charset=UTF-8");
    response.setStatus(HttpServletResponse.SC_OK);
    response.getWriter().write(html);
  }

  private static String generateSecureToken(int numBytes) {
    byte[] tokenBytes = new byte[numBytes];
    SECURE_RANDOM.nextBytes(tokenBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
  }
}
