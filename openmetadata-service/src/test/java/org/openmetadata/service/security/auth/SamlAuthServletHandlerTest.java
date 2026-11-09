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
package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.authn.AuthnRequestParams;
import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.http.HttpRequest;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.core.Response;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.MockSamlIdp;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.security.session.SessionCookieUtil;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.SessionStore;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.TokenUtil;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SamlAuthServletHandlerTest {
  private static final String IDP_ENTITY_ID = "https://mock-idp.openmetadata.test/metadata";
  private static final String SP_ENTITY_ID = "http://localhost:8585/api/v1/saml/metadata";
  private static final String ACS_URL = "http://localhost:8585/api/v1/saml/acs";
  private static final String SUBJECT = "saml.user@openmetadata.test";
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

  @Mock private AuthenticationConfiguration authConfig;
  @Mock private AuthorizerConfiguration authorizerConfig;
  @Mock private SamlSSOClientConfig samlConfig;
  @Mock private ServiceProviderConfig serviceProviderConfig;
  @Mock private SessionService sessionService;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private ServletOutputStream servletOutputStream;
  @Mock private TokenRepository tokenRepository;

  private SamlAuthServletHandler handler;

  @BeforeEach
  void setUp() throws Exception {
    when(authConfig.getProvider()).thenReturn(AuthProvider.SAML);
    when(authConfig.getCallbackUrl()).thenReturn("https://example.com/callback");
    when(authConfig.getSamlConfiguration()).thenReturn(samlConfig);
    when(samlConfig.getSamlDisplayNameAttributes()).thenReturn(null);
    when(samlConfig.getSp()).thenReturn(serviceProviderConfig);
    when(serviceProviderConfig.getCallback()).thenReturn("https://saml.example.com/callback");
    when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
    when(response.getOutputStream()).thenReturn(servletOutputStream);
    handler = new SamlAuthServletHandler(authConfig, authorizerConfig, sessionService);
  }

  @AfterEach
  void tearDown() {
    SecurityConfigurationManager.getInstance().setCurrentAuthConfig(null);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(null);
  }

  @Test
  void handleLogin_prefersCallbackParameter() {
    when(request.getParameter("callback")).thenReturn("https://example.com/callback");
    when(request.getParameter("redirectUri")).thenReturn("https://example.com/redirect");
    when(sessionService.createPendingSession(
            eq(request),
            eq(response),
            eq("saml"),
            eq("https://example.com/callback"),
            any(),
            any(),
            any()))
        .thenReturn(new UserSession());

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogin(request, response);
    }

    verify(sessionService)
        .createPendingSession(
            request, response, "saml", "https://example.com/callback", null, null, null);
  }

  @Test
  void handleLogin_fallsBackToRedirectUriParameter() {
    when(request.getParameter("callback")).thenReturn(null);
    when(request.getParameter("redirectUri")).thenReturn("https://example.com/callback");
    when(sessionService.createPendingSession(
            eq(request),
            eq(response),
            eq("saml"),
            eq("https://example.com/callback"),
            any(),
            any(),
            any()))
        .thenReturn(new UserSession());

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogin(request, response);
    }

    verify(sessionService)
        .createPendingSession(
            request, response, "saml", "https://example.com/callback", null, null, null);
  }

  @Test
  void handleLogin_rejectsUntrustedRedirectUri() {
    when(request.getParameter("callback")).thenReturn("https://evil.com/callback");

    handler.handleLogin(request, response);

    verify(response).setStatus(HttpServletResponse.SC_BAD_REQUEST);
  }

  @Test
  void handleLogin_trustsServerAuthCallbackRoute() {
    when(serviceProviderConfig.getAcs()).thenReturn("https://app.example.com/api/v1/saml/acs");
    when(request.getParameter("callback")).thenReturn(null);
    when(request.getParameter("redirectUri")).thenReturn("https://app.example.com/auth/callback");
    when(sessionService.createPendingSession(
            eq(request),
            eq(response),
            eq("saml"),
            eq("https://app.example.com/auth/callback"),
            any(),
            any(),
            any()))
        .thenReturn(new UserSession());

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogin(request, response);
    }

    verify(sessionService)
        .createPendingSession(
            request, response, "saml", "https://app.example.com/auth/callback", null, null, null);
  }

  @Test
  void handleLogin_trustsServerAuthCallbackRouteForIpv6Host() {
    when(serviceProviderConfig.getAcs()).thenReturn("http://[::1]:8585/api/v1/saml/acs");
    when(request.getParameter("callback")).thenReturn(null);
    when(request.getParameter("redirectUri")).thenReturn("http://[::1]:8585/auth/callback");
    when(sessionService.createPendingSession(
            eq(request),
            eq(response),
            eq("saml"),
            eq("http://[::1]:8585/auth/callback"),
            any(),
            any(),
            any()))
        .thenReturn(new UserSession());

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogin(request, response);
    }

    verify(sessionService)
        .createPendingSession(
            request, response, "saml", "http://[::1]:8585/auth/callback", null, null, null);
  }

  @Test
  void handleLogin_trustsSamlSpCallbackWhenTopLevelCallbackUrlUnset() {
    when(authConfig.getCallbackUrl()).thenReturn("");
    when(request.getParameter("callback")).thenReturn("https://saml.example.com/callback");
    when(request.getParameter("redirectUri")).thenReturn(null);
    when(sessionService.createPendingSession(
            eq(request),
            eq(response),
            eq("saml"),
            eq("https://saml.example.com/callback"),
            any(),
            any(),
            any()))
        .thenReturn(new UserSession());

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogin(request, response);
    }

    verify(sessionService)
        .createPendingSession(
            request, response, "saml", "https://saml.example.com/callback", null, null, null);
  }

  @Test
  void handleLogin_carriesPendingSessionIdInRelayStateAndKeepsTheRequestId() throws Exception {
    when(request.getParameter("callback")).thenReturn("https://example.com/callback");
    UserSession pending = UserSession.builder().id("pending-session-id").build();
    when(sessionService.createPendingSession(
            eq(request),
            eq(response),
            eq("saml"),
            eq("https://example.com/callback"),
            any(),
            any(),
            any()))
        .thenReturn(pending);
    when(sessionService.recordPendingState(pending, "request-id")).thenReturn(Optional.of(pending));

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
            mockStatic(SamlSettingsHolder.class);
        MockedConstruction<Auth> authConstruction =
            mockConstruction(
                Auth.class,
                (auth, context) -> {
                  when(auth.login(
                          eq("pending-session-id"), any(AuthnRequestParams.class), eq(true)))
                      .thenReturn("https://idp.example.com/sso?SAMLRequest=request");
                  when(auth.getLastRequestId()).thenReturn("request-id");
                })) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogin(request, response);

      verify(sessionService).recordPendingState(pending, "request-id");
      verify(response).sendRedirect("https://idp.example.com/sso?SAMLRequest=request");
    }
  }

  @Test
  void handleCallback_refusesAPendingLoginThatSentNoRequest() {
    UserSession pending =
        UserSession.builder()
            .id("pending-session-id")
            .status(SessionStatus.PENDING)
            .redirectUri("https://example.com/callback")
            .build();
    when(request.getParameter("RelayState")).thenReturn("pending-session-id");
    when(sessionService.getPendingSessionById("pending-session-id"))
        .thenReturn(Optional.of(pending));

    handler.handleCallback(request, response);

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
  }

  /**
   * Only the assertion is signed, so the response element's InResponseTo is whatever the poster
   * wrote. A captured answer to another login's request must not complete the poster's own login.
   */
  @Test
  void handleCallback_refusesAnAssertionThatAnswersAnotherLoginsRequest() throws Exception {
    MockSamlIdp idp = new MockSamlIdp(IDP_ENTITY_ID);
    Saml2Settings settings = nonStrictSettings(idp);
    String captured =
        idp.assertionSignedResponse(
            SUBJECT, ACS_URL, SP_ENTITY_ID, "victim-request-id", "attacker-request-id");
    assertTrue(
        new SamlResponse(
                settings, new HttpRequest(ACS_URL, Map.of("SAMLResponse", List.of(captured))))
            .isValid("attacker-request-id"),
        "java-saml outside strict mode accepts it");
    UserSession attackersLogin =
        UserSession.builder()
            .id("attacker-session-id")
            .status(SessionStatus.PENDING)
            .redirectUri("https://example.com/callback")
            .state("attacker-request-id")
            .build();
    when(request.getParameter("RelayState")).thenReturn(attackersLogin.getId());
    when(request.getParameterMap())
        .thenReturn(
            Map.of(
                "SAMLResponse",
                new String[] {captured},
                "RelayState",
                new String[] {attackersLogin.getId()}));
    when(request.getRequestURL()).thenReturn(new StringBuffer(ACS_URL));
    when(sessionService.getPendingSessionById(attackersLogin.getId()))
        .thenReturn(Optional.of(attackersLogin));

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(settings);

      handler.handleCallback(request, response);
    }

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    verify(servletOutputStream).print(contains("does not answer this login's request"));
    verify(sessionService, never()).recordPendingUser(any(), any());
  }

  /**
   * Microsoft Entra signs only the assertion unless told to sign the response too, so a service
   * provider that wants signed messages turns the login down. The person signing in must see
   * java-saml's reason, not only that SAML failed.
   */
  @Test
  void handleCallback_showsWhyJavaSamlRejectedTheResponse() throws Exception {
    MockSamlIdp idp = new MockSamlIdp(IDP_ENTITY_ID);
    String assertionSigned =
        idp.assertionSignedResponse(SUBJECT, ACS_URL, SP_ENTITY_ID, "request-id", "request-id");
    UserSession login =
        UserSession.builder()
            .id("pending-session-id")
            .status(SessionStatus.PENDING)
            .redirectUri("https://example.com/callback")
            .state("request-id")
            .build();
    when(request.getParameter("RelayState")).thenReturn(login.getId());
    when(request.getParameterMap())
        .thenReturn(
            Map.of(
                "SAMLResponse",
                new String[] {assertionSigned},
                "RelayState",
                new String[] {login.getId()}));
    when(request.getRequestURL()).thenReturn(new StringBuffer(ACS_URL));
    when(sessionService.getPendingSessionById(login.getId())).thenReturn(Optional.of(login));

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder
          .when(SamlSettingsHolder::getSaml2Settings)
          .thenReturn(strictSettingsWantingSignedMessages(idp));

      handler.handleCallback(request, response);
    }

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    verify(servletOutputStream)
        .print(
            contains(
                "SAML response rejected: The Message of the Response is not signed and the SP"
                    + " requires it"));
    verify(sessionService, never()).recordPendingUser(any(), any());
  }

  /**
   * Servers share the session store but each caches what it read for a few seconds, so the server
   * the browser returns to can hold the login as it was before another server's ACS attached the
   * account.
   */
  @Test
  void completeLogin_seesTheAccountAnotherServersAcsAttached() throws Exception {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    InMemorySessionStore store = new InMemorySessionStore();
    SessionService loginServer = new SessionService(authConfig, store);
    SessionService acsServer = new SessionService(authConfig, store);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("saml-user")
            .withEmail("saml-user@example.com");
    UserSession login = startLogin(loginServer);
    String code =
        acsServer
            .recordPendingUser(acsServer.getPendingSessionById(login.getId()).orElseThrow(), user)
            .orElseThrow();
    when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, login.getId())});
    when(request.getParameter("code")).thenReturn(code);

    try {
      completeAs(user, loginServer);
    } finally {
      Fernet.getInstance().setFernetKey((String) null);
    }

    verify(response)
        .sendRedirect(
            "https://example.com/callback"
                + "#id_token=session-jwt&email=saml-user%40example.com&name=");
    assertEquals(SessionStatus.EXPIRED, store.findById(login.getId()).orElseThrow().getStatus());
  }

  /**
   * The cookie names the browser that started the login, and the code reaches only the browser the
   * ACS answered, so the login completes where both are present and nowhere else.
   */
  @Test
  void completeLogin_needsTheCodeTheAcsRedirectedWith() throws Exception {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    InMemorySessionStore store = new InMemorySessionStore();
    SessionService sessions = new SessionService(authConfig, store);
    User user =
        new User()
            .withId(UUID.randomUUID())
            .withName("saml-user")
            .withEmail("saml-user@example.com");
    UserSession login = startLogin(sessions);
    sessions
        .recordPendingUser(sessions.getPendingSessionById(login.getId()).orElseThrow(), user)
        .orElseThrow();
    when(request.getCookies())
        .thenReturn(new Cookie[] {new Cookie(SessionCookieUtil.COOKIE_NAME, login.getId())});

    try {
      for (String code : new String[] {null, "", "another-code"}) {
        when(request.getParameter("code")).thenReturn(code);
        completeAs(user, sessions);
      }
    } finally {
      Fernet.getInstance().setFernetKey((String) null);
    }

    verify(response, times(3)).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    verify(response, never()).sendRedirect(anyString());
    assertEquals(SessionStatus.PENDING, store.findById(login.getId()).orElseThrow().getStatus());
  }

  private UserSession startLogin(SessionService sessions) {
    return sessions
        .recordPendingState(
            sessions.createPendingSession(
                request, response, "saml", "https://example.com/callback", null, null, null),
            "request-id")
        .orElseThrow();
  }

  private void completeAs(User user, SessionService sessions) {
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.get(any(), eq(user.getId()), any())).thenReturn(user);
    JWTTokenGenerator tokenGenerator = mock(JWTTokenGenerator.class);
    when(tokenGenerator.generateJWTTokenForSession(
            any(), any(), anyBoolean(), any(), anyLong(), any(), any()))
        .thenReturn(new JWTAuthMechanism().withJWTToken("session-jwt"));
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<JWTTokenGenerator> jwt = mockStatic(JWTTokenGenerator.class);
        MockedStatic<SamlSettingsHolder> samlSettingsHolder =
            mockStatic(SamlSettingsHolder.class)) {
      entity.when(Entity::getUserRepository).thenReturn(userRepository);
      entity.when(Entity::getTokenRepository).thenReturn(tokenRepository);
      jwt.when(JWTTokenGenerator::getInstance).thenReturn(tokenGenerator);
      samlSettingsHolder
          .when(SamlSettingsHolder::getInstance)
          .thenReturn(mock(SamlSettingsHolder.class));
      new SamlAuthServletHandler(authConfig, authorizerConfig, sessions)
          .completeLogin(request, response);
    }
  }

  @Test
  void resolvePendingSession_prefersRelayStateOverCookie() {
    UserSession relaySession =
        UserSession.builder().id("relay-session-id").status(SessionStatus.PENDING).build();
    when(request.getParameter("RelayState")).thenReturn("relay-session-id");
    when(sessionService.getPendingSessionById("relay-session-id"))
        .thenReturn(Optional.of(relaySession));

    UserSession resolved = handler.resolvePendingSession(request, response);

    assertEquals(relaySession, resolved);
    verify(sessionService, never()).getPendingSession(any(), any());
  }

  @Test
  void resolvePendingSession_fallsBackToCookieWhenRelayStateMissing() {
    UserSession cookieSession =
        UserSession.builder().id("cookie-session-id").status(SessionStatus.PENDING).build();
    when(request.getParameter("RelayState")).thenReturn(null);
    when(sessionService.getPendingSession(request, response))
        .thenReturn(Optional.of(cookieSession));

    UserSession resolved = handler.resolvePendingSession(request, response);

    assertEquals(cookieSession, resolved);
    verify(sessionService, never()).getPendingSessionById(any());
  }

  @Test
  void resolvePendingSession_fallsBackToCookieWhenRelayStateNotPending() {
    UserSession cookieSession =
        UserSession.builder().id("cookie-session-id").status(SessionStatus.PENDING).build();
    when(request.getParameter("RelayState")).thenReturn("stale-or-unknown-id");
    when(sessionService.getPendingSessionById("stale-or-unknown-id")).thenReturn(Optional.empty());
    when(sessionService.getPendingSession(request, response))
        .thenReturn(Optional.of(cookieSession));

    UserSession resolved = handler.resolvePendingSession(request, response);

    assertEquals(cookieSession, resolved);
  }

  @Test
  void handleRefresh_withoutActiveSession_returnsUnauthorized() {
    when(sessionService.acquireRefreshLease(request, response)).thenReturn(Optional.empty());

    handler.handleRefresh(request, response);

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
  }

  @Test
  void handleRefresh_revokedSession_answersSessionRevoked() throws Exception {
    // The browser signs out on this answer instead of re-authenticating silently, which would
    // evict another of the user's sessions under the per-user cap.
    when(sessionService.acquireRefreshLease(request, response)).thenReturn(Optional.empty());
    when(sessionService.describeMissingSession(request)).thenReturn(SessionService.SESSION_REVOKED);

    handler.handleRefresh(request, response);

    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    verify(servletOutputStream).print(contains(SessionService.SESSION_REVOKED));
  }

  @Test
  void handleRefresh_revokedSessionRotatesAndDeletesOrphanedRefreshToken() {
    UserSession leasedSession =
        UserSession.builder()
            .id("session-id")
            .status(SessionStatus.REFRESHING)
            .username("saml-user")
            .build();
    UserSession revokedSession =
        leasedSession.toBuilder().status(SessionStatus.REVOKED).version(2L).build();
    User user =
        new User()
            .withId(java.util.UUID.randomUUID())
            .withName("saml-user")
            .withEmail("saml-user@example.com");
    org.openmetadata.schema.auth.RefreshToken currentRefreshToken =
        TokenUtil.getRefreshToken(user.getId(), java.util.UUID.randomUUID());

    when(sessionService.acquireRefreshLease(request, response))
        .thenReturn(Optional.of(leasedSession));
    when(sessionService.decryptOmRefreshToken(leasedSession)).thenReturn("current-refresh-token");
    when(sessionService.completeRefresh(
            eq(leasedSession), any(), eq(SessionService.ProviderTokenUpdate.NONE)))
        .thenReturn(Optional.of(revokedSession));
    when(tokenRepository.findByToken("current-refresh-token")).thenReturn(currentRefreshToken);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.USER, "saml-user", "id,roles,isAdmin,email", Include.NON_DELETED))
          .thenReturn(user);
      entityMock.when(Entity::getTokenRepository).thenReturn(tokenRepository);

      handler.handleRefresh(request, response);
    }

    ArgumentCaptor<TokenInterface> tokenCaptor = ArgumentCaptor.forClass(TokenInterface.class);
    verify(tokenRepository).insertToken(tokenCaptor.capture());
    verify(tokenRepository).deleteToken("current-refresh-token");
    verify(tokenRepository).deleteToken(tokenCaptor.getValue().getToken().toString());
    verify(sessionService).revokeSession(request, response);
    verify(response).setStatus(HttpServletResponse.SC_UNAUTHORIZED);
  }

  @Test
  void handleLogout_revokesLocalSessionWhenSloFails() {
    when(sessionService.getSession(request)).thenReturn(Optional.empty());

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
        mockStatic(SamlSettingsHolder.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogout(request, response);
    }

    verify(sessionService).revokeSession(request, response);
    verify(response, org.mockito.Mockito.atLeastOnce()).setStatus(HttpServletResponse.SC_OK);
  }

  @Test
  void mapToStandardClaimName_normalizesKnownAttributes() throws Exception {
    java.lang.reflect.Method method =
        SamlAuthServletHandler.class.getDeclaredMethod("mapToStandardClaimName", String.class);
    method.setAccessible(true);

    assertEquals(
        "given_name",
        method.invoke(handler, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"));
    assertEquals("family_name", method.invoke(handler, "lastName"));
    assertEquals("name", method.invoke(handler, "displayName"));
    assertEquals("customattribute", method.invoke(handler, "http://custom/claims/customAttribute"));
  }

  @Test
  void defaultDisplayNameAttributes_areConfigured() throws Exception {
    java.lang.reflect.Field field =
        SamlAuthServletHandler.class.getDeclaredField("displayNameAttributes");
    field.setAccessible(true);
    @SuppressWarnings("unchecked")
    java.util.List<String> attributes = (java.util.List<String>) field.get(handler);

    assertTrue(attributes.contains("displayName"));
    assertTrue(attributes.contains("given_name"));
  }

  @Test
  void getOrCreateUser_selfSignup_persistsMappedEmailNotDerivedFromUsername() throws Exception {
    when(authConfig.getEnableSelfSignup()).thenReturn(true);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(authorizerConfig);
    when(authorizerConfig.getAdminPrincipals()).thenReturn(Set.of());

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created = invokeGetOrCreateUser("shortid", "firstname.lastname@example.com");

      assertEquals("shortid", created.getName());
      assertEquals("firstname.lastname@example.com", created.getEmail());
    }
  }

  @Test
  void getOrCreateUser_selfSignup_preservesEmailWhenUsernameMatchesLocalPart() throws Exception {
    when(authConfig.getEnableSelfSignup()).thenReturn(true);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(authorizerConfig);
    when(authorizerConfig.getAdminPrincipals()).thenReturn(Set.of());

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created = invokeGetOrCreateUser("john.doe", "john.doe@example.com");

      assertEquals("john.doe", created.getName());
      assertEquals("john.doe@example.com", created.getEmail());
    }
  }

  private void stubUserNotFoundAndEchoCreate(MockedStatic<Entity> mockedEntity) {
    UserRepository userRepository = mock(UserRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);

    mockedEntity
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.USER), anyString(), anyString(), any(Include.class)))
        .thenThrow(new EntityNotFoundException("user not found"));
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);
    when(userRepository.findByNameOrNull(any(), any())).thenReturn(null);
    when(userRepository.createOrUpdate(eq(null), any(User.class), any()))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.CREATED,
                    invocation.getArgument(1, User.class),
                    EventType.ENTITY_CREATED));
  }

  private User invokeGetOrCreateUser(String username, String email) throws Exception {
    Method method =
        SamlAuthServletHandler.class.getDeclaredMethod(
            "getOrCreateUser", String.class, String.class, String.class, List.class);
    method.setAccessible(true);
    User result;
    try {
      result = (User) method.invoke(handler, username, email, null, List.of());
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw e;
    }
    return result;
  }

  @Test
  void resolveSamlIdentity_failsWhenConfiguredEmailAttributeMissing() {
    when(authConfig.getEmailClaim()).thenReturn("email");
    when(authConfig.getDisplayNameClaim()).thenReturn("name");
    when(authConfig.getJwtPrincipalClaimsMapping()).thenReturn(List.of());
    Auth auth = mock(Auth.class);
    when(auth.getAttribute("email")).thenReturn(null);
    when(auth.getNameId()).thenReturn("legacy.user@company.com");

    org.openmetadata.service.exception.AuthenticationException exception =
        assertThrows(
            org.openmetadata.service.exception.AuthenticationException.class,
            () -> invokeResolveSamlIdentity(auth));

    assertTrue(exception.getMessage().contains("email attribute 'email' not found"));
  }

  @Test
  void getOrCreateEmailFirstSamlUser_returnsExistingUserByExactEmail() throws Exception {
    when(authConfig.getEnableSelfSignup()).thenReturn(true);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(authorizerConfig);
    when(authorizerConfig.getAdminPrincipals()).thenReturn(Set.of());

    User existing =
        new User()
            .withId(UUID.randomUUID())
            .withName("john_a1b2")
            .withEmail("john@y.com")
            .withDisplayName("John Y");

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      UserRepository userRepository = mock(UserRepository.class);
      mockedEntity.when(Entity::getUserRepository).thenReturn(userRepository);
      when(userRepository.getActiveUserByEmailForAuth(eq("john@y.com"), any()))
          .thenReturn(existing);

      User resolved = invokeGetOrCreateEmailFirstSamlUser("john@y.com", "John Y");

      assertSame(existing, resolved);
      verify(userRepository).getActiveUserByEmailForAuth(eq("john@y.com"), any());
    }
  }

  @Test
  void getOrCreateEmailFirstSamlUser_rejectsUnregisteredUserWhenSelfSignupDisabled() {
    when(authConfig.getEnableSelfSignup()).thenReturn(false);
    SecurityConfigurationManager.getInstance().setCurrentAuthzConfig(authorizerConfig);
    when(authorizerConfig.getAdminPrincipals()).thenReturn(Set.of());

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      UserRepository userRepository = mock(UserRepository.class);
      mockedEntity.when(Entity::getUserRepository).thenReturn(userRepository);
      when(userRepository.getActiveUserByEmailForAuth(any(), any()))
          .thenThrow(new EntityNotFoundException("user not found"));

      org.openmetadata.service.security.AuthenticationException exception =
          assertThrows(
              org.openmetadata.service.security.AuthenticationException.class,
              () -> invokeGetOrCreateEmailFirstSamlUser("newuser@company.com", "New User"));

      assertTrue(exception.getMessage().contains("User not registered"));
    }
  }

  private Object invokeResolveSamlIdentity(Auth auth) throws Exception {
    Method method =
        SamlAuthServletHandler.class.getDeclaredMethod("resolveSamlIdentity", Auth.class);
    method.setAccessible(true);
    try {
      return method.invoke(handler, auth);
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw e;
    }
  }

  private User invokeGetOrCreateEmailFirstSamlUser(String email, String displayName)
      throws Exception {
    Method method =
        SamlAuthServletHandler.class.getDeclaredMethod(
            "getOrCreateEmailFirstSamlUser", String.class, String.class, List.class);
    method.setAccessible(true);
    try {
      return (User) method.invoke(handler, email, displayName, List.of());
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw e;
    }
  }

  private static Saml2Settings nonStrictSettings(MockSamlIdp idp) {
    return settings(idp, false, false);
  }

  /** java-saml enforces "want messages signed" in strict mode only. */
  private static Saml2Settings strictSettingsWantingSignedMessages(MockSamlIdp idp) {
    return settings(idp, true, true);
  }

  private static Saml2Settings settings(
      MockSamlIdp idp, boolean strict, boolean wantMessagesSigned) {
    Map<String, Object> values = new HashMap<>();
    values.put(SettingsBuilder.STRICT_PROPERTY_KEY, strict);
    values.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, SP_ENTITY_ID);
    values.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, ACS_URL);
    values.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, IDP_ENTITY_ID);
    values.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY,
        "https://mock-idp.openmetadata.test/sso");
    values.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, idp.idpCertificatePem());
    values.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, false);
    values.put(SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, wantMessagesSigned);
    return new SettingsBuilder().fromValues(values).build();
  }

  /** The session store that every server reads and writes. */
  private static final class InMemorySessionStore implements SessionStore {
    private final Map<String, UserSession> sessions = new ConcurrentHashMap<>();

    @Override
    public Optional<UserSession> findById(String sessionId) {
      return Optional.ofNullable(sessions.get(sessionId));
    }

    @Override
    public List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit) {
      return sessions.values().stream()
          .filter(session -> userId.equals(session.getUserId()) && status == session.getStatus())
          .limit(limit)
          .toList();
    }

    @Override
    public List<UserSession> findSessionsToExpire(long now, int limit) {
      return List.of();
    }

    @Override
    public List<UserSession> findSessionsToPrune(long cutoff, int limit) {
      return List.of();
    }

    @Override
    public void create(UserSession session) {
      sessions.put(session.getId(), session);
    }

    @Override
    public synchronized boolean updateIfVersion(UserSession session, long expectedVersion) {
      UserSession current = sessions.get(session.getId());
      boolean versionMatches =
          current != null && Objects.equals(current.getVersion(), expectedVersion);
      if (versionMatches) {
        sessions.put(session.getId(), session);
      }
      return versionMatches;
    }

    @Override
    public void delete(String sessionId) {
      sessions.remove(sessionId);
    }

    @Override
    public int deleteByIds(List<String> sessionIds) {
      int deleted = 0;
      for (String sessionId : sessionIds) {
        deleted += sessions.remove(sessionId) == null ? 0 : 1;
      }
      return deleted;
    }
  }
}
