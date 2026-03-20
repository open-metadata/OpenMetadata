package org.openmetadata.mcp.server.auth.handlers;

import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;

import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import jakarta.servlet.http.HttpSession;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.validators.IdTokenValidator;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
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
  private final SSOAuthMechanism.SsoServiceType ssoServiceType;
  private final String baseUrl;
  private volatile IdTokenValidator idTokenValidator;

  public SSOCallbackServlet(
      UserSSOOAuthProvider userSSOProvider,
      AuthenticationCodeFlowHandler ssoHandler,
      SSOAuthMechanism.SsoServiceType ssoServiceType,
      String baseUrl) {
    this.userSSOProvider = userSSOProvider;
    this.ssoHandler = ssoHandler;
    this.pendingAuthRepository = new McpPendingAuthRequestRepository();
    this.ssoServiceType = ssoServiceType;
    this.baseUrl = baseUrl;

    LOG.info("Initialized SSOCallbackServlet for MCP OAuth with SSO provider: {}", ssoServiceType);
  }

  private Map<String, String> getClaimsMapping() {
    try {
      var authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
      if (authConfig != null && authConfig.getJwtPrincipalClaimsMapping() != null) {
        Map<String, String> mapping = new TreeMap<>();
        for (String claimPair : authConfig.getJwtPrincipalClaimsMapping()) {
          String[] parts = claimPair.split(":");
          if (parts.length == 2) {
            mapping.put(parts[0], parts[1]);
          }
        }
        return mapping;
      }
    } catch (Exception e) {
      LOG.warn("Failed to get claims mapping from config: {}", e.getMessage());
    }
    return Map.of();
  }

  private String[] getClaimsOrder() {
    try {
      var authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
      if (authConfig != null && authConfig.getJwtPrincipalClaims() != null) {
        return authConfig.getJwtPrincipalClaims().toArray(new String[0]);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get claims order from config: {}", e.getMessage());
    }
    return new String[] {"email", "preferred_username", "sub"};
  }

  private String getPrincipalDomain() {
    try {
      var authzConfig = SecurityConfigurationManager.getCurrentAuthzConfig();
      if (authzConfig != null && authzConfig.getPrincipalDomain() != null) {
        return authzConfig.getPrincipalDomain();
      }
      LOG.debug("Principal domain not configured, using empty string");
    } catch (Exception e) {
      LOG.warn("Failed to get principal domain from config: {}", e.getMessage());
    }
    return "";
  }

  private IdTokenValidator getIdTokenValidator() {
    if (idTokenValidator == null) {
      synchronized (this) {
        if (idTokenValidator == null) {
          idTokenValidator = createIdTokenValidator();
        }
      }
    }
    return idTokenValidator;
  }

  private IdTokenValidator createIdTokenValidator() {
    var authConfig = SecurityConfigurationManager.getCurrentAuthConfig();
    if (authConfig == null) {
      throw new IllegalStateException(
          "Authentication configuration not initialized. Cannot validate ID tokens.");
    }

    String expectedIssuer;
    try {
      expectedIssuer =
          ssoHandler.getClient().getConfiguration().getProviderMetadata().getIssuer().getValue();
    } catch (Exception e) {
      LOG.warn(
          "Could not extract issuer from OIDC provider metadata, will use default: {}",
          e.getMessage());
      expectedIssuer = authConfig.getAuthority();
    }

    // Validate audience (client ID) when available. Without this, an ID token issued to
    // a different application at the same SSO provider could be accepted.
    String expectedAudience = null;
    try {
      expectedAudience = ssoHandler.getClient().getConfiguration().getClientId();
      LOG.debug("ID token audience validation enabled for client ID: {}", expectedAudience);
    } catch (Exception e) {
      LOG.warn(
          "Could not extract SSO client ID for audience validation, skipping: {}", e.getMessage());
    }

    return new IdTokenValidator(authConfig.getPublicKeyUrls(), expectedIssuer, expectedAudience);
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

      // Restore pac4j state, nonce, and code verifier using pac4j's actual session attribute names.
      // pac4j 5.x uses "$stateSessionParameter", "$nonceSessionParameter",
      // "$codeVerifierSessionParameter" suffixes — NOT "#state", "#nonce", "#pkceCodeVerifier".
      org.pac4j.oidc.client.OidcClient oidcClient = ssoHandler.getClient();
      if (pendingRequest.pac4jState() != null) {
        com.nimbusds.oauth2.sdk.id.State stateObj =
            new com.nimbusds.oauth2.sdk.id.State(pendingRequest.pac4jState());
        session.setAttribute(oidcClient.getStateSessionAttributeName(), stateObj);
        LOG.debug("Restored pac4j state for client {}", clientName);
      }
      if (pendingRequest.pac4jNonce() != null) {
        session.setAttribute(
            oidcClient.getNonceSessionAttributeName(), pendingRequest.pac4jNonce());
        LOG.debug("Restored pac4j nonce for client {}", clientName);
      }
      if (pendingRequest.pac4jCodeVerifier() != null) {
        com.nimbusds.oauth2.sdk.pkce.CodeVerifier verifierObj =
            new com.nimbusds.oauth2.sdk.pkce.CodeVerifier(pendingRequest.pac4jCodeVerifier());
        session.setAttribute(oidcClient.getCodeVerifierSessionAttributeName(), verifierObj);
        LOG.debug("Restored pac4j code verifier for client {}", clientName);
      }

      // Use the SSO-registered callback URL for the token exchange redirect_uri.
      // The redirect_uri in the token exchange MUST match the one sent in the authorize request.
      // Since we now send client.getCallbackUrl() (the registered URL) to the SSO provider,
      // we must use the same URL here for the token exchange to succeed.
      String ssoCallbackUrl = ssoHandler.getClient().getCallbackUrl();
      session.setAttribute(AuthenticationCodeFlowHandler.SESSION_SSO_CALLBACK_URL, ssoCallbackUrl);
      // handleCallback() → sendRedirectWithToken() requires SESSION_REDIRECT_URI to be set.
      // We set it to /mcp/callback so pac4j completes the token exchange, but the actual redirect
      // is intercepted by the response wrapper above — we handle the redirect ourselves.
      session.setAttribute(
          AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI, baseUrl + "/mcp/callback");
      LOG.debug("Set session SSO callback URL to: {}", ssoCallbackUrl);

      // Wrap response to intercept both redirects and error writes from handleCallback.
      // handleCallback's error handler (getErrorMessage) writes via getOutputStream(),
      // which would commit the real response and cause a double-write when we handle
      // the error ourselves.
      AtomicBoolean handlerWroteError = new AtomicBoolean(false);
      HttpServletResponseWrapper responseWrapper =
          new HttpServletResponseWrapper(response) {
            @Override
            public void sendRedirect(String location) throws IOException {
              LOG.debug("Capturing redirect to {} (will not execute)", location);
            }

            @Override
            public void setStatus(int sc) {
              if (sc >= 400) {
                handlerWroteError.set(true);
              }
            }

            @Override
            public ServletOutputStream getOutputStream() throws IOException {
              if (handlerWroteError.get()) {
                return new ServletOutputStream() {
                  private final ByteArrayOutputStream sink = new ByteArrayOutputStream();

                  @Override
                  public void write(int b) {
                    sink.write(b);
                  }

                  @Override
                  public boolean isReady() {
                    return true;
                  }

                  @Override
                  public void setWriteListener(WriteListener writeListener) {}
                };
              }
              return super.getOutputStream();
            }
          };

      ssoHandler.handleCallback(request, responseWrapper);

      if (handlerWroteError.get()) {
        throw new IllegalStateException(
            "SSO provider token exchange failed. Please restart authentication.");
      }

      OidcCredentials credentials = (OidcCredentials) session.getAttribute(OIDC_CREDENTIAL_PROFILE);
      if (credentials == null || credentials.getIdToken() == null) {
        throw new IllegalStateException("No OIDC credentials found in session after SSO callback");
      }

      JWT idToken = credentials.getIdToken();

      // Defense-in-depth: validate ID token signature even though pac4j should have validated it.
      // This protects against pac4j misconfiguration or bugs that skip signature verification.
      JWTClaimsSet claimsSet;
      try {
        claimsSet = getIdTokenValidator().validateAndDecode(idToken.serialize());
        LOG.debug("ID token signature validated successfully in standard SSO flow");
      } catch (IdTokenValidator.IdTokenValidationException e) {
        LOG.error(
            "SECURITY ALERT: ID token validation failed in standard SSO flow. Reason: {}. IP: {}",
            e.getMessage(),
            request.getRemoteAddr());
        throw new IllegalStateException(
            "ID token validation failed: " + e.getMessage() + ". Please restart authentication.",
            e);
      }

      Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
      claims.putAll(claimsSet.getClaims());

      String userName =
          findUserNameFromClaims(getClaimsMapping(), List.of(getClaimsOrder()), claims);
      String email =
          findEmailFromClaims(
              getClaimsMapping(), List.of(getClaimsOrder()), claims, getPrincipalDomain());

      LOG.debug("Extracted user identity from SSO callback");

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
          response
              .getWriter()
              .write(
                  "<html><body><h1>Authentication Failed</h1>"
                      + "<p>An internal error occurred while processing authentication. "
                      + "Please try again or contact your administrator.</p></body></html>");
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

    // Validate ID token signature using JWKS public keys (SECURITY FIX)
    JWTClaimsSet claimsSet;
    try {
      claimsSet = getIdTokenValidator().validateAndDecode(idTokenString);
      LOG.info(
          "ID token signature validated successfully for auth request: {}. Issuer: {}, Subject: {}",
          authRequestId,
          claimsSet.getIssuer(),
          claimsSet.getSubject());
    } catch (IdTokenValidator.IdTokenValidationException e) {
      LOG.error(
          "SECURITY ALERT: ID token validation failed for auth request: {}. Reason: {}. IP: {}",
          authRequestId,
          e.getMessage(),
          request.getRemoteAddr());
      throw new IllegalStateException(
          "ID token validation failed: " + e.getMessage() + ". Please restart authentication.", e);
    }

    Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(claimsSet.getClaims());

    String userName = findUserNameFromClaims(getClaimsMapping(), List.of(getClaimsOrder()), claims);
    String email =
        findEmailFromClaims(
            getClaimsMapping(), List.of(getClaimsOrder()), claims, getPrincipalDomain());

    // Validate required user information was extracted
    if (userName == null || userName.trim().isEmpty()) {
      LOG.error(
          "Could not extract username from SSO claims. Available claims: {}", claims.keySet());
      throw new IllegalStateException(
          "SSO provider did not provide required user information (username). "
              + "Please contact your administrator.");
    }

    if (email == null || email.trim().isEmpty()) {
      LOG.warn("Could not extract email from SSO claims. Available claims: {}", claims.keySet());
      // Email is optional - continue with just username
    }

    LOG.debug("Extracted user identity from direct ID token flow");

    // Clear session attribute
    session.removeAttribute("mcp.auth.request.id");

    // Generate MCP authorization code and redirect to client
    userSSOProvider.handleSSOCallbackWithDbState(
        request, response, userName, email, "mcp:" + authRequestId);

    LOG.info("MCP OAuth direct ID token flow completed successfully");
  }
}
