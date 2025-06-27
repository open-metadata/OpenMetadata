/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.security.saml;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.SESSION_REDIRECT_URI;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

import com.onelogin.saml2.Auth;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.felix.http.javaxwrappers.HttpServletRequestWrapper;
import org.apache.felix.http.javaxwrappers.HttpServletResponseWrapper;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.TokenUtil;
import org.openmetadata.service.util.UserUtil;

/**
 * This Servlet also known as Assertion Consumer Service URL handles the SamlResponse the IDP send in response to the
 * SamlRequest. After a successful processing it redirects user to the relayState which is the callback setup in the
 * config.
 */
@Slf4j
@WebServlet("/api/v1/saml/acs")
public class SamlAssertionConsumerServlet extends HttpServlet {
  private final AuthorizerConfiguration authorizerConfiguration;
  private final Set<String> admins;
  private Auth auth;

  public SamlAssertionConsumerServlet(AuthorizerConfiguration authorizerConfiguration) {
    this.authorizerConfiguration = authorizerConfiguration;
    admins = authorizerConfiguration.getAdminPrincipals();
  }

  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    try {
      // Convert Jakarta servlet types to javax servlet types using Apache Felix wrappers
      javax.servlet.http.HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(request);
      javax.servlet.http.HttpServletResponse wrappedResponse =
          new HttpServletResponseWrapper(response);
      auth = new Auth(SamlSettingsHolder.getSaml2Settings(), wrappedRequest, wrappedResponse);
      auth.processResponse();
      if (!auth.isAuthenticated()) {
        throw new AuthenticationException("SAML authentication failed");
      }
      handleResponse(request, response);
    } catch (Exception ex) {
      LOG.error("Error processing SAML response", ex);
      throw new AuthenticationException("Error processing SAML response");
    }
  }

  private void handleResponse(HttpServletRequest req, HttpServletResponse resp) throws Exception {
    List<String> errors = auth.getErrors();

    if (!errors.isEmpty()) {
      String errorReason = auth.getLastErrorReason();
      if (errorReason != null && !errorReason.isEmpty()) {
        LOG.error("[SAML ACS]" + errorReason);
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
                    admins.contains(username),
                    email,
                    SamlSettingsHolder.getInstance().getTokenValidity(),
                    false,
                    ServiceTokenType.OM_USER);
      }

      // Add to json response cookie
      JwtResponse jwtResponse = getJwtResponseWithRefresh(user, jwtAuthMechanism);
      Cookie refreshTokenCookie = new Cookie("refreshToken", jwtResponse.getRefreshToken());
      refreshTokenCookie.setMaxAge(60 * 60); // 1hr
      refreshTokenCookie.setPath("/"); // 30 days
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

  private String buildBaseRequestUrl(HttpServletRequest req) {
    // In case of IDP initiated one it needs to be built on fly, since the session might not exist
    return String.format(
        "%s://%s:%s/saml/callback", req.getScheme(), req.getServerName(), req.getServerPort());
  }

  private JwtResponse getJwtResponseWithRefresh(
      User storedUser, JWTAuthMechanism jwtAuthMechanism) {
    RefreshToken newRefreshToken = TokenUtil.getRefreshToken(storedUser.getId(), UUID.randomUUID());
    // save Refresh Token in Database
    Entity.getTokenRepository().insertToken(newRefreshToken);

    JwtResponse response = new JwtResponse();
    response.setTokenType("Bearer");
    response.setAccessToken(jwtAuthMechanism.getJWTToken());
    response.setRefreshToken(newRefreshToken.getToken().toString());
    response.setExpiryDuration(jwtAuthMechanism.getJWTTokenExpiresAt());
    return response;
  }
}
