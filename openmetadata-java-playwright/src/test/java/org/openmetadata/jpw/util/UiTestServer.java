package org.openmetadata.jpw.util;

import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.jpw.server.ContainerizedServer;
import org.openmetadata.jpw.server.ExternalServer;
import org.openmetadata.jpw.server.ServerHandle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Resolves a {@link ServerHandle} for UI scenarios. Transparent to the test — auto-picks
 * the right mode based on what's configured:
 *
 * <ul>
 *   <li>If {@code OM_URL} and {@code OM_ADMIN_TOKEN} are set → connect to that running stack
 *       ({@link ExternalServer}). Use this when iterating against {@code ./docker/run_local_docker.sh}.
 *   <li>Otherwise → build the OM server image from the local dist tarball, spin up
 *       MySQL + OpenSearch + server via Testcontainers ({@link ContainerizedServer}). This
 *       is the default; {@code mvn verify -Dit.test='*UIIT'} just works.
 * </ul>
 *
 * <p>The handle is cached for the JVM lifetime; the first test triggers the boot and a
 * shutdown hook tears the stack down at session end.
 */
public final class UiTestServer {

  private static final Logger LOG = LoggerFactory.getLogger(UiTestServer.class);
  private static final long ADMIN_TOKEN_TTL_SECONDS = 24L * 60 * 60;

  private static volatile ServerHandle cached;
  private static volatile ContainerizedServer ownedContainer;

  private UiTestServer() {}

  public static synchronized ServerHandle get() {
    if (cached != null) {
      return cached;
    }
    if (hasExternalConfig()) {
      LOG.info("UI test mode: external (OM_URL + OM_ADMIN_TOKEN detected)");
      cached = ExternalServer.fromEnv();
      return cached;
    }
    LOG.info("UI test mode: containerized (building local image)");
    ownedContainer = ContainerizedServer.launch();
    final String adminJwt =
        JwtAuthProvider.tokenFor(
            "admin@open-metadata.org",
            "admin@open-metadata.org",
            new String[] {"admin"},
            ADMIN_TOKEN_TTL_SECONDS);
    cached = ownedContainer.handle(adminJwt);
    Runtime.getRuntime()
        .addShutdownHook(new Thread(UiTestServer::tearDown, "UiTestServer-cleanup"));
    return cached;
  }

  private static void tearDown() {
    if (ownedContainer != null) {
      ownedContainer.close();
    }
  }

  private static boolean hasExternalConfig() {
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
