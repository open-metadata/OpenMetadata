package org.openmetadata.it.env;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import jakarta.validation.Validator;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.file.Files;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.time.Duration;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;
import org.flywaydb.core.Flyway;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRepositoryFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.utility.DockerImageName;

public class TestSuiteBootstrap implements LauncherSessionListener {
  private static final Logger LOG = LoggerFactory.getLogger(TestSuiteBootstrap.class);
  private static final AtomicBoolean STARTED = new AtomicBoolean(false);
  private static PostgreSQLContainer<?> POSTGRES;
  private static ElasticsearchContainer ELASTIC;
  private static GenericContainer<?> RDF_CONTAINER;
  private static DropwizardAppExtension<OpenMetadataApplicationConfig> APP;

  @Override
  public void launcherSessionOpened(LauncherSession session) {
    if (!STARTED.compareAndSet(false, true)) return;

    POSTGRES = new PostgreSQLContainer<>(DockerImageName.parse("postgres:15"));
    POSTGRES.withStartupTimeout(Duration.ofMinutes(3));
    // Give container more memory to prevent crashes under parallel load
    POSTGRES.withCreateContainerCmdModifier(
        cmd -> {
          cmd.getHostConfig()
              .withMemory(2048L * 1024 * 1024) // 2GB memory limit
              .withMemorySwap(4096L * 1024 * 1024); // 4GB memory+swap
        });
    // Increase PostgreSQL resources for parallel test execution
    // Must support connection pool (180) + overhead for Flowable async jobs
    POSTGRES.withCommand(
        "postgres",
        "-c",
        "max_connections=300",
        "-c",
        "shared_buffers=512MB",
        "-c",
        "effective_cache_size=1024MB",
        "-c",
        "work_mem=16MB",
        "-c",
        "maintenance_work_mem=128MB",
        "-c",
        "max_worker_processes=8",
        "-c",
        "max_parallel_workers_per_gather=2",
        "-c",
        "max_parallel_workers=8");
    POSTGRES.start();

    ELASTIC =
        new ElasticsearchContainer(
            DockerImageName.parse("docker.elastic.co/elasticsearch/elasticsearch:8.11.4"));
    ELASTIC.withEnv("discovery.type", "single-node");
    ELASTIC.withEnv("xpack.security.enabled", "false");
    ELASTIC.start();

    // Start RDF/Fuseki container if enabled
    if ("true".equals(System.getProperty("enableRdf"))) {
      LOG.info("RDF enabled - starting Fuseki container");
      String rdfImage = System.getProperty("rdfContainerImage", "stain/jena-fuseki:latest");
      try {
        RDF_CONTAINER =
            new GenericContainer<>(DockerImageName.parse(rdfImage))
                .withExposedPorts(3030)
                .withEnv("ADMIN_PASSWORD", "test-admin")
                .withEnv("FUSEKI_DATASET_1", "openmetadata")
                .waitingFor(
                    Wait.forHttp("/$/ping")
                        .forPort(3030)
                        .forStatusCode(200)
                        .withStartupTimeout(Duration.ofMinutes(2)));
        RDF_CONTAINER.start();
        LOG.info(
            "Fuseki container started at {}:{}",
            RDF_CONTAINER.getHost(),
            RDF_CONTAINER.getMappedPort(3030));
      } catch (Exception e) {
        LOG.error("Failed to start Fuseki container: {}", e.getMessage(), e);
      }
    }

    try {
      OpenMetadataApplicationConfig cfg = loadBaseConfig();
      cfg.getDataSourceFactory().setDriverClass("org.postgresql.Driver");
      cfg.getDataSourceFactory().setUrl(POSTGRES.getJdbcUrl());
      cfg.getDataSourceFactory().setUser(POSTGRES.getUsername());
      cfg.getDataSourceFactory().setPassword(POSTGRES.getPassword());

      ElasticSearchConfiguration esCfg = new ElasticSearchConfiguration();
      esCfg
          .withHost(ELASTIC.getHost())
          .withPort(ELASTIC.getMappedPort(9200))
          .withScheme("http")
          .withConnectionTimeoutSecs(5)
          .withSocketTimeoutSecs(60)
          .withKeepAliveTimeoutSecs(600)
          .withBatchSize(10)
          .withSearchIndexMappingLanguage(IndexMappingLanguage.EN)
          .withClusterAlias("openmetadata")
          .withSearchType(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
      cfg.setElasticSearchConfiguration(esCfg);

      // Initialize ES index mappings once before creating the search repository
      IndexMappingLoader.init(esCfg);

      // Start a local JWKS server serving our test public key and point auth config to it
      int jwksPort = startLocalJwksServer();
      if (cfg.getAuthenticationConfiguration() != null) {
        cfg.getAuthenticationConfiguration()
            .setPublicKeyUrls(
                java.util.List.of("http://localhost:" + jwksPort + "/.well-known/jwks.json"));
      }

      // Run Flyway migrations on the container database before starting app
      String flywayPath =
          java.nio.file.Paths.get(
                  "..", "bootstrap", "sql", "migrations", "flyway", "org.postgresql.Driver")
              .toAbsolutePath()
              .toString();
      LOG.info("Flyway path: {}", flywayPath);
      Flyway flyway =
          Flyway.configure()
              .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
              .table("DATABASE_CHANGE_LOG")
              .locations("filesystem:" + flywayPath)
              .sqlMigrationPrefix("v")
              .load();
      flyway.migrate();

      // Run system data migrations and seed essential data
      Jdbi jdbi =
          Jdbi.create(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
      jdbi.installPlugin(new SqlObjectPlugin());
      jdbi.getConfig(SqlObjects.class)
          .setSqlLocator(new ConnectionAwareAnnotationSqlLocator("org.postgresql.Driver"));

      ConnectionType connType = ConnectionType.from("org.postgresql.Driver");
      DatasourceConfig.initialize(connType.label);

      SearchRepository searchRepo = SearchRepositoryFactory.createSearchRepository(esCfg, 50);
      Entity.setSearchRepository(searchRepo);
      Entity.setCollectionDAO(jdbi.onDemand(CollectionDAO.class));
      Entity.setJobDAO(jdbi.onDemand(JobDAO.class));
      Entity.initializeRepositories(cfg, jdbi);

      String nativePath =
          java.nio.file.Paths.get("..", "bootstrap", "sql", "migrations", "native")
              .toAbsolutePath()
              .toString();
      LOG.info("Native path: {}", nativePath);
      java.nio.file.Path extPath =
          java.nio.file.Paths.get("..", "extension", "sql", "migrations").toAbsolutePath();
      String extensionPath = Files.exists(extPath) ? extPath.toString() : null;
      LOG.info("Extension path: {}", extensionPath == null ? "<none>" : extensionPath);

      // Provide paths to config as well so the app has them
      if (cfg.getMigrationConfiguration() != null) {
        cfg.getMigrationConfiguration().setFlywayPath(flywayPath);
        cfg.getMigrationConfiguration().setNativePath(nativePath);
        if (extensionPath != null) {
          cfg.getMigrationConfiguration().setExtensionPath(extensionPath);
        }
      }

      MigrationWorkflow workflow =
          new MigrationWorkflow(jdbi, nativePath, connType, extensionPath, flywayPath, cfg, false);
      workflow.loadMigrations();
      workflow.runMigrationWorkflows(false);
      // Let the application handle Settings/Application initialization during startup
      // to avoid double-initialization and validation issues.

      // Initialize RDF if enabled and container started
      if (RDF_CONTAINER != null) {
        LOG.info("Initializing RDF with Fuseki container");
        try {
          org.openmetadata.schema.api.configuration.rdf.RdfConfiguration rdfConfig =
              new org.openmetadata.schema.api.configuration.rdf.RdfConfiguration();
          rdfConfig.setEnabled(true);
          rdfConfig.setStorageType(
              org.openmetadata.schema.api.configuration.rdf.RdfConfiguration.StorageType.FUSEKI);

          String rdfHost = RDF_CONTAINER.getHost();
          Integer rdfPort = RDF_CONTAINER.getMappedPort(3030);
          String endpoint = String.format("http://%s:%d/openmetadata", rdfHost, rdfPort);

          rdfConfig.setRemoteEndpoint(new java.net.URI(endpoint));
          rdfConfig.setUsername("admin");
          rdfConfig.setPassword("test-admin");

          org.openmetadata.service.rdf.RdfUpdater.initialize(rdfConfig);
          LOG.info("RDF initialized successfully at {}", endpoint);
        } catch (Exception e) {
          LOG.error("Failed to initialize RDF: {}", e.getMessage(), e);
        }
      }

      APP = new DropwizardAppExtension<>(OpenMetadataApplication.class, cfg);
      APP.before();

      System.setProperty("IT_BASE_URL", "http://localhost:" + APP.getLocalPort() + "/api");
    } catch (Exception e) {
      LOG.error("Bootstrap failure: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to bootstrap integration environment", e);
    }
  }

  @Override
  public void launcherSessionClosed(LauncherSession session) {
    LOG.info("Starting test suite shutdown sequence");

    // Step 1: Stop the Dropwizard application (includes Flowable async executor)
    try {
      if (APP != null) {
        LOG.info("Stopping Dropwizard application...");
        APP.after();
        LOG.info("Dropwizard application stopped");
      }
    } catch (Exception e) {
      LOG.error("Error stopping application: {}", e.getMessage(), e);
    }

    // Step 2: Wait for Flowable async executor threads to fully terminate
    // This prevents "unexpected postmaster exit" errors during shutdown
    try {
      LOG.info("Waiting for Flowable async executor threads to terminate...");
      Thread.sleep(5000); // 5 second grace period
      LOG.info("Grace period complete");
    } catch (InterruptedException e) {
      LOG.warn("Interrupted during shutdown grace period");
      Thread.currentThread().interrupt();
    }

    // Step 3: Stop containers in reverse order of startup
    if (RDF_CONTAINER != null) {
      LOG.info("Stopping Fuseki container");
      try {
        RDF_CONTAINER.stop();
      } catch (Exception e) {
        LOG.error("Error stopping RDF container: {}", e.getMessage());
      }
    }

    if (ELASTIC != null) {
      LOG.info("Stopping Elasticsearch container");
      try {
        ELASTIC.stop();
      } catch (Exception e) {
        LOG.error("Error stopping Elasticsearch container: {}", e.getMessage());
      }
    }

    if (POSTGRES != null) {
      LOG.info("Stopping PostgreSQL container");
      try {
        POSTGRES.stop();
      } catch (Exception e) {
        LOG.error("Error stopping PostgreSQL container: {}", e.getMessage());
      }
    }

    LOG.info("Test suite shutdown complete");
  }

  private OpenMetadataApplicationConfig loadBaseConfig()
      throws ConfigurationException, IOException {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    Validator validator = Validators.newValidator();
    io.dropwizard.configuration.YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new io.dropwizard.configuration.YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    return factory.build(
        new FileConfigurationSourceProvider(), resourcePath("openmetadata-secure-test.yaml"));
  }

  private int startLocalJwksServer() throws Exception {
    // Load test public key from resources
    byte[] pubBytes =
        getClass().getClassLoader().getResourceAsStream("public_key.der").readAllBytes();
    X509EncodedKeySpec spec = new X509EncodedKeySpec(pubBytes);
    RSAPublicKey pubKey = (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
    String n = base64Url(pubKey.getModulus().toByteArray());
    String e = base64Url(pubKey.getPublicExponent().toByteArray());
    String jwks =
        "{\"keys\":[{\"kty\":\"RSA\",\"kid\":\"test-key\",\"use\":\"sig\",\"alg\":\"RS256\",\"n\":\""
            + n
            + "\",\"e\":\""
            + e
            + "\"}]}";

    HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext(
        "/.well-known/jwks.json",
        new HttpHandler() {
          @Override
          public void handle(HttpExchange exchange) throws java.io.IOException {
            byte[] resp = jwks.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, resp.length);
            try (OutputStream os = exchange.getResponseBody()) {
              os.write(resp);
            }
          }
        });
    server.setExecutor(java.util.concurrent.Executors.newSingleThreadExecutor());
    server.start();
    return server.getAddress().getPort();
  }

  private static String base64Url(byte[] bytes) {
    // Remove possible leading zero for positive BigInteger representation
    if (bytes.length > 1 && bytes[0] == 0) {
      bytes = java.util.Arrays.copyOfRange(bytes, 1, bytes.length);
    }
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private String resourcePath(String name) {
    try {
      URI uri = TestSuiteBootstrap.class.getClassLoader().getResource(name).toURI();
      return new java.io.File(uri).getAbsolutePath();
    } catch (Exception e) {
      throw new RuntimeException("Resource not found: " + name, e);
    }
  }

  /**
   * Get Elasticsearch container for search tests.
   * @return Elasticsearch container instance
   */
  public static ElasticsearchContainer getElasticsearchContainer() {
    return ELASTIC;
  }

  /**
   * Get Elasticsearch host address.
   * @return Host:Port string
   */
  public static String getElasticsearchAddress() {
    return ELASTIC != null ? ELASTIC.getHttpHostAddress() : null;
  }

  /**
   * Create a RestClient for Elasticsearch.
   * @return RestClient configured for the test Elasticsearch instance
   */
  public static es.org.elasticsearch.client.RestClient createSearchClient() {
    if (ELASTIC == null) {
      throw new IllegalStateException("Elasticsearch container not started");
    }
    return es.org.elasticsearch.client.RestClient.builder(
            org.apache.http.HttpHost.create(ELASTIC.getHttpHostAddress()))
        .build();
  }
}
