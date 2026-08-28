package org.openmetadata.it.server.sso;

import com.github.dockerjava.api.model.ExposedPort;
import com.github.dockerjava.api.model.PortBinding;
import com.github.dockerjava.api.model.Ports;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.net.UnknownHostException;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.output.Slf4jLogConsumer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * A {@code navikt/mock-oauth2-server} container wired into the OM Docker network.
 *
 * <p>Issues OIDC tokens for tests of OM's Google / Okta / custom-OIDC auth flows. The same
 * URL — {@code http://om-mock-idp:1080/<issuer>} — is used by the OM container, the
 * Playwright browser, and the {@code iss} claim in issued tokens, so token validation,
 * browser redirects, and discovery all line up against a single source of truth.
 *
 * <p>Achieving that single URL requires the host to resolve {@code om-mock-idp} to
 * loopback. Add this line to {@code /etc/hosts} once per machine (CI workflow does it
 * automatically):
 *
 * <pre>{@code
 *   127.0.0.1 om-mock-idp
 * }</pre>
 *
 * <p>If the host entry is missing, {@link #launch(Network)} throws with a clear message.
 */
public final class MockOidcServer implements AutoCloseable {

  private static final Logger LOG = LoggerFactory.getLogger(MockOidcServer.class);

  public static final String NETWORK_ALIAS = "om-mock-idp";

  /**
   * Host/container port for the mock IdP. The same value must be reachable from the OM
   * container, the host-side Playwright browser, AND match the {@code iss} claim baked
   * into tokens, so a single shared port is unavoidable. Override via system property
   * {@code -Dom.mockOidc.port=NNNN} to side-step host port conflicts (e.g. for parallel
   * CI shards).
   */
  public static final int PORT = Integer.getInteger("om.mockOidc.port", 1080);

  private static final String IMAGE = "ghcr.io/navikt/mock-oauth2-server:2.1.10";
  private static final Duration STARTUP_TIMEOUT = Duration.ofMinutes(2);

  private final GenericContainer<?> container;

  private MockOidcServer(final GenericContainer<?> container) {
    this.container = container;
  }

  public static MockOidcServer launch(final Network network) {
    verifyHostEntry();
    verifyPortAvailable();
    final GenericContainer<?> container =
        new GenericContainer<>(DockerImageName.parse(IMAGE))
            .withNetwork(network)
            .withNetworkAliases(NETWORK_ALIAS)
            .withEnv("SERVER_PORT", String.valueOf(PORT))
            .withExposedPorts(PORT)
            .withCreateContainerCmdModifier(
                cmd ->
                    cmd.getHostConfig()
                        .withPortBindings(
                            new PortBinding(Ports.Binding.bindPort(PORT), new ExposedPort(PORT))))
            .waitingFor(
                Wait.forHttp("/default/.well-known/openid-configuration")
                    .forPort(PORT)
                    .withStartupTimeout(STARTUP_TIMEOUT))
            .withLogConsumer(
                new Slf4jLogConsumer(LoggerFactory.getLogger("om-mock-idp"))
                    .withSeparateOutputStreams());
    container.start();
    LOG.info("MockOidcServer ready at {}", externalUrl(""));
    return new MockOidcServer(container);
  }

  /** URL of an issuer hosted by this server. {@code issuerId} is its first path segment. */
  public URI issuerUrl(final String issuerId) {
    return URI.create(externalUrl("/" + issuerId));
  }

  /** OIDC discovery URL for the given issuer. */
  public URI discoveryUrl(final String issuerId) {
    return URI.create(externalUrl("/" + issuerId + "/.well-known/openid-configuration"));
  }

  /** JWKS URL for the given issuer. */
  public URI jwksUrl(final String issuerId) {
    return URI.create(externalUrl("/" + issuerId + "/jwks"));
  }

  @Override
  public void close() {
    container.stop();
  }

  private static String externalUrl(final String path) {
    return "http://" + NETWORK_ALIAS + ":" + PORT + path;
  }

  private static void verifyPortAvailable() {
    try (ServerSocket probe = new ServerSocket(PORT)) {
      probe.setReuseAddress(true);
    } catch (IOException e) {
      throw new IllegalStateException(
          "Host port "
              + PORT
              + " is already in use; cannot bind mock IdP container. Stop the conflicting"
              + " process or override the port with -Dom.mockOidc.port=NNNN.",
          e);
    }
  }

  private static void verifyHostEntry() {
    try {
      final InetAddress addr = InetAddress.getByName(NETWORK_ALIAS);
      if (!addr.isLoopbackAddress()) {
        throw new IllegalStateException(
            "Hostname '"
                + NETWORK_ALIAS
                + "' resolves to "
                + addr.getHostAddress()
                + " but must resolve to a loopback address. Replace any existing entry in"
                + " /etc/hosts with:\n\n  127.0.0.1 "
                + NETWORK_ALIAS
                + "\n");
      }
    } catch (UnknownHostException e) {
      throw new IllegalStateException(
          "Hostname '"
              + NETWORK_ALIAS
              + "' does not resolve. Add this line to /etc/hosts and re-run:\n\n  127.0.0.1 "
              + NETWORK_ALIAS
              + "\n",
          e);
    }
  }
}
