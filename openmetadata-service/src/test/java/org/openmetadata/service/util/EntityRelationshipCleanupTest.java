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
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
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

  @ParameterizedTest
  @ValueSource(ints = {10, 100, 1000, 10000})
  void test_cleanupWithDifferentBatchSizes_shouldScanRelationships(int batchSize) {
    cleanup = new EntityRelationshipCleanup(collectionDAO, true); // dry-run mode
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup.performCleanup(batchSize);
    assertNotNull(result, "Cleanup result should not be null for batch size: " + batchSize);
    assertTrue(
        result.getTotalRelationshipsScanned() >= 0,
        "Should scan relationships with batch size: " + batchSize);
  }

  @Test
  void test_cleanupAfterDeletingEntity_shouldDetectOrphans() {
    Table tableToDelete = testTables.getFirst();
    UUID tableId = tableToDelete.getId();
    collectionDAO.tableDAO().delete(tableId);
    cleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup.performCleanup(100);
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
    EntityRelationshipCleanup.EntityCleanupResult dryRunResult = dryRunCleanup.performCleanup(100);

    int orphansFoundInDryRun = dryRunResult.getOrphanedRelationshipsFound();

    if (orphansFoundInDryRun > 0) {
      EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
      EntityRelationshipCleanup.EntityCleanupResult actualResult =
          actualCleanup.performCleanup(100);

      assertNotNull(actualResult);
      assertTrue(
          actualResult.getRelationshipsDeleted() > 0, "Should have deleted orphaned relationships");
      assertEquals(
          orphansFoundInDryRun,
          actualResult.getRelationshipsDeleted(),
          "Should delete same number of relationships as found in dry run");

      EntityRelationshipCleanup verificationCleanup =
          new EntityRelationshipCleanup(collectionDAO, true);
      EntityRelationshipCleanup.EntityCleanupResult verificationResult =
          verificationCleanup.performCleanup(100);

      assertEquals(
          0,
          verificationResult.getOrphanedRelationshipsFound(),
          "Should find no orphaned relationships after cleanup");
    }
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
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup.performCleanup(100);
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
    EntityRelationshipCleanup.EntityCleanupResult cleanupResult = actualCleanup.performCleanup(100);

    assertTrue(
        cleanupResult.getRelationshipsDeleted() > 0, "Should delete the orphaned relationship");
  }

  @Test
  @Order(1)
  void test_validationOfExistingRelationships() {
    // Create known orphaned relationships for testing
    UUID orphanId1 = UUID.randomUUID();
    UUID orphanId2 = UUID.randomUUID();

    // Insert a known orphaned relationship
    collectionDAO
        .relationshipDAO()
        .insert(
            orphanId1, orphanId2, "table", "databaseSchema", Relationship.CONTAINS.ordinal(), null);

    // Run cleanup
    cleanup = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup.performCleanup(100);

    // Verify that at least our known orphaned relationship was deleted
    assertTrue(
        result.getRelationshipsDeleted() >= 1,
        "Should have deleted at least the known orphaned relationship");

    LOG.info(
        "Validation test - Deleted: {} orphaned relationships", result.getRelationshipsDeleted());

    // Verify valid tables still exist after cleanup
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
    EntityRelationshipCleanup.EntityCleanupResult result = dryRunCleanup.performCleanup(500);
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
    EntityRelationshipCleanup.EntityCleanupResult dryRunResult = dryRunCleanup.performCleanup(100);

    assertNotNull(dryRunResult, "Dry-run result should not be null");
    assertTrue(dryRunResult.getOrphanedRelationshipsFound() > 0, "Should find orphaned data");

    EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.EntityCleanupResult cleanupResult = actualCleanup.performCleanup(100);

    assertNotNull(cleanupResult, "Cleanup result should not be null");
    assertTrue(cleanupResult.getRelationshipsDeleted() > 0, "Should delete orphaned relationships");
  }

  @Test
  void test_relationshipCleanupCommand_noOrphanedData() {
    // First clean up any existing orphaned relationships from other tests
    EntityRelationshipCleanup initialCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    initialCleanup.performCleanup(100);

    // Now run the actual test - there should be no orphaned relationships
    EntityRelationshipCleanup cleanup1 = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup1.performCleanup(100);
    assertNotNull(result, "Cleanup result should not be null");
    assertEquals(
        0,
        result.getRelationshipsDeleted(),
        "Should not delete any relationships when none are orphaned");
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
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup1.performCleanup(2);

    assertNotNull(result, "Cleanup result should not be null");
    assertTrue(
        result.getRelationshipsDeleted() >= 5,
        "Should delete at least the 5 orphaned relationships created");
  }

  @Test
  void test_relationshipCleanupCommand_validationOfParameters() {

    EntityRelationshipCleanup minBatchCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult minBatchResult =
        minBatchCleanup.performCleanup(1);

    assertNotNull(minBatchResult, "Minimum batch size result should not be null");
    EntityRelationshipCleanup defaultCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult defaultResult =
        defaultCleanup.performCleanup(1000);

    assertNotNull(defaultResult, "Default batch size result should not be null");
  }

  @Test
  void test_commandIntegrationValidation() {
    EntityRelationshipCleanup cleanup1 = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup1.performCleanup(100);

    assertNotNull(result, "Command integration result should not be null");
    assertTrue(result.getTotalRelationshipsScanned() >= 0, "Should scan relationships");
  }

  @Test
  void test_emptyDatabaseScenario() {
    // Test cleanup behavior when there are minimal relationships

    // Run cleanup on current database
    cleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(result.getTotalRelationshipsScanned() >= 0);
  }

  @Test
  void test_commandBehavior_defaultDryRunWithNoOrphans() {
    // First clean up any existing orphaned relationships from other tests
    EntityRelationshipCleanup initialCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    initialCleanup.performCleanup(100);

    // Now run the actual test
    EntityRelationshipCleanup dryRunCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = dryRunCleanup.performCleanup(100);

    assertNotNull(result);

    boolean wouldReturnOne = result.getOrphanedRelationshipsFound() > 0;
    assertFalse(
        wouldReturnOne || result.getOrphanedRelationshipsFound() < 0,
        "Default dry-run with no orphans should indicate success (exit code 0)");
  }

  @Test
  void test_commandBehavior_defaultDryRunWithOrphans() {
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

    EntityRelationshipCleanup dryRunCleanup = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = dryRunCleanup.performCleanup(100);

    assertNotNull(result);

    boolean wouldReturnOne = result.getOrphanedRelationshipsFound() > 0;
    assertTrue(
        wouldReturnOne, "Default dry-run with orphans found should indicate failure (exit code 1)");

    assertTrue(result.getOrphanedRelationshipsFound() > 0, "Should find the orphaned relationship");
    assertEquals(0, result.getRelationshipsDeleted(), "Should not delete in dry-run mode");

    EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    actualCleanup.performCleanup(100);
  }

  @Test
  void test_commandBehavior_explicitDeleteFlag() {
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

    EntityRelationshipCleanup deleteCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.EntityCleanupResult result = deleteCleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(result.getRelationshipsDeleted() > 0, "Should have deleted orphaned relationships");
  }

  @Test
  void test_commandBehavior_batchSizeParameter() {
    int customBatchSize = 50;

    EntityRelationshipCleanup cleanupRel = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result =
        cleanupRel.performCleanup(customBatchSize);

    assertNotNull(result);
    assertTrue(result.getTotalRelationshipsScanned() >= 0);
  }

  @Test
  void test_commandBehavior_flagSemantics() {
    EntityRelationshipCleanup defaultBehavior = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult defaultResult =
        defaultBehavior.performCleanup(100);

    EntityRelationshipCleanup deleteBehavior = new EntityRelationshipCleanup(collectionDAO, false);
    EntityRelationshipCleanup.EntityCleanupResult deleteResult = deleteBehavior.performCleanup(100);

    assertNotNull(defaultResult);
    assertNotNull(deleteResult);

    assertEquals(
        0,
        defaultResult.getRelationshipsDeleted(),
        "Default behavior (dry-run) should not delete any relationships");

    assertTrue(
        deleteResult.getRelationshipsDeleted() >= 0,
        "Delete mode should delete 0 or more relationships");
  }

  @Test
  void test_entityWithTimeSeriesRepository_shouldNotBeCleanedWhenExists() {
    UUID testCaseId = UUID.randomUUID();
    UUID testCaseResolutionId = UUID.randomUUID();
    UUID tableId = testTables.getFirst().getId();

    collectionDAO
        .relationshipDAO()
        .insert(
            testCaseId,
            tableId,
            Entity.TABLE,
            Entity.TEST_CASE,
            Relationship.CONTAINS.ordinal(),
            null);

    collectionDAO
        .relationshipDAO()
        .insert(
            testCaseId,
            testCaseResolutionId,
            Entity.TEST_CASE,
            Entity.TEST_CASE_RESULT,
            Relationship.PARENT_OF.ordinal(),
            null);

    EntityRelationshipCleanup cleanupRel = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanupRel.performCleanup(100);

    assertNotNull(result);
    assertTrue(
        result.getOrphanedRelationshipsFound() > 0,
        "Should find orphaned relationships for non-existent time series entities");

    boolean foundTestCaseOrphan =
        result.getOrphanedRelationships().stream()
            .anyMatch(
                orphan ->
                    testCaseId.toString().equals(orphan.getFromId())
                        || testCaseId.toString().equals(orphan.getToId()));

    boolean foundTestCaseResultOrphan =
        result.getOrphanedRelationships().stream()
            .anyMatch(
                orphan ->
                    testCaseResolutionId.toString().equals(orphan.getFromId())
                        || testCaseResolutionId.toString().equals(orphan.getToId()));

    assertTrue(foundTestCaseOrphan, "Should find orphaned relationship for non-existent testCase");
    assertTrue(
        foundTestCaseResultOrphan,
        "Should find orphaned relationship for non-existent testCaseResult");

    // Clean up the orphaned relationships we created
    EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    actualCleanup.performCleanup(100);
  }

  @Test
  void test_entityWithoutAnyRepository_shouldNotBeCleanedUpEvenIfRelationshipExists() {
    UUID nonExistentId1 = UUID.randomUUID();
    UUID nonExistentId2 = UUID.randomUUID();
    UUID tableId = testTables.getFirst().getId();

    collectionDAO
        .relationshipDAO()
        .insert(
            nonExistentId1,
            tableId,
            "nonExistentEntityType",
            Entity.TABLE,
            Relationship.CONTAINS.ordinal(),
            null);

    collectionDAO
        .relationshipDAO()
        .insert(
            tableId,
            nonExistentId2,
            Entity.TABLE,
            "anotherNonExistentEntityType",
            Relationship.CONTAINS.ordinal(),
            null);

    EntityRelationshipCleanup cleanupRel = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanupRel.performCleanup(100);

    assertNotNull(result);

    boolean foundNonExistentFromEntity =
        result.getOrphanedRelationships().stream()
            .anyMatch(orphan -> nonExistentId1.toString().equals(orphan.getFromId()));

    boolean foundNonExistentToEntity =
        result.getOrphanedRelationships().stream()
            .anyMatch(orphan -> nonExistentId2.toString().equals(orphan.getToId()));

    assertFalse(
        foundNonExistentFromEntity,
        "Should NOT find orphaned relationship for entity without repository (from)");
    assertFalse(
        foundNonExistentToEntity,
        "Should NOT find orphaned relationship for entity without repository (to)");
  }

  @Test
  void test_mixedEntityTypes_onlyValidRepositoryEntitiesAreProcessed() {
    UUID testCaseId = UUID.randomUUID();
    UUID queryCostId = UUID.randomUUID();
    UUID workflowInstanceId = UUID.randomUUID();
    UUID invalidEntityId = UUID.randomUUID();
    UUID tableId = testTables.getFirst().getId();

    collectionDAO
        .relationshipDAO()
        .insert(
            testCaseId,
            tableId,
            Entity.TEST_CASE,
            Entity.TABLE,
            Relationship.TESTED_BY.ordinal(),
            null);

    collectionDAO
        .relationshipDAO()
        .insert(
            queryCostId,
            tableId,
            Entity.QUERY_COST_RECORD,
            Entity.TABLE,
            Relationship.RELATED_TO.ordinal(),
            null);

    collectionDAO
        .relationshipDAO()
        .insert(
            workflowInstanceId,
            tableId,
            Entity.WORKFLOW_INSTANCE,
            Entity.TABLE,
            Relationship.HAS.ordinal(),
            null);

    collectionDAO
        .relationshipDAO()
        .insert(
            invalidEntityId,
            tableId,
            "invalidEntityType",
            Entity.TABLE,
            Relationship.CONTAINS.ordinal(),
            null);

    EntityRelationshipCleanup cleanupRel = new EntityRelationshipCleanup(collectionDAO, true);
    EntityRelationshipCleanup.EntityCleanupResult result = cleanupRel.performCleanup(100);

    assertNotNull(result);

    boolean foundTestCaseOrphan =
        result.getOrphanedRelationships().stream()
            .anyMatch(orphan -> testCaseId.toString().equals(orphan.getFromId()));

    boolean foundQueryCostOrphan =
        result.getOrphanedRelationships().stream()
            .anyMatch(orphan -> queryCostId.toString().equals(orphan.getFromId()));

    boolean foundWorkflowInstanceOrphan =
        result.getOrphanedRelationships().stream()
            .anyMatch(orphan -> workflowInstanceId.toString().equals(orphan.getFromId()));

    boolean foundInvalidEntityOrphan =
        result.getOrphanedRelationships().stream()
            .anyMatch(orphan -> invalidEntityId.toString().equals(orphan.getFromId()));

    assertTrue(
        foundTestCaseOrphan,
        "Should find orphaned relationship for non-existent testCase (time series entity)");
    assertTrue(
        foundQueryCostOrphan,
        "Should find orphaned relationship for non-existent queryCostRecord (time series entity)");
    assertTrue(
        foundWorkflowInstanceOrphan,
        "Should find orphaned relationship for non-existent workflowInstance (time series entity)");
    assertFalse(
        foundInvalidEntityOrphan,
        "Should NOT find orphaned relationship for invalid entity type without repository");

    // Clean up the orphaned relationships we created
    EntityRelationshipCleanup actualCleanup = new EntityRelationshipCleanup(collectionDAO, false);
    actualCleanup.performCleanup(100);
  }
}
