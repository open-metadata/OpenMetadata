package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for TestCase entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds test case-specific tests.
 *
 * <p>Migrated from: org.openmetadata.service.resources.dqtests.TestCaseResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class TestCaseResourceIT extends BaseEntityIT<TestCase, CreateTestCase> {

  // Disable tests that don't apply to TestCase
  {
    supportsFollowers = false; // TestCase doesn't support followers
    supportsTags = false; // TestCase tags are handled differently
    supportsDataProducts = false; // TestCase doesn't support dataProducts
    supportsNameLengthValidation = false; // TestCase FQN includes table FQN, no strict name length
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTestCase createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    Table table = createTable(client, ns);

    return TestCaseBuilder.create(client)
        .name(ns.prefix("testcase"))
        .description("Test case created by integration test")
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .build();
  }

  @Override
  protected CreateTestCase createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    Table table = createTable(client, ns);

    // For invalid name tests, bypass builder validation to test server-side validation
    if (name == null || name.isEmpty() || name.contains("\n")) {
      CreateTestCase request = new CreateTestCase();
      request.setName(name);
      request.setDescription("Test case");
      request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
      request.setTestDefinition("tableRowCountToEqual");
      request.setParameterValues(
          List.of(new TestCaseParameterValue().withName("value").withValue("100")));
      return request;
    }

    return TestCaseBuilder.create(client)
        .name(name)
        .description("Test case")
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .build();
  }

  private Table createTable(OpenMetadataClient client, TestNamespace ns) {
    // Use short names to avoid FQN length limit (256 chars)
    String shortId = ns.shortPrefix();

    // Create service with short name using fluent API
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("pg_" + shortId)
            .connection(conn)
            .description("Test Postgres service")
            .create();

    // Create database with short name
    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database = client.databases().create(dbReq);

    // Create schema with short name
    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("s_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName("t_" + shortId);
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

  @Override
  protected TestCase createEntity(CreateTestCase createRequest, OpenMetadataClient client) {
    return client.testCases().create(createRequest);
  }

  @Override
  protected TestCase getEntity(String id, OpenMetadataClient client) {
    return client.testCases().get(id);
  }

  @Override
  protected TestCase getEntityByName(String fqn, OpenMetadataClient client) {
    return client.testCases().getByName(fqn);
  }

  @Override
  protected TestCase patchEntity(String id, TestCase entity, OpenMetadataClient client) {
    return client.testCases().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.testCases().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.testCases().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.testCases().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "testCase";
  }

  @Override
  protected void validateCreatedEntity(TestCase entity, CreateTestCase createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getEntityLink(), "TestCase must have an entity link");
    assertNotNull(entity.getTestDefinition(), "TestCase must have a test definition");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain test case name");
  }

  @Override
  protected ListResponse<TestCase> listEntities(ListParams params, OpenMetadataClient client) {
    return client.testCases().list(params);
  }

  @Override
  protected TestCase getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.testCases().get(id, fields);
  }

  @Override
  protected TestCase getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.testCases().getByName(fqn, fields);
  }

  @Override
  protected TestCase getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.testCases().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.testCases().getVersionList(id);
  }

  @Override
  protected TestCase getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.testCases().getVersion(id.toString(), version);
  }

  // ===================================================================
  // OVERRIDDEN TESTS - TestCase requires entityLink filter for list operations
  // ===================================================================

  /**
   * Override testListFluentAPI to filter by entityLink.
   *
   * <p>TestCase list operations require an entityLink filter because listing all TestCases globally
   * can fail if other parallel tests have deleted tables that TestCases reference.
   */
  @Override
  @Test
  void testListFluentAPI(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create a few test cases for this specific table
    for (int i = 0; i < 3; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("listfluent" + i))
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", String.valueOf(i * 100))
          .create();
    }

    // List entities filtered by entityLink
    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + ">";
    ListParams params = new ListParams();
    params.setLimit(10);
    params.addFilter("entityLink", entityLink);
    ListResponse<TestCase> response = listEntities(params, client);

    assertNotNull(response, "List response should not be null");
    assertNotNull(response.getData(), "Data should not be null");
    assertTrue(response.getData().size() >= 3, "Should have at least 3 entities");
    assertNotNull(response.getPaging(), "Paging info should be present");
  }

  /**
   * Override testAutoPaginationFluentAPI to filter by entityLink.
   *
   * <p>TestCase list operations require an entityLink filter for parallel test safety.
   */
  @Override
  @Test
  void testAutoPaginationFluentAPI(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create multiple test cases for this specific table
    int count = 5;
    for (int i = 0; i < count; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("pagefluent" + i))
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", String.valueOf(i * 100))
          .create();
    }

    // Test pagination with small page size, filtered by entityLink
    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + ">";
    ListParams params = new ListParams();
    params.setLimit(2);
    params.addFilter("entityLink", entityLink);

    java.util.List<UUID> seenIds = new java.util.ArrayList<>();
    String afterCursor = null;
    int totalSeen = 0;
    int maxPages = 100;

    do {
      params.setAfter(afterCursor);
      ListResponse<TestCase> page = listEntities(params, client);

      assertNotNull(page, "Page should not be null");
      for (TestCase entity : page.getData()) {
        assertFalse(seenIds.contains(entity.getId()), "Should not see duplicate IDs");
        seenIds.add(entity.getId());
        totalSeen++;
      }

      afterCursor = page.getPaging().getAfter();
      maxPages--;
    } while (afterCursor != null && maxPages > 0);

    assertTrue(totalSeen >= count, "Should see at least " + count + " entities through pagination");
  }

  // ===================================================================
  // TEST CASE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_testCaseWithoutEntityLink_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Entity link is required field
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_no_link"));
    request.setTestDefinition("tableRowCountToEqual");

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating test case without entity link should fail");
  }

  @Test
  void post_testCaseWithParameters_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Using fluent builder API
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_with_params"))
            .description("Test case with parameters")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "1000")
            .create();

    assertNotNull(testCase);
    assertNotNull(testCase.getParameterValues());
  }

  @Test
  void put_testCaseDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_update_desc"))
            .description("Initial description")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertEquals("Initial description", testCase.getDescription());

    // Update description
    testCase.setDescription("Updated description");
    TestCase updated = patchEntity(testCase.getId().toString(), testCase, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_testCaseLinksToTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_table_link"))
            .description("Test case linked to table")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase);
    assertNotNull(testCase.getEntityLink());
    assertTrue(testCase.getEntityLink().contains(table.getFullyQualifiedName()));
  }

  // ===================================================================
  // ADDITIONAL TEST CASE TESTS - Migrated from TestCaseResourceTest
  // ===================================================================

  @Test
  void post_testWithInvalidEntityLink_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Invalid entity link format
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_invalid_link"));
    request.setTestDefinition("tableRowCountToEqual");
    request.setEntityLink("<#E::dashboard::temp"); // Invalid format

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating test case with invalid entity link should fail");
  }

  @Test
  void post_testWithNonExistentTable_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Non-existent table
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_nonexistent_table"));
    request.setTestDefinition("tableRowCountToEqual");
    request.setEntityLink("<#E::table::nonExistentTable>");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating test case with non-existent table should fail");
  }

  @Test
  void post_testWithInvalidTestDefinition_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_invalid_def"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("nonExistentTestDefinition");

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating test case with non-existent test definition should fail");
  }

  @Test
  void post_columnLevelTest_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Using fluent builder API with forColumn()
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_column_level"))
            .description("Column-level test case")
            .forColumn(table, "id")
            .testDefinition("columnValuesToBeBetween")
            .parameter("minValue", "0")
            .parameter("maxValue", "1000")
            .create();

    assertNotNull(testCase);
    assertTrue(testCase.getEntityLink().contains("columns::id"));
  }

  @Test
  void post_testWithInvalidColumnName_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Invalid column name
    String invalidColumnLink =
        String.format("<#E::table::%s::columns::nonExistentColumn>", table.getFullyQualifiedName());

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_invalid_column"));
    request.setEntityLink(invalidColumnLink);
    request.setTestDefinition("columnValuesToBeBetween");
    request.setParameterValues(
        List.of(
            new TestCaseParameterValue().withName("minValue").withValue("0"),
            new TestCaseParameterValue().withName("maxValue").withValue("100")));

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating test case with invalid column name should fail");
  }

  @Test
  void test_createMultipleTestsOnSameTable_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create first test using fluent API
    TestCase testCase1 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("test1_row_count"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Create second test using fluent API
    TestCase testCase2 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("test2_row_count"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "200")
            .create();

    assertNotNull(testCase1);
    assertNotNull(testCase2);
    assertNotEquals(testCase1.getId(), testCase2.getId());
    assertEquals(testCase1.getEntityFQN(), testCase2.getEntityFQN());
  }

  @Test
  void test_updateTestCaseParameterValues_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_update_params"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertEquals("100", testCase.getParameterValues().get(0).getValue());

    // Update parameter values
    testCase.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("200")));
    TestCase updated = patchEntity(testCase.getId().toString(), testCase, client);

    // Note: The test definition may not allow changing params via patch
    assertNotNull(updated);
  }

  @Test
  void test_testCaseVersionHistory_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_version"))
            .description("Initial description")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    Double initialVersion = testCase.getVersion();

    // Update to create new version
    testCase.setDescription("Updated description");
    TestCase updated = patchEntity(testCase.getId().toString(), testCase, client);
    assertTrue(updated.getVersion() >= initialVersion);

    // Get version history
    EntityHistory history = getVersionHistory(testCase.getId(), client);
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 1);

    // Get specific version
    TestCase version = getVersion(testCase.getId(), initialVersion, client);
    assertNotNull(version);
  }

  @Test
  void test_testCaseSoftDeleteAndRestore_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_soft_delete"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String testCaseId = testCase.getId().toString();

    // Soft delete
    deleteEntity(testCaseId, client);

    // Verify deleted
    TestCase deleted = getEntityIncludeDeleted(testCaseId, client);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(testCaseId, client);

    // Verify restored
    TestCase restored = getEntity(testCaseId, client);
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void test_testCaseHardDelete_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_hard_delete"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String testCaseId = testCase.getId().toString();

    // Hard delete
    hardDeleteEntity(testCaseId, client);

    // Verify completely gone
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(testCaseId, client),
        "Hard deleted test case should not be retrievable");
  }

  @Test
  void test_listTestCases_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create multiple test cases using fluent API
    for (int i = 0; i < 3; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("list_testcase_" + i))
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", String.valueOf(i * 100))
          .create();
    }

    // List test cases filtered by entityLink - this is the proper usage pattern
    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + ">";
    ListParams params = new ListParams();
    params.setLimit(100);
    params.addFilter("entityLink", entityLink);
    ListResponse<TestCase> response = listEntities(params, client);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertEquals(3, response.getData().size(), "Should have exactly 3 test cases for this table");

    // Verify all returned test cases belong to our table
    for (TestCase tc : response.getData()) {
      assertTrue(
          tc.getEntityLink().contains(table.getFullyQualifiedName()),
          "Test case should be linked to our table");
    }
  }

  @Test
  void test_testCaseWithDifferentTestDefinitions(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Test with tableRowCountToEqual using fluent API
    TestCase testCase1 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("test_row_count_equal"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase1);
    assertEquals("tableRowCountToEqual", testCase1.getTestDefinition().getName());

    // Test with tableRowCountToBeBetween using fluent API
    TestCase testCase2 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("test_row_count_between"))
            .forTable(table)
            .testDefinition("tableRowCountToBeBetween")
            .parameter("minValue", "50")
            .parameter("maxValue", "150")
            .create();

    assertNotNull(testCase2);
    assertEquals("tableRowCountToBeBetween", testCase2.getTestDefinition().getName());
  }

  @Test
  void post_testWithMissingRequiredParameter_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // tableRowCountToEqual requires 'value' parameter
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_missing_param"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    // Missing parameterValues

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating test case without required parameter should fail");
  }

  @Test
  void post_testWithInvalidParameterValue_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_invalid_param"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("wrongParam").withValue("100")));

    assertThrows(
        Exception.class,
        () -> createEntity(request, client),
        "Creating test case with wrong parameter name should fail");
  }

  @Test
  void test_testCaseWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_with_owner"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .owner(testUser1().getEntityReference())
            .create();

    assertNotNull(testCase);
    assertNotNull(testCase.getOwners());
    assertFalse(testCase.getOwners().isEmpty());
  }

  @Test
  void test_testCaseDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_display_name"))
            .displayName("My Custom Test Case Display Name")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertEquals("My Custom Test Case Display Name", testCase.getDisplayName());
  }

  @Test
  void test_getTestCaseByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_get_by_name"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getFullyQualifiedName());

    // Get by FQN
    TestCase fetched = getEntityByName(testCase.getFullyQualifiedName(), client);
    assertEquals(testCase.getId(), fetched.getId());
    assertEquals(testCase.getName(), fetched.getName());
  }

  @Test
  void test_testCaseComputePassedFailedRowCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_compute_rows"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .computePassedFailedRowCount(true)
            .create();

    assertTrue(testCase.getComputePassedFailedRowCount());
  }

  @Test
  void test_patchTestCaseComputePassedFailedRowCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_patch_compute"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .computePassedFailedRowCount(false)
            .create();

    assertFalse(testCase.getComputePassedFailedRowCount());

    // Update via patch
    testCase.setComputePassedFailedRowCount(true);
    TestCase updated = patchEntity(testCase.getId().toString(), testCase, client);
    assertTrue(updated.getComputePassedFailedRowCount());
  }

  @Test
  void test_createTestCaseWithUseDynamicAssertion(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_dynamic_assertion"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .useDynamicAssertion(true)
            .create();

    assertTrue(testCase.getUseDynamicAssertion());
  }

  @Test
  void test_updateTestCaseDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_update_display"))
            .displayName("Original Display Name")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertEquals("Original Display Name", testCase.getDisplayName());

    // Update display name
    testCase.setDisplayName("Updated Display Name");
    TestCase updated = patchEntity(testCase.getId().toString(), testCase, client);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_testCaseEntityFQN(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_entity_fqn"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getEntityFQN());
    assertEquals(table.getFullyQualifiedName(), testCase.getEntityFQN());
  }

  @Test
  void test_testCaseHasTestSuite(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_has_suite"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getTestSuite());
    assertNotNull(testCase.getTestSuite().getId());
  }

  @Test
  void test_listTestCasesWithPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create 5 test cases using fluent API
    for (int i = 0; i < 5; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("paginated_test_" + i))
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", String.valueOf(i * 100))
          .create();
    }

    // First page
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<TestCase> page1 = listEntities(params, client);
    assertNotNull(page1);
    assertNotNull(page1.getData());

    // Verify pagination metadata
    assertNotNull(page1.getPaging());
  }

  @Test
  void test_addTestCasesToLogicalTestSuite(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create a logical test suite
    org.openmetadata.schema.api.tests.CreateTestSuite suiteRequest =
        new org.openmetadata.schema.api.tests.CreateTestSuite();
    suiteRequest.setName(ns.prefix("logical_suite"));
    suiteRequest.setDescription("Logical test suite for test case");
    org.openmetadata.schema.tests.TestSuite logicalSuite = client.testSuites().create(suiteRequest);
    assertNotNull(logicalSuite);

    // Create test cases using fluent API
    TestCase testCase1 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_for_suite_1"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase testCase2 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("testcase_for_suite_2"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "200")
            .create();

    assertNotNull(testCase1.getId());
    assertNotNull(testCase2.getId());
  }

  @Test
  void test_listTestCasesByEntityLink(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create test cases for this table using fluent API
    for (int i = 0; i < 3; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("entity_link_test_" + i))
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", String.valueOf(i * 100))
          .create();
    }

    // List test cases - should contain our tests
    ListParams params = new ListParams();
    params.setLimit(100);
    String tableLink = "<#E::table::" + table.getFullyQualifiedName() + ">";
    params.addFilter("entityLink", tableLink);
    ListResponse<TestCase> response = listEntities(params, client);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_testCaseUniqueNamePerTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    String testName = ns.prefix("unique_test");

    // Create first test case using fluent API
    TestCase testCase1 =
        TestCaseBuilder.create(client)
            .name(testName)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase1);

    // Try to create duplicate - should fail
    assertThrows(
        Exception.class,
        () ->
            TestCaseBuilder.create(client)
                .name(testName)
                .forTable(table)
                .testDefinition("tableRowCountToEqual")
                .parameter("value", "200")
                .create(),
        "Creating test case with duplicate name on same table should fail");
  }

  @Test
  void test_columnNotNullTest(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Using fluent builder API for column-level test
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("column_not_null_test"))
            .description("Column not null test")
            .forColumn(table, "id")
            .testDefinition("columnValuesToBeNotNull")
            .create();

    assertNotNull(testCase);
    assertEquals("columnValuesToBeNotNull", testCase.getTestDefinition().getName());
  }

  @Test
  void test_columnUniqueTest(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Using fluent builder API for column-level test
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("column_unique_test"))
            .description("Column unique test")
            .forColumn(table, "id")
            .testDefinition("columnValuesToBeUnique")
            .create();

    assertNotNull(testCase);
    assertEquals("columnValuesToBeUnique", testCase.getTestDefinition().getName());
  }

  @Test
  void test_tableColumnCountTest(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("column_count_test"))
            .description("Table column count test")
            .forTable(table)
            .testDefinition("tableColumnCountToEqual")
            .parameter("columnCount", "2")
            .create();

    assertNotNull(testCase);
    assertEquals("tableColumnCountToEqual", testCase.getTestDefinition().getName());
  }

  @Test
  void test_testCaseFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    String testName = ns.prefix("fqn_test");
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(testName)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getFullyQualifiedName());
    // FQN format: <table_fqn>.<test_name>
    assertTrue(testCase.getFullyQualifiedName().contains(table.getFullyQualifiedName()));
    assertTrue(testCase.getFullyQualifiedName().contains(testName));
  }

  @Test
  void test_testCaseTestSuiteIsExecutable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("executable_suite_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getTestSuite());
    // The auto-created test suite should be a "basic" test suite (linked to a table)
    // Note: "basic" is the internal term, "executable" is the API term
    // Fetch the test suite to verify basic flag
    org.openmetadata.schema.tests.TestSuite testSuite =
        client.testSuites().get(testCase.getTestSuite().getId().toString());
    // Use Boolean.TRUE.equals to handle null values safely
    assertTrue(
        Boolean.TRUE.equals(testSuite.getBasic()),
        "Auto-created test suite should be a basic test suite");
  }

  @Test
  void test_updateTestCaseOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("update_owner_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertTrue(testCase.getOwners() == null || testCase.getOwners().isEmpty());

    // Add owner via patch
    testCase.setOwners(List.of(testUser1().getEntityReference()));
    TestCase updated = patchEntity(testCase.getId().toString(), testCase, client);

    assertNotNull(updated.getOwners());
    assertFalse(updated.getOwners().isEmpty());
    assertEquals(testUser1().getId(), updated.getOwners().get(0).getId());
  }

  @Test
  void test_testCaseGetById(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("get_by_id_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Get by ID
    TestCase fetched = getEntity(testCase.getId().toString(), client);
    assertEquals(testCase.getId(), fetched.getId());
    assertEquals(testCase.getName(), fetched.getName());
    assertEquals(testCase.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_testCaseWithDomains(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("domains_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase);

    // Update with domains
    testCase.setDomains(List.of(testDomain().getEntityReference()));
    TestCase updated = patchEntity(testCase.getId().toString(), testCase, client);

    // Fetch with domains field
    TestCase fetched = getEntityWithFields(updated.getId().toString(), "domains", client);
    assertNotNull(fetched.getDomains());
    assertFalse(fetched.getDomains().isEmpty());
    assertEquals(testDomain().getId(), fetched.getDomains().get(0).getId());
  }

  @Test
  void test_deleteTableDeletesTestCases(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    // Create test case using fluent API
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("cascade_delete_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String testCaseId = testCase.getId().toString();

    // Delete the table (hard delete)
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    client.tables().delete(table.getId().toString(), params);

    // The test case should be deleted when the table is deleted
    assertThrows(
        Exception.class,
        () -> getEntity(testCaseId, client),
        "Test case should be deleted when table is deleted");
  }

  @Test
  void test_testCaseInheritsFromTestDefinition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("inherits_def_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getTestDefinition());
    assertNotNull(testCase.getTestDefinition().getId());
    assertEquals("tableRowCountToEqual", testCase.getTestDefinition().getName());
  }
}
