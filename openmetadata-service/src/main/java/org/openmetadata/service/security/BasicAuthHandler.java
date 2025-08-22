/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.BufferedReader;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.saml.JwtTokenCacheManager;

@Slf4j
public class BasicAuthHandler implements AuthServeletHandler {
  private static final String CALLBACK_PATH = "/callback";
  private final TokenRepository tokenRepository;
  private final ObjectMapper objectMapper;

  public BasicAuthHandler() {
    this.tokenRepository = Entity.getTokenRepository();
    this.objectMapper = new ObjectMapper();
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      LoginRequest loginRequest = parseLoginRequest(req);

      // Decode base64 password
      byte[] decodedBytes;
      try {
        decodedBytes = Base64.getDecoder().decode(loginRequest.getPassword());
      } catch (Exception ex) {
        throw new IllegalArgumentException("Password needs to be encoded in Base-64.");
      }
      loginRequest.withPassword(new String(decodedBytes));

      // Authenticate user
      JwtResponse jwtResponse =
          SecurityConfigurationManager.getInstance()
              .getAuthenticatorHandler()
              .loginUser(loginRequest);

      // Store session information for unified pattern
      HttpSession session = req.getSession(true);
      session.setAttribute("jwtResponse", jwtResponse);

      // Redirect to callback with token (unified pattern)
      String callbackUrl = getCallbackUrl(req);
      String redirectUrl =
          callbackUrl
              + "?id_token="
              + jwtResponse.getAccessToken()
              + "&refresh_token="
              + jwtResponse.getRefreshToken();
      resp.sendRedirect(redirectUrl);

    } catch (Exception e) {
      AuthErrorHandler.handleAuthError(resp, e, "BASIC");
    }
  }

  @Override
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    // For basic auth, callback handling is done client-side
    // The AuthCallbackServlet forwards to React app for Basic/LDAP auth
    // This method should not be called directly
    LOG.debug("Basic auth callback - handled by React app");
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    try {
      LOG.info(
          "BasicAuthHandler.handleRefresh called with redirectUri: {}",
          req.getParameter("redirectUri"));
      TokenRefreshRequest refreshRequest = parseRefreshRequest(req);

      JwtResponse newTokenResponse =
          SecurityConfigurationManager.getInstance()
              .getAuthenticatorHandler()
              .getNewAccessToken(refreshRequest);

      // Update session with new token
      HttpSession session = req.getSession(true);
      session.setAttribute("jwtResponse", newTokenResponse);

      // Get the redirect URI from the request parameter
      String redirectUri = req.getParameter("redirectUri");
      if (redirectUri == null || redirectUri.isEmpty()) {
        // Fall back to default callback URL
        redirectUri = getCallbackUrl(req);
      }

      LOG.info("Redirecting refresh to: {}", redirectUri);

      // Redirect to the specified URI with new token (unified pattern)
      String redirectUrl =
          redirectUri
              + "?id_token="
              + newTokenResponse.getAccessToken()
              + "&refresh_token="
              + newTokenResponse.getRefreshToken();
      resp.sendRedirect(redirectUrl);

    } catch (Exception e) {
      AuthErrorHandler.handleAuthError(resp, e, "BASIC");
    }
  }

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
    try {
      LogoutRequest logoutRequest = parseLogoutRequest(req);

      Date logoutTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant());
      JwtTokenCacheManager.getInstance()
          .markLogoutEventForToken(
              new LogoutRequest()
                  .withUsername(logoutRequest.getUsername())
                  .withToken(logoutRequest.getToken())
                  .withLogoutTime(logoutTime));

      // Clear refresh token if present
      if (logoutRequest.getRefreshToken() != null) {
        tokenRepository.deleteToken(logoutRequest.getRefreshToken());
      }

      // Invalidate session
      HttpSession session = req.getSession(false);
      if (session != null) {
        session.invalidate();
      }

      // Redirect to login page or home after logout (unified pattern)
      String logoutRedirectUrl = req.getParameter("logoutRedirectUrl");
      if (logoutRedirectUrl == null || logoutRedirectUrl.isEmpty()) {
        // Try the alternative parameter name for compatibility
        logoutRedirectUrl = req.getParameter("redirectUri");
      }
      if (logoutRedirectUrl == null || logoutRedirectUrl.isEmpty()) {
        logoutRedirectUrl = getBaseUrl(req) + "/signin";
      }
      resp.sendRedirect(logoutRedirectUrl);

    } catch (Exception e) {
      LOG.error("Error during basic auth logout", e);
      // Even on error, redirect to signin page
      try {
        resp.sendRedirect(getBaseUrl(req) + "/signin?error=logout_failed");
      } catch (IOException ioException) {
        resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
      }
    }
  }

  private LoginRequest parseLoginRequest(HttpServletRequest req) throws IOException {
    // Check if it's form data or JSON
    String contentType = req.getContentType();

    if (contentType != null && contentType.contains("application/x-www-form-urlencoded")) {
      // Handle form data
      String email = req.getParameter("email");
      String password = req.getParameter("password");

      LoginRequest loginRequest = new LoginRequest();
      loginRequest.setEmail(email);
      loginRequest.setPassword(password);
      return loginRequest;
    } else {
      // Handle JSON (existing logic)
      StringBuilder sb = new StringBuilder();
      BufferedReader reader = req.getReader();
      String line;
      while ((line = reader.readLine()) != null) {
        sb.append(line);
      }
      return JsonUtils.readValue(sb.toString(), LoginRequest.class);
    }
  }

  private TokenRefreshRequest parseRefreshRequest(HttpServletRequest req) throws IOException {
    // Check if refresh token is in URL parameters (GET request from iframe)
    String refreshToken = req.getParameter("refreshToken");

    if (refreshToken != null) {
      // Parse from URL parameters
      TokenRefreshRequest request = new TokenRefreshRequest();
      request.setRefreshToken(refreshToken);
      return request;
    } else {
      // Parse from JSON body (POST request)
      StringBuilder sb = new StringBuilder();
      BufferedReader reader = req.getReader();
      String line;
      while ((line = reader.readLine()) != null) {
        sb.append(line);
      }
      return JsonUtils.readValue(sb.toString(), TokenRefreshRequest.class);
    }
  }

  private LogoutRequest parseLogoutRequest(HttpServletRequest req) throws IOException {
    // Check if parameters are in URL (GET request)
    String token = req.getParameter("token");
    String refreshToken = req.getParameter("refreshToken");

    if (token != null) {
      // Parse from URL parameters
      LogoutRequest logoutRequest = new LogoutRequest();
      logoutRequest.setToken(token);
      logoutRequest.setRefreshToken(refreshToken);

      // Extract username from token if possible
      try {
        if (token != null && !token.isEmpty()) {
          String[] parts = token.split("\\.");
          if (parts.length == 3) {
            String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
            Map<String, Object> claims = JsonUtils.readValue(payload, Map.class);
            String username = (String) claims.get("sub");
            if (username == null) {
              username = (String) claims.get("email");
            }
            logoutRequest.setUsername(username);
          }
        }
      } catch (Exception e) {
        LOG.debug("Could not extract username from token", e);
      }

      return logoutRequest;
    } else {
      // Parse from JSON body (POST request)
      StringBuilder sb = new StringBuilder();
      BufferedReader reader = req.getReader();
      String line;
      while ((line = reader.readLine()) != null) {
        sb.append(line);
      }
      return JsonUtils.readValue(sb.toString(), LogoutRequest.class);
    }
  }

  private String getCallbackUrl(HttpServletRequest req) {
    String redirectUri = req.getParameter("redirectUri");
    if (redirectUri != null && !redirectUri.isEmpty()) {
      return redirectUri;
    }
    // Default callback URL
    return getBaseUrl(req) + CALLBACK_PATH;
  }

  private String getBaseUrl(HttpServletRequest req) {
    String scheme = req.getScheme();
    String serverName = req.getServerName();
    int serverPort = req.getServerPort();
    String contextPath = req.getContextPath();

    StringBuilder url = new StringBuilder();
    url.append(scheme).append("://").append(serverName);

    if ((scheme.equals("http") && serverPort != 80)
        || (scheme.equals("https") && serverPort != 443)) {
      url.append(":").append(serverPort);
    }

    url.append(contextPath);
    return url.toString();
  }
}
