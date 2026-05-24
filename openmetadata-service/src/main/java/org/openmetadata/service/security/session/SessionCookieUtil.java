package org.openmetadata.service.security.session;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.Optional;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;

public final class SessionCookieUtil {
  public static final String COOKIE_NAME = "OM_SESSION";
  private static final Pattern SESSION_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43}$");

  private SessionCookieUtil() {}

  public static Optional<String> getSessionId(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) {
      return Optional.empty();
    }

    return Arrays.stream(cookies)
        .filter(cookie -> COOKIE_NAME.equals(cookie.getName()))
        .map(Cookie::getValue)
        .filter(SessionCookieUtil::isValidSessionId)
        .findFirst();
  }

  static boolean isValidSessionId(String value) {
    return value != null && SESSION_ID_PATTERN.matcher(value).matches();
  }

  public static void writeSessionCookie(
      HttpServletRequest request,
      HttpServletResponse response,
      AuthenticationConfiguration authConfig,
      String sessionId,
      int maxAgeSeconds) {
    response.addHeader(
        "Set-Cookie", buildCookie(request, authConfig, sessionId, maxAgeSeconds, false));
  }

  public static void clearSessionCookie(
      HttpServletRequest request,
      HttpServletResponse response,
      AuthenticationConfiguration authConfig) {
    response.addHeader("Set-Cookie", buildCookie(request, authConfig, "", 0, true));
  }

  private static String buildCookie(
      HttpServletRequest request,
      AuthenticationConfiguration authConfig,
      String value,
      int maxAgeSeconds,
      boolean expired) {
    boolean forceSecure =
        authConfig != null && Boolean.TRUE.equals(authConfig.getForceSecureSessionCookie());
    boolean secure = request.isSecure() || forceSecure;
    String sameSite = secure ? "None" : "Lax";
    StringBuilder cookie = new StringBuilder();
    cookie.append(COOKIE_NAME).append('=').append(value).append("; Path=/; HttpOnly; Max-Age=");
    cookie.append(maxAgeSeconds).append("; SameSite=").append(sameSite);
    if (expired) {
      cookie.append("; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    }
    if (secure) {
      cookie.append("; Secure");
    }
    return cookie.toString();
  }
}
