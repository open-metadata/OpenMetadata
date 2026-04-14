package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import java.util.stream.StreamSupport;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.type.PredefinedRecognizer;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

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
    supportsListHistoryByTimestamp = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTag createMinimalRequest(TestNamespace ns) {
    // Create classification first
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.shortPrefix("tag"));
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
    classificationRequest.setName(ns.uniqueShortId() + "_" + "classification" + "_" + uniqueSuffix);
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
    request.setName(ns.shortPrefix("tag_no_classification"));

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
    request.setName(ns.shortPrefix("tag_with_style"));
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
    parentRequest.setName(ns.shortPrefix("parent_tag"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Parent tag");

    Tag parentTag = createEntity(parentRequest);
    assertNotNull(parentTag);

    // Create child tag
    CreateTag childRequest = new CreateTag();
    childRequest.setName(ns.shortPrefix("child_tag"));
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
    request.setName(ns.shortPrefix("tag_update_desc"));
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
    String tagName = ns.shortPrefix("unique_tag");
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
    request.setName(ns.shortPrefix("orphan_tag"));
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
    request.setName(ns.shortPrefix("tag_version"));
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
    request.setName(ns.shortPrefix("tag_delete"));
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
    request.setName(ns.shortPrefix("tag_hard_delete"));
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
    request.setName(ns.shortPrefix("tag_by_name"));
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
    request.setName(ns.shortPrefix("tag_display"));
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
    String tagName = ns.shortPrefix("tag_fqn");
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
      request.setName(ns.shortPrefix("pagination_tag_" + i));
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
    parentRequest.setName(ns.shortPrefix("parent_fqn"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Parent tag for FQN test");
    Tag parentTag = createEntity(parentRequest);

    // Create child tag
    CreateTag childRequest = new CreateTag();
    String childName = ns.shortPrefix("child_fqn");
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
    classificationRequest.setName(ns.shortPrefix("mutualExclusive") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Mutually exclusive classification");
    classificationRequest.setMutuallyExclusive(true);
    Classification classification = client.classifications().create(classificationRequest);

    // Create a tag under this classification
    CreateTag request = new CreateTag();
    request.setName(ns.shortPrefix("exclusive_tag"));
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
    request.setName(ns.shortPrefix("tag_with_owner"));
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
    classificationRequest.setName(ns.shortPrefix("owner_inherit") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Classification for owner inheritance test");
    classificationRequest.setOwners(java.util.List.of(testUser1().getEntityReference()));
    Classification classification = client.classifications().create(classificationRequest);

    // Verify classification has owner
    assertNotNull(classification.getOwners());
    assertEquals(1, classification.getOwners().size());

    // Create tag under classification (without explicit owner)
    CreateTag tagRequest = new CreateTag();
    tagRequest.setName(ns.shortPrefix("inherited_owner_tag"));
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
            .withName(ns.shortPrefix("domain_inherit"))
            .withDomainType(org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for inheritance");
    org.openmetadata.schema.entity.domains.Domain domain = client.domains().create(createDomain);

    // Create classification with domain
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.shortPrefix("domain_inherit") + "_" + uniqueSuffix);
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
    tagRequest.setName(ns.shortPrefix("inherited_domain_tag"));
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
  void test_domainInheritancePropagatesToSearch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ObjectMapper mapper = new ObjectMapper();

    org.openmetadata.schema.entity.domains.Domain domainA =
        client
            .domains()
            .create(
                new org.openmetadata.schema.api.domains.CreateDomain()
                    .withName(ns.shortPrefix("search_domain_a"))
                    .withDomainType(
                        org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain A for search propagation"));

    org.openmetadata.schema.entity.domains.Domain domainB =
        client
            .domains()
            .create(
                new org.openmetadata.schema.api.domains.CreateDomain()
                    .withName(ns.shortPrefix("search_domain_b"))
                    .withDomainType(
                        org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain B for search propagation"));

    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.shortPrefix("domain_search") + "_" + uniqueSuffix)
                    .withDescription("Classification for domain search propagation")
                    .withDomains(List.of(domainA.getFullyQualifiedName())));

    Tag tag =
        createEntity(
            new CreateTag()
                .withName(ns.shortPrefix("domain_search_tag"))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("Tag for domain search propagation"));

    awaitTagSearchDomains(client, mapper, tag.getId(), Set.of(domainA.getFullyQualifiedName()));

    Classification updatedClassification =
        client.classifications().get(classification.getId().toString(), "domains");
    updatedClassification.setDomains(List.of(domainB.getEntityReference()));
    client
        .classifications()
        .update(updatedClassification.getId().toString(), updatedClassification);

    awaitTagSearchDomains(client, mapper, tag.getId(), Set.of(domainB.getFullyQualifiedName()));
  }

  @Test
  void test_searchTagByClassificationDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ObjectMapper mapper = new ObjectMapper();
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    String displayName = "PW Classification " + ns.uniqueShortId();

    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.shortPrefix("display_name_search") + "_" + uniqueSuffix)
                    .withDisplayName(displayName)
                    .withDescription("Classification for display name search"));

    Tag tag =
        createEntity(
            new CreateTag()
                .withName(ns.shortPrefix("display_name_tag"))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("Tag for classification display name search"));

    Awaitility.await("Tag should be searchable by classification display name")
        .atMost(java.time.Duration.ofSeconds(30))
        .pollInterval(java.time.Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              String response =
                  client.search().query(displayName).index("tag_search_index").size(25).execute();
              JsonNode root = mapper.readTree(response);
              JsonNode hits = root.path("hits").path("hits");
              boolean found =
                  StreamSupport.stream(hits.spliterator(), false)
                      .anyMatch(
                          hit ->
                              tag.getId().toString().equals(hit.path("_id").asText())
                                  || tag.getId()
                                      .toString()
                                      .equals(hit.path("_source").path("id").asText()));
              assertTrue(
                  found,
                  "Expected tag to be present when searching by classification display name");
            });
  }

  @Test
  void test_disableClassification_disablesAllTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create classification
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.shortPrefix("disable_test") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Classification for disable test");
    Classification classification = client.classifications().create(classificationRequest);

    // Create two tags under this classification
    CreateTag tagRequest1 = new CreateTag();
    tagRequest1.setName(ns.shortPrefix("tag_disable_1"));
    tagRequest1.setClassification(classification.getFullyQualifiedName());
    tagRequest1.setDescription("First tag for disable test");
    Tag tag1 = createEntity(tagRequest1);

    CreateTag tagRequest2 = new CreateTag();
    tagRequest2.setName(ns.shortPrefix("tag_disable_2"));
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

  @Test
  void test_recognizerFeedback_withRecognizerMetadata_targetsSpecificRecognizer(TestNamespace ns) {
    Classification classification = createClassification(ns);

    UUID emailRecognizerId = UUID.randomUUID();

    CreateTag createEmailTag = new CreateTag();
    createEmailTag.setName(ns.shortPrefix("email_tag"));
    createEmailTag.setClassification(classification.getFullyQualifiedName());
    createEmailTag.setDescription("Email address tag");
    createEmailTag.setRecognizers(
        java.util.List.of(
            new org.openmetadata.schema.type.Recognizer()
                .withId(emailRecognizerId)
                .withName("email_pattern_recognizer")
                .withEnabled(true)
                .withRecognizerConfig(
                    new org.openmetadata.schema.type.PredefinedRecognizer()
                        .withName(
                            org.openmetadata.schema.type.PredefinedRecognizer.Name
                                .EMAIL_RECOGNIZER))));

    Tag emailTag = createEntity(createEmailTag);

    org.openmetadata.schema.entity.services.DatabaseService dbService =
        createDatabaseService(ns, "mysql_service");
    org.openmetadata.schema.entity.data.Database database =
        createDatabase(ns, dbService.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        createDatabaseSchema(ns, database.getFullyQualifiedName());

    org.openmetadata.schema.type.TagLabelRecognizerMetadata recognizerMetadata =
        new org.openmetadata.schema.type.TagLabelRecognizerMetadata()
            .withRecognizerId(emailRecognizerId)
            .withRecognizerName("email_pattern_recognizer")
            .withScore(0.85);

    org.openmetadata.schema.type.TagLabelMetadata metadata =
        new org.openmetadata.schema.type.TagLabelMetadata().withRecognizer(recognizerMetadata);

    org.openmetadata.schema.type.TagLabel tagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(emailTag.getFullyQualifiedName())
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.GENERATED)
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withMetadata(metadata);

    org.openmetadata.schema.type.Column emailColumn =
        new org.openmetadata.schema.type.Column()
            .withName("email_column")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING)
            .withTags(java.util.List.of(tagLabel));

    org.openmetadata.schema.api.data.CreateTable createTable =
        new org.openmetadata.schema.api.data.CreateTable();
    createTable.setName(ns.shortPrefix("test_table"));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(java.util.List.of(emailColumn));

    org.openmetadata.schema.entity.data.Table testTable =
        SdkClients.adminClient().tables().create(createTable);

    String entityLink =
        String.format("<#E::table::%s::columns::email_column>", testTable.getFullyQualifiedName());

    org.openmetadata.schema.type.RecognizerFeedback feedback =
        new org.openmetadata.schema.type.RecognizerFeedback()
            .withEntityLink(entityLink)
            .withTagFQN(emailTag.getFullyQualifiedName())
            .withFeedbackType(
                org.openmetadata.schema.type.RecognizerFeedback.FeedbackType.FALSE_POSITIVE)
            .withUserReason(
                org.openmetadata.schema.type.RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA)
            .withUserComments("This is actually an internal identifier, not an email");

    org.openmetadata.service.jdbi3.RecognizerFeedbackRepository feedbackRepo =
        new org.openmetadata.service.jdbi3.RecognizerFeedbackRepository(
            org.openmetadata.service.Entity.getCollectionDAO());
    org.openmetadata.schema.type.RecognizerFeedback created =
        feedbackRepo.processFeedback(feedback, "admin");

    assertEquals(
        org.openmetadata.schema.type.RecognizerFeedback.Status.PENDING, created.getStatus());
    assertNotNull(created.getId());

    org.openmetadata.schema.type.RecognizerFeedback applied =
        feedbackRepo.applyFeedback(created, "admin");

    assertEquals(
        org.openmetadata.schema.type.RecognizerFeedback.Status.APPLIED, applied.getStatus());
    assertNotNull(applied.getResolution());

    org.openmetadata.service.jdbi3.TagRepository tagRepo =
        (org.openmetadata.service.jdbi3.TagRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.TAG);
    Tag updatedTag =
        tagRepo.getByName(null, emailTag.getFullyQualifiedName(), tagRepo.getFields("recognizers"));

    assertNotNull(updatedTag.getRecognizers());
    org.openmetadata.schema.type.Recognizer emailRecognizer = null;
    for (org.openmetadata.schema.type.Recognizer r : updatedTag.getRecognizers()) {
      if (r.getId().equals(emailRecognizerId)) {
        emailRecognizer = r;
        break;
      }
    }

    assertNotNull(emailRecognizer);
    assertNotNull(emailRecognizer.getExceptionList());
    assertEquals(1, emailRecognizer.getExceptionList().size());

    org.openmetadata.schema.type.RecognizerException exception =
        emailRecognizer.getExceptionList().get(0);
    assertEquals(entityLink, exception.getEntityLink());
    assertEquals(created.getId(), exception.getFeedbackId());
    assertTrue(exception.getReason().contains("NOT_SENSITIVE_DATA"));
  }

  @Test
  void test_recognizerFeedback_withoutRecognizerMetadata_fallsBackToAllRecognizers(
      TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag createEmailTag = new CreateTag();
    createEmailTag.setName(ns.shortPrefix("email_tag_2"));
    createEmailTag.setClassification(classification.getFullyQualifiedName());
    createEmailTag.setDescription("Email address tag");
    createEmailTag.setRecognizers(
        java.util.List.of(
            new org.openmetadata.schema.type.Recognizer()
                .withName("email_recognizer")
                .withEnabled(true)
                .withRecognizerConfig(
                    new org.openmetadata.schema.type.PredefinedRecognizer()
                        .withName(
                            org.openmetadata.schema.type.PredefinedRecognizer.Name
                                .EMAIL_RECOGNIZER))));

    Tag emailTag = createEntity(createEmailTag);

    org.openmetadata.schema.entity.services.DatabaseService dbService =
        createDatabaseService(ns, "mysql_service_2");
    org.openmetadata.schema.entity.data.Database database =
        createDatabase(ns, dbService.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        createDatabaseSchema(ns, database.getFullyQualifiedName());

    org.openmetadata.schema.type.TagLabel tagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(emailTag.getFullyQualifiedName())
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.GENERATED)
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withMetadata(null);

    org.openmetadata.schema.type.Column column =
        new org.openmetadata.schema.type.Column()
            .withName("email_column_2")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING)
            .withTags(java.util.List.of(tagLabel));

    org.openmetadata.schema.api.data.CreateTable createTable2 =
        new org.openmetadata.schema.api.data.CreateTable();
    createTable2.setName(ns.shortPrefix("test_table_2"));
    createTable2.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable2.setColumns(java.util.List.of(column));

    org.openmetadata.schema.entity.data.Table table2 =
        SdkClients.adminClient().tables().create(createTable2);

    String entityLink =
        String.format("<#E::table::%s::columns::email_column_2>", table2.getFullyQualifiedName());

    org.openmetadata.schema.type.RecognizerFeedback feedback =
        new org.openmetadata.schema.type.RecognizerFeedback()
            .withEntityLink(entityLink)
            .withTagFQN(emailTag.getFullyQualifiedName())
            .withFeedbackType(
                org.openmetadata.schema.type.RecognizerFeedback.FeedbackType.FALSE_POSITIVE)
            .withUserReason(org.openmetadata.schema.type.RecognizerFeedback.UserReason.TEST_DATA);

    org.openmetadata.service.jdbi3.RecognizerFeedbackRepository feedbackRepo =
        new org.openmetadata.service.jdbi3.RecognizerFeedbackRepository(
            org.openmetadata.service.Entity.getCollectionDAO());
    org.openmetadata.schema.type.RecognizerFeedback created =
        feedbackRepo.processFeedback(feedback, "admin");
    org.openmetadata.schema.type.RecognizerFeedback applied =
        feedbackRepo.applyFeedback(created, "admin");

    assertEquals(
        org.openmetadata.schema.type.RecognizerFeedback.Status.APPLIED, applied.getStatus());

    org.openmetadata.service.jdbi3.TagRepository tagRepo =
        (org.openmetadata.service.jdbi3.TagRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.TAG);
    Tag updatedTag =
        tagRepo.getByName(null, emailTag.getFullyQualifiedName(), tagRepo.getFields("recognizers"));

    for (org.openmetadata.schema.type.Recognizer r : updatedTag.getRecognizers()) {
      assertNotNull(r.getExceptionList());
      boolean hasException =
          r.getExceptionList().stream().anyMatch(e -> e.getEntityLink().equals(entityLink));
      assertTrue(hasException);
    }
  }

  @Test
  void test_recognizerFeedback_withInvalidRecognizerId_fallsBackToAllRecognizers(TestNamespace ns) {
    Classification classification = createClassification(ns);

    UUID emailRecognizerId = UUID.randomUUID();

    CreateTag createEmailTag = new CreateTag();
    createEmailTag.setName(ns.shortPrefix("email_tag_3"));
    createEmailTag.setClassification(classification.getFullyQualifiedName());
    createEmailTag.setDescription("Email address tag");
    createEmailTag.setRecognizers(
        java.util.List.of(
            new org.openmetadata.schema.type.Recognizer()
                .withId(emailRecognizerId)
                .withName("email_pattern_recognizer")
                .withEnabled(true)
                .withRecognizerConfig(
                    new org.openmetadata.schema.type.PredefinedRecognizer()
                        .withName(
                            org.openmetadata.schema.type.PredefinedRecognizer.Name
                                .EMAIL_RECOGNIZER))));

    Tag emailTag = createEntity(createEmailTag);

    org.openmetadata.schema.entity.services.DatabaseService dbService =
        createDatabaseService(ns, "mysql_service_3");
    org.openmetadata.schema.entity.data.Database database =
        createDatabase(ns, dbService.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        createDatabaseSchema(ns, database.getFullyQualifiedName());

    UUID nonExistentRecognizerId = UUID.randomUUID();

    org.openmetadata.schema.type.TagLabelRecognizerMetadata invalidRecognizerMetadata =
        new org.openmetadata.schema.type.TagLabelRecognizerMetadata()
            .withRecognizerId(nonExistentRecognizerId)
            .withRecognizerName("nonexistent_recognizer")
            .withScore(0.85);

    org.openmetadata.schema.type.TagLabelMetadata invalidMetadata =
        new org.openmetadata.schema.type.TagLabelMetadata()
            .withRecognizer(invalidRecognizerMetadata);

    org.openmetadata.schema.type.TagLabel tagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(emailTag.getFullyQualifiedName())
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.GENERATED)
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withMetadata(invalidMetadata);

    org.openmetadata.schema.type.Column column =
        new org.openmetadata.schema.type.Column()
            .withName("email_column_3")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING)
            .withTags(java.util.List.of(tagLabel));

    org.openmetadata.schema.api.data.CreateTable createTable3 =
        new org.openmetadata.schema.api.data.CreateTable();
    createTable3.setName(ns.shortPrefix("test_table_3"));
    createTable3.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable3.setColumns(java.util.List.of(column));

    org.openmetadata.schema.entity.data.Table table3 =
        SdkClients.adminClient().tables().create(createTable3);

    String entityLink =
        String.format("<#E::table::%s::columns::email_column_3>", table3.getFullyQualifiedName());

    org.openmetadata.schema.type.RecognizerFeedback feedback =
        new org.openmetadata.schema.type.RecognizerFeedback()
            .withEntityLink(entityLink)
            .withTagFQN(emailTag.getFullyQualifiedName())
            .withFeedbackType(
                org.openmetadata.schema.type.RecognizerFeedback.FeedbackType.FALSE_POSITIVE)
            .withUserReason(
                org.openmetadata.schema.type.RecognizerFeedback.UserReason.WRONG_DATA_TYPE);

    org.openmetadata.service.jdbi3.RecognizerFeedbackRepository feedbackRepo =
        new org.openmetadata.service.jdbi3.RecognizerFeedbackRepository(
            org.openmetadata.service.Entity.getCollectionDAO());
    org.openmetadata.schema.type.RecognizerFeedback created =
        feedbackRepo.processFeedback(feedback, "admin");
    org.openmetadata.schema.type.RecognizerFeedback applied =
        feedbackRepo.applyFeedback(created, "admin");

    assertEquals(
        org.openmetadata.schema.type.RecognizerFeedback.Status.APPLIED, applied.getStatus());

    org.openmetadata.service.jdbi3.TagRepository tagRepo =
        (org.openmetadata.service.jdbi3.TagRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.TAG);
    Tag updatedTag =
        tagRepo.getByName(null, emailTag.getFullyQualifiedName(), tagRepo.getFields("recognizers"));

    for (org.openmetadata.schema.type.Recognizer r : updatedTag.getRecognizers()) {
      boolean hasException =
          r.getExceptionList() != null
              && r.getExceptionList().stream().anyMatch(e -> e.getEntityLink().equals(entityLink));
      assertTrue(hasException);
    }
  }

  private org.openmetadata.schema.entity.services.DatabaseService createDatabaseService(
      TestNamespace ns, String serviceName) {
    org.openmetadata.schema.api.services.CreateDatabaseService createService =
        new org.openmetadata.schema.api.services.CreateDatabaseService();
    createService.setName(ns.shortPrefix(serviceName));
    createService.setServiceType(
        org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql);
    return SdkClients.adminClient().databaseServices().create(createService);
  }

  private org.openmetadata.schema.entity.data.Database createDatabase(
      TestNamespace ns, String serviceFqn) {
    org.openmetadata.schema.api.data.CreateDatabase createDatabase =
        new org.openmetadata.schema.api.data.CreateDatabase();
    createDatabase.setName(ns.shortPrefix("test_database"));
    createDatabase.setService(serviceFqn);
    return SdkClients.adminClient().databases().create(createDatabase);
  }

  private org.openmetadata.schema.entity.data.DatabaseSchema createDatabaseSchema(
      TestNamespace ns, String databaseFqn) {
    org.openmetadata.schema.api.data.CreateDatabaseSchema createSchema =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    createSchema.setName(ns.shortPrefix("test_schema"));
    createSchema.setDatabase(databaseFqn);
    return SdkClients.adminClient().databaseSchemas().create(createSchema);
  }

  private ResultList<Recognizer> fetchRecognizers(
      String url, String after, String before, int limit) {
    HttpClient client = SdkClients.adminClient().getHttpClient();

    StringBuilder params = new StringBuilder();
    if (after != null) {
      params.append("after=").append(URLEncoder.encode(after, StandardCharsets.UTF_8));
    }
    if (before != null) {
      if (params.length() > 0) {
        params.append("&");
      }
      params.append("before=").append(URLEncoder.encode(before, StandardCharsets.UTF_8));
    }
    if (limit >= 0) {
      if (params.length() > 0) {
        params.append("&");
      }
      params.append("limit=").append(limit);
    }

    if (params.length() > 0) {
      url += "?" + params;
    }

    ResultList<LinkedHashMap> response =
        client.execute(HttpMethod.GET, url, null, ResultList.class);

    ObjectMapper mapper = new ObjectMapper();
    List<Recognizer> recognizers =
        response.getData().stream()
            .map(r -> mapper.<Recognizer>convertValue(r, Recognizer.class))
            .toList();

    Paging paging = response.getPaging();
    ResultList<Recognizer> resultList = new ResultList<>(recognizers).setPaging(paging);
    return resultList;
  }

  private ResultList<Recognizer> fetchRecognizersByTagId(
      UUID id, String after, String before, int limit) {
    return fetchRecognizers("/v1/tags/" + id + "/recognizers", after, before, limit);
  }

  private ResultList<Recognizer> fetchRecognizersByTagFQN(
      String fqn, String after, String before, int limit) {
    return fetchRecognizers("/v1/tags/name/" + fqn + "/recognizers", after, before, limit);
  }

  private void awaitTagSearchDomains(
      OpenMetadataClient client, ObjectMapper mapper, UUID tagId, Set<String> expectedDomainFqns) {
    Awaitility.await("Tag search document should have expected domains")
        .atMost(java.time.Duration.ofSeconds(30))
        .pollInterval(java.time.Duration.ofMillis(500))
        .untilAsserted(
            () -> {
              String response =
                  client.search().query("id:" + tagId).index("tag_search_index").size(5).execute();
              JsonNode root = mapper.readTree(response);
              JsonNode hits = root.path("hits").path("hits");
              assertTrue(
                  hits.isArray() && !hits.isEmpty(), "Tag should be present in tag_search_index");

              JsonNode source = null;
              for (JsonNode hit : hits) {
                if (tagId.toString().equals(hit.path("_id").asText())
                    || tagId.toString().equals(hit.path("_source").path("id").asText())) {
                  source = hit.path("_source");
                  break;
                }
              }
              assertNotNull(source, "Expected to find tag document in search hits");

              Set<String> actualDomainFqns =
                  StreamSupport.stream(source.path("domains").spliterator(), false)
                      .map(domainNode -> domainNode.path("fullyQualifiedName").asText())
                      .collect(java.util.stream.Collectors.toSet());
              assertEquals(expectedDomainFqns, actualDomainFqns);
            });
  }

  @Test
  void test_recognizerPaginationEndpoint(TestNamespace ns) {
    int DEFAULT_LIMIT = 10;
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_with_owner"))
            .withDescription("A test Tag")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 50)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    ResultList<Recognizer> response = fetchRecognizersByTagId(tag.getId(), null, null, -1);

    assertEquals(tag.getRecognizers().size(), response.getPaging().getTotal());
    assertEquals(DEFAULT_LIMIT, response.getData().size());

    assertNotNull(response.getPaging());
    Assertions.assertNull(response.getPaging().getBefore());
    assertNotNull(response.getPaging().getAfter());

    assertEquals(tag.getRecognizers().getFirst(), response.getData().getFirst());
    assertEquals(tag.getRecognizers().get(DEFAULT_LIMIT - 1), response.getData().getLast());

    String after = response.getPaging().getAfter();

    response = fetchRecognizersByTagId(tag.getId(), after, null, DEFAULT_LIMIT * 2);

    assertEquals(tag.getRecognizers().size(), response.getPaging().getTotal());
    assertEquals(DEFAULT_LIMIT * 2, response.getData().size());
    assertNotNull(response.getPaging());

    assertNotNull(response.getPaging().getBefore());
    assertNotNull(response.getPaging().getAfter());

    assertEquals(tag.getRecognizers().get(DEFAULT_LIMIT), response.getData().getFirst());
    assertEquals(tag.getRecognizers().get((DEFAULT_LIMIT * 3) - 1), response.getData().getLast());
  }

  @Test
  void test_recognizerPaginationByFQN(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_pagination_fqn"))
            .withDescription("Test tag for FQN pagination")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 25)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    ResultList<Recognizer> response =
        fetchRecognizersByTagFQN(tag.getFullyQualifiedName(), null, null, 10);

    assertEquals(25, response.getPaging().getTotal());
    assertEquals(10, response.getData().size());
    assertEquals(tag.getRecognizers().getFirst(), response.getData().getFirst());
    assertNotNull(response.getPaging().getAfter());

    ResultList<Recognizer> secondPage =
        fetchRecognizersByTagFQN(
            tag.getFullyQualifiedName(), response.getPaging().getAfter(), null, 10);

    assertEquals(10, secondPage.getData().size());
    assertEquals(tag.getRecognizers().get(10), secondPage.getData().getFirst());
  }

  @Test
  void test_recognizerBackwardPagination(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_backward_pagination"))
            .withDescription("Test tag for backward pagination")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 30)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    ResultList<Recognizer> firstPage = fetchRecognizersByTagId(tag.getId(), null, null, 10);
    ResultList<Recognizer> secondPage =
        fetchRecognizersByTagId(tag.getId(), firstPage.getPaging().getAfter(), null, 10);

    String beforeCursor = secondPage.getPaging().getBefore();
    ResultList<Recognizer> backwardPage =
        fetchRecognizersByTagId(tag.getId(), null, beforeCursor, 10);

    assertEquals(10, backwardPage.getData().size());
    assertEquals(tag.getRecognizers().get(9), backwardPage.getData().getFirst());
    assertEquals(tag.getRecognizers().get(0), backwardPage.getData().getLast());
  }

  @Test
  void test_recognizerPaginationWithInvalidCursor_400(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_invalid_cursor"))
            .withDescription("Test tag for invalid cursor")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 10)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    String invalidCursor = "invalid_cursor_value";

    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () -> fetchRecognizersByTagId(tag.getId(), invalidCursor, null, 10),
            "Invalid cursor should return HTTP 400");

    assertEquals(400, exception.getStatusCode());
  }

  @Test
  void test_recognizerPaginationWithNonExistentTag() {
    UUID nonExistentId = UUID.randomUUID();

    assertThrows(
        Exception.class,
        () -> {
          fetchRecognizersByTagId(nonExistentId, null, null, 10);
        });
  }

  @Test
  void test_recognizerPaginationWithZeroRecognizers(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_no_recognizers"))
            .withDescription("Test tag with no recognizers")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(List.of());

    Tag tag = createEntity(request);

    ResultList<Recognizer> response = fetchRecognizersByTagId(tag.getId(), null, null, 10);

    assertEquals(0, response.getPaging().getTotal());
    assertEquals(0, response.getData().size());
    Assertions.assertNull(response.getPaging().getBefore());
    Assertions.assertNull(response.getPaging().getAfter());
  }

  @Test
  void test_recognizerPaginationWithLimitZero(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_limit_zero"))
            .withDescription("Test tag for limit zero")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 15)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    ResultList<Recognizer> response = fetchRecognizersByTagId(tag.getId(), null, null, 0);

    assertEquals(15, response.getPaging().getTotal());
    assertEquals(15, response.getData().size());
    Assertions.assertNull(response.getPaging().getBefore());
    Assertions.assertNull(response.getPaging().getAfter());
  }

  @Test
  void test_recognizerPaginationWithLimitOne(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_limit_one"))
            .withDescription("Test tag for limit one")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 10)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    ResultList<Recognizer> response = fetchRecognizersByTagId(tag.getId(), null, null, 1);

    assertEquals(10, response.getPaging().getTotal());
    assertEquals(1, response.getData().size());
    assertEquals(tag.getRecognizers().getFirst(), response.getData().getFirst());
    Assertions.assertNull(response.getPaging().getBefore());
    assertNotNull(response.getPaging().getAfter());
  }

  @Test
  void test_recognizerPaginationWithLimitExceedsTotal(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_limit_exceeds"))
            .withDescription("Test tag for limit exceeds total")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 5)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    ResultList<Recognizer> response = fetchRecognizersByTagId(tag.getId(), null, null, 100);

    assertEquals(5, response.getPaging().getTotal());
    assertEquals(5, response.getData().size());
    Assertions.assertNull(response.getPaging().getBefore());
    Assertions.assertNull(response.getPaging().getAfter());
  }

  @Test
  void test_recognizerPaginationCompleteCycle(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request =
        new CreateTag()
            .withName(ns.shortPrefix("tag_complete_cycle"))
            .withDescription("Test tag for complete pagination cycle")
            .withClassification(classification.getFullyQualifiedName())
            .withRecognizers(
                IntStream.range(0, 35)
                    .mapToObj(
                        i ->
                            new Recognizer()
                                .withName("Recognizer_" + i)
                                .withRecognizerConfig(
                                    new PredefinedRecognizer()
                                        .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
                    .toList());

    Tag tag = createEntity(request);

    List<Recognizer> allRecognizers = new ArrayList<>();

    ResultList<Recognizer> page = fetchRecognizersByTagId(tag.getId(), null, null, 10);
    allRecognizers.addAll(page.getData());

    while (page.getPaging().getAfter() != null) {
      page = fetchRecognizersByTagId(tag.getId(), page.getPaging().getAfter(), null, 10);
      allRecognizers.addAll(page.getData());
    }

    assertEquals(35, allRecognizers.size());
    assertEquals(tag.getRecognizers(), allRecognizers);
  }

  @Test
  void test_certificationTagNotLeakingIntoTagsField(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    org.openmetadata.schema.entity.classification.Classification certClassification =
        client.classifications().getByName("Certification", null);
    assertNotNull(certClassification, "Certification classification must exist");

    String certTagName = ns.shortPrefix("cert_leak_tag");
    CreateTag createCertTag = new CreateTag();
    createCertTag.setName(certTagName);
    createCertTag.setClassification(certClassification.getFullyQualifiedName());
    createCertTag.setDescription("Cert tag for leak test");
    Tag certTag = SdkClients.adminClient().tags().create(createCertTag);

    org.openmetadata.schema.entity.classification.Classification regularClassification =
        createClassification(ns);
    CreateTag createRegularTag = new CreateTag();
    createRegularTag.setName(ns.shortPrefix("regular_tag"));
    createRegularTag.setClassification(regularClassification.getFullyQualifiedName());
    createRegularTag.setDescription("Regular tag for leak test");
    Tag regularTag = SdkClients.adminClient().tags().create(createRegularTag);

    org.openmetadata.schema.entity.services.DatabaseService dbService =
        createDatabaseService(ns, "cert_leak_svc");
    org.openmetadata.schema.entity.data.Database db =
        createDatabase(ns, dbService.getFullyQualifiedName());
    DatabaseSchema schema = createDatabaseSchema(ns, db.getFullyQualifiedName());

    org.openmetadata.schema.type.TagLabel certTagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(certTag.getFullyQualifiedName())
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);
    org.openmetadata.schema.type.TagLabel regularTagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(regularTag.getFullyQualifiedName())
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);

    schema.setCertification(new AssetCertification().withTagLabel(certTagLabel));
    schema.setTags(List.of(regularTagLabel));
    DatabaseSchema tagged = client.databaseSchemas().update(schema.getId().toString(), schema);
    assertNotNull(tagged);

    // GET single entity: cert tag must not appear in `tags`
    DatabaseSchema fetched =
        client.databaseSchemas().get(tagged.getId().toString(), "tags,certification");
    assertNotNull(fetched.getCertification(), "Certification field must be populated");
    List<org.openmetadata.schema.type.TagLabel> singleTags = fetched.getTags();
    assertNotNull(singleTags);
    assertTrue(
        singleTags.stream()
            .noneMatch(t -> t.getTagFQN().startsWith(certClassification.getFullyQualifiedName())),
        "GET: cert tag must not appear in tags field");
    assertTrue(
        singleTags.stream().anyMatch(t -> t.getTagFQN().equals(regularTag.getFullyQualifiedName())),
        "GET: regular tag must still be present in tags field");

    // LIST entities (batch path): cert tag must not appear in `tags` of the listed entity
    org.openmetadata.sdk.models.ListParams listParams =
        new org.openmetadata.sdk.models.ListParams()
            .setDatabase(db.getFullyQualifiedName())
            .setFields("tags,certification");
    org.openmetadata.sdk.models.ListResponse<DatabaseSchema> listed =
        client.databaseSchemas().list(listParams);
    assertNotNull(listed.getData());
    DatabaseSchema listedSchema =
        listed.getData().stream()
            .filter(s -> s.getId().equals(schema.getId()))
            .findFirst()
            .orElse(null);
    assertNotNull(listedSchema, "Schema must appear in list result");
    List<org.openmetadata.schema.type.TagLabel> listTags = listedSchema.getTags();
    assertNotNull(listTags);
    assertTrue(
        listTags.stream()
            .noneMatch(t -> t.getTagFQN().startsWith(certClassification.getFullyQualifiedName())),
        "LIST (batch): cert tag must not appear in tags field");
    assertTrue(
        listTags.stream().anyMatch(t -> t.getTagFQN().equals(regularTag.getFullyQualifiedName())),
        "LIST (batch): regular tag must still be present in tags field");
  }

  @Test
  void test_certificationTagRenamePropagatesToEntityAndSearch(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    ObjectMapper mapper = new ObjectMapper();

    // Step 1: Get the existing Certification classification (seeded by the system)
    org.openmetadata.schema.entity.classification.Classification certClassification =
        client.classifications().getByName("Certification", null);
    assertNotNull(certClassification, "Certification classification must exist as a system entity");

    // Step 2: Create a new tag under Certification
    String originalTagName = ns.shortPrefix("cert_tag");
    CreateTag createTag = new CreateTag();
    createTag.setName(originalTagName);
    createTag.setClassification(certClassification.getFullyQualifiedName());
    createTag.setDescription("Tag for rename propagation test");
    Tag certTag = SdkClients.adminClient().tags().create(createTag);
    String originalTagFqn = certTag.getFullyQualifiedName();
    assertEquals("Certification." + originalTagName, originalTagFqn);

    // Step 3: Create the DB hierarchy and a DatabaseSchema
    org.openmetadata.schema.entity.services.DatabaseService dbService =
        createDatabaseService(ns, "cert_rename_svc");
    org.openmetadata.schema.entity.data.Database db =
        createDatabase(ns, dbService.getFullyQualifiedName());
    DatabaseSchema schema = createDatabaseSchema(ns, db.getFullyQualifiedName());

    // Step 4: Apply the certification tag to the DatabaseSchema via setCertification()
    org.openmetadata.schema.type.TagLabel tagLabel =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN(originalTagFqn)
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);

    schema.setCertification(new AssetCertification().withTagLabel(tagLabel));
    DatabaseSchema taggedSchema =
        client.databaseSchemas().update(schema.getId().toString(), schema);

    assertNotNull(taggedSchema);
    // Certification tags are stored in the `certification` field, not in `tags`.
    // Verify via a fresh fetch with fields=certification.
    DatabaseSchema schemaWithCert =
        client.databaseSchemas().get(taggedSchema.getId().toString(), "certification");
    assertNotNull(
        schemaWithCert.getCertification(),
        "Schema must have a certification after tag application");
    assertEquals(
        originalTagFqn,
        schemaWithCert.getCertification().getTagLabel().getTagFQN(),
        "Schema certification tagFQN must match the applied certification tag");

    // Step 5: Verify search finds the schema by the original tag FQN
    // Certification tags are indexed under certification.tagLabel.tagFQN, not tags.tagFQN
    String tagFilterBefore =
        String.format(
            "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"certification.tagLabel.tagFQN\":\"%s\"}}]}}}",
            originalTagFqn);
    Awaitility.await("Schema should be searchable by original tag FQN")
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              String resp =
                  client
                      .search()
                      .query("*")
                      .index("database_schema_search_index")
                      .queryFilter(tagFilterBefore)
                      .size(10)
                      .execute();
              JsonNode hits = mapper.readTree(resp).path("hits").path("hits");
              assertTrue(
                  hits.isArray() && !hits.isEmpty(),
                  "Schema should be findable by original tag FQN before rename");
              boolean found = false;
              for (JsonNode hit : hits) {
                if (schema
                    .getFullyQualifiedName()
                    .equals(hit.path("_source").path("fullyQualifiedName").asText())) {
                  found = true;
                  break;
                }
              }
              assertTrue(found, "Schema should appear in search results under original tag FQN");
            });

    // Step 6: Rename the certification tag (change its name — this changes the FQN)
    String renamedTagName = ns.shortPrefix("cert_tag_renamed");
    certTag.setName(renamedTagName);
    Tag renamedTag = SdkClients.adminClient().tags().update(certTag.getId().toString(), certTag);
    assertEquals(renamedTagName, renamedTag.getName());
    String newTagFqn = renamedTag.getFullyQualifiedName();
    assertEquals("Certification." + renamedTagName, newTagFqn);

    // Step 7: Wait until certification tagFQN propagates to the entity
    // (name/FQN change must propagate to all referencing entities' certification field)
    Awaitility.await("Schema certification tagFQN should update after tag rename")
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              DatabaseSchema fetched =
                  client
                      .databaseSchemas()
                      .getByName(schema.getFullyQualifiedName(), "certification");
              assertNotNull(fetched, "Schema must be fetchable by name after tag rename");
              assertNotNull(
                  fetched.getCertification(),
                  "Schema must still have certification after tag rename");
              assertNotNull(
                  fetched.getCertification().getTagLabel(), "Certification must have a tagLabel");
              assertEquals(
                  newTagFqn,
                  fetched.getCertification().getTagLabel().getTagFQN(),
                  "Tag FQN on schema certification must be updated to new FQN after name rename");
            });

    // Step 8: Search must find the schema under the new tag FQN
    String tagFilterAfter =
        String.format(
            "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"certification.tagLabel.tagFQN\":\"%s\"}}]}}}",
            newTagFqn);
    Awaitility.await("Schema should be searchable by new tag FQN after rename")
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .untilAsserted(
            () -> {
              String resp =
                  client
                      .search()
                      .query("*")
                      .index("database_schema_search_index")
                      .queryFilter(tagFilterAfter)
                      .size(10)
                      .execute();
              JsonNode hits = mapper.readTree(resp).path("hits").path("hits");
              assertTrue(
                  hits.isArray() && !hits.isEmpty(),
                  "Schema should be findable by new tag FQN after name rename");
              boolean found = false;
              for (JsonNode hit : hits) {
                if (schema
                    .getFullyQualifiedName()
                    .equals(hit.path("_source").path("fullyQualifiedName").asText())) {
                  found = true;
                  break;
                }
              }
              assertTrue(
                  found,
                  "Schema should appear in search results under new tag FQN after name rename");
            });

    // Step 9: Delete the certification tag and verify the schema no longer has a certification
    SdkClients.adminClient().tags().delete(certTag.getId().toString());

    DatabaseSchema schemaAfterTagDelete =
        client.databaseSchemas().getByName(schema.getFullyQualifiedName(), "certification");
    assertNotNull(
        schemaAfterTagDelete, "Schema must still be fetchable after certification tag deletion");
    assertNull(
        schemaAfterTagDelete.getCertification(),
        "Schema must not have a certification after the certification tag is deleted");
  }

  @Test
  void test_ownerPropagationFromClassificationToTagSearchIndex(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ObjectMapper mapper = new ObjectMapper();

    Classification classification = createClassification(ns);
    Tag tag =
        createEntity(
            new CreateTag()
                .withName(ns.shortPrefix("owner_prop_tag"))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("Tag for owner propagation test"));

    Classification fetched =
        client.classifications().get(classification.getId().toString(), "owners");
    fetched.setOwners(List.of(testUser1Ref()));
    client.classifications().update(fetched.getId().toString(), fetched);

    UUID tagId = tag.getId();
    Awaitility.await("Tag search index should reflect inherited owner from classification")
        .atMost(java.time.Duration.ofSeconds(30))
        .pollDelay(java.time.Duration.ofMillis(500))
        .pollInterval(java.time.Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String response =
                  client.search().query("id:" + tagId).index("tag_search_index").size(1).execute();
              JsonNode root = mapper.readTree(response);
              JsonNode hits = root.path("hits").path("hits");
              assertTrue(hits.isArray() && !hits.isEmpty(), "Tag should be in tag_search_index");

              JsonNode source = null;
              for (JsonNode hit : hits) {
                if (tagId.toString().equals(hit.path("_id").asText())
                    || tagId.toString().equals(hit.path("_source").path("id").asText())) {
                  source = hit.path("_source");
                  break;
                }
              }
              assertNotNull(source, "Tag document not found in search hits");

              JsonNode owners = source.path("owners");
              assertTrue(
                  owners.isArray() && !owners.isEmpty(),
                  "Owners should be propagated to tag search index");
              assertTrue(
                  StreamSupport.stream(owners.spliterator(), false)
                      .anyMatch(o -> testUser1().getId().toString().equals(o.path("id").asText())),
                  "Owner should match the user set on the classification");
            });
  }
}
