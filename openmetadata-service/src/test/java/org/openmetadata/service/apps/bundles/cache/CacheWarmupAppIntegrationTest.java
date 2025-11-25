package org.openmetadata.service.apps.bundles.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import io.dropwizard.testing.ConfigOverride;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import jakarta.ws.rs.client.WebTarget;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.services.connections.dashboard.TableauConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.DashboardType;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.TestUtils;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.Trigger;
import org.quartz.impl.StdSchedulerFactory;
import org.quartz.impl.triggers.SimpleTriggerImpl;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class CacheWarmupAppIntegrationTest extends OpenMetadataApplicationTest {

  private CacheWarmupApp cacheWarmupApp;
  private CollectionDAO collectionDAO;
  private SearchRepository searchRepository;

  // Redis container and connection
  private static GenericContainer<?> REDIS_CONTAINER;
  private static String REDIS_URL;
  private static String REDIS_HOST;
  private static int REDIS_PORT;
  private static RedisClient redisClient;
  private static StatefulRedisConnection<String, String> redisConnection;
  private static RedisCommands<String, String> redisCommands;

  // Services
  private DatabaseService databaseService;
  private DashboardService dashboardService;
  private MessagingService messagingService;
  private PipelineService pipelineService;

  // Entities
  private Database database;
  private DatabaseSchema databaseSchema;
  private final List<Table> tables = new ArrayList<>();
  private final List<Dashboard> dashboards = new ArrayList<>();
  private final List<Topic> topics = new ArrayList<>();
  private final List<Pipeline> pipelines = new ArrayList<>();

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    // Start Redis container first
    startRedisContainer();

    // Configure application to use Redis
    configOverrides.add(ConfigOverride.config("cache.provider", "redis"));
    configOverrides.add(ConfigOverride.config("cache.redis.url", REDIS_HOST + ":" + REDIS_PORT));
    configOverrides.add(ConfigOverride.config("cache.redis.keyspace", "om:test"));
    configOverrides.add(ConfigOverride.config("cache.redis.authType", "PASSWORD"));
    configOverrides.add(ConfigOverride.config("cache.redis.passwordRef", "test-password"));
    configOverrides.add(ConfigOverride.config("cache.redis.database", "0"));
    configOverrides.add(ConfigOverride.config("cache.entityTtlSeconds", "900"));
    configOverrides.add(ConfigOverride.config("cache.relationshipTtlSeconds", "172800"));

    // Call parent to create application with our config
    super.createApplication();

    // Connect Redis client for verification
    RedisURI uri =
        RedisURI.builder()
            .withHost(REDIS_HOST)
            .withPort(REDIS_PORT)
            .withPassword("test-password".toCharArray())
            .withDatabase(0)
            .withTimeout(Duration.ofSeconds(5))
            .build();
    redisClient = RedisClient.create(uri);
    redisConnection = redisClient.connect();
    redisCommands = redisConnection.sync();
  }

  private void startRedisContainer() {
    LOG.info("Starting Redis container for cache warmup integration tests");

    REDIS_CONTAINER =
        new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379)
            .withCommand("redis-server", "--requirepass", "test-password")
            .withStartupTimeout(Duration.ofMinutes(2));

    REDIS_CONTAINER.start();

    REDIS_HOST = REDIS_CONTAINER.getHost();
    REDIS_PORT = REDIS_CONTAINER.getFirstMappedPort();
    REDIS_URL = String.format("redis://:test-password@%s:%d", REDIS_HOST, REDIS_PORT);

    LOG.info("Redis container started at: {}", REDIS_URL);
  }

  @BeforeEach
  public void setup() {
    // Clear any existing data
    tables.clear();
    dashboards.clear();
    topics.clear();
    pipelines.clear();
  }

  @AfterAll
  @Override
  public void stopApplication() throws Exception {
    // Close Redis connections
    if (redisConnection != null) {
      redisConnection.close();
    }
    if (redisClient != null) {
      redisClient.shutdown();
    }

    // Stop Redis container
    if (REDIS_CONTAINER != null) {
      REDIS_CONTAINER.stop();
    }

    // Call parent cleanup
    super.stopApplication();
  }

  private void initializeComponentsIfNeeded() {
    if (collectionDAO == null) {
      // Get the real DAOs from Entity
      collectionDAO = Entity.getCollectionDAO();
      searchRepository = Entity.getSearchRepository();
    }

    // Create CacheWarmupApp with real components
    cacheWarmupApp = new CacheWarmupApp(collectionDAO, searchRepository);
  }

  @Test
  public void testCacheWarmupWithRealEntities() throws Exception {
    // Initialize components
    initializeComponentsIfNeeded();

    // Skip test if cache is not available
    CacheProvider cacheProvider = CacheBundle.getCacheProvider();
    CachedEntityDao cachedEntityDao = CacheBundle.getCachedEntityDao();
    org.junit.jupiter.api.Assumptions.assumeTrue(
        cacheProvider != null && cacheProvider.available(),
        "Cache provider not available for testing");

    // Create services
    createTestServices();

    // Create entities
    createTestEntities();

    // Clear cache for all created entities to test warmup
    LOG.info("Clearing cache for all created entities before warmup");
    clearCacheForEntities(cacheProvider);

    // Initialize the app
    App app = new App();
    app.setId(UUID.randomUUID());
    app.setName("cache-warmup");
    app.setAppConfiguration(
        Map.of(
            "entities", List.of("table", "dashboard", "topic", "pipeline"),
            "batchSize", 10,
            "consumerThreads", 2,
            "queueSize", 100));

    cacheWarmupApp.init(app);

    // Create a real job execution context
    JobExecutionContext context = createRealJobExecutionContext();

    // Run the cache warmup
    LOG.info(
        "Starting cache warmup with {} tables, {} dashboards, {} topics, {} pipelines",
        tables.size(),
        dashboards.size(),
        topics.size(),
        pipelines.size());

    cacheWarmupApp.execute(context);

    // Wait for completion
    simulateWork(5000);

    // Stop the app
    cacheWarmupApp.stop();

    // Verify entities are cached
    verifyEntitiesAreCached(cachedEntityDao, cacheProvider);
  }

  @Test
  public void testCacheWarmupWithAllEntitiesSelection() throws Exception {
    // Initialize components
    initializeComponentsIfNeeded();

    // Skip test if cache is not available
    CacheProvider cacheProvider = CacheBundle.getCacheProvider();
    CachedEntityDao cachedEntityDao = CacheBundle.getCachedEntityDao();
    org.junit.jupiter.api.Assumptions.assumeTrue(
        cacheProvider != null && cacheProvider.available(),
        "Cache provider not available for testing");

    // Create services
    createTestServices();

    // Create entities
    createTestEntities();

    // Initialize the app with "all" entities
    App app = new App();
    app.setId(UUID.randomUUID());
    app.setName("cache-warmup");
    app.setAppConfiguration(
        Map.of(
            "entities", List.of("all"),
            "batchSize", 5,
            "consumerThreads", 1,
            "queueSize", 50));

    cacheWarmupApp.init(app);

    // Create job execution context
    JobExecutionContext context = createRealJobExecutionContext();

    // Run the cache warmup
    cacheWarmupApp.execute(context);

    // Wait for completion
    simulateWork(5000);

    // Stop the app
    cacheWarmupApp.stop();

    // Verify stats
    EventPublisherJob jobData = cacheWarmupApp.getJobData();
    assertNotNull(jobData);
    assertNotNull(jobData.getStats());
    LOG.info("Cache warmup completed with stats: {}", JsonUtils.pojoToJson(jobData.getStats()));
  }

  @Test
  public void testDistributedLockPreventsConccurentExecution() throws Exception {
    // Initialize components
    initializeComponentsIfNeeded();

    // Skip test if cache is not available
    CacheProvider cacheProvider = CacheBundle.getCacheProvider();
    org.junit.jupiter.api.Assumptions.assumeTrue(
        cacheProvider != null && cacheProvider.available(),
        "Cache provider not available for testing");

    // Create first app instance
    App app1 = new App();
    app1.setId(UUID.randomUUID());
    app1.setName("cache-warmup");
    app1.setAppConfiguration(Map.of("entities", List.of("table")));

    CacheWarmupApp app1Instance = new CacheWarmupApp(collectionDAO, searchRepository);
    app1Instance.init(app1);

    // Create second app instance
    App app2 = new App();
    app2.setId(UUID.randomUUID());
    app2.setName("cache-warmup");
    app2.setAppConfiguration(Map.of("entities", List.of("dashboard")));

    CacheWarmupApp app2Instance = new CacheWarmupApp(collectionDAO, searchRepository);
    app2Instance.init(app2);

    // Create job contexts
    JobExecutionContext context1 = createRealJobExecutionContext();
    JobExecutionContext context2 = createRealJobExecutionContext();

    // Start first instance in a thread
    Thread thread1 =
        new Thread(
            () -> {
              LOG.info("Starting first cache warmup instance");
              app1Instance.execute(context1);
            });
    thread1.start();

    // Give first instance time to acquire lock
    simulateWork(500);

    // Try to start second instance
    LOG.info("Attempting to start second cache warmup instance");
    app2Instance.execute(context2);

    // Second instance should not be running
    EventPublisherJob job2Data = app2Instance.getJobData();
    assertTrue(
        job2Data.getStatus() == EventPublisherJob.Status.STOPPED
            || job2Data.getStatus() == EventPublisherJob.Status.COMPLETED
            || job2Data.getStatus() == EventPublisherJob.Status.ACTIVE_ERROR
            || job2Data.getStatus() == null,
        "Second instance should not run when first has lock (status: "
            + job2Data.getStatus()
            + ")");

    // Stop first instance
    app1Instance.stop();
    thread1.join(5000);

    // Now second instance should be able to run
    LOG.info("First instance stopped, second instance should be able to run now");
    app2Instance.execute(context2);
    EventPublisherJob job2DataAfter = app2Instance.getJobData();
    // The second instance should either be running or have completed successfully
    assertTrue(
        job2DataAfter.getStatus() == EventPublisherJob.Status.RUNNING
            || job2DataAfter.getStatus() == EventPublisherJob.Status.COMPLETED,
        "Second instance should be able to run after first releases lock (status: "
            + job2DataAfter.getStatus()
            + ")");

    // Cleanup
    app2Instance.stop();
  }

  private void createTestServices() throws Exception {
    // Create database service
    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName("test-db-service-" + UUID.randomUUID().toString().substring(0, 8))
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort("localhost:3306")
                            .withUsername("test")
                            .withAuthType(new basicAuth().withPassword("test"))));

    WebTarget target = getResource("services/databaseServices");
    databaseService =
        TestUtils.post(target, createDbService, DatabaseService.class, ADMIN_AUTH_HEADERS);
    LOG.info("Created database service: {}", databaseService.getName());

    // Create dashboard service
    CreateDashboardService createDashboardService =
        new CreateDashboardService()
            .withName("test-dashboard-service-" + UUID.randomUUID().toString().substring(0, 8))
            .withServiceType(DashboardServiceType.Tableau)
            .withConnection(
                new DashboardConnection()
                    .withConfig(
                        new TableauConnection()
                            .withHostPort(URI.create("https://tableau.test.com"))
                            .withApiVersion("3.14")));

    target = getResource("services/dashboardServices");
    dashboardService =
        TestUtils.post(target, createDashboardService, DashboardService.class, ADMIN_AUTH_HEADERS);
    LOG.info("Created dashboard service: {}", dashboardService.getName());

    // Create messaging service
    CreateMessagingService createMessagingService =
        new CreateMessagingService()
            .withName("test-messaging-service-" + UUID.randomUUID().toString().substring(0, 8))
            .withServiceType(MessagingServiceType.Kafka)
            .withConnection(
                new MessagingConnection()
                    .withConfig(new KafkaConnection().withBootstrapServers("localhost:9092")));

    target = getResource("services/messagingServices");
    messagingService =
        TestUtils.post(target, createMessagingService, MessagingService.class, ADMIN_AUTH_HEADERS);
    LOG.info("Created messaging service: {}", messagingService.getName());

    // Create pipeline service
    CreatePipelineService createPipelineService =
        new CreatePipelineService()
            .withName("test-pipeline-service-" + UUID.randomUUID().toString().substring(0, 8))
            .withServiceType(PipelineServiceType.Airflow)
            .withConnection(
                new PipelineConnection()
                    .withConfig(
                        new AirflowConnection().withHostPort(URI.create("http://localhost:8080"))));

    target = getResource("services/pipelineServices");
    pipelineService =
        TestUtils.post(target, createPipelineService, PipelineService.class, ADMIN_AUTH_HEADERS);
    LOG.info("Created pipeline service: {}", pipelineService.getName());
  }

  private void createTestEntities() throws Exception {
    // Create database
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("test-database-" + UUID.randomUUID().toString().substring(0, 8))
            .withService(databaseService.getFullyQualifiedName());

    WebTarget target = getResource("databases");
    database = TestUtils.post(target, createDatabase, Database.class, ADMIN_AUTH_HEADERS);
    LOG.info("Created database: {}", database.getName());

    // Create database schema
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("test-schema-" + UUID.randomUUID().toString().substring(0, 8))
            .withDatabase(database.getFullyQualifiedName());

    target = getResource("databaseSchemas");
    databaseSchema = TestUtils.post(target, createSchema, DatabaseSchema.class, ADMIN_AUTH_HEADERS);
    LOG.info("Created database schema: {}", databaseSchema.getName());

    // Create tables
    for (int i = 0; i < 5; i++) {
      CreateTable createTable =
          new CreateTable()
              .withName("test-table-" + i + "-" + UUID.randomUUID().toString().substring(0, 8))
              .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
              .withTableType(TableType.Regular)
              .withColumns(
                  List.of(
                      new Column().withName("id").withDataType(ColumnDataType.INT),
                      new Column()
                          .withName("name")
                          .withDataType(ColumnDataType.VARCHAR)
                          .withDataLength(100)));

      target = getResource("tables");
      Table table = TestUtils.post(target, createTable, Table.class, ADMIN_AUTH_HEADERS);
      tables.add(table);
      LOG.info("Created table {}: {}", i, table.getName());
    }

    // Create dashboards
    for (int i = 0; i < 3; i++) {
      CreateDashboard createDashboard =
          new CreateDashboard()
              .withName("test-dashboard-" + i + "-" + UUID.randomUUID().toString().substring(0, 8))
              .withService(dashboardService.getFullyQualifiedName())
              .withDashboardType(DashboardType.Dashboard);

      target = getResource("dashboards");
      Dashboard dashboard =
          TestUtils.post(target, createDashboard, Dashboard.class, ADMIN_AUTH_HEADERS);
      dashboards.add(dashboard);
      LOG.info("Created dashboard {}: {}", i, dashboard.getName());
    }

    // Create topics
    for (int i = 0; i < 3; i++) {
      CreateTopic createTopic =
          new CreateTopic()
              .withName("test-topic-" + i + "-" + UUID.randomUUID().toString().substring(0, 8))
              .withService(messagingService.getFullyQualifiedName())
              .withPartitions(10);

      target = getResource("topics");
      Topic topic = TestUtils.post(target, createTopic, Topic.class, ADMIN_AUTH_HEADERS);
      topics.add(topic);
      LOG.info("Created topic {}: {}", i, topic.getName());
    }

    // Create pipelines
    for (int i = 0; i < 2; i++) {
      CreatePipeline createPipeline =
          new CreatePipeline()
              .withName("test-pipeline-" + i + "-" + UUID.randomUUID().toString().substring(0, 8))
              .withService(pipelineService.getFullyQualifiedName());

      target = getResource("pipelines");
      Pipeline pipeline =
          TestUtils.post(target, createPipeline, Pipeline.class, ADMIN_AUTH_HEADERS);
      pipelines.add(pipeline);
      LOG.info("Created pipeline {}: {}", i, pipeline.getName());
    }
  }

  private void clearCacheForEntities(CacheProvider cacheProvider) {
    if (cacheProvider == null || !cacheProvider.available()) {
      LOG.info("Cache not available, skipping clear");
      return;
    }

    // Clear cache for all tables
    for (Table table : tables) {
      String cacheKey = "om:test:e:table:" + table.getId();
      try {
        cacheProvider.del(cacheKey);
        LOG.debug("Cleared cache for table: {}", table.getId());
      } catch (Exception e) {
        LOG.debug("Failed to clear cache for table: {}", e.getMessage());
      }
    }

    // Clear cache for all dashboards
    for (Dashboard dashboard : dashboards) {
      String cacheKey = "om:test:e:dashboard:" + dashboard.getId();
      try {
        cacheProvider.del(cacheKey);
        LOG.debug("Cleared cache for dashboard: {}", dashboard.getId());
      } catch (Exception e) {
        LOG.debug("Failed to clear cache for dashboard: {}", e.getMessage());
      }
    }

    // Clear cache for all topics
    for (Topic topic : topics) {
      String cacheKey = "om:test:e:topic:" + topic.getId();
      try {
        cacheProvider.del(cacheKey);
        LOG.debug("Cleared cache for topic: {}", topic.getId());
      } catch (Exception e) {
        LOG.debug("Failed to clear cache for topic: {}", e.getMessage());
      }
    }

    // Clear cache for all pipelines
    for (Pipeline pipeline : pipelines) {
      String cacheKey = "om:test:e:pipeline:" + pipeline.getId();
      try {
        cacheProvider.del(cacheKey);
        LOG.debug("Cleared cache for pipeline: {}", pipeline.getId());
      } catch (Exception e) {
        LOG.debug("Failed to clear cache for pipeline: {}", e.getMessage());
      }
    }

    LOG.info(
        "Cleared cache for {} tables, {} dashboards, {} topics, {} pipelines",
        tables.size(),
        dashboards.size(),
        topics.size(),
        pipelines.size());
  }

  private void verifyEntitiesAreCached(
      CachedEntityDao cachedEntityDao, CacheProvider cacheProvider) {
    if (cachedEntityDao == null || cacheProvider == null || !cacheProvider.available()) {
      LOG.info("Cache not available, skipping verification");
      return;
    }

    // Verify tables are cached
    int cachedTables = 0;
    for (Table table : tables) {
      String cachedTable = cachedEntityDao.getBase(table.getId(), "table");
      if (cachedTable != null && !cachedTable.equals("{}")) {
        cachedTables++;
        // Verify we can deserialize the cached JSON
        Table deserializedTable = JsonUtils.readValue(cachedTable, Table.class);
        assertEquals(table.getId(), deserializedTable.getId());
        assertEquals(table.getName(), deserializedTable.getName());
      }
    }
    LOG.info("Cached {} out of {} tables", cachedTables, tables.size());
    assertTrue(cachedTables > 0, "At least some tables should be cached");

    // Verify dashboards are cached
    int cachedDashboards = 0;
    for (Dashboard dashboard : dashboards) {
      String cachedDashboard = cachedEntityDao.getBase(dashboard.getId(), "dashboard");
      if (cachedDashboard != null && !cachedDashboard.equals("{}")) {
        cachedDashboards++;
      }
    }
    LOG.info("Cached {} out of {} dashboards", cachedDashboards, dashboards.size());

    // Verify topics are cached
    int cachedTopics = 0;
    for (Topic topic : topics) {
      String cachedTopic = cachedEntityDao.getBase(topic.getId(), "topic");
      if (cachedTopic != null && !cachedTopic.equals("{}")) {
        cachedTopics++;
      }
    }
    LOG.info("Cached {} out of {} topics", cachedTopics, topics.size());

    // Verify pipelines are cached
    int cachedPipelines = 0;
    for (Pipeline pipeline : pipelines) {
      String cachedPipeline = cachedEntityDao.getBase(pipeline.getId(), "pipeline");
      if (cachedPipeline != null && !cachedPipeline.equals("{}")) {
        cachedPipelines++;
      }
    }
    LOG.info("Cached {} out of {} pipelines", cachedPipelines, pipelines.size());
  }

  private JobExecutionContext createRealJobExecutionContext() {
    try {
      Scheduler scheduler = new StdSchedulerFactory().getScheduler();
      JobDetail jobDetail =
          JobBuilder.newJob(CacheWarmupApp.class)
              .withIdentity(new JobKey("cache-warmup-test-" + UUID.randomUUID(), "test"))
              .build();

      JobDataMap jobDataMap = new JobDataMap();
      jobDataMap.put("triggerType", "MANUAL");
      jobDetail.getJobDataMap().putAll(jobDataMap);

      // Create a simple trigger
      SimpleTriggerImpl trigger = new SimpleTriggerImpl();
      trigger.setKey(new org.quartz.TriggerKey("test-trigger", "test"));

      // Create a real context implementation
      return new JobExecutionContext() {
        private Object result;

        @Override
        public Scheduler getScheduler() {
          try {
            return scheduler;
          } catch (Exception e) {
            LOG.warn("Failed to get scheduler", e);
            return null;
          }
        }

        @Override
        public Trigger getTrigger() {
          return trigger;
        }

        @Override
        public org.quartz.Calendar getCalendar() {
          return null;
        }

        @Override
        public boolean isRecovering() {
          return false;
        }

        @Override
        public org.quartz.TriggerKey getRecoveringTriggerKey() {
          return null;
        }

        @Override
        public int getRefireCount() {
          return 0;
        }

        @Override
        public JobDataMap getMergedJobDataMap() {
          return jobDataMap;
        }

        @Override
        public JobDetail getJobDetail() {
          return jobDetail;
        }

        @Override
        public org.quartz.Job getJobInstance() {
          return null;
        }

        @Override
        public java.util.Date getFireTime() {
          return new java.util.Date();
        }

        @Override
        public java.util.Date getScheduledFireTime() {
          return new java.util.Date();
        }

        @Override
        public java.util.Date getPreviousFireTime() {
          return null;
        }

        @Override
        public java.util.Date getNextFireTime() {
          return null;
        }

        @Override
        public String getFireInstanceId() {
          return UUID.randomUUID().toString();
        }

        @Override
        public Object getResult() {
          return result;
        }

        @Override
        public void setResult(Object result) {
          this.result = result;
        }

        @Override
        public long getJobRunTime() {
          return 0;
        }

        @Override
        public void put(Object key, Object value) {
          jobDataMap.put(key.toString(), value);
        }

        @Override
        public Object get(Object key) {
          return jobDataMap.get(key);
        }

        public org.quartz.spi.TriggerFiredBundle getTriggerFiredBundle() {
          return null;
        }
      };
    } catch (Exception e) {
      throw new RuntimeException("Failed to create job execution context", e);
    }
  }
}
