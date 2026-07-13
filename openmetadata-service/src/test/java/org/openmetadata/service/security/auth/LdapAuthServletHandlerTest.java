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
import java.util.UUID;
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
import org.openmetadata.service.audit.AuditLogRepository;
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
class LdapAuthServletHandlerTest {

  @Mock private AuthenticationConfiguration authConfig;
  @Mock private AuthorizerConfiguration authorizerConfig;
  @Mock private SessionService sessionService;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private ServletOutputStream servletOutputStream;
  @Mock private AuditLogRepository auditLogRepository;
  @Mock private UserRepository userRepository;
  @Mock private TokenRepository tokenRepository;

  private LdapAuthServletHandler handler;
  private MockedConstruction<LdapAuthenticator> authenticatorConstruction;
  private LdapAuthenticator authenticator;

  @BeforeEach
  void setUp() throws Exception {
    when(authConfig.getProvider()).thenReturn(AuthProvider.LDAP);
    when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
    when(response.getOutputStream()).thenReturn(servletOutputStream);
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(authConfig);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(authorizerConfig);
    authenticatorConstruction = mockConstruction(LdapAuthenticator.class);
    handler = new LdapAuthServletHandler(authConfig, authorizerConfig, sessionService);
    authenticator = authenticatorConstruction.constructed().get(0);
  }

  @AfterEach
  void tearDown() {
    authenticatorConstruction.close();
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(null);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(null);
  }

  @Test
  void handleLogout_writesAuditEvent() {
    UUID userId = UUID.randomUUID();
    UserSession session =
        UserSession.builder()
            .id("session-id")
            .userId(userId.toString())
            .username("ldap-user")
            .build();
    when(sessionService.getSession(request)).thenReturn(Optional.of(session));
    when(sessionService.decryptOmRefreshToken(session)).thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getAuditLogRepository).thenReturn(auditLogRepository);

      handler.handleLogout(request, response);
    }

    verify(auditLogRepository)
        .writeAuthEvent(AuditLogRepository.AUTH_EVENT_LOGOUT, "ldap-user", userId);
    verify(sessionService).revokeSession(request, response);
  }

  @Test
  void handleRefresh_withoutActiveSession_returnsUnauthorized() {
    when(sessionService.acquireRefreshLease(request, response)).thenReturn(Optional.empty());

    handler.handleRefresh(request, response);

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
  }

  @Test
  void handleLogin_missingProvisionedUser_returnsUnauthorizedAndDeletesRefreshToken()
      throws Exception {
    when(request.getMethod()).thenReturn("POST");
    when(request.getReader())
        .thenReturn(
            new BufferedReader(
                new StringReader(
                    "{\"email\":\"ldap-user@example.com\",\"password\":\"cGFzc3dvcmQ=\"}")));
    JwtResponse jwtResponse = new JwtResponse();
    jwtResponse.setAccessToken("access-token");
    jwtResponse.setRefreshToken("ldap-refresh-token");
    jwtResponse.setTokenType("Bearer");
    jwtResponse.setExpiryDuration(100L);
    when(authenticator.loginUser(any())).thenReturn(jwtResponse);
    when(userRepository.getByEmail(isNull(), eq("ldap-user@example.com"), any(Fields.class)))
        .thenThrow(EntityNotFoundException.byMessage("missing"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entityMock.when(Entity::getTokenRepository).thenReturn(tokenRepository);

      handler.handleLogin(request, response);
    }

    verify(tokenRepository).deleteToken("ldap-refresh-token");
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
