package org.openmetadata.it.server;

import com.github.dockerjava.api.model.ExposedPort;
import com.github.dockerjava.api.model.HealthCheck;
import com.github.dockerjava.api.model.PortBinding;
import com.github.dockerjava.api.model.Ports;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.openmetadata.it.server.sso.SsoProfile;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.opensearch.testcontainers.OpensearchContainer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.output.Slf4jLogConsumer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

/**
 * Launches a production-style OpenMetadata stack in Docker via Testcontainers: MySQL +
 * OpenSearch + the {@code openmetadata/server} image. Unlike the in-JVM embedded path,
 * the server image bundles the UI assets, so Playwright UI scenarios can drive a real
 * browser against {@code /}.
 *
 * <p>Image source, in order of precedence:
 * <ol>
 *   <li>{@code OM_TEST_IMAGE} env var or system property — pre-built tag, e.g.
 *       {@code openmetadata/server:1.11.4}. No build performed.
 *   <li>Default — builds {@code openmetadata-server:jpw-snapshot} from the local
 *       {@code docker/development/Dockerfile} and the dist tarball at
 *       {@code openmetadata-dist/target/openmetadata-{version}.tar.gz}. Subsequent runs
 *       reuse the Docker layer cache and finish in seconds.
 * </ol>
 *
 * <p>JWT auth: the server is configured with {@code JWT_KEY_ID=test-key} and the test
 * {@code public_key.der} is mounted at {@code /opt/openmetadata/conf/public_key.der}, so
 * tokens minted by {@code JwtAuthProvider.tokenFor(...)} (which signs with the matching
 * {@code private_key.der}) validate against the server's JWKS without further wiring.
 */
public final class ContainerizedServer implements AutoCloseable {

  private static final Logger LOG = LoggerFactory.getLogger(ContainerizedServer.class);

  private static final String DB_ALIAS = "om-mysql";
  private static final String SEARCH_ALIAS = "om-opensearch";
  private static final String DEFAULT_LOCAL_IMAGE_TAG = "openmetadata-server:jpw-snapshot";
  private static final String DB_USER = "openmetadata_user";
  private static final String DB_PASSWORD = "openmetadata_password";
  private static final String DB_NAME = "openmetadata_db";
  private static final String JWT_KEY_ID = "test-key";
  private static final int SERVER_PORT = 8585;
  private static final int SEARCH_PORT = 9200;
  private static final int FIXED_OM_HOST_PORT = 8585;
  private static final Duration SERVER_STARTUP_TIMEOUT = Duration.ofMinutes(5);

  private final Network network;
  private final MySQLContainer<?> mysql;
  private final OpensearchContainer<?> opensearch;
  private final GenericContainer<?> server;
  private final MockOidcServer ssoIdp;

  private ContainerizedServer(
      final Network network,
      final MySQLContainer<?> mysql,
      final OpensearchContainer<?> opensearch,
      final GenericContainer<?> server,
      final MockOidcServer ssoIdp) {
    this.network = network;
    this.mysql = mysql;
    this.opensearch = opensearch;
    this.server = server;
    this.ssoIdp = ssoIdp;
  }

  /** Launches OM with the default basic-auth (JWT) configuration. */
  public static ContainerizedServer launch() {
    return launch(null);
  }

  /**
   * Launches OM wired to a {@link MockOidcServer} per the given SSO profile.
   *
   * <p>SSO mode binds the OM container to a fixed host port ({@link #FIXED_OM_HOST_PORT})
   * because the OIDC callback URL must be known before the server starts. Only one SSO
   * mode test JVM can run at a time on a host (acceptable since SSO suite runs are
   * explicit, not bulk parallel).
   */
  public static ContainerizedServer launch(final SsoProfile profile) {
    // Materialise the server image once, BEFORE runMigrations needs it. Without this,
    // runMigrations tries to start a container using the jpw-snapshot tag, testcontainers
    // attempts a registry pull, and the run fails with ContainerFetchException.
    ensureServerImageAvailable();
    final Network network = Network.newNetwork();
    final MySQLContainer<?> mysql = newMysql(network);
    final OpensearchContainer<?> opensearch = newOpenSearch(network);
    mysql.start();
    opensearch.start();
    runMigrations(network);
    final MockOidcServer idp = (profile != null) ? MockOidcServer.launch(network) : null;
    final GenericContainer<?> server = newServer(network);
    if (profile != null) {
      applySsoEnv(server, profile, idp);
      bindFixedHostPort(server, FIXED_OM_HOST_PORT, SERVER_PORT);
    }
    server.start();
    LOG.info(
        "Containerized OpenMetadata ready at http://{}:{} (sso={})",
        server.getHost(),
        server.getMappedPort(SERVER_PORT),
        profile != null ? profile.displayName() : "off");
    return new ContainerizedServer(network, mysql, opensearch, server, idp);
  }

  private static void applySsoEnv(
      final GenericContainer<?> server, final SsoProfile profile, final MockOidcServer idp) {
    final Map<String, String> env = profile.serverEnv(idp, FIXED_OM_HOST_PORT);
    env.forEach(server::withEnv);
  }

  private static void bindFixedHostPort(
      final GenericContainer<?> container, final int hostPort, final int containerPort) {
    container.withCreateContainerCmdModifier(
        cmd ->
            cmd.getHostConfig()
                .withPortBindings(
                    new PortBinding(
                        Ports.Binding.bindPort(hostPort), new ExposedPort(containerPort))));
  }

  /**
   * Runs Flyway + native migrations once via a transient container, mirroring the
   * {@code execute-migrate-all} step in {@code docker/development/docker-compose.yml}. The
   * server image expects the schema to already exist; without this the server crashes on
   * boot looking for {@code ACT_GE_PROPERTY} and {@code openmetadata_settings}.
   */
  private static void runMigrations(final Network network) {
    final String image = resolveImageTag();
    LOG.info("Running OpenMetadata schema migrations against {}", DB_NAME);
    try (GenericContainer<?> migrate =
        new GenericContainer<>(
                DockerImageName.parse(image).asCompatibleSubstituteFor("openmetadata-server"))
            .withNetwork(network)
            .withCommand("./bootstrap/openmetadata-ops.sh", "-d", "migrate", "--force")
            .withStartupCheckStrategy(
                new org.testcontainers.containers.startupcheck.OneShotStartupCheckStrategy()
                    .withTimeout(Duration.ofMinutes(5)))
            .withLogConsumer(
                new Slf4jLogConsumer(LoggerFactory.getLogger("om-migrate"))
                    .withSeparateOutputStreams())) {
      applyServerEnv(migrate);
      migrate.start();
      LOG.info("Migrations completed");
    }
  }

  private static String resolveImageTag() {
    final String override = lookupEnvOrSystem("OM_TEST_IMAGE");
    return (override != null && !override.isBlank()) ? override : DEFAULT_LOCAL_IMAGE_TAG;
  }

  public ServerHandle handle(final String adminJwt) {
    final URI base =
        URI.create("http://" + server.getHost() + ":" + server.getMappedPort(SERVER_PORT) + "/api");
    final OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .serverUrl(base.toString())
            .accessToken(adminJwt)
            .readTimeout(120000)
            .writeTimeout(120000)
            .build();
    return new ServerHandle(
        base,
        new OpenMetadataClient(config),
        opensearch.getHost(),
        opensearch.getMappedPort(SEARCH_PORT),
        "http");
  }

  public URI uiUrl() {
    return URI.create("http://" + server.getHost() + ":" + server.getMappedPort(SERVER_PORT));
  }

  /** The mock OIDC server bundled with this stack, or {@code null} in basic-auth mode. */
  public MockOidcServer ssoIdp() {
    return ssoIdp;
  }

  @Override
  public void close() {
    final Stream.Builder<Runnable> closers = Stream.builder();
    closers.add(server::stop);
    if (ssoIdp != null) {
      closers.add(ssoIdp::close);
    }
    closers.add(opensearch::stop);
    closers.add(mysql::stop);
    closers.add(network::close);
    closers.build().forEach(ContainerizedServer::silently);
  }

  private static MySQLContainer<?> newMysql(final Network network) {
    return new MySQLContainer<>(DockerImageName.parse("mysql:8.3.0"))
        .withNetwork(network)
        .withNetworkAliases(DB_ALIAS)
        .withDatabaseName(DB_NAME)
        .withUsername(DB_USER)
        .withPassword(DB_PASSWORD)
        .withCommand(
            "--character-set-server=utf8mb4",
            "--collation-server=utf8mb4_unicode_ci",
            "--max_allowed_packet=64M");
  }

  private static OpensearchContainer<?> newOpenSearch(final Network network) {
    return new OpensearchContainer<>("opensearchproject/opensearch:3.4.0")
        .withNetwork(network)
        .withNetworkAliases(SEARCH_ALIAS)
        .withEnv("discovery.type", "single-node")
        .withEnv("DISABLE_SECURITY_PLUGIN", "true")
        .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
        // OpenSearch defaults max_clause_count to 1024 — too low for OM's wider boolean
        // queries (e.g. tag-rule resolution, multi-entity aggregations). 4096 matches
        // Elasticsearch's modern default and OM's own dev docker-compose.
        .withEnv("indices.query.bool.max_clause_count", "4096")
        .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms1g -Xmx1g")
        .withStartupAttempts(3);
  }

  private static GenericContainer<?> newServer(final Network network) {
    final String override = lookupEnvOrSystem("OM_TEST_IMAGE");
    final GenericContainer<?> container =
        (override != null && !override.isBlank())
            ? buildPrebuiltImageContainer(override)
            : buildLocalImageContainer();
    configureServer(container, network);
    return container;
  }

  private static GenericContainer<?> buildPrebuiltImageContainer(final String tag) {
    LOG.info("ContainerizedServer using image override: {}", tag);
    return new GenericContainer<>(
        DockerImageName.parse(tag).asCompatibleSubstituteFor("openmetadata-server"));
  }

  private static GenericContainer<?> buildLocalImageContainer() {
    // Image is materialised by ensureServerImageAvailable() at launch start; this just
    // wraps the already-built tag in a fresh GenericContainer.
    return new GenericContainer<>(
        DockerImageName.parse(DEFAULT_LOCAL_IMAGE_TAG)
            .asCompatibleSubstituteFor("openmetadata-server"));
  }

  /**
   * Materialise the server image so {@link #runMigrations} (which creates a transient
   * container before {@link #newServer} runs) doesn't try to pull
   * {@code openmetadata-server:jpw-snapshot} from a remote registry.
   *
   * <p>If {@code OM_TEST_IMAGE} is set we trust the override and skip the local build —
   * testcontainers will pull or use the already-loaded image.
   */
  private static void ensureServerImageAvailable() {
    final String override = lookupEnvOrSystem("OM_TEST_IMAGE");
    if (override != null && !override.isBlank()) {
      LOG.info("Skipping local image build — using OM_TEST_IMAGE override: {}", override);
      return;
    }
    locateDistTarball();
    buildLocalImageWithBuildKit();
  }

  private static void buildLocalImageWithBuildKit() {
    final Path root = repoRoot();
    LOG.info(
        "ContainerizedServer building image {} via `docker build` (BuildKit) from {}",
        DEFAULT_LOCAL_IMAGE_TAG,
        root);
    final ProcessBuilder pb =
        new ProcessBuilder(
                "docker",
                "build",
                "-t",
                DEFAULT_LOCAL_IMAGE_TAG,
                "-f",
                root.resolve("docker").resolve("development").resolve("Dockerfile").toString(),
                root.toString())
            .redirectErrorStream(true);
    pb.environment().put("DOCKER_BUILDKIT", "1");
    runOrThrow(pb, "docker build for " + DEFAULT_LOCAL_IMAGE_TAG);
  }

  private static void runOrThrow(final ProcessBuilder pb, final String label) {
    try {
      final Process process = pb.start();
      try (var reader =
          new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()))) {
        String line;
        while ((line = reader.readLine()) != null) {
          LOG.info("[{}] {}", label, line);
        }
      }
      final int exit = process.waitFor();
      if (exit != 0) {
        throw new IllegalStateException(label + " failed with exit code " + exit);
      }
    } catch (IOException e) {
      throw new IllegalStateException(label + " failed", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(label + " was interrupted", e);
    }
  }

  private static void configureServer(final GenericContainer<?> container, final Network network) {
    container.withNetwork(network).withExposedPorts(SERVER_PORT);
    applyServerEnv(container);
    container
        .withCopyFileToContainer(
            MountableFile.forClasspathResource("private_key.der"),
            "/opt/openmetadata/conf/private_key.der")
        .withCopyFileToContainer(
            MountableFile.forClasspathResource("public_key.der"),
            "/opt/openmetadata/conf/public_key.der")
        .waitingFor(
            Wait.forHttp("/api/v1/system/version")
                .forPort(SERVER_PORT)
                .withStartupTimeout(SERVER_STARTUP_TIMEOUT))
        .withLogConsumer(
            new Slf4jLogConsumer(LoggerFactory.getLogger("om-server-container"))
                .withSeparateOutputStreams());
    container.withCreateContainerCmdModifier(
        cmd -> cmd.withHealthcheck(new HealthCheck().withTest(List.of("NONE"))));
  }

  private static void applyServerEnv(final GenericContainer<?> container) {
    container
        .withEnv("DB_HOST", DB_ALIAS)
        .withEnv("DB_PORT", "3306")
        .withEnv("DB_USER", DB_USER)
        .withEnv("DB_USER_PASSWORD", DB_PASSWORD)
        .withEnv("OM_DATABASE", DB_NAME)
        .withEnv("DB_SCHEME", "mysql")
        .withEnv("DB_DRIVER_CLASS", "com.mysql.cj.jdbc.Driver")
        .withEnv("DB_PARAMS", "allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC")
        .withEnv("ELASTICSEARCH_HOST", SEARCH_ALIAS)
        .withEnv("ELASTICSEARCH_PORT", "9200")
        .withEnv("ELASTICSEARCH_SCHEME", "http")
        .withEnv("SEARCH_TYPE", "opensearch")
        .withEnv("AUTHENTICATION_PROVIDER", "basic")
        .withEnv(
            "AUTHENTICATION_PUBLIC_KEYS",
            "[http://localhost:" + SERVER_PORT + "/api/v1/system/config/jwks]")
        .withEnv("AUTHORIZER_ADMIN_PRINCIPALS", "[admin]")
        .withEnv("AUTHORIZER_PRINCIPAL_DOMAIN", "open-metadata.org")
        .withEnv("RSA_PUBLIC_KEY_FILE_PATH", "./conf/public_key.der")
        .withEnv("RSA_PRIVATE_KEY_FILE_PATH", "./conf/private_key.der")
        .withEnv("JWT_ISSUER", "open-metadata.org")
        .withEnv("JWT_KEY_ID", JWT_KEY_ID);
  }

  private static Path locateDistTarball() {
    final Path distTarget = repoRoot().resolve("openmetadata-dist").resolve("target");
    if (!Files.isDirectory(distTarget)) {
      throw new IllegalStateException(
          "openmetadata-dist/target/ does not exist. Run `mvn install -pl :openmetadata-dist -am` "
              + "or `mvn install -pl :openmetadata-java-playwright -am` first.");
    }
    try (Stream<Path> stream = Files.list(distTarget)) {
      return stream
          .filter(p -> p.getFileName().toString().matches("openmetadata-.*\\.tar\\.gz"))
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalStateException(
                      "No openmetadata-*.tar.gz found in "
                          + distTarget
                          + ". Build openmetadata-dist first."));
    } catch (IOException e) {
      throw new IllegalStateException("Failed listing " + distTarget, e);
    }
  }

  private static Path repoRoot() {
    Path candidate = Paths.get("").toAbsolutePath();
    for (int i = 0; i < 6; i++) {
      if (Files.isDirectory(candidate.resolve("openmetadata-dist"))
          && Files.isRegularFile(candidate.resolve("pom.xml"))) {
        return candidate;
      }
      candidate = candidate.getParent();
      if (candidate == null) {
        break;
      }
    }
    throw new IllegalStateException(
        "Could not locate the OpenMetadata repo root from "
            + Paths.get("").toAbsolutePath()
            + " (looking for an `openmetadata-dist` sibling).");
  }

  private static String lookupEnvOrSystem(final String name) {
    final String env = System.getenv(name);
    if (env != null && !env.isBlank()) {
      return env;
    }
    return System.getProperty(name);
  }

  private static void silently(final Runnable action) {
    try {
      action.run();
    } catch (RuntimeException e) {
      LOG.warn("Cleanup step failed: {}", e.getMessage());
    }
  }
}
