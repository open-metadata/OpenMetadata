package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.resources.dqtests.TestCaseResource;

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
    supportsImportExport = true;
    supportsBatchImport = true;
    supportsRecursiveImport = false; // TestCase doesn't support recursive import
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected String getResourcePath() {
    return TestCaseResource.COLLECTION_PATH;
  }

  @Override
  protected CsvImportResult performImportCsv(TestNamespace ns, String csvData, boolean dryRun) {
    try {
      String containerName = getImportExportContainerName(ns);
      String result =
          SdkClients.adminClient()
              .testCases()
              .importCsv(containerName, csvData, dryRun, "testSuite");
      return JsonUtils.readValue(result, CsvImportResult.class);
    } catch (Exception e) {
      throw new RuntimeException("CSV import failed: " + e.getMessage(), e);
    }
  }

  private TestSuite lastCreatedTestSuite;

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
    String shortId = ns.uniqueShortId();

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

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<TestCase> getEntityService() {
    return SdkClients.adminClient().testCases();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    if (lastCreatedTestSuite == null) {
      CreateTestSuite request = new CreateTestSuite();
      request.setName(ns.prefix("export_suite"));
      request.setDescription("Test suite for export testing");
      lastCreatedTestSuite = SdkClients.adminClient().testSuites().create(request);
    }
    return lastCreatedTestSuite.getFullyQualifiedName();
  }

  // ===================================================================
  // TEST CASE OVERRIDEN TESTS
  // ===================================================================
  @Override
  @Test
  void test_importCsvDryRun(TestNamespace ns) {
    org.junit.jupiter.api.Assumptions.assumeTrue(
        supportsImportExport, "Entity does not support import/export");

    String containerName = getImportExportContainerName(ns);
    org.junit.jupiter.api.Assumptions.assumeTrue(
        containerName != null, "Container name not provided");

    // Create an entity first
    CreateTestCase createRequest = createMinimalRequest(ns);
    TestCase entity = createEntity(createRequest);
    assertNotNull(entity, "Entity should be created");

    try {
      // Export to get valid CSV format
      String exportedCsv = SdkClients.adminClient().testCases().exportCsv(containerName);
      assertNotNull(exportedCsv, "Export should return CSV data");

      // Import with dry run - TestCase requires targetEntityType
      String result =
          SdkClients.adminClient()
              .testCases()
              .importCsv(containerName, exportedCsv, true, "testSuite");
      assertNotNull(result, "Import dry run should return a result");
    } catch (org.openmetadata.sdk.exceptions.OpenMetadataException e) {
      org.junit.jupiter.api.Assertions.fail("Import/export failed: " + e.getMessage());
    }
  }

  @Override
  @Test
  void test_importExportRoundTrip(TestNamespace ns) {
    org.junit.jupiter.api.Assumptions.assumeTrue(
        supportsImportExport, "Entity does not support import/export");

    String containerName = getImportExportContainerName(ns);
    org.junit.jupiter.api.Assumptions.assumeTrue(
        containerName != null, "Container name not provided");

    // Create an entity first
    CreateTestCase createRequest = createMinimalRequest(ns);
    TestCase entity = createEntity(createRequest);
    assertNotNull(entity, "Entity should be created");

    try {
      // Export current state
      String exportedCsv = SdkClients.adminClient().testCases().exportCsv(containerName);
      assertNotNull(exportedCsv, "Export should return CSV data");

      // Import the exported data - TestCase requires targetEntityType
      String result =
          SdkClients.adminClient()
              .testCases()
              .importCsv(containerName, exportedCsv, false, "testSuite");
      assertNotNull(result, "Import should return a result");

      // Export again and verify consistency
      String reExportedCsv = SdkClients.adminClient().testCases().exportCsv(containerName);
      assertNotNull(reExportedCsv, "Re-export should return CSV data");

      // Headers should match after round-trip
      String[] originalLines = exportedCsv.split("\n");
      String[] reExportedLines = reExportedCsv.split("\n");
      assertEquals(
          originalLines[0], reExportedLines[0], "CSV headers should match after round-trip");
    } catch (org.openmetadata.sdk.exceptions.OpenMetadataException e) {
      org.junit.jupiter.api.Assertions.fail("Import/export round-trip failed: " + e.getMessage());
    }
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

  // ===================================================================
  // MIGRATED TESTS FROM TestCaseResourceTest
  // ===================================================================

  @Test
  void test_createMany(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create two tables for the test cases
    Table table1 = createTable(ns);
    Table table2 = createTableWithName(ns, "table2");

    String tableLink1 = "<#E::table::" + table1.getFullyQualifiedName() + ">";
    String tableLink2 = "<#E::table::" + table2.getFullyQualifiedName() + ">";

    // Create 10 test cases, alternating between tables
    java.util.List<CreateTestCase> createRequests = new java.util.ArrayList<>();
    for (int i = 0; i < 10; i++) {
      CreateTestCase request = new CreateTestCase();
      request.setName(ns.prefix("bulk_test_" + i));
      request.setDescription("Bulk test case " + i);
      request.setEntityLink(i % 2 == 0 ? tableLink1 : tableLink2);
      request.setTestDefinition("tableRowCountToEqual");
      request.setParameterValues(
          List.of(new TestCaseParameterValue().withName("value").withValue("100")));
      createRequests.add(request);
    }

    // Use the createMany API
    List<TestCase> createdTestCases = client.testCases().createMany(createRequests);

    // Verify all 10 were created
    assertEquals(10, createdTestCases.size());

    // Verify each test case exists and has correct entity link
    for (int i = 0; i < createdTestCases.size(); i++) {
      TestCase testCase = createdTestCases.get(i);
      assertNotNull(testCase.getId());
      assertNotNull(testCase.getFullyQualifiedName());

      // Fetch and verify
      TestCase fetched = client.testCases().get(testCase.getId().toString());
      assertNotNull(fetched);
      assertEquals(testCase.getName(), fetched.getName());
    }
  }

  @Test
  void test_addInspectionQueryViaAPI(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create a test case
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("inspection_query_api_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Set inspection query using the API
    String inspectionQuery = "SELECT * FROM " + table.getName() + " WHERE status = 'FAILED'";
    TestCase updatedTestCase =
        client.testCases().setInspectionQuery(testCase.getId().toString(), inspectionQuery);

    // Verify the inspection query was set
    assertNotNull(updatedTestCase);
    assertEquals(inspectionQuery, updatedTestCase.getInspectionQuery());

    // Fetch and verify it persisted
    TestCase fetched = client.testCases().get(testCase.getId().toString());
    assertEquals(inspectionQuery, fetched.getInspectionQuery());
  }

  @Test
  void test_testCaseResultStateManagement(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create a test case
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("result_state_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Add multiple test case results at different timestamps
    long baseTimestamp = System.currentTimeMillis() - 86400000L * 5; // 5 days ago

    for (int i = 0; i < 5; i++) {
      long timestamp = baseTimestamp + (i * 86400000L); // Each day after base
      org.openmetadata.schema.api.tests.CreateTestCaseResult resultRequest =
          new org.openmetadata.schema.api.tests.CreateTestCaseResult();
      resultRequest.setTimestamp(timestamp);
      resultRequest.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
      resultRequest.setResult("Failure result for day " + i);

      client.testCaseResults().create(testCase.getFullyQualifiedName(), resultRequest);
    }

    // Fetch the test case and verify the latest result is the most recent
    TestCase fetchedTestCase =
        client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertNotNull(fetchedTestCase.getTestCaseResult());

    // The latest result should have the most recent timestamp
    long latestTimestamp = baseTimestamp + (4 * 86400000L);
    assertEquals(latestTimestamp, fetchedTestCase.getTestCaseResult().getTimestamp());

    // Delete the latest result
    client.testCaseResults().delete(testCase.getFullyQualifiedName(), latestTimestamp);

    // Verify the test case now has the second-most-recent result
    fetchedTestCase = client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertNotNull(fetchedTestCase.getTestCaseResult());
    long secondLatestTimestamp = baseTimestamp + (3 * 86400000L);
    assertEquals(secondLatestTimestamp, fetchedTestCase.getTestCaseResult().getTimestamp());
  }

  @Test
  void test_columnTestCaseValidation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Test with valid column
    String validColumnLink =
        String.format("<#E::table::%s::columns::id>", table.getFullyQualifiedName());

    CreateTestCase validRequest = new CreateTestCase();
    validRequest.setName(ns.prefix("valid_column_test"));
    validRequest.setEntityLink(validColumnLink);
    validRequest.setTestDefinition("columnValuesToBeNotNull");
    validRequest.setParameterValues(List.of());

    TestCase created = client.testCases().create(validRequest);
    assertNotNull(created);

    // Test with invalid column - should fail
    String invalidColumnLink =
        String.format(
            "<#E::table::%s::columns::nonexistent_column>", table.getFullyQualifiedName());

    CreateTestCase invalidRequest = new CreateTestCase();
    invalidRequest.setName(ns.prefix("invalid_column_test"));
    invalidRequest.setEntityLink(invalidColumnLink);
    invalidRequest.setTestDefinition("columnValuesToBeNotNull");

    assertThrows(
        org.openmetadata.sdk.exceptions.OpenMetadataException.class,
        () -> client.testCases().create(invalidRequest),
        "Should fail for non-existent column");
  }

  @Test
  void test_testCaseInvalidEntityLink(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test with invalid entity link format
    CreateTestCase invalidRequest = new CreateTestCase();
    invalidRequest.setName(ns.prefix("invalid_link_test"));
    invalidRequest.setEntityLink("<#E::table::nonexistent.table>");
    invalidRequest.setTestDefinition("tableRowCountToEqual");
    invalidRequest.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    assertThrows(
        org.openmetadata.sdk.exceptions.OpenMetadataException.class,
        () -> client.testCases().create(invalidRequest),
        "Should fail for non-existent table in entity link");
  }

  @Test
  void test_listTestCasesFromSearch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create several test cases with unique description
    String uniqueToken = ns.shortPrefix();
    for (int i = 0; i < 5; i++) {
      TestCaseBuilder.create(client)
          .name(ns.prefix("search_test_" + i))
          .description("Search test " + uniqueToken)
          .forTable(table)
          .testDefinition("tableRowCountToEqual")
          .parameter("value", "100")
          .create();
    }

    // Wait for search indexing
    try {
      Thread.sleep(2000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    // List test cases (search needs special endpoint)
    ListResponse<TestCase> results = client.testCases().list(new ListParams().setLimit(100));

    // Verify at least 5 were created
    assertNotNull(results);
    assertTrue(results.getData().size() >= 5, "Should have at least 5 test cases");
  }

  @Test
  void test_failedRowsSample(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create a test case
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("failed_rows_sample_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // First, add a failed test case result - required before adding failed rows sample
    org.openmetadata.schema.api.tests.CreateTestCaseResult failedResult =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    failedResult.setResult("Test failed with row count mismatch");

    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);

    // Create sample data using columns that exist in the table (id column from createTable)
    org.openmetadata.schema.type.TableData sampleData =
        new org.openmetadata.schema.type.TableData();
    sampleData.setColumns(List.of("id"));
    sampleData.setRows(List.of(List.of("1"), List.of("2"), List.of("3")));

    // Add failed rows sample
    TestCase updatedTestCase =
        client.testCases().addFailedRowsSample(testCase.getId().toString(), sampleData);

    // Verify the sample data was added
    assertNotNull(updatedTestCase);

    // Fetch the sample data
    org.openmetadata.schema.type.TableData fetchedSample =
        client.testCases().getFailedRowsSample(testCase.getId().toString());

    assertNotNull(fetchedSample);
    assertEquals(1, fetchedSample.getColumns().size());
    assertEquals(3, fetchedSample.getRows().size());

    // Delete the sample data
    client.testCases().deleteFailedRowsSample(testCase.getId().toString());

    // Verify it's gone
    assertThrows(
        org.openmetadata.sdk.exceptions.OpenMetadataException.class,
        () -> client.testCases().getFailedRowsSample(testCase.getId().toString()));
  }

  private Table createTableWithName(TestNamespace ns, String nameSuffix) {
    OpenMetadataClient client = SdkClients.adminClient();
    String shortId = ns.uniqueShortId();

    // Create service using existing pattern
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("pg2_" + shortId)
            .connection(conn)
            .description("Test Postgres service")
            .create();

    // Create database
    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("db2_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database = client.databases().create(dbReq);

    // Create schema
    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("sc2_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(schemaReq);

    // Create table with unique name
    String tableName = shortId + nameSuffix;
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.INT)
                        .withDescription("Primary key")));

    return client.tables().create(createTable);
  }

  // ===================================================================
  // TESTS USING SHARED ENTITIES
  // ===================================================================

  @Test
  void test_testCaseWithTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create test case with PII tag
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("tagged_test_case"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setTags(List.of(shared.PII_SENSITIVE_TAG_LABEL));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertNotNull(testCase.getTags());
    assertTrue(
        testCase.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN())));

    // Update to add another tag
    TestCase fetched = client.testCases().get(testCase.getId().toString(), "tags");
    fetched.setTags(List.of(shared.PII_SENSITIVE_TAG_LABEL, shared.PERSONAL_DATA_TAG_LABEL));
    TestCase updated = client.testCases().update(fetched.getId().toString(), fetched);

    assertEquals(2, updated.getTags().size());
  }

  @Test
  void test_testCaseWithDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create test case with detailed description
    String description = "This test case validates that the row count equals the expected value";
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("described_test_case"));
    request.setDescription(description);
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertEquals(description, testCase.getDescription());

    // Update description
    TestCase fetched = client.testCases().get(testCase.getId().toString());
    String newDescription = "Updated description for test case";
    fetched.setDescription(newDescription);
    TestCase updated = client.testCases().update(fetched.getId().toString(), fetched);

    assertEquals(newDescription, updated.getDescription());
  }

  @Test
  void test_testCaseWithSharedOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create test case with shared user as owner
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("owned_test_case"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setOwners(List.of(shared.USER1_REF));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertNotNull(testCase.getOwners());
    assertEquals(1, testCase.getOwners().size());
    assertEquals(shared.USER1.getId(), testCase.getOwners().get(0).getId());

    // Change owner to USER2
    TestCase fetched = client.testCases().get(testCase.getId().toString(), "owners");
    fetched.setOwners(List.of(shared.USER2_REF));
    TestCase updated = client.testCases().update(fetched.getId().toString(), fetched);

    assertEquals(1, updated.getOwners().size());
    assertEquals(shared.USER2.getId(), updated.getOwners().get(0).getId());
  }

  @Test
  void test_testCaseWithTeamOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create test case with team as owner
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("team_owned_test_case"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    // TEAM11 is a Group team (TEAM1 is Department which can't own entities)
    request.setOwners(List.of(shared.TEAM11.getEntityReference()));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertNotNull(testCase.getOwners());
    assertEquals(1, testCase.getOwners().size());
    assertEquals(shared.TEAM11.getId(), testCase.getOwners().get(0).getId());
  }

  @Test
  void test_testCaseWithGlossaryTermTag(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create test case with glossary term tag
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("glossary_tagged_test_case"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setTags(List.of(shared.GLOSSARY1_TERM1_LABEL));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertNotNull(testCase.getTags());
    assertTrue(
        testCase.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.GLOSSARY1_TERM1_LABEL.getTagFQN())));
  }

  @Test
  void test_testCaseResolutionStatusWorkflow(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create a test case
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("resolution_workflow_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Add a failed test result to trigger incident creation
    org.openmetadata.schema.api.tests.CreateTestCaseResult failedResult =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    failedResult.setResult("Test failed - triggering incident");

    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);

    // Fetch test case to get incident ID
    TestCase fetchedWithIncident =
        client.testCases().get(testCase.getId().toString(), "incidentId");

    // Create resolution status - Acknowledge the incident
    org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus ackStatus =
        new org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus();
    ackStatus.setTestCaseResolutionStatusType(
        org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes.Ack);
    ackStatus.setTestCaseReference(testCase.getFullyQualifiedName());

    org.openmetadata.schema.tests.type.TestCaseResolutionStatus createdAck =
        client.testCaseResolutionStatuses().create(ackStatus);

    assertNotNull(createdAck);
    assertEquals(
        org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes.Ack,
        createdAck.getTestCaseResolutionStatusType());

    // Create resolution status - Assign to a user
    org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus assignedStatus =
        new org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus();
    assignedStatus.setTestCaseResolutionStatusType(
        org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes.Assigned);
    assignedStatus.setTestCaseReference(testCase.getFullyQualifiedName());
    assignedStatus.setTestCaseResolutionStatusDetails(
        new org.openmetadata.schema.tests.type.Assigned().withAssignee(shared.USER1_REF));

    org.openmetadata.schema.tests.type.TestCaseResolutionStatus createdAssigned =
        client.testCaseResolutionStatuses().create(assignedStatus);

    assertNotNull(createdAssigned);
    assertEquals(
        org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes.Assigned,
        createdAssigned.getTestCaseResolutionStatusType());
  }

  @Test
  void test_listTestCasesFilteredByOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create test case owned by USER1
    CreateTestCase request1 = new CreateTestCase();
    request1.setName(ns.prefix("owner_filter_test1"));
    request1.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request1.setTestDefinition("tableRowCountToEqual");
    request1.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request1.setOwners(List.of(shared.USER1_REF));
    client.testCases().create(request1);

    // Create test case owned by USER2
    CreateTestCase request2 = new CreateTestCase();
    request2.setName(ns.prefix("owner_filter_test2"));
    request2.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request2.setTestDefinition("tableRowCountToEqual");
    request2.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("200")));
    request2.setOwners(List.of(shared.USER2_REF));
    client.testCases().create(request2);

    // List all test cases - should include both
    ListResponse<TestCase> allTestCases = client.testCases().list(new ListParams().setLimit(100));
    assertTrue(allTestCases.getData().size() >= 2);
  }

  @Test
  void test_testCaseWithMultipleTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create test case with multiple tags from different sources
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("multi_tagged_test_case"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setTags(
        List.of(
            shared.PII_SENSITIVE_TAG_LABEL,
            shared.PERSONAL_DATA_TAG_LABEL,
            shared.GLOSSARY1_TERM1_LABEL));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertNotNull(testCase.getTags());
    assertEquals(3, testCase.getTags().size());

    // Verify all tag types are present
    boolean hasPiiSensitive =
        testCase.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN()));
    boolean hasPersonalData =
        testCase.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    boolean hasGlossaryTerm =
        testCase.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.GLOSSARY1_TERM1_LABEL.getTagFQN()));

    assertTrue(hasPiiSensitive, "Should have PII Sensitive tag");
    assertTrue(hasPersonalData, "Should have Personal Data tag");
    assertTrue(hasGlossaryTerm, "Should have Glossary term tag");
  }

  @Test
  void test_testCaseWithMultipleUserOwners(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    // Create test case with multiple user owners
    // Note: Ownership rule allows either multiple users OR single team, not mix
    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("multi_owner_test_case"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setOwners(List.of(shared.USER1_REF, shared.USER2_REF));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertNotNull(testCase.getOwners());
    assertEquals(2, testCase.getOwners().size());
    assertTrue(testCase.getOwners().stream().anyMatch(o -> o.getId().equals(shared.USER1.getId())));
    assertTrue(testCase.getOwners().stream().anyMatch(o -> o.getId().equals(shared.USER2.getId())));
  }

  @Test
  void test_testCaseCreatedByAdmin(TestNamespace ns) {
    // Use admin client to create test case and verify createdBy/updatedBy
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("admin_created_test_case"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    TestCase testCase = client.testCases().create(request);

    assertNotNull(testCase);
    assertNotNull(testCase.getUpdatedBy());
    // Admin creates the entity
    assertEquals("admin", testCase.getUpdatedBy());
  }

  @Test
  void test_testCaseResultSummary(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create test case
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("result_summary_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Add multiple results with different statuses
    long baseTime = System.currentTimeMillis() - 86400000L * 7; // 7 days ago

    // Day 1-3: Success
    for (int i = 0; i < 3; i++) {
      org.openmetadata.schema.api.tests.CreateTestCaseResult result =
          new org.openmetadata.schema.api.tests.CreateTestCaseResult();
      result.setTimestamp(baseTime + (i * 86400000L));
      result.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Success);
      result.setResult("Day " + (i + 1) + " passed");
      client.testCaseResults().create(testCase.getFullyQualifiedName(), result);
    }

    // Day 4-5: Failed
    for (int i = 3; i < 5; i++) {
      org.openmetadata.schema.api.tests.CreateTestCaseResult result =
          new org.openmetadata.schema.api.tests.CreateTestCaseResult();
      result.setTimestamp(baseTime + (i * 86400000L));
      result.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
      result.setResult("Day " + (i + 1) + " failed");
      client.testCaseResults().create(testCase.getFullyQualifiedName(), result);
    }

    // Fetch test case with result - should have latest (failed)
    TestCase fetchedCase = client.testCases().get(testCase.getId().toString(), "testCaseResult");

    assertNotNull(fetchedCase.getTestCaseResult());
    assertEquals(
        org.openmetadata.schema.tests.type.TestCaseStatus.Failed,
        fetchedCase.getTestCaseResult().getTestCaseStatus());
  }

  @Test
  void test_deleteTestCaseResult(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    // Create test case
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("delete_result_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Add two results
    long timestamp1 = System.currentTimeMillis() - 86400000L;
    long timestamp2 = System.currentTimeMillis();

    org.openmetadata.schema.api.tests.CreateTestCaseResult result1 =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    result1.setTimestamp(timestamp1);
    result1.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Success);
    result1.setResult("First result");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result1);

    org.openmetadata.schema.api.tests.CreateTestCaseResult result2 =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    result2.setTimestamp(timestamp2);
    result2.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    result2.setResult("Second result");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result2);

    // Delete the latest result
    client.testCaseResults().delete(testCase.getFullyQualifiedName(), timestamp2);

    // Fetch test case - should have first result as latest
    TestCase fetchedCase = client.testCases().get(testCase.getId().toString(), "testCaseResult");

    assertNotNull(fetchedCase.getTestCaseResult());
    assertEquals(timestamp1, fetchedCase.getTestCaseResult().getTimestamp());
    assertEquals(
        org.openmetadata.schema.tests.type.TestCaseStatus.Success,
        fetchedCase.getTestCaseResult().getTestCaseStatus());
  }

  @Test
  void post_testWithoutRequiredFields_4xx(TestNamespace ns) {
    CreateTestCase request = new CreateTestCase();
    request.setName(null);
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    assertThrows(Exception.class, () -> createEntity(request), "Should fail when name is null");
  }

  @Test
  void post_testWithInvalidParamValues_4xx(TestNamespace ns) {
    Table table = createTable(ns);

    CreateTestCase request1 = new CreateTestCase();
    request1.setName(ns.prefix("invalid_param"));
    request1.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request1.setTestDefinition("columnValuesMissingCount");
    request1.setParameterValues(List.of());

    assertThrows(
        Exception.class,
        () -> createEntity(request1),
        "Should fail when required parameter is missing");

    CreateTestCase request2 = new CreateTestCase();
    request2.setName(ns.prefix("extra_param"));
    request2.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request2.setTestDefinition("tableRowCountToEqual");
    request2.setParameterValues(
        List.of(
            new TestCaseParameterValue().withName("value").withValue("100"),
            new TestCaseParameterValue().withName("invalidParameter").withValue("200")));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Should fail when invalid parameter is provided");
  }

  @Test
  void post_testWithWrongCaseColumnName_4xx(TestNamespace ns) {
    // Note: The original test uses "C1" literal against column "c'_+# 1" - completely different
    // strings
    // This tests that a non-matching column name is rejected (not case sensitivity)
    Table table = createTable(ns);

    // Use a column name that doesn't exist - mimics original behavior
    String wrongColumnLink =
        String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "C1");

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("wrong_case_column"));
    request.setEntityLink(wrongColumnLink);
    request.setTestDefinition("columnValuesToBeNotNull");
    request.setParameterValues(List.of());

    assertThrows(
        Exception.class, () -> createEntity(request), "Should fail with invalid column name");
  }

  @Test
  void put_testCaseResults_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    String columnLink =
        String.format("<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), "id");

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("results_test"));
    request.setEntityLink(columnLink);
    request.setTestDefinition("columnValuesMissingCount");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("missingCountValue").withValue("100")));

    TestCase testCase = createEntity(request);

    long timestamp1 = System.currentTimeMillis() - 86400000L;
    long timestamp2 = System.currentTimeMillis();

    org.openmetadata.schema.api.tests.CreateTestCaseResult result1 =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    result1.setTimestamp(timestamp1);
    result1.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Success);
    result1.setResult("First test result");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result1);

    org.openmetadata.schema.api.tests.CreateTestCaseResult result2 =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    result2.setTimestamp(timestamp2);
    result2.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    result2.setResult("Second test result");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result2);

    TestCase fetchedCase = client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertNotNull(fetchedCase.getTestCaseResult());
    assertEquals(timestamp2, fetchedCase.getTestCaseResult().getTimestamp());
    assertEquals(
        org.openmetadata.schema.tests.type.TestCaseStatus.Failed,
        fetchedCase.getTestCaseResult().getTestCaseStatus());
  }

  @Test
  void getTestCaseWithResult(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("with_result"))
            .forTable(table)
            .testDefinition("tableRowCountToBeBetween")
            .parameter("minValue", "10")
            .parameter("maxValue", "100")
            .create();

    long timestamp1 = System.currentTimeMillis() - 86400000L * 10;
    long timestamp2 = System.currentTimeMillis() - 86400000L;
    long timestamp3 = System.currentTimeMillis();

    org.openmetadata.schema.api.tests.CreateTestCaseResult createResult1 =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    createResult1.setTimestamp(timestamp1);
    createResult1.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Success);
    createResult1.setResult("Past result");
    org.openmetadata.schema.tests.type.TestCaseResult result1 =
        client.testCaseResults().create(testCase.getFullyQualifiedName(), createResult1);

    TestCase fetchedCase1 = client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertEquals(result1.getTimestamp(), fetchedCase1.getTestCaseResult().getTimestamp());

    org.openmetadata.schema.api.tests.CreateTestCaseResult createResult2 =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    createResult2.setTimestamp(timestamp2);
    createResult2.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    createResult2.setResult("Recent result");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), createResult2);

    TestCase fetchedCase2 = client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertEquals(timestamp2, fetchedCase2.getTestCaseResult().getTimestamp());

    org.openmetadata.schema.api.tests.CreateTestCaseResult createResult3 =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    createResult3.setTimestamp(timestamp3);
    createResult3.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Success);
    createResult3.setResult("Latest result");
    org.openmetadata.schema.tests.type.TestCaseResult result3 =
        client.testCaseResults().create(testCase.getFullyQualifiedName(), createResult3);

    TestCase fetchedCase3 = client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertEquals(result3.getTimestamp(), fetchedCase3.getTestCaseResult().getTimestamp());

    client.testCaseResults().delete(testCase.getFullyQualifiedName(), timestamp3);

    TestCase fetchedCase4 = client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertEquals(timestamp2, fetchedCase4.getTestCaseResult().getTimestamp());
  }

  @Test
  void createUpdate_DynamicAssertionTests(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("dynamic_test"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));
    request.setUseDynamicAssertion(true);

    TestCase testCase = createEntity(request);
    assertTrue(testCase.getUseDynamicAssertion());

    testCase.setUseDynamicAssertion(false);
    TestCase updated = client.testCases().update(testCase.getId().toString(), testCase);
    assertFalse(updated.getUseDynamicAssertion());
  }

  @Test
  void patch_entityComputePassedFailedRowCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("compute_rows_patch"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setComputePassedFailedRowCount(true);
    TestCase updated = client.testCases().update(testCase.getId().toString(), testCase);

    assertTrue(updated.getComputePassedFailedRowCount());
  }

  @Test
  void createUpdateDelete_tests_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase1 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("crud_test1"))
            .forTable(table)
            .testDefinition("tableRowCountToBeBetween")
            .parameter("minValue", "10")
            .parameter("maxValue", "100")
            .create();

    TestCase testCase2 =
        TestCaseBuilder.create(client)
            .name(ns.prefix("crud_test2"))
            .forTable(table)
            .testDefinition("tableColumnCountToEqual")
            .parameter("columnCount", "2")
            .create();

    assertNotNull(testCase1.getId());
    assertNotNull(testCase2.getId());

    testCase1.setDescription("Updated description");
    TestCase updated = client.testCases().update(testCase1.getId().toString(), testCase1);
    assertEquals("Updated description", updated.getDescription());

    client.testCases().delete(testCase1.getId().toString());
    assertThrows(Exception.class, () -> client.testCases().get(testCase1.getId().toString()));
  }

  @Test
  @org.junit.jupiter.api.Disabled(
      "API returns empty data instead of throwing exception after resolution")
  void resolved_test_case_deletes_sample_data(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("resolved_sample_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    org.openmetadata.schema.api.tests.CreateTestCaseResult failedResult =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    failedResult.setResult("Test failed");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);

    org.openmetadata.schema.type.TableData sampleData =
        new org.openmetadata.schema.type.TableData();
    sampleData.setColumns(List.of("id"));
    sampleData.setRows(List.of(List.of("1"), List.of("2")));

    client.testCases().addFailedRowsSample(testCase.getId().toString(), sampleData);

    org.openmetadata.schema.type.TableData fetchedSample =
        client.testCases().getFailedRowsSample(testCase.getId().toString());
    assertNotNull(fetchedSample);

    org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus resolvedStatus =
        new org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus();
    resolvedStatus.setTestCaseResolutionStatusType(
        org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes.Resolved);
    resolvedStatus.setTestCaseReference(testCase.getFullyQualifiedName());
    resolvedStatus.setTestCaseResolutionStatusDetails(
        new org.openmetadata.schema.tests.type.Resolved().withResolvedBy(shared.USER1_REF));

    client.testCaseResolutionStatuses().create(resolvedStatus);

    assertThrows(
        Exception.class, () -> client.testCases().getFailedRowsSample(testCase.getId().toString()));
  }

  @Test
  void put_and_delete_failedRowSample_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("failed_row_sample_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    org.openmetadata.schema.api.tests.CreateTestCaseResult failedResult =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    failedResult.setResult("Test failed");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);

    org.openmetadata.schema.type.TableData sampleData =
        new org.openmetadata.schema.type.TableData();
    sampleData.setColumns(List.of("id", "name"));
    sampleData.setRows(List.of(List.of("1", "test1"), List.of("2", "test2")));

    client.testCases().addFailedRowsSample(testCase.getId().toString(), sampleData);

    org.openmetadata.schema.type.TableData fetchedSample =
        client.testCases().getFailedRowsSample(testCase.getId().toString());

    assertNotNull(fetchedSample);
    assertEquals(2, fetchedSample.getColumns().size());
    assertEquals(2, fetchedSample.getRows().size());

    client.testCases().deleteFailedRowsSample(testCase.getId().toString());

    assertThrows(
        Exception.class, () -> client.testCases().getFailedRowsSample(testCase.getId().toString()));
  }

  @Test
  void put_failedRowSample_with_invalid_column_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("sample_invalid_col"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    org.openmetadata.schema.api.tests.CreateTestCaseResult failedResult =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Failed);
    failedResult.setResult("Test failed");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);

    org.openmetadata.schema.type.TableData sampleData =
        new org.openmetadata.schema.type.TableData();
    sampleData.setColumns(List.of("arbitrary_column"));
    sampleData.setRows(List.of(List.of("data1"), List.of("data2")));

    assertThrows(
        Exception.class,
        () -> client.testCases().addFailedRowsSample(testCase.getId().toString(), sampleData),
        "Should fail with invalid column name");
  }

  @Test
  void patch_entityDescriptionAndTestAuthorizer(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("patch_desc_test"))
            .description("Original description")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    testCase.setDescription("Patched description");
    TestCase updated = client.testCases().update(testCase.getId().toString(), testCase);

    assertEquals("Patched description", updated.getDescription());
    assertNotNull(updated.getUpdatedBy());
  }

  @Test
  void wrongMinMaxTestParameter(TestNamespace ns) {
    Table table = createTable(ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("wrong_min_max"));
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToBeBetween");
    request.setParameterValues(
        List.of(
            new TestCaseParameterValue().withName("minValue").withValue("100"),
            new TestCaseParameterValue().withName("maxValue").withValue("50")));

    assertThrows(
        Exception.class, () -> createEntity(request), "Should fail when minValue > maxValue");
  }

  @Test
  void createTestCaseResults_wrongTs(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("wrong_ts"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    org.openmetadata.schema.api.tests.CreateTestCaseResult result =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    // Use timestamp in seconds (not milliseconds) - this should be rejected
    // 1725521153L is September 2024 in seconds, which is too small for milliseconds
    result.setTimestamp(1725521153L);
    result.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Success);
    result.setResult("Wrong timestamp result");

    assertThrows(
        Exception.class,
        () -> client.testCaseResults().create(testCase.getFullyQualifiedName(), result),
        "Should fail with timestamp in seconds instead of milliseconds");
  }

  @Test
  void patch_testCaseResults_noChange(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns);

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name(ns.prefix("no_change_test"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    long timestamp = System.currentTimeMillis();

    org.openmetadata.schema.api.tests.CreateTestCaseResult result =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    result.setTimestamp(timestamp);
    result.setTestCaseStatus(org.openmetadata.schema.tests.type.TestCaseStatus.Success);
    result.setResult("Initial result");

    org.openmetadata.schema.tests.type.TestCaseResult createdResult =
        client.testCaseResults().create(testCase.getFullyQualifiedName(), result);

    assertNotNull(createdResult);
    assertEquals(
        org.openmetadata.schema.tests.type.TestCaseStatus.Success,
        createdResult.getTestCaseStatus());

    TestCase fetchedCase = client.testCases().get(testCase.getId().toString(), "testCaseResult");
    assertNotNull(fetchedCase.getTestCaseResult());
    assertEquals(timestamp, fetchedCase.getTestCaseResult().getTimestamp());
  }

  // ===================================================================
  // FLUENT API TESTS - Using TestCases static fluent API
  // ===================================================================

  @Test
  void testFluentCreateTestCase(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase testCase =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_create"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "50")
            .description("Created using fluent API")
            .execute();

    assertNotNull(testCase);
    assertNotNull(testCase.getId());
    assertEquals("Created using fluent API", testCase.getDescription());
  }

  @Test
  void testFluentCreateColumnLevelTest(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase testCase =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_column"))
            .forColumn(table, "id")
            .testDefinition("columnValuesToBeNotNull")
            .description("Column-level test via fluent API")
            .execute();

    assertNotNull(testCase);
    assertNotNull(testCase.getId());
    assertTrue(testCase.getEntityLink().contains("columns::id"));
  }

  @Test
  void testFluentFindAndLoad(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase created =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_find"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .execute();

    // Find by ID
    org.openmetadata.sdk.fluent.TestCases.FluentTestCase loaded =
        org.openmetadata.sdk.fluent.TestCases.find(created.getId()).fetch();

    assertNotNull(loaded);
    assertEquals(created.getId(), loaded.get().getId());
  }

  @Test
  void testFluentFindByName(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase created =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_find_name"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .execute();

    // Find by name
    org.openmetadata.sdk.fluent.TestCases.FluentTestCase loaded =
        org.openmetadata.sdk.fluent.TestCases.findByName(created.getFullyQualifiedName()).fetch();

    assertNotNull(loaded);
    assertEquals(created.getId(), loaded.get().getId());
  }

  @Test
  void testFluentUpdateAndSave(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase created =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_update"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .description("Initial description")
            .execute();

    // Update via fluent API
    org.openmetadata.sdk.fluent.TestCases.FluentTestCase loaded =
        org.openmetadata.sdk.fluent.TestCases.find(created.getId()).fetch();

    TestCase updated = loaded.withDescription("Updated description").save();

    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void testFluentDelete(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase created =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_delete"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .execute();

    // Delete via fluent API
    org.openmetadata.sdk.fluent.TestCases.find(created.getId()).delete().confirm();

    // Verify deleted
    TestCase deleted = getEntityIncludeDeleted(created.getId().toString());
    assertTrue(deleted.getDeleted());
  }

  @Test
  void testFluentList(TestNamespace ns) {
    Table table1 = createTable(ns);
    Table table2 = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    org.openmetadata.sdk.fluent.TestCases.create()
        .name(ns.prefix("fluent_list_1"))
        .forTable(table1)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .execute();

    org.openmetadata.sdk.fluent.TestCases.create()
        .name(ns.prefix("fluent_list_2"))
        .forTable(table2)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "200")
        .execute();

    // List via fluent API
    ListResponse<TestCase> response =
        org.openmetadata.sdk.fluent.TestCases.list().limit(10).execute();

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 2);
  }

  @Test
  void testFluentCreateOrUpdate(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    String testName = ns.prefix("fluent_upsert");

    // Create
    TestCase created =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(testName)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .description("Initial")
            .createOrUpdate();

    assertNotNull(created);
    assertEquals("Initial", created.getDescription());

    // Update via createOrUpdate
    TestCase updated =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(testName)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "200")
            .description("Updated")
            .createOrUpdate();

    assertEquals(created.getId(), updated.getId());
    assertEquals("Updated", updated.getDescription());
  }

  @Test
  void testFluentWithDynamicAssertion(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase testCase =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_dynamic"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .useDynamicAssertion(true)
            .execute();

    assertNotNull(testCase);
    assertTrue(testCase.getUseDynamicAssertion());
  }

  @Test
  void testFluentWithComputePassedFailedRows(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase testCase =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_compute"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .computePassedFailedRowCount(true)
            .execute();

    assertNotNull(testCase);
    assertTrue(testCase.getComputePassedFailedRowCount());
  }

  @Test
  void testFluentWithMultipleParameters(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase testCase =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_params"))
            .forTable(table)
            .testDefinition("tableRowCountToBeBetween")
            .parameter("minValue", "10")
            .parameter("maxValue", "100")
            .execute();

    assertNotNull(testCase);
    assertEquals(2, testCase.getParameterValues().size());
  }

  @Test
  void testFluentWithOwners(TestNamespace ns) {
    Table table = createTable(ns);
    SharedEntities shared = SharedEntities.get();

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase testCase =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_owners"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .owners(List.of(shared.USER1_REF))
            .execute();

    assertNotNull(testCase);
    assertNotNull(testCase.getOwners());
    assertEquals(1, testCase.getOwners().size());
  }

  @Test
  void testFluentHardDelete(TestNamespace ns) {
    Table table = createTable(ns);

    org.openmetadata.sdk.fluent.TestCases.setDefaultClient(SdkClients.adminClient());

    TestCase created =
        org.openmetadata.sdk.fluent.TestCases.create()
            .name(ns.prefix("fluent_hard_delete"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .execute();

    // Hard delete via fluent API
    org.openmetadata.sdk.fluent.TestCases.find(created.getId()).delete().permanently().confirm();

    // Verify hard deleted
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(created.getId().toString()),
        "Hard deleted entity should not be retrievable");
  }

  // ===================================================================
  // CSV IMPORT/EXPORT SUPPORT
  // ===================================================================

  protected String generateValidCsvData(TestNamespace ns, List<TestCase> entities) {
    if (entities == null || entities.isEmpty()) {
      return null;
    }

    StringBuilder csv = new StringBuilder();
    csv.append(
        "name,displayName,description,testDefinition,entityFQN,testSuite,parameterValues,computePassedFailedRowCount,useDynamicAssertion,inspectionQuery,tags,glossaryTerms\n");

    for (TestCase testCase : entities) {
      csv.append(escapeCSVValue(testCase.getName())).append(",");
      csv.append(escapeCSVValue(testCase.getDisplayName())).append(",");
      csv.append(escapeCSVValue(testCase.getDescription())).append(",");
      csv.append(
              escapeCSVValue(
                  testCase.getTestDefinition() != null
                      ? testCase.getTestDefinition().getName()
                      : ""))
          .append(",");
      csv.append(escapeCSVValue(testCase.getEntityFQN())).append(",");
      csv.append(
              escapeCSVValue(
                  testCase.getTestSuite() != null
                      ? testCase.getTestSuite().getFullyQualifiedName()
                      : ""))
          .append(",");
      csv.append(escapeCSVValue(formatParameterValuesForCsv(testCase.getParameterValues())))
          .append(",");
      csv.append(
              escapeCSVValue(
                  testCase.getComputePassedFailedRowCount() != null
                      ? testCase.getComputePassedFailedRowCount().toString()
                      : ""))
          .append(",");
      csv.append(
              escapeCSVValue(
                  testCase.getUseDynamicAssertion() != null
                      ? testCase.getUseDynamicAssertion().toString()
                      : ""))
          .append(",");
      csv.append(escapeCSVValue(testCase.getInspectionQuery())).append(",");
      csv.append(escapeCSVValue(formatTagsForCsv(testCase.getTags()))).append(",");
      csv.append(escapeCSVValue("")); // glossaryTerms - not available on TestCase
      csv.append("\n");
    }

    return csv.toString();
  }

  protected String generateInvalidCsvData(TestNamespace ns) {
    StringBuilder csv = new StringBuilder();
    csv.append(
        "name*,displayName,description,testDefinition*,entityFQN*,testSuite,parameterValues,computePassedFailedRowCount,useDynamicAssertion,inspectionQuery,tags,glossaryTerms\n");
    // Missing required name field
    csv.append(",Test Case,Description,,entity.fqn,,,,,,,\n");
    // Missing required testDefinition and entityFQN
    csv.append("invalid_test_case,,,,,,,,,,,\n");
    return csv.toString();
  }

  protected List<String> getRequiredCsvHeaders() {
    return List.of("name*", "testDefinition*", "entityFQN*");
  }

  protected List<String> getAllCsvHeaders() {
    return List.of(
        "name*",
        "displayName",
        "description",
        "testDefinition*",
        "entityFQN*",
        "testSuite",
        "parameterValues",
        "computePassedFailedRowCount",
        "useDynamicAssertion",
        "inspectionQuery",
        "tags",
        "glossaryTerms");
  }

  private String formatParameterValuesForCsv(List<TestCaseParameterValue> parameterValues) {
    if (parameterValues == null || parameterValues.isEmpty()) {
      return "";
    }

    return parameterValues.stream()
        .map(
            param ->
                "{\"name\":\""
                    + param.getName()
                    + "\",\"value\":"
                    + (param.getValue() != null ? "\"" + param.getValue() + "\"" : param.getValue())
                    + "}")
        .reduce((a, b) -> a + ";" + b)
        .orElse("");
  }

  private String formatTagsForCsv(List<org.openmetadata.schema.type.TagLabel> tags) {
    if (tags == null || tags.isEmpty()) {
      return "";
    }
    return tags.stream()
        .map(org.openmetadata.schema.type.TagLabel::getTagFQN)
        .reduce((a, b) -> a + ";" + b)
        .orElse("");
  }

  private String escapeCSVValue(String value) {
    if (value == null) {
      return "";
    }
    if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
      return "\"" + value.replace("\"", "\"\"") + "\"";
    }
    return value;
  }
}
