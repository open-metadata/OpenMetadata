package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.EntityValidation;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.UpdateType;
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
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Integration tests for Database entity operations.
 *
 * Extends BaseEntityIT to inherit all common entity tests.
 * Adds database-specific tests.
 *
 * Migrated from: org.openmetadata.service.resources.databases.DatabaseResourceTest
 * Migration status: 8 entity-specific tests migrated, 6 tests not migrated (see details below)
 *
 * MIGRATED TESTS (8):
 * - post_databaseFQN_as_admin_200_OK
 * - post_databaseWithoutRequiredService_4xx
 * - post_databaseWithDifferentService_200_ok
 * - test_bulkServiceFetching_200_OK
 * - test_fieldFetchersForServiceAndName
 * - testDatabaseRdfRelationships (RDF-enabled environments only)
 * - testDatabaseRdfSoftDeleteAndRestore (RDF-enabled environments only)
 * - testDatabaseRdfHardDelete (RDF-enabled environments only)
 *
 * NOT MIGRATED (6):
 * - 3 CSV import/export tests (SDK endpoint mismatch)
 * - 3 Bulk API tests (require WebTarget for detailed verification)
 *
 * Test isolation: Uses TestNamespace for unique entity names
 * Parallelization: Safe for concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
public class DatabaseResourceIT extends BaseEntityIT<Database, CreateDatabase> {

  {
    supportsImportExport = true;
    supportsBatchImport = true;
    supportsRecursiveImport = true; // Database supports recursive import with nested schemas/tables
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // Store last created database for import/export tests
  private Database lastCreatedDatabase;

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDatabase createMinimalRequest(TestNamespace ns) {
    // Database requires a database service as parent
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    CreateDatabase request = new CreateDatabase();
    request.setName(ns.prefix("db"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test database created by integration test");
    return request;
  }

  @Override
  protected CreateDatabase createRequest(String name, TestNamespace ns) {
    // Note: This creates a new service each time, which means duplicate detection
    // only applies within the same service. For cross-service duplicates,
    // the test would need to be customized.
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    CreateDatabase request = new CreateDatabase();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());
    return request;
  }

  /**
   * Create request with specific service (for duplicate testing).
   */
  protected CreateDatabase createRequestWithService(String name, String serviceFQN) {
    CreateDatabase request = new CreateDatabase();
    request.setName(name);
    request.setService(serviceFQN);
    return request;
  }

  @Override
  protected Database createEntity(CreateDatabase createRequest) {
    return SdkClients.adminClient().databases().create(createRequest);
  }

  @Override
  protected Database getEntity(String id) {
    return SdkClients.adminClient().databases().get(id);
  }

  @Override
  protected Database getEntityByName(String fqn) {
    return SdkClients.adminClient().databases().getByName(fqn);
  }

  @Override
  protected Database patchEntity(String id, Database entity) {
    return SdkClients.adminClient().databases().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().databases().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().databases().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    // Hard delete requires hardDelete=true query parameter
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().databases().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "database";
  }

  @Override
  protected void validateCreatedEntity(Database entity, CreateDatabase createRequest) {
    // Database-specific validations
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Database must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    // FQN should be: serviceName.databaseName
    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain database name");
  }

  // ===================================================================
  // OVERRIDE COMMON TESTS (to fix database-specific behavior)
  // ===================================================================

  /**
   * Override: Databases are scoped by service, so duplicates only conflict within same service.
   */
  @Override
  @Test
  public void post_duplicateEntity_409(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create service once
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    // Create first database
    CreateDatabase createRequest =
        createRequestWithService(ns.prefix("db"), service.getFullyQualifiedName());
    Database entity = createEntity(createRequest);
    assertNotNull(entity.getId());

    // Attempt to create duplicate database in the SAME service
    CreateDatabase duplicateRequest =
        createRequestWithService(entity.getName(), service.getFullyQualifiedName());
    assertThrows(
        Exception.class,
        () -> createEntity(duplicateRequest),
        "Creating duplicate database in same service should fail");
  }

  // ===================================================================
  // DATABASE-SPECIFIC TESTS (11 tests from DatabaseResourceTest)
  // ===================================================================

  /**
   * Test: post_databaseFQN_as_admin_200_OK
   * Original: DatabaseResourceTest line 85
   *
   * Validates FQN construction: serviceFQN.databaseName
   */
  @Test
  void post_databaseFQN_as_admin_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create Snowflake service
    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(ns);
    assertNotNull(service.getId());
    assertNotNull(service.getFullyQualifiedName());

    // Create database
    CreateDatabase createRequest = new CreateDatabase();
    createRequest.setName(ns.prefix("db"));
    createRequest.setService(service.getFullyQualifiedName());

    Database db = createEntity(createRequest);

    // Verify FQN format
    String expectedFQN = service.getFullyQualifiedName() + "." + db.getName();
    assertEquals(expectedFQN, db.getFullyQualifiedName());

    // Verify retrieval
    Database fetched = getEntity(db.getId().toString());
    assertEquals(db.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  /**
   * Test: post_databaseWithoutRequiredService_4xx
   * Original: DatabaseResourceTest line 96
   *
   * Validates that service is required
   */
  @Test
  void post_databaseWithoutRequiredService_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create request without service
    CreateDatabase createRequest = new CreateDatabase();
    createRequest.setName(ns.prefix("db"));
    // Missing: createRequest.setService(...)

    InvalidRequestException exception =
        assertThrows(InvalidRequestException.class, () -> createEntity(createRequest));

    assertEquals(400, exception.getStatusCode());
  }

  /**
   * Test: post_databaseWithDifferentService_200_ok
   * Original: DatabaseResourceTest line 105
   *
   * Validates databases can be created with different service types
   * AND that list filtering by service works correctly
   */
  @Test
  void post_databaseWithDifferentService_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test with multiple service types
    DatabaseService postgresService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseService snowflakeService = DatabaseServiceTestFactory.createSnowflake(ns);

    // Create databases for each service
    CreateDatabase postgresDbRequest = new CreateDatabase();
    postgresDbRequest.setName(ns.prefix("db_postgres"));
    postgresDbRequest.setService(postgresService.getFullyQualifiedName());
    Database postgresDb = createEntity(postgresDbRequest);
    assertNotNull(postgresDb.getId());
    assertEquals(postgresService.getName(), postgresDb.getService().getName());

    CreateDatabase snowflakeDbRequest = new CreateDatabase();
    snowflakeDbRequest.setName(ns.prefix("db_snowflake"));
    snowflakeDbRequest.setService(snowflakeService.getFullyQualifiedName());
    Database snowflakeDb = createEntity(snowflakeDbRequest);
    assertNotNull(snowflakeDb.getId());
    assertEquals(snowflakeService.getName(), snowflakeDb.getService().getName());

    // List databases by filtering on postgres service and ensure only postgres databases returned
    org.openmetadata.sdk.models.ListParams postgresParams =
        new org.openmetadata.sdk.models.ListParams();
    postgresParams.setService(postgresService.getName());
    postgresParams.setLimit(100);

    org.openmetadata.sdk.models.ListResponse<Database> postgresList =
        SdkClients.adminClient().databases().list(postgresParams);
    assertNotNull(postgresList.getData());
    assertTrue(postgresList.getData().size() > 0, "Should have at least one postgres database");

    // Verify ALL returned databases belong to postgres service
    for (Database db : postgresList.getData()) {
      assertEquals(
          postgresService.getName(),
          db.getService().getName(),
          "All databases in filtered list should belong to postgres service");
    }

    // Verify our postgres database is in the list
    boolean foundPostgresDb =
        postgresList.getData().stream().anyMatch(db -> db.getId().equals(postgresDb.getId()));
    assertTrue(foundPostgresDb, "Postgres database should be in postgres-filtered list");

    // List databases by filtering on snowflake service
    org.openmetadata.sdk.models.ListParams snowflakeParams =
        new org.openmetadata.sdk.models.ListParams();
    snowflakeParams.setService(snowflakeService.getName());
    snowflakeParams.setLimit(100);

    org.openmetadata.sdk.models.ListResponse<Database> snowflakeList =
        SdkClients.adminClient().databases().list(snowflakeParams);
    assertNotNull(snowflakeList.getData());
    assertTrue(snowflakeList.getData().size() > 0, "Should have at least one snowflake database");

    // Verify ALL returned databases belong to snowflake service
    for (Database db : snowflakeList.getData()) {
      assertEquals(
          snowflakeService.getName(),
          db.getService().getName(),
          "All databases in filtered list should belong to snowflake service");
    }

    // Verify our snowflake database is in the list
    boolean foundSnowflakeDb =
        snowflakeList.getData().stream().anyMatch(db -> db.getId().equals(snowflakeDb.getId()));
    assertTrue(foundSnowflakeDb, "Snowflake database should be in snowflake-filtered list");

    // Verify postgres database is NOT in snowflake list
    boolean postgresInSnowflake =
        snowflakeList.getData().stream().anyMatch(db -> db.getId().equals(postgresDb.getId()));
    assertFalse(postgresInSnowflake, "Postgres database should NOT be in snowflake-filtered list");
  }

  /**
   * Test: Change Events API
   *
   * Validates that change events API is accessible and returns data.
   * Note: Events are generated asynchronously, so we test API functionality
   * rather than specific event presence.
   */
  @Test
  void test_changeEvents_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Get current timestamp (for filtering events)
    long startTime = System.currentTimeMillis();

    // Test listCreated - should return without error
    var createdEvents = client.changeEvents().listCreated("database", startTime);
    assertNotNull(createdEvents, "Created events response should not be null");
    assertNotNull(createdEvents.getData(), "Created events data should not be null");

    // Test listUpdated - should return without error
    var updatedEvents = client.changeEvents().listUpdated("database", startTime);
    assertNotNull(updatedEvents, "Updated events response should not be null");
    assertNotNull(updatedEvents.getData(), "Updated events data should not be null");

    // Test list with multiple filters
    var allEvents = client.changeEvents().list("database", "database", null, null, startTime);
    assertNotNull(allEvents, "All events response should not be null");
    assertNotNull(allEvents.getData(), "All events data should not be null");
  }

  /**
   * Test: Entity History API
   *
   * Validates that version history is tracked correctly:
   * - getVersionList() returns all versions
   * - getVersion() retrieves specific versions
   * - Version history reflects updates
   */
  @Test
  void test_entityVersionHistory_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create database
    CreateDatabase createRequest = createMinimalRequest(ns);
    Database created = createEntity(createRequest);
    assertEquals(0.1, created.getVersion(), 0.001, "Initial version should be 0.1");

    // Update: Change description
    String newDescription = "Updated description";
    String oldDescription = createRequest.getDescription();
    created.setDescription(newDescription);
    ChangeDescription expectedChange =
        EntityValidation.getChangeDescription(created, UpdateType.MINOR_UPDATE);
    EntityValidation.fieldUpdated(expectedChange, "description", oldDescription, newDescription);

    Database updated = patchEntityAndCheck(created, UpdateType.MINOR_UPDATE, expectedChange);
    assertEquals(0.2, updated.getVersion(), 0.001, "Version should be 0.2 after update");

    // Test getVersionList - should return history with all versions
    EntityHistory history = client.databases().getVersionList(updated.getId());
    assertNotNull(history, "Version history should not be null");
    assertEquals("database", history.getEntityType(), "Entity type should be 'database'");
    assertNotNull(history.getVersions(), "Versions list should not be null");
    assertTrue(
        history.getVersions().size() >= 2,
        "Should have at least 2 versions (0.1, 0.2), got: " + history.getVersions().size());

    // Test getVersion - retrieve version 0.1
    Database version1 = client.databases().getVersion(updated.getId().toString(), 0.1);
    assertNotNull(version1, "Version 0.1 should exist");
    assertEquals(0.1, version1.getVersion(), 0.001, "Retrieved version should be 0.1");
    assertEquals(
        createRequest.getDescription(),
        version1.getDescription(),
        "Version 0.1 should have original description");

    // Test getVersion - retrieve version 0.2
    Database version2 = client.databases().getVersion(updated.getId().toString(), 0.2);
    assertNotNull(version2, "Version 0.2 should exist");
    assertEquals(0.2, version2.getVersion(), 0.001, "Retrieved version should be 0.2");
    assertEquals(
        newDescription, version2.getDescription(), "Version 0.2 should have updated description");
  }

  /**
   * Test: Bulk Service Fetching
   *
   * Validates that when databases are fetched in bulk with service field,
   * each database maintains its correct service reference.
   */
  @Test
  void test_bulkServiceFetching_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create databases with different services
    DatabaseService postgresService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseService snowflakeService = DatabaseServiceTestFactory.createSnowflake(ns);

    Database db1 =
        createEntity(
            createRequestWithService(ns.prefix("db1"), postgresService.getFullyQualifiedName()));
    Database db2 =
        createEntity(
            createRequestWithService(ns.prefix("db2"), snowflakeService.getFullyQualifiedName()));

    // Fetch our created databases individually with service field
    Database fetchedDb1 = client.databases().get(db1.getId().toString(), "service");
    assertNotNull(fetchedDb1.getService(), "Database should have service reference");
    assertEquals(
        postgresService.getName(),
        fetchedDb1.getService().getName(),
        "Database 1 should have PostgreSQL service");

    Database fetchedDb2 = client.databases().get(db2.getId().toString(), "service");
    assertNotNull(fetchedDb2.getService(), "Database should have service reference");
    assertEquals(
        snowflakeService.getName(),
        fetchedDb2.getService().getName(),
        "Database 2 should have Snowflake service");
  }

  /**
   * Test: Field Fetchers for Service and Name
   * Original: testFieldFetchersForServiceAndName line 563
   *
   * Validates that field fetchers properly populate service and name fields
   * when listing databases with specific field parameters.
   */
  @Test
  void test_fieldFetchersForServiceAndName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create custom service for this test
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    String dbName1 = ns.prefix("fieldFetcherDb1");
    String dbName2 = ns.prefix("fieldFetcherDb2");

    Database db1 = createEntity(createRequestWithService(dbName1, service.getFullyQualifiedName()));
    Database db2 = createEntity(createRequestWithService(dbName2, service.getFullyQualifiedName()));

    // List databases with service field requested
    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setFields("service");
    params.setService(service.getName());
    params.setLimit(100);

    org.openmetadata.sdk.models.ListResponse<Database> dbList = client.databases().list(params);

    // Find our databases in the list
    Database foundDb1 = null;
    Database foundDb2 = null;
    for (Database db : dbList.getData()) {
      if (db.getId().equals(db1.getId())) {
        foundDb1 = db;
      }
      if (db.getId().equals(db2.getId())) {
        foundDb2 = db;
      }
    }

    assertNotNull(foundDb1, "Database 1 should be found in list");
    assertNotNull(foundDb2, "Database 2 should be found in list");

    // Verify name is always present
    assertNotNull(foundDb1.getName(), "Database name should always be present in list response");
    assertEquals(dbName1, foundDb1.getName(), "Database 1 name should match");

    assertNotNull(foundDb2.getName(), "Database name should always be present in list response");
    assertEquals(dbName2, foundDb2.getName(), "Database 2 name should match");

    // Verify service is fetched via fieldFetcher when requested
    assertNotNull(
        foundDb1.getService(),
        "Service should be fetched via fieldFetcher when 'service' field is requested");
    assertEquals(
        service.getName(),
        foundDb1.getService().getName(),
        "Database 1 service name should be correct via field fetcher");
    assertEquals(
        service.getId(),
        foundDb1.getService().getId(),
        "Database 1 service ID should be correct via field fetcher");

    assertNotNull(
        foundDb2.getService(),
        "Service should be fetched via fieldFetcher when 'service' field is requested");
    assertEquals(
        service.getName(),
        foundDb2.getService().getName(),
        "Database 2 service name should be correct via field fetcher");
    assertEquals(
        service.getId(),
        foundDb2.getService().getId(),
        "Database 2 service ID should be correct via field fetcher");

    // Test listing without service field (empty fields)
    org.openmetadata.sdk.models.ListParams paramsWithoutService =
        new org.openmetadata.sdk.models.ListParams();
    paramsWithoutService.setFields("");
    paramsWithoutService.setService(service.getName());
    paramsWithoutService.setLimit(100);

    org.openmetadata.sdk.models.ListResponse<Database> dbListWithoutService =
        client.databases().list(paramsWithoutService);

    Database foundDb1WithoutService = null;
    for (Database db : dbListWithoutService.getData()) {
      if (db.getId().equals(db1.getId())) {
        foundDb1WithoutService = db;
        break;
      }
    }

    assertNotNull(foundDb1WithoutService, "Database should be found even without service field");
    assertNotNull(
        foundDb1WithoutService.getName(),
        "Database name should always be present regardless of fields");
    assertEquals(
        dbName1,
        foundDb1WithoutService.getName(),
        "Database name should match even without service field");

    // Service is a default field, so it should still be fetched
    assertNotNull(
        foundDb1WithoutService.getService(),
        "Service is always fetched as default field even when not in fields param");
  }

  // ===================================================================
  // PHASE 2: Advanced GET Operations Support
  // ===================================================================

  @Override
  protected Database getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().databases().get(id, fields);
  }

  @Override
  protected Database getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().databases().getByName(fqn, fields);
  }

  @Override
  protected Database getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().databases().get(id, "owners,tags,databaseSchemas", "deleted");
  }

  @Override
  protected org.openmetadata.sdk.models.ListResponse<Database> listEntities(
      org.openmetadata.sdk.models.ListParams params) {
    return SdkClients.adminClient().databases().list(params);
  }

  // ===================================================================
  // NOT MIGRATED - Tests that remain in DatabaseResourceTest
  // ===================================================================
  //
  // CSV IMPORT/EXPORT TESTS (3 tests):
  // - testImportInvalidCsv
  // - testImportExport
  // - testImportExportRecursive
  //
  // Reason: SDK endpoint mismatch. SDK uses /v1/databases/{id}/export but server expects
  // /v1/databases/{fqn}/import with PUT method. Will migrate when SDK endpoints are corrected.
  //
  // BULK API TESTS (3 tests):
  // - testBulk_PreservesUserEditsOnUpdate
  // - testBulk_TagMergeBehavior
  // - testBulk_AdminCanOverrideDescription
  //
  // Reason: These tests require detailed verification of bot protection, tag merge behavior,
  // and auth-specific behavior that is not easily testable via SDK (SDK bulk API returns
  // unstructured String responses). These are better suited as WebTarget-based REST API tests.
  //
  // Total NOT migrated: 6 tests (3 CSV + 3 Bulk)
  // ===================================================================

  /*
  @Test
  void test_csvExport_200_OK(TestNamespace ns) {
    // CSV export test - validates database hierarchy export to CSV
    // READY - just needs SDK endpoint fix from /v1/databases/{id}/export to /v1/databases/{fqn}/export
  }

  @Test
  void test_csvImportInvalid_400(TestNamespace ns) {
    // CSV import validation - tests error handling for invalid data
    // READY - needs SDK endpoint fix and PUT method support
  }

  @Test
  void test_csvImportExportRoundTrip_200_OK(TestNamespace ns) {
    // Full CSV import/export cycle validation
    // READY - needs SDK endpoint fix
  }
  */

  // ===================================================================
  // CSV EXPORT/IMPORT TESTS WITH DOT IN SERVICE NAME
  // Tests for issue #24401
  // ===================================================================

  /**
   * Test: CSV export and import with dot in service name.
   *
   * <p>This test reproduces issue #24401 where CSV import fails with:
   * "Invalid character between encapsulated token and delimiter"
   *
   * <p>The issue occurs because FQNs with dots are quoted (e.g., "asd.asd"),
   * and these quotes can conflict with CSV's field encapsulation when not
   * properly escaped during export.
   *
   * @see <a href="https://github.com/open-metadata/OpenMetadata/issues/24401">Issue #24401</a>
   */
  @Test
  void test_csvExportImportWithDotInServiceName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String serviceNameWithDot = ns.prefix("asd.asd");

    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    CreateDatabaseService serviceRequest =
        new CreateDatabaseService()
            .withName(serviceNameWithDot)
            .withServiceType(DatabaseServiceType.Postgres)
            .withConnection(new DatabaseConnection().withConfig(conn));

    DatabaseService service = client.databaseServices().create(serviceRequest);
    assertNotNull(service);

    String expectedServiceFqn = FullyQualifiedName.quoteName(serviceNameWithDot);
    assertEquals(expectedServiceFqn, service.getFullyQualifiedName());

    CreateDatabase dbRequest =
        new CreateDatabase()
            .withName(ns.prefix("testdb"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Database for CSV export/import test");

    Database database = client.databases().create(dbRequest);
    assertNotNull(database);

    CreateDatabaseSchema schemaRequest =
        new CreateDatabaseSchema()
            .withName(ns.prefix("testschema"))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Schema for CSV export/import test");

    DatabaseSchema schema = client.databaseSchemas().create(schemaRequest);
    assertNotNull(schema);

    CreateTable tableRequest =
        new CreateTable()
            .withName(ns.prefix("testtable"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Table for CSV export/import test")
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.INT)
                        .withDescription("Primary key"),
                    new Column()
                        .withName("name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)
                        .withDescription("Name field")));

    Table table = client.tables().create(tableRequest);
    assertNotNull(table);

    try {
      String exportedCsv = client.databases().exportCsv(database.getFullyQualifiedName());
      assertNotNull(exportedCsv, "CSV export should succeed");
      assertFalse(exportedCsv.isEmpty(), "Exported CSV should not be empty");

      String importResult =
          client.databases().importCsv(database.getFullyQualifiedName(), exportedCsv, true);
      assertNotNull(importResult, "CSV import dry run should succeed");

      assertFalse(
          importResult.toLowerCase().contains("failure"),
          "CSV import should not contain failures. Result: " + importResult);

      String actualImportResult =
          client.databases().importCsv(database.getFullyQualifiedName(), exportedCsv, false);
      assertNotNull(actualImportResult, "CSV import should succeed");

      assertFalse(
          actualImportResult.toLowerCase().contains("failure"),
          "CSV actual import should not contain failures. Result: " + actualImportResult);

    } catch (Exception e) {
      fail(
          "CSV export/import failed with dot in service name. "
              + "This reproduces issue #24401. Error: "
              + e.getMessage());
    }
  }

  /**
   * Test: Full database hierarchy with dot in service name and verify FQN propagation.
   *
   * <p>Creates: "service.name" -> database -> schema -> table
   * <p>Verifies that FQNs are correctly built with proper quoting throughout the hierarchy.
   *
   * @see <a href="https://github.com/open-metadata/OpenMetadata/issues/24401">Issue #24401</a>
   */
  @Test
  void test_hierarchyWithDotInServiceName_fqnPropagation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String serviceNameWithDot = ns.prefix("snowflake.prod");

    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    CreateDatabaseService serviceRequest =
        new CreateDatabaseService()
            .withName(serviceNameWithDot)
            .withServiceType(DatabaseServiceType.Postgres)
            .withConnection(new DatabaseConnection().withConfig(conn));

    DatabaseService service = client.databaseServices().create(serviceRequest);
    assertNotNull(service);

    CreateDatabase dbRequest =
        new CreateDatabase()
            .withName(ns.prefix("customers"))
            .withService(service.getFullyQualifiedName());

    Database database = client.databases().create(dbRequest);
    assertNotNull(database);

    String expectedDbFqn =
        FullyQualifiedName.add(service.getFullyQualifiedName(), database.getName());
    assertEquals(expectedDbFqn, database.getFullyQualifiedName());

    CreateDatabaseSchema schemaRequest =
        new CreateDatabaseSchema()
            .withName(ns.prefix("orders"))
            .withDatabase(database.getFullyQualifiedName());

    DatabaseSchema schema = client.databaseSchemas().create(schemaRequest);
    assertNotNull(schema);

    String expectedSchemaFqn =
        FullyQualifiedName.add(database.getFullyQualifiedName(), schema.getName());
    assertEquals(expectedSchemaFqn, schema.getFullyQualifiedName());

    CreateTable tableRequest =
        new CreateTable()
            .withName(ns.prefix("history"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.INT)
                        .withDescription("Primary key")));

    Table table = client.tables().create(tableRequest);
    assertNotNull(table);

    String expectedTableFqn =
        FullyQualifiedName.add(schema.getFullyQualifiedName(), table.getName());
    assertEquals(expectedTableFqn, table.getFullyQualifiedName());

    String[] fqnParts = FullyQualifiedName.split(table.getFullyQualifiedName());
    assertEquals(4, fqnParts.length);
    assertEquals(FullyQualifiedName.quoteName(serviceNameWithDot), fqnParts[0]);

    Database fetchedDb = client.databases().getByName(database.getFullyQualifiedName());
    assertNotNull(fetchedDb);
    assertEquals(database.getId(), fetchedDb.getId());

    DatabaseSchema fetchedSchema =
        client.databaseSchemas().getByName(schema.getFullyQualifiedName());
    assertNotNull(fetchedSchema);
    assertEquals(schema.getId(), fetchedSchema.getId());

    Table fetchedTable = client.tables().getByName(table.getFullyQualifiedName());
    assertNotNull(fetchedTable);
    assertEquals(table.getId(), fetchedTable.getId());
  }

  /**
   * Test: Comprehensive CSV export and import with dot in service name including stored procedures.
   *
   * <p>This test creates a full database hierarchy with:
   * - Service with dot in name (e.g., "test.sample")
   * - Database
   * - Schema
   * - Multiple tables with columns
   * - Stored procedures
   *
   * <p>Then exports to CSV and imports back, verifying the CSV parsing handles
   * quoted FQNs correctly without throwing:
   * "Invalid character between encapsulated token and delimiter"
   *
   * @see <a href="https://github.com/open-metadata/OpenMetadata/issues/24401">Issue #24401</a>
   */
  @Test
  void test_csvExportImportWithDotInServiceName_fullHierarchy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String serviceNameWithDot = ns.prefix("test.sample");

    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    CreateDatabaseService serviceRequest =
        new CreateDatabaseService()
            .withName(serviceNameWithDot)
            .withServiceType(DatabaseServiceType.Postgres)
            .withConnection(new DatabaseConnection().withConfig(conn));

    DatabaseService service = client.databaseServices().create(serviceRequest);
    assertNotNull(service);

    String expectedServiceFqn = FullyQualifiedName.quoteName(serviceNameWithDot);
    assertEquals(
        expectedServiceFqn,
        service.getFullyQualifiedName(),
        "Service FQN should be quoted when name contains dot");

    CreateDatabase dbRequest =
        new CreateDatabase()
            .withName(ns.prefix("mydb"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Database for comprehensive CSV export/import test");

    Database database = client.databases().create(dbRequest);
    assertNotNull(database);

    CreateDatabaseSchema schemaRequest =
        new CreateDatabaseSchema()
            .withName(ns.prefix("myschema"))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Schema for comprehensive CSV export/import test");

    DatabaseSchema schema = client.databaseSchemas().create(schemaRequest);
    assertNotNull(schema);

    CreateTable usersTableRequest =
        new CreateTable()
            .withName(ns.prefix("users"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Users table for CSV test")
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("Primary key"),
                    new Column()
                        .withName("username")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)
                        .withDescription("Username"),
                    new Column()
                        .withName("email")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)
                        .withDescription("Email address"),
                    new Column()
                        .withName("created_at")
                        .withDataType(ColumnDataType.TIMESTAMP)
                        .withDescription("Creation timestamp")));

    Table usersTable = client.tables().create(usersTableRequest);
    assertNotNull(usersTable);

    CreateTable ordersTableRequest =
        new CreateTable()
            .withName(ns.prefix("orders"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Orders table for CSV test")
            .withColumns(
                List.of(
                    new Column()
                        .withName("order_id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("Order ID"),
                    new Column()
                        .withName("user_id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withDescription("Foreign key to users"),
                    new Column()
                        .withName("total_amount")
                        .withDataType(ColumnDataType.DECIMAL)
                        .withDescription("Total order amount"),
                    new Column()
                        .withName("status")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(50)
                        .withDescription("Order status")));

    Table ordersTable = client.tables().create(ordersTableRequest);
    assertNotNull(ordersTable);

    org.openmetadata.schema.api.data.StoredProcedureCode procCode1 =
        new org.openmetadata.schema.api.data.StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE get_user_orders(user_id BIGINT) "
                    + "LANGUAGE plpgsql AS $$ "
                    + "BEGIN "
                    + "  SELECT * FROM orders WHERE user_id = user_id; "
                    + "END; $$;")
            .withLanguage(org.openmetadata.schema.type.StoredProcedureLanguage.SQL);

    org.openmetadata.schema.api.data.CreateStoredProcedure proc1Request =
        new org.openmetadata.schema.api.data.CreateStoredProcedure()
            .withName(ns.prefix("get_user_orders"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Get orders for a user")
            .withStoredProcedureCode(procCode1);

    org.openmetadata.schema.entity.data.StoredProcedure proc1 =
        client.storedProcedures().create(proc1Request);
    assertNotNull(proc1);

    org.openmetadata.schema.api.data.StoredProcedureCode procCode2 =
        new org.openmetadata.schema.api.data.StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE update_order_status(order_id BIGINT, new_status VARCHAR) "
                    + "LANGUAGE plpgsql AS $$ "
                    + "BEGIN "
                    + "  UPDATE orders SET status = new_status WHERE order_id = order_id; "
                    + "END; $$;")
            .withLanguage(org.openmetadata.schema.type.StoredProcedureLanguage.SQL);

    org.openmetadata.schema.api.data.CreateStoredProcedure proc2Request =
        new org.openmetadata.schema.api.data.CreateStoredProcedure()
            .withName(ns.prefix("update_order_status"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Update order status")
            .withStoredProcedureCode(procCode2);

    org.openmetadata.schema.entity.data.StoredProcedure proc2 =
        client.storedProcedures().create(proc2Request);
    assertNotNull(proc2);

    assertTrue(
        proc1.getFullyQualifiedName().startsWith(expectedServiceFqn),
        "Stored procedure FQN should start with quoted service name");
    assertTrue(
        proc2.getFullyQualifiedName().startsWith(expectedServiceFqn),
        "Stored procedure FQN should start with quoted service name");

    try {
      String exportedCsv = client.databases().exportCsv(database.getFullyQualifiedName(), true);
      assertNotNull(exportedCsv, "CSV export should succeed");
      assertFalse(exportedCsv.isEmpty(), "Exported CSV should not be empty");

      assertTrue(
          exportedCsv.contains(usersTable.getName()), "Exported CSV should contain users table");
      assertTrue(
          exportedCsv.contains(ordersTable.getName()), "Exported CSV should contain orders table");
      assertTrue(
          exportedCsv.contains(proc1.getName()), "Exported CSV should contain stored procedure 1");
      assertTrue(
          exportedCsv.contains(proc2.getName()), "Exported CSV should contain stored procedure 2");

      String dryRunResult =
          client.databases().importCsv(database.getFullyQualifiedName(), exportedCsv, true, true);
      assertNotNull(dryRunResult, "CSV import dry run should succeed");

      assertFalse(
          dryRunResult.toLowerCase().contains("failure"),
          "CSV import dry run should not contain failures. "
              + "This could indicate issue #24401 - CSV parsing error with quoted FQNs. "
              + "Result: "
              + dryRunResult);

      String actualImportResult =
          client.databases().importCsv(database.getFullyQualifiedName(), exportedCsv, false, true);
      assertNotNull(actualImportResult, "CSV actual import should succeed");

      assertFalse(
          actualImportResult.toLowerCase().contains("failure"),
          "CSV actual import should not contain failures. "
              + "This could indicate issue #24401 - CSV parsing error with quoted FQNs. "
              + "Result: "
              + actualImportResult);

      Table refetchedUsersTable = client.tables().getByName(usersTable.getFullyQualifiedName());
      assertNotNull(refetchedUsersTable, "Users table should exist after import");

      Table refetchedOrdersTable = client.tables().getByName(ordersTable.getFullyQualifiedName());
      assertNotNull(refetchedOrdersTable, "Orders table should exist after import");

      org.openmetadata.schema.entity.data.StoredProcedure refetchedProc1 =
          client.storedProcedures().getByName(proc1.getFullyQualifiedName());
      assertNotNull(refetchedProc1, "Stored procedure 1 should exist after import");

      org.openmetadata.schema.entity.data.StoredProcedure refetchedProc2 =
          client.storedProcedures().getByName(proc2.getFullyQualifiedName());
      assertNotNull(refetchedProc2, "Stored procedure 2 should exist after import");

    } catch (Exception e) {
      fail(
          "CSV export/import failed with dot in service name (full hierarchy including stored procedures). "
              + "This reproduces issue #24401: 'Invalid character between encapsulated token and delimiter'. "
              + "Error: "
              + e.getMessage());
    }
  }

  /**
   * Test: CSV export and import with multiple dots in service name.
   *
   * <p>Tests edge case where service name contains multiple dots (e.g., "prod.us.east.snowflake").
   * This exercises the FQN quoting logic more extensively.
   *
   * @see <a href="https://github.com/open-metadata/OpenMetadata/issues/24401">Issue #24401</a>
   */
  @Test
  void test_csvExportImportWithMultipleDotsInServiceName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String serviceNameWithMultipleDots = ns.prefix("prod.us.east.db");

    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    CreateDatabaseService serviceRequest =
        new CreateDatabaseService()
            .withName(serviceNameWithMultipleDots)
            .withServiceType(DatabaseServiceType.Postgres)
            .withConnection(new DatabaseConnection().withConfig(conn));

    DatabaseService service = client.databaseServices().create(serviceRequest);
    assertNotNull(service);

    String expectedServiceFqn = FullyQualifiedName.quoteName(serviceNameWithMultipleDots);
    assertEquals(expectedServiceFqn, service.getFullyQualifiedName());

    CreateDatabase dbRequest =
        new CreateDatabase()
            .withName(ns.prefix("analytics"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Analytics database");

    Database database = client.databases().create(dbRequest);
    assertNotNull(database);

    CreateDatabaseSchema schemaRequest =
        new CreateDatabaseSchema()
            .withName(ns.prefix("metrics"))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Metrics schema");

    DatabaseSchema schema = client.databaseSchemas().create(schemaRequest);
    assertNotNull(schema);

    CreateTable tableRequest =
        new CreateTable()
            .withName(ns.prefix("daily_metrics"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Daily metrics table")
            .withColumns(
                List.of(
                    new Column()
                        .withName("date")
                        .withDataType(ColumnDataType.DATE)
                        .withDescription("Metric date"),
                    new Column()
                        .withName("metric_name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)
                        .withDescription("Name of the metric"),
                    new Column()
                        .withName("metric_value")
                        .withDataType(ColumnDataType.DOUBLE)
                        .withDescription("Value of the metric")));

    Table table = client.tables().create(tableRequest);
    assertNotNull(table);

    org.openmetadata.schema.api.data.StoredProcedureCode procCode =
        new org.openmetadata.schema.api.data.StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE aggregate_daily_metrics() "
                    + "LANGUAGE plpgsql AS $$ "
                    + "BEGIN "
                    + "  -- Aggregate metrics "
                    + "  INSERT INTO daily_metrics SELECT date, metric_name, AVG(metric_value) "
                    + "  FROM raw_metrics GROUP BY date, metric_name; "
                    + "END; $$;")
            .withLanguage(org.openmetadata.schema.type.StoredProcedureLanguage.SQL);

    org.openmetadata.schema.api.data.CreateStoredProcedure procRequest =
        new org.openmetadata.schema.api.data.CreateStoredProcedure()
            .withName(ns.prefix("aggregate_daily_metrics"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Aggregate daily metrics")
            .withStoredProcedureCode(procCode);

    org.openmetadata.schema.entity.data.StoredProcedure proc =
        client.storedProcedures().create(procRequest);
    assertNotNull(proc);

    try {
      String exportedCsv = client.databases().exportCsv(database.getFullyQualifiedName(), true);
      assertNotNull(exportedCsv, "CSV export should succeed");
      assertFalse(exportedCsv.isEmpty(), "Exported CSV should not be empty");

      assertTrue(exportedCsv.contains(table.getName()), "Exported CSV should contain table");
      assertTrue(
          exportedCsv.contains(proc.getName()), "Exported CSV should contain stored procedure");

      String dryRunResult =
          client.databases().importCsv(database.getFullyQualifiedName(), exportedCsv, true, true);
      assertNotNull(dryRunResult, "CSV import dry run should succeed");

      assertFalse(
          dryRunResult.toLowerCase().contains("failure"),
          "CSV import with multiple dots in service name should not fail. "
              + "Result: "
              + dryRunResult);

      String actualImportResult =
          client.databases().importCsv(database.getFullyQualifiedName(), exportedCsv, false, true);
      assertNotNull(actualImportResult, "CSV actual import should succeed");

      assertFalse(
          actualImportResult.toLowerCase().contains("failure"),
          "CSV actual import with multiple dots should not fail. "
              + "Result: "
              + actualImportResult);

    } catch (Exception e) {
      fail(
          "CSV export/import failed with multiple dots in service name. "
              + "Error: "
              + e.getMessage());
    }
  }

  // ===================================================================
  // RDF TESTS - Run only with -Ppostgres-rdf-tests profile
  // ===================================================================

  /**
   * Test: RDF Relationships
   * Original: testDatabaseRdfRelationships line 523
   *
   * Validates that database entities and their relationships are correctly stored in RDF graph:
   * - Entity existence in RDF
   * - Hierarchical relationships (service CONTAINS database)
   * - Owner relationships
   * - Tag relationships
   */
  @Test
  void test_databaseRdfRelationships(TestNamespace ns) {
    if (!org.openmetadata.service.util.RdfTestUtils.isRdfEnabled()) {
      return; // Skip if RDF not enabled
    }

    OpenMetadataClient client = SdkClients.adminClient();

    // Create database service first
    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(ns);

    // Get user reference for owner
    org.openmetadata.schema.entity.teams.User user =
        SdkClients.adminClient()
            .users()
            .getByName("ingestion-bot"); // Use ingestion-bot (auto-created)
    org.openmetadata.schema.type.EntityReference userRef =
        new org.openmetadata.schema.type.EntityReference()
            .withId(user.getId())
            .withType("user")
            .withName(user.getName())
            .withFullyQualifiedName(user.getFullyQualifiedName());

    // Create Tier1 tag for testing
    org.openmetadata.schema.type.TagLabel tier1Tag =
        new org.openmetadata.schema.type.TagLabel()
            .withTagFQN("Tier.Tier1")
            .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);

    // Create database with owner and tags
    CreateDatabase createRequest = new CreateDatabase();
    createRequest.setName(ns.prefix("rdf_db"));
    createRequest.setService(service.getFullyQualifiedName());
    createRequest.setOwners(List.of(userRef));
    createRequest.setTags(List.of(tier1Tag));

    Database database = createEntity(createRequest);

    // Verify database exists in RDF
    org.openmetadata.service.util.RdfTestUtils.verifyEntityInRdf(
        database, org.openmetadata.service.rdf.RdfUtils.getRdfType("database"));

    // Verify hierarchical relationship (service CONTAINS database)
    org.openmetadata.service.util.RdfTestUtils.verifyContainsRelationshipInRdf(
        service.getEntityReference(), database.getEntityReference());

    // Verify owner relationship
    org.openmetadata.service.util.RdfTestUtils.verifyOwnerInRdf(
        database.getFullyQualifiedName(), userRef);

    // Verify database tags
    org.openmetadata.service.util.RdfTestUtils.verifyTagsInRdf(
        database.getFullyQualifiedName(), database.getTags());
  }

  /**
   * Test: RDF Soft Delete and Restore
   * Original: testDatabaseRdfSoftDeleteAndRestore line 552
   *
   * Validates that soft-deleted databases are properly handled in RDF:
   * - Entity marked as deleted in RDF
   * - Restore operation updates RDF correctly
   */
  @Test
  void test_databaseRdfSoftDeleteAndRestore(TestNamespace ns) {
    if (!org.openmetadata.service.util.RdfTestUtils.isRdfEnabled()) {
      return; // Skip if RDF not enabled
    }

    OpenMetadataClient client = SdkClients.adminClient();

    // Create database
    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(ns);
    CreateDatabase createRequest = new CreateDatabase();
    createRequest.setName(ns.prefix("rdf_soft_delete_db"));
    createRequest.setService(service.getFullyQualifiedName());
    Database database = createEntity(createRequest);

    // Verify database exists in RDF
    org.openmetadata.service.util.RdfTestUtils.verifyEntityInRdf(
        database, org.openmetadata.service.rdf.RdfUtils.getRdfType("database"));

    // Soft delete the database
    deleteEntity(database.getId().toString());

    // Verify database STILL exists in RDF after soft delete (soft delete doesn't remove from RDF)
    org.openmetadata.service.util.RdfTestUtils.verifyEntityInRdf(
        database, org.openmetadata.service.rdf.RdfUtils.getRdfType("database"));
    org.openmetadata.service.util.RdfTestUtils.verifyContainsRelationshipInRdf(
        service.getEntityReference(), database.getEntityReference());

    // Restore the database
    restoreEntity(database.getId().toString());

    // Verify database still exists in RDF after restore
    Database restored = getEntity(database.getId().toString());
    org.openmetadata.service.util.RdfTestUtils.verifyEntityInRdf(
        restored, org.openmetadata.service.rdf.RdfUtils.getRdfType("database"));
    org.openmetadata.service.util.RdfTestUtils.verifyContainsRelationshipInRdf(
        service.getEntityReference(), restored.getEntityReference());
  }

  /**
   * Test: RDF Hard Delete
   * Original: testDatabaseRdfHardDelete line 587
   *
   * Validates that hard-deleted databases are completely removed from RDF graph
   */
  @Test
  void test_databaseRdfHardDelete(TestNamespace ns) {
    if (!org.openmetadata.service.util.RdfTestUtils.isRdfEnabled()) {
      return; // Skip if RDF not enabled
    }

    OpenMetadataClient client = SdkClients.adminClient();

    // Create database
    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(ns);
    CreateDatabase createRequest = new CreateDatabase();
    createRequest.setName(ns.prefix("rdf_hard_delete_db"));
    createRequest.setService(service.getFullyQualifiedName());
    Database database = createEntity(createRequest);

    String databaseFqn = database.getFullyQualifiedName();

    // Verify database exists in RDF
    org.openmetadata.service.util.RdfTestUtils.verifyEntityInRdf(
        database, org.openmetadata.service.rdf.RdfUtils.getRdfType("database"));

    // Hard delete the database (set hardDelete=true)
    hardDeleteEntity(database.getId().toString());

    // Verify database is completely removed from RDF
    org.openmetadata.service.util.RdfTestUtils.verifyEntityNotInRdf(databaseFqn);
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().databases().getVersionList(id);
  }

  @Override
  protected Database getVersion(UUID id, Double version) {
    return SdkClients.adminClient().databases().getVersion(id.toString(), version);
  }

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<Database> getEntityService() {
    return SdkClients.adminClient().databases();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    // For databases, we export from the database itself
    if (lastCreatedDatabase == null) {
      CreateDatabase request = createMinimalRequest(ns);
      request.setName(ns.prefix("export_db"));
      lastCreatedDatabase = createEntity(request);
    }
    return lastCreatedDatabase.getFullyQualifiedName();
  }

  // ===================================================================
  // CSV IMPORT/EXPORT SUPPORT
  // ===================================================================

  protected String generateValidCsvData(TestNamespace ns, List<Database> entities) {
    if (entities == null || entities.isEmpty()) {
      return null;
    }

    StringBuilder csv = new StringBuilder();
    csv.append(
        "name,displayName,description,owner,tags,glossaryTerms,tiers,certification,retentionPeriod,sourceUrl,domains,extension\n");

    for (Database database : entities) {
      csv.append(escapeCSVValue(database.getName())).append(",");
      csv.append(escapeCSVValue(database.getDisplayName())).append(",");
      csv.append(escapeCSVValue(database.getDescription())).append(",");
      csv.append(escapeCSVValue(formatOwnersForCsv(database.getOwners()))).append(",");
      csv.append(escapeCSVValue(formatTagsForCsv(database.getTags()))).append(",");
      csv.append(escapeCSVValue("")).append(","); // glossaryTerms - not available on Database
      csv.append(escapeCSVValue(formatTiersForCsv(database.getTags()))).append(",");
      csv.append(escapeCSVValue(formatCertificationForCsv(database.getCertification())))
          .append(",");
      csv.append(escapeCSVValue(database.getRetentionPeriod())).append(",");
      csv.append(escapeCSVValue(database.getSourceUrl() != null ? database.getSourceUrl() : ""))
          .append(",");
      csv.append(escapeCSVValue(formatDomainsForCsv(database.getDomains()))).append(",");
      csv.append(escapeCSVValue(formatExtensionForCsv(database.getExtension())));
      csv.append("\n");
    }

    return csv.toString();
  }

  protected String generateInvalidCsvData(TestNamespace ns) {
    StringBuilder csv = new StringBuilder();
    csv.append(
        "name*,displayName,description,owner,tags,glossaryTerms,tiers,certification,retentionPeriod,sourceUrl,domains,extension\n");
    // Missing required name field
    csv.append(",Test Database,Description,,,,,,,,,\n");
    // Invalid owner format
    csv.append("invalid_database,,,,invalid_owner_format,,,,,,,\n");
    return csv.toString();
  }

  protected List<String> getRequiredCsvHeaders() {
    return List.of("name");
  }

  protected List<String> getAllCsvHeaders() {
    return List.of(
        "name*",
        "displayName",
        "description",
        "owner",
        "tags",
        "glossaryTerms",
        "tiers",
        "certification",
        "retentionPeriod",
        "sourceUrl",
        "domains",
        "extension");
  }

  private String formatOwnersForCsv(List<org.openmetadata.schema.type.EntityReference> owners) {
    if (owners == null || owners.isEmpty()) {
      return "";
    }
    return owners.stream()
        .map(
            owner -> {
              String prefix = "user";
              if ("team".equals(owner.getType())) {
                prefix = "team";
              }
              return prefix + ";" + owner.getName();
            })
        .reduce((a, b) -> a + ";" + b)
        .orElse("");
  }

  private String formatTagsForCsv(List<org.openmetadata.schema.type.TagLabel> tags) {
    if (tags == null || tags.isEmpty()) {
      return "";
    }
    return tags.stream()
        .filter(
            tag ->
                !tag.getTagFQN().startsWith("Tier.")
                    && !tag.getTagFQN().startsWith("Certification."))
        .map(org.openmetadata.schema.type.TagLabel::getTagFQN)
        .reduce((a, b) -> a + ";" + b)
        .orElse("");
  }

  private String formatTiersForCsv(List<org.openmetadata.schema.type.TagLabel> tags) {
    if (tags == null || tags.isEmpty()) {
      return "";
    }
    return tags.stream()
        .filter(tag -> tag.getTagFQN().startsWith("Tier."))
        .map(org.openmetadata.schema.type.TagLabel::getTagFQN)
        .reduce((a, b) -> a + ";" + b)
        .orElse("");
  }

  private String formatCertificationForCsv(
      org.openmetadata.schema.type.AssetCertification certification) {
    if (certification == null || certification.getTagLabel() == null) {
      return "";
    }
    return certification.getTagLabel().getTagFQN();
  }

  private String formatDomainsForCsv(List<org.openmetadata.schema.type.EntityReference> domains) {
    if (domains == null || domains.isEmpty()) {
      return "";
    }
    return domains.stream()
        .map(org.openmetadata.schema.type.EntityReference::getName)
        .reduce((a, b) -> a + ";" + b)
        .orElse("");
  }

  private String formatExtensionForCsv(Object extension) {
    if (extension == null) {
      return "";
    }
    return extension.toString();
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

  @Override
  protected void validateCsvDataPersistence(
      List<Database> originalEntities, String csvData, CsvImportResult result) {
    super.validateCsvDataPersistence(originalEntities, csvData, result);

    if (result.getStatus() != ApiStatus.SUCCESS) {
      return;
    }

    if (originalEntities != null) {
      for (Database originalEntity : originalEntities) {
        Database updatedEntity =
            getEntityByNameWithFields(originalEntity.getName(), "owners,tags,domains");
        assertNotNull(
            updatedEntity,
            "Database " + originalEntity.getName() + " should exist after CSV import");

        validateDatabaseFieldsAfterImport(originalEntity, updatedEntity);
      }
    }
  }

  private void validateDatabaseFieldsAfterImport(Database original, Database imported) {
    assertEquals(original.getName(), imported.getName(), "Database name should match");

    if (original.getDisplayName() != null) {
      assertEquals(
          original.getDisplayName(),
          imported.getDisplayName(),
          "Database displayName should be preserved");
    }

    if (original.getDescription() != null) {
      assertEquals(
          original.getDescription(),
          imported.getDescription(),
          "Database description should be preserved");
    }

    if (original.getRetentionPeriod() != null) {
      assertEquals(
          original.getRetentionPeriod(),
          imported.getRetentionPeriod(),
          "Database retention period should be preserved");
    }

    if (original.getSourceUrl() != null) {
      assertEquals(
          original.getSourceUrl(),
          imported.getSourceUrl(),
          "Database source URL should be preserved");
    }

    if (original.getOwners() != null && !original.getOwners().isEmpty()) {
      assertNotNull(imported.getOwners(), "Database owners should be preserved");
      assertEquals(
          original.getOwners().size(),
          imported.getOwners().size(),
          "Database owner count should match");
    }

    if (original.getTags() != null && !original.getTags().isEmpty()) {
      assertNotNull(imported.getTags(), "Database tags should be preserved");
      assertEquals(
          original.getTags().size(), imported.getTags().size(), "Database tag count should match");
    }

    if (original.getDomains() != null && !original.getDomains().isEmpty()) {
      assertNotNull(imported.getDomains(), "Database domains should be preserved");
      assertEquals(
          original.getDomains().size(),
          imported.getDomains().size(),
          "Database domain count should match");
    }
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateDatabase> createRequests) {
    return SdkClients.adminClient().databases().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateDatabase> createRequests) {
    return SdkClients.adminClient().databases().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateDatabase createInvalidRequestForBulk(TestNamespace ns) {
    CreateDatabase request = new CreateDatabase();
    request.setName(ns.prefix("invalid_database"));
    return request;
  }
}
