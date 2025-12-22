package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for TestSuite entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds test suite-specific tests.
 *
 * <p>Migrated from: org.openmetadata.service.resources.dqtests.TestSuiteResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class TestSuiteResourceIT extends BaseEntityIT<TestSuite, CreateTestSuite> {

  // Disable tests that don't apply to TestSuite
  {
    supportsFollowers = false; // TestSuite doesn't support followers
    supportsDataProducts = false; // TestSuite doesn't support dataProducts
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTestSuite createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite"));
    request.setDescription("Test suite created by integration test");

    return request;
  }

  @Override
  protected CreateTestSuite createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    CreateTestSuite request = new CreateTestSuite();
    request.setName(name);
    request.setDescription("Test suite");

    return request;
  }

  @Override
  protected TestSuite createEntity(CreateTestSuite createRequest, OpenMetadataClient client) {
    return client.testSuites().create(createRequest);
  }

  @Override
  protected TestSuite getEntity(String id, OpenMetadataClient client) {
    return client.testSuites().get(id);
  }

  @Override
  protected TestSuite getEntityByName(String fqn, OpenMetadataClient client) {
    return client.testSuites().getByName(fqn);
  }

  @Override
  protected TestSuite patchEntity(String id, TestSuite entity, OpenMetadataClient client) {
    return client.testSuites().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.testSuites().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.testSuites().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.testSuites().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "testSuite";
  }

  @Override
  protected void validateCreatedEntity(TestSuite entity, CreateTestSuite createRequest) {
    assertEquals(createRequest.getName(), entity.getName());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain test suite name");
  }

  @Override
  protected ListResponse<TestSuite> listEntities(ListParams params, OpenMetadataClient client) {
    return client.testSuites().list(params);
  }

  @Override
  protected TestSuite getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.testSuites().get(id, fields);
  }

  @Override
  protected TestSuite getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.testSuites().getByName(fqn, fields);
  }

  @Override
  protected TestSuite getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.testSuites().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.testSuites().getVersionList(id);
  }

  @Override
  protected TestSuite getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.testSuites().getVersion(id.toString(), version);
  }

  // ===================================================================
  // TEST SUITE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_testSuiteMinimal_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_minimal"));

    TestSuite testSuite = createEntity(request, client);
    assertNotNull(testSuite);
    assertNotNull(testSuite.getId());
  }

  @Test
  void put_testSuiteDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_update_desc"));
    request.setDescription("Initial description");

    TestSuite testSuite = createEntity(request, client);
    assertEquals("Initial description", testSuite.getDescription());

    // Update description
    testSuite.setDescription("Updated description");
    TestSuite updated = patchEntity(testSuite.getId().toString(), testSuite, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_testSuiteNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create first test suite
    String name = ns.prefix("unique_testsuite");
    CreateTestSuite request1 = new CreateTestSuite();
    request1.setName(name);
    request1.setDescription("First test suite");

    TestSuite testSuite1 = createEntity(request1, client);
    assertNotNull(testSuite1);

    // Attempt to create duplicate
    CreateTestSuite request2 = new CreateTestSuite();
    request2.setName(name);
    request2.setDescription("Duplicate test suite");

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate test suite should fail");
  }
}
