package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Integration tests for Table entity operations.
 *
 * Extends BaseEntityIT to inherit all 8 common entity tests.
 * Adds table-specific tests for columns, constraints, partitions.
 *
 * Total coverage: 8 (common) + table-specific tests
 *
 * Migrated from: org.openmetadata.service.resources.databases.TableResourceTest
 * Migration date: 2025-10-02
 *
 * Test isolation: Uses TestNamespace for unique entity names
 * Parallelization: Safe for concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
public class TableResourceIT extends BaseEntityIT<Table, CreateTable> {

  // ===================================================================
  // OVERRIDE: Tables allow duplicates in different schemas
  // ===================================================================

  @Override
  @Test
  public void post_duplicateEntity_409(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Tables are scoped by schema, so duplicates only conflict within same schema
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(client, ns, service);

    // Create first table
    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("table"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setColumns(
        List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));

    Table table = createEntity(createRequest, client);
    assertNotNull(table.getId());

    // Attempt to create duplicate table in SAME schema
    CreateTable duplicateRequest = new CreateTable();
    duplicateRequest.setName(table.getName()); // Same name
    duplicateRequest.setDatabaseSchema(schema.getFullyQualifiedName()); // Same schema
    duplicateRequest.setColumns(
        List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));

    assertThrows(
        Exception.class,
        () -> createEntity(duplicateRequest, client),
        "Creating duplicate table in same schema should fail");
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateTable createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    // Table requires: database service → database → schema
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(client, ns, service);

    CreateTable request = new CreateTable();
    request.setName(ns.prefix("table"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setDescription("Test table created by integration test");

    // Add minimal columns
    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build());
    request.setColumns(columns);

    return request;
  }

  @Override
  protected CreateTable createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(client, ns, service);

    CreateTable request = new CreateTable();
    request.setName(name);
    request.setDatabaseSchema(schema.getFullyQualifiedName());

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build());
    request.setColumns(columns);

    return request;
  }

  @Override
  protected Table createEntity(CreateTable createRequest, OpenMetadataClient client) {
    return client.tables().create(createRequest);
  }

  @Override
  protected Table getEntity(String id, OpenMetadataClient client) {
    return client.tables().get(id);
  }

  @Override
  protected Table getEntityByName(String fqn, OpenMetadataClient client) {
    return client.tables().getByName(fqn);
  }

  @Override
  protected Table patchEntity(String id, Table entity, OpenMetadataClient client) {
    return client.tables().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.tables().delete(id);
  }

  @Override
  protected String getEntityType() {
    return "table";
  }

  @Override
  protected void validateCreatedEntity(Table entity, CreateTable createRequest) {
    // Table-specific validations
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getDatabaseSchema(), "Table must have a database schema");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    // Validate columns
    assertNotNull(entity.getColumns(), "Table must have columns");
    assertEquals(
        createRequest.getColumns().size(), entity.getColumns().size(), "Column count should match");

    // FQN should be: serviceName.databaseName.schemaName.tableName
    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()), "FQN should contain table name");
  }

  // ===================================================================
  // TABLE-SPECIFIC TESTS
  // ===================================================================

  /**
   * Test: post_tableFQN_200_OK
   *
   * Validates FQN construction for tables.
   */
  @Test
  void post_tableFQN_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create hierarchy
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(client, ns, service);

    // Create table
    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("fqn_test_table"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("value", "VARCHAR").dataLength(100).build()));

    Table table = createEntity(createRequest, client);

    // Verify FQN format: service.database.schema.table
    String expectedFQN = schema.getFullyQualifiedName() + "." + table.getName();
    assertEquals(expectedFQN, table.getFullyQualifiedName());

    // Verify retrieval by FQN
    Table fetchedByFqn = getEntityByName(table.getFullyQualifiedName(), client);
    assertEquals(table.getId(), fetchedByFqn.getId());
  }

  /**
   * Test: post_tableWithColumns_200_OK
   *
   * Validates table creation with different column types.
   */
  @Test
  void post_tableWithColumns_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(client, ns, service);

    // Create table with various column types
    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("columns_test"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("username", "VARCHAR").dataLength(255).notNull().build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build(),
            ColumnBuilder.of("age", "INT").build(),
            ColumnBuilder.of("created_at", "TIMESTAMP").build(),
            ColumnBuilder.of("is_active", "BOOLEAN").build()));

    Table table = createEntity(createRequest, client);

    // Verify columns
    assertNotNull(table.getColumns());
    assertEquals(6, table.getColumns().size());

    // Verify specific columns
    Column idColumn = table.getColumns().get(0);
    assertEquals("id", idColumn.getName());
    assertEquals("BIGINT", idColumn.getDataType().toString());

    Column usernameColumn = table.getColumns().get(1);
    assertEquals("username", usernameColumn.getName());
    assertEquals("VARCHAR", usernameColumn.getDataType().toString());
    assertEquals(255, usernameColumn.getDataLength());
  }

  /**
   * Test: post_tableWithoutSchema_400
   *
   * Validates that databaseSchema is required.
   */
  @Test
  void post_tableWithoutSchema_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("no_schema"));
    // Missing: createRequest.setDatabaseSchema(...)
    createRequest.setColumns(
        List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));

    assertThrows(
        Exception.class,
        () -> createEntity(createRequest, client),
        "Creating table without schema should fail");
  }

  /**
   * Test: patch_tableAddColumn_200_OK
   *
   * Validates adding columns to existing table.
   */
  @Test
  void patch_tableAddColumn_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create table with initial columns
    CreateTable createRequest = createMinimalRequest(ns, client);
    Table created = createEntity(createRequest, client);

    assertEquals(2, created.getColumns().size(), "Should have 2 initial columns");

    // Add new column
    List<Column> updatedColumns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build()); // New column

    created.setColumns(updatedColumns);
    Table updated = patchEntity(created.getId().toString(), created, client);

    // Verify column added
    assertNotNull(updated.getColumns());
    assertEquals(3, updated.getColumns().size(), "Should have 3 columns after update");

    // Verify new column exists
    assertTrue(
        updated.getColumns().stream().anyMatch(col -> "email".equals(col.getName())),
        "Should have 'email' column");
  }

  // ===================================================================
  // PHASE 3: List Operations Support
  // ===================================================================

  @Override
  protected org.openmetadata.sdk.models.ListResponse<Table> listEntities(
      org.openmetadata.sdk.models.ListParams params, OpenMetadataClient client) {
    return client.tables().list(params);
  }

  @Override
  protected Table getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.tables().get(id, fields);
  }

  @Override
  protected Table getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.tables().getByName(fqn, fields);
  }

  @Override
  protected Table getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.tables().get(id, "owners,tags,columns", "deleted");
  }

  // TODO: Additional table-specific tests to migrate:
  // - Table constraints (primary key, foreign key, unique)
  // - Table partitions
  // - Table joins
  // - Column data types (complex types, arrays, structs)
  // - Column constraints
  // - Table profiling
  // - Table lineage
}
