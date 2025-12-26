package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for TestDefinition entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds test definition-specific tests.
 *
 * <p>Migrated from: org.openmetadata.service.resources.dqtests.TestDefinitionResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class TestDefinitionResourceIT extends BaseEntityIT<TestDefinition, CreateTestDefinition> {

  // Disable tests that don't apply to TestDefinition
  {
    supportsFollowers = false; // TestDefinition doesn't support followers
    supportsTags = false; // TestDefinition tags are handled differently
    supportsDataProducts = false; // TestDefinition doesn't support dataProducts
    supportsNameLengthValidation = false; // TestDefinition doesn't enforce name length
    supportsSearchIndex = false; // TestDefinition doesn't have a search index
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTestDefinition createMinimalRequest(TestNamespace ns) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdefinition"));
    request.setDescription("Test definition created by integration test");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    return request;
  }

  @Override
  protected CreateTestDefinition createRequest(String name, TestNamespace ns) {
    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(name);
    request.setDescription("Test definition");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    return request;
  }

  @Override
  protected TestDefinition createEntity(CreateTestDefinition createRequest) {
    return SdkClients.adminClient().testDefinitions().create(createRequest);
  }

  @Override
  protected TestDefinition getEntity(String id) {
    return SdkClients.adminClient().testDefinitions().get(id);
  }

  @Override
  protected TestDefinition getEntityByName(String fqn) {
    return SdkClients.adminClient().testDefinitions().getByName(fqn);
  }

  @Override
  protected TestDefinition patchEntity(String id, TestDefinition entity) {
    return SdkClients.adminClient().testDefinitions().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().testDefinitions().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().testDefinitions().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().testDefinitions().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "testDefinition";
  }

  @Override
  protected void validateCreatedEntity(TestDefinition entity, CreateTestDefinition createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getEntityType(), entity.getEntityType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain test definition name");
  }

  @Override
  protected ListResponse<TestDefinition> listEntities(ListParams params) {
    return SdkClients.adminClient().testDefinitions().list(params);
  }

  @Override
  protected TestDefinition getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().testDefinitions().get(id, fields);
  }

  @Override
  protected TestDefinition getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().testDefinitions().getByName(fqn, fields);
  }

  @Override
  protected TestDefinition getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().testDefinitions().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().testDefinitions().getVersionList(id);
  }

  @Override
  protected TestDefinition getVersion(UUID id, Double version) {
    return SdkClients.adminClient().testDefinitions().getVersion(id.toString(), version);
  }

  // ===================================================================
  // TEST DEFINITION-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_testDefinitionForTable_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_table"));
    request.setDescription("Table test definition");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition = createEntity(request);
    assertNotNull(testDefinition);
    assertEquals(TestDefinitionEntityType.TABLE, testDefinition.getEntityType());
  }

  @Test
  void post_testDefinitionForColumn_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_column"));
    request.setDescription("Column test definition");
    request.setEntityType(TestDefinitionEntityType.COLUMN);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition = createEntity(request);
    assertNotNull(testDefinition);
    assertEquals(TestDefinitionEntityType.COLUMN, testDefinition.getEntityType());
  }

  @Test
  void post_testDefinitionWithMultiplePlatforms_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_multi_platform"));
    request.setDescription("Multi-platform test definition");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(Arrays.asList(TestPlatform.OPEN_METADATA, TestPlatform.DBT));

    TestDefinition testDefinition = createEntity(request);
    assertNotNull(testDefinition);
    assertEquals(2, testDefinition.getTestPlatforms().size());
  }

  @Test
  void put_testDefinitionDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestDefinition request = new CreateTestDefinition();
    request.setName(ns.prefix("testdef_update_desc"));
    request.setDescription("Initial description");
    request.setEntityType(TestDefinitionEntityType.TABLE);
    request.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition = createEntity(request);
    assertEquals("Initial description", testDefinition.getDescription());

    // Update description
    testDefinition.setDescription("Updated description");
    TestDefinition updated = patchEntity(testDefinition.getId().toString(), testDefinition);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_testDefinitionNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first test definition
    String name = ns.prefix("unique_testdef");
    CreateTestDefinition request1 = new CreateTestDefinition();
    request1.setName(name);
    request1.setDescription("First test definition");
    request1.setEntityType(TestDefinitionEntityType.TABLE);
    request1.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    TestDefinition testDefinition1 = createEntity(request1);
    assertNotNull(testDefinition1);

    // Attempt to create duplicate
    CreateTestDefinition request2 = new CreateTestDefinition();
    request2.setName(name);
    request2.setDescription("Duplicate test definition");
    request2.setEntityType(TestDefinitionEntityType.TABLE);
    request2.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate test definition should fail");
  }
}
