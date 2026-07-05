package org.openmetadata.service.socket;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    when(authorizerConfig.getEnableSecureSocketConnection()).thenReturn(true);
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

  @Test
  void insecureSocketWithoutUserIdDoesNotAddUserIdHeader() throws Exception {
    SocketAddressFilter insecureFilter = insecureFilter();
    when(request.getQueryString()).thenReturn(null);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");

    insecureFilter.doFilter(request, response, chain);

    ArgumentCaptor<ServletRequest> requestCaptor = ArgumentCaptor.forClass(ServletRequest.class);
    verify(chain).doFilter(requestCaptor.capture(), eq(response));
    HttpServletRequest wrappedRequest = (HttpServletRequest) requestCaptor.getValue();
    org.junit.jupiter.api.Assertions.assertNull(wrappedRequest.getHeader("UserId"));
  }

  @Test
  void insecureSocketUsesActiveSessionUserIdWhenQueryUserIdIsMissing() throws Exception {
    SocketAddressFilter insecureFilter = insecureFilter();
    UUID sessionUserId = UUID.randomUUID();
    String sessionId = validSessionId('s');
    when(request.getQueryString()).thenReturn(null);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, sessionId)});
    when(sessionService.getFreshSessionById(sessionId))
        .thenReturn(Optional.of(activeSession(sessionId, "sam", sessionUserId.toString())));

    insecureFilter.doFilter(request, response, chain);

    ArgumentCaptor<ServletRequest> requestCaptor = ArgumentCaptor.forClass(ServletRequest.class);
    verify(chain).doFilter(requestCaptor.capture(), eq(response));
    HttpServletRequest wrappedRequest = (HttpServletRequest) requestCaptor.getValue();
    org.junit.jupiter.api.Assertions.assertEquals(
        sessionUserId.toString(), wrappedRequest.getHeader("UserId"));
    org.junit.jupiter.api.Assertions.assertEquals(sessionId, wrappedRequest.getHeader("SessionId"));
  }

  @Test
  void insecureSocketRejectsUserIdThatDoesNotMatchActiveSession() throws Exception {
    SocketAddressFilter insecureFilter = insecureFilter();
    UUID requestedUserId = UUID.randomUUID();
    UUID sessionUserId = UUID.randomUUID();
    String sessionId = validSessionId('m');
    when(request.getQueryString()).thenReturn("userId=" + requestedUserId);
    when(request.getRemoteAddr()).thenReturn("127.0.0.1");
    when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, sessionId)});
    when(sessionService.getFreshSessionById(sessionId))
        .thenReturn(Optional.of(activeSession(sessionId, "sam", sessionUserId.toString())));

    insecureFilter.doFilter(request, response, chain);

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

  private SocketAddressFilter insecureFilter() {
    when(authorizerConfig.getEnableSecureSocketConnection()).thenReturn(false);
    return new SocketAddressFilter(authConfig, authorizerConfig, sessionService);
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
        .init(AuthenticationConfiguration.TokenValidationAlgorithm.RS_256, tokenConfiguration);
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
