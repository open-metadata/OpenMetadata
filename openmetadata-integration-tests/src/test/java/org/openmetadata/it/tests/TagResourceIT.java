package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.PredefinedRecognizer;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

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
  // RECOGNIZER FEEDBACK TESTS
  // ===================================================================

  private org.openmetadata.schema.entity.data.Table createTableWithGeneratedTag(
      TestNamespace ns, String tagFQN) {
    PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();
    org.openmetadata.schema.entity.services.DatabaseService service =
        DatabaseServices.builder()
            .name("test_service_" + ns.uniqueShortId())
            .connection(conn)
            .description("Test Postgres service")
            .create();

    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        DatabaseSchemas.create()
            .name("schema_" + ns.uniqueShortId())
            .in(
                Databases.create()
                    .name("db_" + ns.uniqueShortId())
                    .in(service.getFullyQualifiedName())
                    .execute()
                    .getFullyQualifiedName())
            .execute();

    Column column =
        org.openmetadata.sdk.fluent.builders.ColumnBuilder.of("test_column", "VARCHAR")
            .dataLength(255)
            .build();
    column.setTags(
        java.util.List.of(
            new TagLabel().withTagFQN(tagFQN).withLabelType(TagLabel.LabelType.GENERATED)));

    org.openmetadata.schema.api.data.CreateTable createTable =
        new org.openmetadata.schema.api.data.CreateTable()
            .withName("test_table_" + ns.shortPrefix())
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(java.util.List.of(column));

    return SdkClients.adminClient().tables().create(createTable);
  }

  private org.openmetadata.schema.type.RecognizerFeedback submitRecognizerFeedback(
      String entityLink, String tagFQN, String userName) {
    HttpClient client = SdkClients.adminClient().getHttpClient();

    org.openmetadata.schema.type.RecognizerFeedback feedback =
        new org.openmetadata.schema.type.RecognizerFeedback()
            .withEntityLink(entityLink)
            .withTagFQN(tagFQN)
            .withFeedbackType(
                org.openmetadata.schema.type.RecognizerFeedback.FeedbackType.FALSE_POSITIVE)
            .withUserReason(
                org.openmetadata.schema.type.RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA)
            .withUserComments("This is not actually sensitive data");

    try {
      return client.execute(
          HttpMethod.POST,
          "/v1/tags/name/" + tagFQN + "/feedback",
          feedback,
          RecognizerFeedback.class);
    } catch (Exception e) {
      throw new RuntimeException("Failed to submit recognizer feedback", e);
    }
  }

  private Thread waitForRecognizerFeedbackTask(String tagFQN) throws Exception {
    return waitForRecognizerFeedbackTask(tagFQN, 30000);
  }

  public Thread waitForRecognizerFeedbackTask(String tagFQN, int timeout)
      throws RuntimeException, ConditionTimeoutException {
    String entityLink = new MessageParser.EntityLink(Entity.TAG, tagFQN).getLinkString();
    Awaitility.await(String.format("Wait for Task to be Created for Tag: '%s'", tagFQN))
        .ignoreExceptions()
        .pollInterval(Duration.ofMillis(2000L))
        .atMost(Duration.ofMillis(timeout))
        .until(
            () ->
                WorkflowHandler.getInstance()
                    .isActivityWithVariableExecuting(
                        "ReviewFeedback.approvalTask",
                        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
                        entityLink));

    String url =
        "/v1/feed?limit=100&type=Task&taskStatus=Open&entityLink="
            + URLEncoder.encode(entityLink, StandardCharsets.UTF_8);
    FeedResourceIT.ThreadList response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, url, null, FeedResourceIT.ThreadList.class);

    for (Thread thread : response.getData()) {
      return thread;
    }

    throw new RuntimeException("Failed to submit recognizer feedback task");
  }

  private void resolveRecognizerFeedbackTask(Thread thread) {
    String url =
        "/v1/feed/tasks/"
            + thread.getTask().getId().toString()
            + "/resolve?description="
            + thread.getId().toString();
    SdkClients.user2Client()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, url, Map.of("newValue", "approved"));
  }

  private void rejectRecognizerFeedbackTask(Thread thread) {
    String url =
        "/v1/feed/tasks/"
            + thread.getTask().getId().toString()
            + "/close?description="
            + thread.getId().toString();
    SdkClients.user2Client()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, url, Map.of("comment", "closed"));
  }

  private Recognizer getNameRecognizer() {
    return new Recognizer()
        .withName("test_recognizer")
        .withRecognizerConfig(
            new PredefinedRecognizer()
                .withSupportedLanguage("en")
                .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER));
  }

  @Test
  void test_recognizerFeedback_withDirectReviewer_createsTask(TestNamespace ns) throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

    Classification classification = createClassification(ns);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName("tag_with_reviewer_" + ns.uniqueShortId());
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag with direct reviewer");
    tagRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    org.openmetadata.schema.type.RecognizerFeedback feedback =
        submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    Thread task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    assertNotNull(task, "Task should be created for tag with reviewer");
    assertEquals(
        org.openmetadata.schema.type.TaskType.RecognizerFeedbackApproval, task.getTask().getType());
    assertNotNull(task.getTask().getFeedback(), "Task should contain feedback details");
    assertEquals(feedback.getEntityLink(), task.getTask().getFeedback().getEntityLink());
  }

  @Test
  void test_recognizerFeedback_withInheritedReviewer_createsTask(TestNamespace ns)
      throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName("class_reviewer" + "_" + ns.uniqueShortId());
    classificationRequest.setDescription("Classification with reviewer");
    classificationRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    Classification classification =
        SdkClients.adminClient().classifications().create(classificationRequest);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName("tag_inherited_reviewer" + "_" + ns.uniqueShortId());
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag inheriting reviewer");
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    assertDoesNotThrow(() -> waitForRecognizerFeedbackTask(tag.getFullyQualifiedName()));
  }

  @Test
  void test_recognizerFeedback_noReviewer_autoApplied(TestNamespace ns) throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

    Classification classification = createClassification(ns);

    CreateTag tagRequest =
        new CreateTag()
            .withRecognizers(java.util.List.of(getNameRecognizer()))
            .withName("tag_no_reviewer" + "_" + ns.uniqueShortId())
            .withClassification(classification.getFullyQualifiedName())
            .withDescription("Tag without reviewer");

    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    Thread task;
    try {
      task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());
    } catch (ConditionTimeoutException ignored) {
      task = null;
    }
    assertNull(task, "No task should be created for tag without reviewer - should be auto-applied");

    Tag updatedTag = getEntity(tag.getId().toString());
    assertNotNull(updatedTag.getRecognizers());
    assertFalse(updatedTag.getRecognizers().isEmpty());
    assertTrue(
        updatedTag.getRecognizers().getFirst().getExceptionList() != null
            && !updatedTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
        "Recognizer should have exception added");

    org.openmetadata.schema.entity.data.Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns,tags");
    boolean tagRemoved =
        updatedTable.getColumns().getFirst().getTags().stream()
            .noneMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
    assertTrue(tagRemoved, "Tag should be removed from column");
  }

  @Test
  void test_recognizerFeedback_approveTask_removesTagAndAddsException(TestNamespace ns)
      throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

    Classification classification = createClassification(ns);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName("tag_approve_test" + "_" + ns.uniqueShortId());
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag for approval test");
    tagRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    tagRequest.setRecognizers(java.util.List.of(getNameRecognizer()));
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";
    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    org.openmetadata.schema.entity.feed.Thread task =
        waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());
    assertNotNull(task);

    resolveRecognizerFeedbackTask(task);

    java.lang.Thread.sleep(2000);

    Tag updatedTag = getEntity(tag.getId().toString());
    assertNotNull(updatedTag.getRecognizers());
    assertFalse(updatedTag.getRecognizers().isEmpty());
    assertTrue(
        updatedTag.getRecognizers().getFirst().getExceptionList() != null
            && !updatedTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
        "Recognizer should have exception added after approval");

    org.openmetadata.schema.type.RecognizerException exception =
        updatedTag.getRecognizers().getFirst().getExceptionList().getFirst();
    assertTrue(
        exception.getReason().contains("NOT_SENSITIVE_DATA"),
        "Exception reason should contain user reason");
    assertTrue(
        exception.getReason().contains("This is not actually sensitive data"),
        "Exception reason should contain user comments");

    org.openmetadata.schema.entity.data.Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns,tags");
    boolean tagRemoved =
        updatedTable.getColumns().getFirst().getTags().stream()
            .noneMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
    assertTrue(tagRemoved, "Tag should be removed from column after approval");
  }

  @Test
  void test_recognizerFeedback_rejectTask_keepsTag(TestNamespace ns) throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

    Classification classification = createClassification(ns);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName(ns.prefix("tag_reject_test"));
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag for rejection test");
    tagRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    tagRequest.setRecognizers(java.util.List.of(getNameRecognizer()));
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    Thread task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    rejectRecognizerFeedbackTask(task);

    java.lang.Thread.sleep(2000);

    Tag updatedTag = getEntity(tag.getId().toString());
    assertNotNull(updatedTag.getRecognizers());
    assertTrue(
        updatedTag.getRecognizers().getFirst().getExceptionList() == null
            || updatedTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
        "Recognizer should NOT have exception added after rejection");

    org.openmetadata.schema.entity.data.Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns,tags");
    boolean tagStillPresent =
        updatedTable.getColumns().getFirst().getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
    assertTrue(tagStillPresent, "Tag should remain on column after rejection");
  }
}
