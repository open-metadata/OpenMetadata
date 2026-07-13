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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.onelogin.saml2.Auth;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.core.Response;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.TokenUtil;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SamlAuthServletHandlerTest {

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
  void handleLogin_carriesPendingSessionIdInRelayState() throws Exception {
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

    try (MockedStatic<SamlSettingsHolder> samlSettingsHolder =
            mockStatic(SamlSettingsHolder.class);
        MockedConstruction<Auth> authConstruction = mockConstruction(Auth.class)) {
      samlSettingsHolder.when(SamlSettingsHolder::getSaml2Settings).thenReturn(null);

      handler.handleLogin(request, response);

      verify(authConstruction.constructed().get(0)).login("pending-session-id");
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
    when(sessionService.completeRefresh(eq(leasedSession), any(), eq(null)))
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
}
