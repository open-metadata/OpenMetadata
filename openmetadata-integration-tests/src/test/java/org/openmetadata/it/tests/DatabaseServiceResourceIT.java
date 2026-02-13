package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.services.connections.database.ConnectionArguments;
import org.openmetadata.schema.services.connections.database.ConnectionOptions;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.RedshiftConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for DatabaseService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class DatabaseServiceResourceIT
    extends BaseServiceIT<DatabaseService, CreateDatabaseService> {

  {
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected CreateDatabaseService createMinimalRequest(TestNamespace ns) {
    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    return new CreateDatabaseService()
        .withName(ns.prefix("dbservice"))
        .withServiceType(DatabaseServiceType.Postgres)
        .withConnection(new DatabaseConnection().withConfig(conn))
        .withDescription("Test database service");
  }

  @Override
  protected CreateDatabaseService createRequest(String name, TestNamespace ns) {
    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    return new CreateDatabaseService()
        .withName(name)
        .withServiceType(DatabaseServiceType.Postgres)
        .withConnection(new DatabaseConnection().withConfig(conn));
  }

  @Override
  protected DatabaseService createEntity(CreateDatabaseService createRequest) {
    return SdkClients.adminClient().databaseServices().create(createRequest);
  }

  @Override
  protected DatabaseService getEntity(String id) {
    return SdkClients.adminClient().databaseServices().get(id);
  }

  @Override
  protected DatabaseService getEntityByName(String fqn) {
    return SdkClients.adminClient().databaseServices().getByName(fqn);
  }

  @Override
  protected DatabaseService patchEntity(String id, DatabaseService entity) {
    return SdkClients.adminClient().databaseServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().databaseServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().databaseServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().databaseServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "databaseService";
  }

  @Override
  protected void validateCreatedEntity(
      DatabaseService entity, CreateDatabaseService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<DatabaseService> listEntities(ListParams params) {
    return SdkClients.adminClient().databaseServices().list(params);
  }

  @Override
  protected DatabaseService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().databaseServices().get(id, fields);
  }

  @Override
  protected DatabaseService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().databaseServices().getByName(fqn, fields);
  }

  @Override
  protected DatabaseService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().databaseServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().databaseServices().getVersionList(id);
  }

  @Override
  protected DatabaseService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().databaseServices().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DATABASE SERVICE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_databaseServiceWithPostgresConnection_200_OK(TestNamespace ns) {
    PostgresConnection conn =
        new PostgresConnection()
            .withHostPort("localhost:5432")
            .withUsername("test_user")
            .withAuthType(new basicAuth().withPassword("test_password"))
            .withDatabase("test_db");

    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("postgres_service"))
            .withServiceType(DatabaseServiceType.Postgres)
            .withConnection(new DatabaseConnection().withConfig(conn))
            .withDescription("Test Postgres service");

    DatabaseService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DatabaseServiceType.Postgres, service.getServiceType());
  }

  @Test
  void post_databaseServiceWithSnowflakeConnection_200_OK(TestNamespace ns) {
    SnowflakeConnection conn =
        new SnowflakeConnection()
            .withAccount("test-account")
            .withUsername("test_user")
            .withWarehouse("test_warehouse");

    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("snowflake_service"))
            .withServiceType(DatabaseServiceType.Snowflake)
            .withConnection(new DatabaseConnection().withConfig(conn))
            .withDescription("Test Snowflake service");

    DatabaseService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DatabaseServiceType.Snowflake, service.getServiceType());
  }

  @Test
  void post_databaseServiceWithMysqlConnection_200_OK(TestNamespace ns) {
    MysqlConnection conn =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test_user")
            .withAuthType(new basicAuth().withPassword("test_password"));

    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("mysql_service"))
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(new DatabaseConnection().withConfig(conn))
            .withDescription("Test MySQL service");

    DatabaseService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DatabaseServiceType.Mysql, service.getServiceType());
  }

  @Test
  void put_databaseServiceDescription_200_OK(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    DatabaseService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    // Update description
    service.setDescription("Updated description");
    DatabaseService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_databaseServiceVersionHistory(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    DatabaseService service = createEntity(request);
    Double initialVersion = service.getVersion();

    // Update to create new version
    service.setDescription("Updated description");
    DatabaseService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    // Check version history
    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_databaseServiceSoftDeleteRestore(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    DatabaseService service = createEntity(request);
    assertNotNull(service.getId());

    // Soft delete
    deleteEntity(service.getId().toString());

    // Should still be retrievable with include=deleted
    DatabaseService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(service.getId().toString());

    // Should be back to normal
    DatabaseService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_databaseServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateDatabaseService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    DatabaseService service1 = createEntity(request1);
    assertNotNull(service1);

    // Attempt to create duplicate
    CreateDatabaseService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate database service should fail");
  }

  @Test
  void test_listDatabaseServices(TestNamespace ns) {
    // Create multiple services
    for (int i = 0; i < 3; i++) {
      CreateDatabaseService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    // List and verify
    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<DatabaseService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void post_validDatabaseService_as_admin_200_ok(TestNamespace ns) {
    CreateDatabaseService request1 = createMinimalRequest(ns);
    request1.setName(ns.prefix("service_1"));
    request1.setDescription(null);
    DatabaseService service1 = createEntity(request1);
    assertNotNull(service1);
    assertNull(service1.getDescription());

    CreateDatabaseService request2 = createMinimalRequest(ns);
    request2.setName(ns.prefix("service_2"));
    request2.setDescription("Test description");
    DatabaseService service2 = createEntity(request2);
    assertNotNull(service2);
    assertEquals("Test description", service2.getDescription());

    CreateDatabaseService request3 = createMinimalRequest(ns);
    request3.setName(ns.prefix("service_3"));
    request3.setConnection(null);
    DatabaseService service3 = createEntity(request3);
    assertNotNull(service3);
    assertNull(service3.getConnection());
  }

  @Test
  @org.junit.jupiter.api.Disabled(
      "Entity already exists conflict - needs test isolation investigation")
  void put_updateDatabaseService_as_admin_2xx(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("update_service"));
    request.setDescription(null);
    DatabaseService service = createEntity(request);
    assertNull(service.getDescription());

    service.setDescription("Updated description");
    DatabaseService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());

    SnowflakeConnection snowflakeConnection =
        new SnowflakeConnection().withUsername("test").withPassword("test12");
    DatabaseConnection databaseConnection =
        new DatabaseConnection().withConfig(snowflakeConnection);

    CreateDatabaseService updateRequest =
        new CreateDatabaseService()
            .withName(service.getName())
            .withServiceType(DatabaseServiceType.Snowflake)
            .withConnection(databaseConnection);

    DatabaseService updatedService =
        SdkClients.adminClient().databaseServices().create(updateRequest);
    assertNotNull(updatedService.getConnection());

    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions()
            .withAdditionalProperty("key1", "value1")
            .withAdditionalProperty("key2", "value2");
    snowflakeConnection
        .withConnectionArguments(connectionArguments)
        .withConnectionOptions(connectionOptions);

    updatedService.getConnection().setConfig(snowflakeConnection);
    DatabaseService finalService = patchEntity(updatedService.getId().toString(), updatedService);
    assertNotNull(finalService.getConnection());
  }

  @Test
  void post_put_invalidConnection_as_admin_4xx(TestNamespace ns) {
    RedshiftConnection redshiftConnection =
        new RedshiftConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection dbConn = new DatabaseConnection().withConfig(redshiftConnection);

    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("invalid_connection"))
            .withServiceType(DatabaseServiceType.Snowflake)
            .withConnection(dbConn);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating service with mismatched connection type should fail");

    CreateDatabaseService validRequest = createMinimalRequest(ns);
    validRequest.setName(ns.prefix("valid_for_invalid_update"));
    DatabaseService service = createEntity(validRequest);

    MysqlConnection mysqlConnection =
        new MysqlConnection().withHostPort("localhost:3300").withUsername("test");
    DatabaseConnection invalidConnection = new DatabaseConnection().withConfig(mysqlConnection);
    service.setConnection(invalidConnection);

    DatabaseService finalService = service;
    assertThrows(
        Exception.class,
        () -> patchEntity(finalService.getId().toString(), finalService),
        "Updating service with incompatible connection type should fail");
  }

  @Test
  void put_testConnectionResult_200(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("test_connection_result"));
    DatabaseService service = createEntity(request);
    assertNull(service.getTestConnectionResult());

    TestConnectionResult testResult =
        new TestConnectionResult()
            .withStatus(TestConnectionResultStatus.SUCCESSFUL)
            .withLastUpdatedAt(System.currentTimeMillis());

    // Use dedicated SDK method for adding test connection result
    DatabaseService updated =
        SdkClients.adminClient()
            .databaseServices()
            .addTestConnectionResult(service.getId(), testResult);

    assertNotNull(updated.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, updated.getTestConnectionResult().getStatus());

    // testConnectionResult requires explicit field request
    DatabaseService storedService =
        getEntityWithFields(service.getId().toString(), "testConnectionResult");
    assertNotNull(
        storedService.getTestConnectionResult(), "Test connection result should be persisted");
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, storedService.getTestConnectionResult().getStatus());
  }

  @Test
  void test_importExportRecursive_withColumnTagsAndGlossaryTerms(TestNamespace ns)
      throws IOException, InterruptedException {
    String serviceName = ns.prefix("import_export_recursive_tags_service");

    DatabaseService service = createEntity(createMinimalRequest(ns).withName(serviceName));

    Database database =
        SdkClients.adminClient()
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.prefix("db1"))
                    .withService(service.getFullyQualifiedName()));

    DatabaseSchema schema =
        SdkClients.adminClient()
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.prefix("schema1"))
                    .withDatabase(database.getFullyQualifiedName())
                    .withDescription("Test schema for column tags"));

    Column column1 =
        new Column()
            .withName("sensitive_column")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(255)
            .withDescription("Column with PII tag");

    Column column2 =
        new Column()
            .withName("business_column")
            .withDataType(ColumnDataType.INT)
            .withDescription("Column with glossary term");

    Column nestedColumn =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(
                List.of(
                    new Column()
                        .withName("street")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)
                        .withDescription("Street address - should get tags")));

    Table table =
        SdkClients.adminClient()
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("test_table"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(List.of(column1, column2, nestedColumn))
                    .withDescription("Test table for column tags and glossary terms"));

    SharedEntities shared = SharedEntities.get();

    String exportedCsv = exportCsvRecursive(service.getFullyQualifiedName());
    assertNotNull(exportedCsv);
    assertTrue(
        exportedCsv.contains("sensitive_column"), "Exported CSV should contain column names");
    assertTrue(exportedCsv.contains("business_column"), "Exported CSV should contain column names");
    assertTrue(
        exportedCsv.contains("address.street"), "Exported CSV should contain nested column names");

    String[] lines = exportedCsv.split("\n");
    String header = lines[0];
    StringBuilder modifiedCsv = new StringBuilder();
    modifiedCsv.append(header).append("\n");

    for (int i = 1; i < lines.length; i++) {
      String line = lines[i];
      if (line.contains("sensitive_column") && line.contains("column")) {
        line = addColumnTags(line, shared.PERSONAL_DATA_TAG_LABEL.getTagFQN());
      } else if (line.contains("business_column") && line.contains("column")) {
        line = addColumnGlossaryTerms(line, shared.GLOSSARY1_TERM1_LABEL.getTagFQN());
      } else if (line.contains("address.street") && line.contains("column")) {
        line = addColumnTags(line, shared.PERSONAL_DATA_TAG_LABEL.getTagFQN());
        line = addColumnGlossaryTerms(line, shared.GLOSSARY1_TERM1_LABEL.getTagFQN());
      }
      modifiedCsv.append(line).append("\n");
    }

    CsvImportResult result =
        importCsvRecursive(service.getFullyQualifiedName(), modifiedCsv.toString(), false);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns,tags");
    assertNotNull(updatedTable);
    assertNotNull(updatedTable.getColumns());

    Column sensitiveColumn =
        updatedTable.getColumns().stream()
            .filter(c -> "sensitive_column".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(sensitiveColumn, "Sensitive column should exist");
    assertNotNull(sensitiveColumn.getTags(), "Sensitive column should have tags");
    assertTrue(
        sensitiveColumn.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().contains("PersonalData")),
        "Sensitive column should have PersonalData tag");

    Column businessColumn =
        updatedTable.getColumns().stream()
            .filter(c -> "business_column".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(businessColumn, "Business column should exist");
    assertNotNull(businessColumn.getTags(), "Business column should have tags");
    assertTrue(
        businessColumn.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY),
        "Business column should have glossary term");

    Column addressColumn =
        updatedTable.getColumns().stream()
            .filter(c -> "address".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(addressColumn, "Address column should exist");
    assertNotNull(addressColumn.getChildren(), "Address column should have children");

    Column streetColumn =
        addressColumn.getChildren().stream()
            .filter(c -> "street".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(streetColumn, "Street nested column should exist");
    assertNotNull(streetColumn.getTags(), "Street nested column should have tags");
    assertTrue(
        streetColumn.getTags().stream().anyMatch(tag -> tag.getTagFQN().contains("PersonalData")),
        "Street nested column should have PersonalData tag");
    assertTrue(
        streetColumn.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY),
        "Street nested column should have glossary term");
  }

  private String addColumnTags(String csvLine, String tagFQN) {
    String[] parts = csvLine.split(",");
    if (parts.length >= 5) {
      if (parts[4] == null || parts[4].trim().isEmpty() || parts[4].equals("\"\"")) {
        parts[4] = "\"" + tagFQN + "\"";
      } else {
        String existingTags = parts[4].replaceAll("\"", "");
        parts[4] = "\"" + existingTags + ";" + tagFQN + "\"";
      }
    }
    return String.join(",", parts);
  }

  private String addColumnGlossaryTerms(String csvLine, String glossaryTermFQN) {
    String[] parts = csvLine.split(",");
    if (parts.length >= 6) {
      if (parts[5] == null || parts[5].trim().isEmpty() || parts[5].equals("\"\"")) {
        parts[5] = "\"" + glossaryTermFQN + "\"";
      } else {
        String existingTerms = parts[5].replaceAll("\"", "");
        parts[5] = "\"" + existingTerms + ";" + glossaryTermFQN + "\"";
      }
    }
    return String.join(",", parts);
  }

  private String exportCsvRecursive(String entityName) throws IOException, InterruptedException {
    String serverUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpClient client = HttpClient.newHttpClient();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    serverUrl
                        + "/v1/services/databaseServices/name/"
                        + entityName
                        + "/export?recursive=true"))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .GET()
            .build();

    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      throw new RuntimeException(
          "Failed to export CSV. Status: " + response.statusCode() + ", Body: " + response.body());
    }

    return response.body();
  }

  private CsvImportResult importCsvRecursive(String entityName, String csvData, boolean dryRun)
      throws IOException, InterruptedException {
    String serverUrl = SdkClients.getServerUrl();
    String token = SdkClients.getAdminToken();

    HttpClient client = HttpClient.newHttpClient();
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    serverUrl
                        + "/v1/services/databaseServices/name/"
                        + entityName
                        + "/import?recursive=true&dryRun="
                        + dryRun))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "text/plain")
            .PUT(HttpRequest.BodyPublishers.ofString(csvData))
            .build();

    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      throw new RuntimeException(
          "Failed to import CSV. Status: " + response.statusCode() + ", Body: " + response.body());
    }

    try {
      com.fasterxml.jackson.databind.ObjectMapper mapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      return mapper.readValue(response.body(), CsvImportResult.class);
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse import result: " + e.getMessage(), e);
    }
  }
}
