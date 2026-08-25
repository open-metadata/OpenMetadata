package org.openmetadata.service.security.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.EntityUtil.Fields;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BasicAuthServletHandlerTest {

  @Mock private AuthenticationConfiguration authConfig;
  @Mock private AuthorizerConfiguration authorizerConfig;
  @Mock private SessionService sessionService;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private ServletOutputStream servletOutputStream;
  @Mock private UserRepository userRepository;
  @Mock private TokenRepository tokenRepository;

  private BasicAuthServletHandler handler;
  private MockedConstruction<BasicAuthenticator> authenticatorConstruction;
  private BasicAuthenticator authenticator;

  @BeforeEach
  void setUp() throws Exception {
    when(authConfig.getProvider()).thenReturn(AuthProvider.BASIC);
    when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
    when(response.getOutputStream()).thenReturn(servletOutputStream);
    authenticatorConstruction = mockConstruction(BasicAuthenticator.class);
    handler = new BasicAuthServletHandler(authConfig, authorizerConfig, sessionService);
    authenticator = authenticatorConstruction.constructed().get(0);
  }

  @AfterEach
  void tearDown() {
    authenticatorConstruction.close();
  }

  @Test
  void handleLogin_missingProvisionedUser_returnsUnauthorizedAndDeletesRefreshToken()
      throws Exception {
    when(request.getMethod()).thenReturn("POST");
    when(request.getReader())
        .thenReturn(
            new BufferedReader(
                new StringReader(
                    "{\"email\":\"basic-user@example.com\",\"password\":\"cGFzc3dvcmQ=\"}")));
    JwtResponse jwtResponse = new JwtResponse();
    jwtResponse.setAccessToken("access-token");
    jwtResponse.setRefreshToken("basic-refresh-token");
    jwtResponse.setTokenType("Bearer");
    jwtResponse.setExpiryDuration(100L);
    when(authenticator.loginUser(any())).thenReturn(jwtResponse);
    when(userRepository.getByEmail(isNull(), eq("basic-user@example.com"), any(Fields.class)))
        .thenThrow(EntityNotFoundException.byMessage("missing"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock.when(Entity::getTokenRepository).thenReturn(tokenRepository);

      handler.handleLogin(request, response);
    }

    verify(tokenRepository).deleteToken("basic-refresh-token");
    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    verify(sessionService, never()).createActiveSession(any(), any(), any(), any(), any());
  }

  @Test
  void handleRefresh_revokedSessionDeletesRotatedRefreshToken() {
    UserSession leasedSession =
        UserSession.builder().id("session-id").status(SessionStatus.REFRESHING).build();
    UserSession revokedSession =
        leasedSession.toBuilder().status(SessionStatus.REVOKED).version(2L).build();
    JwtResponse jwtResponse = new JwtResponse();
    jwtResponse.setAccessToken("access-token");
    jwtResponse.setRefreshToken("rotated-refresh-token");
    jwtResponse.setTokenType("Bearer");
    jwtResponse.setExpiryDuration(100L);

    when(sessionService.acquireRefreshLease(request, response))
        .thenReturn(Optional.of(leasedSession));
    when(sessionService.decryptOmRefreshToken(leasedSession)).thenReturn("current-refresh-token");
    when(authenticator.getNewAccessToken(any())).thenReturn(jwtResponse);
    when(sessionService.completeRefresh(leasedSession, "rotated-refresh-token", null))
        .thenReturn(Optional.of(revokedSession));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getTokenRepository).thenReturn(tokenRepository);

      handler.handleRefresh(request, response);
    }

    verify(tokenRepository).deleteToken("rotated-refresh-token");
    verify(sessionService).revokeSession(request, response);
    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
  }
}
