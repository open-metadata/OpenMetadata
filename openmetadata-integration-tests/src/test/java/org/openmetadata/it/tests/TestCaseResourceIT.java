package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.sdk.network.HttpMethod;

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
  protected CreateTestCase createMinimalRequest(TestNamespace ns) {
    Table table = createTable(ns);

    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(ns.prefix("testcase"))
        .description("Test case created by integration test")
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .build();
  }

  @Override
  protected CreateTestCase createRequest(String name, TestNamespace ns) {
    Table table = createTable(ns);

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

    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(name)
        .description("Test case")
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .build();
  }

  private Table createTable(TestNamespace ns) {
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
    org.openmetadata.schema.entity.data.Database database =
        SdkClients.adminClient().databases().create(dbReq);

    // Create schema with short name
    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("s_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

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

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  @Override
  protected TestCase createEntity(CreateTestCase createRequest) {
    return SdkClients.adminClient().testCases().create(createRequest);
  }

  @Override
  protected TestCase getEntity(String id) {
    return SdkClients.adminClient().testCases().get(id);
  }

  @Override
  protected TestCase getEntityByName(String fqn) {
    return SdkClients.adminClient().testCases().getByName(fqn);
  }

  @Override
  protected TestCase patchEntity(String id, TestCase entity) {
    return SdkClients.adminClient().testCases().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().testCases().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().testCases().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().testCases().delete(id, params);
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
  protected ListResponse<TestCase> listEntities(ListParams params) {
    return SdkClients.adminClient().testCases().list(params);
  }

  @Override
  protected TestCase getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().testCases().get(id, fields);
  }

  @Override
  protected TestCase getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().testCases().getByName(fqn, fields);
  }

  protected TestCase updateEntity(String id, CreateTestCase updateRequest) {
    return SdkClients.adminClient().testCases().upsert(updateRequest);
  }

  protected EntityHistory getEntityHistory(String id) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/dataQuality/testCases/" + id + "/versions", null);
    return new com.fasterxml.jackson.databind.ObjectMapper()
        .readValue(response, EntityHistory.class);
  }

  @Override
  protected TestCase getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().testCases().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(java.util.UUID id) {
    return SdkClients.adminClient().testCases().getVersionList(id);
  }

  @Override
  protected TestCase getVersion(java.util.UUID id, Double version) {
    return SdkClients.adminClient().testCases().getVersion(id, version);
  }

  // ===================================================================
  // TEST CASE SPECIFIC TESTS
  // ===================================================================

  @Test
  void testListFluentAPI(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTable(ns);

    TestCaseBuilder.create(client)
        .name(ns.prefix("test1"))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();

    TestCaseBuilder.create(client)
        .name(ns.prefix("test2"))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "200")
        .create();

    ListResponse<TestCase> response =
        client
            .testCases()
            .list(new ListParams().setFields("testDefinition,testSuite").setLimit(10));

    assertNotNull(response);
    assertTrue(response.getData().size() >= 2);
  }

  @Test
  void testAutoPaginationFluentAPI(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    for (int i = 0; i < 5; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("autopaging_test_" + i))
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", String.valueOf((i + 1) * 100))
          .create();
    }

    ListResponse<TestCase> response =
        client.testCases().list(new ListParams().setLimit(10).setFields("testDefinition"));

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 5);
  }

  @Test
  void post_testCaseWithoutEntityLink_4xx(TestNamespace ns) {
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("no_entity_link"));
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    assertThrows(Exception.class, () -> createEntity(request), "Should fail without entity link");
  }

  @Test
  void post_testCaseWithParameters_200_OK(TestNamespace ns) {
    Table table = createTable(ns);

    CreateTestCase request =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("with_params"))
            .forTable(table)
            .testDefinition("tableRowCountToBeBetween")
            .parameter("minValue", "50")
            .parameter("maxValue", "150")
            .build();

    TestCase created = createEntity(request);
    assertNotNull(created.getParameterValues());
    assertEquals(2, created.getParameterValues().size());
  }

  @Test
  void put_testCaseDescription_200_OK(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("update_desc"))
            .description("Original description")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setDescription("Updated description");
    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_testCaseLinksToTable(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("links_to_table"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertTrue(testCase.getEntityLink().contains(table.getFullyQualifiedName()));
    assertNotNull(testCase.getTestSuite());
  }

  @Test
  void post_testWithInvalidEntityLink_4xx(TestNamespace ns) {
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("invalid_link"));
    request.setEntityLink("<invalid::link>");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    assertThrows(Exception.class, () -> createEntity(request), "Should fail with invalid link");
  }

  @Test
  void post_testWithNonExistentTable_4xx(TestNamespace ns) {
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("nonexistent_table"));
    request.setEntityLink("<#E::table::nonexistent.table>");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    assertThrows(
        Exception.class, () -> createEntity(request), "Should fail with nonexistent table");
  }

  @Test
  void post_testWithInvalidTestDefinition_4xx(TestNamespace ns) {
    Table table = createTable(ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("invalid_def"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("nonExistentTestDefinition");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    assertThrows(
        Exception.class, () -> createEntity(request), "Should fail with invalid test definition");
  }

  @Test
  void post_columnLevelTest_200_OK(TestNamespace ns) {
    Table table = createTable(ns);
    String columnLink =
        String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "id");

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("column_test"));
    request.setEntityLink(columnLink);
    request.setTestDefinition("columnValuesToBeBetween");
    request.setParameterValues(
        List.of(
            new TestCaseParameterValue().withName("minValue").withValue("1"),
            new TestCaseParameterValue().withName("maxValue").withValue("1000")));

    TestCase created = createEntity(request);
    assertTrue(created.getEntityLink().contains("::columns::id"));
  }

  @Test
  void post_testWithInvalidColumnName_4xx(TestNamespace ns) {
    Table table = createTable(ns);
    String invalidColumnLink =
        String.format(
            "<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "nonExistentColumn");

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("invalid_column"));
    request.setEntityLink(invalidColumnLink);
    request.setTestDefinition("columnValuesToBeBetween");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("minValue").withValue("1")));

    assertThrows(Exception.class, () -> createEntity(request), "Should fail with invalid column");
  }

  @Test
  void test_createMultipleTestsOnSameTable_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase test1 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("multi_test1"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase test2 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("multi_test2"))
            .forTable(table)
            .testDefinition("tableColumnCountToEqual")
            .parameter("columnCount", "2")
            .create();

    assertEquals(test1.getTestSuite().getId(), test2.getTestSuite().getId());
    assertNotEquals(test1.getId(), test2.getId());
  }

  @Test
  void test_updateTestCaseParameterValues_200_OK(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("update_params"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("200")));

    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertEquals("200", updated.getParameterValues().get(0).getValue());
  }

  @Test
  void test_testCaseVersionHistory_200_OK(TestNamespace ns) throws Exception {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("version_test"))
            .description("Original")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setDescription("Updated");
    patchEntity(testCase.getId().toString(), testCase);

    testCase.setDescription("Updated again");
    patchEntity(testCase.getId().toString(), testCase);

    EntityHistory history = getEntityHistory(testCase.getId().toString());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_testCaseSoftDeleteAndRestore_200_OK(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("soft_delete_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String testCaseId = testCase.getId().toString();

    deleteEntity(testCaseId);

    assertThrows(Exception.class, () -> getEntity(testCaseId), "Should not find deleted entity");

    restoreEntity(testCaseId);

    TestCase restored = getEntity(testCaseId);
    assertEquals(testCase.getName(), restored.getName());
  }

  @Test
  void test_testCaseHardDelete_200_OK(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("hard_delete_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String testCaseId = testCase.getId().toString();

    hardDeleteEntity(testCaseId);

    assertThrows(Exception.class, () -> getEntity(testCaseId), "Should not find deleted entity");

    assertThrows(
        Exception.class, () -> restoreEntity(testCaseId), "Should not restore hard-deleted entity");
  }

  @Test
  void test_listTestCases_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCaseBuilder.create(client)
        .name(ns.prefix("list_test1"))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();

    TestCaseBuilder.create(client)
        .name(ns.prefix("list_test2"))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "200")
        .create();

    // Filter by entityLink to only get test cases for this test's table
    // This avoids test pollution from parallel tests that may have deleted their tables
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    ListResponse<TestCase> testCases =
        client
            .testCases()
            .list(new ListParams().setLimit(100).addQueryParam("entityLink", entityLink));

    assertNotNull(testCases);
    assertTrue(testCases.getData().size() >= 2);
  }

  @Test
  void test_testCaseWithDifferentTestDefinitions(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase rowCountTest =
        TestCaseBuilder.create(client)
            .name(ns.prefix("row_count"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase columnCountTest =
        TestCaseBuilder.create(client)
            .name(ns.prefix("column_count"))
            .forTable(table)
            .testDefinition("tableColumnCountToEqual")
            .parameter("columnCount", "2")
            .create();

    assertNotEquals(
        rowCountTest.getTestDefinition().getId(), columnCountTest.getTestDefinition().getId());
  }

  @Test
  void post_testWithMissingRequiredParameter_4xx(TestNamespace ns) {
    Table table = createTable(ns);

    // columnValuesMissingCount has a required parameter 'missingCountValue'
    // Table has columns 'id' and 'name' - use 'id' for the column link
    String columnLink =
        String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "id");

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("missing_param"));
    request.setEntityLink(columnLink);
    request.setTestDefinition("columnValuesMissingCount");
    request.setParameterValues(List.of()); // Missing required 'missingCountValue' parameter

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Should fail with missing required parameter");
  }

  @Test
  void post_testWithInvalidParameterValue_4xx(TestNamespace ns) {
    Table table = createTable(ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("invalid_param_value"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("invalidParam").withValue("100")));

    assertThrows(
        Exception.class, () -> createEntity(request), "Should fail with invalid parameter name");
  }

  @Test
  void test_testCaseWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("with_owner"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase);
  }

  @Test
  void test_testCaseDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("displayname_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setDisplayName("Custom Display Name");
    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertEquals("Custom Display Name", updated.getDisplayName());
  }

  @Test
  void test_getTestCaseByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("get_by_name"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase fetched = getEntityByName(testCase.getFullyQualifiedName());
    assertEquals(testCase.getId(), fetched.getId());
    assertEquals(testCase.getName(), fetched.getName());
  }

  @Test
  void test_testCaseComputePassedFailedRowCount(TestNamespace ns) {
    Table table = createTable(ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("compute_rows"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setComputePassedFailedRowCount(true);

    TestCase created = createEntity(request);
    assertTrue(created.getComputePassedFailedRowCount());
  }

  @Test
  void test_patchTestCaseComputePassedFailedRowCount(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("patch_compute"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setComputePassedFailedRowCount(true);
    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertTrue(updated.getComputePassedFailedRowCount());
  }

  @Test
  void test_createTestCaseWithUseDynamicAssertion(TestNamespace ns) {
    Table table = createTable(ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("dynamic_assertion"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setUseDynamicAssertion(true);

    TestCase created = createEntity(request);
    assertTrue(created.getUseDynamicAssertion());
  }

  @Test
  void test_updateTestCaseDisplayName(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("update_display"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setDisplayName("New Display Name");
    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertEquals("New Display Name", updated.getDisplayName());
  }

  @Test
  void test_testCaseEntityFQN(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("fqn_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getFullyQualifiedName());
    assertTrue(testCase.getFullyQualifiedName().contains(testCase.getName()));
    assertTrue(testCase.getFullyQualifiedName().contains(table.getFullyQualifiedName()));
  }

  @Test
  void test_testCaseHasTestSuite(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("has_suite"))
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
    Table table = createTable(ns);

    for (int i = 0; i < 5; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("page_test_" + i))
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", String.valueOf((i + 1) * 100))
          .create();
    }

    ListResponse<TestCase> page1 = client.testCases().list(new ListParams().setLimit(2));
    assertTrue(page1.getData().size() <= 2);

    if (page1.getPaging() != null && page1.getPaging().getAfter() != null) {
      ListResponse<TestCase> page2 =
          client
              .testCases()
              .list(new ListParams().setLimit(2).setAfter(page1.getPaging().getAfter()));
      assertNotNull(page2);
    }
  }

  @Test
  void test_addTestCasesToLogicalTestSuite(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase1 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("logical_suite1"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase testCase2 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("logical_suite2"))
            .forTable(table)
            .testDefinition("tableColumnCountToEqual")
            .parameter("columnCount", "2")
            .create();

    assertNotNull(testCase1.getTestSuite());
    assertNotNull(testCase2.getTestSuite());
    assertEquals(testCase1.getTestSuite().getId(), testCase2.getTestSuite().getId());
  }

  @Test
  void test_listTestCasesByEntityLink(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCaseBuilder.create(client)
        .name(ns.prefix("by_entity1"))
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();

    TestCaseBuilder.create(client)
        .name(ns.prefix("by_entity2"))
        .forTable(table)
        .testDefinition("tableColumnCountToEqual")
        .parameter("columnCount", "2")
        .create();

    ListParams params =
        new ListParams()
            .setLimit(100)
            .addQueryParam("entityLink", "<#E::table::" + table.getFullyQualifiedName() + ">");

    ListResponse<TestCase> testCases = client.testCases().list(params);
    assertTrue(testCases.getData().size() >= 2);
  }

  @Test
  void test_testCaseUniqueNamePerTable(TestNamespace ns) {
    Table table = createTable(ns);

    String testName = ns.prefix("unique_name");

    TestCaseBuilder.create(SdkClients.adminClient())
        .name(testName)
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();

    assertThrows(
        Exception.class,
        () ->
            TestCaseBuilder.create(SdkClients.adminClient())
                .name(testName)
                .forTable(table)
                .testDefinition("tableColumnCountToEqual")
                .parameter("columnCount", "2")
                .create(),
        "Should not allow duplicate test name on same table");
  }

  @Test
  void test_columnNotNullTest(TestNamespace ns) {
    Table table = createTable(ns);
    String columnLink =
        String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "id");

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("not_null"));
    request.setEntityLink(columnLink);
    request.setTestDefinition("columnValuesToBeNotNull");
    request.setParameterValues(List.of());

    TestCase created = createEntity(request);
    assertEquals("columnValuesToBeNotNull", created.getTestDefinition().getName());
  }

  @Test
  void test_columnUniqueTest(TestNamespace ns) {
    Table table = createTable(ns);
    String columnLink =
        String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "id");

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("unique_col"));
    request.setEntityLink(columnLink);
    request.setTestDefinition("columnValuesToBeUnique");
    request.setParameterValues(List.of());

    TestCase created = createEntity(request);
    assertEquals("columnValuesToBeUnique", created.getTestDefinition().getName());
  }

  @Test
  void test_tableColumnCountTest(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("col_count"))
            .forTable(table)
            .testDefinition("tableColumnCountToEqual")
            .parameter("columnCount", "2")
            .create();

    assertEquals("tableColumnCountToEqual", testCase.getTestDefinition().getName());
  }

  @Test
  void test_testCaseFQNFormat(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("fqn_format"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String fqn = testCase.getFullyQualifiedName();
    assertTrue(fqn.contains(table.getFullyQualifiedName()));
    assertTrue(fqn.contains(testCase.getName()));
  }

  @Test
  void test_testCaseTestSuiteIsExecutable(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("executable"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase.getTestSuite());

    Map<String, String> params = new HashMap<>();
    params.put("fields", "executable");
    TestCase fetchedWithFields = getEntityWithFields(testCase.getId().toString(), "testSuite");
    assertNotNull(fetchedWithFields.getTestSuite());
  }

  @Test
  void test_updateTestCaseOwner(TestNamespace ns) {
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("update_owner"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase);
  }

  @Test
  void test_testCaseGetById(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("get_by_id"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase fetched = getEntity(testCase.getId().toString());
    assertEquals(testCase.getId(), fetched.getId());
    assertEquals(testCase.getName(), fetched.getName());
    assertEquals(testCase.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_testCaseWithDomains(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("domains_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    assertNotNull(testCase);

    testCase.setDomains(List.of(testDomain().getEntityReference()));
    TestCase updated = patchEntity(testCase.getId().toString(), testCase);

    TestCase fetched = getEntityWithFields(updated.getId().toString(), "domains");
    assertNotNull(fetched.getDomains());
    assertFalse(fetched.getDomains().isEmpty());
    assertEquals(testDomain().getId(), fetched.getDomains().get(0).getId());
  }

  @Test
  void test_deleteTableDeletesTestCases(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("cascade_delete_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String testCaseId = testCase.getId().toString();

    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().tables().delete(table.getId().toString(), params);

    assertThrows(
        Exception.class,
        () -> getEntity(testCaseId),
        "Test case should be deleted when table is deleted");
  }

  @Test
  void test_testCaseInheritsFromTestDefinition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

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

  @Test
  void test_updateTestCaseParameters(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create test case with tableRowCountToBeBetween (requires minValue and maxValue)
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("update_params_test"))
            .forTable(table)
            .testDefinition("tableRowCountToBeBetween")
            .parameter("minValue", "50")
            .parameter("maxValue", "100")
            .create();

    // Update the parameter values (not the definition)
    testCase.setParameterValues(
        List.of(
            new org.openmetadata.schema.tests.TestCaseParameterValue()
                .withName("minValue")
                .withValue("25"),
            new org.openmetadata.schema.tests.TestCaseParameterValue()
                .withName("maxValue")
                .withValue("200")));

    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertNotNull(updated.getParameterValues());
    assertTrue(
        updated.getParameterValues().stream()
            .anyMatch(p -> "maxValue".equals(p.getName()) && "200".equals(p.getValue())));
  }

  @Test
  void test_testCaseInheritedFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("inherited_fields_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase fetchedWithFields =
        client.testCases().get(testCase.getId().toString(), "testSuite,testDefinition,owners");

    assertNotNull(fetchedWithFields.getTestSuite());
    assertNotNull(fetchedWithFields.getTestDefinition());
  }

  @Test
  void test_testCaseWithInspectionQuery(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("inspection_query_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    String inspectionQuery = "SELECT * FROM " + table.getName() + " WHERE id IS NULL";
    testCase.setInspectionQuery(inspectionQuery);

    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertEquals(inspectionQuery, updated.getInspectionQuery());
  }

  @Test
  void test_testCaseEntityStatus(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("entity_status_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setEntityStatus(org.openmetadata.schema.type.EntityStatus.APPROVED);
    TestCase updated = patchEntity(testCase.getId().toString(), testCase);
    assertEquals(org.openmetadata.schema.type.EntityStatus.APPROVED, updated.getEntityStatus());
  }

  @Test
  void post_testWithCaseInsensitiveColumnName_200_OK(TestNamespace ns) {
    // Test case column validation is case-insensitive (see TestCaseRepository.java line 638)
    // So "ID" should match column "id" and the request should succeed
    Table table = createTable(ns);

    String caseInsensitiveColumnLink =
        String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "ID");

    CreateTestCase createRequest = new CreateTestCase();
    createRequest.setName(ns.prefix("case_insensitive_column"));
    createRequest.setEntityLink(caseInsensitiveColumnLink);
    createRequest.setTestDefinition("columnValuesToBeBetween");
    createRequest.setParameterValues(
        List.of(new TestCaseParameterValue().withName("minValue").withValue("1")));

    // Should succeed because column validation is case-insensitive
    TestCase created = createEntity(createRequest);
    assertNotNull(created, "Test case should be created with case-insensitive column match");
  }
}
