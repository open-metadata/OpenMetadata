package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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
  protected CreateTag createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    // Create classification first
    Classification classification = createClassification(client, ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Test tag created by integration test");

    return request;
  }

  @Override
  protected CreateTag createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    // Create classification first
    Classification classification = createClassification(client, ns);

    CreateTag request = new CreateTag();
    request.setName(name);
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Test tag");

    return request;
  }

  private Classification createClassification(OpenMetadataClient client, TestNamespace ns) {
    // Add unique suffix to avoid collisions when multiple tests create classifications
    String uniqueSuffix = java.util.UUID.randomUUID().toString().substring(0, 8);
    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName(ns.prefix("classification") + "_" + uniqueSuffix);
    classificationRequest.setDescription("Test classification for tags");
    return client.classifications().create(classificationRequest);
  }

  @Override
  protected Tag createEntity(CreateTag createRequest, OpenMetadataClient client) {
    return client.tags().create(createRequest);
  }

  @Override
  protected Tag getEntity(String id, OpenMetadataClient client) {
    return client.tags().get(id);
  }

  @Override
  protected Tag getEntityByName(String fqn, OpenMetadataClient client) {
    return client.tags().getByName(fqn);
  }

  @Override
  protected Tag patchEntity(String id, Tag entity, OpenMetadataClient client) {
    return client.tags().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.tags().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.tags().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.tags().delete(id, params);
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
  protected ListResponse<Tag> listEntities(ListParams params, OpenMetadataClient client) {
    return client.tags().list(params);
  }

  @Override
  protected Tag getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.tags().get(id, fields);
  }

  @Override
  protected Tag getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.tags().getByName(fqn, fields);
  }

  @Override
  protected Tag getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.tags().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.tags().getVersionList(id);
  }

  @Override
  protected Tag getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.tags().getVersion(id.toString(), version);
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
        () -> createEntity(request, client),
        "Creating tag without classification should fail");
  }

  @Test
  void post_tagWithStyle_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(client, ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_with_style"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Tag with style");

    Tag tag = createEntity(request, client);
    assertNotNull(tag);
  }

  @Test
  void post_nestedTag_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(client, ns);

    // Create parent tag
    CreateTag parentRequest = new CreateTag();
    parentRequest.setName(ns.prefix("parent_tag"));
    parentRequest.setClassification(classification.getFullyQualifiedName());
    parentRequest.setDescription("Parent tag");

    Tag parentTag = createEntity(parentRequest, client);
    assertNotNull(parentTag);

    // Create child tag
    CreateTag childRequest = new CreateTag();
    childRequest.setName(ns.prefix("child_tag"));
    childRequest.setClassification(classification.getFullyQualifiedName());
    childRequest.setParent(parentTag.getFullyQualifiedName());
    childRequest.setDescription("Child tag");

    Tag childTag = createEntity(childRequest, client);
    assertNotNull(childTag);
    assertNotNull(childTag.getParent());
    assertEquals(parentTag.getId(), childTag.getParent().getId());
  }

  @Test
  void put_tagDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(client, ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag_update_desc"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Initial description");

    Tag tag = createEntity(request, client);
    assertEquals("Initial description", tag.getDescription());

    // Update description
    tag.setDescription("Updated description");
    Tag updated = patchEntity(tag.getId().toString(), tag, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_tagNameUniquenessWithinClassification(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Classification classification = createClassification(client, ns);

    // Create first tag
    String tagName = ns.prefix("unique_tag");
    CreateTag request1 = new CreateTag();
    request1.setName(tagName);
    request1.setClassification(classification.getFullyQualifiedName());
    request1.setDescription("First tag");

    Tag tag1 = createEntity(request1, client);
    assertNotNull(tag1);

    // Attempt to create duplicate within same classification
    CreateTag request2 = new CreateTag();
    request2.setName(tagName);
    request2.setClassification(classification.getFullyQualifiedName());
    request2.setDescription("Duplicate tag");

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate tag in same classification should fail");
  }
}
