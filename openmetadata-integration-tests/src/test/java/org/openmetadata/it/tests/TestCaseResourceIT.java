package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
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

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase"));
    request.setDescription("Test case created by integration test");
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    return request;
  }

  @Override
  protected CreateTestCase createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    Table table = createTable(client, ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(name);
    request.setDescription("Test case");
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    return request;
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

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_with_params"));
    request.setDescription("Test case with parameters");
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("1000")));

    TestCase testCase = createEntity(request, client);
    assertNotNull(testCase);
    assertNotNull(testCase.getParameterValues());
  }

  @Test
  void put_testCaseDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(client, ns);

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_update_desc"));
    request.setDescription("Initial description");
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    TestCase testCase = createEntity(request, client);
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

    CreateTestCase request = new CreateTestCase();
    request.setName(ns.prefix("testcase_table_link"));
    request.setDescription("Test case linked to table");
    request.setEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">");
    request.setTestDefinition("tableRowCountToEqual");
    request.setParameterValues(
        List.of(new TestCaseParameterValue().withName("value").withValue("100")));

    TestCase testCase = createEntity(request, client);
    assertNotNull(testCase);
    assertNotNull(testCase.getEntityLink());
    assertTrue(testCase.getEntityLink().contains(table.getFullyQualifiedName()));
  }
}
