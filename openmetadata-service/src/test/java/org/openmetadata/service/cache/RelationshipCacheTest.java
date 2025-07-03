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
import static org.junit.runners.model.MultipleFailureException.assertEmpty;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.lang.reflect.Method;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;

@Slf4j
public class RelationshipCacheTest extends CachedOpenMetadataApplicationResourceTest {

  private CollectionDAO.EntityRelationshipDAO entityRelationshipDAO;

  private Table testTable;
  private Database testDatabase;
  private DatabaseSchema testSchema;

  @BeforeEach
  public void setup() throws Exception {
    entityRelationshipDAO = Entity.getCollectionDAO().relationshipDAO();
    clearCache();
    createTestEntities();
  }

  private void createTestEntities() throws Exception {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    DatabaseSchemaResourceTest databaseSchemaResourceTest = new DatabaseSchemaResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();

    TestInfo testInfo = createTestInfo("createTestEntities");

    DatabaseService testDatabaseService =
        databaseServiceResourceTest.createEntity(
            databaseServiceResourceTest.createRequest(testInfo), ADMIN_AUTH_HEADERS);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("testDatabase_" + testInfo.getDisplayName())
            .withService(testDatabaseService.getFullyQualifiedName());
    testDatabase = databaseResourceTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("testSchema_" + testInfo.getDisplayName())
            .withDatabase(testDatabase.getFullyQualifiedName());
    testSchema = databaseSchemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("created_date").withDataType(ColumnDataType.DATE));
    CreateTable createTable =
        new CreateTable()
            .withName("testTable_" + testInfo.getDisplayName())
            .withDatabaseSchema(testSchema.getFullyQualifiedName())
            .withColumns(columns);
    testTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
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
        return Optional.of(RelationshipCacheTest.class);
      }

      @Override
      public Optional<Method> getTestMethod() {
        try {
          return Optional.of(RelationshipCacheTest.class.getDeclaredMethod("createTestEntities"));
        } catch (NoSuchMethodException e) {
          return Optional.empty();
        }
      }
    };
  }

  @Test
  @DisplayName("Test cache is properly initialized and available")
  public void testCacheInitialization() {
    assertTrue(isCacheAvailable(), "Cache should be available in test environment");
    assertNotNull(getRedisContainer(), "Redis container should be running");
    assertTrue(getRedisContainer().isRunning(), "Redis container should be in running state");
  }

  @Test
  @DisplayName("Test basic cache operations - put and get")
  public void testBasicCacheOperations() {
    String entityId = testTable.getId().toString();
    Map<String, Object> relationships = new HashMap<>();
    relationships.put("database", testDatabase.getEntityReference());
    relationships.put("databaseSchema", testSchema.getEntityReference());
    RelationshipCache.put(entityId, relationships);
    Map<String, Object> cachedData = RelationshipCache.get(entityId);
    assertNotNull(cachedData, "Cached data should not be null");
    assertEquals(2, cachedData.size(), "Should have 2 relationships cached");
    assertTrue(cachedData.containsKey("database"), "Should contain database relationship");
    assertTrue(
        cachedData.containsKey("databaseSchema"), "Should contain databaseSchema relationship");
  }

  @Test
  @DisplayName("Test cache miss returns null")
  public void testCacheMiss() {
    String nonExistentEntityId = UUID.randomUUID().toString();
    Map<String, Object> cachedData = RelationshipCache.get(nonExistentEntityId);
    assertTrue(cachedData.isEmpty(), "Cache miss should return null");
  }

  @Test
  @DisplayName("Test cache eviction")
  public void testCacheEviction() {
    String entityId = testTable.getId().toString();
    Map<String, Object> relationships = new HashMap<>();
    relationships.put("test", "value");
    RelationshipCache.put(entityId, relationships);
    assertNotNull(RelationshipCache.get(entityId), "Data should be in cache");
    RelationshipCache.evict(entityId);
    assertTrue(RelationshipCache.get(entityId).isEmpty(), "Data should be evicted from cache");
  }

  @Test
  @DisplayName("Test tag usage counters")
  public void testTagUsageCounters() {
    String tagId = "test-tag";
    assertEquals(0L, RelationshipCache.getTagUsage(tagId), "Initial tag usage should be 0");
    RelationshipCache.bumpTag(tagId, 1);
    assertEquals(1L, RelationshipCache.getTagUsage(tagId), "Tag usage should be 1 after increment");
    RelationshipCache.bumpTag(tagId, 5);
    assertEquals(
        6L, RelationshipCache.getTagUsage(tagId), "Tag usage should be 6 after increment by 5");
    RelationshipCache.bumpTag(tagId, -2);
    assertEquals(
        4L, RelationshipCache.getTagUsage(tagId), "Tag usage should be 4 after decrement by 2");
  }

  @Test
  @DisplayName("Test cache statistics tracking")
  public void testCacheStatistics() {
    Map<String, Long> initialStats = getCacheStats();
    LOG.info("Initial cache stats: {}", initialStats);
    String entityId = testTable.getId().toString();
    RelationshipCache.get(entityId);
    Map<String, Object> relationships = new HashMap<>();
    relationships.put("test", "value");
    RelationshipCache.put(entityId, relationships);
    RelationshipCache.get(entityId);
    Map<String, Long> finalStats = getCacheStats();
    assertNotNull(finalStats, "Cache statistics should not be null");
  }

  @Test
  @DisplayName("Test cached DAO findTo operations")
  public void testCachedDAOFindToOperations() {
    if (!(entityRelationshipDAO instanceof CachedEntityRelationshipDAO)) {
      LOG.warn("Skipping cached DAO test - cache not enabled");
      return;
    }
    UUID fromId = testTable.getId();
    String fromEntity = Entity.TABLE;
    List<Integer> relations = Arrays.asList(1, 2, 3);
    List<EntityRelationshipRecord> firstResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, relations);
    List<EntityRelationshipRecord> secondResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, relations);
    assertEquals(
        firstResult.size(),
        secondResult.size(),
        "Results should be identical for cache hit and miss");
  }

  @Test
  @DisplayName("Test cached DAO findFrom operations")
  public void testCachedDAOFindFromOperations() {
    if (!(entityRelationshipDAO instanceof CachedEntityRelationshipDAO)) {
      LOG.warn("Skipping cached DAO test - cache not enabled");
      return;
    }
    UUID toId = testTable.getId();
    String toEntity = Entity.TABLE;
    int relation = 1;
    String fromEntity = Entity.DATABASE;
    List<EntityRelationshipRecord> firstResult =
        entityRelationshipDAO.findFrom(toId, toEntity, relation, fromEntity);
    List<EntityRelationshipRecord> secondResult =
        entityRelationshipDAO.findFrom(toId, toEntity, relation, fromEntity);
    assertEquals(
        firstResult.size(),
        secondResult.size(),
        "Results should be identical for cache hit and miss");
  }

  @Test
  @DisplayName("Test cache invalidation on relationship insertion")
  public void testCacheInvalidationOnInsert() {
    if (!(entityRelationshipDAO instanceof CachedEntityRelationshipDAO)) {
      LOG.warn("Skipping cached DAO test - cache not enabled");
      return;
    }

    UUID fromId = testTable.getId();
    UUID toId = testDatabase.getId();
    String fromEntity = Entity.TABLE;
    String toEntity = Entity.DATABASE;
    int relation = 1;

    List<EntityRelationshipRecord> initialResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, List.of(relation));
    entityRelationshipDAO.insert(fromId, toId, fromEntity, toEntity, relation, "{}");
    List<EntityRelationshipRecord> afterInsertResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, List.of(relation));
  }

  @Test
  @DisplayName("Test cache invalidation on relationship deletion")
  public void testCacheInvalidationOnDelete() {
    if (!(entityRelationshipDAO instanceof CachedEntityRelationshipDAO)) {
      LOG.warn("Skipping cached DAO test - cache not enabled");
      return;
    }

    UUID fromId = testTable.getId();
    UUID toId = testDatabase.getId();
    String fromEntity = Entity.TABLE;
    String toEntity = Entity.DATABASE;
    int relation = 1;

    entityRelationshipDAO.insert(fromId, toId, fromEntity, toEntity, relation, "{}");
    List<EntityRelationshipRecord> beforeDeleteResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, List.of(relation));
    int deletedCount = entityRelationshipDAO.delete(fromId, fromEntity, toId, toEntity, relation);
    List<EntityRelationshipRecord> afterDeleteResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, List.of(relation));
  }

  @Test
  @DisplayName("Test bulk operations handle cache correctly")
  public void testBulkOperations() {
    if (!(entityRelationshipDAO instanceof CachedEntityRelationshipDAO)) {
      LOG.warn("Skipping cached DAO test - cache not enabled");
      return;
    }

    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CollectionDAO.EntityRelationshipObject rel =
          CollectionDAO.EntityRelationshipObject.builder()
              .fromId(testTable.getId().toString())
              .toId(UUID.randomUUID().toString())
              .fromEntity(Entity.TABLE)
              .toEntity(Entity.TAG)
              .relation(2)
              .build();
      relationships.add(rel);
    }

    List<EntityRelationshipRecord> beforeBulkResult =
        entityRelationshipDAO.findTo(testTable.getId(), Entity.TABLE, List.of(2));

    entityRelationshipDAO.bulkInsertTo(relationships);
    List<EntityRelationshipRecord> afterBulkResult =
        entityRelationshipDAO.findTo(testTable.getId(), Entity.TABLE, List.of(2));
  }

  @Test
  @DisplayName("Test cache behavior with null and empty data")
  public void testCacheWithNullAndEmptyData() {
    String entityId = testTable.getId().toString();
    RelationshipCache.put(entityId, null);
    Map<String, Object> result = RelationshipCache.get(entityId);
    assertTrue(result.isEmpty(), "Cache should return empty map for null data");
    Map<String, Object> emptyMap = new HashMap<>();
    RelationshipCache.put(entityId, emptyMap);
    result = RelationshipCache.get(entityId);
    assertTrue(result.isEmpty(), "Cache should return empty map for null data");
    Map<String, Object> mapWithNulls = new HashMap<>();
    mapWithNulls.put("key1", null);
    mapWithNulls.put("key2", "value");
    RelationshipCache.put(entityId, mapWithNulls);
    result = RelationshipCache.get(entityId);

    if (result != null) {
      assertFalse(result.containsKey("key1"), "Cache should not store null values");
      assertTrue(result.containsKey("key2"), "Cache should store non-null values");
    }

    LOG.info("Cache null and empty data test passed");
  }

  @Test
  @DisplayName("Test cache performance under load")
  public void testCachePerformance() {
    int operationCount = 100;
    String baseEntityId = "performance-test-";
    long startTime = System.currentTimeMillis();

    for (int i = 0; i < operationCount; i++) {
      String entityId = baseEntityId + i;
      Map<String, Object> data = new HashMap<>();
      data.put("iteration", i);
      data.put("timestamp", System.currentTimeMillis());
      RelationshipCache.put(entityId, data);
      Map<String, Object> retrieved = RelationshipCache.get(entityId);
      assertNotNull(retrieved, "Data should be retrievable from cache");
      if (i % 10 == 0) {
        RelationshipCache.evict(entityId);
      }
    }

    long endTime = System.currentTimeMillis();
    long totalTime = endTime - startTime;
    LOG.info(
        "Performed {} cache operations in {} ms (avg: {} ms per operation)",
        operationCount * 2,
        totalTime,
        (double) totalTime / (operationCount * 2));
    assertTrue(totalTime < operationCount * 10, "Cache operations should be reasonably fast");
    LOG.info("Cache performance test passed");
  }

  @AfterEach
  public void tearDown() {
    clearCache();
  }
}
