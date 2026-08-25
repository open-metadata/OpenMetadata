package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SessionCookieUtilTest {

  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private AuthenticationConfiguration authConfig;

  @BeforeEach
  void setUp() {
    lenient().when(authConfig.getForceSecureSessionCookie()).thenReturn(false);
    lenient().when(request.isSecure()).thenReturn(false);
  }

  @Test
  void writeSessionCookie_secureRequest_containsSecureAndSameSiteNone() {
    when(request.isSecure()).thenReturn(true);

    SessionCookieUtil.writeSessionCookie(request, response, authConfig, "session-value", 3600);

    String cookie = captureSetCookieHeader();
    assertTrue(cookie.contains("Secure"));
    assertTrue(cookie.contains("SameSite=None"));
    assertTrue(cookie.contains("HttpOnly"));
    assertTrue(cookie.contains("Path=/"));
    assertTrue(cookie.startsWith("OM_SESSION=session-value"));
  }

  @Test
  void writeSessionCookie_nonSecureRequest_containsSameSiteLaxAndNoSecure() {
    when(request.isSecure()).thenReturn(false);
    when(authConfig.getForceSecureSessionCookie()).thenReturn(false);

    SessionCookieUtil.writeSessionCookie(request, response, authConfig, "session-value", 3600);

    String cookie = captureSetCookieHeader();
    assertTrue(cookie.contains("SameSite=Lax"));
    assertTrue(cookie.contains("HttpOnly"));
    assertFalse(cookie.contains("Secure"));
  }

  @Test
  void writeSessionCookie_setsCorrectMaxAge() {
    int maxAge = 7200;

    SessionCookieUtil.writeSessionCookie(request, response, authConfig, "test-session", maxAge);

    String cookie = captureSetCookieHeader();
    assertTrue(cookie.contains("Max-Age=" + maxAge));
  }

  @Test
  void getSessionId_returnsSessionIdFromOmSessionCookie() {
    String sessionId = "a".repeat(43);
    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", sessionId)});

    Optional<String> result = SessionCookieUtil.getSessionId(request);

    assertTrue(result.isPresent());
    assertEquals(sessionId, result.get());
  }

  @Test
  void getSessionId_returnsEmptyWhenNoCookiesExist() {
    when(request.getCookies()).thenReturn(null);

    Optional<String> result = SessionCookieUtil.getSessionId(request);

    assertTrue(result.isEmpty());
  }

  @Test
  void getSessionId_returnsEmptyWhenOmSessionCookieNotPresent() {
    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OTHER_COOKIE", "value")});

    Optional<String> result = SessionCookieUtil.getSessionId(request);

    assertTrue(result.isEmpty());
  }

  @Test
  void getSessionId_returnsEmptyForInvalidSessionIdFormat() {
    when(request.getCookies()).thenReturn(new Cookie[] {new Cookie("OM_SESSION", "invalid")});

    Optional<String> result = SessionCookieUtil.getSessionId(request);

    assertTrue(result.isEmpty());
  }

  @Test
  void clearSessionCookie_setsMaxAgeToZeroAndExpiresHeader() {
    SessionCookieUtil.clearSessionCookie(request, response, authConfig);

    String cookie = captureSetCookieHeader();
    assertTrue(cookie.contains("Max-Age=0"));
    assertTrue(cookie.contains("Expires=Thu, 01 Jan 1970 00:00:00 GMT"));
    assertTrue(cookie.startsWith("OM_SESSION=;"));
  }

  @Test
  void writeSessionCookie_forceSecureSessionCookie_containsSecureAndSameSiteNone() {
    when(request.isSecure()).thenReturn(false);
    when(authConfig.getForceSecureSessionCookie()).thenReturn(true);

    SessionCookieUtil.writeSessionCookie(request, response, authConfig, "session-value", 3600);

    String cookie = captureSetCookieHeader();
    assertTrue(cookie.contains("Secure"));
    assertTrue(cookie.contains("SameSite=None"));
  }

  @Test
  void isValidSessionId_acceptsValid43CharAlphanumericWithDashUnderscore() {
    assertTrue(SessionCookieUtil.isValidSessionId("A".repeat(43)));
    assertTrue(SessionCookieUtil.isValidSessionId("abcdefghijklmnopqrstuvwxyz01234567890_-ABCD"));
  }

  @Test
  void isValidSessionId_rejectsInvalidFormats() {
    assertFalse(SessionCookieUtil.isValidSessionId(null));
    assertFalse(SessionCookieUtil.isValidSessionId(""));
    assertFalse(SessionCookieUtil.isValidSessionId("short"));
    assertFalse(SessionCookieUtil.isValidSessionId("A".repeat(42)));
    assertFalse(SessionCookieUtil.isValidSessionId("A".repeat(44)));
    assertFalse(SessionCookieUtil.isValidSessionId("A".repeat(42) + "!"));
  }

  private String captureSetCookieHeader() {
    ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
    verify(response).addHeader(eq("Set-Cookie"), captor.capture());
    return captor.getValue();
  }
}
