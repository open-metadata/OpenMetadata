package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.SecurityUtil.extractDisplayNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.writeErrorResponse;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.security.SecurityUtil.writeMessageResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.exception.SAMLException;
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
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
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
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.security.session.SessionRefreshInProgressException;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;

@Slf4j
public class SamlAuthServletHandler implements AuthServeletHandler {
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
      sessionService.createPendingSession(
          req, resp, authConfig.getProvider().value(), callbackUrl, null, null, null);

      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);

      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.login();

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
      // This handles the SAML response from IDP (ACS - Assertion Consumer Service)
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);

      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.processResponse();

      if (!auth.isAuthenticated()) {
        throw new AuthenticationException("SAML authentication failed");
      }

      List<String> errors = auth.getErrors();
      if (!errors.isEmpty()) {
        String errorReason = auth.getLastErrorReason();
        LOG.error("SAML authentication errors: {}", errorReason);
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, errorReason);
        return;
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

      UserSession pendingSession = sessionService.getPendingSession(req, resp).orElse(null);
      if (pendingSession == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No pending session");
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

      // Generate refresh token
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

      // Update last login time
      Entity.getUserRepository().updateUserLastLoginTime(user, System.currentTimeMillis());
      if (Entity.getAuditLogRepository() != null) {
        Entity.getAuditLogRepository()
            .writeAuthEvent(AuditLogRepository.AUTH_EVENT_LOGIN, user.getName(), user.getId());
      }

      String redirectUri = pendingSession.getRedirectUri();
      LOG.debug("SAML Callback - redirectUri from session: {}", redirectUri);
      JWTAuthMechanism jwtAuthMechanism = generateJwtToken(user, activeSession);

      String callbackUrl =
          org.openmetadata.service.security.SecurityUtil.validateRedirectUri(
              redirectUri == null ? defaultSamlRedirectUri() : redirectUri, trustedSamlRedirects());
      callbackUrl =
          org.openmetadata.service.security.SecurityUtil.buildRedirectWithToken(
              callbackUrl,
              jwtAuthMechanism.getJWTToken(),
              email,
              displayName == null ? "" : displayName);
      resp.sendRedirect(callbackUrl);

    } catch (IllegalArgumentException e) {
      LOG.error("Invalid SAML redirect URI in callback", e);
      sendError(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
    } catch (Exception e) {
      LOG.error("Error processing SAML callback", e);
      sendError(
          resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "SAML callback processing failed");
    }
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
            UserUtil.user(username, email.split("@")[1], username)
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
    return org.openmetadata.service.security.SecurityUtil.trustedRedirects(
        authConfig.getCallbackUrl(), samlSpCallback(), samlAuthCallback());
  }

  private String samlAuthCallback() {
    SamlSSOClientConfig samlConfig = authConfig.getSamlConfiguration();
    String acs =
        (samlConfig == null || samlConfig.getSp() == null) ? null : samlConfig.getSp().getAcs();
    String authCallback = null;
    if (!nullOrEmpty(acs)) {
      try {
        URI uri = new URI(acs);
        if (uri.getScheme() != null && uri.getHost() != null) {
          URI origin =
              new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), null, null, null);
          authCallback = origin + "/auth/callback";
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
    SamlSSOClientConfig samlConfig = authConfig.getSamlConfiguration();
    if (samlConfig == null || samlConfig.getSp() == null) {
      return null;
    }
    return samlConfig.getSp().getCallback();
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
