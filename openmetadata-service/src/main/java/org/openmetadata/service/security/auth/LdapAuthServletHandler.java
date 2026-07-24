package org.openmetadata.service.security.auth;

import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.SERVICE_UNAVAILABLE;
import static jakarta.ws.rs.core.Response.Status.UNAUTHORIZED;
import static org.openmetadata.service.security.SecurityUtil.writeErrorResponse;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.security.SecurityUtil.writeMessageResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.session.SessionRefreshInProgressException;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

@Slf4j
public class LdapAuthServletHandler implements AuthServeletHandler {
  final LdapAuthenticator authenticator;
  final AuthenticationConfiguration authConfig;
  final SessionService sessionService;

  public LdapAuthServletHandler(
      AuthenticationConfiguration authConfig,
      AuthorizerConfiguration authorizerConfig,
      SessionService sessionService) {
    this.authConfig = authConfig;
    this.sessionService = sessionService;
    this.authenticator = new LdapAuthenticator();
    try {
      OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
      config.setAuthenticationConfiguration(authConfig);
      config.setAuthorizerConfiguration(authorizerConfig);
      this.authenticator.init(config);
    } catch (Exception e) {
      LOG.error("Failed to initialize LdapAuthenticator", e);
    }
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      if (authenticator == null) {
        LOG.warn("LdapAuthenticator not initialized yet");
        sendError(
            resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Authentication service not ready");
        return;
      }

      LoginRequest loginRequest = parseLoginRequest(req);

      if (loginRequest == null
          || loginRequest.getEmail() == null
          || loginRequest.getPassword() == null) {
        sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid login request");
        return;
      }

      // Use existing LdapAuthenticator logic
      JwtResponse jwtResponse = authenticator.loginUser(loginRequest);
      User user;
      try {
        user = getUserByEmail(loginRequest.getEmail());
      } catch (EntityNotFoundException e) {
        deleteRefreshTokenIfPresent(jwtResponse.getRefreshToken());
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "User not found");
        return;
      }
      if (user == null) {
        deleteRefreshTokenIfPresent(jwtResponse.getRefreshToken());
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "User not found");
        return;
      }
      UserSession session;
      try {
        session =
            sessionService.createActiveSession(
                req, resp, authConfig.getProvider().value(), user, jwtResponse.getRefreshToken());
      } catch (Exception e) {
        deleteRefreshTokenIfPresent(jwtResponse.getRefreshToken());
        throw e;
      }

      JwtResponse responseToClient = buildSessionBoundJwtResponse(user, session);

      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("application/json");
      writeJsonResponse(resp, JsonUtils.pojoToJson(responseToClient));

    } catch (CustomExceptionMessage e) {
      LOG.error("LDAP login error: {}", e.getMessage(), e);
      int statusCode = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
      if (e.getResponse().getStatus() == SERVICE_UNAVAILABLE.getStatusCode()) {
        statusCode = HttpServletResponse.SC_SERVICE_UNAVAILABLE;
      } else if (e.getResponse().getStatus() == UNAUTHORIZED.getStatusCode()) {
        statusCode = HttpServletResponse.SC_UNAUTHORIZED;
      } else if (e.getResponse().getStatus() == FORBIDDEN.getStatusCode()) {
        statusCode = HttpServletResponse.SC_FORBIDDEN;
      }

      sendError(resp, statusCode, e.getMessage());
    } catch (Exception e) {
      LOG.error("Unexpected error handling LDAP login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Authentication service error");
    }
  }

  @Override
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    // For LDAP auth, the callback is handled by the frontend
    // The login already redirects with the token
    try {
      resp.setStatus(HttpServletResponse.SC_OK);
      writeMessageResponse(resp, HttpServletResponse.SC_OK, "Callback handled by frontend");
    } catch (IOException e) {
      LOG.error("Error handling callback", e);
    }
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    UserSession leasedSession = null;
    try {
      // Check if authenticator is available
      if (authenticator == null) {
        LOG.warn("LdapAuthenticator not initialized yet");
        sendError(
            resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Authentication service not ready");
        return;
      }

      UserSession session = sessionService.acquireRefreshLease(req, resp).orElse(null);
      leasedSession = session;
      if (session == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No active session");
        return;
      }

      String refreshToken = sessionService.decryptOmRefreshToken(session);
      if (refreshToken == null) {
        sessionService.revokeSession(req, resp);
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No refresh token in session");
        return;
      }
      // Use existing authenticator logic to get new tokens
      TokenRefreshRequest tokenRequest = new TokenRefreshRequest();
      tokenRequest.setRefreshToken(refreshToken);
      JwtResponse newTokens = authenticator.getNewAccessToken(tokenRequest);
      String updatedRefreshToken =
          newTokens.getRefreshToken() != null ? newTokens.getRefreshToken() : refreshToken;
      Optional<UserSession> completedSession =
          completeRefresh(req, resp, session, refreshToken, updatedRefreshToken);
      if (completedSession.isEmpty()) {
        return;
      }
      User user = getSessionUser(completedSession.get());
      if (user == null) {
        sessionService.revokeSession(req, resp);
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Session user not found");
        return;
      }

      JwtResponse responseToClient = buildSessionBoundJwtResponse(user, completedSession.get());

      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("application/json");
      writeJsonResponse(resp, JsonUtils.pojoToJson(responseToClient));

    } catch (SessionRefreshInProgressException e) {
      resp.setHeader("Retry-After", Integer.toString(e.getRetryAfterSeconds()));
      sendError(resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE, e.getMessage());
    } catch (Exception e) {
      sessionService.releaseRefreshLease(leasedSession);
      LOG.error("Error handling refresh", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
    try {
      UserSession session = sessionService.getSession(req).orElse(null);
      if (session != null) {
        if (session.getUsername() != null) {
          SubjectCache.invalidateUser(session.getUsername());
        }
        String refreshToken = sessionService.decryptOmRefreshToken(session);
        if (refreshToken != null) {
          Entity.getTokenRepository().deleteToken(refreshToken);
        }
        if (Entity.getAuditLogRepository() != null
            && session.getUserId() != null
            && session.getUsername() != null) {
          try {
            Entity.getAuditLogRepository()
                .writeAuthEvent(
                    AuditLogRepository.AUTH_EVENT_LOGOUT,
                    session.getUsername(),
                    java.util.UUID.fromString(session.getUserId()));
          } catch (Exception e) {
            LOG.debug("Could not write logout audit event for user {}", session.getUsername(), e);
          }
        }
      }
      sessionService.revokeSession(req, resp);

      writeMessageResponse(resp, HttpServletResponse.SC_OK, "Logged out successfully");
    } catch (IOException e) {
      LOG.error("Error handling logout", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  private LoginRequest parseLoginRequest(HttpServletRequest req) throws IOException {
    if ("POST".equalsIgnoreCase(req.getMethod())) {
      StringBuilder sb = new StringBuilder();
      try (BufferedReader reader = req.getReader()) {
        String line;
        while ((line = reader.readLine()) != null) {
          sb.append(line);
        }
      }
      LoginRequest loginRequest = JsonUtils.readValue(sb.toString(), LoginRequest.class);

      if (loginRequest.getPassword() != null) {
        byte[] decodedBytes;
        try {
          decodedBytes = Base64.getDecoder().decode(loginRequest.getPassword());
        } catch (Exception ex) {
          throw new IllegalArgumentException("Password needs to be encoded in Base-64.");
        }
        loginRequest.withPassword(new String(decodedBytes));
      }

      return loginRequest;
    } else {
      throw new IllegalArgumentException("GET method not supported for login. Use POST method.");
    }
  }

  private void sendError(HttpServletResponse resp, int status, String message) {
    try {
      writeErrorResponse(resp, status, message);
    } catch (IOException e) {
      LOG.error("Error writing error response", e);
    }
  }

  private User getUserByEmail(String email) {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    return userRepository.getByEmail(
        null, email, userRepository.getFieldsWithUserAuth("id,name,email,roles,isAdmin"));
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

  private User getSessionUser(UserSession session) {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    if (session.getUserId() != null) {
      return userRepository.get(
          null,
          UUID.fromString(session.getUserId()),
          userRepository.getFieldsWithUserAuth("id,name,email,roles,isAdmin"));
    }
    if (session.getUsername() != null) {
      return userRepository.getByName(
          null,
          session.getUsername(),
          userRepository.getFieldsWithUserAuth("id,name,email,roles,isAdmin"));
    }
    return null;
  }

  private JwtResponse buildSessionBoundJwtResponse(User user, UserSession session) {
    org.openmetadata.schema.auth.JWTAuthMechanism jwtAuthMechanism =
        JWTTokenGenerator.getInstance()
            .generateJWTTokenForSession(
                user.getName(),
                getRoleListFromUser(user),
                Boolean.TRUE.equals(user.getIsAdmin()),
                user.getEmail(),
                SecurityUtil.getLoginConfiguration().getJwtTokenExpiryTime(),
                ServiceTokenType.OM_USER,
                session.getId());
    JwtResponse response = new JwtResponse();
    response.setAccessToken(jwtAuthMechanism.getJWTToken());
    response.setTokenType("Bearer");
    response.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
    response.setRefreshToken(null);
    return response;
  }
}
