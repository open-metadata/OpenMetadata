package org.openmetadata.service.security.auth;

import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.SERVICE_UNAVAILABLE;
import static jakarta.ws.rs.core.Response.Status.UNAUTHORIZED;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.security.AuthServeletHandler;

@Slf4j
public class LdapAuthServletHandler implements AuthServeletHandler {
  private static final String SESSION_REFRESH_TOKEN = "refreshToken";
  private static final String SESSION_USER_ID = "userId";

  final LdapAuthenticator authenticator;
  final AuthenticationConfiguration authConfig;

  private static class Holder {
    private static volatile LdapAuthServletHandler instance;
    private static volatile AuthenticationConfiguration lastAuthConfig;
    private static volatile AuthorizerConfiguration lastAuthzConfig;
  }

  public static LdapAuthServletHandler getInstance(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    // Check if configuration has changed
    if (Holder.instance == null || !isSameConfig(authConfig, authorizerConfig)) {
      synchronized (LdapAuthServletHandler.class) {
        if (Holder.instance == null || !isSameConfig(authConfig, authorizerConfig)) {
          // Clean up old instance resources if exists
          if (Holder.instance != null && Holder.instance.authenticator != null) {
            // LdapAuthenticator might have connection pools to close
            LOG.info("Replacing LDAP handler due to config change");
          }
          Holder.instance = new LdapAuthServletHandler(authConfig, authorizerConfig);
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

  private LdapAuthServletHandler(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    this.authConfig = authConfig;
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
      writeJsonResponse(resp, "{\"message\":\"Callback handled by frontend\"}");
    } catch (IOException e) {
      LOG.error("Error handling callback", e);
    }
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    try {
      // Check if authenticator is available
      if (authenticator == null) {
        LOG.warn("LdapAuthenticator not initialized yet");
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

      // Use existing authenticator logic to get new tokens
      TokenRefreshRequest tokenRequest = new TokenRefreshRequest();
      tokenRequest.setRefreshToken(refreshToken);
      JwtResponse newTokens = authenticator.getNewAccessToken(tokenRequest);

      // Update session with new refresh token if changed
      if (newTokens.getRefreshToken() != null
          && !newTokens.getRefreshToken().equals(refreshToken)) {
        session.setAttribute(SESSION_REFRESH_TOKEN, newTokens.getRefreshToken());
      }

      // Return JSON response WITHOUT refresh token (security: refresh token stays server-side)
      JwtResponse responseToClient = new JwtResponse();
      responseToClient.setAccessToken(newTokens.getAccessToken());
      responseToClient.setTokenType(newTokens.getTokenType());
      responseToClient.setExpiryDuration(newTokens.getExpiryDuration());
      // Explicitly NOT setting refresh token - it stays in session only

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
        // Clear session
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
      resp.setStatus(status);
      writeJsonResponse(resp, String.format("{\"message\":\"%s\"}", message));
    } catch (IOException e) {
      LOG.error("Error writing error response", e);
    }
  }
}
