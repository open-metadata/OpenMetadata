package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.UserSession;
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
