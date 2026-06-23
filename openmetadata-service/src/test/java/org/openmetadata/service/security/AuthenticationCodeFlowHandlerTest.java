package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.OidcConfiguration;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthenticationCodeFlowHandlerTest {

  @Mock private SessionService sessionService;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private OidcClient oidcClient;
  @Mock private OidcConfiguration oidcConfiguration;

  private CaptureServletOutputStream captureOutputStream;

  @BeforeEach
  void setUp() throws IOException {
    captureOutputStream = new CaptureServletOutputStream();
    when(response.getOutputStream()).thenReturn(captureOutputStream);
    AuthenticationCodeFlowHandler.setMcpStateChecker(null);
  }

  @AfterEach
  void tearDown() {
    AuthenticationCodeFlowHandler.setMcpStateChecker(null);
  }

  @Test
  void getErrorMessage_setsStatus500AndWritesErrorBody() throws IOException {
    Exception error = new TechnicalException("Something went wrong");

    AuthenticationCodeFlowHandler.getErrorMessage(response, error);

    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    String body = captureOutputStream.getCapturedOutput();
    assertTrue(body.contains("Something went wrong"));
  }

  @Test
  void getErrorMessage_handlesNullMessage() throws IOException {
    Exception error = new TechnicalException((String) null);

    AuthenticationCodeFlowHandler.getErrorMessage(response, error);

    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
  }

  @Test
  void handleCallback_noPendingSession_writesErrorResponse() throws Exception {
    when(sessionService.getPendingSession(request, response)).thenReturn(Optional.empty());

    AuthenticationCodeFlowHandler handler =
        createHandlerWithMockedInternals(sessionService, oidcClient);

    handler.handleCallback(request, response);

    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    String body = captureOutputStream.getCapturedOutput();
    assertTrue(body.contains("No pending session found for callback"));
  }

  @Test
  void validateStateIfRequired_mismatchedStates_throwsTechnicalException() throws Exception {
    when(oidcClient.getConfiguration()).thenReturn(oidcConfiguration);
    when(oidcConfiguration.isWithState()).thenReturn(true);

    AuthenticationCodeFlowHandler handler =
        createHandlerWithMockedInternals(sessionService, oidcClient);

    UserSession pendingSession =
        UserSession.builder().id("test-session").state("expected-state-abc").build();

    com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse successResponse =
        new com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse(
            java.net.URI.create("https://example.com/callback"),
            new com.nimbusds.oauth2.sdk.AuthorizationCode("test-code"),
            null,
            null,
            new com.nimbusds.oauth2.sdk.id.State("different-state-xyz"),
            null,
            null);

    Method validateMethod =
        AuthenticationCodeFlowHandler.class.getDeclaredMethod(
            "validateStateIfRequired",
            UserSession.class,
            HttpServletResponse.class,
            com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse.class);
    validateMethod.setAccessible(true);

    TechnicalException thrown =
        assertThrows(
            TechnicalException.class,
            () -> {
              try {
                validateMethod.invoke(handler, pendingSession, response, successResponse);
              } catch (java.lang.reflect.InvocationTargetException e) {
                throw e.getCause();
              }
            });

    assertEquals(
        "State parameter is different from the one sent in authentication request.",
        thrown.getMessage());
  }

  @Test
  void validateStateIfRequired_matchingStates_doesNotThrow() throws Exception {
    when(oidcClient.getConfiguration()).thenReturn(oidcConfiguration);
    when(oidcConfiguration.isWithState()).thenReturn(true);

    AuthenticationCodeFlowHandler handler =
        createHandlerWithMockedInternals(sessionService, oidcClient);

    UserSession pendingSession =
        UserSession.builder().id("test-session").state("matching-state").build();

    com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse successResponse =
        new com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse(
            java.net.URI.create("https://example.com/callback"),
            new com.nimbusds.oauth2.sdk.AuthorizationCode("test-code"),
            null,
            null,
            new com.nimbusds.oauth2.sdk.id.State("matching-state"),
            null,
            null);

    Method validateMethod =
        AuthenticationCodeFlowHandler.class.getDeclaredMethod(
            "validateStateIfRequired",
            UserSession.class,
            HttpServletResponse.class,
            com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse.class);
    validateMethod.setAccessible(true);

    validateMethod.invoke(handler, pendingSession, response, successResponse);
  }

  @Test
  void validateStateIfRequired_stateDisabled_doesNotThrow() throws Exception {
    when(oidcClient.getConfiguration()).thenReturn(oidcConfiguration);
    when(oidcConfiguration.isWithState()).thenReturn(false);

    AuthenticationCodeFlowHandler handler =
        createHandlerWithMockedInternals(sessionService, oidcClient);

    UserSession pendingSession =
        UserSession.builder().id("test-session").state("some-state").build();

    com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse successResponse =
        new com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse(
            java.net.URI.create("https://example.com/callback"),
            new com.nimbusds.oauth2.sdk.AuthorizationCode("test-code"),
            null,
            null,
            new com.nimbusds.oauth2.sdk.id.State("different-state"),
            null,
            null);

    Method validateMethod =
        AuthenticationCodeFlowHandler.class.getDeclaredMethod(
            "validateStateIfRequired",
            UserSession.class,
            HttpServletResponse.class,
            com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse.class);
    validateMethod.setAccessible(true);

    validateMethod.invoke(handler, pendingSession, response, successResponse);
  }

  @Test
  void validateStateIfRequired_blankStateInSession_throwsTechnicalException() throws Exception {
    when(oidcClient.getConfiguration()).thenReturn(oidcConfiguration);
    when(oidcConfiguration.isWithState()).thenReturn(true);

    AuthenticationCodeFlowHandler handler =
        createHandlerWithMockedInternals(sessionService, oidcClient);

    UserSession pendingSession = UserSession.builder().id("test-session").state("").build();

    com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse successResponse =
        new com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse(
            java.net.URI.create("https://example.com/callback"),
            new com.nimbusds.oauth2.sdk.AuthorizationCode("test-code"),
            null,
            null,
            new com.nimbusds.oauth2.sdk.id.State("attacker-state"),
            null,
            null);

    Method validateMethod =
        AuthenticationCodeFlowHandler.class.getDeclaredMethod(
            "validateStateIfRequired",
            UserSession.class,
            HttpServletResponse.class,
            com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse.class);
    validateMethod.setAccessible(true);

    TechnicalException thrown =
        assertThrows(
            TechnicalException.class,
            () -> {
              try {
                validateMethod.invoke(handler, pendingSession, response, successResponse);
              } catch (java.lang.reflect.InvocationTargetException e) {
                throw e.getCause();
              }
            });

    assertTrue(thrown.getMessage().contains("Missing state parameter"));
  }

  @Test
  void isMcpState_returnsFalse_whenCheckerIsNull() {
    AuthenticationCodeFlowHandler.setMcpStateChecker(null);

    assertFalse(AuthenticationCodeFlowHandler.isMcpState("some-state"));
  }

  @Test
  void isMcpState_returnsFalse_whenStateIsNull() {
    AuthenticationCodeFlowHandler.setMcpStateChecker(s -> true);

    assertFalse(AuthenticationCodeFlowHandler.isMcpState(null));
  }

  @Test
  void isMcpState_returnsTrue_whenCheckerReturnsTrue() {
    AuthenticationCodeFlowHandler.setMcpStateChecker(s -> s.startsWith("mcp-"));

    assertTrue(AuthenticationCodeFlowHandler.isMcpState("mcp-abc123"));
  }

  @Test
  void isMcpState_returnsFalse_whenCheckerReturnsFalse() {
    AuthenticationCodeFlowHandler.setMcpStateChecker(s -> s.startsWith("mcp-"));

    assertFalse(AuthenticationCodeFlowHandler.isMcpState("regular-state"));
  }

  @Test
  void isMcpState_returnsFalse_whenCheckerThrowsException() {
    AuthenticationCodeFlowHandler.setMcpStateChecker(
        s -> {
          throw new RuntimeException("checker failed");
        });

    assertFalse(AuthenticationCodeFlowHandler.isMcpState("some-state"));
  }

  @Test
  void validatePrincipalClaimsMapping_throwsWhenMissingUsername() {
    java.util.Map<String, String> mapping = new java.util.HashMap<>();
    mapping.put("email", "mail");

    assertThrows(
        IllegalArgumentException.class,
        () -> AuthenticationCodeFlowHandler.validatePrincipalClaimsMapping(mapping));
  }

  @Test
  void validatePrincipalClaimsMapping_throwsWhenMissingEmail() {
    java.util.Map<String, String> mapping = new java.util.HashMap<>();
    mapping.put("username", "preferred_username");

    assertThrows(
        IllegalArgumentException.class,
        () -> AuthenticationCodeFlowHandler.validatePrincipalClaimsMapping(mapping));
  }

  @Test
  void validatePrincipalClaimsMapping_allowsEmptyMapping() {
    AuthenticationCodeFlowHandler.validatePrincipalClaimsMapping(java.util.Collections.emptyMap());
  }

  @Test
  void validatePrincipalClaimsMapping_allowsValidMapping() {
    java.util.Map<String, String> mapping = new java.util.HashMap<>();
    mapping.put("username", "preferred_username");
    mapping.put("email", "mail");

    AuthenticationCodeFlowHandler.validatePrincipalClaimsMapping(mapping);
  }

  @Test
  void isJWT_returnsTrueForThreePartToken() {
    assertTrue(AuthenticationCodeFlowHandler.isJWT("header.payload.signature"));
  }

  @Test
  void isJWT_returnsFalseForTwoPartToken() {
    assertFalse(AuthenticationCodeFlowHandler.isJWT("header.payload"));
  }

  @Test
  void isJWT_returnsFalseForPlainString() {
    assertFalse(AuthenticationCodeFlowHandler.isJWT("not-a-jwt"));
  }

  @Test
  void getOrCreateOidcUser_selfSignup_persistsMappedEmailNotDerivedFromUsername() throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created =
          invokeGetOrCreateOidcUser(handler, "shortid", "firstname.lastname@example.com");

      assertEquals("shortid", created.getName());
      assertEquals("firstname.lastname@example.com", created.getEmail());
    }
  }

  @Test
  void getOrCreateOidcUser_selfSignup_preservesEmailWhenUsernameMatchesLocalPart()
      throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created = invokeGetOrCreateOidcUser(handler, "john.doe", "john.doe@example.com");

      assertEquals("john.doe", created.getName());
      assertEquals("john.doe@example.com", created.getEmail());
    }
  }

  @Test
  void getOrCreateOidcUser_selfSignup_allowsConfiguredDomainAndPersistsMappedEmail()
      throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(Set.of("example.com"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      User created =
          invokeGetOrCreateOidcUser(handler, "shortid", "firstname.lastname@example.com");

      assertEquals("shortid", created.getName());
      assertEquals("firstname.lastname@example.com", created.getEmail());
    }
  }

  @Test
  void getOrCreateOidcUser_selfSignup_rejectsDisallowedEmailDomain() throws Exception {
    AuthenticationCodeFlowHandler handler = createSelfSignupHandler(Set.of("allowed.com"));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubUserNotFoundAndEchoCreate(mockedEntity);

      AuthenticationException thrown =
          assertThrows(
              AuthenticationException.class,
              () ->
                  invokeGetOrCreateOidcUser(handler, "shortid", "firstname.lastname@example.com"));

      assertTrue(thrown.getMessage().contains("example.com"));
    }
  }

  private AuthenticationCodeFlowHandler createSelfSignupHandler(Set<String> allowedDomains)
      throws Exception {
    AuthenticationConfiguration authConfig = mock(AuthenticationConfiguration.class);
    when(authConfig.getEnableSelfSignup()).thenReturn(true);

    AuthorizerConfiguration authzConfig = mock(AuthorizerConfiguration.class);
    when(authzConfig.getAdminPrincipals()).thenReturn(Set.of());
    when(authzConfig.getAllowedEmailRegistrationDomains()).thenReturn(allowedDomains);
    when(authzConfig.getDefaultOAuthRole()).thenReturn(null);

    sun.misc.Unsafe unsafe = getUnsafe();
    AuthenticationCodeFlowHandler handler =
        (AuthenticationCodeFlowHandler)
            unsafe.allocateInstance(AuthenticationCodeFlowHandler.class);
    setField(handler, "authenticationConfiguration", authConfig);
    setField(handler, "authorizerConfiguration", authzConfig);
    return handler;
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

  private User invokeGetOrCreateOidcUser(
      AuthenticationCodeFlowHandler handler, String userName, String email) throws Exception {
    Method method =
        AuthenticationCodeFlowHandler.class.getDeclaredMethod(
            "getOrCreateOidcUser", String.class, String.class, Map.class);
    method.setAccessible(true);
    User result;
    try {
      result = (User) method.invoke(handler, userName, email, new HashMap<String, Object>());
    } catch (InvocationTargetException e) {
      Throwable cause = e.getCause();
      if (cause instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw e;
    }
    return result;
  }

  /**
   * Allocates an AuthenticationCodeFlowHandler without invoking its constructor (which requires a
   * real OIDC provider for discovery), then injects the mocked collaborators via reflection.
   */
  private AuthenticationCodeFlowHandler createHandlerWithMockedInternals(
      SessionService sessionService, OidcClient client) throws Exception {
    sun.misc.Unsafe unsafe = getUnsafe();
    AuthenticationCodeFlowHandler handler =
        (AuthenticationCodeFlowHandler)
            unsafe.allocateInstance(AuthenticationCodeFlowHandler.class);

    setField(handler, "sessionService", sessionService);
    setField(handler, "client", client);

    return handler;
  }

  private static sun.misc.Unsafe getUnsafe() throws Exception {
    Field unsafeField = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    return (sun.misc.Unsafe) unsafeField.get(null);
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  private static class CaptureServletOutputStream extends ServletOutputStream {
    private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();

    @Override
    public void write(int b) {
      buffer.write(b);
    }

    @Override
    public void print(String s) {
      try {
        buffer.write(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      } catch (IOException e) {
        throw new RuntimeException(e);
      }
    }

    @Override
    public boolean isReady() {
      return true;
    }

    @Override
    public void setWriteListener(jakarta.servlet.WriteListener writeListener) {}

    String getCapturedOutput() {
      return buffer.toString(java.nio.charset.StandardCharsets.UTF_8);
    }
  }
}
