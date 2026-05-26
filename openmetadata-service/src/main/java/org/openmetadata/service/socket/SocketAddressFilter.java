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

package org.openmetadata.service.socket;

import com.auth0.jwt.interfaces.Claim;
import io.socket.engineio.server.utils.ParseQS;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.session.SessionCookieUtil;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

@Slf4j
public class SocketAddressFilter implements Filter {
  private JwtFilter jwtFilter;
  private final boolean enableSecureSocketConnection;
  private SessionService sessionService;

  public SocketAddressFilter(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConf) {
    this(authenticationConfiguration, authorizerConf, null);
  }

  public SocketAddressFilter(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConf,
      SessionService sessionService) {
    enableSecureSocketConnection = authorizerConf.getEnableSecureSocketConnection();
    if (enableSecureSocketConnection) {
      jwtFilter = new JwtFilter(authenticationConfiguration, authorizerConf);
    }
    this.sessionService = sessionService;
  }

  public SocketAddressFilter() {
    enableSecureSocketConnection = false;
  }

  /**
   * Allows late injection of the {@link SessionService} so the WebSocket bundle can wire it after
   * construction once the auth servlets have built the service. When set, the filter rejects
   * handshakes carrying an OM_SESSION cookie whose session is no longer ACTIVE — closes the gap
   * where a revoked user could still reconnect a socket using a not-yet-expired JWT.
   */
  public void setSessionService(SessionService sessionService) {
    this.sessionService = sessionService;
  }

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException {
    try {
      HttpServletRequest httpServletRequest = (HttpServletRequest) request;
      Map<String, String> query = ParseQS.decode(httpServletRequest.getQueryString());

      HeaderRequestWrapper requestWrapper = new HeaderRequestWrapper(httpServletRequest);
      requestWrapper.addHeader("RemoteAddress", httpServletRequest.getRemoteAddr());
      requestWrapper.addHeader("UserId", query.get("userId"));

      if (enableSecureSocketConnection) {
        String tokenWithType = httpServletRequest.getHeader("Authorization");
        requestWrapper.addHeader("Authorization", tokenWithType);
        validatePrefixedTokenRequest(jwtFilter, tokenWithType);
      }
      if (!isSessionStillActive(httpServletRequest, (HttpServletResponse) response)) {
        return;
      }
      // Goes to default servlet.
      chain.doFilter(requestWrapper, response);
    } catch (Exception ex) {
      LOG.error("[SAFilter] Failed in filtering request: {}", ex.getMessage());
      response
          .getWriter()
          .println(String.format("[SAFilter] Failed in filtering request: %s", ex.getMessage()));
    }
  }

  private boolean isSessionStillActive(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    if (sessionService == null) {
      return true;
    }
    Optional<String> sessionId = SessionCookieUtil.getSessionId(request);
    if (sessionId.isEmpty()) {
      // No OM_SESSION cookie — JWT-only flows (bots, SDK clients) are unaffected.
      return true;
    }
    Optional<UserSession> session = sessionService.getSessionById(sessionId.get());
    if (session.isEmpty() || session.get().getStatus() != SessionStatus.ACTIVE) {
      LOG.info(
          "Rejecting WebSocket handshake: session {} is not active",
          SessionService.truncateId(sessionId.get()));
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session is no longer active");
      return false;
    }
    return true;
  }

  public static void validatePrefixedTokenRequest(JwtFilter jwtFilter, String prefixedToken) {
    String token = JwtFilter.extractToken(prefixedToken);
    Map<String, Claim> claims = jwtFilter.validateJwtAndGetClaims(token);
    String userName =
        SecurityUtil.findUserNameFromClaims(
            jwtFilter.getJwtPrincipalClaimsMapping(), jwtFilter.getJwtPrincipalClaims(), claims);
    String impersonatedBy =
        claims.containsKey(JwtFilter.IMPERSONATED_USER_CLAIM)
            ? claims.get(JwtFilter.IMPERSONATED_USER_CLAIM).asString()
            : null;
    jwtFilter.checkValidationsForToken(claims, token, userName, impersonatedBy);
  }

  public static void checkForUsernameAndImpersonationValidation(
      String token, Map<String, Claim> claims, JwtFilter jwtFilter) {
    String userName =
        SecurityUtil.findUserNameFromClaims(
            jwtFilter.getJwtPrincipalClaimsMapping(), jwtFilter.getJwtPrincipalClaims(), claims);
    String impersonatedBy =
        claims.containsKey(JwtFilter.IMPERSONATED_USER_CLAIM)
            ? claims.get(JwtFilter.IMPERSONATED_USER_CLAIM).asString()
            : null;
    jwtFilter.checkValidationsForToken(claims, token, userName, impersonatedBy);
  }
}
