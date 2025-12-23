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
  protected CreateTestSuite createMinimalRequest(TestNamespace ns) {
    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite"));
    request.setDescription("Test suite created by integration test");

    return request;
  }

  @Override
  protected CreateTestSuite createRequest(String name, TestNamespace ns) {
    CreateTestSuite request = new CreateTestSuite();
    request.setName(name);
    request.setDescription("Test suite");

    return request;
  }

  @Override
  protected TestSuite createEntity(CreateTestSuite createRequest) {
    return SdkClients.adminClient().testSuites().create(createRequest);
  }

  @Override
  protected TestSuite getEntity(String id) {
    return SdkClients.adminClient().testSuites().get(id);
  }

  @Override
  protected TestSuite getEntityByName(String fqn) {
    return SdkClients.adminClient().testSuites().getByName(fqn);
  }

  @Override
  protected TestSuite patchEntity(String id, TestSuite entity) {
    return SdkClients.adminClient().testSuites().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().testSuites().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().testSuites().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().testSuites().delete(id, params);
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
  protected ListResponse<TestSuite> listEntities(ListParams params) {
    return SdkClients.adminClient().testSuites().list(params);
  }

  @Override
  protected TestSuite getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().testSuites().get(id, fields);
  }

  @Override
  protected TestSuite getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().testSuites().getByName(fqn, fields);
  }

  @Override
  protected TestSuite getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().testSuites().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().testSuites().getVersionList(id);
  }

  @Override
  protected TestSuite getVersion(UUID id, Double version) {
    return SdkClients.adminClient().testSuites().getVersion(id.toString(), version);
  }

  // ===================================================================
  // TEST SUITE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_testSuiteMinimal_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_minimal"));

    TestSuite testSuite = createEntity(request);
    assertNotNull(testSuite);
    assertNotNull(testSuite.getId());
  }

  @Test
  void put_testSuiteDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_update_desc"));
    request.setDescription("Initial description");

    TestSuite testSuite = createEntity(request);
    assertEquals("Initial description", testSuite.getDescription());

    // Update description
    testSuite.setDescription("Updated description");
    TestSuite updated = patchEntity(testSuite.getId().toString(), testSuite);
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

    TestSuite testSuite1 = createEntity(request1);
    assertNotNull(testSuite1);

    // Attempt to create duplicate
    CreateTestSuite request2 = new CreateTestSuite();
    request2.setName(name);
    request2.setDescription("Duplicate test suite");

    assertThrows(
        Exception.class, () -> createEntity(request2), "Creating duplicate test suite should fail");
  }

  @Test
  void test_testSuiteVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_version"));
    request.setDescription("Initial description");

    TestSuite testSuite = createEntity(request);
    Double initialVersion = testSuite.getVersion();

    // Update to create new version
    testSuite.setDescription("Updated description");
    TestSuite updated = patchEntity(testSuite.getId().toString(), testSuite);
    assertTrue(updated.getVersion() >= initialVersion);

    // Get version history
    EntityHistory history = getVersionHistory(testSuite.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_testSuiteSoftDeleteAndRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_delete"));
    request.setDescription("Test suite for delete test");

    TestSuite testSuite = createEntity(request);
    assertNotNull(testSuite.getId());

    // Soft delete
    deleteEntity(testSuite.getId().toString());

    // Should be able to get with include deleted
    TestSuite deleted = getEntityIncludeDeleted(testSuite.getId().toString());
    assertNotNull(deleted);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(testSuite.getId().toString());
    TestSuite restored = getEntity(testSuite.getId().toString());
    assertNotNull(restored);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_testSuiteHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_hard_delete"));
    request.setDescription("Test suite for hard delete test");

    TestSuite testSuite = createEntity(request);
    assertNotNull(testSuite.getId());

    // Hard delete
    hardDeleteEntity(testSuite.getId().toString());

    // Should not be retrievable
    assertThrows(Exception.class, () -> getEntity(testSuite.getId().toString()));
    assertThrows(Exception.class, () -> getEntityIncludeDeleted(testSuite.getId().toString()));
  }

  @Test
  void test_testSuiteGetByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_by_name"));
    request.setDescription("Test suite for getByName test");

    TestSuite testSuite = createEntity(request);

    // Get by FQN
    TestSuite fetched = getEntityByName(testSuite.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(testSuite.getId(), fetched.getId());
    assertEquals(testSuite.getName(), fetched.getName());
  }

  @Test
  void test_testSuiteDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_display"));
    request.setDisplayName("My Display Test Suite");
    request.setDescription("Test suite with display name");

    TestSuite testSuite = createEntity(request);
    assertEquals("My Display Test Suite", testSuite.getDisplayName());

    // Update display name
    testSuite.setDisplayName("Updated Display Name");
    TestSuite updated = patchEntity(testSuite.getId().toString(), testSuite);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_listTestSuitesPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create multiple test suites
    for (int i = 0; i < 5; i++) {
      CreateTestSuite request = new CreateTestSuite();
      request.setName(ns.prefix("pagination_suite_" + i));
      request.setDescription("Pagination test suite " + i);
      createEntity(request);
    }

    // List with limit
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<TestSuite> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() <= 2);
  }

  @Test
  void test_testSuiteWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_with_owner"));
    request.setDescription("Test suite with owner");
    request.setOwners(java.util.List.of(testUser1().getEntityReference()));

    TestSuite testSuite = createEntity(request);
    assertNotNull(testSuite);

    // Verify owner
    TestSuite fetched = client.testSuites().get(testSuite.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
  }

  @Test
  void test_testSuiteFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    String suiteName = ns.prefix("testsuite_fqn");
    request.setName(suiteName);
    request.setDescription("Test suite for FQN format test");

    TestSuite testSuite = createEntity(request);

    // Logical test suite FQN is just the name
    assertEquals(suiteName, testSuite.getFullyQualifiedName());
  }

  @Test
  void test_updateTestSuiteDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTestSuite request = new CreateTestSuite();
    request.setName(ns.prefix("testsuite_patch_desc"));
    request.setDescription("Original description");

    TestSuite testSuite = createEntity(request);
    assertEquals("Original description", testSuite.getDescription());

    // Patch description
    testSuite.setDescription("Patched description");
    TestSuite patched = patchEntity(testSuite.getId().toString(), testSuite);
    assertEquals("Patched description", patched.getDescription());
  }
}
