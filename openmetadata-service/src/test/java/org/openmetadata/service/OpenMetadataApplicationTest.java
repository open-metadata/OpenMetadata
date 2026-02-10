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
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5ClientBuilder;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.jackson.JacksonFeature;
import io.dropwizard.jersey.validation.Validators;
import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
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
import org.apache.hc.client5.http.auth.AuthScope;
import org.apache.hc.client5.http.auth.UsernamePasswordCredentials;
import org.apache.hc.client5.http.impl.auth.BasicCredentialsProvider;
import org.apache.hc.core5.http.HttpHost;
import org.glassfish.jersey.client.ClientConfig;
import org.glassfish.jersey.client.ClientProperties;
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
import org.openmetadata.service.resources.events.MSTeamsCallbackResource;
import org.openmetadata.service.resources.events.SlackCallbackResource;
import org.openmetadata.service.resources.events.WebhookCallbackResource;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRepositoryFactory;
import org.openmetadata.service.util.JdkHttpClientConnector;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.JdbcDatabaseContainer;
import org.testcontainers.containers.wait.strategy.LogMessageWaitStrategy;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.utility.DockerImageName;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class OpenMetadataApplicationTest {
  protected static Boolean runWithOpensearch = false;
  protected static Boolean runWithRdf = false;

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
  public static final ElasticSearchConfiguration.SearchType OPENSEARCH_TYPE =
      ElasticSearchConfiguration.SearchType.OPENSEARCH;
  public static DropwizardAppExtension<OpenMetadataApplicationConfig> APP;
  public static final String MINIO_ACCESS_KEY = "minioadmin";
  public static final String MINIO_SECRET_KEY = "minioadmin";
  public static final String MINIO_BUCKET = "pipeline-logs-test";

  protected static final WebhookCallbackResource webhookCallbackResource =
      new WebhookCallbackResource();
  protected static final SlackCallbackResource slackCallbackResource = new SlackCallbackResource();
  protected static final MSTeamsCallbackResource teamsCallbackResource =
      new MSTeamsCallbackResource();

  public static Jdbi jdbi;
  private static ElasticsearchContainer ELASTIC_SEARCH_CONTAINER;
  private static GenericContainer<?> OPENSEARCH_CONTAINER;
  private static GenericContainer<?> REDIS_CONTAINER;
  private static GenericContainer<?> RDF_CONTAINER;
  private static GenericContainer<?> MINIO_CONTAINER;
  protected static final Set<ConfigOverride> configOverrides = new HashSet<>();

  private static final String JDBC_CONTAINER_CLASS_NAME =
      "org.testcontainers.containers.MySQLContainer";
  private static final String JDBC_CONTAINER_IMAGE = "mysql:8";
  private static final String ELASTIC_SEARCH_CONTAINER_IMAGE =
      "docker.elastic.co/elasticsearch/elasticsearch:9.3.0";
  private static final String OPENSEARCH_CONTAINER_IMAGE = "opensearchproject/opensearch:3.4.0";

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
    sqlContainer.withReuse(false);
    sqlContainer.withStartupTimeoutSeconds(240);
    sqlContainer.withConnectTimeoutSeconds(240);
    sqlContainer.withPassword("password");
    sqlContainer.withUsername("username");
    sqlContainer.start();

    // Note: Added HikariCPDataSourceFactory since this configuration is needed by the
    // WorkflowHandler.
    HikariCPDataSourceFactory dataSourceFactory = new HikariCPDataSourceFactory();
    dataSourceFactory.setUrl(sqlContainer.getJdbcUrl());
    dataSourceFactory.setUser(sqlContainer.getUsername());
    dataSourceFactory.setPassword(sqlContainer.getPassword());
    dataSourceFactory.setDriverClass(sqlContainer.getDriverClassName());
    config.setDataSourceFactory(dataSourceFactory);

    final String nativeMigrationScriptsLocation =
        ResourceHelpers.resourceFilePath("db/sql/migrations/native/");

    // Extension Config
    String extensionMigrationScripsLocation = "";
    try {
      extensionMigrationScripsLocation =
          ResourceHelpers.resourceFilePath("extension/sql/migrations/");
      configOverrides.add(
          ConfigOverride.config(
              "migrationConfiguration.extensionPath", extensionMigrationScripsLocation));
    } catch (Exception ex) {
      LOG.info("Extension migrations not found");
    }

    if (Boolean.TRUE.equals(runWithOpensearch)) {
      String opensearchImage =
          System.getProperty("opensearchContainerImage", OPENSEARCH_CONTAINER_IMAGE);
      LOG.info("Using OpenSearch container with image: {}", opensearchImage);

      OPENSEARCH_CONTAINER =
          new GenericContainer<>(DockerImageName.parse(opensearchImage))
              .withExposedPorts(9200)
              .withEnv("discovery.type", "single-node")
              .withEnv("DISABLE_SECURITY_PLUGIN", "true")
              .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms1g -Xmx1g")
              .withStartupTimeout(Duration.ofMinutes(5))
              .waitingFor(Wait.forHttp("/_cluster/health").forPort(9200));

      OPENSEARCH_CONTAINER.start();

      HOST = OPENSEARCH_CONTAINER.getHost();
      PORT = OPENSEARCH_CONTAINER.getMappedPort(9200).toString();
      overrideSearchConfig(true);
    } else {
      LOG.info("Using Elasticsearch container with image: {}", elasticSearchContainerImage);

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
      overrideSearchConfig(false);
    }
    overrideDatabaseConfig(sqlContainer);

    // Init IndexMapping class
    IndexMappingLoader.init(getSearchConfig());

    // Migration overrides
    configOverrides.add(
        ConfigOverride.config("migrationConfiguration.nativePath", nativeMigrationScriptsLocation));

    // Redis cache configuration (if enabled by system properties)
    setupRedisIfEnabled();

    // RDF configuration (if enabled by system properties)
    setupRdfIfEnabled();

    // MinIO configuration (if enabled by system properties)
    setupMinioIfEnabled();

    ConfigOverride[] configOverridesArray = configOverrides.toArray(new ConfigOverride[0]);
    APP = getApp(configOverridesArray);
    // Run System Migrations
    jdbi =
        Jdbi.create(
            sqlContainer.getJdbcUrl(), sqlContainer.getUsername(), sqlContainer.getPassword());
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(sqlContainer.getDriverClassName()));
    // jdbi.setSqlLogger(new DebugSqlLogger());
    validateAndRunSystemDataMigrations(
        jdbi,
        config,
        ConnectionType.from(sqlContainer.getDriverClassName()),
        nativeMigrationScriptsLocation,
        extensionMigrationScripsLocation,
        false);
    createIndices();
    APP.before();
    createClient();
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
            config.getMigrationConfiguration().getFlywayPath(),
            config,
            forceMigrations);
    // Initialize search repository
    SearchRepository searchRepository = new SearchRepository(getSearchConfig(), 50);
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
  protected DropwizardAppExtension<OpenMetadataApplicationConfig> getApp(
      ConfigOverride[] configOverridesArray) {
    return new DropwizardAppExtension<>(
        OpenMetadataApplication.class, CONFIG_PATH, configOverridesArray);
  }

  private static void createClient() {
    // Use custom JDK HttpClient connector - supports PATCH, handles empty PUT bodies, no Jetty deps
    ClientConfig config = new ClientConfig();
    config.connectorProvider(new JdkHttpClientConnector.Provider());
    config.register(new JacksonFeature(APP.getObjectMapper()));
    // Set reasonable timeouts to prevent indefinite hangs
    config.property(ClientProperties.CONNECT_TIMEOUT, 30_000); // 30 seconds
    config.property(ClientProperties.READ_TIMEOUT, 120_000); // 2 minutes
    client = ClientBuilder.newClient(config);
  }

  @AfterAll
  public void stopApplication() throws Exception {
    // If BeforeAll causes and exception AfterAll still gets called before that exception is thrown.
    // If a NullPointerException is thrown during the cleanup of above it will eat the initial error
    if (APP != null) {
      APP.after();
      APP.getEnvironment().getApplicationContext().getServer().stop();
    }

    // Stop search containers
    if (ELASTIC_SEARCH_CONTAINER != null) {
      ELASTIC_SEARCH_CONTAINER.stop();
    }
    if (OPENSEARCH_CONTAINER != null) {
      OPENSEARCH_CONTAINER.stop();
    }

    // Stop Redis container if it was started
    if (REDIS_CONTAINER != null) {
      try {
        REDIS_CONTAINER.stop();
        LOG.info("Redis container stopped successfully");
      } catch (Exception e) {
        LOG.error("Error stopping Redis container", e);
      }
    }

    // Stop RDF container if it was started
    if (RDF_CONTAINER != null) {
      try {
        RDF_CONTAINER.stop();
        LOG.info("RDF container stopped successfully");
      } catch (Exception e) {
        LOG.error("Error stopping RDF container", e);
      }
    }

    // Stop MinIO container if it was started
    if (MINIO_CONTAINER != null) {
      try {
        MINIO_CONTAINER.stop();
        LOG.info("MinIO container stopped successfully");
      } catch (Exception e) {
        LOG.error("Error stopping MinIO container", e);
      }
    }

    if (client != null) {
      client.close();
    }
  }

  private void createIndices() {
    ElasticSearchConfiguration searchConfig = getSearchConfig();
    SearchRepository searchRepository =
        SearchRepositoryFactory.createSearchRepository(searchConfig, 50);
    Entity.setSearchRepository(searchRepository);
    LOG.info("creating indexes.");
    searchRepository.createIndexes();
  }

  public static Rest5Client getSearchClient() {
    BasicCredentialsProvider credentialsProvider = new BasicCredentialsProvider();
    credentialsProvider.setCredentials(
        new AuthScope(null, -1),
        new UsernamePasswordCredentials(ELASTIC_USER, "password".toCharArray()));

    HttpHost httpHost;
    if (Boolean.TRUE.equals(runWithOpensearch)) {
      httpHost =
          new HttpHost(
              "http", OPENSEARCH_CONTAINER.getHost(), OPENSEARCH_CONTAINER.getMappedPort(9200));
    } else {
      String hostAddress = ELASTIC_SEARCH_CONTAINER.getHttpHostAddress();
      String[] parts = hostAddress.split(":");
      httpHost = new HttpHost("http", parts[0], Integer.parseInt(parts[1]));
    }

    Rest5ClientBuilder builder =
        Rest5Client.builder(httpHost)
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

  private static void overrideSearchConfig(boolean isOpenSearch) {
    // search engine configuration overrides
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
        ConfigOverride.config(
            "elasticsearch.searchType",
            isOpenSearch ? OPENSEARCH_TYPE.value() : ELASTIC_SEARCH_TYPE.value()));
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
              .withReuse(false)
              .withStartupTimeout(Duration.ofMinutes(2));

      REDIS_CONTAINER.start();

      String redisHost = REDIS_CONTAINER.getHost();
      Integer redisPort = REDIS_CONTAINER.getFirstMappedPort();

      LOG.info("Redis container started at {}:{}", redisHost, redisPort);

      // Add Redis configuration overrides for the new cache system
      // Note: redis.url should be host:port without the redis:// scheme
      String redisUrl = String.format("%s:%d", redisHost, redisPort);
      configOverrides.add(ConfigOverride.config("cache.provider", "redis"));
      configOverrides.add(ConfigOverride.config("cache.redis.url", redisUrl));
      configOverrides.add(ConfigOverride.config("cache.redis.keyspace", "om:test"));
      configOverrides.add(ConfigOverride.config("cache.redis.passwordRef", "test-password"));
      configOverrides.add(ConfigOverride.config("cache.redis.connectTimeoutMs", "2000"));
      configOverrides.add(ConfigOverride.config("cache.redis.poolSize", "16"));
      configOverrides.add(ConfigOverride.config("cache.entityTtlSeconds", "900"));
      configOverrides.add(ConfigOverride.config("cache.relationshipTtlSeconds", "900"));
      configOverrides.add(ConfigOverride.config("cache.tagTtlSeconds", "900"));

      LOG.info("Redis configuration overrides added");
    } else {
      LOG.info(
          "Redis cache not enabled for tests (enableCache={}, cacheType={})",
          enableCache,
          cacheType);
    }
  }

  private static void setupRdfIfEnabled() {
    if (Boolean.TRUE.equals(runWithRdf) || "true".equals(System.getProperty("enableRdf"))) {
      String rdfContainerImage = System.getProperty("rdfContainerImage", "stain/jena-fuseki:5.0.0");
      LOG.info(
          "RDF is enabled for tests. Starting Fuseki container with image: {}", rdfContainerImage);

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

        // Add RDF configuration overrides
        configOverrides.add(ConfigOverride.config("rdf.enabled", "true"));
        configOverrides.add(ConfigOverride.config("rdf.storageType", "FUSEKI"));
        configOverrides.add(
            ConfigOverride.config(
                "rdf.remoteEndpoint",
                String.format("http://%s:%d/openmetadata", rdfHost, rdfPort)));
        configOverrides.add(ConfigOverride.config("rdf.username", "admin"));
        configOverrides.add(ConfigOverride.config("rdf.password", "test-admin"));
        configOverrides.add(ConfigOverride.config("rdf.baseUri", "https://open-metadata.org/"));
        configOverrides.add(ConfigOverride.config("rdf.dataset", "openmetadata"));

        LOG.info("RDF configuration overrides added");
      } catch (Exception e) {
        LOG.warn("Failed to start RDF container, disabling RDF for tests", e);
        // If container fails to start, disable RDF but continue tests
        configOverrides.add(ConfigOverride.config("rdf.enabled", "false"));
      }
    } else {
      LOG.info("RDF not enabled for tests (runWithRdf={})", runWithRdf);
      configOverrides.add(ConfigOverride.config("rdf.enabled", "false"));
    }
  }

  private static void overrideDatabaseConfig(JdbcDatabaseContainer<?> sqlContainer) {
    // Database overrides
    configOverrides.add(
        ConfigOverride.config("database.driverClass", sqlContainer.getDriverClassName()));
    configOverrides.add(ConfigOverride.config("database.url", sqlContainer.getJdbcUrl()));
    configOverrides.add(ConfigOverride.config("database.user", sqlContainer.getUsername()));
    configOverrides.add(ConfigOverride.config("database.password", sqlContainer.getPassword()));
  }

  protected static ElasticSearchConfiguration getSearchConfig() {
    ElasticSearchConfiguration searchConfig = new ElasticSearchConfiguration();

    Integer mappedPort;
    ElasticSearchConfiguration.SearchType searchType;

    if (Boolean.TRUE.equals(runWithOpensearch)) {
      mappedPort = OPENSEARCH_CONTAINER.getMappedPort(9200);
      searchType = OPENSEARCH_TYPE;
    } else {
      mappedPort = ELASTIC_SEARCH_CONTAINER.getMappedPort(9200);
      searchType = ELASTIC_SEARCH_TYPE;
    }

    searchConfig
        .withHost(HOST)
        .withPort(mappedPort)
        .withUsername(ELASTIC_USER)
        .withPassword(ELASTIC_PASSWORD)
        .withScheme(ELASTIC_SCHEME)
        .withConnectionTimeoutSecs(ELASTIC_CONNECT_TIMEOUT)
        .withSocketTimeoutSecs(ELASTIC_SOCKET_TIMEOUT)
        .withKeepAliveTimeoutSecs(ELASTIC_KEEP_ALIVE_TIMEOUT)
        .withBatchSize(ELASTIC_BATCH_SIZE)
        .withSearchIndexMappingLanguage(ELASTIC_SEARCH_INDEX_MAPPING_LANGUAGE)
        .withClusterAlias(ELASTIC_SEARCH_CLUSTER_ALIAS)
        .withSearchType(searchType);
    return searchConfig;
  }

  private static void setupMinioIfEnabled() {
    String enableMinio = System.getProperty("enableMinio");
    String minioContainerImage = System.getProperty("minioContainerImage");

    if ("true".equals(enableMinio)) {
      LOG.info("MinIO log storage enabled for tests");

      if (CommonUtil.nullOrEmpty(minioContainerImage)) {
        minioContainerImage = "minio/minio:latest";
      }

      LOG.info("Starting MinIO container with image: {}", minioContainerImage);

      MINIO_CONTAINER =
          new GenericContainer<>(DockerImageName.parse(minioContainerImage))
              .withExposedPorts(9000)
              .withEnv("MINIO_ROOT_USER", "minioadmin")
              .withEnv("MINIO_ROOT_PASSWORD", "minioadmin")
              .withCommand("server", "/data")
              .withReuse(false)
              .withStartupTimeout(Duration.ofMinutes(2))
              .waitingFor(Wait.forHttp("/minio/health/live").forPort(9000));

      MINIO_CONTAINER.start();

      String minioHost = MINIO_CONTAINER.getHost();
      Integer minioPort = MINIO_CONTAINER.getFirstMappedPort();
      String minioEndpoint = String.format("http://%s:%d", minioHost, minioPort);

      MinioClient minioClient =
          MinioClient.builder()
              .endpoint(minioEndpoint)
              .credentials(MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
              .build();

      try {
        if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(MINIO_BUCKET).build())) {
          minioClient.makeBucket(MakeBucketArgs.builder().bucket(MINIO_BUCKET).build());
          LOG.info("Created MinIO bucket: {}", MINIO_BUCKET);
        }
      } catch (Exception e) {
        LOG.error("Failed to create MinIO bucket", e);
        throw new RuntimeException("MinIO setup failed", e);
      }

      LOG.info("MinIO container started at {}", minioEndpoint);

      // Add MinIO configuration overrides
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.type", "s3"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.enabled", "true"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.bucketName",
              "pipeline-logs-test"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.prefix", "test-logs"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.enableServerSideEncryption",
              "false"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.maxConcurrentStreams",
              "10"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.awsConfig.awsAccessKeyId",
              "minioadmin"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.awsConfig.awsSecretAccessKey",
              "minioadmin"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.awsConfig.awsRegion",
              "us-east-1"));
      configOverrides.add(
          ConfigOverride.config(
              "pipelineServiceClientConfiguration.logStorageConfiguration.awsConfig.endPointURL",
              minioEndpoint));
    }
  }

  public static String getMinioEndpointForTests() {
    if (MINIO_CONTAINER != null && MINIO_CONTAINER.isRunning()) {
      return String.format(
          "http://%s:%d", MINIO_CONTAINER.getHost(), MINIO_CONTAINER.getFirstMappedPort());
    }
    return null;
  }
}
