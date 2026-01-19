package org.openmetadata.mcp.server.auth.handlers;

import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;

import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.JWTParser;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Map;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.pac4j.oidc.credentials.OidcCredentials;

/**
 * Servlet that handles SSO provider callbacks for MCP OAuth flow.
 *
 * <p>This servlet receives the callback from the SSO provider (Google, Okta, Azure, etc.) after
 * user authentication, extracts the user identity from the ID token, generates an MCP
 * authorization code, and redirects back to the client with the code.
 *
 * <p><b>IMPORTANT: Two Different OAuth Flows with Two Different State Parameters</b>
 *
 * <p>There are TWO separate OAuth flows happening:
 *
 * <ol>
 *   <li><b>Flow 1: Claude Desktop ↔ OpenMetadata (MCP OAuth)</b>
 *       <ul>
 *         <li>Client sends state parameter (e.g., random_state_123)
 *         <li>Stored as "mcp.state" in session
 *         <li>Used when redirecting BACK to client with authorization code
 *       </ul>
 *   <li><b>Flow 2: OpenMetadata ↔ Google (SSO OAuth)</b>
 *       <ul>
 *         <li>Pac4j generates NEW state parameter (e.g., 9880e10e42)
 *         <li>Google returns this state in callback
 *         <li>Validated by AuthenticationCodeFlowHandler.handleCallback()
 *       </ul>
 * </ol>
 *
 * <p><b>State Validation:</b>
 *
 * <ul>
 *   <li>Google's OAuth state is validated by {@link
 *       org.openmetadata.service.security.AuthenticationCodeFlowHandler#handleCallback}
 *   <li>MCP client's state is NOT validated here (different OAuth flow)
 *   <li>MCP client's state is returned when redirecting back to client
 * </ul>
 *
 * <p><b>Flow:</b>
 *
 * <ol>
 *   <li>User is redirected to SSO provider from /mcp/authorize
 *   <li>User authenticates with SSO provider
 *   <li>SSO provider redirects to /mcp/callback with SSO authorization code + SSO state
 *   <li>This servlet delegates to AuthenticationCodeFlowHandler to validate SSO state and exchange
 *       code
 *   <li>Extracts user identity (username, email) from ID token
 *   <li>Generates MCP authorization code linked to user
 *   <li>Redirects to client's redirect_uri with MCP code + MCP state
 * </ol>
 */
@Slf4j
public class SSOCallbackServlet extends HttpServlet {

  private final UserSSOOAuthProvider userSSOProvider;
  private final AuthenticationCodeFlowHandler ssoHandler;
  private final McpPendingAuthRequestRepository pendingAuthRepository;
  private final Map<String, String> claimsMapping;
  private final String[] claimsOrder;
  private final String principalDomain;

  public SSOCallbackServlet(
      UserSSOOAuthProvider userSSOProvider,
      AuthenticationCodeFlowHandler ssoHandler,
      SSOAuthMechanism.SsoServiceType ssoServiceType) {
    this.userSSOProvider = userSSOProvider;
    this.ssoHandler = ssoHandler;
    this.pendingAuthRepository = new McpPendingAuthRequestRepository();

    this.claimsMapping = Map.of();
    this.claimsOrder = new String[] {"email", "preferred_username", "sub"};
    this.principalDomain = "";

    LOG.info("Initialized SSOCallbackServlet for MCP OAuth with SSO provider: {}", ssoServiceType);
  }

  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    try {
      LOG.info("Handling SSO callback for MCP OAuth");

      // Get state from request (Google returns pac4j's state)
      String pac4jState = request.getParameter("state");
      String idTokenParam = request.getParameter("id_token");
      LOG.debug(
          "Received SSO callback with pac4j state: {}, id_token present: {}",
          pac4jState,
          idTokenParam != null);

      // Handle direct ID token flow (user already logged in, pac4j returns token directly)
      if ((pac4jState == null || pac4jState.isEmpty()) && idTokenParam != null) {
        LOG.info("Handling direct ID token flow (user already authenticated)");
        handleDirectIdTokenFlow(request, response, idTokenParam);
        return;
      }

      if (pac4jState == null || pac4jState.isEmpty()) {
        LOG.warn("SSO callback without state parameter and no id_token");
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST, "Invalid MCP OAuth callback - missing state");
        return;
      }

      // Look up pending auth request by pac4j state
      McpPendingAuthRequest pendingRequest = pendingAuthRepository.findByPac4jState(pac4jState);
      if (pendingRequest == null) {
        LOG.warn("No pending auth request found for pac4j state: {}", pac4jState);
        response.sendError(
            HttpServletResponse.SC_BAD_REQUEST,
            "Invalid MCP OAuth callback - state not found or expired");
        return;
      }

      LOG.debug("Found pending auth request: {}", pendingRequest.authRequestId());

      // Create session and restore pac4j session attributes
      HttpSession session = request.getSession(true);
      String clientName = ssoHandler.getClient().getName();
      LOG.debug("Restoring pac4j session attributes for client: {}", clientName);

      // Restore pac4j state, nonce, and code verifier with correct object types
      // pac4j expects State and CodeVerifier objects, not strings
      if (pendingRequest.pac4jState() != null) {
        com.nimbusds.oauth2.sdk.id.State stateObj =
            new com.nimbusds.oauth2.sdk.id.State(pendingRequest.pac4jState());
        session.setAttribute(clientName + "#state", stateObj);
        LOG.debug("Restored pac4j state for client {}", clientName);
      }
      if (pendingRequest.pac4jNonce() != null) {
        session.setAttribute(clientName + "#nonce", pendingRequest.pac4jNonce());
        LOG.debug("Restored pac4j nonce for client {}", clientName);
      }
      if (pendingRequest.pac4jCodeVerifier() != null) {
        com.nimbusds.oauth2.sdk.pkce.CodeVerifier verifierObj =
            new com.nimbusds.oauth2.sdk.pkce.CodeVerifier(pendingRequest.pac4jCodeVerifier());
        session.setAttribute(clientName + "#pkceCodeVerifier", verifierObj);
        LOG.debug("Restored pac4j code verifier for client {}", clientName);
      }

      // Set the correct callback URL on the pac4j client to match what was used in authorization
      // This prevents redirect_uri_mismatch errors during token exchange
      String mcpCallbackUrl = request.getRequestURL().toString();
      String originalCallbackUrl = ssoHandler.getClient().getCallbackUrl();
      ssoHandler.getClient().setCallbackUrl(mcpCallbackUrl);
      LOG.debug("Set pac4j callback URL to: {} (was: {})", mcpCallbackUrl, originalCallbackUrl);

      HttpServletResponseWrapper responseWrapper =
          new HttpServletResponseWrapper(response) {
            @Override
            public void sendRedirect(String location) throws IOException {
              LOG.debug("Capturing redirect to {} (will not execute)", location);
            }
          };

      try {
        ssoHandler.handleCallback(request, responseWrapper);
      } finally {
        // Restore original callback URL
        ssoHandler.getClient().setCallbackUrl(originalCallbackUrl);
      }

      OidcCredentials credentials = (OidcCredentials) session.getAttribute(OIDC_CREDENTIAL_PROFILE);
      if (credentials == null || credentials.getIdToken() == null) {
        throw new IllegalStateException("No OIDC credentials found in session after SSO callback");
      }

      JWT idToken = credentials.getIdToken();
      JWTClaimsSet claimsSet = idToken.getJWTClaimsSet();

      Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
      claims.putAll(claimsSet.getClaims());

      String userName =
          findUserNameFromClaims(claimsMapping, java.util.Arrays.asList(claimsOrder), claims);
      String email =
          findEmailFromClaims(
              claimsMapping, java.util.Arrays.asList(claimsOrder), claims, principalDomain);

      LOG.info("Extracted user identity from SSO: username={}, email={}", userName, email);

      // Generate MCP authorization code and redirect to client
      userSSOProvider.handleSSOCallbackWithDbState(
          request, response, userName, email, "mcp:" + pendingRequest.authRequestId());

      LOG.info("MCP OAuth SSO callback completed successfully");

    } catch (Exception e) {
      LOG.error("SSO callback handling failed", e);
      if (!response.isCommitted()) {
        try {
          response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
          response.setContentType("text/html; charset=UTF-8");
          String safeErrorMessage =
              org.openmetadata.mcp.server.auth.html.HtmlTemplates.escapeHtml(
                  e.getMessage() != null ? e.getMessage() : "Unknown error");
          response
              .getWriter()
              .write(
                  "<html><body><h1>Authentication Failed</h1><p>Error: "
                      + safeErrorMessage
                      + "</p></body></html>");
        } catch (Exception writeEx) {
          LOG.error("Failed to write error response", writeEx);
        }
      }
    }
  }

  /**
   * Handle direct ID token flow when user is already authenticated.
   * In this case, pac4j returns the ID token directly without going through Google's redirect,
   * so there's no state parameter. We use the session to find the pending auth request.
   */
  private void handleDirectIdTokenFlow(
      HttpServletRequest request, HttpServletResponse response, String idTokenString)
      throws Exception {

    // Get authRequestId from session (stored before handleLogin was called)
    HttpSession session = request.getSession(false);
    if (session == null) {
      throw new IllegalStateException("No session found for direct ID token flow");
    }

    String authRequestId = (String) session.getAttribute("mcp.auth.request.id");
    if (authRequestId == null) {
      throw new IllegalStateException("No auth request ID found in session");
    }

    LOG.debug("Found auth request ID in session: {}", authRequestId);

    // Look up pending request from database
    McpPendingAuthRequest pendingRequest = pendingAuthRepository.findByAuthRequestId(authRequestId);
    if (pendingRequest == null) {
      throw new IllegalStateException(
          "Pending auth request not found or expired: " + authRequestId);
    }

    // Parse and validate the ID token
    // TODO: Add full signature validation using SSO provider's public keys (JWKS endpoint)
    // Currently this is a SECURITY VULNERABILITY - ID tokens from query params are not validated
    LOG.warn(
        "SECURITY WARNING: Direct ID token flow does not validate JWT signature. "
            + "This should be fixed by using pac4j's ID token validator or implementing JWKS validation.");

    JWT idToken;
    JWTClaimsSet claimsSet;
    try {
      idToken = JWTParser.parse(idTokenString);
      claimsSet = idToken.getJWTClaimsSet();

      if (claimsSet == null) {
        LOG.error("ID token has null claims set");
        throw new IllegalStateException(
            "SSO provider returned invalid ID token (no claims). Please restart authentication.");
      }

      // Validate token expiration
      java.util.Date expirationTime = claimsSet.getExpirationTime();
      if (expirationTime != null && expirationTime.before(new java.util.Date())) {
        LOG.error("ID token has expired: {}", expirationTime);
        throw new IllegalStateException("SSO ID token has expired. Please restart authentication.");
      }

      // Validate issuer is present (actual issuer validation requires knowing expected issuer)
      String issuer = claimsSet.getIssuer();
      if (issuer == null || issuer.isEmpty()) {
        LOG.error("ID token missing issuer claim");
        throw new IllegalStateException(
            "SSO provider returned invalid ID token (no issuer). Please restart authentication.");
      }

      LOG.debug("ID token basic validation passed - issuer: {}, exp: {}", issuer, expirationTime);

    } catch (java.text.ParseException e) {
      LOG.error("Failed to parse ID token", e);
      throw new IllegalStateException(
          "Invalid ID token received from SSO provider. Please restart authentication.", e);
    }

    Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(claimsSet.getClaims());

    String userName =
        findUserNameFromClaims(claimsMapping, java.util.Arrays.asList(claimsOrder), claims);
    String email =
        findEmailFromClaims(
            claimsMapping, java.util.Arrays.asList(claimsOrder), claims, principalDomain);

    // Validate required user information was extracted
    if (userName == null || userName.trim().isEmpty()) {
      LOG.error(
          "Could not extract username from SSO claims. Available claims: {}", claims.keySet());
      throw new IllegalStateException(
          "SSO provider did not provide required user information (username). "
              + "Please contact your administrator.");
    }

    if (email == null || email.trim().isEmpty()) {
      LOG.warn(
          "Could not extract email from SSO claims for user: {}. Available claims: {}",
          userName,
          claims.keySet());
      // Email is optional - continue with just username
    }

    LOG.info(
        "Extracted user identity from direct ID token: username={}, email={}", userName, email);

    // Clear session attribute
    session.removeAttribute("mcp.auth.request.id");

    // Generate MCP authorization code and redirect to client
    userSSOProvider.handleSSOCallbackWithDbState(
        request, response, userName, email, "mcp:" + authRequestId);

    LOG.info("MCP OAuth direct ID token flow completed successfully");
  }
}
