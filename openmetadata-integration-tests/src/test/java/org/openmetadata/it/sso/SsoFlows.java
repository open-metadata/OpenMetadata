package org.openmetadata.it.sso;

import java.net.URI;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.browser.SsoNavigation;
import org.openmetadata.it.sso.browser.SsoNavigation.Hop;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.state.StoredSessions;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

/** The steps of a browser login against the server under test, and what a test checks after. */
public final class SsoFlows {
  public static final String SESSION_COOKIE = "OM_SESSION";
  public static final String ID_TOKEN = "id_token";
  private static final int SERVER_ERROR = 500;

  private SsoFlows() {}

  /** Starts a server-driven login and follows it until the single-page app takes over. */
  public static SsoNavigation login(SsoBrowser browser) {
    return browser.navigate(SsoServer.loginUrl());
  }

  /** Starts a login and stops just before the identity provider's redirect reaches the server. */
  public static URI loginUpToCallback(SsoBrowser browser) {
    return browser
        .navigate(SsoServer.loginUrl(), SsoBrowser.pathIs(SsoServer.CALLBACK_PATH))
        .requirePendingUrl();
  }

  public static String idTokenFrom(SsoNavigation navigation) {
    return navigation
        .fragmentParameter(ID_TOKEN)
        .orElseThrow(
            () -> new AssertionError("No ID token reached the app:\n" + navigation.describe()));
  }

  public static Optional<String> sessionId(SsoBrowser browser) {
    return browser.cookies().value(SESSION_COOKIE);
  }

  public static UserSession requireActiveSession(SsoBrowser browser) {
    String sessionId =
        sessionId(browser).orElseThrow(() -> new AssertionError("The browser holds no session"));
    UserSession session = StoredSessions.require(sessionId);
    if (session.getStatus() != SessionStatus.ACTIVE) {
      throw new AssertionError("Session " + sessionId + " is " + session.getStatus());
    }
    return session;
  }

  /**
   * The callback refused the login for {@code reason}, and {@link #assertLoginRefused} holds. The
   * callback answers such a refusal with a 500 whose body names the reason, so a server error with
   * another cause does not pass for a refusal.
   */
  public static void assertCallbackRefused(
      SsoBrowser browser, SsoNavigation navigation, String reason) {
    Hop last = navigation.last();
    boolean isRefusal =
        SsoServer.CALLBACK_PATH.equals(last.url().getPath())
            && last.status() == SERVER_ERROR
            && last.body().contains(reason);
    if (!isRefusal) {
      throw new AssertionError(
          "Expected the callback to refuse the login with \""
              + reason
              + "\":\n"
              + navigation.describe()
              + "\n"
              + last.body());
    }
    assertLoginRefused(browser, navigation);
  }

  /** The browser ended without a token, and the session its cookie names (if any) is not live. */
  public static void assertLoginRefused(SsoBrowser browser, SsoNavigation navigation) {
    if (navigation.fragmentParameter(ID_TOKEN).isPresent()) {
      throw new AssertionError("The login was expected to fail:\n" + navigation.describe());
    }
    sessionId(browser)
        .flatMap(StoredSessions::find)
        .filter(session -> session.getStatus() == SessionStatus.ACTIVE)
        .ifPresent(
            session -> {
              throw new AssertionError(
                  "A refused login left session " + session.getId() + " ACTIVE");
            });
  }

  public static HttpResponse<String> loggedInUser(SsoBrowser browser, String bearerToken) {
    return browser.getWithBearer(SsoServer.url(SsoServer.LOGGED_IN_USER_PATH), bearerToken);
  }

  /** {@code url} with its query parameters rewritten by {@code edit}, e.g. to tamper with them. */
  public static String editQuery(URI url, Consumer<Map<String, String>> edit) {
    Map<String, String> parameters = new LinkedHashMap<>(MockHttp.decode(url.getRawQuery()));
    edit.accept(parameters);
    String base = url.getScheme() + "://" + url.getRawAuthority() + url.getRawPath();
    return MockHttp.withQuery(base, parameters);
  }
}
