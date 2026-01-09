package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
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
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;

/**
 * Integration tests for DatabaseService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class DatabaseServiceResourceIT
    extends BaseServiceIT<DatabaseService, CreateDatabaseService> {

  // Enable CSV import/export testing for database services
  {
    supportsImportExport = true;
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
  // CSV IMPORT/EXPORT SUPPORT METHODS
  // ===================================================================

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<DatabaseService> getEntityService() {
    return SdkClients.adminClient().databaseServices();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    // For database services, the container is the service's FQN.
    // The base class tests need a service to exist, so we create one with a test-specific name.
    String serviceName = ns.prefix("test-db-service");
    try {
      // Check if service already exists
      DatabaseService existing = getEntityByName(serviceName);
      return existing.getFullyQualifiedName();
    } catch (Exception e) {
      // Service doesn't exist, create it
      DatabaseService service = createEntity(createRequest(serviceName, ns));
      return service.getFullyQualifiedName();
    }
  }

  /**
   * Get CSV headers for database service import/export.
   * Uses DatabaseServiceRepository.DatabaseServiceCsv to get proper headers.
   */
  private List<CsvHeader> getDatabaseServiceCsvHeaders(DatabaseService service, boolean recursive) {
    return new DatabaseServiceRepository.DatabaseServiceCsv(service, "admin", recursive).HEADERS;
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
  void test_csvImportCreate(TestNamespace ns) throws Exception {
    DatabaseService service = createEntity(createRequest(ns.prefix("csv-import-create"), ns));

    // Create CSV records for initial import (these should be marked as ENTITY_CREATED)
    // Headers:
    // name,displayName,description,owner,tags,glossaryTerms,tiers,certification,domains,extension
    List<String> createRecords =
        listOf(
            ns.prefix("db1") + ",Display DB 1,Description for db1,,,,,,,",
            ns.prefix("db2") + ",Display DB 2,Description for db2,,,,,,,");

    String csv = createCsv(getDatabaseServiceCsvHeaders(service, false), createRecords, null);

    // Import CSV and verify all records are marked as created
    CsvImportResult result = importCsv(service.getFullyQualifiedName(), csv, false);
    assertSummary(result, ApiStatus.SUCCESS, 3, 3, 0); // 3 = header + 2 records

    // Verify the result contains "Entity created" status for all records
    String[] resultLines = result.getImportResultsCsv().split(CsvUtil.LINE_SEPARATOR);
    for (int i = 1; i < resultLines.length; i++) { // Skip header
      assertTrue(
          resultLines[i].contains(EntityCsv.ENTITY_CREATED),
          "Record " + i + " should be marked as created: " + resultLines[i]);
      // Verify changeDescription is present
      assertTrue(
          resultLines[i].contains("fieldsAdded"),
          "Record " + i + " should have changeDescription: " + resultLines[i]);
    }
  }

  @Test
  void test_csvImportUpdate(TestNamespace ns) throws Exception {
    DatabaseService service = createEntity(createRequest(ns.prefix("csv-import-update"), ns));

    // First, create the databases via CSV import to establish baseline
    // Headers:
    // name,displayName,description,owner,tags,glossaryTerms,tiers,certification,domains,extension
    List<String> createRecords =
        listOf(
            ns.prefix("db1") + ",Display DB 1,Initial description 1,,,,,,,",
            ns.prefix("db2") + ",Display DB 2,Initial description 2,,,,,,,");

    String createCsv = createCsv(getDatabaseServiceCsvHeaders(service, false), createRecords, null);
    importCsv(service.getFullyQualifiedName(), createCsv, false);

    // Now update the same databases (these should be marked as ENTITY_UPDATED)
    List<String> updateRecords =
        listOf(
            ns.prefix("db1") + ",Updated Display 1,Updated description 1,,,,,,,",
            ns.prefix("db2") + ",Updated Display 2,Updated description 2,,,,,,,");

    String updateCsv = createCsv(getDatabaseServiceCsvHeaders(service, false), updateRecords, null);

    // Import updated CSV and verify all records are marked as updated
    CsvImportResult result = importCsv(service.getFullyQualifiedName(), updateCsv, false);
    assertSummary(result, ApiStatus.SUCCESS, 3, 3, 0); // 3 = header + 2 records

    // Verify the result contains "Entity updated" status for all records
    String[] resultLines = result.getImportResultsCsv().split(CsvUtil.LINE_SEPARATOR);
    for (int i = 1; i < resultLines.length; i++) { // Skip header
      assertTrue(
          resultLines[i].contains(EntityCsv.ENTITY_UPDATED),
          "Record " + i + " should be marked as updated: " + resultLines[i]);
      // Verify changeDescription is present and contains fieldsUpdated
      assertTrue(
          resultLines[i].contains("fieldsUpdated"),
          "Record " + i + " should have fieldsUpdated in changeDescription: " + resultLines[i]);
    }
  }

  @Test
  void test_csvImportRecursiveCreate(TestNamespace ns) throws Exception {
    DatabaseService service = createEntity(createRequest(ns.prefix("csv-import-rec-create"), ns));

    // Create CSV records for recursive import (these should be marked as ENTITY_CREATED)
    // Headers:
    // name*,displayName,description,owner,tags,glossaryTerms,tiers,certification,retentionPeriod,sourceUrl,domains,extension,entityType*,fullyQualifiedName
    List<String> createRecords =
        listOf(
            ns.prefix("db1")
                + ",Display DB,Description for db,,,,,,,,,,database,"
                + service.getFullyQualifiedName()
                + "."
                + ns.prefix("db1"),
            ns.prefix("schema1")
                + ",Display Schema,Description for schema,,,,,,,,,,databaseSchema,"
                + service.getFullyQualifiedName()
                + "."
                + ns.prefix("db1")
                + "."
                + ns.prefix("schema1"));

    // Get recursive headers and create CSV
    String csv = createCsv(getDatabaseServiceCsvHeaders(service, true), createRecords, null);

    // Import CSV recursively and verify all records are marked as created
    CsvImportResult result = importCsvRecursive(service.getFullyQualifiedName(), csv, false);
    assertSummary(result, ApiStatus.SUCCESS, 3, 3, 0); // 3 = header + 2 records

    // Verify the result contains "Entity created" status for all records
    String[] resultLines = result.getImportResultsCsv().split(CsvUtil.LINE_SEPARATOR);
    for (int i = 1; i < resultLines.length; i++) { // Skip header
      assertTrue(
          resultLines[i].contains(EntityCsv.ENTITY_CREATED),
          "Record " + i + " should be marked as created: " + resultLines[i]);
      // Verify changeDescription is present
      assertTrue(
          resultLines[i].contains("fieldsAdded"),
          "Record " + i + " should have changeDescription: " + resultLines[i]);
    }
  }

  @Test
  void test_csvImportRecursiveUpdate(TestNamespace ns) throws Exception {
    DatabaseService service = createEntity(createRequest(ns.prefix("csv-import-rec-update"), ns));

    // First import to create entities via CSV
    // Headers:
    // name*,displayName,description,owner,tags,glossaryTerms,tiers,certification,retentionPeriod,sourceUrl,domains,extension,entityType*,fullyQualifiedName
    List<String> createRecords =
        listOf(
            ns.prefix("db1")
                + ",Display DB,Initial db description,,,,,,,,,,database,"
                + service.getFullyQualifiedName()
                + "."
                + ns.prefix("db1"),
            ns.prefix("schema1")
                + ",Display Schema,Initial schema description,,,,,,,,,,databaseSchema,"
                + service.getFullyQualifiedName()
                + "."
                + ns.prefix("db1")
                + "."
                + ns.prefix("schema1"));

    String createCsv = createCsv(getDatabaseServiceCsvHeaders(service, true), createRecords, null);
    importCsvRecursive(service.getFullyQualifiedName(), createCsv, false);

    // Now update the same entities recursively (these should be marked as ENTITY_UPDATED)
    List<String> updateRecords =
        listOf(
            ns.prefix("db1")
                + ",Updated DB,Updated db description,,,,,,,,,,database,"
                + service.getFullyQualifiedName()
                + "."
                + ns.prefix("db1"),
            ns.prefix("schema1")
                + ",Updated Schema,Updated schema description,,,,,,,,,,databaseSchema,"
                + service.getFullyQualifiedName()
                + "."
                + ns.prefix("db1")
                + "."
                + ns.prefix("schema1"));

    String updateCsv = createCsv(getDatabaseServiceCsvHeaders(service, true), updateRecords, null);

    // Import updated CSV recursively and verify all records are marked as updated
    CsvImportResult result = importCsvRecursive(service.getFullyQualifiedName(), updateCsv, false);
    assertSummary(result, ApiStatus.SUCCESS, 3, 3, 0); // 3 = header + 2 records

    // Verify the result contains "Entity updated" status for all records
    String[] resultLines = result.getImportResultsCsv().split(CsvUtil.LINE_SEPARATOR);
    for (int i = 1; i < resultLines.length; i++) { // Skip header
      assertTrue(
          resultLines[i].contains(EntityCsv.ENTITY_UPDATED),
          "Record " + i + " should be marked as updated: " + resultLines[i]);
      // Verify changeDescription is present and contains fieldsUpdated
      assertTrue(
          resultLines[i].contains("fieldsUpdated"),
          "Record " + i + " should have fieldsUpdated in changeDescription: " + resultLines[i]);
    }
  }
}
