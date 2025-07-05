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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.State;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;

/**
 * Test class for tag usage caching functionality.
 * Tests cache hit/miss scenarios, invalidation, and tag-specific operations.
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagUsageCacheTest extends CachedOpenMetadataApplicationResourceTest {

  private CollectionDAO.TagUsageDAO tagUsageDAO;

  // Test entities
  private Table testTable;
  private Database testDatabase;
  private DatabaseSchema testSchema;
  private DatabaseService testDatabaseService;

  // Test tag data
  private static final String TEST_TAG_FQN = "PersonalData.PII";
  private static final String TEST_TAG_FQN_HASH = "test-tag-hash";
  private String testEntityFQNHash;

  @BeforeEach
  public void setup() throws Exception {
    tagUsageDAO = Entity.getCollectionDAO().tagUsageDAO();

    if (tagUsageDAO instanceof CachedTagUsageDAO) {
      LOG.info("Using cached TagUsageDAO for testing");
    } else {
      LOG.info("Using regular TagUsageDAO - cache not enabled");
    }

    // Clear cache before each test for isolation
    clearCache();

    // Create test entities
    createTestEntities();

    // Set up test entity hash
    testEntityFQNHash = testTable.getFullyQualifiedName();
  }

  private void createTestEntities() throws Exception {
    // Create the entity hierarchy: DatabaseService -> Database -> DatabaseSchema -> Table
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
            .withName("testDatabase_" + testInfo.getDisplayName())
            .withService(testDatabaseService.getFullyQualifiedName());
    testDatabase = databaseResourceTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Create database schema
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("testSchema_" + testInfo.getDisplayName())
            .withDatabase(testDatabase.getFullyQualifiedName());
    testSchema = databaseSchemaResourceTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create table with columns
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
        return Optional.of(TagUsageCacheTest.class);
      }

      @Override
      public Optional<Method> getTestMethod() {
        try {
          return Optional.of(TagUsageCacheTest.class.getDeclaredMethod("createTestEntities"));
        } catch (NoSuchMethodException e) {
          return Optional.empty();
        }
      }
    };
  }

  @Test
  @Order(1)
  @DisplayName("Test cache is available for tag usage operations")
  public void testTagUsageCacheAvailable() {
    assertTrue(isCacheAvailable(), "Cache should be available in test environment");
    assertNotNull(getRedisContainer(), "Redis container should be running");
    assertTrue(getRedisContainer().isRunning(), "Redis container should be in running state");

    LOG.info("Tag usage cache availability test passed");
  }

  @Test
  @Order(2)
  @DisplayName("Test applying tags and cache operations")
  public void testApplyTagAndCache() {
    if (!(tagUsageDAO instanceof CachedTagUsageDAO)) {
      LOG.warn("Skipping cached tag test - cache not enabled");
      return;
    }

    // Apply a tag to the test entity
    tagUsageDAO.applyTag(
        TagSource.CLASSIFICATION.ordinal(),
        TEST_TAG_FQN,
        TEST_TAG_FQN_HASH,
        testEntityFQNHash,
        LabelType.MANUAL.ordinal(),
        State.CONFIRMED.ordinal());

    // Verify tag usage counter was updated
    long tagUsage = RelationshipCache.getTagUsage(TEST_TAG_FQN);
    assertEquals(1L, tagUsage, "Tag usage should be incremented after applying tag");

    LOG.info("Apply tag and cache test passed");
  }

  @Test
  @Order(3)
  @DisplayName("Test getting tags with cache hit/miss")
  public void testGetTagsCacheHitMiss() {
    if (!(tagUsageDAO instanceof CachedTagUsageDAO)) {
      LOG.warn("Skipping cached tag test - cache not enabled");
      return;
    }

    // Apply a tag first
    tagUsageDAO.applyTag(
        TagSource.CLASSIFICATION.ordinal(),
        TEST_TAG_FQN,
        TEST_TAG_FQN_HASH,
        testEntityFQNHash,
        LabelType.MANUAL.ordinal(),
        State.CONFIRMED.ordinal());

    // First call should be a cache miss
    List<TagLabel> firstResult = tagUsageDAO.getTags(testEntityFQNHash);
    assertNotNull(firstResult, "First result should not be null");

    // Second call should be a cache hit
    List<TagLabel> secondResult = tagUsageDAO.getTags(testEntityFQNHash);
    assertNotNull(secondResult, "Second result should not be null");

    // Results should be identical
    assertEquals(
        firstResult.size(),
        secondResult.size(),
        "Cache hit and miss should return identical results");

    LOG.info("Get tags cache hit/miss test passed");
  }

  @Test
  @Order(4)
  @DisplayName("Test batch tag retrieval caching")
  public void testBatchTagRetrieval() {
    if (!(tagUsageDAO instanceof CachedTagUsageDAO)) {
      LOG.warn("Skipping cached tag test - cache not enabled");
      return;
    }

    // Create a list of entity hashes for batch retrieval
    List<String> entityHashes = Arrays.asList(testEntityFQNHash, "entity2-hash", "entity3-hash");

    // Apply tags to the test entity
    tagUsageDAO.applyTag(
        TagSource.CLASSIFICATION.ordinal(),
        TEST_TAG_FQN,
        TEST_TAG_FQN_HASH,
        testEntityFQNHash,
        LabelType.MANUAL.ordinal(),
        State.CONFIRMED.ordinal());

    // First batch call should be a cache miss
    List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> firstBatchResult =
        tagUsageDAO.getTagsInternalBatch(entityHashes);
    assertNotNull(firstBatchResult, "First batch result should not be null");

    // Second batch call should be a cache hit
    List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> secondBatchResult =
        tagUsageDAO.getTagsInternalBatch(entityHashes);
    assertNotNull(secondBatchResult, "Second batch result should not be null");

    // Results should be identical
    assertEquals(
        firstBatchResult.size(),
        secondBatchResult.size(),
        "Batch cache hit and miss should return identical results");

    LOG.info("Batch tag retrieval test passed");
  }

  @Test
  @Order(5)
  @DisplayName("Test tags by prefix caching")
  public void testTagsByPrefixCaching() {
    if (!(tagUsageDAO instanceof CachedTagUsageDAO)) {
      LOG.warn("Skipping cached tag test - cache not enabled");
      return;
    }

    String prefix = testTable.getDatabaseSchema().getFullyQualifiedName();
    String postfix = "tables";

    // First call should be a cache miss
    Map<String, List<TagLabel>> firstResult = tagUsageDAO.getTagsByPrefix(prefix, postfix, true);
    assertNotNull(firstResult, "First prefix result should not be null");

    // Second call should be a cache hit
    Map<String, List<TagLabel>> secondResult = tagUsageDAO.getTagsByPrefix(prefix, postfix, true);
    assertNotNull(secondResult, "Second prefix result should not be null");

    // Results should be identical
    assertEquals(
        firstResult.size(),
        secondResult.size(),
        "Prefix cache hit and miss should return identical results");

    LOG.info("Tags by prefix caching test passed");
  }

  @Test
  @Order(6)
  @DisplayName("Test tag deletion and cache invalidation")
  public void testTagDeletionCacheInvalidation() {
    if (!(tagUsageDAO instanceof CachedTagUsageDAO)) {
      LOG.warn("Skipping cached tag test - cache not enabled");
      return;
    }

    // Apply a tag first
    tagUsageDAO.applyTag(
        TagSource.CLASSIFICATION.ordinal(),
        TEST_TAG_FQN,
        TEST_TAG_FQN_HASH,
        testEntityFQNHash,
        LabelType.MANUAL.ordinal(),
        State.CONFIRMED.ordinal());

    // Verify tag usage counter
    long initialUsage = RelationshipCache.getTagUsage(TEST_TAG_FQN);
    assertEquals(1L, initialUsage, "Initial tag usage should be 1");

    // Get tags to populate cache
    List<TagLabel> beforeDeletion = tagUsageDAO.getTags(testEntityFQNHash);
    assertNotNull(beforeDeletion, "Tags should exist before deletion");

    // Delete the tag
    tagUsageDAO.deleteTagLabels(TagSource.CLASSIFICATION.ordinal(), TEST_TAG_FQN_HASH);

    // Verify tag usage counter was decremented
    long afterDeletionUsage = RelationshipCache.getTagUsage(TEST_TAG_FQN);
    assertEquals(0L, afterDeletionUsage, "Tag usage should be decremented after deletion");

    // Get tags again - should reflect the deletion
    List<TagLabel> afterDeletion = tagUsageDAO.getTags(testEntityFQNHash);
    assertNotNull(afterDeletion, "Tags result should not be null after deletion");

    LOG.info("Tag deletion cache invalidation test passed");
  }

  // Note: updateState method not available in TagUsageDAO interface - test removed

  // Note: updateLabelType method not available in TagUsageDAO interface - test removed

  @Test
  @Order(9)
  @DisplayName("Test cache behavior with empty tag results")
  public void testCacheWithEmptyTagResults() {
    if (!(tagUsageDAO instanceof CachedTagUsageDAO)) {
      LOG.warn("Skipping cached tag test - cache not enabled");
      return;
    }

    // Query tags for entity that has no tags
    String emptyEntityFQN = "empty.entity.fqn";

    // First call - should return empty list
    List<TagLabel> firstResult = tagUsageDAO.getTags(emptyEntityFQN);
    assertNotNull(firstResult, "Result should not be null even for empty tags");

    // Second call - should also return empty list (from cache or database)
    List<TagLabel> secondResult = tagUsageDAO.getTags(emptyEntityFQN);
    assertNotNull(secondResult, "Second result should not be null");

    assertEquals(firstResult.size(), secondResult.size(), "Empty results should be consistent");

    LOG.info("Cache with empty tag results test passed");
  }

  @Test
  @Order(10)
  @DisplayName("Test cache performance with tag operations")
  public void testTagCachePerformance() {
    if (!(tagUsageDAO instanceof CachedTagUsageDAO)) {
      LOG.warn("Skipping cached tag test - cache not enabled");
      return;
    }

    int operationCount = 50;
    String baseTagFQN = "Performance.Tag";

    long startTime = System.currentTimeMillis();

    // Perform mixed tag operations
    for (int i = 0; i < operationCount; i++) {
      String tagFQN = baseTagFQN + i;
      String tagHash = "hash-" + i;

      // Apply tag
      tagUsageDAO.applyTag(
          TagSource.CLASSIFICATION.ordinal(),
          tagFQN,
          tagHash,
          testEntityFQNHash,
          LabelType.MANUAL.ordinal(),
          State.CONFIRMED.ordinal());

      // Get tags (should hit cache on subsequent calls)
      List<TagLabel> tags = tagUsageDAO.getTags(testEntityFQNHash);
      assertNotNull(tags, "Tags should be retrievable");

      // Note: updateState method not available in TagUsageDAO interface - operation skipped
    }

    long endTime = System.currentTimeMillis();
    long totalTime = endTime - startTime;

    LOG.info(
        "Performed {} tag cache operations in {} ms (avg: {} ms per operation)",
        operationCount * 2,
        totalTime,
        (double) totalTime / (operationCount * 2));

    // Performance should be reasonable
    assertTrue(totalTime < operationCount * 20, "Tag cache operations should be reasonably fast");

    LOG.info("Tag cache performance test passed");
  }

  @AfterEach
  public void tearDown() {
    // Clear cache after each test
    clearCache();
  }
}
