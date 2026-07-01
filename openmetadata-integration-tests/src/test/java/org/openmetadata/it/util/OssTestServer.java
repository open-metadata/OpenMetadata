package org.openmetadata.it.util;

import java.net.URI;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.server.ServerHandle;

/**
 * Builds a {@link ServerHandle} backed by the embedded OpenMetadata test stack.
 *
 * <p>{@code TestSuiteBootstrap} is registered as a JUnit {@code LauncherSessionListener}
 * via the test-jar's {@code META-INF/services/} entry, so the stack is up by the time
 * any test class is loaded. This helper just gathers the connection details into a handle.
 *
 * <p>When {@code OM_URL} + {@code OM_ADMIN_TOKEN} are set, this delegates to {@link
 * UiTestServer#get()} so the {@code tests/search/*IT} and scale suites run against the same
 * external cluster as the UI scenarios (no embedded bootstrap). {@code SearchClient} then routes
 * index introspection through the server's admin endpoints ({@code /v1/search/stats} and
 * {@code /v1/system/search/*}).
 */
public final class OssTestServer {

  private OssTestServer() {}

  public static ServerHandle defaultHandle() {
    final ServerHandle handle;
    if (isExternalMode()) {
      handle = UiTestServer.get();
    } else {
      handle =
          new ServerHandle(
              URI.create(TestSuiteBootstrap.getBaseUrl() + "/api"),
              SdkClients.adminClient(),
              TestSuiteBootstrap.getSearchHost(),
              TestSuiteBootstrap.getSearchPort(),
              TestSuiteBootstrap.getSearchScheme());
    }
    return handle;
  }

  /**
   * Whether the suite is wired to a remote cluster — both {@code OM_URL} and {@code OM_ADMIN_TOKEN}
   * present, via env var <b>or</b> system property. Tests that are embedded-only must gate on this
   * (not a bare {@code System.getenv("OM_URL")}) so they skip correctly when external mode is
   * selected with {@code -DOM_URL=...}.
   */
  public static boolean isExternalMode() {
    return lookup("OM_URL") != null && lookup("OM_ADMIN_TOKEN") != null;
  }

  private static String lookup(final String name) {
    final String env = System.getenv(name);
    if (env != null && !env.isBlank()) {
      return env;
    }
    final String prop = System.getProperty(name);
    return (prop != null && !prop.isBlank()) ? prop : null;
  }
}
