package org.openmetadata.it.sso.config;

import java.util.Map;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.sso.MockHttp;

/** URLs of the embedded server under test, which listens on an ephemeral port. */
public final class SsoServer {
  public static final String CALLBACK_PATH = "/callback";
  public static final String SPA_CALLBACK_PATH = "/auth/callback";
  public static final String LOGIN_PATH = "/api/v1/auth/login";
  public static final String REFRESH_PATH = "/api/v1/auth/refresh";
  public static final String LOGOUT_PATH = "/api/v1/auth/logout";
  public static final String LOGGED_IN_USER_PATH = "/api/v1/users/loggedInUser";
  private static final String REDIRECT_URI = "redirectUri";

  private SsoServer() {}

  public static String root() {
    return TestSuiteBootstrap.getBaseUrl();
  }

  public static String url(String path) {
    return root() + path;
  }

  /** Where the single-page app starts a server-driven login, returning to its own callback. */
  public static String loginUrl() {
    return MockHttp.withQuery(url(LOGIN_PATH), Map.of(REDIRECT_URI, url(SPA_CALLBACK_PATH)));
  }
}
