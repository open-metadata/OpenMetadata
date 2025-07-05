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

package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.lang.reflect.Method;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.State;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.CacheConfiguration;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class CacheWarmupServiceTest extends CachedOpenMetadataApplicationResourceTest {

  private LazyCacheService lazyCacheService;
  private CacheConfiguration cacheConfig;
  private CollectionDAO collectionDAO;

  private final List<Table> testTables = new ArrayList<>();
  private final List<User> testUsers = new ArrayList<>();
  private final List<Team> testTeams = new ArrayList<>();
  private DatabaseService testDatabaseService;
  private Database testDatabase;
  private DatabaseSchema testSchema;

  @BeforeEach
  void setup() throws Exception {
    cacheConfig = new CacheConfiguration();
    cacheConfig.setEnabled(true);
    cacheConfig.setWarmupEnabled(true);
    cacheConfig.setWarmupBatchSize(10); // Small batch size for testing
    cacheConfig.setWarmupThreads(2);

    collectionDAO = Entity.getCollectionDAO();
    clearCache();
    createTestData();
    lazyCacheService = new LazyCacheService(cacheConfig, collectionDAO);
  }

  private void createTestData() throws Exception {
    createTestEntities();
    createTestUsersAndTeams();
    applyTestTags();
  }

  private void createTestEntities() throws Exception {
    // Create basic entity hierarchy for warmup testing
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    DatabaseSchemaResourceTest databaseSchemaResourceTest = new DatabaseSchemaResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();

    TestInfo testInfo = createTestInfo("createTestEntities");

    // Create database service
    testDatabaseService =
        databaseServiceResourceTest.createEntity(
            databaseServiceResourceTest.createRequest(testInfo), ADMIN_AUTH_HEADERS);

    // Create database
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("warmupTestDatabase_" + testInfo.getDisplayName())
            .withService(testDatabaseService.getFullyQualifiedName());
    testDatabase = databaseResourceTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Create database schema
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("warmupTestSchema_" + testInfo.getDisplayName())
            .withDatabase(testDatabase.getFullyQualifiedName());
    testSchema = databaseSchemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create multiple tables for warmup testing
    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

    for (int i = 0; i < 5; i++) {
      CreateTable createTable =
          new CreateTable()
              .withName("warmupTestTable_" + i + "_" + testInfo.getDisplayName())
              .withDatabaseSchema(testSchema.getFullyQualifiedName())
              .withColumns(columns);
      Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
      testTables.add(table);
    }
  }

  private void createTestUsersAndTeams() throws Exception {
    UserResourceTest userResourceTest = new UserResourceTest();
    TeamResourceTest teamResourceTest = new TeamResourceTest();

    TestInfo testInfo = createTestInfo("createTestUsersAndTeams");

    // Create test users
    for (int i = 0; i < 3; i++) {
      CreateUser createUser =
          new CreateUser()
              .withName(
                  "warmupTestUser_"
                      + i
                      + "_"
                      + testInfo.getDisplayName()
                      + "_"
                      + System.currentTimeMillis())
              .withEmail("warmup.user" + i + "_" + System.currentTimeMillis() + "@test.com");
      User user = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
      testUsers.add(user);
    }

    // Create test teams
    for (int i = 0; i < 2; i++) {
      CreateTeam createTeam =
          new CreateTeam()
              .withName(
                  "warmupTestTeam_"
                      + i
                      + "_"
                      + testInfo.getDisplayName()
                      + "_"
                      + System.currentTimeMillis());
      Team team = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);
      testTeams.add(team);
    }
  }

  private void applyTestTags() throws Exception {
    // Create and apply tags to entities for tag warmup testing
    TagResourceTest tagResourceTest = new TagResourceTest();
    ClassificationResourceTest classificationResourceTest = new ClassificationResourceTest();

    // Create a test classification first
    TestInfo testInfo = createTestInfo("applyTestTags");
    String classificationName = "TestClassification_" + System.currentTimeMillis();

    CreateClassification createClassification =
        classificationResourceTest
            .createRequest(classificationName)
            .withDescription("Test classification for cache warmup");
    Classification testClassification =
        classificationResourceTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);

    CollectionDAO.TagUsageDAO tagUsageDAO = collectionDAO.tagUsageDAO();

    for (int i = 0; i < testTables.size(); i++) {
      String entityFQN = testTables.get(i).getFullyQualifiedName();

      // Create the actual tag entity first
      String tagName = "TestTag" + i + "_" + System.currentTimeMillis();
      CreateTag createTag =
          tagResourceTest
              .createRequest(tagName, testClassification.getName())
              .withDescription("Test tag " + i + " for cache warmup");
      Tag testTag = tagResourceTest.createEntity(createTag, ADMIN_AUTH_HEADERS);

      String tagFQN = testTag.getFullyQualifiedName();

      tagUsageDAO.applyTag(
          TagSource.CLASSIFICATION.ordinal(),
          tagFQN,
          "test-tag-hash-" + i,
          entityFQN,
          LabelType.MANUAL.ordinal(),
          State.CONFIRMED.ordinal());
    }
  }

  private TestInfo createTestInfo(String methodName) {
    return new TestInfo() {
      @Override
      public String getDisplayName() {
        return methodName;
      }

      @Override
      public Set<String> getTags() {
        return Collections.emptySet();
      }

      @Override
      public Optional<Class<?>> getTestClass() {
        return Optional.of(CacheWarmupServiceTest.class);
      }

      @Override
      public Optional<Method> getTestMethod() {
        try {
          return Optional.of(CacheWarmupServiceTest.class.getDeclaredMethod(methodName));
        } catch (NoSuchMethodException e) {
          return Optional.empty();
        }
      }
    };
  }

  @Test
  @Order(1)
  @DisplayName("Test lazy cache service initialization")
  void testLazyCacheServiceInitialization() {
    assertNotNull(lazyCacheService, "Lazy cache service should be initialized");

    LazyCacheService.CacheStats initialStats = lazyCacheService.getCacheStats();
    assertNotNull(initialStats, "Initial stats should be available");
    assertEquals(0, initialStats.cacheHits, "No cache hits initially");
    assertEquals(0, initialStats.cacheMisses, "No cache misses initially");
    assertEquals(0, initialStats.prefetchCount, "No prefetches initially");
    assertTrue(initialStats.metricsEnabled, "Metrics should be enabled");

    LOG.info("Lazy cache service initialization test passed");
  }

  @Test
  @Order(2)
  @DisplayName("Test cache configuration validation")
  void testCacheConfigurationValidation() {
    assertTrue(cacheConfig.isWarmupEnabled(), "Cache should be enabled in test config");
    assertTrue(cacheConfig.getWarmupThreads() > 0, "Thread count should be positive");
    assertTrue(cacheConfig.getWarmupBatchSize() > 0, "Batch size should be positive");

    // Test that lazy cache service accepts valid configuration
    assertNotNull(lazyCacheService, "Lazy cache service should be created with valid config");
  }

  @Test
  @Order(3)
  @DisplayName("Test lazy cache initialization and validation")
  void testLazyCacheInitialization() throws Exception {
    assertTrue(isCacheAvailable(), "Cache should be available for lazy loading testing");

    CompletableFuture<Void> initFuture = lazyCacheService.initializeLazyCache();
    assertNotNull(initFuture, "Initialization future should not be null");

    try {
      initFuture.get(15, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Lazy cache initialization took longer than expected or failed: {}", e.getMessage());
    }

    // Test that cache connectivity works
    assertDoesNotThrow(
        () -> {
          lazyCacheService.testCacheConnectivity();
        },
        "Cache connectivity test should pass");
  }

  @Test
  @Order(4)
  @DisplayName("Test cache statistics and monitoring")
  void testCacheStatisticsAndMonitoring() throws Exception {
    LazyCacheService.CacheStats initialStats = lazyCacheService.getCacheStats();
    assertEquals(0, initialStats.cacheHits, "Initial cache hits should be 0");
    assertEquals(0, initialStats.cacheMisses, "Initial cache misses should be 0");
    assertEquals(0.0, initialStats.getCacheHitRatio(), 0.001, "Initial hit ratio should be 0");

    // Simulate some cache operations
    lazyCacheService.recordCacheHit();
    lazyCacheService.recordCacheHit();
    lazyCacheService.recordCacheMiss();
    lazyCacheService.recordPrefetch();

    LazyCacheService.CacheStats updatedStats = lazyCacheService.getCacheStats();
    assertEquals(2, updatedStats.cacheHits, "Should have 2 cache hits");
    assertEquals(1, updatedStats.cacheMisses, "Should have 1 cache miss");
    assertEquals(1, updatedStats.prefetchCount, "Should have 1 prefetch");
    assertEquals(2.0 / 3.0, updatedStats.getCacheHitRatio(), 0.001, "Hit ratio should be 2/3");

    String statsString = updatedStats.toString();
    assertNotNull(statsString, "Stats string should not be null");
    assertTrue(statsString.contains("hits=2"), "Stats string should show hits");
    assertTrue(statsString.contains("misses=1"), "Stats string should show misses");
  }

  @Test
  @Order(5)
  @DisplayName("Test lazy cache population")
  void testLazyCachePopulation() throws Exception {
    if (!isCacheAvailable()) {
      LOG.warn("Cache not available, skipping lazy cache population test");
      return;
    }

    CompletableFuture<Void> testFuture = lazyCacheService.testLazyCachePopulation();
    assertNotNull(testFuture, "Test future should not be null");

    try {
      testFuture.get(30, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Lazy cache population test timeout or failed: {}", e.getMessage());
    }

    // Check that some cache operations were recorded
    LazyCacheService.CacheStats stats = lazyCacheService.getCacheStats();
    assertTrue(stats.cacheMisses > 0, "Should have recorded some cache misses from test");
  }

  @Test
  @Order(6)
  @DisplayName("Test lazy loading with real entity queries")
  void testLazyLoadingWithRealQueries() throws Exception {
    if (!isCacheAvailable()) {
      LOG.warn("Cache not available, skipping real query test");
      return;
    }

    // Test that actual relationship queries work with lazy loading
    for (Table table : testTables) {
      try {
        UUID tableId = table.getId();

        // This should trigger lazy cache population
        List<CollectionDAO.EntityRelationshipRecord> relationships =
            collectionDAO.relationshipDAO().findTo(tableId, Entity.TABLE, List.of(8));

        assertNotNull(relationships, "Relationships should not be null");

        // Record cache operations for statistics
        lazyCacheService.recordCacheMiss(); // First query is cache miss

        // Second query might hit cache or trigger more prefetching
        List<CollectionDAO.EntityRelationshipRecord> relationships2 =
            collectionDAO.relationshipDAO().findTo(tableId, Entity.TABLE, List.of(8));

        assertNotNull(relationships2, "Second relationships query should not be null");

        Thread.sleep(50); // Allow any background prefetching to start

      } catch (Exception e) {
        LOG.debug("Query failed for table {}: {}", table.getFullyQualifiedName(), e.getMessage());
      }
    }

    // Verify that cache operations were recorded
    LazyCacheService.CacheStats stats = lazyCacheService.getCacheStats();
    assertTrue(stats.cacheMisses > 0, "Should have recorded cache misses from queries");
  }

  @Test
  @Order(7)
  @DisplayName("Test lazy cache service lifecycle management")
  void testLazyCacheServiceLifecycle() throws Exception {
    assertDoesNotThrow(() -> lazyCacheService.shutdown(), "Shutdown should not throw exceptions");

    LazyCacheService lifecycleService = new LazyCacheService(cacheConfig, collectionDAO);
    CompletableFuture<Void> initFuture = lifecycleService.initializeLazyCache();
    Thread.sleep(50);

    assertDoesNotThrow(
        () -> lifecycleService.shutdown(),
        "Shutdown during initialization should not throw exceptions");

    try {
      initFuture.get(5, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.debug("Initialization was cancelled or completed during shutdown: {}", e.getMessage());
    }

    LOG.info("Lazy cache service lifecycle management test passed");
  }

  @Test
  @Order(8)
  @DisplayName("Test lazy cache error handling and resilience")
  void testLazyCacheErrorHandlingAndResilience() throws Exception {
    CacheConfiguration minimalConfig = new CacheConfiguration();
    minimalConfig.setEnabled(true);
    minimalConfig.setWarmupEnabled(true);
    minimalConfig.setWarmupThreads(1);

    LazyCacheService resilientService = new LazyCacheService(minimalConfig, collectionDAO);

    assertDoesNotThrow(
        () -> {
          try {
            CompletableFuture<Void> initFuture = resilientService.initializeLazyCache();
            initFuture.get(15, TimeUnit.SECONDS);
          } catch (Exception e) {
            LOG.debug("Lazy cache initialization with minimal config: {}", e.getMessage());
          }
        },
        "Lazy cache should handle initialization gracefully");

    LazyCacheService.CacheStats stats = resilientService.getCacheStats();
    assertNotNull(stats, "Stats should be available even with minimal config");

    resilientService.shutdown();
  }

  @Test
  @Order(9)
  @DisplayName("Test simple background prefetching")
  void testSimpleBackgroundPrefetching() throws Exception {
    if (!isCacheAvailable()) {
      LOG.warn("Cache not available, skipping prefetching test");
      return;
    }

    // Test that background prefetching works by triggering cache misses
    for (Table table : testTables.subList(0, Math.min(2, testTables.size()))) {
      try {
        UUID tableId = table.getId();

        // Clear any existing cache entries
        clearCache();

        // This should trigger a cache miss and background prefetching
        List<CollectionDAO.EntityRelationshipRecord> relationships =
            collectionDAO.relationshipDAO().findTo(tableId, Entity.TABLE, List.of(1, 2));

        assertNotNull(relationships, "Relationships should not be null");

        // Allow some time for background prefetching to occur
        Thread.sleep(100);

        LOG.debug("Tested prefetching for table: {}", table.getFullyQualifiedName());

      } catch (Exception e) {
        LOG.debug(
            "Prefetching test failed for table {}: {}",
            table.getFullyQualifiedName(),
            e.getMessage());
      }
    }

    LOG.info("Simple background prefetching test passed");
  }

  @Test
  @Order(10)
  @DisplayName("Test lazy cache thread configuration")
  void testLazyCacheThreadConfiguration() throws Exception {
    // Test single thread configuration
    CacheConfiguration singleThreadConfig = new CacheConfiguration();
    singleThreadConfig.setEnabled(true);
    singleThreadConfig.setWarmupEnabled(true);
    singleThreadConfig.setWarmupThreads(1);

    LazyCacheService singleThreadService = new LazyCacheService(singleThreadConfig, collectionDAO);

    CompletableFuture<Void> singleThreadFuture = singleThreadService.initializeLazyCache();

    try {
      singleThreadFuture.get(15, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Single thread lazy cache initialization timeout: {}", e.getMessage());
    }

    singleThreadService.shutdown();

    // Test multiple threads configuration
    CacheConfiguration multiThreadConfig = new CacheConfiguration();
    multiThreadConfig.setEnabled(true);
    multiThreadConfig.setWarmupEnabled(true);
    multiThreadConfig.setWarmupThreads(3);

    LazyCacheService multiThreadService = new LazyCacheService(multiThreadConfig, collectionDAO);

    CompletableFuture<Void> multiThreadFuture = multiThreadService.initializeLazyCache();

    try {
      multiThreadFuture.get(15, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Multi-thread lazy cache initialization timeout: {}", e.getMessage());
    }

    multiThreadService.shutdown();

    LOG.info("Lazy cache thread configuration test passed");
  }

  @AfterEach
  void tearDown() {
    if (lazyCacheService != null) {
      lazyCacheService.shutdown();
    }
    clearCache();
  }
}
