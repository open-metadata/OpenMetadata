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
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AuthenticationException;
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
      String queryString = httpServletRequest.getQueryString();
      Map<String, String> query = hasText(queryString) ? ParseQS.decode(queryString) : Map.of();
      String requestedUserId = trimToNull(query.get("userId"));

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
      SessionValidationResult sessionValidation =
          isSessionStillActive(
              requestWrapper, (HttpServletResponse) response, tokenPrincipal, socketUserId);
      if (!sessionValidation.allowed()) {
        return;
      }
      if (!hasText(socketUserId)) {
        socketUserId = sessionValidation.userId();
      }
      if (hasText(socketUserId)) {
        requestWrapper.addHeader("UserId", socketUserId);
      }
      String sessionId =
          hasText(sessionValidation.sessionId())
              ? sessionValidation.sessionId()
              : tokenPrincipal != null ? tokenPrincipal.sessionId() : null;
      if (hasText(sessionId)) {
        requestWrapper.addHeader("SessionId", sessionId);
      }
      // Goes to default servlet.
      chain.doFilter(requestWrapper, response);
    } catch (AuthenticationException ex) {
      LOG.warn("[SAFilter] Rejected WebSocket handshake", ex);
      sendHandshakeError(
          response, HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized WebSocket handshake");
    } catch (Exception ex) {
      LOG.error("[SAFilter] Failed in filtering request", ex);
      sendHandshakeError(
          response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "WebSocket handshake failed");
    }
  }

  private void sendHandshakeError(ServletResponse response, int status, String message)
      throws IOException {
    if (response instanceof HttpServletResponse httpResponse && !httpResponse.isCommitted()) {
      httpResponse.sendError(status, message);
    }
  }

  private SessionValidationResult isSessionStillActive(
      HttpServletRequest request,
      HttpServletResponse response,
      ValidatedTokenPrincipal tokenPrincipal,
      String socketUserId)
      throws IOException {
    if (sessionService == null) {
      return SessionValidationResult.accepted();
    }
    Optional<String> sessionId = SessionCookieUtil.getSessionId(request);
    if (sessionId.isEmpty()) {
      if (tokenPrincipal == null) {
        return SessionValidationResult.accepted();
      }
      if (tokenPrincipal.sessionId() != null) {
        return validateSessionStillActive(
            response, tokenPrincipal.sessionId(), tokenPrincipal, socketUserId);
      }
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session is required");
      return SessionValidationResult.rejected();
    }
    return validateSessionStillActive(response, sessionId.get(), tokenPrincipal, socketUserId);
  }

  private SessionValidationResult validateSessionStillActive(
      HttpServletResponse response,
      String sessionId,
      ValidatedTokenPrincipal tokenPrincipal,
      String socketUserId)
      throws IOException {
    Optional<UserSession> session = sessionService.getFreshSessionById(sessionId);
    if (session.isEmpty()
        || session.get().getStatus() != SessionStatus.ACTIVE
        || session.get().isExpired(System.currentTimeMillis())) {
      LOG.info(
          "Rejecting WebSocket handshake: session {} is not active",
          SessionService.truncateId(sessionId));
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session is no longer active");
      return SessionValidationResult.rejected();
    }
    if (tokenPrincipal != null
        && session.get().getUsername() != null
        && !session.get().getUsername().equalsIgnoreCase(tokenPrincipal.userName())) {
      response.sendError(HttpServletResponse.SC_FORBIDDEN, "Session does not match token");
      return SessionValidationResult.rejected();
    }
    if (tokenPrincipal != null
        && tokenPrincipal.sessionId() != null
        && !tokenPrincipal.sessionId().equals(session.get().getId())) {
      response.sendError(HttpServletResponse.SC_FORBIDDEN, "Session does not match token");
      return SessionValidationResult.rejected();
    }
    if (hasText(socketUserId)
        && hasText(session.get().getUserId())
        && !socketUserId.equals(session.get().getUserId())) {
      response.sendError(HttpServletResponse.SC_FORBIDDEN, "Socket user does not match session");
      return SessionValidationResult.rejected();
    }
    return SessionValidationResult.accepted(session.get());
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
    EntityReference userRef;
    try {
      userRef = Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED);
    } catch (EntityNotFoundException ex) {
      throw new AuthenticationException("Unknown WebSocket principal", ex);
    }
    if (userRef == null || userRef.getId() == null) {
      throw new AuthenticationException("Unknown WebSocket principal");
    }
    return userRef.getId();
  }

  private static String trimToNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  public record ValidatedTokenPrincipal(String userName, String sessionId) {}

  private record SessionValidationResult(boolean allowed, String sessionId, String userId) {
    private static SessionValidationResult accepted() {
      return new SessionValidationResult(true, null, null);
    }

    private static SessionValidationResult accepted(UserSession session) {
      return new SessionValidationResult(true, session.getId(), session.getUserId());
    }

    private static SessionValidationResult rejected() {
      return new SessionValidationResult(false, null, null);
    }
  }
}
