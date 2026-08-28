package org.openmetadata.service.security.auth;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.SecurityUtil.extractDisplayNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;
import static org.openmetadata.service.util.UserUtil.isAdminEmail;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.exception.SAMLException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.EmailFirstUserProvisioner;
import org.openmetadata.service.security.SamlIdentityResolver;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.util.EntityUtil.Fields;
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
  private List<String> displayNameAttributes;

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

      SamlIdentityResolver.ResolvedSamlIdentity identity = resolveSamlIdentity(auth);

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
      User user =
          identity.emailFirstFlow()
              ? getOrCreateEmailFirstSamlUser(
                  identity.email(), identity.displayName(), teamsFromClaim)
              : getOrCreateLegacySamlUser(
                  identity.userName(), identity.email(), identity.displayName(), teamsFromClaim);

      // Generate JWT tokens
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  user.getName(),
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
      session.setAttribute(SESSION_USERNAME, user.getName());

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

  private SamlIdentityResolver.ResolvedSamlIdentity resolveSamlIdentity(Auth auth) {
    return new SamlIdentityResolver(
            authConfig,
            authorizerConfig,
            assertionAccessor -> extractDisplayNameFromSamlAttributes(auth),
            () -> SamlSettingsHolder.getInstance().getDomain())
        .resolve(
            new SamlIdentityResolver.SamlAssertionAccessor() {
              @Override
              public Collection<String> getAttribute(String attributeName) {
                return auth.getAttribute(attributeName);
              }

              @Override
              public String getNameId() {
                return auth.getNameId();
              }
            });
  }

  private String extractDisplayNameFromSamlAttributes(Auth auth) {
    try {
      Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);

      for (String attributeName : displayNameAttributes) {
        Collection<String> attributeValues = auth.getAttribute(attributeName);
        if (attributeValues != null && !attributeValues.isEmpty()) {
          String value = attributeValues.iterator().next();
          claims.put(mapToStandardClaimName(attributeName), value);
        }
      }

      if (claims.isEmpty()) {
        LOG.warn(
            "[SAML] No display name attributes found in SAML assertion. Checked attributes: {}",
            displayNameAttributes);
        return null;
      }

      return extractDisplayNameFromClaims(claims);
    } catch (Exception e) {
      LOG.error("[SAML] Error extracting display name", e);
      return null;
    }
  }

  private String mapToStandardClaimName(String samlAttributeName) {
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

  private User getOrCreateEmailFirstSamlUser(
      String email, String displayName, List<String> teamsFromClaim) {
    return new EmailFirstUserProvisioner(
            "SAML",
            emailAddress ->
                Entity.getUserRepository()
                    .getActiveUserByEmailForAuth(
                        emailAddress, new Fields(Set.of("id", "roles", "teams", "displayName"))),
            Entity.getUserRepository()::checkUserNameExists,
            this::isUserAdmin,
            user -> UserUtil.assignTeamsFromClaim(user, teamsFromClaim),
            user -> UserUtil.assignTeamsFromClaim(user, teamsFromClaim),
            UserUtil::addOrUpdateUser,
            AuthenticationException::new,
            emailAddress ->
                SecurityUtil.isEmailRegistrationDomainAllowed(
                    emailAddress, authorizerConfig.getAllowedEmailRegistrationDomains()))
        .getOrCreate(email, displayName, Boolean.TRUE.equals(authConfig.getEnableSelfSignup()));
  }

  private User getOrCreateLegacySamlUser(
      String userName, String email, String displayName, List<String> teamsFromClaim) {
    for (int attempt = 1; attempt <= 3; attempt++) {
      try {
        User user =
            Entity.getEntityByName(
                Entity.USER, userName, "id,roles,teams,displayName,isAdmin", Include.NON_DELETED);

        boolean needsUpdate = false;
        boolean shouldBeAdmin = isUserAdmin(email, userName);

        LOG.debug(
            "SAML legacy login - Username: {}, Email: {}, Should be admin: {}, Current admin status: {}",
            userName,
            email,
            shouldBeAdmin,
            user.getIsAdmin());

        if (shouldBeAdmin && !Boolean.TRUE.equals(user.getIsAdmin())) {
          LOG.debug(
              "Updating user {} to admin based on adminEmails/adminPrincipals", user.getName());
          user.setIsAdmin(true);
          needsUpdate = true;
        }

        if (!nullOrEmpty(displayName) && !displayName.equals(user.getDisplayName())) {
          LOG.debug(
              "Updating displayName for user {} from '{}' to '{}'",
              user.getName(),
              user.getDisplayName(),
              displayName);
          user.setDisplayName(displayName);
          needsUpdate = true;
        }

        boolean teamsAssigned = UserUtil.assignTeamsFromClaim(user, teamsFromClaim);
        needsUpdate = needsUpdate || teamsAssigned;

        if (needsUpdate) {
          return UserUtil.addOrUpdateUser(user);
        }

        return user;
      } catch (EntityNotFoundException e) {
        LOG.debug("User not found by username {}, will create new user", userName);
      }

      if (!Boolean.TRUE.equals(authConfig.getEnableSelfSignup())) {
        throw new AuthenticationException(
            "User not registered. Contact administrator to create an account.");
      }

      boolean isAdmin = isUserAdmin(email, userName);
      User newUser =
          UserUtil.user(userName, email.split("@")[1], userName)
              .withEmail(email)
              .withDisplayName(displayName != null ? displayName : userName)
              .withIsAdmin(isAdmin)
              .withIsEmailVerified(true);

      UserUtil.assignTeamsFromClaim(newUser, teamsFromClaim);

      try {
        return UserUtil.addOrUpdateUser(newUser);
      } catch (org.openmetadata.sdk.exception.UserCreationException ex) {
        if (!UserUtil.isRetryableUserCreationConflict(ex) || attempt == 3) {
          throw ex;
        }
        LOG.warn(
            "Retrying SAML legacy user creation for '{}' after a concurrent create conflict",
            userName);
      }
    }

    throw new AuthenticationException("Unable to create SAML user after concurrent retries.");
  }

  private String extractAttributeFromAssertion(Auth auth, String attributeName) {
    if (nullOrEmpty(attributeName)) {
      return null;
    }
    try {
      Collection<String> values = auth.getAttribute(attributeName);
      if (values != null && !values.isEmpty()) {
        return values.iterator().next();
      }
    } catch (Exception e) {
      LOG.debug(
          "Could not extract attribute '{}' from SAML assertion: {}",
          attributeName,
          e.getMessage());
    }
    return null;
  }

  private boolean isUserAdmin(String email, String username) {
    List<String> adminEmails =
        authorizerConfig.getAdminEmails() != null
            ? new ArrayList<>(authorizerConfig.getAdminEmails())
            : new ArrayList<>();
    if (isAdminEmail(email, adminEmails)) {
      return true;
    }
    return getAdminPrincipals().contains(username);
  }

  private Set<String> getAdminPrincipals() {
    Set<String> principals = authorizerConfig.getAdminPrincipals();
    return principals != null ? new HashSet<>(principals) : new HashSet<>();
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
