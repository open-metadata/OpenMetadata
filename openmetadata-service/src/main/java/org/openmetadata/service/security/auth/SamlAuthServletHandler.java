package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.SecurityUtil.extractDisplayNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.writeErrorResponse;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.security.SecurityUtil.writeMessageResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.authn.AuthnRequestParams;
import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.exception.SAMLException;
import com.onelogin.saml2.factory.SamlMessageFactory;
import com.onelogin.saml2.http.HttpRequest;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.util.Constants;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import javax.xml.xpath.XPathExpressionException;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.saml.SamlLoginCompletionServlet;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.security.session.SessionCookieUtil;
import org.openmetadata.service.security.session.SessionRefreshInProgressException;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

@Slf4j
public class SamlAuthServletHandler implements AuthServeletHandler {
  private static final String AUTH_CALLBACK_PATH = "/auth/callback";
  final AuthenticationConfiguration authConfig;
  final AuthorizerConfiguration authorizerConfig;
  final SessionService sessionService;
  private List<String> displayNameAttributes;

  /**
   * Bridge for handing a SAML-authenticated identity to the MCP OAuth flow. The MCP module
   * (openmetadata-mcp) registers an implementation at startup via {@link
   * #setMcpSamlCallbackHandler}; this service module cannot import openmetadata-mcp, so the
   * dependency is inverted through this hook (mirrors {@code
   * AuthenticationCodeFlowHandler.setMcpStateChecker} used by the OIDC bridge).
   */
  @FunctionalInterface
  public interface McpSamlCallbackHandler {
    void handle(
        HttpServletRequest req,
        HttpServletResponse resp,
        String username,
        String email,
        String relayState)
        throws Exception;
  }

  private static volatile McpSamlCallbackHandler mcpSamlCallbackHandler;

  public static void setMcpSamlCallbackHandler(McpSamlCallbackHandler handler) {
    mcpSamlCallbackHandler = handler;
  }

  private static class Holder {
    private static volatile SamlAuthServletHandler instance;
    private static volatile AuthenticationConfiguration lastAuthConfig;
    private static volatile AuthorizerConfiguration lastAuthzConfig;
    private static volatile SessionService lastSessionService;
  }

  public static SamlAuthServletHandler getInstance(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    SessionService sessionService = AuthServeletHandlerRegistry.getSessionService();
    if (sessionService == null) {
      throw new IllegalStateException("Session service is not initialized");
    }
    return getInstance(authConfig, authorizerConfig, sessionService);
  }

  public static SamlAuthServletHandler getInstance(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authorizerConfig,
      SessionService sessionService) {
    if (Holder.instance == null || !isSameConfig(authConfig, authorizerConfig, sessionService)) {
      synchronized (SamlAuthServletHandler.class) {
        if (Holder.instance == null
            || !isSameConfig(authConfig, authorizerConfig, sessionService)) {
          Holder.instance =
              new SamlAuthServletHandler(authConfig, authorizerConfig, sessionService);
          Holder.lastAuthConfig = authConfig;
          Holder.lastAuthzConfig = authorizerConfig;
          Holder.lastSessionService = sessionService;
        }
      }
    }
    return Holder.instance;
  }

  private static boolean isSameConfig(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authorizerConfig,
      SessionService sessionService) {
    return authConfig == Holder.lastAuthConfig
        && authorizerConfig == Holder.lastAuthzConfig
        && sessionService == Holder.lastSessionService;
  }

  public SamlAuthServletHandler(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authorizerConfig,
      SessionService sessionService) {
    this.authConfig = authConfig;
    this.authorizerConfig = authorizerConfig;
    this.sessionService = sessionService;
    initializeConfiguration();
  }

  private void initializeConfiguration() {
    SamlSSOClientConfig samlConfig = authConfig.getSamlConfiguration();

    if (samlConfig != null) {
      this.displayNameAttributes = samlConfig.getSamlDisplayNameAttributes();
    }
    if (nullOrEmpty(this.displayNameAttributes)) {
      this.displayNameAttributes =
          Arrays.asList(
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
              "given_name",
              "family_name",
              "givenName",
              "familyName",
              "firstName",
              "lastName",
              "http://schemas.microsoft.com/identity/claims/displayname",
              "displayName",
              "name");
    }
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      String callbackUrl = req.getParameter("callback");
      if (callbackUrl == null) {
        callbackUrl = req.getParameter("redirectUri");
      }
      if (callbackUrl == null) {
        callbackUrl = defaultSamlRedirectUri();
      }
      callbackUrl =
          org.openmetadata.service.security.SecurityUtil.validateRedirectUri(
              callbackUrl, trustedSamlRedirects());
      UserSession pendingSession =
          sessionService.createPendingSession(
              req, resp, authConfig.getProvider().value(), callbackUrl, null, null, null);

      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);

      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      // Carry the pending-session id in the SAML RelayState so the ACS callback can recover it from
      // the POST body. The IdP callback is a cross-site POST that drops the SameSite=Lax OM_SESSION
      // cookie, so RelayState — not the cookie — is the reliable correlation across the round-trip.
      // The request id is kept so that only the answer to this request can complete this login.
      String identityProviderUrl =
          auth.login(pendingSession.getId(), new AuthnRequestParams(false, false, true), true);
      if (sessionService.recordPendingState(pendingSession, auth.getLastRequestId()).isEmpty()) {
        sendError(resp, HttpServletResponse.SC_CONFLICT, "SAML login was changed concurrently");
        return;
      }
      resp.sendRedirect(identityProviderUrl);

    } catch (IllegalArgumentException e) {
      LOG.error("Invalid SAML redirect URI", e);
      sendError(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
    } catch (SAMLException e) {
      LOG.error("Error initiating SAML login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "SAML login initiation failed");
    } catch (Exception e) {
      LOG.error("Error handling SAML login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  /**
   * Initiates a SAML login for the MCP OAuth flow, carrying the MCP authorization request id in the
   * SAML {@code RelayState}. The IdP echoes RelayState back to the ACS, where {@link
   * #tryHandleMcpSamlCallback} detects it. Unlike {@link #handleLogin}, this does not set a session
   * redirect URI — MCP relies on RelayState (a SAML protocol field), not the session cookie.
   */
  public void initiateMcpLogin(
      HttpServletRequest req, HttpServletResponse resp, String relayState) {
    try {
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);

      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.login(relayState); // returnTo becomes the SAML RelayState
    } catch (Exception e) {
      LOG.error("[SAML] Error initiating MCP SAML login", e);
      throw new IllegalStateException("SAML MCP login initiation failed", e);
    }
  }

  /**
   * Detects an MCP-initiated SAML callback (RelayState = "mcp:{authRequestId}") and delegates the
   * authenticated identity to the registered MCP handler. Returns true when the callback was an MCP
   * flow and has been handled (the caller must stop processing); false for normal web SAML logins.
   */
  private boolean tryHandleMcpSamlCallback(
      HttpServletRequest req, HttpServletResponse resp, String username, String email)
      throws Exception {
    String relayState = req.getParameter("RelayState");
    if (relayState == null || !relayState.startsWith("mcp:")) {
      return false; // normal web SAML login — not an MCP OAuth flow
    }
    // This IS an MCP OAuth login. If the MCP bridge is not registered (MCP disabled, init failure,
    // or a startup race), fail closed — never fall through to the web login path, which would
    // auto-provision the user and mint a web JWT, bypassing the MCP deny-unknown-user contract.
    McpSamlCallbackHandler handler = mcpSamlCallbackHandler;
    if (handler == null) {
      LOG.error(
          "[SAML] MCP OAuth callback received but no MCP handler is registered; failing the MCP "
              + "login instead of falling back to web login");
      sendError(
          resp,
          HttpServletResponse.SC_SERVICE_UNAVAILABLE,
          "MCP authentication is not available. Please contact your administrator.");
      return true;
    }
    LOG.info("[SAML] MCP OAuth callback detected, delegating to MCP handler");
    handler.handle(req, resp, username, email, relayState);
    return true;
  }

  @Override
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    try {
      String relayState = req.getParameter("RelayState");
      boolean mcpCallback = relayState != null && relayState.startsWith("mcp:");
      UserSession pendingSession = mcpCallback ? null : resolvePendingSession(req, resp);
      if (!mcpCallback && (pendingSession == null || nullOrEmpty(pendingSession.getState()))) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No pending session");
        return;
      }
      String expectedRequestId = mcpCallback ? null : pendingSession.getState();
      if (!mcpCallback) {
        validatedRedirectUri(pendingSession.getRedirectUri());
      }

      // This handles the SAML response from IDP (ACS - Assertion Consumer Service)
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);

      Saml2Settings samlSettings = SamlSettingsHolder.getSaml2Settings();
      Auth auth = new Auth(samlSettings, wrappedRequest, wrappedResponse);
      ValidatedResponse validatedResponse = new ValidatedResponse();
      auth.setSamlMessageFactory(validatedResponse);
      auth.processResponse(expectedRequestId);
      requireAccepted(auth);
      if (!mcpCallback) {
        requireAnswerTo(validatedResponse.response, expectedRequestId);
      }

      // Extract user information from SAML response
      String nameId = auth.getNameId();
      String email = nameId;
      String username;

      if (nameId.contains("@")) {
        username = nameId.split("@")[0];
      } else {
        username = nameId;
        email = String.format("%s@%s", username, SamlSettingsHolder.getInstance().getDomain());
      }

      // If this login was initiated by an MCP OAuth client (RelayState = "mcp:{authRequestId}"),
      // hand the authenticated identity to the MCP flow instead of the normal web JWT redirect.
      // This fires before getOrCreateUser so MCP keeps the deny-unknown-user semantics of the
      // OIDC MCP path (handleSSOCallbackWithDbState serves the "Access Denied" page).
      if (tryHandleMcpSamlCallback(req, resp, username, email)) {
        return;
      }

      // Extract display name from SAML attributes (name, given_name, family_name)
      String displayName = extractDisplayNameFromSamlAttributes(auth);

      // Extract team/group attributes from SAML response (supports multi-valued attributes)
      List<String> teamsFromClaim = new ArrayList<>();
      String teamClaimMapping = authConfig.getJwtTeamClaimMapping();
      if (!nullOrEmpty(teamClaimMapping)) {
        try {
          Collection<String> attributeValues = auth.getAttribute(teamClaimMapping);
          if (attributeValues != null && !attributeValues.isEmpty()) {
            teamsFromClaim.addAll(attributeValues);
            LOG.debug(
                "[SAML] Found team attribute '{}' with values '{}'",
                teamClaimMapping,
                teamsFromClaim);
          }
        } catch (Exception e) {
          LOG.debug(
              "[SAML] Could not extract team attribute '{}': {}", teamClaimMapping, e.getMessage());
        }
      }

      // Get or create user
      User user = getOrCreateUser(username, email, displayName, teamsFromClaim);

      // The IdP's POST can come from any browser, so it only attaches the account to the pending
      // login. A same-site GET completes it, and only with both that login's cookie and the code
      // this answer redirects with
      // (ADR:2026-11-03-a-saml-login-completes-in-the-browser-that-started-it).
      String completionCode =
          sessionService
              .recordPendingUser(pendingSession, user)
              .orElseThrow(() -> new AuthenticationException("SAML login is no longer pending"));
      resp.setStatus(HttpServletResponse.SC_SEE_OTHER);
      resp.setHeader("Location", completionLocation(req, pendingSession, completionCode));

    } catch (IllegalArgumentException e) {
      LOG.error("Invalid SAML redirect URI in callback", e);
      sendError(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
    } catch (AuthenticationException e) {
      LOG.warn("SAML callback rejected: {}", e.getMessage());
      sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, e.getMessage());
    } catch (Exception e) {
      LOG.error("Error processing SAML callback", e);
      sendError(
          resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "SAML callback processing failed");
    }
  }

  /**
   * The completion page, with the login's one-time code, on the origin the login returns to, which
   * is where it started: the pending session's cookie is host-only, and the ACS may be served under
   * another host name.
   */
  private String completionLocation(
      HttpServletRequest req, UserSession pendingSession, String completionCode) {
    String path = req.getContextPath() + SamlLoginCompletionServlet.PATH;
    String query = SamlLoginCompletionServlet.CODE_PARAMETER + "=" + completionCode;
    try {
      URI callback = new URI(validatedRedirectUri(pendingSession.getRedirectUri()));
      if (callback.getScheme() != null && callback.getHost() != null) {
        return new URI(
                callback.getScheme(),
                null,
                callback.getHost(),
                callback.getPort(),
                path,
                query,
                null)
            .toString();
      }
    } catch (URISyntaxException e) {
      LOG.warn("Could not derive the SAML completion origin from the login's redirect URI", e);
    }
    return path + "?" + query;
  }

  /**
   * Finishes a SAML login in the browser that started it and delivered the identity provider's
   * answer: the pending session comes from this request's own cookie, the ACS must already have
   * attached the account the identity provider vouched for, and the request must carry the one-time
   * code that answer redirected with. A browser missing either signs nobody in, and its own cookie
   * is left alone.
   */
  public void completeLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      String completionCode = req.getParameter(SamlLoginCompletionServlet.CODE_PARAMETER);
      // Read from the store, not this server's cache: the ACS that attached the account may have
      // run on another server.
      UserSession pendingSession =
          SessionCookieUtil.getSessionId(req)
              .flatMap(sessionService::getFreshSessionById)
              .filter(session -> session.getStatus() == SessionStatus.PENDING)
              .filter(session -> !session.isExpired(System.currentTimeMillis()))
              .filter(session -> !nullOrEmpty(session.getUserId()))
              .filter(session -> sessionService.isCompletionCode(session, completionCode))
              .orElse(null);
      if (pendingSession == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No SAML login to complete");
        return;
      }
      String callbackUrl = validatedRedirectUri(pendingSession.getRedirectUri());
      User user =
          Entity.getUserRepository()
              .get(
                  null,
                  UUID.fromString(pendingSession.getUserId()),
                  Entity.getUserRepository().getAuthUpdateFields());

      RefreshToken refreshToken = TokenUtil.getRefreshToken(user.getId(), UUID.randomUUID());
      Entity.getTokenRepository().insertToken(refreshToken);
      UserSession activeSession =
          sessionService
              .activatePendingSession(
                  req, resp, pendingSession, user, refreshToken.getToken().toString(), null)
              .orElseGet(
                  () -> {
                    Entity.getTokenRepository().deleteToken(refreshToken.getToken().toString());
                    throw new AuthenticationException("Failed to activate SAML session");
                  });

      Entity.getUserRepository().updateUserLastLoginTime(user, System.currentTimeMillis());
      if (Entity.getAuditLogRepository() != null) {
        Entity.getAuditLogRepository()
            .writeAuthEvent(AuditLogRepository.AUTH_EVENT_LOGIN, user.getName(), user.getId());
      }

      JWTAuthMechanism jwtAuthMechanism = generateJwtToken(user, activeSession);
      resp.sendRedirect(
          org.openmetadata.service.security.SecurityUtil.buildRedirectWithToken(
              callbackUrl,
              jwtAuthMechanism.getJWTToken(),
              user.getEmail(),
              user.getDisplayName() == null ? "" : user.getDisplayName()));
    } catch (IllegalArgumentException e) {
      LOG.error("Invalid SAML redirect URI in login completion", e);
      sendError(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
    } catch (AuthenticationException | EntityNotFoundException e) {
      LOG.warn("SAML login completion rejected: {}", e.getMessage());
      sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, e.getMessage());
    } catch (Exception e) {
      LOG.error("Error completing SAML login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "SAML login failed");
    }
  }

  /**
   * Fails the login with java-saml's own reason, such as "The Message of the Response is not signed
   * and the SP requires it", so the person signing in learns what to fix, not only that SAML failed.
   */
  private static void requireAccepted(Auth auth) {
    if (!auth.isAuthenticated() || !auth.getErrors().isEmpty()) {
      String reason = auth.getLastErrorReason();
      throw new AuthenticationException(
          "SAML response rejected: "
              + (nullOrEmpty(reason) ? String.join(", ", auth.getErrors()) : reason));
    }
  }

  /**
   * The response must answer the request this login sent. java-saml checks {@code InResponseTo}
   * only in strict mode, so it is read here from the assertion java-saml verified: when only the
   * assertion is signed, the response element around it is not, and whoever relays a captured
   * response can rewrite that element's {@code InResponseTo}.
   */
  private static void requireAnswerTo(VerifiedAssertion response, String requestId)
      throws XPathExpressionException {
    if (!response.answers(requestId)) {
      throw new AuthenticationException("SAML response does not answer this login's request");
    }
  }

  /** Keeps the response java-saml validates, so the login is checked against that same parse. */
  private static final class ValidatedResponse implements SamlMessageFactory {
    private VerifiedAssertion response;

    @Override
    public SamlResponse createSamlResponse(Saml2Settings settings, HttpRequest request)
        throws Exception {
      response = new VerifiedAssertion(settings, request);
      return response;
    }
  }

  /** Queries the assertion java-saml selects through the signature reference it verified. */
  private static final class VerifiedAssertion extends SamlResponse {
    private static final String BEARER_CONFIRMATION_DATA =
        "/saml:Subject/saml:SubjectConfirmation[@Method='"
            + Constants.CM_BEARER
            + "']/saml:SubjectConfirmationData";
    private static final String IN_RESPONSE_TO = "InResponseTo";

    private VerifiedAssertion(Saml2Settings settings, HttpRequest request) throws Exception {
      super(settings, request);
    }

    private boolean answers(String requestId) throws XPathExpressionException {
      NodeList confirmations = queryAssertion(BEARER_CONFIRMATION_DATA);
      boolean answered = false;
      for (int i = 0; i < confirmations.getLength() && !answered; i++) {
        answered =
            confirmations.item(i) instanceof Element confirmation
                && requestId.equals(confirmation.getAttribute(IN_RESPONSE_TO));
      }
      return answered;
    }
  }

  /** The login's redirect URI, or the default one, when it is one the SAML login may return to. */
  private String validatedRedirectUri(String redirectUri) {
    return org.openmetadata.service.security.SecurityUtil.validateRedirectUri(
        redirectUri == null ? defaultSamlRedirectUri() : redirectUri, trustedSamlRedirects());
  }

  /**
   * Resolves the pending session for a SAML callback, preferring the SAML {@code RelayState} (set in
   * {@link #handleLogin} to the pending-session id) over the {@code OM_SESSION} cookie. The IdP POST
   * to the ACS is cross-site, so a {@code SameSite=Lax} cookie is not sent by the browser; RelayState
   * rides in the POST body and is the reliable carrier. Falls back to the cookie for backward
   * compatibility (same-site deployments, or logins started before this change).
   */
  UserSession resolvePendingSession(HttpServletRequest req, HttpServletResponse resp) {
    UserSession pendingSession = null;
    String relayState = req.getParameter("RelayState");
    if (!nullOrEmpty(relayState)) {
      pendingSession = sessionService.getPendingSessionById(relayState).orElse(null);
    }
    if (pendingSession == null) {
      pendingSession = sessionService.getPendingSession(req, resp).orElse(null);
    }
    return pendingSession;
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    UserSession leasedSession = null;
    try {
      UserSession session = sessionService.acquireRefreshLease(req, resp).orElse(null);
      leasedSession = session;
      if (session == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No active session");
        return;
      }

      String refreshToken = sessionService.decryptOmRefreshToken(session);
      String username = session.getUsername();

      if (refreshToken == null || username == null) {
        sessionService.revokeSession(req, resp);
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No refresh token in session");
        return;
      }

      // Get user
      User user =
          Entity.getEntityByName(
              Entity.USER, username, "id,roles,isAdmin,email", Include.NON_DELETED);

      RefreshToken rotatedRefreshToken = rotateRefreshToken(session, user.getId(), refreshToken);
      Optional<UserSession> completedSession =
          completeRefresh(
              req, resp, session, refreshToken, rotatedRefreshToken.getToken().toString());
      if (completedSession.isEmpty()) {
        return;
      }

      JWTAuthMechanism jwtAuthMechanism = generateJwtToken(user, completedSession.get());

      JwtResponse responseToClient = new JwtResponse();
      responseToClient.setAccessToken(jwtAuthMechanism.getJWTToken());
      responseToClient.setTokenType("Bearer");
      responseToClient.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("application/json");
      writeJsonResponse(resp, JsonUtils.pojoToJson(responseToClient));

    } catch (SessionRefreshInProgressException e) {
      resp.setHeader("Retry-After", Integer.toString(e.getRetryAfterSeconds()));
      sendError(resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE, e.getMessage());
    } catch (BadRequestException e) {
      sessionService.releaseRefreshLease(leasedSession);
      sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, e.getMessage());
    } catch (Exception e) {
      sessionService.releaseRefreshLease(leasedSession);
      LOG.error("Error handling SAML refresh", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
    try {
      UserSession session = sessionService.getSession(req).orElse(null);
      if (session != null) {
        // Write logout audit event before invalidating session
        String userId = session.getUserId();
        String username = session.getUsername();
        if (username != null) {
          SubjectCache.invalidateUser(username);
        }
        String refreshToken = sessionService.decryptOmRefreshToken(session);
        if (refreshToken != null) {
          Entity.getTokenRepository().deleteToken(refreshToken);
        }
        if (userId != null && username != null && Entity.getAuditLogRepository() != null) {
          try {
            Entity.getAuditLogRepository()
                .writeAuthEvent(
                    AuditLogRepository.AUTH_EVENT_LOGOUT, username, UUID.fromString(userId));
          } catch (Exception e) {
            LOG.debug("Could not write logout audit event for user {}", username, e);
          }
        }
      }
      sessionService.revokeSession(req, resp);

      // SAML Single Logout (SLO) if configured
      try {
        javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
        javax.servlet.http.HttpServletResponse wrappedResponse =
            new HttpServletResponseWrapper(resp);

        Auth auth =
            new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
        auth.logout(); // This redirects to IDP for logout
      } catch (Exception e) {
        // If SAML logout fails, still return success for local logout
        LOG.warn("SAML Single Logout failed, but local session cleared", e);
        writeMessageResponse(
            resp, HttpServletResponse.SC_OK, "Logged out successfully (local only)");
      }

    } catch (Exception e) {
      LOG.error("Error handling SAML logout", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  /**
   * Extracts display name from SAML attributes using configurable attribute mapping.
   *
   * <p>This method converts SAML attributes to a claims map and uses SecurityUtil for consistent
   * extraction across OIDC and SAML providers. It supports configurable attribute names via
   * samlDisplayNameAttributes configuration.
   *
   * @param auth SAML Auth object containing the response attributes
   * @return The extracted display name, or null if no suitable attributes found
   */
  private String extractDisplayNameFromSamlAttributes(Auth auth) {
    try {
      // Convert SAML attributes to claims map (case-insensitive)
      Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);

      for (String attributeName : displayNameAttributes) {
        Collection<String> attributeValues = auth.getAttribute(attributeName);
        if (attributeValues != null && !attributeValues.isEmpty()) {
          String value = attributeValues.iterator().next();
          // Normalize to standard OIDC claim names for SecurityUtil compatibility
          String standardKey = mapToStandardClaimName(attributeName);
          claims.put(standardKey, value);
        }
      }

      if (claims.isEmpty()) {
        LOG.warn(
            "[SAML] No display name attributes found in SAML assertion. "
                + "Checked attributes: {}. Configure 'samlDisplayNameAttributes' to match your IdP.",
            displayNameAttributes);
        return null;
      }

      // Reuse SecurityUtil for consistent extraction across OIDC and SAML
      String displayName = extractDisplayNameFromClaims(claims);

      if (displayName == null) {
        LOG.warn(
            "[SAML] Could not construct display name from attributes. " + "Available keys: {}",
            claims.keySet());
      }

      return displayName;

    } catch (Exception e) {
      LOG.error("[SAML] Error extracting display name", e);
      return null;
    }
  }

  /**
   * Maps SAML attribute name variations to standard OIDC claim names. Allows
   * SecurityUtil.extractDisplayNameFromClaims() to work with SAML attributes.
   */
  private String mapToStandardClaimName(String samlAttributeName) {
    // Extract claim name from URN (e.g., "http://schemas.../givenname" -> "givenname")
    String claimName = samlAttributeName;
    int lastSlash = samlAttributeName.lastIndexOf('/');
    int lastHash = samlAttributeName.lastIndexOf('#');
    int lastSeparator = Math.max(lastSlash, lastHash);
    if (lastSeparator > 0 && lastSeparator < samlAttributeName.length() - 1) {
      claimName = samlAttributeName.substring(lastSeparator + 1);
    }

    String lower = claimName.toLowerCase();
    switch (lower) {
      case "givenname":
      case "firstname":
        return "given_name";
      case "familyname":
      case "lastname":
      case "surname":
        return "family_name";
      case "displayname":
        return "name";
      default:
        return lower;
    }
  }

  private User getOrCreateUser(
      String username, String email, String displayName, List<String> teamsFromClaim) {
    try {
      // Fetch user with teams relationship loaded to preserve existing team memberships
      User existingUser =
          Entity.getEntityByName(
              Entity.USER, username, "id,roles,teams,isAdmin,email", Include.NON_DELETED);

      boolean shouldBeAdmin = getAdminPrincipals().contains(username);
      boolean needsUpdate = false;

      LOG.debug(
          "SAML login - Username: {}, Email: {}, Should be admin: {}, Current admin status: {}",
          username,
          email,
          shouldBeAdmin,
          existingUser.getIsAdmin());

      if (nullOrEmpty(displayName)) {
        LOG.warn(
            "[SAML] User '{}' has no display name. Check IdP configuration sends display name attributes: {}",
            username,
            displayNameAttributes);
      }

      if (shouldBeAdmin && !Boolean.TRUE.equals(existingUser.getIsAdmin())) {
        LOG.debug("Updating user {} to admin based on adminPrincipals", username);
        existingUser.setIsAdmin(true);
        needsUpdate = true;
      }

      // Update display name only if user doesn't already have one set
      if (!nullOrEmpty(displayName) && nullOrEmpty(existingUser.getDisplayName())) {
        LOG.debug("Setting display name for user {} to '{}'", username, displayName);
        existingUser.setDisplayName(displayName);
        needsUpdate = true;
      }

      // Assign teams from claims if provided (this only adds, doesn't remove existing teams)
      boolean teamsAssigned = UserUtil.assignTeamsFromClaim(existingUser, teamsFromClaim);
      needsUpdate = needsUpdate || teamsAssigned;

      if (needsUpdate) {
        return UserUtil.addOrUpdateUser(existingUser);
      }

      return existingUser;
    } catch (Exception e) {
      LOG.debug("User not found, creating new user: {}", username);
      if (authConfig.getEnableSelfSignup()) {
        boolean isAdmin = getAdminPrincipals().contains(username);
        User newUser =
            UserUtil.getUser(
                    username, new CreateUser().withName(username).withEmail(email).withIsBot(false))
                .withIsAdmin(isAdmin)
                .withIsEmailVerified(true);

        // Set display name if provided from SAML attributes
        if (!nullOrEmpty(displayName)) {
          newUser.withDisplayName(displayName);
        }

        // Assign teams from claims if provided
        UserUtil.assignTeamsFromClaim(newUser, teamsFromClaim);

        return UserUtil.addOrUpdateUser(newUser);
      }
      throw new AuthenticationException("User not found and self-signup is disabled");
    }
  }

  private Set<String> getAdminPrincipals() {
    AuthorizerConfiguration authorizerConfig = SecurityConfigurationManager.getCurrentAuthzConfig();
    return new HashSet<>(authorizerConfig.getAdminPrincipals());
  }

  private Set<String> trustedSamlRedirects() {
    Set<String> trusted =
        org.openmetadata.service.security.SecurityUtil.trustedRedirects(
            authConfig.getCallbackUrl(), samlSpCallback(), samlAuthCallback());
    trusted.addAll(listOrEmpty(authConfig.getAdditionalTrustedRedirectUris()));
    return trusted;
  }

  private ServiceProviderConfig samlSp() {
    SamlSSOClientConfig samlConfig = authConfig.getSamlConfiguration();
    return samlConfig == null ? null : samlConfig.getSp();
  }

  private String samlAuthCallback() {
    ServiceProviderConfig sp = samlSp();
    String acs = sp == null ? null : sp.getAcs();
    String authCallback = null;
    if (!nullOrEmpty(acs)) {
      try {
        URI uri = new URI(acs);
        if (uri.getScheme() != null && uri.getHost() != null) {
          URI origin =
              new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), null, null, null);
          authCallback = origin + AUTH_CALLBACK_PATH;
        }
      } catch (URISyntaxException e) {
        LOG.warn("Could not derive SAML server origin from ACS URL: {}", acs, e);
      }
    }
    return authCallback;
  }

  private String defaultSamlRedirectUri() {
    if (!nullOrEmpty(authConfig.getCallbackUrl())) {
      return authConfig.getCallbackUrl();
    }
    return samlSpCallback();
  }

  private String samlSpCallback() {
    ServiceProviderConfig sp = samlSp();
    return sp == null ? null : sp.getCallback();
  }

  private void sendError(HttpServletResponse resp, int status, String message) {
    try {
      writeErrorResponse(resp, status, message);
    } catch (IOException e) {
      LOG.error("Error writing error response", e);
    }
  }

  private RefreshToken rotateRefreshToken(
      UserSession session, UUID userId, String currentRefreshToken) {
    RefreshToken storedRefreshToken =
        (RefreshToken) Entity.getTokenRepository().findByToken(currentRefreshToken);
    if (storedRefreshToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new BadRequestException("Expired token. Please login again.");
    }
    Entity.getTokenRepository().deleteToken(currentRefreshToken);
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(userId, UUID.randomUUID());
    Entity.getTokenRepository().insertToken(newRefreshToken);
    return newRefreshToken;
  }

  private Optional<UserSession> completeRefresh(
      HttpServletRequest req,
      HttpServletResponse resp,
      UserSession session,
      String previousRefreshToken,
      String updatedRefreshToken) {
    Optional<UserSession> completedSession =
        sessionService.completeRefresh(session, updatedRefreshToken, null);
    if (completedSession.isEmpty() || completedSession.get().getStatus() != SessionStatus.ACTIVE) {
      deleteOrphanedRefreshToken(previousRefreshToken, updatedRefreshToken);
      sessionService.revokeSession(req, resp);
      sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Session revoked during refresh");
      return Optional.empty();
    }
    cleanupUnusedRefreshToken(previousRefreshToken, updatedRefreshToken, completedSession.get());
    return completedSession;
  }

  private void cleanupUnusedRefreshToken(
      String previousRefreshToken, String updatedRefreshToken, UserSession completedSession) {
    if (updatedRefreshToken == null || updatedRefreshToken.equals(previousRefreshToken)) {
      return;
    }
    String persistedRefreshToken = sessionService.decryptOmRefreshToken(completedSession);
    if (!updatedRefreshToken.equals(persistedRefreshToken)) {
      deleteRefreshTokenIfPresent(updatedRefreshToken);
    }
  }

  private void deleteOrphanedRefreshToken(String previousRefreshToken, String updatedRefreshToken) {
    if (updatedRefreshToken != null && !updatedRefreshToken.equals(previousRefreshToken)) {
      deleteRefreshTokenIfPresent(updatedRefreshToken);
    }
  }

  private void deleteRefreshTokenIfPresent(String refreshToken) {
    if (refreshToken != null) {
      Entity.getTokenRepository().deleteToken(refreshToken);
    }
  }

  private JWTAuthMechanism generateJwtToken(User user, UserSession session) {
    return JWTTokenGenerator.getInstance()
        .generateJWTTokenForSession(
            user.getName(),
            getRoleListFromUser(user),
            Boolean.TRUE.equals(user.getIsAdmin()),
            user.getEmail(),
            SamlSettingsHolder.getInstance().getTokenValidity(),
            ServiceTokenType.OM_USER,
            session.getId());
  }
}
