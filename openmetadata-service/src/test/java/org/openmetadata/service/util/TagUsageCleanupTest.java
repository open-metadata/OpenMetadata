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
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class TagUsageCleanupTest extends OpenMetadataApplicationTest {

  private static TableResourceTest tableTest;
  private static TagResourceTest tagResourceTest;
  private static GlossaryTermResourceTest glossaryTermTest;
  private static ClassificationResourceTest classificationResourceTest;

  private static List<Table> testTables;
  private static List<Tag> testTags;
  private static List<GlossaryTerm> testGlossaryTerms;
  private static Classification testClassification;

  private static CollectionDAO collectionDAO;
  private static TagUsageCleanup cleanup;

  @BeforeAll
  static void setup(TestInfo test) throws IOException, URISyntaxException {
    tableTest = new TableResourceTest();
    tagResourceTest = new TagResourceTest();
    glossaryTermTest = new GlossaryTermResourceTest();
    classificationResourceTest = new ClassificationResourceTest();
    GlossaryResourceTest glossaryTest = new GlossaryResourceTest();
    glossaryTest.setup(test);

    testTables = new ArrayList<>();
    testTags = new ArrayList<>();
    testGlossaryTerms = new ArrayList<>();

    collectionDAO = Entity.getCollectionDAO();

    tableTest.setupDatabaseSchemas(test);

    setupTestEntities(test);
  }

  private static void setupTestEntities(TestInfo test) throws IOException {
    // Create test classification and tags
    testClassification =
        classificationResourceTest.createEntity(
            classificationResourceTest.createRequest("CleanupTestClassification"),
            ADMIN_AUTH_HEADERS);

    for (int i = 0; i < 3; i++) {
      CreateTag createTag =
          tagResourceTest
              .createRequest(test, i)
              .withClassification(testClassification.getFullyQualifiedName());
      Tag tag = tagResourceTest.createEntity(createTag, ADMIN_AUTH_HEADERS);
      testTags.add(tag);
    }

    // Create test glossary terms
    for (int i = 0; i < 3; i++) {
      GlossaryTerm term =
          glossaryTermTest.createEntity(
              glossaryTermTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      testGlossaryTerms.add(term);
    }

    // Create test tables
    for (int i = 0; i < 3; i++) {
      CreateTable createTable =
          tableTest
              .createRequest(test, i)
              .withDatabaseSchema(EntityResourceTest.DATABASE_SCHEMA.getFullyQualifiedName());
      Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
      testTables.add(table);
    }

    LOG.info(
        "Created test entities: Tags={}, GlossaryTerms={}, Tables={}",
        testTags.size(),
        testGlossaryTerms.size(),
        testTables.size());
  }

  @ParameterizedTest
  @ValueSource(ints = {10, 100, 1000, 10000})
  void test_cleanupWithDifferentBatchSizes_shouldScanTagUsages(int batchSize) {
    cleanup = new TagUsageCleanup(collectionDAO, true); // dry-run mode
    TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(batchSize);
    assertNotNull(result, "Cleanup result should not be null for batch size: " + batchSize);
    assertTrue(
        result.getTotalTagUsagesScanned() >= 0,
        "Should scan tag usages with batch size: " + batchSize);
  }

  @Test
  void test_cleanupAfterDeletingTag_shouldDetectOrphans() {
    Tag tagToDelete = testTags.getFirst();
    String tagFQN = tagToDelete.getFullyQualifiedName();

    // Create a tag usage entry
    Table targetTable = testTables.getFirst();
    String targetFQNHash = FullyQualifiedName.buildHash(targetTable.getFullyQualifiedName());

    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            tagFQN,
            tagFQN,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    // Delete the tag
    collectionDAO.tagDAO().delete(tagToDelete.getId());

    // Run cleanup
    cleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(
        result.getOrphanedTagUsagesFound() > 0,
        "Should find orphaned tag usages after tag deletion");

    boolean foundOrphanedTag =
        result.getOrphanedTagUsages().stream()
            .anyMatch(
                orphan -> FullyQualifiedName.buildHash(tagFQN).equals(orphan.getTagFQNHash()));

    assertTrue(foundOrphanedTag, "Should find orphaned tag usage for deleted tag");
    assertFalse(result.getOrphansBySource().isEmpty(), "Should have source statistics");

    // Cleanup
    TagUsageCleanup actualCleanup = new TagUsageCleanup(collectionDAO, false);
    actualCleanup.performCleanup(100);
  }

  @Test
  void test_cleanupAfterDeletingGlossaryTerm_shouldDetectOrphans() {
    GlossaryTerm termToDelete = testGlossaryTerms.getFirst();
    String termFQN = termToDelete.getFullyQualifiedName();

    // Create a glossary term usage entry
    Table targetTable = testTables.get(1);
    String targetFQNHash = FullyQualifiedName.buildHash(targetTable.getFullyQualifiedName());

    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.GLOSSARY.ordinal(),
            termFQN,
            termFQN,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    // Delete the glossary term
    collectionDAO.glossaryTermDAO().delete(termToDelete.getId());

    // Run cleanup
    cleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(
        result.getOrphanedTagUsagesFound() > 0,
        "Should find orphaned tag usages after glossary term deletion");

    boolean foundOrphanedTerm =
        result.getOrphanedTagUsages().stream()
            .anyMatch(
                orphan -> FullyQualifiedName.buildHash(termFQN).equals(orphan.getTagFQNHash()));

    assertTrue(foundOrphanedTerm, "Should find orphaned tag usage for deleted glossary term");

    // Cleanup
    TagUsageCleanup actualCleanup = new TagUsageCleanup(collectionDAO, false);
    actualCleanup.performCleanup(100);
  }

  @Test
  void test_actualCleanup_shouldDeleteOrphanedTagUsages() {
    // Create orphaned tag usage
    String orphanTagFQN = "orphanedTag";
    String orphanTagFQNHash = FullyQualifiedName.buildHash(orphanTagFQN);
    String targetFQNHash = FullyQualifiedName.buildHash(testTables.get(2).getFullyQualifiedName());

    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            orphanTagFQN,
            orphanTagFQNHash,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    // Dry run
    TagUsageCleanup dryRunCleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult dryRunResult = dryRunCleanup.performCleanup(100);

    int orphansFoundInDryRun = dryRunResult.getOrphanedTagUsagesFound();

    if (orphansFoundInDryRun > 0) {
      // Actual cleanup
      TagUsageCleanup actualCleanup = new TagUsageCleanup(collectionDAO, false);
      TagUsageCleanup.TagCleanupResult actualResult = actualCleanup.performCleanup(100);

      assertNotNull(actualResult);
      assertTrue(actualResult.getTagUsagesDeleted() > 0, "Should have deleted orphaned tag usages");

      // Verify cleanup
      TagUsageCleanup verificationCleanup = new TagUsageCleanup(collectionDAO, true);
      TagUsageCleanup.TagCleanupResult verificationResult = verificationCleanup.performCleanup(100);

      boolean stillFoundOrphan =
          verificationResult.getOrphanedTagUsages().stream()
              .anyMatch(orphan -> orphanTagFQNHash.equals(orphan.getTagFQNHash()));

      assertFalse(
          stillFoundOrphan, "Should not find the specific orphaned tag usage after cleanup");
    }
  }

  @Test
  @Order(1)
  void test_createOrphanedTagUsageScenario() {
    String nonExistentTagFQN = "NonExistent.Tag";

    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            nonExistentTagFQN,
            nonExistentTagFQN,
            testTables.getFirst().getFullyQualifiedName(),
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    cleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(100);

    assertTrue(
        result.getOrphanedTagUsagesFound() > 0,
        "Should detect manually created orphaned tag usage");

    boolean foundSpecificOrphan =
        result.getOrphanedTagUsages().stream()
            .anyMatch(
                orphan ->
                    FullyQualifiedName.buildHash(nonExistentTagFQN).equals(orphan.getTagFQNHash()));

    assertTrue(foundSpecificOrphan, "Should find the specific orphaned tag usage created");

    TagUsageCleanup actualCleanup = new TagUsageCleanup(collectionDAO, false);
    TagUsageCleanup.TagCleanupResult cleanupResult = actualCleanup.performCleanup(100);

    assertTrue(cleanupResult.getTagUsagesDeleted() > 0, "Should delete the orphaned tag usage");
  }

  @Test
  void test_mixedSourceTypes_shouldHandleBothClassificationAndGlossary() {
    String orphanTagFQN = "OrphanedClassification.Tag";
    String orphanTermFQN = "OrphanedGlossary.Term";
    String targetFQNHash =
        FullyQualifiedName.buildHash(testTables.getFirst().getFullyQualifiedName());

    // Create orphaned classification tag usage
    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            orphanTagFQN,
            orphanTagFQN,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    // Create orphaned glossary term usage
    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.GLOSSARY.ordinal(),
            orphanTermFQN,
            orphanTermFQN,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    cleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(result.getOrphanedTagUsagesFound() >= 2, "Should find at least 2 orphaned usages");

    boolean foundClassificationOrphan =
        result.getOrphanedTagUsages().stream()
            .anyMatch(
                orphan ->
                    orphan.getSource() == TagLabel.TagSource.CLASSIFICATION.ordinal()
                        && FullyQualifiedName.buildHash(orphanTagFQN)
                            .equals(orphan.getTagFQNHash()));

    boolean foundGlossaryOrphan =
        result.getOrphanedTagUsages().stream()
            .anyMatch(
                orphan ->
                    orphan.getSource() == TagLabel.TagSource.GLOSSARY.ordinal()
                        && FullyQualifiedName.buildHash(orphanTermFQN)
                            .equals(orphan.getTagFQNHash()));

    assertTrue(foundClassificationOrphan, "Should find orphaned classification tag usage");
    assertTrue(foundGlossaryOrphan, "Should find orphaned glossary term usage");

    assertTrue(
        result.getOrphansBySource().containsKey("Classification"),
        "Should have Classification in statistics");
    assertTrue(
        result.getOrphansBySource().containsKey("Glossary"), "Should have Glossary in statistics");

    // Cleanup
    TagUsageCleanup actualCleanup = new TagUsageCleanup(collectionDAO, false);
    actualCleanup.performCleanup(100);
  }

  @Test
  void test_tagUsageCleanupCommand_dryRun() {
    TagUsageCleanup dryRunCleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = dryRunCleanup.performCleanup(500);
    assertNotNull(result, "Cleanup result should not be null");
    assertTrue(result.getTotalTagUsagesScanned() >= 0, "Should scan some tag usages");
  }

  @Test
  void test_tagUsageCleanupCommand_noOrphanedData() {
    // First clean up any existing orphaned tag usages from other tests
    TagUsageCleanup initialCleanup = new TagUsageCleanup(collectionDAO, false);
    initialCleanup.performCleanup(100);

    // Now run the actual test - there should be no orphaned tag usages
    TagUsageCleanup cleanup1 = new TagUsageCleanup(collectionDAO, false);
    TagUsageCleanup.TagCleanupResult result = cleanup1.performCleanup(100);
    assertNotNull(result, "Cleanup result should not be null");
    assertEquals(
        0, result.getTagUsagesDeleted(), "Should not delete any tag usages when none are orphaned");
  }

  @Test
  void test_tagUsageCleanupCommand_multipleOrphanedUsages() {
    for (int i = 0; i < 5; i++) {
      String orphanTagFQN = "MultipleOrphan.Tag" + i;
      String targetFQNHash =
          FullyQualifiedName.buildHash(testTables.getFirst().getFullyQualifiedName());

      collectionDAO
          .tagUsageDAO()
          .applyTag(
              TagLabel.TagSource.CLASSIFICATION.ordinal(),
              orphanTagFQN,
              orphanTagFQN,
              targetFQNHash,
              TagLabel.LabelType.MANUAL.ordinal(),
              TagLabel.State.CONFIRMED.ordinal(),
              null,
              "john.doe");
    }

    TagUsageCleanup cleanup1 = new TagUsageCleanup(collectionDAO, false);
    TagUsageCleanup.TagCleanupResult result = cleanup1.performCleanup(2);

    assertNotNull(result, "Cleanup result should not be null");
    assertTrue(
        result.getTagUsagesDeleted() >= 5,
        "Should delete at least the 5 orphaned tag usages created");
  }

  @Test
  void test_commandBehavior_defaultDryRunWithNoOrphans() {
    // First clean up any existing orphaned tag usages from other tests
    TagUsageCleanup initialCleanup = new TagUsageCleanup(collectionDAO, false);
    initialCleanup.performCleanup(100);

    // Now run the actual test
    TagUsageCleanup dryRunCleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = dryRunCleanup.performCleanup(100);

    assertNotNull(result);
    assertEquals(
        0, result.getOrphanedTagUsagesFound(), "Should find no orphaned tag usages after cleanup");
  }

  @Test
  void test_commandBehavior_defaultDryRunWithOrphans() {
    String orphanTagFQN = "OrphanForDryRun.Tag";
    String orphanTagFQNHash = FullyQualifiedName.buildHash(orphanTagFQN);
    String targetFQNHash =
        FullyQualifiedName.buildHash(testTables.getFirst().getFullyQualifiedName());

    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            orphanTagFQN,
            orphanTagFQNHash,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    TagUsageCleanup dryRunCleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = dryRunCleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(
        result.getOrphanedTagUsagesFound() > 0, "Should find the orphaned tag usage in dry-run");
    assertEquals(0, result.getTagUsagesDeleted(), "Should not delete in dry-run mode");

    // Cleanup
    TagUsageCleanup actualCleanup = new TagUsageCleanup(collectionDAO, false);
    actualCleanup.performCleanup(100);
  }

  @Test
  void test_commandBehavior_explicitDeleteFlag() {
    String orphanTagFQN = "OrphanForDelete.Tag";
    String orphanTagFQNHash = FullyQualifiedName.buildHash(orphanTagFQN);
    String targetFQNHash =
        FullyQualifiedName.buildHash(testTables.getFirst().getFullyQualifiedName());

    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            orphanTagFQN,
            orphanTagFQNHash,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    TagUsageCleanup deleteCleanup = new TagUsageCleanup(collectionDAO, false);
    TagUsageCleanup.TagCleanupResult result = deleteCleanup.performCleanup(100);

    assertNotNull(result);
    assertTrue(result.getTagUsagesDeleted() > 0, "Should have deleted orphaned tag usages");
  }

  @Test
  void test_commandBehavior_batchSizeParameter() {
    int customBatchSize = 50;

    TagUsageCleanup cleanupRel = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = cleanupRel.performCleanup(customBatchSize);

    assertNotNull(result);
    assertTrue(result.getTotalTagUsagesScanned() >= 0);
  }

  @Test
  void test_validTagUsages_shouldNotBeMarkedAsOrphaned() {
    Tag validTag = testTags.get(1);
    String validTagFQN = validTag.getFullyQualifiedName();
    String validTagFQNHash = FullyQualifiedName.buildHash(validTagFQN);
    String targetFQNHash = FullyQualifiedName.buildHash(testTables.get(1).getFullyQualifiedName());

    // Create a valid tag usage
    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.CLASSIFICATION.ordinal(),
            validTagFQN,
            validTagFQNHash,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    cleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(100);

    assertNotNull(result);

    // Verify that the valid tag usage is not marked as orphaned
    boolean foundValidTag =
        result.getOrphanedTagUsages().stream()
            .anyMatch(orphan -> validTagFQNHash.equals(orphan.getTagFQNHash()));

    assertFalse(foundValidTag, "Valid tag usage should not be marked as orphaned");
  }

  @Test
  void test_validGlossaryTermUsages_shouldNotBeMarkedAsOrphaned() {
    GlossaryTerm validTerm = testGlossaryTerms.get(1);
    String validTermFQN = validTerm.getFullyQualifiedName();
    String validTermFQNHash = FullyQualifiedName.buildHash(validTermFQN);
    String targetFQNHash = FullyQualifiedName.buildHash(testTables.get(1).getFullyQualifiedName());

    // Create a valid glossary term usage
    collectionDAO
        .tagUsageDAO()
        .applyTag(
            TagLabel.TagSource.GLOSSARY.ordinal(),
            validTermFQN,
            validTermFQNHash,
            targetFQNHash,
            TagLabel.LabelType.MANUAL.ordinal(),
            TagLabel.State.CONFIRMED.ordinal(),
            null,
            "john.doe");

    cleanup = new TagUsageCleanup(collectionDAO, true);
    TagUsageCleanup.TagCleanupResult result = cleanup.performCleanup(100);

    assertNotNull(result);

    // Verify that the valid glossary term usage is not marked as orphaned
    boolean foundValidTerm =
        result.getOrphanedTagUsages().stream()
            .anyMatch(orphan -> validTermFQNHash.equals(orphan.getTagFQNHash()));

    assertFalse(foundValidTerm, "Valid glossary term usage should not be marked as orphaned");
  }
}
