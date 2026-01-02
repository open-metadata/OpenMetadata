package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.AutoClassificationConfig;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Classification entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds classification-specific tests.
 *
 * <p>Migrated from: org.openmetadata.service.resources.tags.ClassificationResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class ClassificationResourceIT extends BaseEntityIT<Classification, CreateClassification> {

  // Disable tests that don't apply to Classification
  {
    supportsFollowers = false; // Classifications don't support followers
    supportsTags = false; // Classifications don't support tags field
    supportsDataProducts = false; // Classifications don't support dataProducts
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateClassification createMinimalRequest(TestNamespace ns) {
    CreateClassification request = new CreateClassification();
    request.setName(ns.prefix("classification"));
    request.setDescription("Test classification created by integration test");

    return request;
  }

  @Override
  protected CreateClassification createRequest(String name, TestNamespace ns) {
    CreateClassification request = new CreateClassification();
    request.setName(name);
    request.setDescription("Test classification");

    return request;
  }

  @Override
  protected Classification createEntity(CreateClassification createRequest) {
    return SdkClients.adminClient().classifications().create(createRequest);
  }

  @Override
  protected Classification getEntity(String id) {
    return SdkClients.adminClient().classifications().get(id);
  }

  @Override
  protected Classification getEntityByName(String fqn) {
    return SdkClients.adminClient().classifications().getByName(fqn);
  }

  @Override
  protected Classification patchEntity(String id, Classification entity) {
    return SdkClients.adminClient().classifications().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().classifications().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().classifications().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().classifications().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "classification";
  }

  @Override
  protected void validateCreatedEntity(Classification entity, CreateClassification createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain classification name");
  }

  @Override
  protected ListResponse<Classification> listEntities(ListParams params) {
    return SdkClients.adminClient().classifications().list(params);
  }

  @Override
  protected Classification getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().classifications().get(id, fields);
  }

  @Override
  protected Classification getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().classifications().getByName(fqn, fields);
  }

  @Override
  protected Classification getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().classifications().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().classifications().getVersionList(id);
  }

  @Override
  protected Classification getVersion(UUID id, Double version) {
    return SdkClients.adminClient().classifications().getVersion(id.toString(), version);
  }

  // ===================================================================
  // CLASSIFICATION-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_classificationWithMutuallyExclusive_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateClassification request = new CreateClassification();
    request.setName(ns.prefix("classification_mutex"));
    request.setDescription("Mutually exclusive classification");
    request.setMutuallyExclusive(true);

    Classification classification = createEntity(request);
    assertNotNull(classification);
    assertTrue(classification.getMutuallyExclusive());
  }

  @Test
  void post_classificationWithProvider_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateClassification request = new CreateClassification();
    request.setName(ns.prefix("classification_provider"));
    request.setDescription("Classification with provider");

    Classification classification = createEntity(request);
    assertNotNull(classification);
  }

  @Test
  void put_classificationDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateClassification request = new CreateClassification();
    request.setName(ns.prefix("classification_update_desc"));
    request.setDescription("Initial description");

    Classification classification = createEntity(request);
    assertEquals("Initial description", classification.getDescription());

    // Update description
    classification.setDescription("Updated description");
    Classification updated = patchEntity(classification.getId().toString(), classification);
    assertEquals("Updated description", updated.getDescription());
  }

  // NOTE: mutuallyExclusive cannot be changed after creation - the API explicitly ignores
  // any attempt to update this field. See ClassificationRepository.entitySpecificUpdate():
  //   "updated.setMutuallyExclusive(original.getMutuallyExclusive());"

  @Test
  void test_classificationNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first classification
    String name = ns.prefix("unique_classification");
    CreateClassification request1 = new CreateClassification();
    request1.setName(name);
    request1.setDescription("First classification");

    Classification classification1 = createEntity(request1);
    assertNotNull(classification1);

    // Attempt to create duplicate
    CreateClassification request2 = new CreateClassification();
    request2.setName(name);
    request2.setDescription("Duplicate classification");

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate classification should fail");
  }

  @Test
  void put_classificationInvalidRequest_400(TestNamespace ns) {
    // Classification with missing description
    CreateClassification createWithoutDesc = new CreateClassification();
    createWithoutDesc.setName(ns.prefix("invalid_no_desc"));

    assertThrows(
        InvalidRequestException.class,
        () -> createEntity(createWithoutDesc),
        "Creating classification without description should fail");

    // Classification with name too long
    String longName = "a".repeat(300);
    CreateClassification createWithLongName = new CreateClassification();
    createWithLongName.setName(longName);
    createWithLongName.setDescription("description");

    assertThrows(
        InvalidRequestException.class,
        () -> createEntity(createWithLongName),
        "Creating classification with long name should fail");
  }

  @Test
  void delete_systemClassification(TestNamespace ns) {
    // Get system classification "Tier"
    Classification tier = SdkClients.adminClient().classifications().getByName("Tier");
    assertNotNull(tier);
    assertEquals(ProviderType.SYSTEM, tier.getProvider());

    // Attempt to delete system classification should fail
    String tierId = tier.getId().toString();
    assertThrows(
        InvalidRequestException.class,
        () -> deleteEntity(tierId),
        "Deleting system classification should fail");
  }

  @Test
  void test_classificationOwnerPermissions(TestNamespace ns) {
    // Create classification without owners
    CreateClassification request = new CreateClassification();
    request.setName(ns.prefix("classification_owner_test"));
    request.setDescription("Classification for testing owner permissions");

    Classification classification = createEntity(request);
    assertNotNull(classification);
    assertTrue(
        classification.getOwners() == null || classification.getOwners().isEmpty(),
        "Classification should have no owners initially");

    // Update classification owners as admin using PATCH
    classification.setOwners(List.of(testUser1Ref()));
    Classification updated = patchEntity(classification.getId().toString(), classification);
    assertEquals(1, updated.getOwners().size(), "Classification should have one owner");
    assertEquals(testUser1().getId(), updated.getOwners().get(0).getId(), "Owner should be USER1");

    // Attempt to update owners as USER2 (should fail with forbidden)
    Classification fetchedClassification = getEntity(classification.getId().toString());
    fetchedClassification.setOwners(List.of(testUser2Ref()));

    String classificationId = fetchedClassification.getId().toString();
    assertThrows(
        Exception.class,
        () ->
            SdkClients.user2Client()
                .classifications()
                .update(classificationId, fetchedClassification),
        "USER2 should not be able to update owners");

    // Verify the above change did not modify owners
    Classification retrievedClassification =
        getEntityWithFields(classification.getId().toString(), "owners");
    assertEquals(
        1,
        retrievedClassification.getOwners().size(),
        "Classification should still have one owner");
    assertEquals(
        testUser1().getId(),
        retrievedClassification.getOwners().get(0).getId(),
        "Owner should still be USER1");
  }

  @Test
  void testClassificationTermCount(TestNamespace ns) {
    // Create a new classification
    CreateClassification createClassification = new CreateClassification();
    createClassification.setName(ns.prefix("classification_termcount"));
    createClassification.setDescription("Classification for testing term count");

    Classification classification = createEntity(createClassification);

    // Initially, termCount should be 0 when requested with termCount field
    Classification withTermCount =
        getEntityWithFields(classification.getId().toString(), "termCount");
    assertEquals(0, withTermCount.getTermCount(), "New classification should have 0 tags");

    // Create tags under this classification
    for (int i = 1; i <= 3; i++) {
      CreateTag createTag = new CreateTag();
      createTag.setName(ns.prefix("tag" + i));
      createTag.setDescription("Test tag " + i);
      createTag.setClassification(classification.getFullyQualifiedName());
      SdkClients.adminClient().tags().create(createTag);
    }

    // Now check termCount again
    withTermCount = getEntityWithFields(classification.getId().toString(), "termCount");
    assertEquals(3, withTermCount.getTermCount(), "Classification should have 3 tags");
  }

  @Test
  void test_entityStatusUpdateAndPatch(TestNamespace ns) {
    // Create a classification
    CreateClassification createClassification = new CreateClassification();
    createClassification.setName(ns.prefix("classification_status"));
    createClassification.setDescription("Classification for testing entity status");

    Classification classification = createEntity(createClassification);

    // Verify the classification is created with UNPROCESSED status
    assertEquals(
        EntityStatus.UNPROCESSED,
        classification.getEntityStatus(),
        "Classification should be created with UNPROCESSED status");

    // Update the entityStatus using PATCH operation
    classification.setEntityStatus(EntityStatus.IN_REVIEW);
    Classification updatedClassification =
        patchEntity(classification.getId().toString(), classification);

    // Verify the entityStatus was updated correctly
    assertEquals(
        EntityStatus.IN_REVIEW,
        updatedClassification.getEntityStatus(),
        "Classification should be updated to IN_REVIEW status");

    // Get the classification again to confirm the status is persisted
    Classification retrievedClassification = getEntity(updatedClassification.getId().toString());
    assertEquals(
        EntityStatus.IN_REVIEW,
        retrievedClassification.getEntityStatus(),
        "Retrieved classification should maintain IN_REVIEW status");
  }

  @Test
  void test_autoClassificationConfig_CRUD(TestNamespace ns) {
    // Create a classification without auto-classification config
    CreateClassification createClassification = new CreateClassification();
    createClassification.setName(ns.prefix("classification_autoconfig"));
    createClassification.setDescription("Classification for testing auto-classification config");

    Classification classification = createEntity(createClassification);

    // Verify no auto-classification config initially
    assertNull(
        classification.getAutoClassificationConfig(),
        "Classification should not have auto-classification config initially");

    // Add auto-classification config using PATCH
    org.openmetadata.schema.entity.classification.AutoClassificationConfig config =
        new org.openmetadata.schema.entity.classification.AutoClassificationConfig()
            .withEnabled(true)
            .withConflictResolution(
                org.openmetadata.schema.entity.classification.AutoClassificationConfig
                    .ConflictResolution.HIGHEST_CONFIDENCE)
            .withMinimumConfidence(0.7)
            .withRequireExplicitMatch(true);
    classification.setAutoClassificationConfig(config);

    Classification updatedClassification =
        patchEntity(classification.getId().toString(), classification);

    // Verify config was added
    assertNotNull(updatedClassification.getAutoClassificationConfig());
    assertTrue(updatedClassification.getAutoClassificationConfig().getEnabled());
    assertEquals(0.7, updatedClassification.getAutoClassificationConfig().getMinimumConfidence());

    // Update the config
    config.setMinimumConfidence(0.8);
    config.setConflictResolution(
        org.openmetadata.schema.entity.classification.AutoClassificationConfig.ConflictResolution
            .HIGHEST_PRIORITY);
    updatedClassification.setAutoClassificationConfig(config);

    Classification finalClassification =
        patchEntity(updatedClassification.getId().toString(), updatedClassification);

    // Verify updates
    assertEquals(0.8, finalClassification.getAutoClassificationConfig().getMinimumConfidence());
    assertEquals(
        org.openmetadata.schema.entity.classification.AutoClassificationConfig.ConflictResolution
            .HIGHEST_PRIORITY,
        finalClassification.getAutoClassificationConfig().getConflictResolution());

    // Read with autoClassificationConfig field
    Classification retrievedClassification =
        getEntityWithFields(finalClassification.getId().toString(), "autoClassificationConfig");
    assertNotNull(retrievedClassification.getAutoClassificationConfig());
    assertTrue(retrievedClassification.getAutoClassificationConfig().getEnabled());
  }

  @Test
  void test_createClassificationWithAutoConfig(TestNamespace ns) {
    // Create classification with auto-classification config upfront
    CreateClassification createClassification = new CreateClassification();
    createClassification.setName(ns.prefix("classification_with_autoconfig"));
    createClassification.setDescription("Classification created with auto-classification config");

    AutoClassificationConfig config =
        new AutoClassificationConfig()
            .withEnabled(true)
            .withConflictResolution(AutoClassificationConfig.ConflictResolution.MOST_SPECIFIC)
            .withMinimumConfidence(0.65)
            .withRequireExplicitMatch(false);
    createClassification.setAutoClassificationConfig(config);
    createClassification.setMutuallyExclusive(true);

    Classification classification = createEntity(createClassification);

    // Verify config was created
    assertNotNull(classification.getAutoClassificationConfig());
    assertTrue(classification.getAutoClassificationConfig().getEnabled());
    assertEquals(0.65, classification.getAutoClassificationConfig().getMinimumConfidence());
    assertEquals(
        org.openmetadata.schema.entity.classification.AutoClassificationConfig.ConflictResolution
            .MOST_SPECIFIC,
        classification.getAutoClassificationConfig().getConflictResolution());
    assertFalse(classification.getAutoClassificationConfig().getRequireExplicitMatch());
    assertTrue(classification.getMutuallyExclusive());
  }

  @Test
  void test_deleteAutoClassificationConfig(TestNamespace ns) {
    // Create classification with auto-classification config
    CreateClassification createClassification = new CreateClassification();
    createClassification.setName(ns.prefix("classification_delete_autoconfig"));
    createClassification.setDescription("Classification for testing auto-config deletion");

    AutoClassificationConfig config =
        new AutoClassificationConfig().withEnabled(true).withMinimumConfidence(0.6);
    createClassification.setAutoClassificationConfig(config);

    Classification classification = createEntity(createClassification);
    assertNotNull(classification.getAutoClassificationConfig());

    // Remove auto-classification config using PATCH
    classification.setAutoClassificationConfig(null);
    Classification updatedClassification =
        patchEntity(classification.getId().toString(), classification);

    // Verify config was removed
    assertNull(updatedClassification.getAutoClassificationConfig());

    // Verify it's still null when retrieved
    Classification retrievedClassification =
        getEntityWithFields(updatedClassification.getId().toString(), "autoClassificationConfig");
    assertNull(retrievedClassification.getAutoClassificationConfig());
  }

  // ===================================================================
  // RENAME CONSOLIDATION TESTS
  // These tests verify that child entities (tags) are preserved when a
  // classification is renamed and then other fields are updated within
  // the same session (which triggers change consolidation).
  // ===================================================================

  /**
   * Test that tags are preserved when a classification is renamed and then the description is
   * updated. This tests the consolidation logic to ensure it doesn't revert to a previous version
   * with the old FQN.
   */
  @Test
  void test_renameAndUpdateDescriptionPreservesTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a classification
    CreateClassification createClassification = new CreateClassification();
    createClassification.setName(ns.prefix("classification_rename_consolidate"));
    createClassification.setDescription("Initial description");
    Classification classification = createEntity(createClassification);

    // Add a tag under this classification
    CreateTag createTag = new CreateTag();
    createTag.setName(ns.prefix("tag_for_rename"));
    createTag.setDescription("Test tag");
    createTag.setClassification(classification.getFullyQualifiedName());
    org.openmetadata.schema.entity.classification.Tag tag = client.tags().create(createTag);

    // Verify termCount before rename
    Classification beforeRename =
        getEntityWithFields(classification.getId().toString(), "termCount");
    assertEquals(1, beforeRename.getTermCount(), "Should have 1 tag before rename");

    // Rename the classification
    String newName = "renamed-" + classification.getName();
    classification.setName(newName);
    Classification renamed = patchEntity(classification.getId().toString(), classification);
    assertEquals(newName, renamed.getName());

    // Verify tags after rename
    Classification afterRename = getEntityWithFields(renamed.getId().toString(), "termCount");
    assertEquals(1, afterRename.getTermCount(), "Should have 1 tag after rename");

    // Update description (triggers consolidation logic)
    renamed.setDescription("Updated description after rename");
    Classification afterDescUpdate = patchEntity(renamed.getId().toString(), renamed);
    assertEquals("Updated description after rename", afterDescUpdate.getDescription());

    // Verify tags are preserved after consolidation
    Classification afterConsolidation =
        getEntityWithFields(afterDescUpdate.getId().toString(), "termCount");
    assertEquals(
        1,
        afterConsolidation.getTermCount(),
        "CRITICAL: Tags should be preserved after rename + description update consolidation");

    // Verify the tag's classification reference has the updated FQN
    org.openmetadata.schema.entity.classification.Tag updatedTag =
        client.tags().get(tag.getId().toString(), "classification");
    assertEquals(
        afterDescUpdate.getFullyQualifiedName(),
        updatedTag.getClassification().getFullyQualifiedName(),
        "Tag's classification reference should have updated FQN after consolidation");
  }

  /**
   * Test multiple renames followed by updates within the same session. This is a more complex
   * scenario that tests the robustness of the consolidation fix.
   */
  @Test
  void test_multipleRenamesWithUpdatesPreservesTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateClassification createClassification = new CreateClassification();
    createClassification.setName(ns.prefix("classification_multi_rename"));
    createClassification.setDescription("Initial description");
    Classification classification = createEntity(createClassification);

    // Add a tag
    CreateTag createTag = new CreateTag();
    createTag.setName(ns.prefix("tag_multi_rename"));
    createTag.setDescription("Test tag");
    createTag.setClassification(classification.getFullyQualifiedName());
    org.openmetadata.schema.entity.classification.Tag tag = client.tags().create(createTag);

    Classification fetched = getEntityWithFields(classification.getId().toString(), "termCount");
    assertEquals(1, fetched.getTermCount());

    String[] names = {"renamed-first", "renamed-second", "renamed-third"};

    for (int i = 0; i < names.length; i++) {
      String newName = names[i] + "-" + UUID.randomUUID().toString().substring(0, 8);

      classification.setName(newName);
      classification = patchEntity(classification.getId().toString(), classification);
      assertEquals(newName, classification.getName());

      fetched = getEntityWithFields(classification.getId().toString(), "termCount");
      assertEquals(1, fetched.getTermCount(), "Tags should be preserved after rename " + (i + 1));

      classification.setDescription("Description after rename " + (i + 1));
      classification = patchEntity(classification.getId().toString(), classification);

      fetched = getEntityWithFields(classification.getId().toString(), "termCount");
      assertEquals(
          1,
          fetched.getTermCount(),
          "Tags should be preserved after rename + update iteration " + (i + 1));
    }

    // Verify the tag's classification reference has the final updated FQN
    org.openmetadata.schema.entity.classification.Tag updatedTag =
        client.tags().get(tag.getId().toString(), "classification");
    assertEquals(
        classification.getFullyQualifiedName(),
        updatedTag.getClassification().getFullyQualifiedName(),
        "Tag's classification reference should have final updated FQN");
  }
}
