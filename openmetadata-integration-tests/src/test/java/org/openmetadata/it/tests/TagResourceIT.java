package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Tag entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds tag-specific tests for parent
 * classification, nested tags, and styling.
 *
 * <p>Migrated from: org.openmetadata.service.resources.tags.TagResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class TagResourceIT extends BaseEntityIT<Tag, CreateTag> {

  // Disable tests that don't apply to Tags
  {
    supportsFollowers = false; // Tags don't support followers
    supportsTags = false; // Tags don't support tags on themselves
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTag createMinimalRequest(TestNamespace ns) {
    // Create classification first
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Test tag created by integration test");

    return request;
  }

  @Override
  protected CreateTag createRequest(String name, TestNamespace ns) {
    // Create classification first
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(name);
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Test tag");

    return request;
  }

  private Classification createClassification(TestNamespace ns) {
    // Add unique suffix to avoid collisions when multiple tests create classifications
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.prefix("classification") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Test classification for tags");
    return SdkClients.adminClient().classifications().create(classificationRequest);
  }

  @Override
  protected Tag createEntity(CreateTag createRequest) {
    return SdkClients.adminClient().tags().create(createRequest);
  }

  @Override
  protected Tag getEntity(String id) {
    return SdkClients.adminClient().tags().get(id);
  }

  @Override
  protected Tag getEntityByName(String fqn) {
    return SdkClients.adminClient().tags().getByName(fqn);
  }

  @Override
  protected Tag patchEntity(String id, Tag entity) {
    return SdkClients.adminClient().tags().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().tags().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().tags().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().tags().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "tag";
  }

  @Override
  protected void validateCreatedEntity(Tag entity, CreateTag createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getClassification(), "Tag must have a classification");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()), "FQN should contain tag name");
  }

  @Override
  protected ListResponse<Tag> listEntities(ListParams params) {
    return SdkClients.adminClient().tags().list(params);
  }

  @Override
  protected Tag getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().tags().get(id, fields);
  }

  @Override
  protected Tag getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().tags().getByName(fqn, fields);
  }

  @Override
  protected Tag getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().tags().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().tags().getVersionList(id);
  }

  @Override
  protected Tag getVersion(UUID id, Double version) {
    return SdkClients.adminClient().tags().getVersion(id.toString(), version);
  }

  // ===================================================================
  // TAG-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_tagWithoutClassification_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Classification is required field
    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_no_classification"));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating tag without classification should fail");
  }

  @Test
  void post_tagWithStyle_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_with_style"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag with style");

    Tag tag = createEntity(request);
    assertNotNull(tag);
  }

  @Test
  void post_nestedTag_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    // Create parent tag
    CreateTag parentRequest = new CreateTag();
    parentRequest.setName(ns.prefix("parent_tag"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Parent tag");

    Tag parentTag = createEntity(parentRequest);
    assertNotNull(parentTag);

    // Create child tag
    CreateTag childRequest = new CreateTag();
    childRequest.setName(ns.prefix("child_tag"));
    childRequest.setClassification(classification.getFullyQualifiedName());
    childRequest.setParent(parentTag.getFullyQualifiedName());
    childRequest.setDescription("Child tag");

    Tag childTag = createEntity(childRequest);
    assertNotNull(childTag);
    assertNotNull(childTag.getParent());
    assertEquals(parentTag.getId(), childTag.getParent().getId());
  }

  @Test
  void put_tagDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_update_desc"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Initial description");

    Tag tag = createEntity(request);
    assertEquals("Initial description", tag.getDescription());

    // Update description
    tag.setDescription("Updated description");
    Tag updated = patchEntity(tag.getId().toString(), tag);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_tagNameUniquenessWithinClassification(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    // Create first tag
    String tagName = ns.prefix("unique_tag");
    CreateTag request1 = new CreateTag();
    request1.setName(tagName);
    request1.setClassification(classification.getFullyQualifiedName());
    request1.setDescription("First tag");

    Tag tag1 = createEntity(request1);
    assertNotNull(tag1);

    // Attempt to create duplicate within same classification
    CreateTag request2 = new CreateTag();
    request2.setName(tagName);
    request2.setClassification(classification.getFullyQualifiedName());
    request2.setDescription("Duplicate tag");

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate tag in same classification should fail");
  }

  @Test
  void post_newTagsOnNonExistentParents_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    // Attempt to create tag with non-existent parent
    CreateTag request = new CreateTag();
    request.setName(ns.prefix("orphan_tag"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setParent(classification.getFullyQualifiedName() + ".non_existent_parent");

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating tag with non-existent parent should fail");
  }

  @Test
  void test_tagVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_version"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Initial description");

    Tag tag = createEntity(request);
    Double initialVersion = tag.getVersion();

    // Update to create new version
    tag.setDescription("Updated description");
    Tag updated = patchEntity(tag.getId().toString(), tag);
    assertTrue(updated.getVersion() >= initialVersion);

    // Get version history
    EntityHistory history = getVersionHistory(tag.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_tagSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_delete"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag for soft delete test");

    Tag tag = createEntity(request);
    assertNotNull(tag.getId());

    // Soft delete
    deleteEntity(tag.getId().toString());

    // Should be able to get with include deleted
    Tag deleted = getEntityIncludeDeleted(tag.getId().toString());
    assertNotNull(deleted);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(tag.getId().toString());
    Tag restored = getEntity(tag.getId().toString());
    assertNotNull(restored);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_tagHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_hard_delete"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag for hard delete test");

    Tag tag = createEntity(request);
    assertNotNull(tag.getId());

    // Hard delete
    hardDeleteEntity(tag.getId().toString());

    // Should not be retrievable
    assertThrows(Exception.class, () -> getEntity(tag.getId().toString()));
    assertThrows(Exception.class, () -> getEntityIncludeDeleted(tag.getId().toString()));
  }

  @Test
  void test_tagGetByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_by_name"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag for getByName test");

    Tag tag = createEntity(request);

    // Get by FQN
    Tag fetched = getEntityByName(tag.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(tag.getId(), fetched.getId());
    assertEquals(tag.getName(), fetched.getName());
  }

  @Test
  void test_tagDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_display"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDisplayName("My Display Tag");
    request.setDescription("Tag for display name test");

    Tag tag = createEntity(request);
    assertEquals("My Display Tag", tag.getDisplayName());

    // Update display name
    tag.setDisplayName("Updated Display Name");
    Tag updated = patchEntity(tag.getId().toString(), tag);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_tagFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    String tagName = ns.prefix("tag_fqn");
    request.setName(tagName);
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag for FQN format test");

    Tag tag = createEntity(request);

    // Verify FQN format: classification.tag
    String expectedFQN = classification.getFullyQualifiedName() + "." + tagName;
    assertEquals(expectedFQN, tag.getFullyQualifiedName());
  }

  @Test
  void test_listTagsPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    // Create multiple tags
    for (int i = 0; i < 5; i++) {
      CreateTag request = new CreateTag();
      request.setName(ns.prefix("pagination_tag_" + i));
      request.setClassification(classification.getFullyQualifiedName());
      request.setDescription("Pagination tag " + i);
      createEntity(request);
    }

    // List with limit
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<Tag> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() <= 2);
  }

  @Test
  void test_nestedTagFQN(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    // Create parent tag
    CreateTag parentRequest = new CreateTag();
    parentRequest.setName(ns.prefix("parent_fqn"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Parent tag for FQN test");
    Tag parentTag = createEntity(parentRequest);

    // Create child tag
    CreateTag childRequest = new CreateTag();
    String childName = ns.prefix("child_fqn");
    childRequest.setName(childName);
    childRequest.setClassification(classification.getFullyQualifiedName());
    childRequest.setParent(parentTag.getFullyQualifiedName());
    childRequest.setDescription("Child tag for FQN test");
    Tag childTag = createEntity(childRequest);

    // Verify nested FQN format: classification.parent.child
    String expectedFQN = parentTag.getFullyQualifiedName() + "." + childName;
    assertEquals(expectedFQN, childTag.getFullyQualifiedName());
  }

  @Test
  void test_tagWithMutuallyExclusiveFlag(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a mutually exclusive classification
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.prefix("mutualExclusive") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Mutually exclusive classification");
    classificationRequest.setMutuallyExclusive(true);
    Classification classification = client.classifications().create(classificationRequest);

    // Create a tag under this classification
    CreateTag request = new CreateTag();
    request.setName(ns.prefix("exclusive_tag"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag in mutually exclusive classification");

    Tag tag = createEntity(request);
    assertNotNull(tag);
    // The tag inherits mutually exclusive from classification
  }

  @Test
  void test_tagWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_with_owner"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag for owner test");

    Tag tag = createEntity(request);
    assertNotNull(tag);

    // Update with owner
    tag.setOwners(java.util.List.of(testUser1().getEntityReference()));
    Tag updated = patchEntity(tag.getId().toString(), tag);

    // Verify owner
    Tag fetched = client.tags().get(updated.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
  }

  @Test
  void test_ownerInheritance(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create classification with owner
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.prefix("owner_inherit") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Classification for owner inheritance test");
    classificationRequest.setOwners(java.util.List.of(testUser1().getEntityReference()));
    Classification classification = client.classifications().create(classificationRequest);

    // Verify classification has owner
    assertNotNull(classification.getOwners());
    assertEquals(1, classification.getOwners().size());

    // Create tag under classification (without explicit owner)
    CreateTag tagRequest = new CreateTag();
    tagRequest.setName(ns.prefix("inherited_owner_tag"));
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag for owner inheritance test");

    Tag tag = createEntity(tagRequest);

    // Verify tag inherited owner from classification
    Tag fetchedTag = client.tags().get(tag.getId().toString(), "owners");
    assertNotNull(fetchedTag.getOwners());
    assertEquals(1, fetchedTag.getOwners().size());
    assertEquals(testUser1().getId(), fetchedTag.getOwners().get(0).getId());
    assertTrue(fetchedTag.getOwners().get(0).getInherited(), "Owner should be marked as inherited");
  }

  @Test
  void test_domainInheritance(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a domain for testing
    org.openmetadata.schema.api.domains.CreateDomain createDomain =
        new org.openmetadata.schema.api.domains.CreateDomain()
            .withName(ns.prefix("domain_inherit"))
            .withDomainType(org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for inheritance");
    org.openmetadata.schema.entity.domains.Domain domain = client.domains().create(createDomain);

    // Create classification with domain
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.prefix("domain_inherit") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Classification for domain inheritance test");
    classificationRequest.setDomains(java.util.List.of(domain.getFullyQualifiedName()));
    Classification classification = client.classifications().create(classificationRequest);

    // Verify classification has domain
    Classification fetchedClassification =
        client.classifications().get(classification.getId().toString(), "domains");
    assertNotNull(fetchedClassification.getDomains());
    assertEquals(1, fetchedClassification.getDomains().size());

    // Create tag under classification (without explicit domain)
    CreateTag tagRequest = new CreateTag();
    tagRequest.setName(ns.prefix("inherited_domain_tag"));
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag for domain inheritance test");

    Tag tag = createEntity(tagRequest);

    // Verify tag inherited domain from classification
    Tag fetchedTag = client.tags().get(tag.getId().toString(), "domains");
    assertNotNull(fetchedTag.getDomains());
    assertEquals(1, fetchedTag.getDomains().size());
    assertEquals(domain.getId(), fetchedTag.getDomains().get(0).getId());
    assertTrue(
        fetchedTag.getDomains().get(0).getInherited(), "Domain should be marked as inherited");
  }

  @Test
  void test_disableClassification_disablesAllTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create classification
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.prefix("disable_test") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Classification for disable test");
    Classification classification = client.classifications().create(classificationRequest);

    // Create two tags under this classification
    CreateTag tagRequest1 = new CreateTag();
    tagRequest1.setName(ns.prefix("tag_disable_1"));
    tagRequest1.setClassification(classification.getFullyQualifiedName());
    tagRequest1.setDescription("First tag for disable test");
    Tag tag1 = createEntity(tagRequest1);

    CreateTag tagRequest2 = new CreateTag();
    tagRequest2.setName(ns.prefix("tag_disable_2"));
    tagRequest2.setClassification(classification.getFullyQualifiedName());
    tagRequest2.setDescription("Second tag for disable test");
    Tag tag2 = createEntity(tagRequest2);

    // Verify tags are not disabled initially
    assertFalse(tag1.getDisabled() != null && tag1.getDisabled());
    assertFalse(tag2.getDisabled() != null && tag2.getDisabled());

    // Disable the classification
    classification.setDisabled(true);
    client.classifications().update(classification.getId().toString(), classification);

    // Verify tags are now disabled
    Tag fetchedTag1 = getEntity(tag1.getId().toString());
    Tag fetchedTag2 = getEntity(tag2.getId().toString());
    assertTrue(
        fetchedTag1.getDisabled(), "Tag1 should be disabled when classification is disabled");
    assertTrue(
        fetchedTag2.getDisabled(), "Tag2 should be disabled when classification is disabled");

    // Re-enable the classification
    classification.setDisabled(false);
    client.classifications().update(classification.getId().toString(), classification);

    // Verify tags are enabled again
    fetchedTag1 = getEntity(tag1.getId().toString());
    fetchedTag2 = getEntity(tag2.getId().toString());
    assertFalse(
        fetchedTag1.getDisabled(), "Tag1 should not be disabled after classification is enabled");
    assertFalse(
        fetchedTag2.getDisabled(), "Tag2 should not be disabled after classification is enabled");
  }

  // ===================================================================
  // RENAME CONSOLIDATION TESTS
  // These tests verify that child entities (nested tags) are preserved
  // when a tag is renamed and then other fields are updated within the
  // same session (which triggers change consolidation).
  // ===================================================================

  /**
   * Test that child tags are preserved when a parent tag is renamed and then the description is
   * updated. This tests the consolidation logic to ensure it doesn't revert to a previous version
   * with the old FQN.
   */
  @Test
  void test_renameAndUpdateDescriptionPreservesChildren(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    // Create parent tag
    CreateTag parentRequest = new CreateTag();
    parentRequest.setName(ns.prefix("parent_rename_consolidate"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Initial description");
    Tag parentTag = createEntity(parentRequest);

    // Create child tag
    CreateTag childRequest = new CreateTag();
    childRequest.setName(ns.prefix("child_for_rename"));
    childRequest.setClassification(classification.getFullyQualifiedName());
    childRequest.setParent(parentTag.getFullyQualifiedName());
    childRequest.setDescription("Child tag");
    Tag childTag = createEntity(childRequest);

    // Verify child exists
    Tag fetchedChild = client.tags().get(childTag.getId().toString(), "parent");
    assertNotNull(fetchedChild.getParent());
    assertEquals(parentTag.getId(), fetchedChild.getParent().getId());

    // Rename the parent tag
    String newName = "renamed-" + parentTag.getName();
    parentTag.setName(newName);
    Tag renamed = patchEntity(parentTag.getId().toString(), parentTag);
    assertEquals(newName, renamed.getName());

    // Verify child after rename
    fetchedChild = client.tags().get(childTag.getId().toString(), "parent");
    assertNotNull(fetchedChild.getParent(), "Child should have parent after rename");

    // Update description (triggers consolidation logic)
    renamed.setDescription("Updated description after rename");
    Tag afterDescUpdate = patchEntity(renamed.getId().toString(), renamed);
    assertEquals("Updated description after rename", afterDescUpdate.getDescription());

    // Verify child is preserved after consolidation
    fetchedChild = client.tags().get(childTag.getId().toString(), "parent");
    assertNotNull(
        fetchedChild.getParent(),
        "CRITICAL: Child should have parent after rename + description update consolidation");

    // Verify the child's parent reference has the updated FQN
    assertEquals(
        afterDescUpdate.getFullyQualifiedName(),
        fetchedChild.getParent().getFullyQualifiedName(),
        "Child's parent reference should have updated FQN after consolidation");
  }

  /**
   * Test multiple renames followed by updates within the same session. This is a more complex
   * scenario that tests the robustness of the consolidation fix.
   */
  @Test
  void test_multipleRenamesWithUpdatesPreservesChildren(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    // Create parent tag
    CreateTag parentRequest = new CreateTag();
    parentRequest.setName(ns.prefix("parent_multi_rename"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Initial description");
    Tag parentTag = createEntity(parentRequest);

    // Create child tag
    CreateTag childRequest = new CreateTag();
    childRequest.setName(ns.prefix("child_multi_rename"));
    childRequest.setClassification(classification.getFullyQualifiedName());
    childRequest.setParent(parentTag.getFullyQualifiedName());
    childRequest.setDescription("Child tag");
    Tag childTag = createEntity(childRequest);

    Tag fetchedChild = client.tags().get(childTag.getId().toString(), "parent");
    assertNotNull(fetchedChild.getParent());

    String[] names = {"renamed-first", "renamed-second", "renamed-third"};

    for (int i = 0; i < names.length; i++) {
      String newName = names[i] + "-" + UUID.randomUUID().toString().substring(0, 8);

      parentTag.setName(newName);
      parentTag = patchEntity(parentTag.getId().toString(), parentTag);
      assertEquals(newName, parentTag.getName());

      fetchedChild = client.tags().get(childTag.getId().toString(), "parent");
      assertNotNull(fetchedChild.getParent(), "Child should have parent after rename " + (i + 1));

      parentTag.setDescription("Description after rename " + (i + 1));
      parentTag = patchEntity(parentTag.getId().toString(), parentTag);

      fetchedChild = client.tags().get(childTag.getId().toString(), "parent");
      assertNotNull(
          fetchedChild.getParent(),
          "Child should have parent after rename + update iteration " + (i + 1));
    }

    // Verify the child's parent reference has the final updated FQN
    assertEquals(
        parentTag.getFullyQualifiedName(),
        fetchedChild.getParent().getFullyQualifiedName(),
        "Child's parent reference should have final updated FQN");
  }

  @Test
  void test_tagRename_activityFeedsPreserved(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_rename_feeds"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag for testing rename with activity feeds");

    Tag tag = createEntity(request);
    String originalFqn = tag.getFullyQualifiedName();

    Thread.sleep(1000);

    String newName = ns.prefix("tag_renamed_feeds");
    tag.setName(newName);
    Tag renamedTag = patchEntity(tag.getId().toString(), tag);

    assertNotEquals(originalFqn, renamedTag.getFullyQualifiedName());
    assertTrue(renamedTag.getFullyQualifiedName().contains(newName));

    Thread.sleep(2000);

    Tag fetchedTag = getEntity(renamedTag.getId().toString());
    assertEquals(renamedTag.getFullyQualifiedName(), fetchedTag.getFullyQualifiedName());
    assertEquals(newName, fetchedTag.getName());
  }

  @Test
  void test_tagRename_childTagsUpdated(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(ns);

    CreateTag parentRequest = new CreateTag();
    parentRequest.setName(ns.prefix("parent_rename"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Parent tag for rename test");

    Tag parentTag = createEntity(parentRequest);

    CreateTag childRequest = new CreateTag();
    childRequest.setName(ns.prefix("child_tag"));
    childRequest.setClassification(classification.getFullyQualifiedName());
    childRequest.setParent(parentTag.getFullyQualifiedName());
    childRequest.setDescription("Child tag");

    Tag childTag = createEntity(childRequest);
    String originalChildFqn = childTag.getFullyQualifiedName();

    Thread.sleep(1000);

    String newParentName = ns.prefix("parent_renamed");
    parentTag.setName(newParentName);
    Tag renamedParent = patchEntity(parentTag.getId().toString(), parentTag);

    Thread.sleep(2000);

    Tag fetchedChild = getEntity(childTag.getId().toString());
    assertNotEquals(originalChildFqn, fetchedChild.getFullyQualifiedName());
    assertTrue(fetchedChild.getFullyQualifiedName().contains(newParentName));
  }
}
