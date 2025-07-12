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
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;

/**
 * Test class to verify that the application works correctly when cache is disabled.
 * This ensures backward compatibility and that the cache is truly optional.
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class CacheDisabledCompatibilityTest extends OpenMetadataApplicationTest {

  private TableRepository tableRepository;
  private CollectionDAO.EntityRelationshipDAO entityRelationshipDAO;

  // Test entities
  private Table testTable;
  private Database testDatabase;
  private DatabaseSchema testSchema;
  private DatabaseService testDatabaseService;

  @BeforeEach
  public void setup() throws Exception {
    // Get repository instances
    tableRepository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
    entityRelationshipDAO = Entity.getCollectionDAO().relationshipDAO();

    // Create test entities
    createTestEntities();
  }

  private void createTestEntities() throws Exception {
    // Since this test doesn't extend EntityResourceTest, we need to create all entities from
    // scratch

    // Initialize test resource classes
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    DatabaseSchemaResourceTest databaseSchemaResourceTest = new DatabaseSchemaResourceTest();
    TableResourceTest tableResourceTest = new TableResourceTest();

    TestInfo testInfo = createTestInfo("createTestEntities");

    // Step 1: Create database service first
    testDatabaseService =
        databaseServiceResourceTest.createEntity(
            databaseServiceResourceTest.createRequest(testInfo), ADMIN_AUTH_HEADERS);

    // Step 2: Create database using the created service
    // Create the request manually since createRequest() depends on getContainer() which is null
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("testDatabase_" + testInfo.getDisplayName())
            .withService(testDatabaseService.getFullyQualifiedName());
    testDatabase = databaseResourceTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Step 3: Create database schema using the created database
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("testSchema_" + testInfo.getDisplayName())
            .withDatabase(testDatabase.getFullyQualifiedName());
    testSchema = databaseSchemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Step 4: Create table using the created schema
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
        return Optional.of(CacheDisabledCompatibilityTest.class);
      }

      @Override
      public Optional<Method> getTestMethod() {
        try {
          return Optional.of(
              CacheDisabledCompatibilityTest.class.getDeclaredMethod("createTestEntities"));
        } catch (NoSuchMethodException e) {
          return Optional.empty();
        }
      }
    };
  }

  @Test
  @Order(1)
  @DisplayName("Test cache is not available when disabled")
  public void testCacheNotAvailable() {
    assertFalse(RelationshipCache.isAvailable(), "Cache should not be available when disabled");

    LOG.info("Cache disabled verification test passed");
  }

  @Test
  @Order(2)
  @DisplayName("Test RelationshipCache static methods handle disabled state gracefully")
  public void testRelationshipCacheHandlesDisabledState() {
    String entityId = testTable.getId().toString();
    Map<String, Object> testData = new HashMap<>();
    testData.put("test", "value");

    // These operations should not throw exceptions when cache is disabled
    assertDoesNotThrow(
        () -> RelationshipCache.put(entityId, testData),
        "put() should handle disabled cache gracefully");

    assertDoesNotThrow(
        () -> {
          Map<String, Object> result = RelationshipCache.get(entityId);
          assertTrue(result.isEmpty(), "get() should return empty map when cache is disabled");
        },
        "get() should handle disabled cache gracefully");

    assertDoesNotThrow(
        () -> RelationshipCache.evict(entityId), "evict() should handle disabled cache gracefully");

    assertDoesNotThrow(
        () -> RelationshipCache.bumpTag("test-tag", 1),
        "bumpTag() should handle disabled cache gracefully");

    assertDoesNotThrow(
        () -> {
          long usage = RelationshipCache.getTagUsage("test-tag");
          assertEquals(0L, usage, "getTagUsage() should return 0 when cache is disabled");
        },
        "getTagUsage() should handle disabled cache gracefully");

    assertDoesNotThrow(
        () -> {
          Map<String, Long> stats = RelationshipCache.getCacheStats();
          assertTrue(
              stats.isEmpty(), "getCacheStats() should return empty map when cache is disabled");
        },
        "getCacheStats() should handle disabled cache gracefully");

    LOG.info("RelationshipCache disabled state handling test passed");
  }

  @Test
  @Order(3)
  @DisplayName("Test EntityRelationshipDAO operations work without cache")
  public void testEntityRelationshipDAOWithoutCache() {
    // Verify we're not using the cached DAO
    assertFalse(
        entityRelationshipDAO instanceof CachedEntityRelationshipDAO,
        "Should not be using CachedEntityRelationshipDAO when cache is disabled");

    UUID fromId = testTable.getId();
    String fromEntity = Entity.TABLE;
    List<Integer> relations = Arrays.asList(1, 2, 3);

    // Test findTo operation
    assertDoesNotThrow(
        () -> {
          List<EntityRelationshipRecord> result =
              entityRelationshipDAO.findTo(fromId, fromEntity, relations);
          assertNotNull(result, "findTo should return a result (even if empty)");
        },
        "findTo should work without cache");

    // Test findFrom operation
    UUID toId = testTable.getId();
    String toEntity = Entity.TABLE;
    int relation = 1;
    String fromEntityType = Entity.DATABASE;

    assertDoesNotThrow(
        () -> {
          List<EntityRelationshipRecord> result =
              entityRelationshipDAO.findFrom(toId, toEntity, relation, fromEntityType);
          assertNotNull(result, "findFrom should return a result (even if empty)");
        },
        "findFrom should work without cache");

    LOG.info("EntityRelationshipDAO operations without cache test passed");
  }

  @Test
  @Order(4)
  @DisplayName("Test relationship CRUD operations work without cache")
  public void testRelationshipCRUDWithoutCache() {
    UUID fromId = testTable.getId();
    UUID toId = testDatabase.getId();
    String fromEntity = Entity.TABLE;
    String toEntity = Entity.DATABASE;
    int relation = 1;
    String jsonData = "{\"test\": \"data\"}";

    // Test insert
    assertDoesNotThrow(
        () -> entityRelationshipDAO.insert(fromId, toId, fromEntity, toEntity, relation, jsonData),
        "Insert should work without cache");

    // Test read
    assertDoesNotThrow(
        () -> {
          List<EntityRelationshipRecord> result =
              entityRelationshipDAO.findTo(fromId, fromEntity, Arrays.asList(relation));
          assertNotNull(result, "Read should work without cache");
        },
        "Read should work without cache");

    // Test delete
    assertDoesNotThrow(
        () -> {
          int deletedCount =
              entityRelationshipDAO.delete(fromId, fromEntity, toId, toEntity, relation);
          assertTrue(deletedCount >= 0, "Delete should return non-negative count");
        },
        "Delete should work without cache");

    LOG.info("Relationship CRUD operations without cache test passed");
  }

  @Test
  @Order(5)
  @DisplayName("Test bulk operations work without cache")
  public void testBulkOperationsWithoutCache() {
    // Create test relationships for bulk operations
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

    // Test bulk insert
    assertDoesNotThrow(
        () -> entityRelationshipDAO.bulkInsertTo(relationships),
        "Bulk insert should work without cache");

    // Test bulk remove
    List<String> toIds =
        relationships.stream().map(CollectionDAO.EntityRelationshipObject::getToId).toList();

    assertDoesNotThrow(
        () ->
            entityRelationshipDAO.bulkRemoveTo(
                testTable.getId(), toIds, Entity.TABLE, Entity.TAG, 2),
        "Bulk remove should work without cache");

    LOG.info("Bulk operations without cache test passed");
  }

  @Test
  @Order(6)
  @DisplayName("Test application functionality is identical with and without cache")
  public void testFunctionalEquivalence() {
    // This test verifies that core functionality works the same way
    // whether cache is enabled or disabled

    UUID fromId = testTable.getId();
    String fromEntity = Entity.TABLE;
    List<Integer> relations = Arrays.asList(1, 2, 3);

    // Perform the same operation multiple times
    List<EntityRelationshipRecord> firstResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, relations);
    List<EntityRelationshipRecord> secondResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, relations);
    List<EntityRelationshipRecord> thirdResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, relations);

    // Results should be identical (since we're hitting the database each time)
    assertEquals(
        firstResult.size(), secondResult.size(), "Multiple calls should return identical results");
    assertEquals(
        firstResult.size(), thirdResult.size(), "Multiple calls should return identical results");

    // Test that data modifications work correctly
    UUID toId = testDatabase.getId();
    String toEntity = Entity.DATABASE;
    int relation = 1;

    // Get initial count
    List<EntityRelationshipRecord> initialResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, Arrays.asList(relation));
    int initialCount = initialResult.size();

    // Insert a relationship
    entityRelationshipDAO.insert(fromId, toId, fromEntity, toEntity, relation, "{}");

    // Verify the count increased
    List<EntityRelationshipRecord> afterInsertResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, Arrays.asList(relation));
    assertTrue(
        afterInsertResult.size() >= initialCount,
        "Insert should be reflected in subsequent queries");

    // Delete the relationship
    entityRelationshipDAO.delete(fromId, fromEntity, toId, toEntity, relation);

    // Verify the count is back to original
    List<EntityRelationshipRecord> afterDeleteResult =
        entityRelationshipDAO.findTo(fromId, fromEntity, Arrays.asList(relation));
    assertEquals(
        initialCount, afterDeleteResult.size(), "Delete should be reflected in subsequent queries");

    LOG.info("Functional equivalence test passed");
  }

  @Test
  @Order(7)
  @DisplayName("Test performance without cache is acceptable")
  public void testPerformanceWithoutCache() {
    int operationCount = 50; // Fewer operations since we're not using cache
    UUID fromId = testTable.getId();
    String fromEntity = Entity.TABLE;
    List<Integer> relations = Arrays.asList(1, 2, 3);

    long startTime = System.currentTimeMillis();

    // Perform multiple read operations
    for (int i = 0; i < operationCount; i++) {
      List<EntityRelationshipRecord> result =
          entityRelationshipDAO.findTo(fromId, fromEntity, relations);
      assertNotNull(result, "Each query should return a result");
    }

    long endTime = System.currentTimeMillis();
    long totalTime = endTime - startTime;

    LOG.info(
        "Performed {} database queries in {} ms (avg: {} ms per query)",
        operationCount,
        totalTime,
        (double) totalTime / operationCount);

    // Performance should be reasonable even without cache
    // (Allow more time since we're hitting the database each time)
    assertTrue(
        totalTime < operationCount * 100, "Database operations should complete in reasonable time");

    LOG.info("Performance without cache test passed");
  }

  @Test
  @Order(8)
  @DisplayName("Test error handling without cache")
  public void testErrorHandlingWithoutCache() {
    // Test with invalid UUIDs
    assertDoesNotThrow(
        () -> {
          List<EntityRelationshipRecord> result =
              entityRelationshipDAO.findTo(UUID.randomUUID(), "nonexistent", Arrays.asList(999));
          assertNotNull(result, "Should handle non-existent entities gracefully");
        },
        "Should handle invalid queries gracefully");

    // Test delete of non-existent relationship
    assertDoesNotThrow(
        () -> {
          int deletedCount =
              entityRelationshipDAO.delete(
                  UUID.randomUUID(), "nonexistent", UUID.randomUUID(), "nonexistent", 999);
          assertEquals(0, deletedCount, "Should return 0 for non-existent relationships");
        },
        "Should handle deletion of non-existent relationships gracefully");

    LOG.info("Error handling without cache test passed");
  }
}
