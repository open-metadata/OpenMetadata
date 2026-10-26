package org.openmetadata.service.socket;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.auth0.jwt.interfaces.Claim;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.reflect.Field;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.session.SessionCookieUtil;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

@ExtendWith(MockitoExtension.class)
class SocketAddressFilterTest {

  @Mock private AuthenticationConfiguration authConfig;
  @Mock private AuthorizerConfiguration authorizerConfig;
  @Mock private SessionService sessionService;
  @Mock private JwtFilter jwtFilter;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private FilterChain chain;

  private SocketAddressFilter filter;

  @BeforeEach
  void setUp() throws Exception {
    initializeJwtTokenGenerator();
    when(authConfig.getPublicKeyUrls()).thenReturn(List.of());
    when(authConfig.getJwtPrincipalClaims()).thenReturn(List.of("sub"));
    when(authConfig.getJwtPrincipalClaimsMapping()).thenReturn(List.of());
    filter = new SocketAddressFilter(authConfig, authorizerConfig, sessionService);
    Field jwtFilterField = SocketAddressFilter.class.getDeclaredField("jwtFilter");
    jwtFilterField.setAccessible(true);
    jwtFilterField.set(filter, jwtFilter);
  }

  @Test
  void secureSocketRejectsUserIdThatDoesNotMatchTokenPrincipal() throws Exception {
    UUID tokenUserId = UUID.randomUUID();
    UUID requestedUserId = UUID.randomUUID();
    mockRequest("userId=" + requestedUserId, "Bearer token");
    mockTokenClaims("sam", "session-1");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "sam", Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(tokenUserId));

      filter.doFilter(request, response, chain);
    }

    verify(response)
        .sendError(HttpServletResponse.SC_FORBIDDEN, "Socket user does not match token");
    verify(chain, never()).doFilter(any(), any());
  }

  @Test
  void secureSocketUsesTokenPrincipalAsSocketUserId() throws Exception {
    UUID tokenUserId = UUID.randomUUID();
    mockRequest("userId=" + tokenUserId, "Bearer token");
    mockTokenClaims("sam", "session-1");
    when(sessionService.getFreshSessionById("session-1"))
        .thenReturn(Optional.of(activeSession("session-1", "sam")));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "sam", Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(tokenUserId));

      filter.doFilter(request, response, chain);
    }

    ArgumentCaptor<ServletRequest> requestCaptor = ArgumentCaptor.forClass(ServletRequest.class);
    verify(chain).doFilter(requestCaptor.capture(), eq(response));
    HttpServletRequest wrappedRequest = (HttpServletRequest) requestCaptor.getValue();
    org.junit.jupiter.api.Assertions.assertEquals(
        tokenUserId.toString(), wrappedRequest.getHeader("UserId"));
    org.junit.jupiter.api.Assertions.assertEquals(
        "session-1", wrappedRequest.getHeader("SessionId"));
  }

  @Test
  void secureSocketRejectsInactiveJwtSessionWhenCookieIsMissing() throws Exception {
    UUID tokenUserId = UUID.randomUUID();
    mockRequest("userId=" + tokenUserId, "Bearer token");
    mockTokenClaims("sam", "session-1");
    when(sessionService.getFreshSessionById("session-1"))
        .thenReturn(
            Optional.of(
                activeSession("session-1", "sam").toBuilder()
                    .status(SessionStatus.REVOKED)
                    .build()));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "sam", Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(tokenUserId));

      filter.doFilter(request, response, chain);
    }

    verify(response).sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session is no longer active");
    verify(chain, never()).doFilter(any(), any());
  }

  @Test
  void secureSocketUnknownPrincipalReturnsUnauthorized() throws Exception {
    mockRequest("userId=" + UUID.randomUUID(), "Bearer token");
    mockTokenClaims("missing-user", "session-1");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityReferenceByName(Entity.USER, "missing-user", Include.NON_DELETED))
          .thenThrow(EntityNotFoundException.byName("missing-user"));

      filter.doFilter(request, response, chain);
    }

    verify(response)
        .sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized WebSocket handshake");
    verify(chain, never()).doFilter(any(), any());
  }

  @Test
  void secureSocketAuthenticationFailureUsesGenericUnauthorizedResponse() throws Exception {
    mockRequest("userId=" + UUID.randomUUID(), null);

    filter.doFilter(request, response, chain);

    verify(response)
        .sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized WebSocket handshake");
    verify(response, never()).getWriter();
    verify(chain, never()).doFilter(any(), any());
  }

  /**
   * Regression test: a handshake carrying neither a token nor a session cookie used to be accepted
   * under the default socket configuration, and the caller-supplied {@code userId} query param was
   * adopted as the socket identity — keying the socket under an arbitrary user's feed channels.
   */
  @Test
  void credentiallessHandshakeIsRejectedAndNeverAdoptsRequestedUserId() throws Exception {
    SocketAddressFilter defaultFilter = defaultConfigFilter();
    UUID requestedUserId = UUID.randomUUID();
    when(request.getQueryString()).thenReturn("userId=" + requestedUserId);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    // No Authorization header and no cookies.

    defaultFilter.doFilter(request, response, chain);

    verify(response)
        .sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized WebSocket handshake");
    verify(chain, never()).doFilter(any(), any());
  }

  /**
   * Public-client SSO: the browser holds an IdP token and no session cookie, so the handshake
   * passes the bearer token as a query param. The default configuration must authenticate it.
   */
  @Test
  void queryTokenHandshakeWithoutSessionCookieIsAuthenticated() throws Exception {
    SocketAddressFilter defaultFilter = defaultConfigFilter();
    injectJwtFilter(defaultFilter);
    UUID tokenUserId = UUID.randomUUID();
    when(request.getQueryString()).thenReturn("userId=" + tokenUserId + "&token=token");
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    mockTokenClaims("sam", "session-1");
    when(sessionService.getFreshSessionById("session-1"))
        .thenReturn(Optional.of(activeSession("session-1", "sam")));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "sam", Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(tokenUserId));

      defaultFilter.doFilter(request, response, chain);
    }

    ArgumentCaptor<ServletRequest> requestCaptor = ArgumentCaptor.forClass(ServletRequest.class);
    verify(chain).doFilter(requestCaptor.capture(), eq(response));
    HttpServletRequest wrappedRequest = (HttpServletRequest) requestCaptor.getValue();
    org.junit.jupiter.api.Assertions.assertEquals(
        tokenUserId.toString(), wrappedRequest.getHeader("UserId"));
  }

  @Test
  void queryTokenWithMismatchedUserIdIsRejected() throws Exception {
    SocketAddressFilter defaultFilter = defaultConfigFilter();
    injectJwtFilter(defaultFilter);
    mockRequest("userId=" + UUID.randomUUID() + "&token=token", null);
    mockTokenClaims("sam", "session-1");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "sam", Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(UUID.randomUUID()));

      defaultFilter.doFilter(request, response, chain);
    }

    verify(response)
        .sendError(HttpServletResponse.SC_FORBIDDEN, "Socket user does not match token");
    verify(chain, never()).doFilter(any(), any());
  }

  /** A presented token must validate even when a session cookie rides along. */
  @Test
  void invalidQueryTokenIsRejectedEvenWithValidSessionCookie() throws Exception {
    SocketAddressFilter defaultFilter = defaultConfigFilter();
    injectJwtFilter(defaultFilter);
    when(request.getQueryString()).thenReturn("token=bad-token");
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    // Lenient: the failure happens at token validation, before the cookie is consulted — a valid
    // cookie alone must not rescue an invalid token.
    lenient()
        .when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, validSessionId('s'))});
    when(jwtFilter.validateJwtAndGetClaims("bad-token"))
        .thenThrow(new AuthenticationException("invalid token"));

    defaultFilter.doFilter(request, response, chain);

    verify(response)
        .sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized WebSocket handshake");
    verify(chain, never()).doFilter(any(), any());
  }

  /** Externally-issued tokens carry no session claim and are accepted on token validity alone. */
  @Test
  void externalTokenWithoutSessionClaimIsAcceptedWithoutStoreValidation() throws Exception {
    SocketAddressFilter defaultFilter = defaultConfigFilter();
    injectJwtFilter(defaultFilter);
    UUID tokenUserId = UUID.randomUUID();
    mockRequest("userId=" + tokenUserId, "Bearer token");
    Claim usernameClaim = mock(Claim.class);
    when(usernameClaim.asString()).thenReturn("sam");
    when(jwtFilter.validateJwtAndGetClaims("token")).thenReturn(Map.of("sub", usernameClaim));
    when(jwtFilter.getJwtPrincipalClaims()).thenReturn(List.of("sub"));
    when(jwtFilter.getJwtPrincipalClaimsMapping()).thenReturn(Map.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "sam", Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(tokenUserId));

      defaultFilter.doFilter(request, response, chain);
    }

    verify(chain).doFilter(any(), eq(response));
    verify(sessionService, never()).getFreshSessionById(any(String.class));
  }

  @Test
  void sessionCookieWithoutSessionStoreIsRejected() throws Exception {
    // Session store not yet wired (early startup): a cookie cannot be validated, fail closed.
    SocketAddressFilter storelessFilter = new SocketAddressFilter(authConfig, authorizerConfig);
    when(request.getQueryString()).thenReturn(null);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, validSessionId('s'))});

    storelessFilter.doFilter(request, response, chain);

    verify(response)
        .sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized WebSocket handshake");
    verify(chain, never()).doFilter(any(), any());
  }

  @Test
  void tokenOnlyHandshakeWithoutSessionStoreIsAccepted() throws Exception {
    // Session store not yet wired: the validated token principal is accepted on its own.
    SocketAddressFilter storelessFilter = new SocketAddressFilter(authConfig, authorizerConfig);
    Field jwtFilterField = SocketAddressFilter.class.getDeclaredField("jwtFilter");
    jwtFilterField.setAccessible(true);
    jwtFilterField.set(storelessFilter, jwtFilter);
    UUID tokenUserId = UUID.randomUUID();
    mockRequest("userId=" + tokenUserId, "Bearer token");
    mockTokenClaims("sam", "session-1");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "sam", Include.NON_DELETED))
          .thenReturn(new EntityReference().withId(tokenUserId));

      storelessFilter.doFilter(request, response, chain);
    }

    ArgumentCaptor<ServletRequest> requestCaptor = ArgumentCaptor.forClass(ServletRequest.class);
    verify(chain).doFilter(requestCaptor.capture(), eq(response));
    HttpServletRequest wrappedRequest = (HttpServletRequest) requestCaptor.getValue();
    org.junit.jupiter.api.Assertions.assertEquals(
        tokenUserId.toString(), wrappedRequest.getHeader("UserId"));
  }

  @Test
  void defaultSocketUsesActiveSessionUserIdWhenQueryUserIdIsMissing() throws Exception {
    SocketAddressFilter defaultFilter = defaultConfigFilter();
    UUID sessionUserId = UUID.randomUUID();
    String sessionId = validSessionId('s');
    when(request.getQueryString()).thenReturn(null);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, sessionId)});
    when(sessionService.getFreshSessionById(sessionId))
        .thenReturn(Optional.of(activeSession(sessionId, "sam", sessionUserId.toString())));

    defaultFilter.doFilter(request, response, chain);

    ArgumentCaptor<ServletRequest> requestCaptor = ArgumentCaptor.forClass(ServletRequest.class);
    verify(chain).doFilter(requestCaptor.capture(), eq(response));
    HttpServletRequest wrappedRequest = (HttpServletRequest) requestCaptor.getValue();
    org.junit.jupiter.api.Assertions.assertEquals(
        sessionUserId.toString(), wrappedRequest.getHeader("UserId"));
    org.junit.jupiter.api.Assertions.assertEquals(sessionId, wrappedRequest.getHeader("SessionId"));
  }

  @Test
  void defaultSocketRejectsUserIdThatDoesNotMatchActiveSession() throws Exception {
    SocketAddressFilter defaultFilter = defaultConfigFilter();
    UUID requestedUserId = UUID.randomUUID();
    UUID sessionUserId = UUID.randomUUID();
    String sessionId = validSessionId('m');
    when(request.getQueryString()).thenReturn("userId=" + requestedUserId);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, sessionId)});
    when(sessionService.getFreshSessionById(sessionId))
        .thenReturn(Optional.of(activeSession(sessionId, "sam", sessionUserId.toString())));

    defaultFilter.doFilter(request, response, chain);

    verify(response)
        .sendError(HttpServletResponse.SC_FORBIDDEN, "Socket user does not match session");
    verify(chain, never()).doFilter(any(), any());
  }

  private void mockRequest(String queryString, String authorizationHeader) {
    when(request.getQueryString()).thenReturn(queryString);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    when(request.getHeader("Authorization")).thenReturn(authorizationHeader);
  }

  private void mockTokenClaims(String username, String sessionId) {
    Claim usernameClaim = mock(Claim.class);
    Claim sessionClaim = mock(Claim.class);
    when(usernameClaim.asString()).thenReturn(username);
    when(sessionClaim.asString()).thenReturn(sessionId);
    when(jwtFilter.validateJwtAndGetClaims("token"))
        .thenReturn(Map.of("sub", usernameClaim, JWTTokenGenerator.SESSION_ID_CLAIM, sessionClaim));
    when(jwtFilter.getJwtPrincipalClaims()).thenReturn(List.of("sub"));
  }

  private UserSession activeSession(String sessionId, String username) {
    return activeSession(sessionId, username, null);
  }

  private UserSession activeSession(String sessionId, String username, String userId) {
    long now = System.currentTimeMillis();
    return UserSession.builder()
        .id(sessionId)
        .userId(userId)
        .username(username)
        .status(SessionStatus.ACTIVE)
        .expiresAt(now + 60_000)
        .idleExpiresAt(now + 60_000)
        .build();
  }

  private SocketAddressFilter defaultConfigFilter() {
    return new SocketAddressFilter(authConfig, authorizerConfig, sessionService);
  }

  private void injectJwtFilter(SocketAddressFilter filter) throws Exception {
    Field jwtFilterField = SocketAddressFilter.class.getDeclaredField("jwtFilter");
    jwtFilterField.setAccessible(true);
    jwtFilterField.set(filter, jwtFilter);
  }

  private String validSessionId(char value) {
    return String.valueOf(value).repeat(43);
  }

  private static void initializeJwtTokenGenerator() {
    JWTTokenConfiguration tokenConfiguration = new JWTTokenConfiguration();
    tokenConfiguration.setJwtissuer("open-metadata.org");
    tokenConfiguration.setKeyId("test-key");
    tokenConfiguration.setRsaprivateKeyFilePath(resourceFilePath("private_key.der"));
    tokenConfiguration.setRsapublicKeyFilePath(resourceFilePath("public_key.der"));
    JWTTokenGenerator.getInstance()
        .init(
            new AuthenticationConfiguration()
                .withTokenValidationAlgorithm(
                    AuthenticationConfiguration.TokenValidationAlgorithm.RS_256),
            tokenConfiguration);
  }

  private static String resourceFilePath(String resourceName) {
    try {
      return Path.of(
              Thread.currentThread().getContextClassLoader().getResource(resourceName).toURI())
          .toString();
    } catch (URISyntaxException e) {
      throw new RuntimeException(e);
    }
  }
}
