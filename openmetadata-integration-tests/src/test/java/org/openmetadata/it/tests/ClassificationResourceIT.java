package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
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
}
