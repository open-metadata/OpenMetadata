package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.TestUtils;

/**
 * Test to verify Redis cache is actually being used when enabled.
 * This test will only pass when run with Redis enabled profiles.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class RedisVerificationTest extends OpenMetadataApplicationTest {

  private DatabaseService databaseService;
  private Database database;
  private DatabaseSchema databaseSchema;

  private void setupTestEntities() throws Exception {
    if (databaseService == null) {
      // Create a database service for our tests
      CreateDatabaseService createService =
          new CreateDatabaseService()
              .withName("redis_test_service_" + System.currentTimeMillis())
              .withServiceType(CreateDatabaseService.DatabaseServiceType.Postgres)
              .withConnection(
                  new DatabaseConnection()
                      .withConfig(
                          new PostgresConnection()
                              .withHostPort("localhost:5432")
                              .withUsername("test")
                              .withDatabase("test")));

      databaseService =
          TestUtils.post(
              getResource("services/databaseServices"),
              createService,
              DatabaseService.class,
              ADMIN_AUTH_HEADERS);

      // Create database
      CreateDatabase createDb =
          new CreateDatabase()
              .withName("redis_test_db_" + System.currentTimeMillis())
              .withService(databaseService.getFullyQualifiedName());

      database =
          TestUtils.post(getResource("databases"), createDb, Database.class, ADMIN_AUTH_HEADERS);

      // Create schema
      CreateDatabaseSchema createSchema =
          new CreateDatabaseSchema()
              .withName("redis_test_schema_" + System.currentTimeMillis())
              .withDatabase(database.getFullyQualifiedName());

      databaseSchema =
          TestUtils.post(
              getResource("databaseSchemas"),
              createSchema,
              DatabaseSchema.class,
              ADMIN_AUTH_HEADERS);
    }
  }

  private Table createTestTable(String name) throws Exception {
    CreateTable createTable =
        new CreateTable()
            .withName(name)
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)));

    return TestUtils.post(getResource("tables"), createTable, Table.class, ADMIN_AUTH_HEADERS);
  }

  private void deleteTable(UUID tableId) throws Exception {
    TestUtils.delete(getResource("tables/" + tableId), ADMIN_AUTH_HEADERS);
  }

  @Test
  public void testRedisCacheIsActive() throws Exception {
    // Check if Redis is configured
    var cachedEntityDao = CacheBundle.getCachedEntityDao();

    String enableCache = System.getProperty("enableCache");
    String cacheType = System.getProperty("cacheType");

    // This test requires Redis to be actually running and configured
    assumeTrue(
        cachedEntityDao != null,
        "Skipping test - Redis is not initialized. This test requires Redis to be running and the application to be configured with Redis support.");

    if ("true".equals(enableCache) && "redis".equals(cacheType)) {
      setupTestEntities();
      // Create a real table entity using the API
      String tableName = "redis_cache_test_" + System.currentTimeMillis();
      Table table = createTestTable(tableName);
      assertNotNull(table);
      UUID tableId = table.getId();

      // Clear Guava cache to ensure we're testing Redis
      EntityRepository.CACHE_WITH_ID.invalidate(
          new org.apache.commons.lang3.tuple.ImmutablePair<>(Entity.TABLE, tableId));

      // Now fetch from Redis cache (should be there from write-through caching)
      String cachedJson = cachedEntityDao.getBase(tableId, Entity.TABLE);
      assertNotNull(cachedJson, "Entity should be in Redis cache after creation");
      assertFalse(cachedJson.equals("{}"), "Cached entity should not be empty");
      assertTrue(cachedJson.contains(tableName), "Cached entity should contain the table name");

      // Clean up
      deleteTable(tableId);
    }
  }

  @Test
  public void testRedisCacheSoftDelete() throws Exception {
    var cachedEntityDao = CacheBundle.getCachedEntityDao();

    String enableCache = System.getProperty("enableCache");
    String cacheType = System.getProperty("cacheType");

    // This test requires Redis to be actually running and configured
    assumeTrue(
        cachedEntityDao != null,
        "Skipping test - Redis is not initialized. This test requires Redis to be running and the application to be configured with Redis support.");

    if ("true".equals(enableCache) && "redis".equals(cacheType)) {
      setupTestEntities();
      // Create a real table entity using the API
      String tableName = "redis_delete_test_" + System.currentTimeMillis();
      Table table = createTestTable(tableName);
      assertNotNull(table);
      UUID tableId = table.getId();

      // Verify it's in cache and not deleted
      String cachedBefore = cachedEntityDao.getBase(tableId, Entity.TABLE);
      assertNotNull(cachedBefore, "Entity should be in Redis cache");
      assertTrue(
          cachedBefore.contains("\"deleted\": false") || cachedBefore.contains("\"deleted\":false"),
          "Entity should not be marked as deleted initially");

      // Delete entity (soft delete)
      deleteTable(tableId);

      // Clear Guava cache to ensure we're testing Redis
      EntityRepository.CACHE_WITH_ID.invalidate(
          new org.apache.commons.lang3.tuple.ImmutablePair<>(Entity.TABLE, tableId));

      // Verify it's still in cache but marked as deleted
      String cachedAfter = cachedEntityDao.getBase(tableId, Entity.TABLE);
      assertNotNull(cachedAfter, "Soft deleted entity should remain in Redis cache");
      assertTrue(
          cachedAfter.contains("\"deleted\": true") || cachedAfter.contains("\"deleted\":true"),
          "Cached entity should be marked as deleted");
    }
  }
}
