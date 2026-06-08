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
 */
public final class OssTestServer {

  private OssTestServer() {}

  public static ServerHandle defaultHandle() {
    return new ServerHandle(
        URI.create(TestSuiteBootstrap.getBaseUrl() + "/api"),
        SdkClients.adminClient(),
        TestSuiteBootstrap.getSearchHost(),
        TestSuiteBootstrap.getSearchPort(),
        TestSuiteBootstrap.getSearchScheme());
  }
}
