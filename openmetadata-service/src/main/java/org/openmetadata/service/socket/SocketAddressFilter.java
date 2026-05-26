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
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
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
      String requestedUserId = query.get("userId");

      HeaderRequestWrapper requestWrapper = new HeaderRequestWrapper(httpServletRequest);
      requestWrapper.addHeader("RemoteAddress", httpServletRequest.getRemoteAddr());
      String socketUserId = requestedUserId;
      ValidatedTokenPrincipal tokenPrincipal = null;

      if (enableSecureSocketConnection) {
        String tokenWithType = httpServletRequest.getHeader("Authorization");
        tokenPrincipal = validatePrefixedTokenRequest(jwtFilter, tokenWithType);
        UUID resolvedUserId = getUserIdForPrincipal(tokenPrincipal.userName());
        if (requestedUserId != null && !requestedUserId.equals(resolvedUserId.toString())) {
          ((HttpServletResponse) response)
              .sendError(HttpServletResponse.SC_FORBIDDEN, "Socket user does not match token");
          return;
        }
        socketUserId = resolvedUserId.toString();
      }
      requestWrapper.addHeader("UserId", socketUserId);
      if (tokenPrincipal != null && tokenPrincipal.sessionId() != null) {
        requestWrapper.addHeader("SessionId", tokenPrincipal.sessionId());
      }
      if (!isSessionStillActive(requestWrapper, (HttpServletResponse) response, tokenPrincipal)) {
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
    return isSessionStillActive(request, response, null);
  }

  private boolean isSessionStillActive(
      HttpServletRequest request,
      HttpServletResponse response,
      ValidatedTokenPrincipal tokenPrincipal)
      throws IOException {
    if (sessionService == null) {
      return true;
    }
    Optional<String> sessionId = SessionCookieUtil.getSessionId(request);
    if (sessionId.isEmpty()) {
      if (tokenPrincipal == null || tokenPrincipal.sessionId() != null) {
        return true;
      }
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session is required");
      return false;
    }
    Optional<UserSession> session = sessionService.getFreshSessionById(sessionId.get());
    if (session.isEmpty()
        || session.get().getStatus() != SessionStatus.ACTIVE
        || session.get().isExpired(System.currentTimeMillis())) {
      LOG.info(
          "Rejecting WebSocket handshake: session {} is not active",
          SessionService.truncateId(sessionId.get()));
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session is no longer active");
      return false;
    }
    if (tokenPrincipal != null
        && session.get().getUsername() != null
        && !session.get().getUsername().equalsIgnoreCase(tokenPrincipal.userName())) {
      response.sendError(HttpServletResponse.SC_FORBIDDEN, "Session does not match token");
      return false;
    }
    if (tokenPrincipal != null
        && tokenPrincipal.sessionId() != null
        && !tokenPrincipal.sessionId().equals(session.get().getId())) {
      response.sendError(HttpServletResponse.SC_FORBIDDEN, "Session does not match token");
      return false;
    }
    HeaderRequestWrapper requestWrapper = request instanceof HeaderRequestWrapper h ? h : null;
    if (requestWrapper != null) {
      requestWrapper.addHeader("SessionId", session.get().getId());
    }
    return true;
  }

  public static ValidatedTokenPrincipal validatePrefixedTokenRequest(
      JwtFilter jwtFilter, String prefixedToken) {
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
    String sessionId =
        claims.containsKey(JWTTokenGenerator.SESSION_ID_CLAIM)
            ? claims.get(JWTTokenGenerator.SESSION_ID_CLAIM).asString()
            : null;
    return new ValidatedTokenPrincipal(userName, sessionId);
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

  private UUID getUserIdForPrincipal(String userName) {
    EntityReference userRef =
        Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED);
    return userRef.getId();
  }

  public record ValidatedTokenPrincipal(String userName, String sessionId) {}
}
