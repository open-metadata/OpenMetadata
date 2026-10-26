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
  private static final String HANDSHAKE_UNAUTHORIZED_MESSAGE = "Unauthorized WebSocket handshake";
  private static final String SOCKET_USER_TOKEN_MISMATCH_MESSAGE =
      "Socket user does not match token";

  /**
   * Null only when the authentication or authorizer configuration is absent — every presented token
   * is then rejected. Replaced whole when security settings reload.
   */
  private volatile JwtFilter jwtFilter;

  /**
   * Browsers cannot set headers on a WebSocket upgrade, so the UI's socket.io handshake passes the
   * bearer token as this query parameter when it has no session cookie (public-client SSO).
   */
  private static final String TOKEN_QUERY_PARAM = "token";

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
    this.jwtFilter = jwtFilterFor(authenticationConfiguration, authorizerConf);
    this.sessionService = sessionService;
  }

  public SocketAddressFilter() {
    this.jwtFilter = null;
  }

  /** Applies reloaded security settings to sockets that connect from now on. */
  public void updateConfiguration(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConf) {
    this.jwtFilter = jwtFilterFor(authenticationConfiguration, authorizerConf);
  }

  /**
   * Socket handshakes are always authenticated: a presented token is validated against the
   * authentication configuration, a session cookie is validated against the session store, and a
   * handshake with neither is rejected. Token validation must not depend on
   * {@code enableSecureSocketConnection} — that gate let the default configuration key sockets on a
   * caller-supplied user id.
   */
  private static JwtFilter jwtFilterFor(
      AuthenticationConfiguration authenticationConfiguration,
      AuthorizerConfiguration authorizerConf) {
    return authenticationConfiguration != null && authorizerConf != null
        ? new JwtFilter(authenticationConfiguration, authorizerConf)
        : null;
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

  /**
   * Validates a push-feed handshake on its own, without a servlet dispatch: a presented token is
   * validated against the authentication configuration, a session cookie is validated against the
   * session store, and a handshake with neither is rejected. The token must bind the socket to the
   * identity its HTTP requests carry ({@link JwtFilter#resolveUserName}).
   *
   * <p>The servlet filter chain never sees a WebSocket upgrade — Jetty's upgrade negotiation runs
   * before it — so {@code OpenMetadataApplication#initializeWebsockets} calls this in the upgrade
   * creator; the returned identity is what the socket is keyed under, and a rejection fails the
   * upgrade with the carried HTTP status. The servlet dispatch path (polling transport) stamps the
   * same identity onto the request for the servlet behind this filter instead.
   *
   * @throws AuthenticationException the presented token failed validation
   * @throws HandshakeRejectedException the handshake carries no verifiable credential, or its
   *     credentials do not agree
   */
  public HandshakeIdentity authenticate(HttpServletRequest request) throws AuthenticationException {
    Map<String, String> query = parseQuery(request);
    String requestedUserId = trimToNull(query.get("userId"));
    TokenIdentity tokenIdentity = resolveTokenIdentity(request, query, requestedUserId);
    String socketUserId = socketUserId(tokenIdentity, requestedUserId);
    SessionValidationResult sessionValidation =
        isSessionStillActive(request, tokenPrincipal(tokenIdentity), socketUserId);
    return identity(sessionValidation, tokenIdentity, socketUserId);
  }

  @Override
  public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
      throws IOException {
    try {
      HttpServletRequest httpServletRequest = (HttpServletRequest) request;
      HeaderRequestWrapper requestWrapper = new HeaderRequestWrapper(httpServletRequest);
      requestWrapper.addHeader("RemoteAddress", httpServletRequest.getRemoteAddr());
      stampIdentity(requestWrapper, authenticate(httpServletRequest));
      // Goes to default servlet.
      chain.doFilter(requestWrapper, response);
    } catch (AuthenticationException ex) {
      LOG.warn("[SAFilter] Rejected WebSocket handshake", ex);
      sendHandshakeError(
          response, HttpServletResponse.SC_UNAUTHORIZED, HANDSHAKE_UNAUTHORIZED_MESSAGE);
    } catch (HandshakeRejectedException ex) {
      LOG.info("[SAFilter] Rejected WebSocket handshake: {}", ex.getMessage());
      sendHandshakeError(response, ex.getStatus(), ex.getMessage());
    } catch (Exception ex) {
      LOG.error("[SAFilter] Failed in filtering request", ex);
      sendHandshakeError(
          response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "WebSocket handshake failed");
    }
  }

  /** The token binds the socket to its user only when the caller-id agrees — else it is invalid. */
  private TokenIdentity resolveTokenIdentity(
      HttpServletRequest request, Map<String, String> query, String requestedUserId) {
    String tokenWithType = resolveHandshakeToken(request, query);
    if (!hasText(tokenWithType)) {
      return null;
    }
    JwtFilter currentJwtFilter = jwtFilter;
    if (currentJwtFilter == null) {
      // A credential was presented but this filter has no configuration to validate it.
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_UNAUTHORIZED, HANDSHAKE_UNAUTHORIZED_MESSAGE);
    }
    ValidatedTokenPrincipal tokenPrincipal =
        validatePrefixedTokenRequest(currentJwtFilter, tokenWithType);
    UUID resolvedUserId = getUserIdForPrincipal(tokenPrincipal.userName());
    if (requestedUserId != null && !requestedUserId.equals(resolvedUserId.toString())) {
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_FORBIDDEN, SOCKET_USER_TOKEN_MISMATCH_MESSAGE);
    }
    return new TokenIdentity(tokenPrincipal, resolvedUserId);
  }

  private void sendHandshakeError(ServletResponse response, int status, String message)
      throws IOException {
    if (response instanceof HttpServletResponse httpResponse && !httpResponse.isCommitted()) {
      httpResponse.sendError(status, message);
    }
  }

  /**
   * A bearer token presented on the handshake — from the Authorization header, or (browsers cannot
   * set headers on a WebSocket upgrade) from the {@code token} query parameter.
   */
  private static String resolveHandshakeToken(
      HttpServletRequest request, Map<String, String> query) {
    String headerToken = request.getHeader("Authorization");
    if (hasText(headerToken)) {
      return headerToken;
    }
    String queryToken = trimToNull(query.get(TOKEN_QUERY_PARAM));
    return hasText(queryToken) ? "Bearer " + queryToken : null;
  }

  /**
   * Every handshake must carry at least one verifiable credential — a validated token principal or
   * a session cookie. Handshakes with neither are rejected so a socket can never be keyed under a
   * caller-supplied identity.
   */
  private SessionValidationResult isSessionStillActive(
      HttpServletRequest request, ValidatedTokenPrincipal tokenPrincipal, String socketUserId) {
    Optional<String> sessionId = SessionCookieUtil.getSessionId(request);
    if (sessionId.isEmpty()) {
      return validateCookielessHandshake(tokenPrincipal, socketUserId);
    }
    if (sessionService == null) {
      // A cookie was presented but there is no session store to validate it against.
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_UNAUTHORIZED, HANDSHAKE_UNAUTHORIZED_MESSAGE);
    }
    return validateSessionStillActive(sessionId.get(), tokenPrincipal, socketUserId);
  }

  private SessionValidationResult validateCookielessHandshake(
      ValidatedTokenPrincipal tokenPrincipal, String socketUserId) {
    if (tokenPrincipal == null) {
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_UNAUTHORIZED, HANDSHAKE_UNAUTHORIZED_MESSAGE);
    }
    if (tokenPrincipal.sessionId() != null && sessionService != null) {
      // OM-issued tokens carry the session claim — revalidate against the store so a revoked
      // session cannot reconnect under a still-valid token.
      return validateSessionStillActive(tokenPrincipal.sessionId(), tokenPrincipal, socketUserId);
    }
    // Externally-issued tokens (an IdP does not stamp our session claim) and the boot window
    // before the store is wired are trusted on their token validation alone — the same basis
    // every HTTP request from this principal already stands on.
    return SessionValidationResult.accepted();
  }

  private SessionValidationResult validateSessionStillActive(
      String sessionId, ValidatedTokenPrincipal tokenPrincipal, String socketUserId) {
    Optional<UserSession> session = sessionService.getFreshSessionById(sessionId);
    if (session.isEmpty()
        || session.get().getStatus() != SessionStatus.ACTIVE
        || session.get().isExpired(System.currentTimeMillis())) {
      LOG.info(
          "Rejecting WebSocket handshake: session {} is not active",
          SessionService.truncateId(sessionId));
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_UNAUTHORIZED, "Session is no longer active");
    }
    if (tokenPrincipal != null
        && session.get().getUsername() != null
        && !SecurityUtil.sameIdentifier(session.get().getUsername(), tokenPrincipal.userName())) {
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_FORBIDDEN, "Session does not match token");
    }
    if (tokenPrincipal != null
        && tokenPrincipal.sessionId() != null
        && !tokenPrincipal.sessionId().equals(session.get().getId())) {
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_FORBIDDEN, "Session does not match token");
    }
    if (hasText(socketUserId)
        && hasText(session.get().getUserId())
        && !socketUserId.equals(session.get().getUserId())) {
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_FORBIDDEN, "Socket user does not match session");
    }
    return SessionValidationResult.accepted(session.get());
  }

  /**
   * Binds the token to the same identity its HTTP requests carry ({@link JwtFilter#resolveUserName}):
   * with {@code emailClaim} configured that is the stored username resolved from the email, which
   * need not match any legacy principal claim.
   */
  public static ValidatedTokenPrincipal validatePrefixedTokenRequest(
      JwtFilter jwtFilter, String prefixedToken) {
    String token = JwtFilter.extractToken(prefixedToken);
    Map<String, Claim> claims = jwtFilter.validateJwtAndGetClaims(token);
    String userName = jwtFilter.resolveUserName(claims);
    jwtFilter.checkValidationsForToken(claims, token, userName, null);
    String sessionId =
        claims.containsKey(JWTTokenGenerator.SESSION_ID_CLAIM)
            ? claims.get(JWTTokenGenerator.SESSION_ID_CLAIM).asString()
            : null;
    return new ValidatedTokenPrincipal(userName, sessionId);
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

  private static Map<String, String> parseQuery(HttpServletRequest request) {
    String queryString = request.getQueryString();
    return hasText(queryString) ? ParseQS.decode(queryString) : Map.of();
  }

  /** A token-presenting handshake keyed as the user its principal resolves to; none without one. */
  private static String socketUserId(TokenIdentity tokenIdentity, String requestedUserId) {
    return tokenIdentity != null ? tokenIdentity.userId().toString() : requestedUserId;
  }

  private static HandshakeIdentity identity(
      SessionValidationResult sessionValidation, TokenIdentity tokenIdentity, String socketUserId) {
    ValidatedTokenPrincipal principal = tokenPrincipal(tokenIdentity);
    String sessionId =
        hasText(sessionValidation.sessionId())
            ? sessionValidation.sessionId()
            : principal != null ? principal.sessionId() : null;
    String userId = hasText(socketUserId) ? socketUserId : sessionValidation.userId();
    if (!hasText(userId)) {
      // Nothing to key the socket under: WebSocketManager would accept the connection and never
      // register it, leaving the client "connected" to a feed that delivers nothing.
      throw new HandshakeRejectedException(
          HttpServletResponse.SC_UNAUTHORIZED, HANDSHAKE_UNAUTHORIZED_MESSAGE);
    }
    return new HandshakeIdentity(userId, sessionId);
  }

  private static ValidatedTokenPrincipal tokenPrincipal(TokenIdentity tokenIdentity) {
    return tokenIdentity != null ? tokenIdentity.tokenPrincipal() : null;
  }

  /**
   * The client's own identity headers are always hidden, so a validated field that is absent leaves
   * the header absent rather than falling back to the client's value.
   */
  private static void stampIdentity(
      HeaderRequestWrapper requestWrapper, HandshakeIdentity identity) {
    requestWrapper.removeHeader("UserId");
    requestWrapper.removeHeader("SessionId");
    if (hasText(identity.userId())) {
      requestWrapper.addHeader("UserId", identity.userId());
    }
    if (hasText(identity.sessionId())) {
      requestWrapper.addHeader("SessionId", identity.sessionId());
    }
  }

  public record ValidatedTokenPrincipal(String userName, String sessionId) {}

  private record TokenIdentity(ValidatedTokenPrincipal tokenPrincipal, UUID userId) {}

  private record SessionValidationResult(String sessionId, String userId) {
    private static SessionValidationResult accepted() {
      return new SessionValidationResult(null, null);
    }

    private static SessionValidationResult accepted(UserSession session) {
      return new SessionValidationResult(session.getId(), session.getUserId());
    }
  }
}
