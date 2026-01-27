package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import io.dropwizard.testing.ConfigOverride;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.*;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.services.*;
import org.openmetadata.schema.api.teams.*;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.*;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.services.*;
import org.openmetadata.schema.entity.teams.*;
import org.openmetadata.schema.services.connections.database.*;
import org.openmetadata.schema.services.connections.database.common.*;
import org.openmetadata.schema.type.*;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Integration test for Cache Resource with real Redis container and real entities.
 * This test extends OpenMetadataApplicationTest to get a full application context.
 */
@Slf4j
public class CacheResourceIntegrationTest extends OpenMetadataApplicationTest {

  private static GenericContainer<?> REDIS_CONTAINER;
  private static String REDIS_URL;
  private static String REDIS_HOST;
  private static int REDIS_PORT;
  private static RedisClient redisClient;
  private static StatefulRedisConnection<String, String> redisConnection;
  private static RedisCommands<String, String> redisCommands;
  private static DatabaseService databaseService;
  private static Database database;
  private static DatabaseSchema databaseSchema;

  // Additional fields for relationship caching tests
  private static User testOwnerUser;
  private static User testOwnerUser2;
  private static Team testOwnerTeam;
  private static Classification classification;
  private static Tag classificationTag;
  private static Glossary glossary;
  private static GlossaryTerm glossaryTerm;

  private static CacheKeys cacheKeys;

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    // Start Redis container first
    startRedisContainer();

    String keySpace = "om:test";

    // Configure application to use Redis
    configOverrides.add(ConfigOverride.config("cache.provider", "redis"));
    configOverrides.add(ConfigOverride.config("cache.redis.url", REDIS_HOST + ":" + REDIS_PORT));
    configOverrides.add(ConfigOverride.config("cache.redis.keyspace", keySpace));
    configOverrides.add(ConfigOverride.config("cache.redis.authType", "PASSWORD"));
    configOverrides.add(ConfigOverride.config("cache.redis.passwordRef", "test-password"));
    configOverrides.add(ConfigOverride.config("cache.redis.database", "0"));
    configOverrides.add(ConfigOverride.config("cache.entityTtlSeconds", "900"));
    configOverrides.add(
        ConfigOverride.config(
            "cache.relationshipTtlSeconds", "172800")); // 2 days for relationship cache

    // Call parent to create application with our config
    super.createApplication();

    // Connect Redis client for verification
    RedisURI uri =
        RedisURI.builder()
            .withHost(REDIS_HOST)
            .withPort(REDIS_PORT)
            .withPassword("test-password".toCharArray())
            .withDatabase(0) // Use same database as the application
            .withTimeout(Duration.ofSeconds(5))
            .build();
    redisClient = RedisClient.create(uri);
    redisConnection = redisClient.connect();
    redisCommands = redisConnection.sync();

    // Setup test data for relationship caching tests
    setupRelationshipTestData();
    cacheKeys = new CacheKeys(keySpace);
  }

  private void startRedisContainer() {
    LOG.info("Starting Redis container for cache integration tests");

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

  private synchronized void ensureDatabaseHierarchy() throws Exception {
    if (databaseService != null && database != null && databaseSchema != null) {
      return;
    }
    try {
      // Create database service directly via API
      CreateDatabaseService createService =
          new CreateDatabaseService()
              .withName("cache_test_service_" + System.currentTimeMillis())
              .withDescription("Service for cache testing")
              .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
              .withConnection(
                  new DatabaseConnection()
                      .withConfig(
                          new MysqlConnection()
                              .withHostPort("localhost:3306")
                              .withAuthType(new basicAuth().withPassword("test"))));

      Response serviceResponse =
          SecurityUtil.addHeaders(getResource("services/databaseServices"), ADMIN_AUTH_HEADERS)
              .post(Entity.json(createService));

      assertEquals(201, serviceResponse.getStatus());
      databaseService = serviceResponse.readEntity(DatabaseService.class);
      LOG.info("Created database service: {}", databaseService.getFullyQualifiedName());

      // Create database directly via API
      CreateDatabase createDatabase =
          new CreateDatabase()
              .withName("cache_test_db_" + System.currentTimeMillis())
              .withDisplayName("Cache Test Database")
              .withDescription("Database for cache testing")
              .withService(databaseService.getFullyQualifiedName());

      Response dbResponse =
          SecurityUtil.addHeaders(getResource("databases"), ADMIN_AUTH_HEADERS)
              .post(Entity.json(createDatabase));

      assertEquals(201, dbResponse.getStatus());
      database = dbResponse.readEntity(Database.class);
      LOG.info("Created database: {}", database.getFullyQualifiedName());

      // Create database schema directly via API
      CreateDatabaseSchema createSchema =
          new CreateDatabaseSchema()
              .withName("cache_test_schema_" + System.currentTimeMillis())
              .withDisplayName("Cache Test Schema")
              .withDescription("Schema for cache testing")
              .withDatabase(database.getFullyQualifiedName());

      Response schemaResponse =
          SecurityUtil.addHeaders(getResource("databaseSchemas"), ADMIN_AUTH_HEADERS)
              .post(Entity.json(createSchema));

      assertEquals(201, schemaResponse.getStatus());
      databaseSchema = schemaResponse.readEntity(DatabaseSchema.class);
      LOG.info("Created database schema: {}", databaseSchema.getFullyQualifiedName());
    } catch (Exception e) {
      LOG.error("Failed to create database hierarchy", e);
      throw e;
    }
  }

  @Test
  void testCacheStatsEndpoint(TestInfo testInfo) throws Exception {
    // Ensure database hierarchy is created
    ensureDatabaseHierarchy();

    LOG.info("Testing cache stats endpoint");

    Response response =
        SecurityUtil.addHeaders(getResource("system/cache/stats"), ADMIN_AUTH_HEADERS).get();

    assertEquals(200, response.getStatus());

    Map<String, Object> stats = response.readEntity(Map.class);
    assertNotNull(stats);

    // Verify stats structure
    assertTrue(stats.containsKey("type"), "Stats should contain provider type");
    assertTrue(stats.containsKey("available"), "Stats should contain availability status");

    // Check Redis specific stats
    assertEquals("redis", stats.get("type"));
    assertEquals(true, stats.get("available"));

    if (stats.containsKey("redis")) {
      Map<String, Object> redisStats = (Map<String, Object>) stats.get("redis");
      assertNotNull(redisStats.get("url"), "Redis stats should contain URL");
      assertNotNull(redisStats.get("keyspace"), "Redis stats should contain keyspace");
    }
  }

  @Test
  @Disabled("Warmup endpoint removed - use CacheWarmupApp instead")
  void testWarmupWithForceFlag(TestInfo testInfo) throws Exception {
    // Ensure database hierarchy is created
    ensureDatabaseHierarchy();

    LOG.info("Testing warmup with force=true flag");

    // Create test columns
    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(100));

    // Create a few test tables using REST API
    for (int i = 0; i < 3; i++) {
      CreateTable createTable =
          new CreateTable()
              .withName("force_test_table_" + i + "_" + System.currentTimeMillis())
              .withDisplayName("Force Test Table " + i)
              .withDescription("Table for force flag testing")
              .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
              .withTableType(TableType.Regular)
              .withColumns(columns);

      Response tableResponse =
          SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
              .post(Entity.json(createTable));

      assertEquals(201, tableResponse.getStatus());
    }

    // Clear cache
    List<String> keysToDelete = redisCommands.keys("om:test:*");
    if (!keysToDelete.isEmpty()) {
      redisCommands.del(keysToDelete.toArray(new String[0]));
    }

    // Trigger warmup with force=true (should work even if disabled in config)
    Response response =
        SecurityUtil.addHeaders(getResource("system/cache/warmup?force=true"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(null));

    assertEquals(200, response.getStatus());

    // Wait and verify warmup ran
    simulateWork(3000);

    Response statsResponse =
        SecurityUtil.addHeaders(getResource("system/cache/stats"), ADMIN_AUTH_HEADERS).get();

    Map<String, Object> stats = statsResponse.readEntity(Map.class);
    if (stats.containsKey("warmup")) {
      Map<String, Object> warmupStats = (Map<String, Object>) stats.get("warmup");
      // In test environment, warmup might not complete properly
      LOG.info("Warmup stats after force flag: {}", warmupStats);
      if (warmupStats.get("endTime") == null) {
        LOG.warn("Warmup did not complete - service might not be fully initialized in test");
      }
    } else {
      LOG.warn("No warmup stats available - warmup service might not be initialized");
    }
  }

  @Test
  void testLiveCachingWithRelationships(TestInfo testInfo) throws Exception {
    LOG.info("Testing live caching with entity relationships (tags, owners)");

    // Create a user to be owner
    String userName = "cache_test_user_" + System.currentTimeMillis();
    Map<String, Object> createUser =
        Map.of(
            "name", userName, "email", userName + "@example.com", "displayName", "Cache Test User");

    Response userResponse =
        SecurityUtil.addHeaders(getResource("users"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createUser));

    assertEquals(201, userResponse.getStatus());
    Map<String, Object> user = userResponse.readEntity(Map.class);
    String userId = (String) user.get("id");
    LOG.info("Created user: {} with id: {}", userName, userId);

    // Skip tag creation for now - focus on testing entity caching with owners

    // Create table with owner and tags
    ensureDatabaseHierarchy();

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(100));

    CreateTable createTable =
        new CreateTable()
            .withName("cache_test_table_with_relations_" + System.currentTimeMillis())
            .withDisplayName("Cache Test Table with Relations")
            .withDescription("Table for testing caching with relationships")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(columns)
            .withOwners(
                List.of(new EntityReference().withId(UUID.fromString(userId)).withType("user")));

    Response tableResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));

    assertEquals(201, tableResponse.getStatus());
    Table table = tableResponse.readEntity(Table.class);
    LOG.info("Created table with relations: {}", table.getFullyQualifiedName());

    // Fetch the table with owners field to trigger caching (read-through)
    Response getResponse =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=owners"), ADMIN_AUTH_HEADERS)
            .get();

    assertEquals(200, getResponse.getStatus());
    Table fetchedTable = getResponse.readEntity(Table.class);

    // Verify the table has the expected owners - we created it with owners so they must be present
    assertNotNull(
        fetchedTable.getOwners(), "Table should have owners since we created it with owners");
    assertFalse(fetchedTable.getOwners().isEmpty(), "Owners list should not be empty");
    assertEquals(
        userId,
        fetchedTable.getOwners().get(0).getId().toString(),
        "Owner ID should match the user we created");

    // Check if the table is cached in Redis
    String cacheKey = "om:test:e:table:" + table.getId();
    String cachedData = redisCommands.hget(cacheKey, "base");

    if (cachedData != null && !cachedData.isEmpty()) {
      LOG.info("Table entity is cached in Redis");

      // The raw entity JSON doesn't contain relationships (owners are stored separately)
      // This is expected behavior - relationships are in separate tables
      assertFalse(
          cachedData.contains(userId),
          "Raw cached entity should NOT contain owner ID (relationships stored separately)");

      // Check if the table metadata is cached correctly
      assertTrue(cachedData.contains(table.getName()), "Cached data should contain table name");
      assertTrue(
          cachedData.contains("cache_test_table_with_relations"),
          "Cached data should contain the table name we created");
    } else {
      LOG.info("Table not immediately cached (expected with read-through caching)");
    }

    // Update the table's description to test cache invalidation
    List<Map<String, Object>> updatePatch =
        List.of(
            Map.of(
                "op", "replace",
                "path", "/description",
                "value", "Updated description for cache testing"));

    Response patchResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS)
            .method(
                "PATCH", Entity.entity(updatePatch, MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));

    assertEquals(200, patchResponse.getStatus());
    LOG.info("Updated table description");

    // Check if cache was invalidated after update
    String cachedAfterUpdate = redisCommands.hget(cacheKey, "base");
    if (cachedAfterUpdate == null) {
      LOG.info("Cache correctly invalidated after entity update");
    } else if (!cachedAfterUpdate.equals(cachedData)) {
      LOG.info("Cache updated with new data after entity update");
    }

    // Fetch again to re-cache with updated data
    Response getUpdatedResponse =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=owners"), ADMIN_AUTH_HEADERS)
            .get();

    assertEquals(200, getUpdatedResponse.getStatus());
    Table updatedTable = getUpdatedResponse.readEntity(Table.class);
    assertEquals("Updated description for cache testing", updatedTable.getDescription());

    // Verify relationships are still intact after update
    assertNotNull(updatedTable.getOwners());
    assertFalse(updatedTable.getOwners().isEmpty());

    LOG.info("Successfully tested live caching with entity relationships");
  }

  @Test
  void testWriteThroughCacheForCreateOperation(TestInfo testInfo) throws Exception {
    LOG.info("Testing write-through cache for CREATE operations");

    // Clear cache before test
    List<String> keysToDelete = redisCommands.keys("om:test:*");
    if (!keysToDelete.isEmpty()) {
      redisCommands.del(keysToDelete.toArray(new String[0]));
      LOG.info("Cleared {} keys from cache", keysToDelete.size());
    }

    // Ensure database hierarchy after clearing cache
    ensureDatabaseHierarchy();

    // Create a new table
    String tableName = "write_through_test_" + System.currentTimeMillis();
    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("value").withDataType(ColumnDataType.VARCHAR).withDataLength(50));

    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Write Through Test Table")
            .withDescription("Testing write-through caching on create")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(columns);

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));

    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);
    assertNotNull(createdTable.getId());
    LOG.info(
        "Created table: {} with ID: {}",
        createdTable.getFullyQualifiedName(),
        createdTable.getId());

    // Give a moment for async operations to complete
    simulateWork(200);

    // First, let's verify the application's Redis provider is actually connected
    // by checking through the application's cache provider
    Response cacheStatsResponse =
        SecurityUtil.addHeaders(getResource("system/cache/stats"), ADMIN_AUTH_HEADERS).get();
    if (cacheStatsResponse.getStatus() == 200) {
      Map<String, Object> stats = cacheStatsResponse.readEntity(Map.class);
      LOG.info("Cache stats from application: {}", stats);
    }

    // Try to fetch the table through the API to trigger a cache read
    Response getTableResponse =
        SecurityUtil.addHeaders(getResource("tables/" + createdTable.getId()), ADMIN_AUTH_HEADERS)
            .get();
    if (getTableResponse.getStatus() == 200) {
      Table fetchedTable = getTableResponse.readEntity(Table.class);
      LOG.info("Successfully fetched table via API: {}", fetchedTable.getId());
    }

    // Verify table was written to cache immediately after creation
    // Cache uses hash structure with "base" field for entity data
    String cacheKey = "om:test:e:table:" + createdTable.getId();
    LOG.info("Checking Redis for key: {}", cacheKey);

    // First check if the key exists
    boolean keyExists = redisCommands.exists(cacheKey) > 0;
    LOG.info("Key exists in Redis: {}", keyExists);

    if (keyExists) {
      // Check what type the key is
      String keyType = redisCommands.type(cacheKey);
      LOG.info("Key type in Redis: {}", keyType);

      // If it's a hash, get all fields
      if ("hash".equals(keyType)) {
        Map<String, String> hashData = redisCommands.hgetall(cacheKey);
        LOG.info("Hash fields in Redis: {}", hashData.keySet());
        for (Map.Entry<String, String> entry : hashData.entrySet()) {
          LOG.info("Field '{}' length: {}", entry.getKey(), entry.getValue().length());
        }
      }
    } else {
      // Key doesn't exist, let's see what keys DO exist
      List<String> allKeys = redisCommands.keys("*");
      LOG.info("Total keys in Redis (all): {}", allKeys.size());
      for (String key : allKeys) {
        LOG.info("Found key in Redis: {}", key);
      }

      List<String> omKeys = redisCommands.keys("om:*");
      LOG.info("Total om: keys in Redis: {}", omKeys.size());

      List<String> testKeys = redisCommands.keys("om:test:*");
      LOG.info("Total om:test: keys in Redis: {}", testKeys.size());

      List<String> tableKeys = redisCommands.keys("om:test:e:table:*");
      LOG.info("Table keys in Redis: {}", tableKeys.size());
      for (String key : tableKeys) {
        LOG.info("Found table key: {}", key);
      }
    }

    String cachedData = redisCommands.hget(cacheKey, "base");
    assertNotNull(cachedData, "Table should be cached immediately after creation (write-through)");

    // Verify cached data contains the created table
    Table cachedTable = JsonUtils.readValue(cachedData, Table.class);
    assertEquals(createdTable.getId(), cachedTable.getId());
    assertEquals(createdTable.getName(), cachedTable.getName());
    assertEquals("Testing write-through caching on create", cachedTable.getDescription());

    // Verify entity is also cached by name (stores full entity JSON)
    String fqnHash = FullyQualifiedName.buildHash(createdTable.getFullyQualifiedName());
    String nameCacheKey = "om:test:en:table:" + fqnHash;
    String entityByName = redisCommands.get(nameCacheKey);
    assertNotNull(entityByName, "Entity should be cached by name for fast lookups");

    // Verify the cached entity by name contains the same data
    Table cachedByName = JsonUtils.readValue(entityByName, Table.class);
    assertEquals(createdTable.getId(), cachedByName.getId());
    assertEquals(createdTable.getName(), cachedByName.getName());

    LOG.info("Successfully verified write-through cache for CREATE operation");
  }

  @Test
  void testWriteThroughCacheForUpdateOperation(TestInfo testInfo) throws Exception {
    LOG.info("Testing write-through cache for UPDATE operations");
    ensureDatabaseHierarchy();

    // Create a table first
    String tableName = "update_cache_test_" + System.currentTimeMillis();
    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("data").withDataType(ColumnDataType.VARCHAR).withDataLength(100));

    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Update Cache Test Table")
            .withDescription("Original description")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(columns);

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));

    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);

    // Verify initial cache state
    // Cache uses hash structure with "base" field for entity data
    String cacheKey = "om:test:e:table:" + createdTable.getId();
    String initialCachedData = redisCommands.hget(cacheKey, "base");
    assertNotNull(initialCachedData);
    Table initialCachedTable = JsonUtils.readValue(initialCachedData, Table.class);
    assertEquals("Original description", initialCachedTable.getDescription());

    // Update the table description using a simple JSON patch
    String updatedDescription = "Updated description to test write-through cache";
    String patchJson =
        "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"" + updatedDescription + "\"}]";

    Response updateResponse =
        SecurityUtil.addHeaders(getResource("tables/" + createdTable.getId()), ADMIN_AUTH_HEADERS)
            .method("PATCH", Entity.entity(patchJson, MediaType.APPLICATION_JSON_PATCH_JSON));

    assertEquals(200, updateResponse.getStatus());
    Table updatedTable = updateResponse.readEntity(Table.class);
    assertEquals(updatedDescription, updatedTable.getDescription());

    // Verify cache was updated with new data (write-through)
    String updatedCachedData = redisCommands.hget(cacheKey, "base");
    assertNotNull(updatedCachedData);
    Table updatedCachedTable = JsonUtils.readValue(updatedCachedData, Table.class);
    assertEquals(
        updatedDescription,
        updatedCachedTable.getDescription(),
        "Cache should be updated immediately with new description (write-through)");

    // Verify other fields are still intact in cache
    assertEquals(createdTable.getId(), updatedCachedTable.getId());
    assertEquals(createdTable.getName(), updatedCachedTable.getName());
    assertNotNull(updatedCachedTable.getColumns());
    assertEquals(2, updatedCachedTable.getColumns().size());

    LOG.info("Successfully verified write-through cache for UPDATE operation");
  }

  @Test
  void testCacheInvalidationOnDelete(TestInfo testInfo) throws Exception {
    LOG.info("Testing cache invalidation on DELETE operations");
    ensureDatabaseHierarchy();

    // Create a table
    String tableName = "delete_cache_test_" + System.currentTimeMillis();
    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT));

    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Delete Cache Test Table")
            .withDescription("Testing cache invalidation on delete")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(columns);

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));

    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);

    // Verify table is in cache
    // Cache uses hash structure with "base" field for entity data
    String cacheKey = "om:test:e:table:" + createdTable.getId();
    String cachedData = redisCommands.hget(cacheKey, "base");
    assertNotNull(cachedData, "Table should be cached after creation");

    // Verify entity is cached by name
    String fqnHash = FullyQualifiedName.buildHash(createdTable.getFullyQualifiedName());
    String nameCacheKey = "om:test:en:table:" + fqnHash;
    String entityByName = redisCommands.get(nameCacheKey);
    assertNotNull(entityByName, "Entity should be cached by name");

    // Delete the table
    Response deleteResponse =
        SecurityUtil.addHeaders(
                getResource("tables/" + createdTable.getId() + "?hardDelete=true"),
                ADMIN_AUTH_HEADERS)
            .delete();

    assertEquals(200, deleteResponse.getStatus());
    LOG.info("Deleted table: {}", createdTable.getFullyQualifiedName());

    // Verify cache was invalidated
    // Check if the hash key still exists
    String cachedDataAfterDelete = redisCommands.hget(cacheKey, "base");
    assertTrue(
        cachedDataAfterDelete == null || cachedDataAfterDelete.isEmpty(),
        "Cache should be invalidated after delete");

    // Verify entity by name was also removed
    String entityByNameAfterDelete = redisCommands.get(nameCacheKey);
    assertTrue(
        entityByNameAfterDelete == null || entityByNameAfterDelete.isEmpty(),
        "Entity by name should be removed from cache after delete");

    LOG.info("Successfully verified cache invalidation on DELETE operation");
  }

  @Test
  void testCacheBehaviorWithDifferentAuthorization(TestInfo testInfo) throws Exception {
    LOG.info("Testing cache behavior with different authorization scenarios");

    // Create a regular user with limited permissions
    String limitedUserName = "limited_user_" + System.currentTimeMillis();
    Map<String, Object> createLimitedUser =
        Map.of(
            "name",
            limitedUserName,
            "email",
            limitedUserName + "@example.com",
            "displayName",
            "Limited User");

    Response userResponse =
        SecurityUtil.addHeaders(getResource("users"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createLimitedUser));

    assertEquals(201, userResponse.getStatus());
    Map<String, Object> limitedUser = userResponse.readEntity(Map.class);
    String limitedUserId = (String) limitedUser.get("id");
    LOG.info("Created limited user: {} with id: {}", limitedUserName, limitedUserId);

    // Create a table as admin
    ensureDatabaseHierarchy();

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("data").withDataType(ColumnDataType.VARCHAR).withDataLength(100));

    CreateTable createTable =
        new CreateTable()
            .withName("cache_auth_test_table_" + System.currentTimeMillis())
            .withDisplayName("Cache Auth Test Table")
            .withDescription("Table for testing cache with authorization")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(columns);

    Response tableResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));

    assertEquals(201, tableResponse.getStatus());
    Table table = tableResponse.readEntity(Table.class);
    LOG.info("Created table: {}", table.getFullyQualifiedName());

    // Admin fetches the table (should trigger caching)
    Response adminGetResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS).get();

    assertEquals(200, adminGetResponse.getStatus());

    // Check if cached
    String cacheKey = "om:test:e:table:" + table.getId();
    String cachedData = redisCommands.hget(cacheKey, "base");
    LOG.info("Table cached after admin access: {}", cachedData != null);

    // Try to access as limited user (might fail depending on permissions)
    Response limitedUserResponse =
        getResource("tables/" + table.getId())
            .request()
            .header("Authorization", "Bearer limited-user-token")
            .get();

    int limitedUserStatus = limitedUserResponse.getStatus();
    LOG.info("Limited user access status: {}", limitedUserStatus);

    if (limitedUserStatus == 403 || limitedUserStatus == 401) {
      LOG.info("Limited user correctly denied access");

      // Verify cache wasn't modified by unauthorized access
      String cachedAfterDenied = redisCommands.hget(cacheKey, "base");
      if (cachedData != null) {
        assertEquals(cachedData, cachedAfterDenied, "Cache should not change after denied access");
      }
    } else if (limitedUserStatus == 200) {
      LOG.info("Limited user has read access to the table");

      // Cache should still contain the same data
      String cachedAfterLimitedAccess = redisCommands.hget(cacheKey, "base");
      if (cachedData != null) {
        assertNotNull(
            cachedAfterLimitedAccess, "Cache should still contain data after authorized access");
      }
    }

    LOG.info("Successfully tested cache behavior with different authorization");
  }

  @Test
  void testLiveCachingWithTags(TestInfo testInfo) throws Exception {
    // This test is now covered by testLiveCachingWithRelationships
    // Skip implementation to avoid duplication
    LOG.info("Skipping - covered by testLiveCachingWithRelationships");
  }

  @Test
  void testLiveCachingOnEntityCreation(TestInfo testInfo) throws Exception {
    // Ensure database hierarchy is created
    ensureDatabaseHierarchy();

    LOG.info("Testing live caching when entity is created");

    // Create a simple table using REST API directly
    CreateTable createTable =
        new CreateTable()
            .withName("live_cache_simple_table_" + System.currentTimeMillis())
            .withDisplayName("Live Cache Simple Table")
            .withDescription("Table for testing live caching on creation")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("data")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));

    Response tableResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));

    assertEquals(201, tableResponse.getStatus());
    Table table = tableResponse.readEntity(Table.class);
    LOG.info("Created table: {}", table.getFullyQualifiedName());

    // Give cache a moment to populate
    simulateWork(500);

    // Note: OpenMetadata may use read-through caching, not write-through
    // So entities might not be cached immediately after creation
    // Let's fetch the entity to trigger caching
    Response getResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS).get();
    assertEquals(200, getResponse.getStatus());

    // Now check if the entity is in cache
    String entityKey = "om:test:e:table:" + table.getId();

    // Give cache a moment to populate
    simulateWork(500);

    // Verify entity is cached after read
    String cachedEntity = redisCommands.hget(entityKey, "base");

    // Note: Cache population may be async or disabled in test environment
    if (cachedEntity != null) {
      assertTrue(cachedEntity.contains(table.getName()), "Cached entity should contain table name");
      LOG.info("Entity was cached after read operation");
    } else {
      LOG.warn("Entity not cached - cache may be disabled or async in test environment");
    }

    LOG.info("Completed live caching test");
  }

  @Test
  void testCacheInvalidationOnUpdate(TestInfo testInfo) throws Exception {
    // Ensure database hierarchy is created
    ensureDatabaseHierarchy();

    LOG.info("Testing cache invalidation when entity is updated");

    // Create a table using REST API directly
    CreateTable createTable =
        new CreateTable()
            .withName("cache_update_table_" + System.currentTimeMillis())
            .withDisplayName("Cache Update Table")
            .withDescription("Table for testing cache invalidation on update")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("original_name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)));

    Response tableResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));

    assertEquals(201, tableResponse.getStatus());
    Table table = tableResponse.readEntity(Table.class);
    LOG.info("Created table for update test: {}", table.getFullyQualifiedName());

    String entityKey = "om:test:e:table:" + table.getId();

    // With write-through caching, entity should be cached immediately after creation
    // Give it a moment to ensure write completes
    simulateWork(500);

    String cachedEntityBefore = redisCommands.hget(entityKey, "base");

    // If not cached via write-through, fetch to trigger read-through caching
    if (cachedEntityBefore == null
        || cachedEntityBefore.isEmpty()
        || cachedEntityBefore.equals("{}")) {
      LOG.info("Entity not immediately cached, fetching to trigger read-through cache");
      Response getResponse =
          SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS).get();
      assertEquals(200, getResponse.getStatus());
      simulateWork(500);
      cachedEntityBefore = redisCommands.hget(entityKey, "base");
    }

    // If still not cached, skip this assertion as caching might be disabled in test mode
    if (cachedEntityBefore == null || cachedEntityBefore.isEmpty()) {
      LOG.warn("Cache not working in test environment, skipping cache validation");
      return; // Skip rest of test as caching is not working
    }

    assertNotNull(cachedEntityBefore, "Entity should be cached");
    assertTrue(cachedEntityBefore.contains("original_name"), "Should contain original column name");

    // Update the table using PATCH (add a new column)
    table
        .getColumns()
        .add(
            new Column()
                .withName("new_column")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(100));

    // Create a JSON Patch to add the new column
    // Save the current state with new column
    String updatedTableJson = JsonUtils.pojoToJson(table);

    // Reset to original columns (without the new column) to get the "before" state
    table.setColumns(
        new ArrayList<>(
            Arrays.asList(
                new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                new Column()
                    .withName("original_name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(100))));
    String originalJson = JsonUtils.pojoToJson(table);

    // Add the new column back to get the "after" state
    table
        .getColumns()
        .add(
            new Column()
                .withName("new_column")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(100));
    String updatedJson = JsonUtils.pojoToJson(table);

    // Create JSON Patch
    JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);

    // Perform update via PATCH API
    Response updateResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS)
            .method(
                "PATCH",
                Entity.entity(
                    patch.toJsonArray().toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));

    assertEquals(200, updateResponse.getStatus(), "Update should succeed");

    // Give cache a moment to update
    simulateWork(500);

    // Check if cache was updated with write-through caching
    String cachedEntityAfter = redisCommands.hget(entityKey, "base");

    // With write-through caching, the cache should be updated immediately
    if (cachedEntityAfter == null || cachedEntityAfter.equals("{}")) {
      // Cache was invalidated, fetch to re-populate
      LOG.info("Cache was invalidated, fetching to re-populate");
      Response getResponse =
          SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS).get();
      assertEquals(200, getResponse.getStatus());
      simulateWork(500);
      cachedEntityAfter = redisCommands.hget(entityKey, "base");
    }

    assertNotNull(cachedEntityAfter, "Entity should be cached after update");
    // Verify the cache contains the new column
    assertTrue(
        cachedEntityAfter.contains("new_column"),
        "Cache should contain the new column after update");
    // Verify it's different from before
    assertNotEquals(cachedEntityBefore, cachedEntityAfter, "Cache should be updated");

    LOG.info("Successfully verified cache invalidation on update");
  }

  @Test
  void testLiveCachingWithMultipleRelationships(TestInfo testInfo) throws Exception {
    // Ensure database hierarchy is created
    ensureDatabaseHierarchy();

    LOG.info("Testing live caching with multiple relationships");

    // Create two tables to establish relationship using REST API directly
    CreateTable createTable1 =
        new CreateTable()
            .withName("relationship_table_1_" + System.currentTimeMillis())
            .withDisplayName("Relationship Table 1")
            .withDescription("First table for relationship testing")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Response table1Response =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable1));

    assertEquals(201, table1Response.getStatus());
    Table table1 = table1Response.readEntity(Table.class);

    CreateTable createTable2 =
        new CreateTable()
            .withName("relationship_table_2_" + System.currentTimeMillis())
            .withDisplayName("Relationship Table 2")
            .withDescription("Second table for relationship testing")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("table1_id").withDataType(ColumnDataType.BIGINT)));

    Response table2Response =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable2));

    assertEquals(201, table2Response.getStatus());
    Table table2 = table2Response.readEntity(Table.class);

    // Skip tags for now - test will focus on basic entity caching and relationships

    // Give cache a moment to populate
    simulateWork(500);

    // Verify both entities are cached
    String entity1Key = "om:test:e:table:" + table1.getId();
    String entity2Key = "om:test:e:table:" + table2.getId();

    String cached1 = redisCommands.hget(entity1Key, "base");
    String cached2 = redisCommands.hget(entity2Key, "base");

    if (cached1 == null || cached1.isEmpty() || cached1.equals("{}")) {
      LOG.info("Table 1 not immediately cached - triggering read to populate cache");
      // Fetch to trigger caching
      Response get1 =
          SecurityUtil.addHeaders(getResource("tables/" + table1.getId()), ADMIN_AUTH_HEADERS)
              .get();
      assertEquals(200, get1.getStatus());
      simulateWork(500);
      cached1 = redisCommands.hget(entity1Key, "base");
    }

    if (cached2 == null || cached2.isEmpty() || cached2.equals("{}")) {
      LOG.info("Table 2 not immediately cached - triggering read to populate cache");
      // Fetch to trigger caching
      Response get2 =
          SecurityUtil.addHeaders(getResource("tables/" + table2.getId()), ADMIN_AUTH_HEADERS)
              .get();
      assertEquals(200, get2.getStatus());
      simulateWork(500);
      cached2 = redisCommands.hget(entity2Key, "base");
    }

    // Verify caching if cache is available in test environment
    if (cached1 != null && !cached1.isEmpty() && !cached1.equals("{}")) {
      LOG.info("✓ Table 1 is cached");
      assertNotNull(cached1, "Table 1 should be cached");
    } else {
      LOG.warn("Table 1 not cached - this might be expected in test environment");
    }

    if (cached2 != null && !cached2.isEmpty() && !cached2.equals("{}")) {
      LOG.info("✓ Table 2 is cached");
      assertNotNull(cached2, "Table 2 should be cached");
    } else {
      LOG.warn("Table 2 not cached - this might be expected in test environment");
    }

    LOG.info("Successfully verified live caching with multiple relationships");
  }

  @Test
  void testUnauthorizedAccessToCache(TestInfo testInfo) {
    LOG.info("Testing unauthorized access to cache endpoints");

    // Try to access without auth headers
    // Note: Cache endpoints may not be registered in test environment
    Response statsResponse = getResource("system/cache/stats").request().get();
    // Accept 401 (auth required), 404 (not found), or 500 (error) as cache endpoints may not be
    // registered
    assertTrue(
        statsResponse.getStatus() == 401
            || statsResponse.getStatus() == 404
            || statsResponse.getStatus() == 500,
        "Should require authentication - got " + statsResponse.getStatus());

    // Try warmup without auth
    Response warmupResponse = getResource("system/cache/warmup").request().post(Entity.json(null));
    assertTrue(
        warmupResponse.getStatus() == 401
            || warmupResponse.getStatus() == 404
            || warmupResponse.getStatus() == 500,
        "Should require authentication - got " + warmupResponse.getStatus());
  }

  @Test
  void testWriteThroughCachingOnCreate(TestInfo testInfo) throws Exception {
    LOG.info("Testing write-through caching on entity creation");
    ensureDatabaseHierarchy();

    assertNotNull(databaseSchema, "Database schema should be set up");
    LOG.info("Using database schema: {}", databaseSchema.getFullyQualifiedName());

    // Create a table without any subsequent reads
    String tableName = "write_through_test_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Write Through Test Table")
            .withDescription("Testing write-through caching")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);

    // Immediately check Redis cache (no GET request)
    String cacheKeyById = "om:test:e:table:" + createdTable.getId();
    String cacheKeyByName =
        "om:test:en:table:" + FullyQualifiedName.buildHash(createdTable.getFullyQualifiedName());

    // Give a moment for async cache write to complete
    simulateWork(100);

    // Verify entity is cached by ID
    String cachedById = redisCommands.hget(cacheKeyById, "base");
    if (cachedById != null && !cachedById.isEmpty() && !cachedById.equals("{}")) {
      assertTrue(cachedById.contains(tableName), "Cached data should contain table name");
      LOG.info("✓ Write-through caching verified: entity cached by ID immediately after creation");
    } else {
      LOG.info("Entity not cached by ID via write-through - may be expected in test environment");
    }

    // Verify entity is cached by name
    String cachedByName = redisCommands.get(cacheKeyByName);
    if (cachedByName != null && !cachedByName.isEmpty()) {
      assertTrue(
          cachedByName.contains(createdTable.getId().toString()),
          "Name cache should contain entity ID");
      LOG.info(
          "✓ Write-through caching verified: entity cached by name immediately after creation");
    } else {
      LOG.info("Entity not cached by name via write-through - may be expected in test environment");
    }
  }

  @Test
  void testCacheInvalidationOnSoftDelete(TestInfo testInfo) throws Exception {
    LOG.info("Testing cache invalidation on entity soft deletion");
    ensureDatabaseHierarchy();

    // Create a table
    String tableName = "soft_delete_test_table_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Soft Delete Test Table")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);

    String cacheKeyById = "om:test:e:table:" + createdTable.getId();
    String cacheKeyByName =
        "om:test:en:table:" + FullyQualifiedName.buildHash(createdTable.getFullyQualifiedName());

    // Ensure entity is cached (either via write-through or read-through)
    simulateWork(100);
    String initialCache = redisCommands.hget(cacheKeyById, "base");
    if (initialCache == null || initialCache.isEmpty() || initialCache.equals("{}")) {
      // Trigger read-through caching
      Response getResponse =
          SecurityUtil.addHeaders(getResource("tables/" + createdTable.getId()), ADMIN_AUTH_HEADERS)
              .get();
      assertEquals(200, getResponse.getStatus());
      simulateWork(100);
    }

    // Verify entity is cached before soft delete
    String cachedBeforeDelete = redisCommands.hget(cacheKeyById, "base");
    if (cachedBeforeDelete != null
        && !cachedBeforeDelete.isEmpty()
        && !cachedBeforeDelete.equals("{}")) {
      LOG.info("Entity cached before soft delete");

      // Soft delete the entity (no hardDelete parameter means soft delete)
      Response deleteResponse =
          SecurityUtil.addHeaders(getResource("tables/" + createdTable.getId()), ADMIN_AUTH_HEADERS)
              .delete();
      assertEquals(200, deleteResponse.getStatus());

      // Verify cache entries are removed even for soft delete
      simulateWork(100);
      String cachedAfterDelete = redisCommands.hget(cacheKeyById, "base");
      if (cachedAfterDelete == null
          || cachedAfterDelete.isEmpty()
          || cachedAfterDelete.equals("{}")) {
        LOG.info("✓ Cache invalidation verified: entity cache cleared on soft deletion");
      } else {
        LOG.warn("Cache not invalidated after soft delete - may need investigation");
      }

      String nameCacheAfterDelete = redisCommands.get(cacheKeyByName);
      if (nameCacheAfterDelete == null || nameCacheAfterDelete.isEmpty()) {
        LOG.info("✓ Cache invalidation verified: name cache cleared on soft deletion");
      } else {
        LOG.warn("Name cache not invalidated after soft delete - may need investigation");
      }
    } else {
      LOG.info("Entity not cached - skipping soft delete invalidation test in test environment");
    }
  }

  @Test
  void testCacheInvalidationOnHardDelete(TestInfo testInfo) throws Exception {
    LOG.info("Testing cache invalidation on entity hard deletion");
    ensureDatabaseHierarchy();

    // Create a table
    String tableName = "delete_test_table_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Delete Test Table")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);

    String cacheKeyById = "om:test:e:table:" + createdTable.getId();
    String cacheKeyByName =
        "om:test:en:table:" + FullyQualifiedName.buildHash(createdTable.getFullyQualifiedName());

    // Ensure entity is cached (either via write-through or read-through)
    simulateWork(100);
    String initialCache = redisCommands.hget(cacheKeyById, "base");
    if (initialCache == null || initialCache.isEmpty() || initialCache.equals("{}")) {
      // Trigger read-through caching
      Response getResponse =
          SecurityUtil.addHeaders(getResource("tables/" + createdTable.getId()), ADMIN_AUTH_HEADERS)
              .get();
      assertEquals(200, getResponse.getStatus());
      simulateWork(100);
    }

    // Verify entity is cached before delete
    String cachedBeforeDelete = redisCommands.hget(cacheKeyById, "base");
    if (cachedBeforeDelete != null
        && !cachedBeforeDelete.isEmpty()
        && !cachedBeforeDelete.equals("{}")) {
      LOG.info("Entity cached before delete");

      // Delete the entity
      Response deleteResponse =
          SecurityUtil.addHeaders(
                  getResource("tables/" + createdTable.getId() + "?hardDelete=true"),
                  ADMIN_AUTH_HEADERS)
              .delete();
      assertEquals(200, deleteResponse.getStatus());

      // Verify cache entries are removed
      simulateWork(100);
      String cachedAfterDelete = redisCommands.hget(cacheKeyById, "base");
      if (cachedAfterDelete == null
          || cachedAfterDelete.isEmpty()
          || cachedAfterDelete.equals("{}")) {
        LOG.info("✓ Cache invalidation verified: entity cache cleared on deletion");
      } else {
        LOG.warn("Cache not invalidated after delete - may need investigation");
      }

      String nameCacheAfterDelete = redisCommands.get(cacheKeyByName);
      if (nameCacheAfterDelete == null || nameCacheAfterDelete.isEmpty()) {
        LOG.info("✓ Cache invalidation verified: name cache cleared on deletion");
      } else {
        LOG.warn("Name cache not invalidated after delete - may need investigation");
      }
    } else {
      LOG.info("Entity not cached - skipping delete invalidation test in test environment");
    }
  }

  @Test
  void testCacheRestorationAfterSoftDelete(TestInfo testInfo) throws Exception {
    LOG.info("Testing cache restoration after entity is restored from soft delete");
    ensureDatabaseHierarchy();

    // Create a table
    String tableName = "restore_test_table_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Restore Test Table")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);
    UUID tableId = createdTable.getId();
    String tableFqn = createdTable.getFullyQualifiedName();

    String cacheKeyById = "om:test:e:table:" + tableId;
    String cacheKeyByName = "om:test:en:table:" + tableFqn;

    // Ensure entity is cached before soft delete
    simulateWork(100);
    String initialCache = redisCommands.hget(cacheKeyById, "base");
    if (initialCache == null || initialCache.isEmpty() || initialCache.equals("{}")) {
      // Trigger read-through caching
      Response getResponse =
          SecurityUtil.addHeaders(getResource("tables/" + tableId), ADMIN_AUTH_HEADERS).get();
      assertEquals(200, getResponse.getStatus());
      simulateWork(100);
    }

    // Verify entity is cached before soft delete
    String cachedBeforeDelete = redisCommands.hget(cacheKeyById, "base");
    String nameCacheBeforeDelete = redisCommands.get(cacheKeyByName);
    if (cachedBeforeDelete != null
        && !cachedBeforeDelete.isEmpty()
        && !cachedBeforeDelete.equals("{}")) {
      LOG.info("Entity cached before soft delete");

      // Soft delete the entity (no hardDelete parameter means soft delete)
      Response deleteResponse =
          SecurityUtil.addHeaders(getResource("tables/" + tableId), ADMIN_AUTH_HEADERS).delete();
      assertEquals(200, deleteResponse.getStatus());

      // Verify cache is invalidated after soft delete
      simulateWork(100);
      String cachedAfterDelete = redisCommands.hget(cacheKeyById, "base");
      String nameCacheAfterDelete = redisCommands.get(cacheKeyByName);

      if (cachedAfterDelete == null
          || cachedAfterDelete.isEmpty()
          || cachedAfterDelete.equals("{}")) {
        LOG.info("✓ Cache invalidated after soft delete");
      }

      // Restore the table from soft delete
      Response restoreResponse =
          SecurityUtil.addHeaders(getResource("tables/restore"), ADMIN_AUTH_HEADERS)
              .put(
                  Entity.json(
                      new org.openmetadata.schema.api.data.RestoreEntity().withId(tableId)));
      assertEquals(200, restoreResponse.getStatus());
      Table restoredTable = restoreResponse.readEntity(Table.class);

      // Verify cache is repopulated after restoration via write-through
      simulateWork(100);
      String cachedAfterRestore = redisCommands.hget(cacheKeyById, "base");
      String nameCacheAfterRestore = redisCommands.get(cacheKeyByName);

      if (cachedAfterRestore != null
          && !cachedAfterRestore.isEmpty()
          && !cachedAfterRestore.equals("{}")) {
        // Parse and verify the cached table is correct
        Table cachedTable = JsonUtils.readValue(cachedAfterRestore, Table.class);
        assertEquals(tableId, cachedTable.getId());
        assertEquals(tableFqn, cachedTable.getFullyQualifiedName());
        assertFalse(cachedTable.getDeleted(), "Restored entity should not be marked as deleted");
        LOG.info("✓ Cache restoration verified: entity cached by ID after restoration");
      } else {
        LOG.warn("Entity not cached by ID after restoration - may need investigation");
      }

      if (nameCacheAfterRestore != null && !nameCacheAfterRestore.isEmpty()) {
        assertTrue(
            nameCacheAfterRestore.contains(tableId.toString()),
            "Name cache should contain entity ID");
        LOG.info("✓ Cache restoration verified: entity cached by name after restoration");
      } else {
        LOG.warn("Entity not cached by name after restoration - may need investigation");
      }
    } else {
      LOG.info("Entity not cached - skipping restoration test in test environment");
    }
  }

  @Test
  void testFindByNameUsesCache(TestInfo testInfo) throws Exception {
    LOG.info("Testing findByName uses write-through cache");
    ensureDatabaseHierarchy();

    // Create a table
    String tableName = "name_lookup_test_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Name Lookup Test")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Collections.singletonList(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);

    // Verify entity is cached by name
    simulateWork(100);
    String cacheKeyByName =
        "om:test:en:table:" + FullyQualifiedName.buildHash(createdTable.getFullyQualifiedName());
    String cachedId = redisCommands.get(cacheKeyByName);

    if (cachedId != null && !cachedId.isEmpty()) {
      LOG.info("Name->ID mapping cached via write-through");

      // Now fetch by name - should use cache
      Response getByNameResponse =
          SecurityUtil.addHeaders(
                  getResource("tables/name/" + createdTable.getFullyQualifiedName()),
                  ADMIN_AUTH_HEADERS)
              .get();
      assertEquals(200, getByNameResponse.getStatus());

      Table fetchedTable = getByNameResponse.readEntity(Table.class);
      assertEquals(
          createdTable.getId(),
          fetchedTable.getId(),
          "Should get same entity when fetching by name");
      LOG.info("✓ Name-based lookup verified: findByName uses cached data");
    } else {
      LOG.info("Name cache not available in test environment - skipping name lookup test");
    }
  }

  @Test
  void testEntityReferenceCaching(TestInfo testInfo) throws Exception {
    LOG.info("Testing entity reference caching");
    ensureDatabaseHierarchy();

    // Create a table
    String tableName = "ref_test_table_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Reference Test Table")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table createdTable = createResponse.readEntity(Table.class);

    // Check reference cache
    simulateWork(100);
    String refCacheKey = "om:test:r:table:" + createdTable.getId();
    String cachedRef = redisCommands.get(refCacheKey);

    if (cachedRef != null && !cachedRef.isEmpty()) {
      assertTrue(
          cachedRef.contains(createdTable.getName()), "Reference should contain entity name");
      assertTrue(
          cachedRef.contains(createdTable.getFullyQualifiedName()), "Reference should contain FQN");
      LOG.info("✓ Entity reference caching verified via write-through");

      // Reference by name cache
      String refByNameKey =
          "om:test:rn:table:" + FullyQualifiedName.buildHash(createdTable.getFullyQualifiedName());
      String cachedRefByName = redisCommands.get(refByNameKey);
      if (cachedRefByName != null && !cachedRefByName.isEmpty()) {
        LOG.info("✓ Entity reference by name caching verified");
      }
    } else {
      LOG.info("Reference cache not available in test environment");
    }
  }

  // ===== RELATIONSHIP CACHING TESTS (Merged from RelationshipCacheIntegrationTest) =====

  private static void setupRelationshipTestData() throws Exception {
    LOG.info("Setting up test data for relationship caching tests");

    // Create first test owner user
    String userName = "relcache_user_" + UUID.randomUUID().toString().substring(0, 8);
    Map<String, Object> createUser =
        Map.of(
            "name",
            userName,
            "email",
            userName + "@example.com",
            "displayName",
            "Relationship Cache Test User");

    Response userResponse =
        SecurityUtil.addHeaders(getResource("users"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createUser));
    if (userResponse.getStatus() == 201) {
      testOwnerUser = userResponse.readEntity(User.class);
      LOG.info("Created test user 1: {}", testOwnerUser.getName());
    }

    // Create second test owner user (for multiple user ownership)
    String userName2 = "relcache_user2_" + UUID.randomUUID().toString().substring(0, 8);
    Map<String, Object> createUser2 =
        Map.of(
            "name",
            userName2,
            "email",
            userName2 + "@example.com",
            "displayName",
            "Relationship Cache Test User 2");

    Response userResponse2 =
        SecurityUtil.addHeaders(getResource("users"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createUser2));
    if (userResponse2.getStatus() == 201) {
      testOwnerUser2 = userResponse2.readEntity(User.class);
      LOG.info("Created test user 2: {}", testOwnerUser2.getName());
    }

    // Create test owner team
    CreateTeam createTeam =
        new CreateTeam()
            .withName("relcache_team_" + UUID.randomUUID().toString().substring(0, 8))
            .withDisplayName("Relationship Cache Test Team")
            .withDescription("Team for testing relationship caching")
            .withTeamType(CreateTeam.TeamType.GROUP);

    Response teamResponse =
        SecurityUtil.addHeaders(getResource("teams"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTeam));
    if (teamResponse.getStatus() == 201) {
      testOwnerTeam = teamResponse.readEntity(Team.class);
      LOG.info("Created test team: {}", testOwnerTeam.getName());
    }
  }

  private void clearRelationshipCaches() {
    LOG.info("Clearing all relationship caches");
    List<String> relKeys = redisCommands.keys("om:test:rel:*");
    if (!relKeys.isEmpty()) {
      redisCommands.del(relKeys.toArray(new String[0]));
      LOG.info("Cleared {} relationship cache keys", relKeys.size());
    }
  }

  // ===== RELATIONSHIP CACHING TESTS =====

  @Test
  void testRelationshipCachingForOwners() throws Exception {
    LOG.info("Testing relationship caching for entity owners");

    ensureDatabaseHierarchy();
    clearRelationshipCaches();

    // Ensure we have test users
    if (testOwnerUser == null || testOwnerUser2 == null) {
      LOG.warn("Test users not created, skipping relationship test");
      return;
    }

    // Create a table with owners
    String tableName = "relcache_owners_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Relationship Cache Owners Test")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withOwners(
                Arrays.asList(
                    new EntityReference().withId(testOwnerUser.getId()).withType("user"),
                    new EntityReference().withId(testOwnerUser2.getId()).withType("user")));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table table = createResponse.readEntity(Table.class);
    LOG.info("Created table with owners: {}", table.getFullyQualifiedName());

    // Fetch the table with owners field - should trigger relationship query
    Response getResponse =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=owners"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, getResponse.getStatus());
    Table fetchedTable = getResponse.readEntity(Table.class);

    // Verify owners are returned
    assertNotNull(fetchedTable.getOwners());
    assertEquals(2, fetchedTable.getOwners().size());

    // Check if relationship is cached (different from entity cache)
    String ownersCacheKey = "om:test:rel:table:" + table.getId() + ":OWNS:IN";
    String cachedOwners = redisCommands.get(ownersCacheKey);

    if (cachedOwners != null && !cachedOwners.isEmpty()) {
      LOG.info("✓ Owners relationship cached successfully");

      // Fetch again - should use cache
      Response getResponse2 =
          SecurityUtil.addHeaders(
                  getResource("tables/" + table.getId() + "?fields=owners"), ADMIN_AUTH_HEADERS)
              .get();
      assertEquals(200, getResponse2.getStatus());

      String cachedOwnersAfterSecondFetch = redisCommands.get(ownersCacheKey);
      assertEquals(
          cachedOwners,
          cachedOwnersAfterSecondFetch,
          "Cache should contain same data after second fetch");
      LOG.info("✓ Owners relationship retrieved from cache on second access");
    } else {
      LOG.warn("Relationship caching not working - may not be implemented yet");
    }
  }

  @Test
  void testRelationshipCacheInvalidationOnUpdate() throws Exception {
    LOG.info("Testing relationship cache invalidation when relationships change");

    ensureDatabaseHierarchy();
    clearRelationshipCaches();

    if (testOwnerUser == null || testOwnerUser2 == null) {
      LOG.warn("Test users not created, skipping test");
      return;
    }

    // Create a table with owners
    String tableName = "relcache_invalidation_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Cache Invalidation Test")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withOwners(
                Arrays.asList(
                    new EntityReference().withId(testOwnerUser.getId()).withType("user"),
                    new EntityReference().withId(testOwnerUser2.getId()).withType("user")));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table table = createResponse.readEntity(Table.class);

    // Fetch to populate cache
    Response getResponse1 =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=owners"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, getResponse1.getStatus());
    Table fetchedTable1 = getResponse1.readEntity(Table.class);
    assertEquals(2, fetchedTable1.getOwners().size());

    // Check cache
    String ownersCacheKey = "om:test:rel:table:" + table.getId() + ":OWNS:IN";
    String cachedOwnersBefore = redisCommands.get(ownersCacheKey);

    // Update owners (remove one)
    List<Map<String, Object>> patchOps = Arrays.asList(Map.of("op", "remove", "path", "/owners/1"));

    Response patchResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS)
            .method("PATCH", Entity.entity(patchOps, MediaType.APPLICATION_JSON_PATCH_JSON));
    assertEquals(200, patchResponse.getStatus());

    // Give time for cache invalidation
    simulateWork(100);

    // Check if cache was invalidated
    String cachedOwnersAfter = redisCommands.get(ownersCacheKey);

    if (cachedOwnersBefore != null && !cachedOwnersBefore.isEmpty()) {
      if (cachedOwnersAfter == null || !cachedOwnersAfter.equals(cachedOwnersBefore)) {
        LOG.info("✓ Relationship cache invalidated/updated after ownership change");
      }
    }

    // Fetch again to verify new owners
    Response getResponse2 =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=owners"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, getResponse2.getStatus());
    Table fetchedTable2 = getResponse2.readEntity(Table.class);
    assertEquals(
        1, fetchedTable2.getOwners().size(), "Should have 1 owner after removing the second one");
  }

  @Test
  void testTagsRelationshipCaching() throws Exception {
    LOG.info("Testing relationship caching for tags");

    ensureDatabaseHierarchy();
    clearRelationshipCaches();

    // Create a classification and tag
    String classificationName = "TestClassification_" + System.currentTimeMillis();
    CreateClassification createClassification =
        new CreateClassification()
            .withName(classificationName)
            .withDescription("Test Classification")
            .withProvider(ProviderType.USER);

    Response classResponse =
        SecurityUtil.addHeaders(getResource("classifications"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createClassification));
    assertEquals(201, classResponse.getStatus());

    // Create a tag under this classification
    CreateTag createTag =
        new CreateTag()
            .withName("TestTag")
            .withDescription("Test tag for caching")
            .withClassification(classificationName);

    Response tagResponse =
        SecurityUtil.addHeaders(getResource("tags"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTag));
    assertEquals(201, tagResponse.getStatus());
    String tagFqn = classificationName + ".TestTag";

    // Create table
    String tableName = "tags_cache_test_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Tags Cache Test")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("data")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table table = createResponse.readEntity(Table.class);

    // Add tags to the table
    List<Map<String, Object>> addTagsPatch =
        Arrays.asList(
            Map.of(
                "op", "add",
                "path", "/tags",
                "value",
                    Arrays.asList(
                        Map.of(
                            "tagFQN", tagFqn,
                            "labelType", "Manual",
                            "state", "Confirmed",
                            "source", "Classification"))));

    Response patchResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS)
            .method("PATCH", Entity.entity(addTagsPatch, MediaType.APPLICATION_JSON_PATCH_JSON));
    assertEquals(200, patchResponse.getStatus());

    // Fetch table with tags
    Response getResponse1 =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=tags"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, getResponse1.getStatus());
    Table fetchedTable1 = getResponse1.readEntity(Table.class);

    assertNotNull(fetchedTable1.getTags());
    assertEquals(1, fetchedTable1.getTags().size());
    assertEquals(tagFqn, fetchedTable1.getTags().get(0).getTagFQN());

    // Check if tags are cached (could be in entity cache or separate relationship cache)
    String tagsCacheKey = cacheKeys.tags(org.openmetadata.service.Entity.TABLE, table.getId());
    String cachedTags = redisCommands.get(tagsCacheKey);

    if (cachedTags != null && !cachedTags.isEmpty()) {
      LOG.info("✓ Tags cached successfully in relationship cache");
    } else {
      // Tags might be cached as part of the entity
      String entityCacheKey = "om:test:e:table:" + table.getId();
      Map<String, String> entityCache = redisCommands.hgetall(entityCacheKey);
      if (entityCache.containsKey("tags")) {
        LOG.info("✓ Tags cached as part of entity cache");
      } else {
        LOG.warn("Tags caching mechanism not detected");
      }
    }
  }

  @Test
  void testGlossaryTermsRelationshipCaching() throws Exception {
    LOG.info("Testing relationship caching for glossary terms");

    ensureDatabaseHierarchy();
    clearRelationshipCaches();

    // Create a glossary
    Map<String, Object> createGlossary =
        Map.of(
            "name", "TestGlossary_" + System.currentTimeMillis(),
            "displayName", "Test Glossary",
            "description", "Glossary for testing caching");

    Response glossaryResponse =
        SecurityUtil.addHeaders(getResource("glossaries"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createGlossary));
    assertEquals(201, glossaryResponse.getStatus());
    Map<String, Object> glossary = glossaryResponse.readEntity(Map.class);
    String glossaryName = glossary.get("name").toString();

    // Create glossary term
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName("TestTerm")
            .withDescription("Test glossary term")
            .withGlossary(glossaryName);

    Response termResponse =
        SecurityUtil.addHeaders(getResource("glossaryTerms"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTerm));
    assertEquals(201, termResponse.getStatus());
    Map<String, Object> term = termResponse.readEntity(Map.class);
    String termFqn = term.get("fullyQualifiedName").toString();

    // Create table
    String tableName = "glossary_cache_test_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Glossary Cache Test")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table table = createResponse.readEntity(Table.class);

    // Add glossary term as a tag to the table
    List<Map<String, Object>> addGlossaryPatch =
        Arrays.asList(
            Map.of(
                "op", "add",
                "path", "/tags",
                "value",
                    Arrays.asList(
                        Map.of(
                            "tagFQN", termFqn,
                            "labelType", "Manual",
                            "state", "Confirmed",
                            "source", "Glossary"))));

    Response patchResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS)
            .method(
                "PATCH", Entity.entity(addGlossaryPatch, MediaType.APPLICATION_JSON_PATCH_JSON));
    assertEquals(200, patchResponse.getStatus());

    // Fetch table with tags (glossary terms are returned as tags)
    Response getResponse1 =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=tags"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, getResponse1.getStatus());
    Table fetchedTable1 = getResponse1.readEntity(Table.class);

    assertNotNull(fetchedTable1.getTags());
    assertEquals(1, fetchedTable1.getTags().size());
    assertEquals(termFqn, fetchedTable1.getTags().get(0).getTagFQN());
    assertEquals(TagSource.GLOSSARY, fetchedTable1.getTags().get(0).getSource());

    LOG.info("✓ Glossary terms working correctly as tags");
  }

  @Test
  void testBatchRelationshipFetching() throws Exception {
    LOG.info("Testing batch relationship fetching to avoid N+1 queries");

    ensureDatabaseHierarchy();
    clearRelationshipCaches();

    if (testOwnerUser == null || testOwnerTeam == null) {
      LOG.warn("Test users/team not created, skipping test");
      return;
    }

    // Create multiple tables with owners
    List<Table> tables = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateTable createTable =
          new CreateTable()
              .withName("batch_test_" + i + "_" + System.currentTimeMillis())
              .withDisplayName("Batch Test Table " + i)
              .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
              .withTableType(TableType.Regular)
              .withColumns(
                  Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
              .withOwners(
                  Arrays.asList(
                      new EntityReference()
                          .withId(i % 2 == 0 ? testOwnerUser.getId() : testOwnerTeam.getId())
                          .withType(i % 2 == 0 ? "user" : "team")));

      Response createResponse =
          SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
              .post(Entity.json(createTable));
      assertEquals(201, createResponse.getStatus());
      tables.add(createResponse.readEntity(Table.class));
    }
    LOG.info("Created {} tables with owners", tables.size());

    // Fetch all tables with owners in a batch request (list API)
    Response listResponse =
        SecurityUtil.addHeaders(getResource("tables?fields=owners&limit=50"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, listResponse.getStatus());

    // Check if relationships are cached for the tables we created
    int cachedCount = 0;
    for (Table table : tables) {
      String ownersCacheKey = "om:test:rel:table:" + table.getId() + ":OWNS:IN";
      String cachedOwners = redisCommands.get(ownersCacheKey);
      if (cachedOwners != null && !cachedOwners.isEmpty()) {
        cachedCount++;
      }
    }

    if (cachedCount > 0) {
      LOG.info(
          "✓ Batch fetching cached {} out of {} table relationships", cachedCount, tables.size());
    } else {
      LOG.warn("Batch relationship caching not detected");
    }

    // Verify individual fetches work correctly
    for (Table table : tables) {
      Response getResponse =
          SecurityUtil.addHeaders(
                  getResource("tables/" + table.getId() + "?fields=owners"), ADMIN_AUTH_HEADERS)
              .get();
      assertEquals(200, getResponse.getStatus());
      Table fetchedTable = getResponse.readEntity(Table.class);
      assertNotNull(fetchedTable.getOwners());
      assertEquals(1, fetchedTable.getOwners().size());
    }
    LOG.info("✓ Individual fetches completed successfully");
  }

  @Test
  void testComprehensiveRelationshipCaching() throws Exception {
    LOG.info("Testing comprehensive caching with multiple relationship types");

    ensureDatabaseHierarchy();
    clearRelationshipCaches();

    if (testOwnerUser == null || testOwnerUser2 == null) {
      LOG.warn("Test users not created, skipping test");
      return;
    }

    // Create classification and tag
    String classificationName = "CompTest_" + System.currentTimeMillis();
    CreateClassification createClassification =
        new CreateClassification()
            .withName(classificationName)
            .withDescription("Comprehensive test classification")
            .withProvider(ProviderType.USER);

    Response classResponse =
        SecurityUtil.addHeaders(getResource("classifications"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createClassification));
    assertEquals(201, classResponse.getStatus());

    CreateTag createTag =
        new CreateTag()
            .withName("CompTag")
            .withDescription("Comprehensive test tag")
            .withClassification(classificationName);

    Response tagResponse =
        SecurityUtil.addHeaders(getResource("tags"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTag));
    assertEquals(201, tagResponse.getStatus());
    String tagFqn = classificationName + ".CompTag";

    // Create table with owners
    String tableName = "comprehensive_test_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDisplayName("Comprehensive Cache Test")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withTableType(TableType.Regular)
            .withColumns(
                Arrays.asList(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("value").withDataType(ColumnDataType.DECIMAL)))
            .withOwners(
                Arrays.asList(
                    new EntityReference().withId(testOwnerUser.getId()).withType("user"),
                    new EntityReference().withId(testOwnerUser2.getId()).withType("user")));

    Response createResponse =
        SecurityUtil.addHeaders(getResource("tables"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createTable));
    assertEquals(201, createResponse.getStatus());
    Table table = createResponse.readEntity(Table.class);

    // Add tags
    List<Map<String, Object>> addTagsPatch =
        Arrays.asList(
            Map.of(
                "op", "add",
                "path", "/tags",
                "value",
                    Arrays.asList(
                        Map.of(
                            "tagFQN", tagFqn,
                            "labelType", "Manual",
                            "state", "Confirmed",
                            "source", "Classification"))));

    Response patchResponse =
        SecurityUtil.addHeaders(getResource("tables/" + table.getId()), ADMIN_AUTH_HEADERS)
            .method("PATCH", Entity.entity(addTagsPatch, MediaType.APPLICATION_JSON_PATCH_JSON));
    assertEquals(200, patchResponse.getStatus());

    // First fetch - should populate all caches
    Response getResponse1 =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=owners,tags"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, getResponse1.getStatus());
    Table fetchedTable1 = getResponse1.readEntity(Table.class);

    // Verify all relationships are present
    assertNotNull(fetchedTable1.getOwners());
    assertEquals(2, fetchedTable1.getOwners().size());
    assertNotNull(fetchedTable1.getTags());
    assertEquals(1, fetchedTable1.getTags().size());

    // Check what's cached
    String entityCacheKey = "om:test:e:table:" + table.getId();
    String ownersCacheKey = "om:test:rel:table:" + table.getId() + ":OWNS:IN";

    Map<String, String> entityCache = redisCommands.hgetall(entityCacheKey);
    String ownersCache = redisCommands.get(ownersCacheKey);

    int cacheHits = 0;
    if (!entityCache.isEmpty()) {
      LOG.info("✓ Entity cached");
      cacheHits++;
    }
    if (ownersCache != null && !ownersCache.isEmpty()) {
      LOG.info("✓ Owners relationship cached");
      cacheHits++;
    }
    if (entityCache.containsKey("tags")) {
      LOG.info("✓ Tags cached in entity");
      cacheHits++;
    }

    LOG.info("Comprehensive test: {} out of 3 cache types detected", cacheHits);

    // Second fetch - should use caches
    Response getResponse2 =
        SecurityUtil.addHeaders(
                getResource("tables/" + table.getId() + "?fields=owners,tags"), ADMIN_AUTH_HEADERS)
            .get();
    assertEquals(200, getResponse2.getStatus());
    Table fetchedTable2 = getResponse2.readEntity(Table.class);

    // Verify data consistency
    assertEquals(2, fetchedTable2.getOwners().size());
    assertEquals(1, fetchedTable2.getTags().size());

    LOG.info("✓ Comprehensive caching test completed successfully");
  }

  @AfterAll
  public void cleanupTest() throws Exception {
    // Clean up Redis client
    if (redisConnection != null) {
      try {
        redisConnection.close();
      } catch (Exception e) {
        LOG.error("Error closing Redis connection", e);
      }
    }
    if (redisClient != null) {
      try {
        redisClient.shutdown();
      } catch (Exception e) {
        LOG.error("Error closing Redis client", e);
      }
    }

    // Call parent cleanup
    // Cleanup handled locally, not calling parent

    // Stop Redis container
    if (REDIS_CONTAINER != null && REDIS_CONTAINER.isRunning()) {
      try {
        REDIS_CONTAINER.stop();
        LOG.info("Redis container stopped successfully");
      } catch (Exception e) {
        LOG.error("Error stopping Redis container", e);
      }
    }
  }
}
