/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.bootstrap;

import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5ClientBuilder;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import jakarta.validation.Validator;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import org.apache.hc.client5.http.auth.AuthScope;
import org.apache.hc.client5.http.auth.UsernamePasswordCredentials;
import org.apache.hc.client5.http.impl.auth.BasicCredentialsProvider;
import org.apache.hc.core5.http.HttpHost;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRepositoryFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.JdbcDatabaseContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.wait.strategy.LogMessageWaitStrategy;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.k3s.K3sContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * JUnit 5 LauncherSessionListener that starts all test infrastructure (database, Elasticsearch,
 * OpenMetadata application) ONCE per test session and shares them across all IT test classes.
 *
 * <p>This enables parallel test execution by:
 * 1. Starting containers only once (not per test class)
 * 2. Sharing the same application instance across all tests
 * 3. Using TestNamespace for entity name isolation
 */
public class TestSuiteBootstrap implements LauncherSessionListener {

  private static final Logger LOG = LoggerFactory.getLogger(TestSuiteBootstrap.class);
  private static final AtomicBoolean STARTED = new AtomicBoolean(false);
  private static final String CONFIG_PATH =
      ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");

  private static final String ELASTIC_USER = "elastic";
  private static final String ELASTIC_PASSWORD = "password";
  private static final String ELASTIC_SCHEME = "http";
  private static final Integer ELASTIC_CONNECT_TIMEOUT = 5;
  private static final Integer ELASTIC_SOCKET_TIMEOUT = 60;
  private static final Integer ELASTIC_KEEP_ALIVE_TIMEOUT = 600;
  private static final Integer ELASTIC_BATCH_SIZE = 10;
  private static final IndexMappingLanguage ELASTIC_SEARCH_INDEX_MAPPING_LANGUAGE =
      IndexMappingLanguage.EN;
  private static final String ELASTIC_SEARCH_CLUSTER_ALIAS = "openmetadata";

  // Default images (can be overridden by system properties)
  private static final String DEFAULT_POSTGRES_IMAGE = "postgres:15";
  private static final String DEFAULT_MYSQL_IMAGE = "mysql:8.3.0";
  private static final String DEFAULT_ELASTICSEARCH_IMAGE =
      "docker.elastic.co/elasticsearch/elasticsearch:9.3.0";
  private static final String DEFAULT_OPENSEARCH_IMAGE = "opensearchproject/opensearch:3.4.0";

  private static final String FUSEKI_IMAGE = "stain/jena-fuseki:latest";
  private static final int FUSEKI_PORT = 3030;
  private static final String FUSEKI_DATASET = "openmetadata";
  private static final String FUSEKI_ADMIN_PASSWORD = "test-admin";

  // K3s (Kubernetes) configuration for pipeline scheduler tests (on-demand)
  private static final String K3S_IMAGE = "rancher/k3s:v1.27.4-k3s1";
  private static final String K8S_NAMESPACE = "openmetadata-pipelines";

  // Database and search configuration (read from system properties)
  private static String databaseType;
  private static String searchType;

  private static JdbcDatabaseContainer<?> DATABASE_CONTAINER;
  private static GenericContainer<?> SEARCH_CONTAINER;
  private static GenericContainer<?> FUSEKI_CONTAINER;
  private static K3sContainer K3S_CONTAINER;
  private static DropwizardAppExtension<OpenMetadataApplicationConfig> APP;
  private static Jdbi jdbi;

  private static String searchHost;
  private static int searchPort;
  private static String fusekiEndpoint;
  private static String kubeConfigYaml;

  @Override
  public void launcherSessionOpened(LauncherSession session) {
    if (!STARTED.compareAndSet(false, true)) {
      LOG.info("TestSuiteBootstrap already started, skipping initialization");
      return;
    }

    // Read configuration from system properties
    databaseType = System.getProperty("databaseType", "postgres");
    searchType = System.getProperty("searchType", "elasticsearch");

    LOG.info("=== TestSuiteBootstrap: Starting test infrastructure ===");
    LOG.info("Database type: {}", databaseType);
    LOG.info("Search type: {}", searchType);
    boolean k8sEnabled = isK8sTestsRequested();
    LOG.info("K8s tests enabled: {}", k8sEnabled);
    long startTime = System.currentTimeMillis();

    try {
      startDatabase();
      startSearch();
      startFuseki();
      if (k8sEnabled) {
        startK3s();
      }
      startApplication();

      long duration = System.currentTimeMillis() - startTime;
      LOG.info("=== TestSuiteBootstrap: Infrastructure started in {}ms ===", duration);
      LOG.info("Database ({}): {}", databaseType, DATABASE_CONTAINER.getJdbcUrl());
      LOG.info("Search ({}): {}:{}", searchType, searchHost, searchPort);
      LOG.info("Fuseki SPARQL: {}", fusekiEndpoint);
      if (k8sEnabled) {
        LOG.info("K3s Kubernetes: enabled");
      }
      LOG.info("OpenMetadata: http://localhost:{}", APP.getLocalPort());

      System.setProperty("IT_BASE_URL", "http://localhost:" + APP.getLocalPort() + "/api");

      SharedEntities.initialize(SdkClients.adminClient());

    } catch (Exception e) {
      LOG.error("Failed to start test infrastructure", e);
      cleanup();
      throw new RuntimeException("TestSuiteBootstrap initialization failed", e);
    }
  }

  @Override
  public void launcherSessionClosed(LauncherSession session) {
    LOG.info("=== TestSuiteBootstrap: Shutting down test infrastructure ===");
    cleanup();
  }

  private void startDatabase() {
    String image = System.getProperty("databaseImage");

    if ("mysql".equalsIgnoreCase(databaseType)) {
      if (image == null) {
        image = DEFAULT_MYSQL_IMAGE;
      }
      LOG.info("Starting MySQL container with image: {}", image);
      MySQLContainer<?> mysql = new MySQLContainer<>(image);
      mysql.withDatabaseName("openmetadata");
      mysql.withUsername("test");
      mysql.withPassword("test");
      mysql.withStartupTimeoutSeconds(240);
      mysql.withConnectTimeoutSeconds(240);
      mysql.withTmpFs(java.util.Map.of("/var/lib/mysql", "rw,size=2g"));
      mysql.withCreateContainerCmdModifier(
          cmd ->
              cmd.getHostConfig()
                  .withUlimits(
                      java.util.List.of(
                          new com.github.dockerjava.api.model.Ulimit("nofile", 65536L, 65536L))));
      mysql.start();
      DATABASE_CONTAINER = mysql;
      LOG.info("MySQL started: {}", DATABASE_CONTAINER.getJdbcUrl());
    } else {
      if (image == null) {
        image = DEFAULT_POSTGRES_IMAGE;
      }
      LOG.info("Starting PostgreSQL container with image: {}", image);
      PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(image);
      postgres.withDatabaseName("openmetadata");
      postgres.withUsername("test");
      postgres.withPassword("test");
      postgres.withStartupTimeoutSeconds(240);
      postgres.withConnectTimeoutSeconds(240);
      postgres.withCommand(
          "postgres",
          "-c",
          "max_wal_size=512MB",
          "-c",
          "min_wal_size=64MB",
          "-c",
          "wal_level=minimal",
          "-c",
          "max_wal_senders=0",
          "-c",
          "checkpoint_completion_target=0.5",
          "-c",
          "checkpoint_timeout=30s",
          "-c",
          "shared_buffers=128MB",
          "-c",
          "fsync=off",
          "-c",
          "synchronous_commit=off",
          "-c",
          "full_page_writes=off");
      postgres.withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw,size=2g"));
      postgres.withCreateContainerCmdModifier(
          cmd ->
              cmd.getHostConfig()
                  .withUlimits(
                      java.util.List.of(
                          new com.github.dockerjava.api.model.Ulimit("nofile", 65536L, 65536L))));
      postgres.start();
      DATABASE_CONTAINER = postgres;
      LOG.info("PostgreSQL started: {}", DATABASE_CONTAINER.getJdbcUrl());
    }
  }

  private void startSearch() {
    String image = System.getProperty("searchImage");

    if ("opensearch".equalsIgnoreCase(searchType)) {
      if (image == null) {
        image = DEFAULT_OPENSEARCH_IMAGE;
      }
      LOG.info("Starting OpenSearch container with image: {}", image);

      org.opensearch.testcontainers.OpensearchContainer<?> opensearch =
          new org.opensearch.testcontainers.OpensearchContainer<>(image);
      opensearch.withEnv("discovery.type", "single-node");
      opensearch.withEnv("DISABLE_SECURITY_PLUGIN", "true");
      opensearch.withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true");
      opensearch.withEnv("OPENSEARCH_JAVA_OPTS", "-Xms1g -Xmx1g");
      opensearch.withStartupAttempts(3);
      opensearch.withTmpFs(
          java.util.Map.of("/usr/share/opensearch/data", "rw,size=1g,uid=1000,gid=1000"));
      opensearch.withCreateContainerCmdModifier(
          cmd ->
              cmd.getHostConfig()
                  .withUlimits(
                      java.util.List.of(
                          new com.github.dockerjava.api.model.Ulimit("nofile", 65536L, 65536L))));
      opensearch.start();
      SEARCH_CONTAINER = opensearch;

      searchHost = opensearch.getHost();
      searchPort = opensearch.getMappedPort(9200);
      LOG.info("OpenSearch started: {}:{}", searchHost, searchPort);
    } else {
      if (image == null) {
        image = DEFAULT_ELASTICSEARCH_IMAGE;
      }
      LOG.info("Starting Elasticsearch container with image: {}", image);

      ElasticsearchContainer elasticsearch = new ElasticsearchContainer(image);
      elasticsearch.withPassword(ELASTIC_PASSWORD);
      elasticsearch.withEnv("discovery.type", "single-node");
      elasticsearch.withEnv("xpack.security.enabled", "false");
      elasticsearch.withEnv("ES_JAVA_OPTS", "-Xms1g -Xmx1g");
      elasticsearch.withStartupAttempts(3);
      elasticsearch.withTmpFs(java.util.Map.of("/usr/share/elasticsearch/data", "rw,size=1g"));
      elasticsearch.setWaitStrategy(
          new LogMessageWaitStrategy()
              .withRegEx(".*(\"message\":\\s?\"started[\\s?|\"].*|] started\n$)")
              .withStartupTimeout(Duration.ofMinutes(5)));
      elasticsearch.withCreateContainerCmdModifier(
          cmd ->
              cmd.getHostConfig()
                  .withUlimits(
                      java.util.List.of(
                          new com.github.dockerjava.api.model.Ulimit("nofile", 65536L, 65536L))));
      elasticsearch.start();
      SEARCH_CONTAINER = elasticsearch;

      searchHost = elasticsearch.getHost();
      searchPort = elasticsearch.getMappedPort(9200);
      LOG.info("Elasticsearch started: {}:{}", searchHost, searchPort);
    }
  }

  private void startFuseki() {
    LOG.info("Starting Fuseki SPARQL container...");
    FUSEKI_CONTAINER =
        new GenericContainer<>(DockerImageName.parse(FUSEKI_IMAGE))
            .withExposedPorts(FUSEKI_PORT)
            .withEnv("ADMIN_PASSWORD", FUSEKI_ADMIN_PASSWORD)
            .withEnv("FUSEKI_DATASET_1", FUSEKI_DATASET)
            .withTmpFs(java.util.Map.of("/fuseki/databases", "rw,size=256m,uid=100,gid=101"))
            .waitingFor(
                Wait.forHttp("/$/ping")
                    .forPort(FUSEKI_PORT)
                    .forStatusCode(200)
                    .withStartupTimeout(Duration.ofMinutes(2)))
            // Increase file descriptor limits for parallel test execution
            .withCreateContainerCmdModifier(
                cmd ->
                    cmd.getHostConfig()
                        .withUlimits(
                            java.util.List.of(
                                new com.github.dockerjava.api.model.Ulimit(
                                    "nofile", 65536L, 65536L))));
    FUSEKI_CONTAINER.start();

    fusekiEndpoint =
        String.format(
            "http://%s:%d/%s",
            FUSEKI_CONTAINER.getHost(),
            FUSEKI_CONTAINER.getMappedPort(FUSEKI_PORT),
            FUSEKI_DATASET);
    LOG.info("Fuseki started: {}", fusekiEndpoint);
  }

  private void startK3s() {
    LOG.info("Starting K3s (Kubernetes) container for pipeline scheduler tests...");

    // Reset any existing pipeline client
    org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory.reset();

    K3S_CONTAINER = new K3sContainer(DockerImageName.parse(K3S_IMAGE));
    K3S_CONTAINER.start();
    kubeConfigYaml = K3S_CONTAINER.getKubeConfigYaml();
    LOG.info("K3s container started");

    // Create namespace for pipelines
    try {
      io.kubernetes.client.openapi.ApiClient apiClient =
          io.kubernetes.client.util.Config.fromConfig(new java.io.StringReader(kubeConfigYaml));
      apiClient.setReadTimeout(30000);
      apiClient.setConnectTimeout(10000);

      io.kubernetes.client.openapi.apis.CoreV1Api coreApi =
          new io.kubernetes.client.openapi.apis.CoreV1Api(apiClient);
      io.kubernetes.client.openapi.models.V1Namespace namespace =
          new io.kubernetes.client.openapi.models.V1Namespace()
              .metadata(new io.kubernetes.client.openapi.models.V1ObjectMeta().name(K8S_NAMESPACE));
      coreApi.createNamespace(namespace).execute();
      LOG.info("Created K8s namespace: {}", K8S_NAMESPACE);
    } catch (Exception e) {
      LOG.warn("Failed to create K8s namespace (may already exist): {}", e.getMessage());
    }
  }

  private static boolean isK8sTestsRequested() {
    return "true".equalsIgnoreCase(System.getProperty("ENABLE_K8S_TESTS"))
        || "true".equalsIgnoreCase(System.getenv("ENABLE_K8S_TESTS"));
  }

  private void startApplication() throws Exception {
    LOG.info("Starting OpenMetadata application...");

    OpenMetadataApplicationConfig config = readTestAppConfig(CONFIG_PATH);

    HikariCPDataSourceFactory dataSourceFactory =
        (config.getDataSourceFactory() instanceof HikariCPDataSourceFactory)
            ? (HikariCPDataSourceFactory) config.getDataSourceFactory()
            : new HikariCPDataSourceFactory();
    dataSourceFactory.setUrl(DATABASE_CONTAINER.getJdbcUrl());
    dataSourceFactory.setUser(DATABASE_CONTAINER.getUsername());
    dataSourceFactory.setPassword(DATABASE_CONTAINER.getPassword());
    dataSourceFactory.setDriverClass(DATABASE_CONTAINER.getDriverClassName());
    dataSourceFactory.setMaxSize(100);
    dataSourceFactory.setMinSize(20);
    dataSourceFactory.setInitialSize(20);
    dataSourceFactory.setMaxWaitForConnection(io.dropwizard.util.Duration.seconds(30));
    config.setDataSourceFactory(dataSourceFactory);

    String projectRoot = System.getProperty("user.dir");
    if (projectRoot.endsWith("openmetadata-integration-tests")) {
      projectRoot = projectRoot.substring(0, projectRoot.lastIndexOf("/"));
    }
    String flyWayMigrationScriptsLocation =
        projectRoot + "/bootstrap/sql/migrations/flyway/" + DATABASE_CONTAINER.getDriverClassName();
    String nativeMigrationScriptsLocation = projectRoot + "/bootstrap/sql/migrations/native/";

    config.setElasticSearchConfiguration(getSearchConfig());

    if (config.getMigrationConfiguration() == null) {
      config.setMigrationConfiguration(
          new org.openmetadata.service.migration.MigrationConfiguration());
    }
    config.getMigrationConfiguration().setFlywayPath(flyWayMigrationScriptsLocation);
    config.getMigrationConfiguration().setNativePath(nativeMigrationScriptsLocation);

    String testResourcesPath = projectRoot + "/openmetadata-integration-tests/src/test/resources/";
    config
        .getJwtTokenConfiguration()
        .setRsaprivateKeyFilePath(testResourcesPath + "private_key.der");
    config.getJwtTokenConfiguration().setRsapublicKeyFilePath(testResourcesPath + "public_key.der");

    configurePipelineServiceClient(config);
    configureRdf(config);

    IndexMappingLoader.init(getSearchConfig());

    APP = new DropwizardAppExtension<>(OpenMetadataApplication.class, config);

    jdbi =
        Jdbi.create(
            DATABASE_CONTAINER.getJdbcUrl(),
            DATABASE_CONTAINER.getUsername(),
            DATABASE_CONTAINER.getPassword());
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(DATABASE_CONTAINER.getDriverClassName()));

    validateAndRunSystemDataMigrations(
        jdbi,
        config,
        ConnectionType.from(DATABASE_CONTAINER.getDriverClassName()),
        nativeMigrationScriptsLocation,
        "",
        flyWayMigrationScriptsLocation,
        false);

    createIndices();

    // Start the application
    APP.before();

    // Load seed data
    try {
      CollectionRegistry.getInstance().loadSeedData(jdbi, config, null, null, null, true);
    } catch (Exception se) {
      LOG.warn("Seed data load failed: {}", se.getMessage());
    }

    LOG.info("OpenMetadata application started on port {}", APP.getLocalPort());
  }

  private OpenMetadataApplicationConfig readTestAppConfig(String path)
      throws ConfigurationException, IOException {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    objectMapper.registerSubtypes(AuditExcludeFilterFactory.class, AuditOnlyFilterFactory.class);
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    return factory.build(
        new SubstitutingSourceProvider(
            new FileConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)),
        path);
  }

  private void validateAndRunSystemDataMigrations(
      Jdbi jdbi,
      OpenMetadataApplicationConfig config,
      ConnectionType connType,
      String nativeMigrationSQLPath,
      String extensionSQLScriptRootPath,
      String flywayPath,
      boolean forceMigrations) {
    DatasourceConfig.initialize(connType.label);
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            nativeMigrationSQLPath,
            connType,
            extensionSQLScriptRootPath,
            flywayPath,
            config,
            forceMigrations);
    SearchRepository searchRepository = new SearchRepository(getSearchConfig(), 50);
    Entity.setSearchRepository(searchRepository);
    Entity.setCollectionDAO(jdbi.onDemand(CollectionDAO.class));
    Entity.setJobDAO(jdbi.onDemand(JobDAO.class));
    Entity.initializeRepositories(config, jdbi);
    workflow.loadMigrations();
    workflow.runMigrationWorkflows(false);
    WorkflowHandler.initialize(config);
    SettingsCache.initialize(config);
    ApplicationHandler.initialize(config);
    ApplicationContext.initialize();
    Entity.cleanup();
  }

  private void createIndices() {
    ElasticSearchConfiguration config = getSearchConfig();
    SearchRepository searchRepository = SearchRepositoryFactory.createSearchRepository(config, 50);
    Entity.setSearchRepository(searchRepository);
    LOG.info("Creating {} indexes...", searchType);
    searchRepository.createIndexes();
  }

  private ElasticSearchConfiguration getSearchConfig() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    ElasticSearchConfiguration.SearchType type =
        "opensearch".equalsIgnoreCase(searchType)
            ? ElasticSearchConfiguration.SearchType.OPENSEARCH
            : ElasticSearchConfiguration.SearchType.ELASTICSEARCH;
    config
        .withHost(searchHost)
        .withPort(searchPort)
        .withUsername(ELASTIC_USER)
        .withPassword(ELASTIC_PASSWORD)
        .withScheme(ELASTIC_SCHEME)
        .withConnectionTimeoutSecs(ELASTIC_CONNECT_TIMEOUT)
        .withSocketTimeoutSecs(ELASTIC_SOCKET_TIMEOUT)
        .withKeepAliveTimeoutSecs(ELASTIC_KEEP_ALIVE_TIMEOUT)
        .withBatchSize(ELASTIC_BATCH_SIZE)
        .withSearchIndexMappingLanguage(ELASTIC_SEARCH_INDEX_MAPPING_LANGUAGE)
        .withClusterAlias(ELASTIC_SEARCH_CLUSTER_ALIAS)
        .withSearchType(type);

    return config;
  }

  private void configurePipelineServiceClient(OpenMetadataApplicationConfig config) {
    PipelineServiceClientConfiguration pipelineConfig = new PipelineServiceClientConfiguration();

    if (kubeConfigYaml != null) {
      // K3s was started - configure K8s pipeline client
      LOG.info("Configuring K8sPipelineClient for pipeline operations");
      pipelineConfig.setEnabled(true);
      pipelineConfig.setClassName(
          "org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient");
      pipelineConfig.setMetadataApiEndpoint("http://localhost:8585/api");

      Parameters params = new Parameters();
      params.setAdditionalProperty("namespace", K8S_NAMESPACE);
      params.setAdditionalProperty("inCluster", "false");
      params.setAdditionalProperty("kubeConfigContent", kubeConfigYaml);
      params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:latest");
      params.setAdditionalProperty("serviceAccountName", "default");
      params.setAdditionalProperty("imagePullPolicy", "IfNotPresent");
      pipelineConfig.setParameters(params);
    } else {
      // No K3s - disable pipeline service client
      pipelineConfig.setEnabled(false);
      LOG.info("Pipeline service client disabled (K8s not enabled)");
    }

    config.setPipelineServiceClientConfiguration(pipelineConfig);
  }

  private void configureRdf(OpenMetadataApplicationConfig config) {
    LOG.info("Configuring RDF with Fuseki endpoint: {}", fusekiEndpoint);

    RdfConfiguration rdfConfig = config.getRdfConfiguration();
    if (rdfConfig == null) {
      rdfConfig = new RdfConfiguration();
      config.setRdfConfiguration(rdfConfig);
    }

    rdfConfig.setEnabled(false);
    rdfConfig.setBaseUri(java.net.URI.create("https://open-metadata.org/"));
    rdfConfig.setStorageType(RdfConfiguration.StorageType.FUSEKI);
    rdfConfig.setRemoteEndpoint(java.net.URI.create(fusekiEndpoint));
    rdfConfig.setUsername("admin");
    rdfConfig.setPassword(FUSEKI_ADMIN_PASSWORD);
    rdfConfig.setDataset(FUSEKI_DATASET);

    LOG.info("RDF configuration complete");
  }

  private void cleanup() {
    try {
      if (SharedEntities.isInitialized()) {
        SharedEntities.cleanup(SdkClients.adminClient());
      }
    } catch (Exception e) {
      LOG.warn("Error cleaning up shared entities", e);
    }

    try {
      if (WorkflowHandler.isInitialized()) {
        LOG.info("Shutting down Flowable ProcessEngine...");
        org.flowable.engine.ProcessEngines.destroy();
        LOG.info("Flowable ProcessEngine shut down successfully");
      }
    } catch (Exception e) {
      LOG.warn("Error shutting down Flowable ProcessEngine", e);
    }

    try {
      if (APP != null) {
        APP.after();
        if (APP.getEnvironment() != null
            && APP.getEnvironment().getApplicationContext() != null
            && APP.getEnvironment().getApplicationContext().getServer() != null) {
          APP.getEnvironment().getApplicationContext().getServer().stop();
        }
      }
    } catch (Exception e) {
      LOG.warn("Error stopping Dropwizard app", e);
    }

    try {
      if (SEARCH_CONTAINER != null) {
        SEARCH_CONTAINER.stop();
      }
    } catch (Exception e) {
      LOG.warn("Error stopping search container", e);
    }

    try {
      if (FUSEKI_CONTAINER != null) {
        FUSEKI_CONTAINER.stop();
      }
    } catch (Exception e) {
      LOG.warn("Error stopping Fuseki container", e);
    }

    try {
      if (K3S_CONTAINER != null) {
        K3S_CONTAINER.stop();
      }
    } catch (Exception e) {
      LOG.warn("Error stopping K3s container", e);
    }

    try {
      if (DATABASE_CONTAINER != null) {
        DATABASE_CONTAINER.stop();
      }
    } catch (Exception e) {
      LOG.warn("Error stopping database container", e);
    }
  }

  // === Static accessor methods for tests ===

  /**
   * Returns true if K8s (K3s) pipeline scheduler is enabled and running.
   * K8s is enabled by setting ENABLE_K8S_TESTS=true environment variable or system property
   * before running tests, or by calling setupK8s() from a test class.
   */
  public static boolean isK8sEnabled() {
    return K3S_CONTAINER != null && K3S_CONTAINER.isRunning();
  }

  /**
   * Starts K8s (K3s) container on-demand and configures the pipeline service client.
   * Call this from test classes that require K8s (e.g., IngestionPipelineResourceIT).
   * This method is idempotent - calling it multiple times is safe.
   */
  public static synchronized void setupK8s() {
    if (isK8sEnabled()) {
      LOG.info("K8s already running, skipping setup");
      return;
    }

    LOG.info("Setting up K8s (K3s) on-demand for pipeline tests...");

    // Start K3s container
    org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory.reset();

    K3S_CONTAINER = new K3sContainer(DockerImageName.parse(K3S_IMAGE));
    K3S_CONTAINER.start();
    kubeConfigYaml = K3S_CONTAINER.getKubeConfigYaml();
    LOG.info("K3s container started");

    // Create namespace for pipelines
    try {
      io.kubernetes.client.openapi.ApiClient apiClient =
          io.kubernetes.client.util.Config.fromConfig(new java.io.StringReader(kubeConfigYaml));
      apiClient.setReadTimeout(30000);
      apiClient.setConnectTimeout(10000);

      io.kubernetes.client.openapi.apis.CoreV1Api coreApi =
          new io.kubernetes.client.openapi.apis.CoreV1Api(apiClient);
      io.kubernetes.client.openapi.models.V1Namespace namespace =
          new io.kubernetes.client.openapi.models.V1Namespace()
              .metadata(new io.kubernetes.client.openapi.models.V1ObjectMeta().name(K8S_NAMESPACE));
      coreApi.createNamespace(namespace).execute();
      LOG.info("Created K8s namespace: {}", K8S_NAMESPACE);
    } catch (Exception e) {
      LOG.warn("Failed to create K8s namespace (may already exist): {}", e.getMessage());
    }

    // Configure and initialize the pipeline service client
    PipelineServiceClientConfiguration pipelineConfig = new PipelineServiceClientConfiguration();
    pipelineConfig.setEnabled(true);
    pipelineConfig.setClassName("org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient");
    pipelineConfig.setMetadataApiEndpoint("http://localhost:" + APP.getLocalPort() + "/api");

    Parameters params = new Parameters();
    params.setAdditionalProperty("namespace", K8S_NAMESPACE);
    params.setAdditionalProperty("inCluster", "false");
    params.setAdditionalProperty("kubeConfigContent", kubeConfigYaml);
    params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:latest");
    params.setAdditionalProperty("serviceAccountName", "default");
    params.setAdditionalProperty("imagePullPolicy", "IfNotPresent");
    // Use native Jobs/CronJobs by default instead of OMJob operator
    params.setAdditionalProperty("useOMJobOperator", "false");
    pipelineConfig.setParameters(params);

    // Create the pipeline service client with K8s config
    org.openmetadata.sdk.PipelineServiceClientInterface pipelineClient =
        org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory
            .createPipelineServiceClient(pipelineConfig);

    // Update the IngestionPipelineRepository with the new client
    // This is necessary because the repository caches the client at startup
    try {
      org.openmetadata.service.jdbi3.IngestionPipelineRepository repository =
          (org.openmetadata.service.jdbi3.IngestionPipelineRepository)
              org.openmetadata.service.Entity.getEntityRepository("ingestionPipeline");
      repository.setPipelineServiceClient(pipelineClient);
      LOG.info("Updated IngestionPipelineRepository with K8s pipeline client");
    } catch (Exception e) {
      LOG.warn("Could not update IngestionPipelineRepository: {}", e.getMessage());
      throw new RuntimeException("Failed to configure K8s pipeline client", e);
    }

    LOG.info("K8s pipeline service client configured and ready");
  }

  /**
   * Creates a Rest5Client for direct search operations in tests. Works with both Elasticsearch and
   * OpenSearch.
   */
  public static Rest5Client createSearchClient() {
    if (SEARCH_CONTAINER == null || !SEARCH_CONTAINER.isRunning()) {
      throw new IllegalStateException(
          "Search container is not running. Ensure TestSuiteBootstrap has initialized.");
    }

    BasicCredentialsProvider credentialsProvider = new BasicCredentialsProvider();
    credentialsProvider.setCredentials(
        new AuthScope(null, -1),
        new UsernamePasswordCredentials(ELASTIC_USER, ELASTIC_PASSWORD.toCharArray()));

    HttpHost httpHost = new HttpHost("http", searchHost, searchPort);
    Rest5ClientBuilder builder =
        Rest5Client.builder(httpHost)
            .setHttpClientConfigCallback(
                httpClientBuilder ->
                    httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider));
    return builder.build();
  }

  /**
   * Returns the application port for direct HTTP access if needed.
   */
  public static int getApplicationPort() {
    if (APP == null) {
      throw new IllegalStateException(
          "Application is not running. Ensure TestSuiteBootstrap has initialized.");
    }
    return APP.getLocalPort();
  }

  /**
   * Returns the admin port for accessing admin endpoints like /prometheus.
   */
  public static int getAdminPort() {
    if (APP == null) {
      throw new IllegalStateException(
          "Application is not running. Ensure TestSuiteBootstrap has initialized.");
    }
    return APP.getAdminPort();
  }

  /**
   * Returns the base URL for the running application.
   */
  public static String getBaseUrl() {
    return "http://localhost:" + getApplicationPort();
  }

  /**
   * Returns the Jdbi instance for direct database access if needed.
   */
  public static Jdbi getJdbi() {
    if (jdbi == null) {
      throw new IllegalStateException(
          "JDBI is not initialized. Ensure TestSuiteBootstrap has initialized.");
    }
    return jdbi;
  }

  /**
   * Returns the Fuseki SPARQL endpoint URL for RDF operations.
   */
  public static String getFusekiEndpoint() {
    if (fusekiEndpoint == null) {
      throw new IllegalStateException(
          "Fuseki is not initialized. Ensure TestSuiteBootstrap has initialized.");
    }
    return fusekiEndpoint;
  }

  /**
   * Returns the Fuseki SPARQL query endpoint URL.
   */
  public static String getFusekiQueryEndpoint() {
    return getFusekiEndpoint() + "/sparql";
  }

  /**
   * Returns the Fuseki SPARQL update endpoint URL.
   */
  public static String getFusekiUpdateEndpoint() {
    return getFusekiEndpoint() + "/update";
  }

  /**
   * Returns the Fuseki Graph Store Protocol endpoint URL.
   */
  public static String getFusekiDataEndpoint() {
    return getFusekiEndpoint() + "/data";
  }

  /**
   * Returns the Kubernetes config YAML for accessing the K3s cluster.
   * Only available when K8s is enabled.
   */
  public static String getKubeConfigYaml() {
    if (kubeConfigYaml == null) {
      throw new IllegalStateException(
          "K8s is not enabled. Ensure TestSuiteBootstrap.setupK8s() has been called.");
    }
    return kubeConfigYaml;
  }
}
