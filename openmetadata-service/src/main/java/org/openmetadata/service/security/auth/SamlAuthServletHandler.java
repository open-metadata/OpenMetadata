package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.exception.SAMLException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;
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
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;

@Slf4j
public class SamlAuthServletHandler implements AuthServeletHandler {
  private static final String SESSION_REFRESH_TOKEN = "refreshToken";
  private static final String SESSION_USER_ID = "userId";
  private static final String SESSION_USERNAME = "username";
  private static final String SESSION_REDIRECT_URI = "redirectUri";

  final AuthenticationConfiguration authConfig;
  final AuthorizerConfiguration authorizerConfig;

  private static class Holder {
    private static volatile SamlAuthServletHandler instance;
    private static volatile AuthenticationConfiguration lastAuthConfig;
    private static volatile AuthorizerConfiguration lastAuthzConfig;
  }

  public static SamlAuthServletHandler getInstance(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    // Check if configuration has changed
    if (Holder.instance == null || !isSameConfig(authConfig, authorizerConfig)) {
      synchronized (SamlAuthServletHandler.class) {
        if (Holder.instance == null || !isSameConfig(authConfig, authorizerConfig)) {
          Holder.instance = new SamlAuthServletHandler(authConfig, authorizerConfig);
          Holder.lastAuthConfig = authConfig;
          Holder.lastAuthzConfig = authorizerConfig;
        }
      }
    }
    return Holder.instance;
  }

  private static boolean isSameConfig(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    return authConfig == Holder.lastAuthConfig && authorizerConfig == Holder.lastAuthzConfig;
  }

  private SamlAuthServletHandler(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    this.authConfig = authConfig;
    this.authorizerConfig = authorizerConfig;
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      String callbackUrl = req.getParameter("callback");
      if (callbackUrl == null) {
        callbackUrl = req.getParameter("redirectUri");
      }
      if (callbackUrl != null) {
        req.getSession(true).setAttribute(SESSION_REDIRECT_URI, callbackUrl);
      }

      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);

      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.login();

    } catch (SAMLException e) {
      LOG.error("Error initiating SAML login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "SAML login initiation failed");
    } catch (Exception e) {
      LOG.error("Error handling SAML login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
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

      // Extract team/group attributes from SAML response (supports multi-valued attributes)
      List<String> teamsFromClaim = new ArrayList<>();
      Object teamClaimMapping = authConfig.getJwtTeamClaimMapping();
      List<String> teamClaimMappings = normalizeTeamClaimMappings(teamClaimMapping);
      
      if (!teamClaimMappings.isEmpty()) {
        for (String claimMapping : teamClaimMappings) {
          try {
            Collection<String> attributeValues = auth.getAttribute(claimMapping);
            if (attributeValues != null && !attributeValues.isEmpty()) {
              teamsFromClaim.addAll(attributeValues);
              LOG.debug(
                  "[SAML] Found team attribute '{}' with {} value(s)",
                  claimMapping,
                  attributeValues.size());
            }
          } catch (Exception e) {
            LOG.debug(
                "[SAML] Could not extract team attribute '{}': {}", claimMapping, e.getMessage());
          }
        }
        LOG.debug(
            "[SAML] Total teams extracted from {} attribute(s): {}",
            teamClaimMappings.size(),
            teamsFromClaim.size());
      }

      // Extract user attributes from SAML response
      Map<String, String> userAttributes =
          extractUserAttributesFromSaml(auth, authConfig.getJwtUserAttributeMappings());

      // Get or create user
      User user = getOrCreateUser(username, email, teamsFromClaim, userAttributes);

      // Generate JWT tokens
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  username,
                  getRoleListFromUser(user),
                  !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
                  user.getEmail(),
                  SamlSettingsHolder.getInstance().getTokenValidity(),
                  false,
                  ServiceTokenType.OM_USER);

      // Generate refresh token
      RefreshToken refreshToken = TokenUtil.getRefreshToken(user.getId(), UUID.randomUUID());
      Entity.getTokenRepository().insertToken(refreshToken);

      // Store refresh token in session (server-side)
      HttpSession session = req.getSession(true);
      session.setAttribute(SESSION_REFRESH_TOKEN, refreshToken.getToken().toString());
      session.setAttribute(SESSION_USER_ID, user.getId().toString());
      session.setAttribute(SESSION_USERNAME, username);

      // Update last login time
      Entity.getUserRepository().updateUserLastLoginTime(user, System.currentTimeMillis());
      if (Entity.getAuditLogRepository() != null) {
        Entity.getAuditLogRepository()
            .writeAuthEvent(AuditLogRepository.AUTH_EVENT_LOGIN, user.getName(), user.getId());
      }

      // Get stored redirect URI from session
      String redirectUri = (String) req.getSession().getAttribute(SESSION_REDIRECT_URI);
      LOG.debug("SAML Callback - redirectUri from session: {}", redirectUri);

      String callbackUrl;
      if (redirectUri != null) {
        callbackUrl =
            redirectUri
                + "?id_token="
                + URLEncoder.encode(jwtAuthMechanism.getJWTToken(), StandardCharsets.UTF_8);
      } else {
        callbackUrl =
            "/auth/callback?id_token="
                + URLEncoder.encode(jwtAuthMechanism.getJWTToken(), StandardCharsets.UTF_8);
      }
      resp.sendRedirect(callbackUrl);

    } catch (Exception e) {
      LOG.error("Error processing SAML callback", e);
      sendError(
          resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "SAML callback processing failed");
    }
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    try {
      HttpSession session = req.getSession(false);
      if (session == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No active session");
        return;
      }

      String refreshToken = (String) session.getAttribute(SESSION_REFRESH_TOKEN);
      String username = (String) session.getAttribute(SESSION_USERNAME);

      if (refreshToken == null || username == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No refresh token in session");
        return;
      }

      // Get user
      User user =
          Entity.getEntityByName(
              Entity.USER, username, "id,roles,isAdmin,email", Include.NON_DELETED);

      // Generate new access token
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  username,
                  getRoleListFromUser(user),
                  !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
                  user.getEmail(),
                  SamlSettingsHolder.getInstance().getTokenValidity(),
                  false,
                  ServiceTokenType.OM_USER);

      // Return JSON response WITHOUT refresh token (security: refresh token stays server-side)
      JwtResponse responseToClient = new JwtResponse();
      responseToClient.setAccessToken(jwtAuthMechanism.getJWTToken());
      responseToClient.setTokenType("Bearer");
      responseToClient.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
      // Explicitly NOT setting refresh token - it stays in session only

      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("application/json");
      writeJsonResponse(resp, JsonUtils.pojoToJson(responseToClient));

    } catch (Exception e) {
      LOG.error("Error handling SAML refresh", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
    try {
      HttpSession session = req.getSession(false);
      if (session != null) {
        // Write logout audit event before invalidating session
        String userId = (String) session.getAttribute(SESSION_USER_ID);
        String username = (String) session.getAttribute(SESSION_USERNAME);
        if (userId != null && username != null && Entity.getAuditLogRepository() != null) {
          try {
            Entity.getAuditLogRepository()
                .writeAuthEvent(
                    AuditLogRepository.AUTH_EVENT_LOGOUT, username, UUID.fromString(userId));
          } catch (Exception e) {
            LOG.debug("Could not write logout audit event for user {}", username, e);
          }
        }
        // Clear session
        session.invalidate();
      }

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
        resp.setStatus(HttpServletResponse.SC_OK);
        writeJsonResponse(resp, "{\"message\":\"Logged out successfully (local only)\"}");
      }

    } catch (Exception e) {
      LOG.error("Error handling SAML logout", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  private User getOrCreateUser(
      String username, String email, List<String> teamsFromClaim, Map<String, String> userAttributes) {
    try {
      // Fetch user with teams and profile relationships loaded
      User existingUser =
          Entity.getEntityByName(
              Entity.USER, username, "id,roles,teams,profile,isAdmin,email", Include.NON_DELETED);

      boolean shouldBeAdmin = getAdminPrincipals().contains(username);
      boolean needsUpdate = false;

      LOG.info(
          "SAML login - Username: {}, Email: {}, Should be admin: {}, Current admin status: {}",
          username,
          email,
          shouldBeAdmin,
          existingUser.getIsAdmin());
      LOG.info("Admin principals list: {}", getAdminPrincipals());

      if (shouldBeAdmin && !Boolean.TRUE.equals(existingUser.getIsAdmin())) {
        LOG.info("Updating user {} to admin based on adminPrincipals", username);
        existingUser.setIsAdmin(true);
        needsUpdate = true;
      }

      // Assign teams from claims if provided (this only adds, doesn't remove existing teams)
      boolean teamsAssigned = UserUtil.assignTeamsFromClaim(existingUser, teamsFromClaim);
      needsUpdate = needsUpdate || teamsAssigned;

      // Apply user attributes from claims (only updates null/empty fields)
      boolean attributesApplied = UserUtil.applyUserAttributesFromClaims(existingUser, userAttributes, false);
      needsUpdate = needsUpdate || attributesApplied;

      if (needsUpdate) {
        return UserUtil.addOrUpdateUser(existingUser);
      }

      return existingUser;
    } catch (Exception e) {
      LOG.info("User not found, creating new user: {}", username);
      if (authConfig.getEnableSelfSignup()) {
        boolean isAdmin = getAdminPrincipals().contains(username);
        LOG.info("Creating new user - Username: {}, Should be admin: {}", username, isAdmin);
        LOG.info("Admin principals list: {}", getAdminPrincipals());
        User newUser =
            UserUtil.user(username, email.split("@")[1], username)
                .withIsAdmin(isAdmin)
                .withIsEmailVerified(true);

        // Assign teams from claims if provided
        UserUtil.assignTeamsFromClaim(newUser, teamsFromClaim);

        // Apply user attributes from claims
        UserUtil.applyUserAttributesFromClaims(newUser, userAttributes, true);

        return UserUtil.addOrUpdateUser(newUser);
      }
      throw new AuthenticationException("User not found and self-signup is disabled");
    }
  }

  private Set<String> getAdminPrincipals() {
    AuthorizerConfiguration authorizerConfig = SecurityConfigurationManager.getCurrentAuthzConfig();
    return new HashSet<>(authorizerConfig.getAdminPrincipals());
  }

  /** Extracts user attributes from SAML assertion based on configured mappings. */
  private static Map<String, String> extractUserAttributesFromSaml(
      Auth auth, Object attributeMappings) {
    Map<String, String> result = new HashMap<>();
    if (attributeMappings == null) {
      return result;
    }
    if (!(attributeMappings instanceof Map<?, ?> mappings)) {
      return result;
    }

    for (Map.Entry<?, ?> entry : mappings.entrySet()) {
      if (!(entry.getKey() instanceof String key) || !(entry.getValue() instanceof String claimName)) {
        continue;
      }
      if (nullOrEmpty(claimName)) {
        continue;
      }
      try {
        Collection<String> values = auth.getAttribute(claimName);
        if (values != null && !values.isEmpty()) {
          String value = values.iterator().next();
          if (!nullOrEmpty(value)) {
            result.put(key, value);
            LOG.debug("[SAML] Extracted user attribute '{}' from claim '{}'", key, claimName);
          }
        }
      } catch (Exception e) {
        LOG.debug("[SAML] Could not extract attribute '{}': {}", claimName, e.getMessage());
      }
    }
    return result;
  }

  /**
   * Normalizes team claim mapping configuration to a list format.
   * Supports backward compatibility with single string or new array format.
   *
   * @param teamClaimMapping Single string or Object (can be List or String from JSON)
   * @return List of team claim mapping strings
   */
  private static List<String> normalizeTeamClaimMappings(Object teamClaimMapping) {
    if (teamClaimMapping == null) {
      return new ArrayList<>();
    }

    // Handle if it's already a List (from new array format)
    if (teamClaimMapping instanceof List<?> list) {
      return list.stream()
          .filter(item -> item instanceof String)
          .map(String.class::cast)
          .filter(s -> !nullOrEmpty(s))
          .collect(Collectors.toList());
    }

    // Handle single string (legacy format)
    if (teamClaimMapping instanceof String str && !nullOrEmpty(str)) {
      return List.of(str);
    }

    LOG.warn("Unexpected type for jwtTeamClaimMapping: {}", teamClaimMapping.getClass().getName());
    return new ArrayList<>();
  }

  private void sendError(HttpServletResponse resp, int status, String message) {
    try {
      resp.setStatus(status);
      writeJsonResponse(resp, String.format("{\"error\":\"%s\"}", message));
    } catch (IOException e) {
      LOG.error("Error writing error response", e);
    }
  }
}
