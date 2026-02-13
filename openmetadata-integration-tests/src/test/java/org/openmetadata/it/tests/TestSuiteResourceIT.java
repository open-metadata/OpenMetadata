package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.resources.dqtests.TestSuiteResource;

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
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected String getResourcePath() {
    return TestSuiteResource.COLLECTION_PATH;
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

  // ===================================================================
  // BASIC TEST SUITE TESTS (Executable Test Suites linked to tables)
  // ===================================================================

  @Test
  void test_createBasicTestSuiteForTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table
    Table table = createTableForBasicTestSuite(ns, "table_basic_suite");

    // Create a basic (executable) test suite for the table
    CreateTestSuite createTestSuite = new CreateTestSuite();
    createTestSuite.setName(table.getFullyQualifiedName());
    createTestSuite.setBasicEntityReference(table.getFullyQualifiedName());
    createTestSuite.setDescription("Basic test suite for table");

    TestSuite testSuite = createBasicTestSuite(createTestSuite);
    assertNotNull(testSuite);
    assertNotNull(testSuite.getId());
    assertTrue(testSuite.getBasic());
    // Test suite FQN is table FQN + ".testSuite"
    assertTrue(
        testSuite.getFullyQualifiedName().startsWith(table.getFullyQualifiedName()),
        "Test suite FQN should start with table FQN");

    // Verify we can get it back
    TestSuite fetched = getEntity(testSuite.getId().toString());
    assertEquals(testSuite.getId(), fetched.getId());
    assertTrue(fetched.getBasic());
  }

  @Test
  void test_createBasicTestSuiteWithoutRef_400(TestNamespace ns) {
    CreateTestSuite createTestSuite = new CreateTestSuite();
    createTestSuite.setName(ns.prefix("invalid_basic_suite"));
    createTestSuite.setDescription("Basic test suite without entity reference");

    // Should fail because basicEntityReference is required for basic test suites
    assertThrows(
        Exception.class,
        () -> createBasicTestSuite(createTestSuite),
        "Creating basic test suite without entity reference should fail");
  }

  @Test
  void test_createBasicTestSuiteForNonExistentTable_404(TestNamespace ns) {
    CreateTestSuite createTestSuite = new CreateTestSuite();
    String nonExistentTableFqn = ns.prefix("non_existent_table");
    createTestSuite.setName(nonExistentTableFqn);
    createTestSuite.setBasicEntityReference(nonExistentTableFqn);
    createTestSuite.setDescription("Basic test suite for non-existent table");

    // Should fail because the table doesn't exist
    assertThrows(
        Exception.class,
        () -> createBasicTestSuite(createTestSuite),
        "Creating basic test suite for non-existent table should fail");
  }

  @Test
  void test_inheritOwnerFromTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table with an owner
    Table table = createTableForBasicTestSuite(ns, "table_with_owner");
    table.setOwners(List.of(testUser1Ref()));
    Table updatedTable = client.tables().update(table.getId().toString(), table);

    // Create a basic test suite for the table
    CreateTestSuite createTestSuite = new CreateTestSuite();
    createTestSuite.setName(updatedTable.getFullyQualifiedName());
    createTestSuite.setBasicEntityReference(updatedTable.getFullyQualifiedName());

    TestSuite testSuite = createBasicTestSuite(createTestSuite);

    // Get test suite with owners field
    TestSuite fetchedSuite = client.testSuites().get(testSuite.getId().toString(), "owners");

    // Verify the test suite inherited the owner from the table
    assertNotNull(fetchedSuite.getOwners());
    assertFalse(fetchedSuite.getOwners().isEmpty());
    assertEquals(testUser1().getId(), fetchedSuite.getOwners().get(0).getId());
  }

  @Test
  void test_inheritDomainFromTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table with a domain
    Table table = createTableForBasicTestSuite(ns, "table_with_domain");
    table.setDomains(List.of(testDomain().getEntityReference()));
    Table updatedTable = client.tables().update(table.getId().toString(), table);

    // Create a basic test suite for the table
    CreateTestSuite createTestSuite = new CreateTestSuite();
    createTestSuite.setName(updatedTable.getFullyQualifiedName());
    createTestSuite.setBasicEntityReference(updatedTable.getFullyQualifiedName());

    TestSuite testSuite = createBasicTestSuite(createTestSuite);

    // Get test suite with domain field
    TestSuite fetchedSuite = client.testSuites().get(testSuite.getId().toString(), "domains");

    // Verify the test suite inherited the domain from the table
    assertNotNull(fetchedSuite.getDomains());
    assertFalse(fetchedSuite.getDomains().isEmpty());
    assertEquals(testDomain().getId(), fetchedSuite.getDomains().get(0).getId());
  }

  @Test
  void test_getBasicTestSuiteFromTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table
    Table table = createTableForBasicTestSuite(ns, "table_get_suite");

    // Create a basic test suite for the table
    CreateTestSuite createTestSuite = new CreateTestSuite();
    createTestSuite.setName(table.getFullyQualifiedName());
    createTestSuite.setBasicEntityReference(table.getFullyQualifiedName());

    TestSuite testSuite = createBasicTestSuite(createTestSuite);

    // Get the table with testSuite field
    Table fetchedTable = client.tables().get(table.getId().toString(), "testSuite");

    // Verify the table has a reference to the test suite
    assertNotNull(fetchedTable.getTestSuite());
    assertEquals(testSuite.getId(), fetchedTable.getTestSuite().getId());
  }

  @Test
  void test_basicTestSuiteDeletedOnTableDeletion(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table
    Table table = createTableForBasicTestSuite(ns, "table_delete_suite");

    // Create a basic test suite for the table
    CreateTestSuite createTestSuite = new CreateTestSuite();
    createTestSuite.setName(table.getFullyQualifiedName());
    createTestSuite.setBasicEntityReference(table.getFullyQualifiedName());

    TestSuite testSuite = createBasicTestSuite(createTestSuite);

    // Soft delete the table (recursive=true to delete children)
    Map<String, String> softDeleteParams = new HashMap<>();
    softDeleteParams.put("recursive", "true");
    client.tables().delete(table.getId().toString(), softDeleteParams);

    // Verify the test suite is also soft deleted
    TestSuite deletedSuite = getEntityIncludeDeleted(testSuite.getId().toString());
    assertTrue(deletedSuite.getDeleted());

    // Hard delete the table
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    client.tables().delete(table.getId().toString(), params);

    // Verify the test suite is hard deleted too
    assertThrows(Exception.class, () -> getEntity(testSuite.getId().toString()));
  }

  @Test
  void test_deleteBasicTestSuite(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table
    Table table = createTableForBasicTestSuite(ns, "table_basic_delete");

    // Create a basic test suite for the table
    CreateTestSuite createTestSuite = new CreateTestSuite();
    createTestSuite.setName(table.getFullyQualifiedName());
    createTestSuite.setBasicEntityReference(table.getFullyQualifiedName());

    TestSuite testSuite = createBasicTestSuite(createTestSuite);

    // Delete the basic test suite
    deleteBasicTestSuite(testSuite.getId());

    // Verify it's soft deleted
    TestSuite deletedSuite = getEntityIncludeDeleted(testSuite.getId().toString());
    assertTrue(deletedSuite.getDeleted());

    // Restore it
    restoreEntity(testSuite.getId().toString());
    TestSuite restoredSuite = getEntity(testSuite.getId().toString());
    assertFalse(restoredSuite.getDeleted());

    // Hard delete
    hardDeleteBasicTestSuite(testSuite.getId());
    assertThrows(Exception.class, () -> getEntity(testSuite.getId().toString()));
  }

  // ===================================================================
  // LOGICAL TEST SUITE TESTS (Test suites with manual test case associations)
  // ===================================================================

  @Test
  void test_createLogicalTestSuiteAndAddTestCases(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table for test cases
    Table table = createTableForBasicTestSuite(ns, "table_logical");

    // Create basic test suite for the table
    CreateTestSuite basicSuiteReq = new CreateTestSuite();
    basicSuiteReq.setName(table.getFullyQualifiedName());
    basicSuiteReq.setBasicEntityReference(table.getFullyQualifiedName());
    TestSuite basicTestSuite = createBasicTestSuite(basicSuiteReq);

    // Create test cases for the table
    List<UUID> testCaseIds = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateTestCase testCaseReq =
          TestCaseBuilder.create(client)
              .name(ns.prefix("test_case_logical_" + i))
              .description("Test case " + i)
              .forTable(table)
              .testDefinition("tableRowCountToEqual")
              .parameter("value", "100")
              .build();
      TestCase testCase = client.testCases().create(testCaseReq);
      testCaseIds.add(testCase.getId());
    }

    // Create a logical test suite
    CreateTestSuite logicalSuiteReq = new CreateTestSuite();
    logicalSuiteReq.setName(ns.prefix("logical_suite"));
    logicalSuiteReq.setDescription("Logical test suite");
    TestSuite logicalSuite = createEntity(logicalSuiteReq);
    assertFalse(logicalSuite.getBasic());

    // Add test cases to logical test suite
    addTestCasesToLogicalTestSuite(logicalSuite.getId(), testCaseIds);

    // Verify test cases are associated
    TestSuite fetchedLogical = client.testSuites().get(logicalSuite.getId().toString(), "tests");
    assertNotNull(fetchedLogical.getTests());
    assertEquals(3, fetchedLogical.getTests().size());

    // Verify the test case IDs match
    List<UUID> fetchedTestCaseIds =
        fetchedLogical.getTests().stream().map(EntityReference::getId).collect(Collectors.toList());
    assertTrue(fetchedTestCaseIds.containsAll(testCaseIds));
  }

  @Test
  void test_addTestCasesToBasicTestSuite_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table and basic test suite
    Table table = createTableForBasicTestSuite(ns, "table_basic_error");
    CreateTestSuite basicSuiteReq = new CreateTestSuite();
    basicSuiteReq.setName(table.getFullyQualifiedName());
    basicSuiteReq.setBasicEntityReference(table.getFullyQualifiedName());
    TestSuite basicTestSuite = createBasicTestSuite(basicSuiteReq);

    // Create a test case
    CreateTestCase testCaseReq =
        TestCaseBuilder.create(client)
            .name(ns.prefix("test_case_basic_error"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .build();
    TestCase testCase = client.testCases().create(testCaseReq);

    // Try to add test case to basic test suite via logical endpoint - should fail
    assertThrows(
        Exception.class,
        () -> addTestCasesToLogicalTestSuite(basicTestSuite.getId(), List.of(testCase.getId())),
        "Adding test cases to basic test suite via logical endpoint should fail");
  }

  @Test
  void test_deleteLogicalTestSuiteKeepsTestCases(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a table and test cases
    Table table = createTableForBasicTestSuite(ns, "table_logical_delete");

    CreateTestSuite basicSuiteReq = new CreateTestSuite();
    basicSuiteReq.setName(table.getFullyQualifiedName());
    basicSuiteReq.setBasicEntityReference(table.getFullyQualifiedName());
    TestSuite basicTestSuite = createBasicTestSuite(basicSuiteReq);

    List<UUID> testCaseIds = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateTestCase testCaseReq =
          TestCaseBuilder.create(client)
              .name(ns.prefix("test_case_delete_" + i))
              .forTable(table)
              .testDefinition("tableRowCountToEqual")
              .parameter("value", "100")
              .build();
      TestCase testCase = client.testCases().create(testCaseReq);
      testCaseIds.add(testCase.getId());
    }

    // Create a logical test suite
    CreateTestSuite logicalSuiteReq = new CreateTestSuite();
    logicalSuiteReq.setName(ns.prefix("logical_suite_delete"));
    TestSuite logicalSuite = createEntity(logicalSuiteReq);

    // Add test cases to logical suite
    addTestCasesToLogicalTestSuite(logicalSuite.getId(), testCaseIds);

    // Delete the logical test suite
    deleteEntity(logicalSuite.getId().toString());
    hardDeleteEntity(logicalSuite.getId().toString());

    // Verify test cases still exist in the basic test suite
    TestSuite basicSuite = client.testSuites().get(basicTestSuite.getId().toString(), "tests");
    assertNotNull(basicSuite.getTests());
    assertEquals(3, basicSuite.getTests().size());

    // Verify test cases are still accessible
    for (UUID testCaseId : testCaseIds) {
      TestCase testCase = client.testCases().get(testCaseId.toString());
      assertNotNull(testCase);
      assertFalse(testCase.getDeleted());
    }
  }

  @Test
  void test_deleteLogicalTestSuiteWithPipeline(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a logical test suite
    CreateTestSuite logicalSuiteReq = new CreateTestSuite();
    logicalSuiteReq.setName(ns.prefix("logical_suite_pipeline"));
    logicalSuiteReq.setDescription("Logical test suite with pipeline");
    TestSuite logicalSuite = createEntity(logicalSuiteReq);

    // Create an ingestion pipeline for the test suite
    CreateIngestionPipeline pipelineReq = new CreateIngestionPipeline();
    pipelineReq.setName(ns.prefix("test_suite_pipeline"));
    pipelineReq.setService(logicalSuite.getEntityReference());
    pipelineReq.setPipelineType(PipelineType.TEST_SUITE);

    TestSuitePipeline testSuitePipeline = new TestSuitePipeline();
    SourceConfig sourceConfig = new SourceConfig().withConfig(testSuitePipeline);
    pipelineReq.setSourceConfig(sourceConfig);
    pipelineReq.setAirflowConfig(new AirflowConfig().withStartDate(new java.util.Date()));

    IngestionPipeline pipeline = client.ingestionPipelines().create(pipelineReq);
    assertNotNull(pipeline);

    // Delete the test suite
    hardDeleteEntity(logicalSuite.getId().toString());

    // Verify the pipeline is also deleted
    assertThrows(
        Exception.class, () -> client.ingestionPipelines().get(pipeline.getId().toString()));
  }

  // ===================================================================
  // PIPELINE COMPLETION AND SEARCH INDEX TESTS
  // ===================================================================

  @Test
  void test_pipelineCompletionUpdatesSearchIndex(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTableForBasicTestSuite(ns, "pipeline_es");
    TestSuite testSuite = createBasicTestSuiteForTable(table);
    List<TestCase> testCases = createTestCases(client, ns, table, 4);
    recordTestCaseResults(client, testCases, 2, 2);

    Double versionBefore = getEntity(testSuite.getId().toString()).getVersion();

    IngestionPipeline pipeline = createTestSuitePipeline(client, ns, testSuite);
    putPipelineStatus(client, pipeline, PipelineStatusType.SUCCESS);

    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      Awaitility.await("pipeline completion updates test suite and search index")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(2))
          .untilAsserted(
              () -> {
                TestSuite updated = getEntityWithFields(testSuite.getId().toString(), "summary");

                assertTrue(updated.getVersion() > versionBefore);

                TestSummary summary = updated.getSummary();
                assertNotNull(summary);
                assertAll(
                    () -> assertEquals(4, summary.getTotal()),
                    () -> assertEquals(2, summary.getSuccess()),
                    () -> assertEquals(2, summary.getFailed()));

                assertEquals(4, updated.getTestCaseResultSummary().size());

                String esBody = queryTestSuiteSearchIndex(searchClient, testSuite.getId());
                assertTrue(esBody.contains(testSuite.getId().toString()));
                assertTrue(esBody.contains("lastResultTimestamp"));
              });
    }
  }

  // ===================================================================
  // TEST SUITE FILTERING AND LISTING TESTS
  // ===================================================================

  @Test
  void test_listTestSuitesByType(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a logical test suite
    CreateTestSuite logicalReq = new CreateTestSuite();
    logicalReq.setName(ns.prefix("logical_filter"));
    TestSuite logicalSuite = createEntity(logicalReq);

    // Create a basic test suite
    Table table = createTableForBasicTestSuite(ns, "table_filter");
    CreateTestSuite basicReq = new CreateTestSuite();
    basicReq.setName(table.getFullyQualifiedName());
    basicReq.setBasicEntityReference(table.getFullyQualifiedName());
    TestSuite basicSuite = createBasicTestSuite(basicReq);

    // List all test suites
    ListParams allParams = new ListParams();
    allParams.setLimit(100);
    ListResponse<TestSuite> allSuites = listEntities(allParams);
    assertTrue(allSuites.getData().size() >= 2);

    // List only basic test suites
    Map<String, String> basicParams = new HashMap<>();
    basicParams.put("testSuiteType", "basic");
    basicParams.put("limit", "100");
    ListResponse<TestSuite> basicSuites = listTestSuites(basicParams);
    assertTrue(basicSuites.getData().stream().allMatch(TestSuite::getBasic));

    // List only logical test suites
    Map<String, String> logicalParams = new HashMap<>();
    logicalParams.put("testSuiteType", "logical");
    logicalParams.put("limit", "100");
    ListResponse<TestSuite> logicalSuites = listTestSuites(logicalParams);
    assertTrue(logicalSuites.getData().stream().noneMatch(TestSuite::getBasic));
  }

  @Test
  void test_listTestSuitesIncludeEmpty(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a test suite with test cases (non-empty)
    Table table1 = createTableForBasicTestSuite(ns, "table_non_empty");
    CreateTestSuite nonEmptySuiteReq = new CreateTestSuite();
    nonEmptySuiteReq.setName(table1.getFullyQualifiedName());
    nonEmptySuiteReq.setBasicEntityReference(table1.getFullyQualifiedName());
    TestSuite nonEmptySuite = createBasicTestSuite(nonEmptySuiteReq);

    // Add a test case
    CreateTestCase testCaseReq =
        TestCaseBuilder.create(client)
            .name(ns.prefix("test_case_non_empty"))
            .forTable(table1)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .build();
    client.testCases().create(testCaseReq);

    // Create an empty test suite
    Table table2 = createTableForBasicTestSuite(ns, "table_empty");
    CreateTestSuite emptySuiteReq = new CreateTestSuite();
    emptySuiteReq.setName(table2.getFullyQualifiedName());
    emptySuiteReq.setBasicEntityReference(table2.getFullyQualifiedName());
    TestSuite emptySuite = createBasicTestSuite(emptySuiteReq);

    // List all test suites (including empty)
    Map<String, String> allParams = new HashMap<>();
    allParams.put("limit", "100");
    ListResponse<TestSuite> allSuites = listTestSuites(allParams);
    long allCount = allSuites.getData().size();

    // List non-empty test suites only
    Map<String, String> nonEmptyParams = new HashMap<>();
    nonEmptyParams.put("includeEmptyTestSuites", "false");
    nonEmptyParams.put("limit", "100");
    ListResponse<TestSuite> nonEmptySuites = listTestSuites(nonEmptyParams);
    long nonEmptyCount = nonEmptySuites.getData().size();

    // Verify that non-empty count is less than or equal to all count
    assertTrue(nonEmptyCount <= allCount);

    // Verify all returned suites in non-empty list have test cases
    for (TestSuite suite : nonEmptySuites.getData()) {
      TestSuite detailed = client.testSuites().get(suite.getId().toString(), "tests");
      if (detailed.getTests() != null) {
        assertFalse(detailed.getTests().isEmpty());
      }
    }
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Table createTableForBasicTestSuite(TestNamespace ns, String suffix) {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.shortPrefix();

    // Create service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("pg_" + shortId + "_" + suffix)
            .connection(conn)
            .description("Test Postgres service for test suite")
            .create();

    // Create database
    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("db_" + shortId + "_" + suffix);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database = client.databases().create(dbReq);

    // Create schema
    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("s_" + shortId + "_" + suffix);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(schemaReq);

    // Create table
    CreateTable tableRequest = new CreateTable();
    tableRequest.setName("t_" + shortId + "_" + suffix);
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return client.tables().create(tableRequest);
  }

  private TestSuite createBasicTestSuite(CreateTestSuite request) {
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      // Use the SDK's HTTP client directly to call the basic test suite endpoint
      org.openmetadata.sdk.network.RequestOptions options =
          org.openmetadata.sdk.network.RequestOptions.builder()
              .queryParam("name", request.getName())
              .build();

      return client
          .getHttpClient()
          .execute(
              org.openmetadata.sdk.network.HttpMethod.POST,
              "/v1/dataQuality/testSuites/basic",
              request,
              TestSuite.class,
              options);
    } catch (Exception e) {
      throw new RuntimeException("Failed to create basic test suite", e);
    }
  }

  private void deleteBasicTestSuite(UUID id) {
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      org.openmetadata.sdk.network.RequestOptions options =
          org.openmetadata.sdk.network.RequestOptions.builder()
              .queryParam("recursive", "true")
              .build();

      client
          .getHttpClient()
          .execute(
              org.openmetadata.sdk.network.HttpMethod.DELETE,
              "/v1/dataQuality/testSuites/basic/" + id.toString(),
              null,
              TestSuite.class,
              options);
    } catch (Exception e) {
      throw new RuntimeException("Failed to delete basic test suite", e);
    }
  }

  private void hardDeleteBasicTestSuite(UUID id) {
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      org.openmetadata.sdk.network.RequestOptions options =
          org.openmetadata.sdk.network.RequestOptions.builder()
              .queryParam("recursive", "true")
              .queryParam("hardDelete", "true")
              .build();

      client
          .getHttpClient()
          .execute(
              org.openmetadata.sdk.network.HttpMethod.DELETE,
              "/v1/dataQuality/testSuites/basic/" + id.toString(),
              null,
              TestSuite.class,
              options);
    } catch (Exception e) {
      throw new RuntimeException("Failed to hard delete basic test suite", e);
    }
  }

  private void addTestCasesToLogicalTestSuite(UUID testSuiteId, List<UUID> testCaseIds) {
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      // Create the request body
      Map<String, Object> requestBody = new HashMap<>();
      requestBody.put("testSuiteId", testSuiteId);
      requestBody.put("testCaseIds", testCaseIds);

      client
          .getHttpClient()
          .execute(
              org.openmetadata.sdk.network.HttpMethod.PUT,
              "/v1/dataQuality/testCases/logicalTestCases",
              requestBody,
              Void.class);
    } catch (Exception e) {
      throw new RuntimeException("Failed to add test cases to logical test suite", e);
    }
  }

  private ListResponse<TestSuite> listTestSuites(Map<String, String> params) {
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      org.openmetadata.sdk.models.ListParams listParams =
          new org.openmetadata.sdk.models.ListParams();
      for (Map.Entry<String, String> entry : params.entrySet()) {
        listParams.addFilter(entry.getKey(), entry.getValue());
      }

      return client.testSuites().list(listParams);
    } catch (Exception e) {
      throw new RuntimeException("Failed to list test suites", e);
    }
  }

  private TestSuite createBasicTestSuiteForTable(Table table) {
    CreateTestSuite request = new CreateTestSuite();
    request.setName(table.getFullyQualifiedName());
    request.setBasicEntityReference(table.getFullyQualifiedName());
    return createBasicTestSuite(request);
  }

  private List<TestCase> createTestCases(
      OpenMetadataClient client, TestNamespace ns, Table table, int count) {
    return IntStream.range(0, count)
        .mapToObj(
            i ->
                TestCaseBuilder.create(client)
                    .name(ns.prefix("tc_pipeline_es_" + i))
                    .forTable(table)
                    .testDefinition("tableRowCountToEqual")
                    .parameter("value", "100")
                    .create())
        .toList();
  }

  private void recordTestCaseResults(
      OpenMetadataClient client, List<TestCase> testCases, int passCount, int failCount)
      throws Exception {
    for (int i = 0; i < passCount; i++) {
      client
          .testCaseResults()
          .forTestCase(testCases.get(i).getFullyQualifiedName())
          .passed()
          .create();
    }
    for (int i = passCount; i < passCount + failCount; i++) {
      client
          .testCaseResults()
          .forTestCase(testCases.get(i).getFullyQualifiedName())
          .failed()
          .create();
    }
  }

  private IngestionPipeline createTestSuitePipeline(
      OpenMetadataClient client, TestNamespace ns, TestSuite testSuite) {
    CreateIngestionPipeline request = new CreateIngestionPipeline();
    request.setName(ns.prefix("pipeline_es_run"));
    request.setService(testSuite.getEntityReference());
    request.setPipelineType(PipelineType.TEST_SUITE);
    request.setSourceConfig(new SourceConfig().withConfig(new TestSuitePipeline()));
    request.setAirflowConfig(new AirflowConfig().withStartDate(new java.util.Date()));
    return client.ingestionPipelines().create(request);
  }

  private void putPipelineStatus(
      OpenMetadataClient client, IngestionPipeline pipeline, PipelineStatusType statusType) {
    PipelineStatus status =
        new PipelineStatus()
            .withPipelineState(statusType)
            .withRunId(UUID.randomUUID().toString())
            .withTimestamp(System.currentTimeMillis());
    String path =
        "/v1/services/ingestionPipelines/" + pipeline.getFullyQualifiedName() + "/pipelineStatus";
    client.getHttpClient().execute(HttpMethod.PUT, path, status, PipelineStatus.class);
  }

  private String getTestSuiteSearchIndexName() {
    return "openmetadata_test_suite_search_index";
  }

  private void refreshTestSuiteSearchIndex(Rest5Client searchClient) throws Exception {
    Request request = new Request("POST", "/" + getTestSuiteSearchIndexName() + "/_refresh");
    searchClient.performRequest(request);
  }

  private String queryTestSuiteSearchIndex(Rest5Client searchClient, UUID testSuiteId)
      throws Exception {
    refreshTestSuiteSearchIndex(searchClient);

    String query =
        """
        {
          "size": 1,
          "query": {
            "bool": {
              "must": [
                { "term": { "_id": "%s" } }
              ]
            }
          }
        }
        """
            .formatted(testSuiteId);

    Request request = new Request("POST", "/" + getTestSuiteSearchIndexName() + "/_search");
    request.setJsonEntity(query);
    Response response = searchClient.performRequest(request);

    assertEquals(200, response.getStatusCode());
    return new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
  }
}
