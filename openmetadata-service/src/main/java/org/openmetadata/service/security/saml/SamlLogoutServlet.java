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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.security.AuthenticationCodeFlowHandler.getErrorMessage;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.writeJsonResponse;

import com.auth0.jwt.interfaces.Claim;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.service.security.JwtFilter;

/**
 * This Servlet initiates a login and sends a login request to the IDP. After a successful processing it redirects user
 * to the relayState which is the callback setup in the config.
 */
@WebServlet("/api/v1/saml/logout")
@Slf4j
public class SamlLogoutServlet extends HttpServlet {
  private final JwtFilter jwtFilter;
  private final List<String> jwtPrincipalClaims;
  private final Map<String, String> jwtPrincipalClaimsMapping;

  public SamlLogoutServlet(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConf) {
    jwtFilter = new JwtFilter(authenticationConfiguration, authorizerConf);
    this.jwtPrincipalClaims = authenticationConfiguration.getJwtPrincipalClaims();
    this.jwtPrincipalClaimsMapping =
        listOrEmpty(authenticationConfiguration.getJwtPrincipalClaimsMapping()).stream()
            .map(s -> s.split(":"))
            .collect(Collectors.toMap(s -> s[0], s -> s[1]));
  }

  @Override
  protected void doGet(
      final HttpServletRequest httpServletRequest, final HttpServletResponse httpServletResponse) {
    try {
      LOG.debug("Performing application logout");
      HttpSession session = httpServletRequest.getSession(false);
      String token = JwtFilter.extractToken(httpServletRequest.getHeader("Authorization"));
      if (session != null) {
        LOG.debug("Invalidating the session for logout");
        Map<String, Claim> claims = jwtFilter.validateJwtAndGetClaims(token);
        String userName =
            findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaims, claims);
        Date logoutTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant());
        // Mark the token invalid
        JwtTokenCacheManager.getInstance()
            .markLogoutEventForToken(
                new LogoutRequest()
                    .withUsername(userName)
                    .withToken(token)
                    .withLogoutTime(logoutTime));
        // Invalidate the session
        session.invalidate();

        // Redirect to server
        writeJsonResponse(httpServletResponse, "Logout successful");
      } else {
        LOG.error("No session store available for this web context");
      }
    } catch (Exception e) {
      getErrorMessage(httpServletResponse, e);
    }
  }

  public String getBaseUrl(HttpServletRequest request) {
    String scheme = request.getScheme();
    String serverName = request.getServerName();
    return String.format("%s://%s", scheme, serverName);
  }
}
