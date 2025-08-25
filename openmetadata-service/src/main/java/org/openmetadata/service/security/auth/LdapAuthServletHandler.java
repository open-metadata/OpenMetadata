package org.openmetadata.service.security.auth;

import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.BufferedReader;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.security.AuthServeletHandler;

@Slf4j
public class LdapAuthServletHandler implements AuthServeletHandler {
  private static final String SESSION_REFRESH_TOKEN = "refreshToken";
  private static final String SESSION_USER_ID = "userId";

  private final LdapAuthenticator authenticator;
  private final AuthenticationConfiguration authConfig;

  private static class Holder {
    private static LdapAuthServletHandler instance;
  }

  public static LdapAuthServletHandler getInstance(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authorizerConfig) {
    synchronized (LdapAuthServletHandler.class) {
      Holder.instance = new LdapAuthServletHandler(authConfig, authorizerConfig);
    }
    return Holder.instance;
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

      // Store refresh token in session (server-side)
      HttpSession session = req.getSession(true);
      session.setAttribute(SESSION_REFRESH_TOKEN, jwtResponse.getRefreshToken());
      session.setAttribute(SESSION_USER_ID, loginRequest.getEmail());

      // Redirect to auth callback with access token (unified pattern like SAML)
      String callbackUrl =
          "/auth/callback?id_token="
              + URLEncoder.encode(jwtResponse.getAccessToken(), StandardCharsets.UTF_8);
      resp.sendRedirect(callbackUrl);

    } catch (Exception e) {
      LOG.error("Error handling LDAP login", e);
      sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
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
      return JsonUtils.readValue(sb.toString(), LoginRequest.class);
    } else {
      // For GET requests, parse from query parameters
      LoginRequest request = new LoginRequest();
      request.setEmail(req.getParameter("email"));
      String password = req.getParameter("password");
      if (password != null) {
        // Encode to base64 as expected by LdapAuthenticator
        request.setPassword(Base64.getEncoder().encodeToString(password.getBytes()));
      }
      return request;
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
