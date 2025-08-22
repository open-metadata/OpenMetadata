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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_RESET_TOKEN_EXPIRED;
import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.exception.SAMLException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.BadRequestException;
import java.io.BufferedReader;
import java.io.IOException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;
import org.pac4j.core.exception.TechnicalException;

@Slf4j
public class SamlAuthHandler implements AuthServeletHandler {
  private final TokenRepository tokenRepository;

  public SamlAuthHandler() {
    this.tokenRepository = Entity.getTokenRepository();
  }

  @Override
  public void handleLogin(HttpServletRequest req, HttpServletResponse resp) {
    try {
      checkAndStoreRedirectUriInSession(req);
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);
      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.login();
    } catch (SAMLException ex) {
      LOG.error("Error initiating SAML login", ex);
      AuthenticationCodeFlowHandler.getErrorMessage(resp, new TechnicalException(ex));
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public void handleCallback(HttpServletRequest req, HttpServletResponse resp) {
    try {
      // Convert Jakarta servlet types to javax servlet types using Apache Felix wrappers
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(req);
      javax.servlet.http.HttpServletResponse wrappedResponse = new HttpServletResponseWrapper(resp);
      Auth auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.processResponse();

      if (!auth.isAuthenticated()) {
        throw new AuthenticationException("SAML authentication failed");
      }

      handleSamlResponse(req, resp, auth);
    } catch (Exception ex) {
      LOG.error("Error processing SAML response", ex);
      AuthenticationCodeFlowHandler.getErrorMessage(resp, new TechnicalException(ex));
    }
  }

  @Override
  public void handleRefresh(HttpServletRequest req, HttpServletResponse resp) {
    try {
      TokenRefreshRequest tokenRefreshRequest = parseTokenRefreshRequest(req);

      if (CommonUtil.nullOrEmpty(tokenRefreshRequest.getRefreshToken())) {
        throw new BadRequestException("Token Cannot be Null or Empty String");
      }

      TokenInterface tokenInterface =
          tokenRepository.findByToken(tokenRefreshRequest.getRefreshToken());
      UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      User storedUser =
          userRepository.get(
              null, tokenInterface.getUserId(), userRepository.getFieldsWithUserAuth("*"));

      if (storedUser.getIsBot() != null && storedUser.getIsBot()) {
        throw new IllegalArgumentException("User are only allowed to refresh");
      }

      RefreshToken refreshToken =
          validateAndReturnNewRefresh(storedUser.getId(), tokenRefreshRequest);
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  storedUser.getName(),
                  getRoleListFromUser(storedUser),
                  !nullOrEmpty(storedUser.getIsAdmin()) && storedUser.getIsAdmin(),
                  storedUser.getEmail(),
                  3600,
                  false,
                  ServiceTokenType.OM_USER);

      JwtResponse jwtResponse = new JwtResponse();
      jwtResponse.setTokenType("Bearer");
      jwtResponse.setAccessToken(jwtAuthMechanism.getJWTToken());
      jwtResponse.setRefreshToken(refreshToken.getToken().toString());
      jwtResponse.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());

      writeJsonResponse(resp, JsonUtils.pojoToJson(jwtResponse));
    } catch (Exception e) {
      LOG.error("Error during SAML refresh", e);
      AuthenticationCodeFlowHandler.getErrorMessage(resp, new TechnicalException(e));
    }
  }

  @Override
  public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
    try {
      // SAML logout is typically handled by the IDP
      // Invalidate local session
      HttpSession session = req.getSession(false);
      if (session != null) {
        session.invalidate();
      }

      resp.setStatus(HttpServletResponse.SC_OK);
      resp.getWriter().write("Logout initiated");
    } catch (Exception e) {
      LOG.error("Error during SAML logout", e);
      resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    }
  }

  private void checkAndStoreRedirectUriInSession(HttpServletRequest request) {
    String redirectUri = request.getParameter("callback");
    if (redirectUri != null) {
      request.getSession().setAttribute(SESSION_REDIRECT_URI, redirectUri);
    }
  }

  private void handleSamlResponse(HttpServletRequest req, HttpServletResponse resp, Auth auth)
      throws Exception {
    List<String> errors = auth.getErrors();

    if (!errors.isEmpty()) {
      String errorReason = auth.getLastErrorReason();
      if (errorReason != null && !errorReason.isEmpty()) {
        LOG.error("[SAML ACS] " + errorReason);
        resp.sendError(500, errorReason);
      }
    } else {
      String username;
      String nameId = auth.getNameId();
      String email = nameId;
      if (nameId.contains("@")) {
        username = nameId.split("@")[0];
      } else {
        username = nameId;
        email = String.format("%s@%s", username, SamlSettingsHolder.getInstance().getDomain());
      }

      JWTAuthMechanism jwtAuthMechanism;
      User user;
      try {
        user = Entity.getEntityByName(Entity.USER, username, "id,roles", Include.NON_DELETED);
        jwtAuthMechanism =
            JWTTokenGenerator.getInstance()
                .generateJWTToken(
                    username,
                    getRoleListFromUser(user),
                    !nullOrEmpty(user.getIsAdmin()) && user.getIsAdmin(),
                    user.getEmail(),
                    SamlSettingsHolder.getInstance().getTokenValidity(),
                    false,
                    ServiceTokenType.OM_USER);
      } catch (Exception e) {
        LOG.error("[SAML ACS] User not found: " + username);
        // Create the user
        user = UserUtil.addOrUpdateUser(UserUtil.user(username, email.split("@")[1], username));
        jwtAuthMechanism =
            JWTTokenGenerator.getInstance()
                .generateJWTToken(
                    username,
                    new HashSet<>(),
                    getAdmins().contains(username),
                    email,
                    SamlSettingsHolder.getInstance().getTokenValidity(),
                    false,
                    ServiceTokenType.OM_USER);
      }

      // Add to json response cookie
      JwtResponse jwtResponse = getJwtResponseWithRefresh(user, jwtAuthMechanism);
      Cookie refreshTokenCookie = new Cookie("refreshToken", jwtResponse.getRefreshToken());
      refreshTokenCookie.setMaxAge(60 * 60); // 1hr
      refreshTokenCookie.setPath("/");
      resp.addCookie(refreshTokenCookie);

      // Redirect with JWT Token
      String redirectUri = (String) req.getSession().getAttribute(SESSION_REDIRECT_URI);
      String url =
          String.format(
              "%s?id_token=%s&email=%s&name=%s",
              (nullOrEmpty(redirectUri) ? buildBaseRequestUrl(req) : redirectUri),
              jwtAuthMechanism.getJWTToken(),
              nameId,
              username);
      Entity.getUserRepository().updateUserLastLoginTime(user, System.currentTimeMillis());
      resp.sendRedirect(url);
    }
  }

  private TokenRefreshRequest parseTokenRefreshRequest(HttpServletRequest request)
      throws IOException {
    StringBuilder sb = new StringBuilder();
    BufferedReader reader = request.getReader();
    String line;
    while ((line = reader.readLine()) != null) {
      sb.append(line);
    }
    return JsonUtils.readValue(sb.toString(), TokenRefreshRequest.class);
  }

  private RefreshToken validateAndReturnNewRefresh(
      UUID currentUserId, TokenRefreshRequest tokenRefreshRequest) {
    String requestRefreshToken = tokenRefreshRequest.getRefreshToken();
    RefreshToken storedRefreshToken =
        (RefreshToken) tokenRepository.findByToken(requestRefreshToken);
    if (storedRefreshToken.getExpiryDate().compareTo(Instant.now().toEpochMilli()) < 0) {
      throw new CustomExceptionMessage(
          BAD_REQUEST,
          PASSWORD_RESET_TOKEN_EXPIRED,
          "Expired token. Please login again : " + storedRefreshToken.getToken().toString());
    }
    // Delete the existing token
    tokenRepository.deleteToken(requestRefreshToken);
    // Generate new rotating refresh token
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(currentUserId, UUID.randomUUID());
    // Save refresh token in database
    tokenRepository.insertToken(newRefreshToken);
    return newRefreshToken;
  }

  private JwtResponse getJwtResponseWithRefresh(User user, JWTAuthMechanism jwtAuthMechanism) {
    RefreshToken refreshToken = TokenUtil.getRefreshToken(user.getId(), UUID.randomUUID());
    tokenRepository.insertToken(refreshToken);

    JwtResponse jwtResponse = new JwtResponse();
    jwtResponse.setTokenType("Bearer");
    jwtResponse.setAccessToken(jwtAuthMechanism.getJWTToken());
    jwtResponse.setRefreshToken(refreshToken.getToken().toString());
    jwtResponse.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
    return jwtResponse;
  }

  private Set<String> getAdmins() {
    AuthorizerConfiguration authorizerConfiguration =
        SecurityConfigurationManager.getInstance().getCurrentAuthzConfig();
    return authorizerConfiguration.getAdminPrincipals();
  }

  private String buildBaseRequestUrl(HttpServletRequest req) {
    return req.getScheme() + "://" + req.getServerName() + ":" + req.getServerPort() + "/callback";
  }
}
