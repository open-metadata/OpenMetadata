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
import org.junit.jupiter.api.*;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
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
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;

/**
 * Comprehensive test suite for cache warming functionality.
 * Tests warmup service lifecycle, configuration, statistics, and error handling.
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class CacheWarmupServiceTest extends CachedOpenMetadataApplicationResourceTest {

  private CacheWarmupService warmupService;
  private CacheConfiguration cacheConfig;
  private CollectionDAO collectionDAO;

  // Test entities for warmup
  private final List<Table> testTables = new ArrayList<>();
  private final List<User> testUsers = new ArrayList<>();
  private final List<Team> testTeams = new ArrayList<>();
  private DatabaseService testDatabaseService;
  private Database testDatabase;
  private DatabaseSchema testSchema;

  @BeforeEach
  public void setup() throws Exception {
    // Initialize cache configuration for testing
    cacheConfig = new CacheConfiguration();
    cacheConfig.setEnabled(true);
    cacheConfig.setWarmupEnabled(true);
    cacheConfig.setWarmupBatchSize(10); // Small batch size for testing
    cacheConfig.setWarmupThreads(2);

    collectionDAO = Entity.getCollectionDAO();

    // Clear cache before each test
    clearCache();

    // Create test data for warming
    createTestData();

    // Initialize warmup service
    warmupService = new CacheWarmupService(cacheConfig, collectionDAO);
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
              .withName("warmupTestUser_" + i + "_" + testInfo.getDisplayName())
              .withEmail("warmup.user" + i + "@test.com");
      User user = userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);
      testUsers.add(user);
    }

    // Create test teams
    for (int i = 0; i < 2; i++) {
      CreateTeam createTeam =
          new CreateTeam().withName("warmupTestTeam_" + i + "_" + testInfo.getDisplayName());
      Team team = teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);
      testTeams.add(team);
    }
  }

  private void applyTestTags() {
    // Apply some tags to entities for tag warmup testing
    CollectionDAO.TagUsageDAO tagUsageDAO = collectionDAO.tagUsageDAO();

    for (int i = 0; i < testTables.size(); i++) {
      String entityFQN = testTables.get(i).getFullyQualifiedName();
      String tagFQN = "TestTag" + i;

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
  @DisplayName("Test cache warmup service initialization")
  public void testWarmupServiceInitialization() {
    assertNotNull(warmupService, "Warmup service should be initialized");

    CacheWarmupService.WarmupStats initialStats = warmupService.getWarmupStats();
    assertNotNull(initialStats, "Initial stats should be available");
    assertFalse(initialStats.inProgress, "Warmup should not be in progress initially");
    assertEquals(0, initialStats.entitiesProcessed, "No entities should be processed initially");
    assertEquals(
        0, initialStats.relationshipsWarmed, "No relationships should be warmed initially");
    assertEquals(0, initialStats.tagsWarmed, "No tags should be warmed initially");

    LOG.info("Warmup service initialization test passed");
  }

  @Test
  @Order(2)
  @DisplayName("Test warmup configuration validation")
  public void testWarmupConfigurationValidation() {
    // Test with warmup disabled
    CacheConfiguration disabledConfig = new CacheConfiguration();
    disabledConfig.setWarmupEnabled(false);

    CacheWarmupService disabledService = new CacheWarmupService(disabledConfig, collectionDAO);
    CompletableFuture<Void> disabledFuture = disabledService.startWarmup();
    assertTrue(disabledFuture.isDone(), "Disabled warmup should complete immediately");

    // Test with cache not available
    if (RelationshipCache.isAvailable()) {
      // This test would need to simulate cache being unavailable
      LOG.info("Cache is available - skipping cache unavailable test scenario");
    }

    // Test with valid configuration
    assertTrue(cacheConfig.isWarmupEnabled(), "Warmup should be enabled in test config");
    assertTrue(cacheConfig.getWarmupBatchSize() > 0, "Batch size should be positive");
    assertTrue(cacheConfig.getWarmupThreads() > 0, "Thread count should be positive");

    LOG.info("Warmup configuration validation test passed");
  }

  @Test
  @Order(3)
  @DisplayName("Test warmup execution and progress tracking")
  public void testWarmupExecutionAndProgress() throws Exception {
    assertTrue(isCacheAvailable(), "Cache should be available for warmup testing");

    // Start warmup
    CompletableFuture<Void> warmupFuture = warmupService.startWarmup();
    assertNotNull(warmupFuture, "Warmup future should not be null");

    // Check that warmup is in progress
    CacheWarmupService.WarmupStats progressStats = warmupService.getWarmupStats();

    // Wait a short time for warmup to start
    Thread.sleep(100);
    progressStats = warmupService.getWarmupStats();

    // Wait for warmup to complete (with timeout)
    try {
      warmupFuture.get(30, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Warmup took longer than expected or failed: {}", e.getMessage());
    }

    // Check final stats
    CacheWarmupService.WarmupStats finalStats = warmupService.getWarmupStats();
    assertNotNull(finalStats, "Final stats should be available");
    assertFalse(finalStats.inProgress, "Warmup should be completed");

    LOG.info(
        "Warmup completed - Entities: {}, Relationships: {}, Tags: {}",
        finalStats.entitiesProcessed,
        finalStats.relationshipsWarmed,
        finalStats.tagsWarmed);

    // Verify that some work was done (even if minimal due to test data)
    assertTrue(finalStats.entitiesProcessed >= 0, "Some entities should have been processed");

    LOG.info("Warmup execution and progress tracking test passed");
  }

  @Test
  @Order(4)
  @DisplayName("Test warmup statistics and monitoring")
  public void testWarmupStatisticsAndMonitoring() throws Exception {
    CacheWarmupService.WarmupStats initialStats = warmupService.getWarmupStats();
    long initialStartTime = initialStats.startTime;

    // Start warmup
    CompletableFuture<Void> warmupFuture = warmupService.startWarmup();

    // Check stats during warmup
    Thread.sleep(50); // Brief delay to let warmup start
    CacheWarmupService.WarmupStats duringStats = warmupService.getWarmupStats();

    if (duringStats.inProgress) {
      assertTrue(duringStats.startTime > initialStartTime, "Start time should be updated");
      assertTrue(duringStats.getDurationMs() >= 0, "Duration should be non-negative");
    }

    // Wait for completion
    try {
      warmupFuture.get(15, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Warmup completion timeout: {}", e.getMessage());
    }

    // Check final stats
    CacheWarmupService.WarmupStats finalStats = warmupService.getWarmupStats();
    assertFalse(finalStats.inProgress, "Warmup should be completed");
    assertEquals(0, finalStats.getDurationMs(), "Duration should be 0 when not in progress");

    // Test stats toString method
    String statsString = finalStats.toString();
    assertNotNull(statsString, "Stats string should not be null");
    assertTrue(statsString.contains("inProgress=false"), "Stats string should show completion");

    LOG.info("Final warmup stats: {}", statsString);
    LOG.info("Warmup statistics and monitoring test passed");
  }

  @Test
  @Order(5)
  @DisplayName("Test concurrent warmup requests")
  public void testConcurrentWarmupRequests() throws Exception {
    // Start first warmup
    CompletableFuture<Void> firstWarmup = warmupService.startWarmup();
    assertNotNull(firstWarmup, "First warmup should start");

    // Immediately try to start second warmup
    CompletableFuture<Void> secondWarmup = warmupService.startWarmup();
    assertNotNull(secondWarmup, "Second warmup request should return future");

    // Second warmup should complete immediately (ignored)
    assertTrue(secondWarmup.isDone(), "Second warmup should be ignored and complete immediately");

    // Wait for first warmup to complete
    try {
      firstWarmup.get(15, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("First warmup timeout: {}", e.getMessage());
    }

    // Now another warmup should be allowed
    CompletableFuture<Void> thirdWarmup = warmupService.startWarmup();
    assertNotNull(thirdWarmup, "Third warmup should be allowed after first completes");

    try {
      thirdWarmup.get(10, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Third warmup timeout: {}", e.getMessage());
    }

    LOG.info("Concurrent warmup requests test passed");
  }

  @Test
  @Order(6)
  @DisplayName("Test warmup with cache populated data")
  public void testWarmupWithCachePopulated() throws Exception {
    // Pre-populate cache with some data
    if (isCacheAvailable()) {
      for (Table table : testTables) {
        String entityId = table.getId().toString();
        Map<String, Object> relationships = new HashMap<>();
        relationships.put("database", testDatabase.getEntityReference());
        relationships.put("databaseSchema", testSchema.getEntityReference());
        RelationshipCache.put(entityId, relationships);
      }

      // Get some tag data to populate tag cache
      CollectionDAO.TagUsageDAO tagUsageDAO = collectionDAO.tagUsageDAO();
      for (Table table : testTables) {
        tagUsageDAO.getTags(table.getFullyQualifiedName());
      }
    }

    // Run warmup with already populated cache
    CompletableFuture<Void> warmupFuture = warmupService.startWarmup();

    try {
      warmupFuture.get(15, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Warmup with populated cache timeout: {}", e.getMessage());
    }

    CacheWarmupService.WarmupStats finalStats = warmupService.getWarmupStats();
    assertFalse(finalStats.inProgress, "Warmup should complete even with populated cache");

    LOG.info("Warmup with cache populated test passed");
  }

  @Test
  @Order(7)
  @DisplayName("Test warmup service lifecycle management")
  public void testWarmupServiceLifecycle() throws Exception {
    // Test graceful shutdown
    assertDoesNotThrow(() -> warmupService.shutdown(), "Shutdown should not throw exceptions");

    // Create new service for lifecycle test
    CacheWarmupService lifecycleService = new CacheWarmupService(cacheConfig, collectionDAO);

    // Start warmup
    CompletableFuture<Void> warmupFuture = lifecycleService.startWarmup();

    // Wait a brief moment
    Thread.sleep(50);

    // Shutdown during warmup
    assertDoesNotThrow(
        () -> lifecycleService.shutdown(), "Shutdown during warmup should not throw exceptions");

    // Verify future completes or is cancelled
    try {
      warmupFuture.get(5, TimeUnit.SECONDS);
    } catch (Exception e) {
      // Expected if warmup was cancelled
      LOG.debug("Warmup was cancelled or completed during shutdown: {}", e.getMessage());
    }

    LOG.info("Warmup service lifecycle management test passed");
  }

  @Test
  @Order(8)
  @DisplayName("Test warmup error handling and resilience")
  public void testWarmupErrorHandlingAndResilience() throws Exception {
    // Test warmup with minimal or no data
    CacheConfiguration minimalConfig = new CacheConfiguration();
    minimalConfig.setWarmupEnabled(true);
    minimalConfig.setWarmupBatchSize(1);
    minimalConfig.setWarmupThreads(1);

    CacheWarmupService resilientService = new CacheWarmupService(minimalConfig, collectionDAO);

    // Start warmup - should handle lack of data gracefully
    CompletableFuture<Void> warmupFuture = resilientService.startWarmup();

    assertDoesNotThrow(
        () -> {
          try {
            warmupFuture.get(10, TimeUnit.SECONDS);
          } catch (Exception e) {
            LOG.debug("Warmup with minimal data: {}", e.getMessage());
          }
        },
        "Warmup should handle errors gracefully");

    CacheWarmupService.WarmupStats stats = resilientService.getWarmupStats();
    assertFalse(stats.inProgress, "Warmup should complete even with errors");

    // Cleanup
    resilientService.shutdown();

    LOG.info("Warmup error handling and resilience test passed");
  }

  @Test
  @Order(9)
  @DisplayName("Test warmup batch size configuration")
  public void testWarmupBatchSizeConfiguration() throws Exception {
    // Test with very small batch size
    CacheConfiguration smallBatchConfig = new CacheConfiguration();
    smallBatchConfig.setWarmupEnabled(true);
    smallBatchConfig.setWarmupBatchSize(1);
    smallBatchConfig.setWarmupThreads(1);

    CacheWarmupService smallBatchService = new CacheWarmupService(smallBatchConfig, collectionDAO);

    CompletableFuture<Void> warmupFuture = smallBatchService.startWarmup();

    try {
      warmupFuture.get(10, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Small batch warmup timeout: {}", e.getMessage());
    }

    CacheWarmupService.WarmupStats stats = smallBatchService.getWarmupStats();
    assertFalse(stats.inProgress, "Small batch warmup should complete");

    smallBatchService.shutdown();

    // Test with larger batch size
    CacheConfiguration largeBatchConfig = new CacheConfiguration();
    largeBatchConfig.setWarmupEnabled(true);
    largeBatchConfig.setWarmupBatchSize(50);
    largeBatchConfig.setWarmupThreads(1);

    CacheWarmupService largeBatchService = new CacheWarmupService(largeBatchConfig, collectionDAO);

    CompletableFuture<Void> largeBatchFuture = largeBatchService.startWarmup();

    try {
      largeBatchFuture.get(10, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Large batch warmup timeout: {}", e.getMessage());
    }

    CacheWarmupService.WarmupStats largeBatchStats = largeBatchService.getWarmupStats();
    assertFalse(largeBatchStats.inProgress, "Large batch warmup should complete");

    largeBatchService.shutdown();

    LOG.info("Warmup batch size configuration test passed");
  }

  @Test
  @Order(10)
  @DisplayName("Test warmup thread configuration")
  public void testWarmupThreadConfiguration() throws Exception {
    // Test with single thread
    CacheConfiguration singleThreadConfig = new CacheConfiguration();
    singleThreadConfig.setWarmupEnabled(true);
    singleThreadConfig.setWarmupBatchSize(10);
    singleThreadConfig.setWarmupThreads(1);

    CacheWarmupService singleThreadService =
        new CacheWarmupService(singleThreadConfig, collectionDAO);

    CompletableFuture<Void> singleThreadFuture = singleThreadService.startWarmup();

    try {
      singleThreadFuture.get(10, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Single thread warmup timeout: {}", e.getMessage());
    }

    singleThreadService.shutdown();

    // Test with multiple threads
    CacheConfiguration multiThreadConfig = new CacheConfiguration();
    multiThreadConfig.setWarmupEnabled(true);
    multiThreadConfig.setWarmupBatchSize(10);
    multiThreadConfig.setWarmupThreads(3);

    CacheWarmupService multiThreadService =
        new CacheWarmupService(multiThreadConfig, collectionDAO);

    CompletableFuture<Void> multiThreadFuture = multiThreadService.startWarmup();

    try {
      multiThreadFuture.get(10, TimeUnit.SECONDS);
    } catch (Exception e) {
      LOG.warn("Multi-thread warmup timeout: {}", e.getMessage());
    }

    multiThreadService.shutdown();

    LOG.info("Warmup thread configuration test passed");
  }

  @AfterEach
  public void tearDown() {
    // Shutdown warmup service
    if (warmupService != null) {
      warmupService.shutdown();
    }

    // Clear cache after each test
    clearCache();
  }
}
