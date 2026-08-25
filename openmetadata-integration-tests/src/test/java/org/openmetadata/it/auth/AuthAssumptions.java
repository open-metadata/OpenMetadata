package org.openmetadata.it.auth;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Utility for sign-in flow tests that are only meaningful under specific auth backends.
 *
 * <p>The whole UI suite can be run under any {@code jpw.auth} backend with a single Maven
 * command. Auth-mode-specific tests (e.g. a {@code GoogleSsoSignInUIIT} that drives the
 * Google login button) call {@link #onlyWhenBackendIs} so they skip with an
 * {@code Assumption} rather than fail when the suite is running under a different
 * backend.
 */
public final class AuthAssumptions {

  private AuthAssumptions() {}

  /**
   * Skip the current test unless the active backend's name matches one of the supplied
   * names. Names are compared case-insensitively against {@link AuthBackend#name()}.
   */
  public static void onlyWhenBackendIs(final String... backendNames) {
    final List<String> wanted =
        Arrays.stream(backendNames).map(name -> name.toLowerCase(Locale.ROOT)).toList();
    final String actual = AuthSession.backend().name().toLowerCase(Locale.ROOT);
    assumeTrue(
        wanted.contains(actual),
        () ->
            "Test only runs under jpw.auth in " + wanted + "; current backend is '" + actual + "'");
  }
}
