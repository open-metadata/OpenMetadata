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

package org.openmetadata.service;

import static java.lang.String.format;

import com.fasterxml.jackson.databind.ObjectMapper;
import es.org.elasticsearch.client.RestClient;
import es.org.elasticsearch.client.RestClientBuilder;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.jackson.JacksonFeature;
import io.dropwizard.jersey.validation.Validators;
import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import jakarta.validation.Validator;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.eclipse.jetty.client.HttpClient;
import org.flywaydb.core.Flyway;
import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.client.ClientProperties;
import org.glassfish.jersey.jetty.connector.JettyClientProperties;
import org.glassfish.jersey.jetty.connector.JettyConnectorProvider;
import org.glassfish.jersey.jetty.connector.JettyHttpClientSupplier;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.config.CacheConfiguration;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.events.MSTeamsCallbackResource;
import org.openmetadata.service.resources.events.SlackCallbackResource;
import org.openmetadata.service.resources.events.WebhookCallbackResource;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRepositoryFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.JdbcDatabaseContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.wait.strategy.LogMessageWaitStrategy;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.utility.DockerImageName;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class OpenMetadataApplicationTest {
  protected static final String CONFIG_PATH =
      ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");
  public static final String ELASTIC_USER = "elastic";
  public static final String ELASTIC_PASSWORD = "password";
  public static final String ELASTIC_SCHEME = "http";
  public static final Integer ELASTIC_CONNECT_TIMEOUT = 5;
  public static final Integer ELASTIC_SOCKET_TIMEOUT = 60;
  public static final Integer ELASTIC_KEEP_ALIVE_TIMEOUT = 600;
  public static final Integer ELASTIC_BATCH_SIZE = 10;
  public static final IndexMappingLanguage ELASTIC_SEARCH_INDEX_MAPPING_LANGUAGE =
      IndexMappingLanguage.EN;
  public static final String ELASTIC_SEARCH_CLUSTER_ALIAS = "openmetadata";
  public static final ElasticSearchConfiguration.SearchType ELASTIC_SEARCH_TYPE =
      ElasticSearchConfiguration.SearchType.ELASTICSEARCH;
  public static DropwizardAppExtension<OpenMetadataApplicationConfig> APP;

  protected static final WebhookCallbackResource webhookCallbackResource =
      new WebhookCallbackResource();
  protected static final SlackCallbackResource slackCallbackResource = new SlackCallbackResource();
  protected static final MSTeamsCallbackResource teamsCallbackResource =
      new MSTeamsCallbackResource();

  public static Jdbi jdbi;
  private static ElasticsearchContainer ELASTIC_SEARCH_CONTAINER;
  protected static GenericContainer<?> REDIS_CONTAINER;
  protected static GenericContainer<?> RDF_CONTAINER;
  private static JdbcDatabaseContainer<?> SQL_CONTAINER;
  private static final Object INIT_LOCK = new Object();

  protected static final Set<ConfigOverride> configOverrides = new HashSet<>();

  private static final String JDBC_CONTAINER_CLASS_NAME =
      "org.testcontainers.containers.MySQLContainer";
  private static final String JDBC_CONTAINER_IMAGE = "mysql:8";
  private static final String ELASTIC_SEARCH_CONTAINER_IMAGE =
      "docker.elastic.co/elasticsearch/elasticsearch:8.11.4";

  private static String HOST;
  private static String PORT;
  protected static Client client;

  static {
    CollectionRegistry.addTestResource(webhookCallbackResource);
    CollectionRegistry.addTestResource(slackCallbackResource);
    CollectionRegistry.addTestResource(teamsCallbackResource);
  }

  @BeforeAll
  public void createApplication() throws Exception {
    synchronized (INIT_LOCK) {
      if (APP != null) {
        if (client == null) {
          createClient();
        }
        return;
      }
      String jdbcContainerClassName = System.getProperty("jdbcContainerClassName");
      String jdbcContainerImage = System.getProperty("jdbcContainerImage");
      String elasticSearchContainerImage = System.getProperty("elasticSearchContainerClassName");
      if (CommonUtil.nullOrEmpty(jdbcContainerClassName)) {
        jdbcContainerClassName = JDBC_CONTAINER_CLASS_NAME;
      }
      if (CommonUtil.nullOrEmpty(jdbcContainerImage)) {
        jdbcContainerImage = JDBC_CONTAINER_IMAGE;
      }
      if (CommonUtil.nullOrEmpty(elasticSearchContainerImage)) {
        elasticSearchContainerImage = ELASTIC_SEARCH_CONTAINER_IMAGE;
      }
      OpenMetadataApplicationConfig config = readTestAppConfig(CONFIG_PATH);
      // The system properties are provided by maven-surefire for testing with mysql and postgres
      LOG.info(
          "Using test container class {} and image {}", jdbcContainerClassName, jdbcContainerImage);

      JdbcDatabaseContainer<?> sqlContainer =
          (JdbcDatabaseContainer<?>)
              Class.forName(jdbcContainerClassName)
                  .getConstructor(String.class)
                  .newInstance(jdbcContainerImage);
      // Tune DB container behavior per engine
      if (sqlContainer instanceof MySQLContainer) {
        // Mitigate AIO failures on some CI kernels and speed up startup
        ((MySQLContainer<?>) sqlContainer)
            .withCommand(
                "--innodb_use_native_aio=0",
                "--default-authentication-plugin=mysql_native_password",
                "--skip-log-bin");
      }
      sqlContainer.withReuse(false);
      sqlContainer.withStartupTimeoutSeconds(240);
      sqlContainer.withConnectTimeoutSeconds(240);
      sqlContainer.withPassword("password");
      sqlContainer.withUsername("username");
      sqlContainer.start();
      SQL_CONTAINER = sqlContainer;

      // Note: Added DataSourceFactory since this configuration is needed by the WorkflowHandler.
      DataSourceFactory dataSourceFactory = new DataSourceFactory();
      dataSourceFactory.setUrl(sqlContainer.getJdbcUrl());
      dataSourceFactory.setUser(sqlContainer.getUsername());
      dataSourceFactory.setPassword(sqlContainer.getPassword());
      dataSourceFactory.setDriverClass(sqlContainer.getDriverClassName());
      config.setDataSourceFactory(dataSourceFactory);

      final String flyWayMigrationScriptsLocation =
          ResourceHelpers.resourceFilePath(
              "db/sql/migrations/flyway/" + sqlContainer.getDriverClassName());
      final String nativeMigrationScriptsLocation =
          ResourceHelpers.resourceFilePath("db/sql/migrations/native/");

      // Extension Config
      String extensionMigrationScripsLocation = "";
      try {
        extensionMigrationScripsLocation =
            ResourceHelpers.resourceFilePath("extension/sql/migrations/");
        // Set directly on config
        if (config.getMigrationConfiguration() != null) {
          config.getMigrationConfiguration().setExtensionPath(extensionMigrationScripsLocation);
        }
      } catch (Exception ex) {
        LOG.info("Extension migrations not found");
      }
      Flyway flyway =
          Flyway.configure()
              .dataSource(
                  sqlContainer.getJdbcUrl(), sqlContainer.getUsername(), sqlContainer.getPassword())
              .table("DATABASE_CHANGE_LOG")
              .locations("filesystem:" + flyWayMigrationScriptsLocation)
              .sqlMigrationPrefix("v")
              .cleanDisabled(false)
              .load();
      flyway.clean();
      flyway.migrate();

      ELASTIC_SEARCH_CONTAINER = new ElasticsearchContainer(elasticSearchContainerImage);
      ELASTIC_SEARCH_CONTAINER.withPassword("password");
      ELASTIC_SEARCH_CONTAINER.withEnv("discovery.type", "single-node");
      ELASTIC_SEARCH_CONTAINER.withEnv("xpack.security.enabled", "false");
      ELASTIC_SEARCH_CONTAINER.withEnv("ES_JAVA_OPTS", "-Xms1g -Xmx1g");
      ELASTIC_SEARCH_CONTAINER.withReuse(false);
      ELASTIC_SEARCH_CONTAINER.withStartupAttempts(3);
      ELASTIC_SEARCH_CONTAINER.setWaitStrategy(
          new LogMessageWaitStrategy()
              .withRegEx(".*(\"message\":\\s?\"started[\\s?|\"].*|] started\n$)")
              .withStartupTimeout(Duration.ofMinutes(5)));
      ELASTIC_SEARCH_CONTAINER.start();
      String[] parts = ELASTIC_SEARCH_CONTAINER.getHttpHostAddress().split(":");
      HOST = parts[0];
      PORT = parts[1];
      // Apply ES and DB directly to config (avoid Dropwizard ConfigOverride varargs bugs)
      config.setElasticSearchConfiguration(getEsConfig());
      applyDatabaseConfig(config, sqlContainer);

      // Init IndexMapping class
      IndexMappingLoader.init(getEsConfig());

      // Migration paths directly on config
      if (config.getMigrationConfiguration() != null) {
        config.getMigrationConfiguration().setFlywayPath(flyWayMigrationScriptsLocation);
        config.getMigrationConfiguration().setNativePath(nativeMigrationScriptsLocation);
      }

      // Redis cache configuration (start container if enabled via system properties)
      setupRedisIfEnabled();

      // RDF configuration (if enabled by system properties)
      setupRdfIfEnabled();

      // If a Redis container is present (either started here via sysprops or by a subclass),
      // write cache settings into the config directly now
      applyRedisConfigIfPresent(config);

      // If an RDF container is present, write settings directly into config
      applyRdfConfigIfPresent(config);

      // Build app extension from an already materialized configuration object
      APP = new DropwizardAppExtension<>(OpenMetadataApplication.class, config);
      // Run System Migrations
      jdbi =
          Jdbi.create(
              sqlContainer.getJdbcUrl(), sqlContainer.getUsername(), sqlContainer.getPassword());
      jdbi.installPlugin(new SqlObjectPlugin());
      jdbi.getConfig(SqlObjects.class)
          .setSqlLocator(
              new ConnectionAwareAnnotationSqlLocator(sqlContainer.getDriverClassName()));
      // jdbi.setSqlLogger(new DebugSqlLogger());
      validateAndRunSystemDataMigrations(
          jdbi,
          config,
          ConnectionType.from(sqlContainer.getDriverClassName()),
          nativeMigrationScriptsLocation,
          extensionMigrationScripsLocation,
          false);
      createIndices();
      try {
        APP.before();
        createClient();
        // Ensure seed data is loaded so tests relying on system users/bots work
        try {
          CollectionRegistry.getInstance().loadSeedData(jdbi, config, null, null, null, true);
        } catch (Exception se) {
          LOG.warn("Seed data load failed: {}", se.getMessage());
        }
      } catch (Exception e) {
        // Reset APP so other classes can retry initialization
        LOG.error("Application startup failed. Resetting APP state for retry.", e);
        try {
          if (APP != null) {
            APP.after();
          }
        } catch (Exception ignore) {
        }
        APP = null;
        // Re-throw to fail the current test class early
        throw e;
      }

      // Global shutdown hook to stop resources once per JVM
      Runtime.getRuntime()
          .addShutdownHook(
              new Thread(
                  () -> {
                    try {
                      if (APP != null) {
                        APP.after();
                        APP.getEnvironment().getApplicationContext().getServer().stop();
                      }
                    } catch (Exception e) {
                      LOG.warn("Error while stopping Dropwizard app", e);
                    }
                    try {
                      if (ELASTIC_SEARCH_CONTAINER != null) {
                        ELASTIC_SEARCH_CONTAINER.stop();
                      }
                    } catch (Exception e) {
                      LOG.warn("Error while stopping Elasticsearch container", e);
                    }
                    try {
                      if (REDIS_CONTAINER != null) {
                        REDIS_CONTAINER.stop();
                      }
                    } catch (Exception e) {
                      LOG.warn("Error while stopping Redis container", e);
                    }
                    try {
                      if (RDF_CONTAINER != null) {
                        RDF_CONTAINER.stop();
                      }
                    } catch (Exception e) {
                      LOG.warn("Error while stopping RDF container", e);
                    }
                    try {
                      if (client != null) {
                        client.close();
                      }
                    } catch (Exception e) {
                      LOG.warn("Error while closing HTTP client", e);
                    }
                  }));
    }
  }

  public void validateAndRunSystemDataMigrations(
      Jdbi jdbi,
      OpenMetadataApplicationConfig config,
      ConnectionType connType,
      String nativeMigrationSQLPath,
      String extensionSQLScriptRootPath,
      boolean forceMigrations) {
    DatasourceConfig.initialize(connType.label);
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            nativeMigrationSQLPath,
            connType,
            extensionSQLScriptRootPath,
            config,
            forceMigrations);
    // Initialize search repository
    SearchRepository searchRepository = new SearchRepository(getEsConfig(), 50);
    Entity.setSearchRepository(searchRepository);
    Entity.setCollectionDAO(getDao(jdbi));
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

  protected OpenMetadataApplicationConfig readTestAppConfig(String path)
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

  protected CollectionDAO getDao(Jdbi jdbi) {
    CollectionDAO originalDAO = jdbi.onDemand(CollectionDAO.class);

    // Wrap with caching decorator if Redis is enabled
    String enableCache = System.getProperty("enableCache");
    String cacheType = System.getProperty("cacheType");

    if ("true".equals(enableCache) && "redis".equals(cacheType)) {
      LOG.info("Wrapping CollectionDAO with Redis caching support for tests");
      try {
        // Import dynamically to avoid compilation issues if cache classes aren't available
        Class<?> cachedDAOClass =
            Class.forName("org.openmetadata.service.cache.CachedCollectionDAO");
        return (CollectionDAO)
            cachedDAOClass.getConstructor(CollectionDAO.class).newInstance(originalDAO);
      } catch (Exception e) {
        LOG.warn(
            "Failed to enable caching support, falling back to original DAO: {}", e.getMessage());
        return originalDAO;
      }
    }

    return originalDAO;
  }

  @NotNull
  protected DropwizardAppExtension<OpenMetadataApplicationConfig> getApp(ConfigOverride[] ignored) {
    // Unused with direct-config path but kept for compatibility if overridden elsewhere
    return new DropwizardAppExtension<>(OpenMetadataApplication.class, CONFIG_PATH);
  }

  private static void createClient() {
    HttpClient httpClient = new HttpClient();
    httpClient.setIdleTimeout(0);
    ClientConfig config = new ClientConfig();
    config.connectorProvider(new JettyConnectorProvider());
    config.register(new JettyHttpClientSupplier(httpClient));
    config.register(new JacksonFeature(APP.getObjectMapper()));
    config.property(ClientProperties.CONNECT_TIMEOUT, 0);
    config.property(ClientProperties.READ_TIMEOUT, 0);
    config.property(ClientProperties.SUPPRESS_HTTP_COMPLIANCE_VALIDATION, true);
    config.property(JettyClientProperties.SYNC_LISTENER_RESPONSE_MAX_SIZE, 10 * 1024 * 1024);
    client = ClientBuilder.newClient(config);
  }

  @AfterAll
  public void stopApplication() throws Exception {
    // Intentionally no-op: global shutdown hook handles teardown after all tests in JVM.
  }

  private void createIndices() {
    ElasticSearchConfiguration esConfig = getEsConfig();
    SearchRepository searchRepository =
        SearchRepositoryFactory.createSearchRepository(esConfig, 50);
    Entity.setSearchRepository(searchRepository);
    LOG.info("creating indexes.");
    searchRepository.createIndexes();
  }

  public static RestClient getSearchClient() {
    CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
    credentialsProvider.setCredentials(
        AuthScope.ANY, new UsernamePasswordCredentials(ELASTIC_USER, "password"));

    RestClientBuilder builder =
        RestClient.builder(HttpHost.create(ELASTIC_SEARCH_CONTAINER.getHttpHostAddress()))
            .setHttpClientConfigCallback(
                httpClientBuilder ->
                    httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider));
    return builder.build();
  }

  public static WebTarget getResource(String collection) {
    return client.target(format("http://localhost:%s/api/v1/%s", APP.getLocalPort(), collection));
  }

  public static WebTarget getResourceAsURI(String collection) {
    return client.target(
        URI.create((format("http://localhost:%s/api/v1/%s", APP.getLocalPort(), collection))));
  }

  public static WebTarget getConfigResource(String resource) {
    return client.target(
        format("http://localhost:%s/api/v1/system/config/%s", APP.getLocalPort(), resource));
  }

  private static void overrideElasticSearchConfig() {
    // elastic search overrides
    configOverrides.add(ConfigOverride.config("elasticsearch.host", HOST));
    configOverrides.add(ConfigOverride.config("elasticsearch.port", PORT));
    configOverrides.add(ConfigOverride.config("elasticsearch.scheme", ELASTIC_SCHEME));
    configOverrides.add(ConfigOverride.config("elasticsearch.username", ELASTIC_USER));
    configOverrides.add(ConfigOverride.config("elasticsearch.password", ELASTIC_PASSWORD));
    configOverrides.add(ConfigOverride.config("elasticsearch.truststorePath", ""));
    configOverrides.add(ConfigOverride.config("elasticsearch.truststorePassword", ""));
    configOverrides.add(
        ConfigOverride.config(
            "elasticsearch.connectionTimeoutSecs", ELASTIC_CONNECT_TIMEOUT.toString()));
    configOverrides.add(
        ConfigOverride.config(
            "elasticsearch.socketTimeoutSecs", ELASTIC_SOCKET_TIMEOUT.toString()));
    configOverrides.add(
        ConfigOverride.config(
            "elasticsearch.keepAliveTimeoutSecs", ELASTIC_KEEP_ALIVE_TIMEOUT.toString()));
    configOverrides.add(
        ConfigOverride.config("elasticsearch.batchSize", ELASTIC_BATCH_SIZE.toString()));
    configOverrides.add(
        ConfigOverride.config(
            "elasticsearch.searchIndexMappingLanguage",
            ELASTIC_SEARCH_INDEX_MAPPING_LANGUAGE.value()));
    configOverrides.add(
        ConfigOverride.config("elasticsearch.clusterAlias", ELASTIC_SEARCH_CLUSTER_ALIAS));
    configOverrides.add(
        ConfigOverride.config("elasticsearch.searchType", ELASTIC_SEARCH_TYPE.value()));
  }

  private static void setupRedisIfEnabled() {
    String enableCache = System.getProperty("enableCache");
    String cacheType = System.getProperty("cacheType");
    String redisContainerImage = System.getProperty("redisContainerImage");

    if ("true".equals(enableCache) && "redis".equals(cacheType)) {
      LOG.info("Redis cache enabled for tests");

      if (CommonUtil.nullOrEmpty(redisContainerImage)) {
        redisContainerImage = "redis:7-alpine";
      }

      LOG.info("Starting Redis container with image: {}", redisContainerImage);

      REDIS_CONTAINER =
          new GenericContainer<>(DockerImageName.parse(redisContainerImage))
              .withExposedPorts(6379)
              .withCommand("redis-server", "--requirepass", "test-password")
              .waitingFor(Wait.forListeningPort().withStartupTimeout(Duration.ofMinutes(2)))
              .withReuse(false)
              .withStartupTimeout(Duration.ofMinutes(2));

      REDIS_CONTAINER.start();

      String redisHost = REDIS_CONTAINER.getHost();
      Integer redisPort = REDIS_CONTAINER.getFirstMappedPort();

      LOG.info("Redis container started at {}:{}", redisHost, redisPort);

      LOG.info("Redis test container started via system properties");
    } else {
      LOG.info(
          "Redis cache not enabled for tests (enableCache={}, cacheType={})",
          enableCache,
          cacheType);
    }
  }

  private static void setupRdfIfEnabled() {
    String enableRdf = System.getProperty("enableRdf");
    String rdfContainerImage = System.getProperty("rdfContainerImage");
    if ("true".equals(enableRdf)) {
      LOG.info("RDF is enabled for tests. Starting Fuseki container...");
      if (CommonUtil.nullOrEmpty(rdfContainerImage)) {
        rdfContainerImage = "stain/jena-fuseki:latest";
      }

      try {
        RDF_CONTAINER =
            new GenericContainer<>(DockerImageName.parse(rdfContainerImage))
                .withExposedPorts(3030)
                .withEnv("ADMIN_PASSWORD", "test-admin")
                .withEnv("FUSEKI_DATASET_1", "openmetadata")
                .waitingFor(
                    Wait.forHttp("/$/ping")
                        .forPort(3030)
                        .forStatusCode(200)
                        .withStartupTimeout(Duration.ofMinutes(2)));

        RDF_CONTAINER.start();
        String rdfHost = RDF_CONTAINER.getHost();
        Integer rdfPort = RDF_CONTAINER.getMappedPort(3030);

        LOG.info("Fuseki container started at {}:{}", rdfHost, rdfPort);

        LOG.info("RDF container started for tests");
      } catch (Exception e) {
        LOG.warn("Failed to start RDF container, disabling RDF for tests", e);
        // If container fails to start, disable RDF but continue tests
        if (APP != null && APP.getConfiguration() != null) {
          APP.getConfiguration().getRdfConfiguration().setEnabled(false);
        }
      }
    } else {
      LOG.info("RDF not enabled for tests (enableRdf={})", enableRdf);
    }
  }

  private static void overrideDatabaseConfig(JdbcDatabaseContainer<?> sqlContainer) {
    // Deprecated in favor of applyDatabaseConfig
    configOverrides.add(
        ConfigOverride.config("database.driverClass", sqlContainer.getDriverClassName()));
    configOverrides.add(ConfigOverride.config("database.url", sqlContainer.getJdbcUrl()));
    configOverrides.add(ConfigOverride.config("database.user", sqlContainer.getUsername()));
    configOverrides.add(ConfigOverride.config("database.password", sqlContainer.getPassword()));
  }

  private static void applyDatabaseConfig(
      OpenMetadataApplicationConfig config, JdbcDatabaseContainer<?> sqlContainer) {
    DataSourceFactory ds = config.getDataSourceFactory();
    if (ds == null) {
      ds = new DataSourceFactory();
      config.setDataSourceFactory(ds);
    }
    ds.setDriverClass(sqlContainer.getDriverClassName());
    ds.setUrl(sqlContainer.getJdbcUrl());
    ds.setUser(sqlContainer.getUsername());
    ds.setPassword(sqlContainer.getPassword());
  }

  private static void applyRedisConfigIfPresent(OpenMetadataApplicationConfig config) {
    if (REDIS_CONTAINER != null) {
      CacheConfiguration cc = new CacheConfiguration();
      cc.setEnabled(true);
      cc.setProvider(CacheConfiguration.CacheProvider.REDIS_STANDALONE);
      cc.setHost(REDIS_CONTAINER.getHost());
      cc.setPort(REDIS_CONTAINER.getFirstMappedPort());
      cc.setAuthType(CacheConfiguration.AuthType.PASSWORD);
      cc.setPassword("test-password");
      cc.setUseSsl(false);
      cc.setDatabase(0);
      cc.setTtlSeconds(3600);
      cc.setConnectionTimeoutSecs(5);
      cc.setSocketTimeoutSecs(60);
      cc.setMaxRetries(3);
      cc.setWarmupEnabled(true);
      cc.setWarmupThreads(2);
      config.setCacheConfiguration(cc);
      LOG.info("Applied Redis cache settings to config: {}:{}", cc.getHost(), cc.getPort());
    }
  }

  private static void applyRdfConfigIfPresent(OpenMetadataApplicationConfig config) {
    if (RDF_CONTAINER != null) {
      String rdfHost = RDF_CONTAINER.getHost();
      Integer rdfPort = RDF_CONTAINER.getMappedPort(3030);
      config.getRdfConfiguration().setEnabled(true);
      config
          .getRdfConfiguration()
          .setStorageType(
              org.openmetadata.schema.api.configuration.rdf.RdfConfiguration.StorageType.FUSEKI);
      config
          .getRdfConfiguration()
          .setRemoteEndpoint(
              java.net.URI.create(String.format("http://%s:%d/openmetadata", rdfHost, rdfPort)));
      config.getRdfConfiguration().setUsername("admin");
      config.getRdfConfiguration().setPassword("test-admin");
      config.getRdfConfiguration().setBaseUri(java.net.URI.create("https://open-metadata.org/"));
      LOG.info("Applied RDF settings to config: {}:{}", rdfHost, rdfPort);
    }
  }

  private static ElasticSearchConfiguration getEsConfig() {
    ElasticSearchConfiguration esConfig = new ElasticSearchConfiguration();
    esConfig
        .withHost(HOST)
        .withPort(ELASTIC_SEARCH_CONTAINER.getMappedPort(9200))
        .withUsername(ELASTIC_USER)
        .withPassword(ELASTIC_PASSWORD)
        .withScheme(ELASTIC_SCHEME)
        .withConnectionTimeoutSecs(ELASTIC_CONNECT_TIMEOUT)
        .withSocketTimeoutSecs(ELASTIC_SOCKET_TIMEOUT)
        .withKeepAliveTimeoutSecs(ELASTIC_KEEP_ALIVE_TIMEOUT)
        .withBatchSize(ELASTIC_BATCH_SIZE)
        .withSearchIndexMappingLanguage(ELASTIC_SEARCH_INDEX_MAPPING_LANGUAGE)
        .withClusterAlias(ELASTIC_SEARCH_CLUSTER_ALIAS)
        .withSearchType(ELASTIC_SEARCH_TYPE);
    return esConfig;
  }
}
