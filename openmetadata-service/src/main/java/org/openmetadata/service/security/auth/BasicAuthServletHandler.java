package org.openmetadata.service.security.auth;

import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.Base64;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.policyevaluator.SubjectCache;

@Slf4j
public class BasicAuthServletHandler implements AuthServeletHandler {
  private static final String SESSION_REFRESH_TOKEN = "refreshToken";
  private static final String SESSION_USER_ID = "userId";

  final BasicAuthenticator authenticator;
  final AuthenticationConfiguration authConfig;

  private static class Holder {
    private static volatile BasicAuthServletHandler instance;
    private static volatile AuthenticationConfiguration lastAuthConfig;
    private static volatile AuthorizerConfiguration lastAuthzConfig;
  }

  public static BasicAuthServletHandler getInstance(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    // Check if configuration has changed using reference equality
    // This works because SecurityConfigurationManager keeps the same object reference
    // until reloadSecuritySystem() is called
    if (Holder.instance == null || !isSameConfig(authConfig, authorizerConfig)) {
      synchronized (BasicAuthServletHandler.class) {
        if (Holder.instance == null || !isSameConfig(authConfig, authorizerConfig)) {
          Holder.instance = new BasicAuthServletHandler(authConfig, authorizerConfig);
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

  private BasicAuthServletHandler(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    this.authConfig = authConfig;
    this.authenticator = new BasicAuthenticator();
    try {
      OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
      config.setAuthenticationConfiguration(authConfig);
      config.setAuthorizerConfiguration(authorizerConfig);
      this.authenticator.init(config);
    } catch (Exception e) {
      LOG.error("Failed to initialize BasicAuthenticator", e);
    }
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      // Check if authenticator is available
      if (authenticator == null) {
        LOG.warn("BasicAuthenticator not initialized yet");
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

      JwtResponse jwtResponse = authenticator.loginUser(loginRequest);

      // Store refresh token in session for later use
      HttpSession session = req.getSession(true);
      if (jwtResponse.getRefreshToken() != null) {
        session.setAttribute(SESSION_REFRESH_TOKEN, jwtResponse.getRefreshToken());
      }
      session.setAttribute(SESSION_USER_ID, loginRequest.getEmail());

      JwtResponse responseToClient = new JwtResponse();
      responseToClient.setAccessToken(jwtResponse.getAccessToken());
      responseToClient.setTokenType(jwtResponse.getTokenType());
      responseToClient.setExpiryDuration(jwtResponse.getExpiryDuration());
      responseToClient.setRefreshToken(null);

      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("application/json");
      writeJsonResponse(resp, JsonUtils.pojoToJson(responseToClient));

    } catch (Exception e) {
      LOG.error("Error handling login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  @Override
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    // For Basic auth, the callback is handled by the frontend
    // The login already redirects with the token
    try {
      resp.setStatus(HttpServletResponse.SC_OK);
      writeJsonResponse(resp, "{\"message\":\"Callback handled by frontend\"}");
    } catch (IOException e) {
      LOG.error("Error handling callback", e);
    }
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    try {
      if (authenticator == null) {
        LOG.warn("BasicAuthenticator not initialized yet");
        sendError(
            resp, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Authentication service not ready");
        return;
      }

      HttpSession session = req.getSession(false);
      if (session == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No active session");
        return;
      }

      String refreshToken = (String) session.getAttribute(SESSION_REFRESH_TOKEN);
      if (refreshToken == null) {
        sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "No refresh token in session");
        return;
      }

      TokenRefreshRequest tokenRequest = new TokenRefreshRequest();
      tokenRequest.setRefreshToken(refreshToken);
      JwtResponse newTokens = authenticator.getNewAccessToken(tokenRequest);

      if (newTokens.getRefreshToken() != null
          && !newTokens.getRefreshToken().equals(refreshToken)) {
        session.setAttribute(SESSION_REFRESH_TOKEN, newTokens.getRefreshToken());
      }

      JwtResponse responseToClient = new JwtResponse();
      responseToClient.setAccessToken(newTokens.getAccessToken());
      responseToClient.setTokenType(newTokens.getTokenType());
      responseToClient.setExpiryDuration(newTokens.getExpiryDuration());
      resp.setStatus(HttpServletResponse.SC_OK);
      resp.setContentType("application/json");
      writeJsonResponse(resp, JsonUtils.pojoToJson(responseToClient));

    } catch (Exception e) {
      LOG.error("Error handling refresh", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
    }
  }

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
    try {
      HttpSession session = req.getSession(false);
      if (session != null) {
        // Invalidate policy cache for the user before invalidating session
        String userId = (String) session.getAttribute(SESSION_USER_ID);
        if (userId != null) {
          SubjectCache.invalidateUser(userId);
          // Write logout audit event
          if (Entity.getAuditLogRepository() != null) {
            try {
              User user = Entity.getEntityByName(Entity.USER, userId, "", Include.NON_DELETED);
              Entity.getAuditLogRepository()
                  .writeAuthEvent(
                      AuditLogRepository.AUTH_EVENT_LOGOUT, user.getName(), user.getId());
            } catch (Exception e) {
              LOG.debug("Could not write logout audit event for user {}", userId, e);
            }
          }
        }
        session.invalidate();
      }

      resp.setStatus(HttpServletResponse.SC_OK);
      writeJsonResponse(resp, "{\"message\":\"Logged out successfully\"}");
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

      // Decode base64 password as per existing api/v1/users/login behavior
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
      // GET requests are not supported for security reasons
      throw new IllegalArgumentException("GET method not supported for login. Use POST method.");
    }
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
