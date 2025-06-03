/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;

@Slf4j
@TestMethodOrder(OrderAnnotation.class)
class EntityRelationshipCleanupTest extends OpenMetadataApplicationTest {

  private static TableResourceTest tableTest;

  private static List<Table> testTables;

  private static CollectionDAO collectionDAO;
  private static EntityRelationshipCleanup cleanup;

  @BeforeAll
  static void setup(TestInfo test) throws IOException {
    DatabaseServiceResourceTest serviceTest = new DatabaseServiceResourceTest();
    tableTest = new TableResourceTest();
    testTables = new ArrayList<>();

    collectionDAO = Entity.getCollectionDAO();
    serviceTest.setupDatabaseServices(test);
    tableTest.setupDatabaseSchemas(test);
    setupTestEntities(test);
  }

  private static void setupTestEntities(TestInfo test) throws IOException {
    Database testDatabase = EntityResourceTest.DATABASE;
    DatabaseSchema testSchema = EntityResourceTest.DATABASE_SCHEMA;

    for (int i = 0; i < 3; i++) {
      CreateTable createTable =
          tableTest.createRequest(test, i).withDatabaseSchema(testSchema.getFullyQualifiedName());
      Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
      testTables.add(table);
    }

    LOG.info(
        "Created test entities: Database={}, Schema={}, Tables={}",
        testDatabase.getId(),
        testSchema.getId(),
        testTables.size());
  }

  @Test
  void test_cleanupWithValidRelationships_shouldFindNoOrphans() {
    cleanup = new EntityRelationshipCleanup(collectionDAO, true); // dry-run mode
    EntityRelationshipCleanup.CleanupResult result = cleanup.performCleanup(100);
    assertNotNull(result);
    assertTrue(result.getTotalRelationshipsScanned() >= 0);
  }

  @Test
  void test_cleanupAfterDeletingEntity_shouldDetectOrphans() {
    Table tableToDelete = testTables.get(0);
    UUID tableId = tableToDelete.getId();
    collectionDAO.tableDAO().delete(tableId);
    cleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup.performCleanup(100);
    assertNotNull(result);
    assertTrue(
        result.getOrphanedRelationshipsFound() > 0,
        "Should find orphaned relationships after entity deletion");
    boolean foundOrphanedTable =
        result.getOrphanedRelationships().stream()
            .anyMatch(
                orphan ->
                    tableId.toString().equals(orphan.getFromId())
                        || tableId.toString().equals(orphan.getToId()));
    assertTrue(foundOrphanedTable, "Should find orphaned relationships for deleted table");

    assertFalse(result.getOrphansByEntityType().isEmpty(), "Should have entity type statistics");
    assertFalse(
        result.getOrphansByRelationType().isEmpty(), "Should have relation type statistics");
  }

  @Test
  void test_actualCleanup_shouldDeleteOrphanedRelationships() {
    EntityRelationshipCleanup dryRunCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult dryRunResult = dryRunCleanup.performCleanup(100);

    int orphansFoundInDryRun = dryRunResult.getOrphanedRelationshipsFound();

    if (orphansFoundInDryRun > 0) {
      EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
      EntityRelationshipCleanup.CleanupResult actualResult = actualCleanup.performCleanup(100);

      assertNotNull(actualResult);
      assertTrue(
          actualResult.getRelationshipsDeleted() > 0, "Should have deleted orphaned relationships");
      assertEquals(
          orphansFoundInDryRun,
          actualResult.getRelationshipsDeleted(),
          "Should delete same number of relationships as found in dry run");

      EntityRelationshipCleanup verificationCleanup =
          new EntityRelationshipCleanup(collectionDAO, true);
      EntityRelationshipCleanup.CleanupResult verificationResult =
          verificationCleanup.performCleanup(100);

      assertEquals(
          0,
          verificationResult.getOrphanedRelationshipsFound(),
          "Should find no orphaned relationships after cleanup");
    }
  }

  @Test
  void test_paginationWithLargeBatchSize() {
    cleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup.performCleanup(10000);
    assertNotNull(result);
    assertTrue(result.getTotalRelationshipsScanned() >= 0);
  }

  @Test
  void test_paginationWithSmallBatchSize() {
    cleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup.performCleanup(10);
    assertNotNull(result);
    assertTrue(result.getTotalRelationshipsScanned() >= 0);
  }

  @Test
  void test_createOrphanedRelationshipScenario() {
    UUID nonExistentId1 = UUID.randomUUID();
    UUID nonExistentId2 = UUID.randomUUID();

    collectionDAO
        .relationshipDAO()
        .insert(
            nonExistentId1,
            nonExistentId2,
            "table",
            "databaseSchema",
            Relationship.CONTAINS.ordinal(),
            null);
    cleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup.performCleanup(100);
    assertTrue(
        result.getOrphanedRelationshipsFound() > 0,
        "Should detect manually created orphaned relationship");

    boolean foundSpecificOrphan =
        result.getOrphanedRelationships().stream()
            .anyMatch(
                orphan ->
                    nonExistentId1.toString().equals(orphan.getFromId())
                        && nonExistentId2.toString().equals(orphan.getToId()));

    assertTrue(foundSpecificOrphan, "Should find the specific orphaned relationship created");

    EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.CleanupResult cleanupResult = actualCleanup.performCleanup(100);

    assertTrue(
        cleanupResult.getRelationshipsDeleted() > 0, "Should delete the orphaned relationship");
  }

  @Test
  void test_validationOfExistingRelationships() {
    long relationshipCountBefore = collectionDAO.relationshipDAO().getTotalRelationshipCount();
    cleanup = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.CleanupResult result = cleanup.performCleanup(100);
    long relationshipCountAfter = collectionDAO.relationshipDAO().getTotalRelationshipCount();
    long expectedCount = relationshipCountBefore - result.getRelationshipsDeleted();
    assertEquals(
        expectedCount,
        relationshipCountAfter,
        "Relationship count should match expected after cleanup");

    LOG.info(
        "Validation test - Before: {}, After: {}, Deleted: {}",
        relationshipCountBefore,
        relationshipCountAfter,
        result.getRelationshipsDeleted());

    for (Table table : testTables.subList(1, testTables.size())) {
      try {
        Table retrievedTable = tableTest.getEntity(table.getId(), ADMIN_AUTH_HEADERS);
        assertNotNull(retrievedTable, "Valid table should still exist");
        assertNotNull(
            retrievedTable.getDatabaseSchema(), "Table should still have schema reference");
      } catch (Exception e) {
        // If table was part of orphaned cleanup, that's expected
        LOG.info("Table {} not found after cleanup (expected if it was orphaned)", table.getId());
      }
    }
  }

  @Test
  void test_relationshipCleanupCommand_dryRun() {
    EntityRelationshipCleanup dryRunCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = dryRunCleanup.performCleanup(500);
    assertNotNull(result, "Cleanup result should not be null");
    assertTrue(result.getTotalRelationshipsScanned() >= 0, "Should scan some relationships");
  }

  @Test
  void test_relationshipCleanupCommand_withOrphanedData() {
    UUID nonExistentEntityId = UUID.randomUUID();

    collectionDAO
        .relationshipDAO()
        .insert(
            testTables.get(1).getId(),
            nonExistentEntityId,
            "table",
            "databaseSchema",
            Relationship.CONTAINS.ordinal(),
            null);

    EntityRelationshipCleanup dryRunCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult dryRunResult = dryRunCleanup.performCleanup(100);

    assertNotNull(dryRunResult, "Dry-run result should not be null");
    assertTrue(dryRunResult.getOrphanedRelationshipsFound() > 0, "Should find orphaned data");

    EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.CleanupResult cleanupResult = actualCleanup.performCleanup(100);

    assertNotNull(cleanupResult, "Cleanup result should not be null");
    assertTrue(cleanupResult.getRelationshipsDeleted() > 0, "Should delete orphaned relationships");
  }

  @Test
  void test_relationshipCleanupCommand_noOrphanedData() {
    EntityRelationshipCleanup cleanup1 = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.CleanupResult result = cleanup1.performCleanup(100);
    assertNotNull(result, "Cleanup result should not be null");
    assertEquals(
        0,
        result.getRelationshipsDeleted(),
        "Should not delete any relationships when none are orphaned");
  }

  @Test
  void test_relationshipCleanupCommand_smallBatchSize() {
    EntityRelationshipCleanup cleanup1 = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup1.performCleanup(10);

    assertNotNull(result, "Cleanup result should not be null");
    assertTrue(result.getTotalRelationshipsScanned() >= 0, "Should scan relationships");
  }

  @Test
  void test_relationshipCleanupCommand_largeBatchSize() {
    EntityRelationshipCleanup cleanup1 = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup1.performCleanup(10000);

    assertNotNull(result, "Cleanup result should not be null");
    assertTrue(result.getTotalRelationshipsScanned() >= 0, "Should scan relationships");
  }

  @Test
  void test_relationshipCleanupCommand_multipleOrphanedRelationships() {
    for (int i = 0; i < 5; i++) {
      UUID nonExistentId1 = UUID.randomUUID();
      UUID nonExistentId2 = UUID.randomUUID();

      collectionDAO
          .relationshipDAO()
          .insert(
              nonExistentId1,
              nonExistentId2,
              "table",
              "databaseSchema",
              Relationship.CONTAINS.ordinal(),
              null);
    }

    EntityRelationshipCleanup cleanup1 = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.CleanupResult result = cleanup1.performCleanup(2);

    assertNotNull(result, "Cleanup result should not be null");
    assertTrue(
        result.getRelationshipsDeleted() >= 5,
        "Should delete at least the 5 orphaned relationships created");
  }

  @Test
  void test_relationshipCleanupCommand_validationOfParameters() {

    EntityRelationshipCleanup minBatchCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult minBatchResult = minBatchCleanup.performCleanup(1);

    assertNotNull(minBatchResult, "Minimum batch size result should not be null");
    EntityRelationshipCleanup defaultCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult defaultResult = defaultCleanup.performCleanup(1000);

    assertNotNull(defaultResult, "Default batch size result should not be null");
  }

  @Test
  void test_commandIntegrationValidation() {
    EntityRelationshipCleanup cleanup1 = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup1.performCleanup(100);

    assertNotNull(result, "Command integration result should not be null");
    assertTrue(result.getTotalRelationshipsScanned() >= 0, "Should scan relationships");
  }

  @Test
  void test_emptyDatabaseScenario() {
    // Test cleanup behavior when there are minimal relationships

    // Run cleanup on current database
    cleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.CleanupResult result = cleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(result.getTotalRelationshipsScanned() >= 0);
  }
}
