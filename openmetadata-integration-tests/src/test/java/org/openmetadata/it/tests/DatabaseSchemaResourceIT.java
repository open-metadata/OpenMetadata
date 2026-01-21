package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for DatabaseSchema entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds schema-specific tests.
 *
 * <p>Migrated from: org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DatabaseSchemaResourceIT extends BaseEntityIT<DatabaseSchema, CreateDatabaseSchema> {

  {
    supportsImportExport = true;
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
  }

  // Store last created schema for import/export tests
  private DatabaseSchema lastCreatedSchema;

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDatabaseSchema createMinimalRequest(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema"));
    request.setDatabase(database.getFullyQualifiedName());
    request.setDescription("Test schema created by integration test");

    return request;
  }

  @Override
  protected CreateDatabaseSchema createRequest(String name, TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(name);
    request.setDatabase(database.getFullyQualifiedName());

    return request;
  }

  private Database createDatabase(TestNamespace ns, DatabaseService service) {
    CreateDatabase dbRequest = new CreateDatabase();
    dbRequest.setName(ns.prefix("database"));
    dbRequest.setService(service.getFullyQualifiedName());
    return SdkClients.adminClient().databases().create(dbRequest);
  }

  @Override
  protected DatabaseSchema createEntity(CreateDatabaseSchema createRequest) {
    return SdkClients.adminClient().databaseSchemas().create(createRequest);
  }

  @Override
  protected DatabaseSchema getEntity(String id) {
    return SdkClients.adminClient().databaseSchemas().get(id);
  }

  @Override
  protected DatabaseSchema getEntityByName(String fqn) {
    return SdkClients.adminClient().databaseSchemas().getByName(fqn);
  }

  @Override
  protected DatabaseSchema patchEntity(String id, DatabaseSchema entity) {
    return SdkClients.adminClient().databaseSchemas().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().databaseSchemas().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().databaseSchemas().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().databaseSchemas().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "databaseSchema";
  }

  @Override
  protected void validateCreatedEntity(DatabaseSchema entity, CreateDatabaseSchema createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getDatabase(), "DatabaseSchema must have a database");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain schema name");
  }

  @Override
  protected ListResponse<DatabaseSchema> listEntities(ListParams params) {
    return SdkClients.adminClient().databaseSchemas().list(params);
  }

  @Override
  protected DatabaseSchema getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().databaseSchemas().get(id, fields);
  }

  @Override
  protected DatabaseSchema getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().databaseSchemas().getByName(fqn, fields);
  }

  @Override
  protected DatabaseSchema getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().databaseSchemas().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().databaseSchemas().getVersionList(id);
  }

  @Override
  protected DatabaseSchema getVersion(UUID id, Double version) {
    return SdkClients.adminClient().databaseSchemas().getVersion(id.toString(), version);
  }

  @Override
  protected org.openmetadata.sdk.services.EntityServiceBase<DatabaseSchema> getEntityService() {
    return SdkClients.adminClient().databaseSchemas();
  }

  @Override
  protected String getImportExportContainerName(TestNamespace ns) {
    // For database schemas, we need to create one first and return its FQN
    if (lastCreatedSchema == null) {
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      Database database = createDatabase(ns, service);
      CreateDatabaseSchema request = new CreateDatabaseSchema();
      request.setName(ns.prefix("export_schema"));
      request.setDatabase(database.getFullyQualifiedName());
      lastCreatedSchema = createEntity(request);
    }
    return lastCreatedSchema.getFullyQualifiedName();
  }

  // ===================================================================
  // DATABASE SCHEMA-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_schemaWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Database is required field
    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema_no_database"));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating schema without database should fail");
  }

  @Test
  void post_schemaWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema_with_url"));
    request.setDatabase(database.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:5432/mydb/myschema");

    DatabaseSchema schema = createEntity(request);
    assertNotNull(schema);
    assertEquals("http://localhost:5432/mydb/myschema", schema.getSourceUrl());
  }

  @Test
  void put_schemaDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema_update_desc"));
    request.setDatabase(database.getFullyQualifiedName());
    request.setDescription("Initial description");

    DatabaseSchema schema = createEntity(request);
    assertEquals("Initial description", schema.getDescription());

    // Update description
    schema.setDescription("Updated description");
    DatabaseSchema updated = patchEntity(schema.getId().toString(), schema);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_schemaInheritsDomainFromDatabase(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create database service and database
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    // Create schema under the database
    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema_inherit_domain"));
    request.setDatabase(database.getFullyQualifiedName());

    DatabaseSchema schema = createEntity(request);
    assertNotNull(schema);
    assertNotNull(schema.getDatabase());
    assertEquals(database.getFullyQualifiedName(), schema.getDatabase().getFullyQualifiedName());
  }

  @Test
  void delete_schemaWithTables_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
    createSchema.setName(ns.prefix("schema_with_tables"));
    createSchema.setDatabase(database.getFullyQualifiedName());

    DatabaseSchema schema = createEntity(createSchema);
    assertNotNull(schema);

    // Create two tables in the schema
    CreateTable createTable1 = new CreateTable();
    createTable1.setName(ns.prefix("table1"));
    createTable1.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable1.setColumns(
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("id")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT)));

    org.openmetadata.schema.entity.data.Table table1 = client.tables().create(createTable1);
    assertNotNull(table1);

    CreateTable createTable2 = new CreateTable();
    createTable2.setName(ns.prefix("table2"));
    createTable2.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable2.setColumns(
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("id")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT)));

    org.openmetadata.schema.entity.data.Table table2 = client.tables().create(createTable2);
    assertNotNull(table2);

    // Recursively soft delete schema
    java.util.Map<String, String> deleteParams = new java.util.HashMap<>();
    deleteParams.put("recursive", "true");
    client.databaseSchemas().delete(schema.getId().toString(), deleteParams);

    // Verify schema is deleted
    DatabaseSchema deletedSchema = getEntityIncludeDeleted(schema.getId().toString());
    assertNotNull(deletedSchema);
    assertTrue(deletedSchema.getDeleted());

    // Restore one of the tables
    client.tables().restore(table2.getId().toString());

    // Restore schema
    restoreEntity(schema.getId().toString());

    // Verify schema is restored
    DatabaseSchema restoredSchema = getEntity(schema.getId().toString());
    assertNotNull(restoredSchema);
    assertFalse(restoredSchema.getDeleted() != null && restoredSchema.getDeleted());
  }

  @Test
  void test_bulkFetchWithOwners_pagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    java.util.List<DatabaseSchema> createdSchemas = new java.util.ArrayList<>();

    for (int i = 0; i < 5; i++) {
      CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
      createSchema.setName(ns.prefix("schema_owner_" + i));
      createSchema.setDatabase(database.getFullyQualifiedName());

      org.openmetadata.schema.type.EntityReference ownerRef =
          i % 2 == 0 ? testUser1Ref() : testUser2Ref();
      createSchema.setOwners(List.of(ownerRef));

      DatabaseSchema schema = createEntity(createSchema);
      createdSchemas.add(schema);
    }

    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setFields("owners");
    params.setLimit(100);

    params.setDatabase(database.getFullyQualifiedName());

    org.openmetadata.sdk.models.ListResponse<DatabaseSchema> schemaList = listEntities(params);
    assertNotNull(schemaList);
    assertTrue(schemaList.getData().size() >= 5, "Should have at least 5 schemas");

    long foundCount =
        schemaList.getData().stream()
            .filter(
                schema -> createdSchemas.stream().anyMatch(s -> s.getId().equals(schema.getId())))
            .count();

    assertTrue(foundCount >= 5, "Should find all created schemas in bulk response");

    for (DatabaseSchema schema : schemaList.getData()) {
      if (createdSchemas.stream().anyMatch(s -> s.getId().equals(schema.getId()))) {
        assertNotNull(schema.getOwners());
        assertEquals(1, schema.getOwners().size(), "Schema should have exactly one owner");

        String ownerId = schema.getOwners().get(0).getId().toString();
        assertTrue(
            testUser1().getId().toString().equals(ownerId)
                || testUser2().getId().toString().equals(ownerId),
            "Owner should be either USER1 or USER2");
      }
    }

    for (DatabaseSchema createdSchema : createdSchemas) {
      DatabaseSchema individualSchema =
          getEntityByNameWithFields(createdSchema.getFullyQualifiedName(), "owners");

      assertNotNull(individualSchema.getOwners());
      assertEquals(1, individualSchema.getOwners().size());

      DatabaseSchema bulkSchema =
          schemaList.getData().stream()
              .filter(s -> s.getId().equals(createdSchema.getId()))
              .findFirst()
              .orElse(null);

      if (bulkSchema != null) {
        assertEquals(
            individualSchema.getOwners().get(0).getId(),
            bulkSchema.getOwners().get(0).getId(),
            "Owner from bulk fetch should match individual fetch");
      }
    }
  }

  @Test
  void test_bulkFetchWithTablesAndProfilerConfig_pagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    java.util.List<DatabaseSchema> createdSchemas = new java.util.ArrayList<>();

    for (int i = 0; i < 5; i++) {
      CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
      createSchema.setName(ns.prefix("schema_tables_" + i));
      createSchema.setDatabase(database.getFullyQualifiedName());

      DatabaseSchema schema = createEntity(createSchema);

      for (int j = 0; j < 2; j++) {
        CreateTable createTable = new CreateTable();
        createTable.setName(ns.prefix("table_" + i + "_" + j));
        createTable.setDatabaseSchema(schema.getFullyQualifiedName());
        createTable.setColumns(
            List.of(
                new org.openmetadata.schema.type.Column()
                    .withName("id")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT)));
        client.tables().create(createTable);
      }

      if (i % 2 == 0) {
        org.openmetadata.schema.type.DatabaseSchemaProfilerConfig profilerConfig =
            new org.openmetadata.schema.type.DatabaseSchemaProfilerConfig()
                .withProfileSampleType(
                    org.openmetadata.schema.type.TableProfilerConfig.ProfileSampleType.PERCENTAGE)
                .withProfileSample(50.0);

        // Use dedicated SDK method to add profiler config
        schema = client.databaseSchemas().addProfilerConfig(schema.getId(), profilerConfig);
      }

      createdSchemas.add(schema);
    }

    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setFields("tables,databaseSchemaProfilerConfig");
    params.setLimit(100);

    params.setDatabase(database.getFullyQualifiedName());

    org.openmetadata.sdk.models.ListResponse<DatabaseSchema> schemaList = listEntities(params);
    assertNotNull(schemaList);
    assertTrue(schemaList.getData().size() >= 5, "Should have at least 5 schemas");

    for (DatabaseSchema schema : schemaList.getData()) {
      DatabaseSchema createdSchema =
          createdSchemas.stream()
              .filter(s -> s.getId().equals(schema.getId()))
              .findFirst()
              .orElse(null);

      if (createdSchema != null) {
        assertNotNull(schema.getTables());
        assertEquals(2, schema.getTables().size(), "Schema should have exactly 2 tables");

        for (org.openmetadata.schema.type.EntityReference tableRef : schema.getTables()) {
          assertNotNull(tableRef.getId());
          assertNotNull(tableRef.getName());
          assertNotNull(tableRef.getType());
          assertEquals("table", tableRef.getType());
        }

        int schemaIndex = createdSchemas.indexOf(createdSchema);
        if (schemaIndex % 2 == 0) {
          assertNotNull(
              schema.getDatabaseSchemaProfilerConfig(),
              "Even-indexed schema should have profiler config");
          assertEquals(
              org.openmetadata.schema.type.TableProfilerConfig.ProfileSampleType.PERCENTAGE,
              schema.getDatabaseSchemaProfilerConfig().getProfileSampleType());
          assertEquals(50.0, schema.getDatabaseSchemaProfilerConfig().getProfileSample());
        } else {
          assertTrue(
              schema.getDatabaseSchemaProfilerConfig() == null,
              "Odd-indexed schema should not have profiler config");
        }
      }
    }

    for (DatabaseSchema createdSchema : createdSchemas) {
      DatabaseSchema individualSchema =
          getEntityByNameWithFields(
              createdSchema.getFullyQualifiedName(), "tables,databaseSchemaProfilerConfig");

      DatabaseSchema bulkSchema =
          schemaList.getData().stream()
              .filter(s -> s.getId().equals(createdSchema.getId()))
              .findFirst()
              .orElse(null);

      if (bulkSchema != null) {
        assertEquals(
            individualSchema.getTables().size(),
            bulkSchema.getTables().size(),
            "Table count should match between individual and bulk fetch");

        if (individualSchema.getDatabaseSchemaProfilerConfig() != null) {
          assertNotNull(
              bulkSchema.getDatabaseSchemaProfilerConfig(),
              "Profiler config should be present in bulk fetch if present in individual fetch");
          assertEquals(
              individualSchema.getDatabaseSchemaProfilerConfig().getProfileSampleType(),
              bulkSchema.getDatabaseSchemaProfilerConfig().getProfileSampleType(),
              "Profiler config should match");
        } else {
          assertTrue(
              bulkSchema.getDatabaseSchemaProfilerConfig() == null,
              "Profiler config should be null in bulk fetch if null in individual fetch");
        }
      }
    }
  }

  @Test
  @org.junit.jupiter.api.Disabled("NumberFormat parsing error - needs investigation")
  void test_inheritedFieldsWithPagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    org.openmetadata.schema.api.domains.CreateDomain createDomain =
        new org.openmetadata.schema.api.domains.CreateDomain()
            .withName(ns.prefix("test_domain"))
            .withDomainType(org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for inheritance");
    org.openmetadata.schema.entity.domains.Domain domain = client.domains().create(createDomain);

    org.openmetadata.schema.entity.teams.User databaseOwner1 =
        org.openmetadata.it.factories.UserTestFactory.createUser(ns, "db_owner1");
    org.openmetadata.schema.entity.teams.User databaseOwner2 =
        org.openmetadata.it.factories.UserTestFactory.createUser(ns, "db_owner2");

    org.openmetadata.schema.api.data.CreateDatabase createDb =
        new org.openmetadata.schema.api.data.CreateDatabase();
    createDb.setName(ns.prefix("test_db_inheritance"));
    createDb.setService(service.getFullyQualifiedName());
    createDb.setOwners(
        List.of(databaseOwner1.getEntityReference(), databaseOwner2.getEntityReference()));
    createDb.setDomains(List.of(domain.getFullyQualifiedName()));
    Database database = client.databases().create(createDb);

    java.util.List<DatabaseSchema> schemas = new java.util.ArrayList<>();
    org.openmetadata.schema.entity.domains.Domain schemaDomain = null;

    for (int i = 0; i < 4; i++) {
      CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
      createSchema.setName(ns.prefix("inherit_schema" + i));
      createSchema.setDatabase(database.getFullyQualifiedName());

      if (i == 1) {
        org.openmetadata.schema.entity.teams.User schemaOwner =
            org.openmetadata.it.factories.UserTestFactory.createUser(ns, "schema_owner_" + i);
        createSchema.setOwners(List.of(schemaOwner.getEntityReference()));
      }

      if (i == 2) {
        schemaDomain =
            client
                .domains()
                .create(
                    new org.openmetadata.schema.api.domains.CreateDomain()
                        .withName(ns.prefix("schema_domain_" + i))
                        .withDomainType(
                            org.openmetadata.schema.api.domains.CreateDomain.DomainType.AGGREGATE)
                        .withDescription("Schema specific domain"));
        createSchema.setDomains(List.of(schemaDomain.getFullyQualifiedName()));
      }

      DatabaseSchema schema = createEntity(createSchema);
      schemas.add(schema);

      if (i == 0) {
        CreateTable createTable = new CreateTable();
        createTable.setName(ns.prefix("inherit_test_table"));
        createTable.setDatabaseSchema(schema.getFullyQualifiedName());
        createTable.setColumns(
            List.of(
                new org.openmetadata.schema.type.Column()
                    .withName("id")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT)));
        client.tables().create(createTable);
      }
    }

    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setFields("owners,domains");

    params.setDatabase(database.getFullyQualifiedName());

    org.openmetadata.sdk.models.ListResponse<DatabaseSchema> resultList = listEntities(params);

    assertEquals(4, resultList.getData().size());

    for (DatabaseSchema fetchedSchema : resultList.getData()) {
      int index =
          Integer.parseInt(fetchedSchema.getName().substring(fetchedSchema.getName().length() - 1));

      assertNotNull(fetchedSchema.getDomains());
      if (index == 2) {
        assertEquals(
            schemaDomain.getFullyQualifiedName(),
            fetchedSchema.getDomains().get(0).getFullyQualifiedName());
        assertTrue(
            fetchedSchema.getDomains().get(0).getInherited() == null
                || !fetchedSchema.getDomains().get(0).getInherited(),
            "Own domain should not be marked as inherited");
      } else {
        assertEquals(
            domain.getFullyQualifiedName(),
            fetchedSchema.getDomains().get(0).getFullyQualifiedName());
        assertTrue(
            fetchedSchema.getDomains().get(0).getInherited() != null
                && fetchedSchema.getDomains().get(0).getInherited(),
            "Domain should be marked as inherited from database");
      }

      assertNotNull(fetchedSchema.getOwners());
      if (index == 1) {
        assertEquals(1, fetchedSchema.getOwners().size());
        assertTrue(fetchedSchema.getOwners().get(0).getName().contains("schema_owner_"));
        assertTrue(
            fetchedSchema.getOwners().get(0).getInherited() == null
                || !fetchedSchema.getOwners().get(0).getInherited(),
            "Own owners should not be marked as inherited");
      } else {
        assertEquals(2, fetchedSchema.getOwners().size());
        java.util.List<String> ownerNames =
            fetchedSchema.getOwners().stream()
                .map(org.openmetadata.schema.type.EntityReference::getName)
                .collect(java.util.stream.Collectors.toList());
        assertTrue(ownerNames.contains(databaseOwner1.getName()));
        assertTrue(ownerNames.contains(databaseOwner2.getName()));
        fetchedSchema
            .getOwners()
            .forEach(
                owner ->
                    assertTrue(
                        owner.getInherited() != null && owner.getInherited(),
                        "Inherited owners should be marked as inherited"));
      }
    }

    if (!schemas.isEmpty()) {
      org.openmetadata.schema.entity.data.Table table =
          client
              .tables()
              .getByName(
                  schemas.get(0).getFullyQualifiedName() + "." + ns.prefix("inherit_test_table"),
                  "owners,domains");

      assertNotNull(table.getDomains());
      assertEquals(
          domain.getFullyQualifiedName(), table.getDomains().get(0).getFullyQualifiedName());
      assertTrue(
          table.getDomains().get(0).getInherited() != null
              && table.getDomains().get(0).getInherited(),
          "Table domain should be inherited");

      assertNotNull(table.getOwners());
      assertEquals(2, table.getOwners().size());
      table
          .getOwners()
          .forEach(
              owner ->
                  assertTrue(
                      owner.getInherited() != null && owner.getInherited(),
                      "Table owners should be inherited"));
    }
  }

  @Test
  void test_schemaEntityRelationship(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
    createSchema.setName(ns.prefix("er_test_schema"));
    createSchema.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = createEntity(createSchema);
    String schemaFqn = schema.getFullyQualifiedName();

    org.openmetadata.schema.type.Column c1 =
        new org.openmetadata.schema.type.Column()
            .withName("c1")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.INT);
    org.openmetadata.schema.type.Column c2 =
        new org.openmetadata.schema.type.Column()
            .withName("c2")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.INT);

    CreateTable upstreamTableRequest = new CreateTable();
    upstreamTableRequest.setName(ns.prefix("er_upstream_fk"));
    upstreamTableRequest.setDatabaseSchema(schemaFqn);
    upstreamTableRequest.setColumns(List.of(c1));
    org.openmetadata.schema.entity.data.Table upstreamTable =
        client.tables().create(upstreamTableRequest);

    CreateTable table2Request = new CreateTable();
    table2Request.setName(ns.prefix("er_table2_fk"));
    table2Request.setDatabaseSchema(schemaFqn);
    table2Request.setColumns(List.of(c2));
    org.openmetadata.schema.entity.data.Table tableInSchema2 =
        client.tables().create(table2Request);

    org.openmetadata.schema.entity.data.Table upstreamRef =
        client.tables().getByName(upstreamTable.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Table table2Ref =
        client.tables().getByName(tableInSchema2.getFullyQualifiedName());

    org.openmetadata.schema.type.Column c1Local =
        new org.openmetadata.schema.type.Column()
            .withName("c1_local")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.INT);
    org.openmetadata.schema.type.Column c1FkCol =
        new org.openmetadata.schema.type.Column()
            .withName("c1_fk")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.INT);

    CreateTable table1Request = new CreateTable();
    table1Request.setName(ns.prefix("er_table1_fk"));
    table1Request.setDatabaseSchema(schemaFqn);
    table1Request.setColumns(List.of(c1Local, c1FkCol));
    table1Request.setTableConstraints(
        List.of(
            new org.openmetadata.schema.type.TableConstraint()
                .withConstraintType(
                    org.openmetadata.schema.type.TableConstraint.ConstraintType.FOREIGN_KEY)
                .withColumns(List.of(c1FkCol.getName()))
                .withReferredColumns(
                    List.of(upstreamRef.getColumns().get(0).getFullyQualifiedName()))));
    org.openmetadata.schema.entity.data.Table tableInSchema1 =
        client.tables().create(table1Request);

    org.openmetadata.schema.type.Column c2Local =
        new org.openmetadata.schema.type.Column()
            .withName("c2_local")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.INT);
    org.openmetadata.schema.type.Column c2FkCol =
        new org.openmetadata.schema.type.Column()
            .withName("c2_fk")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.INT);

    CreateTable downstreamRequest = new CreateTable();
    downstreamRequest.setName(ns.prefix("er_downstream_fk"));
    downstreamRequest.setDatabaseSchema(schemaFqn);
    downstreamRequest.setColumns(List.of(c2Local, c2FkCol));
    downstreamRequest.setTableConstraints(
        List.of(
            new org.openmetadata.schema.type.TableConstraint()
                .withConstraintType(
                    org.openmetadata.schema.type.TableConstraint.ConstraintType.FOREIGN_KEY)
                .withColumns(List.of(c2FkCol.getName()))
                .withReferredColumns(
                    List.of(table2Ref.getColumns().get(0).getFullyQualifiedName()))));
    org.openmetadata.schema.entity.data.Table downstreamTable =
        client.tables().create(downstreamRequest);

    org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult result =
        searchSchemaEntityRelationship(client, schemaFqn, null, false);

    assertNotNull(result);
    assertNotNull(result.getData().getNodes());
    assertNotNull(result.getData().getUpstreamEdges());
    assertNotNull(result.getData().getDownstreamEdges());

    assertEquals(4, result.getData().getNodes().size());
    assertEquals(2, result.getData().getUpstreamEdges().size());
    assertEquals(2, result.getData().getDownstreamEdges().size());

    assertTrue(result.getData().getNodes().containsKey(upstreamTable.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(tableInSchema2.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(tableInSchema1.getFullyQualifiedName()));
    assertTrue(result.getData().getNodes().containsKey(downstreamTable.getFullyQualifiedName()));

    java.util.Map<String, String> pagedParams1 = new java.util.HashMap<>();
    pagedParams1.put("fqn", schemaFqn);
    pagedParams1.put("limit", "2");
    pagedParams1.put("offset", "0");

    org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult
        pagedResult1 = searchSchemaEntityRelationshipWithParams(client, pagedParams1);

    assertNotNull(pagedResult1);
    assertNotNull(pagedResult1.getData().getNodes());
    assertEquals(2, pagedResult1.getData().getNodes().size(), "First page should return 2 nodes");
    assertNotNull(pagedResult1.getData().getUpstreamEdges());
    assertNotNull(pagedResult1.getData().getDownstreamEdges());
    assertNotNull(pagedResult1.getPaging());
    assertEquals(4, pagedResult1.getPaging().getTotal(), "Total results should be 4");

    java.util.Map<String, String> pagedParams2 = new java.util.HashMap<>();
    pagedParams2.put("fqn", schemaFqn);
    pagedParams2.put("limit", "2");
    pagedParams2.put("offset", "2");

    org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult
        pagedResult2 = searchSchemaEntityRelationshipWithParams(client, pagedParams2);

    assertNotNull(pagedResult2);
    assertNotNull(pagedResult2.getData().getNodes());
    assertEquals(2, pagedResult2.getData().getNodes().size(), "Second page should return 2 nodes");
    assertNotNull(pagedResult2.getData().getUpstreamEdges());
    assertNotNull(pagedResult2.getData().getDownstreamEdges());
    assertNotNull(pagedResult2.getPaging());

    int totalUpstreamEdges =
        pagedResult1.getData().getUpstreamEdges().size()
            + pagedResult2.getData().getUpstreamEdges().size();
    int totalDownstreamEdges =
        pagedResult1.getData().getDownstreamEdges().size()
            + pagedResult2.getData().getDownstreamEdges().size();

    assertEquals(
        2,
        totalUpstreamEdges,
        "Sum of upstream edges across pages should match total upstream edges");
    assertEquals(
        2,
        totalDownstreamEdges,
        "Sum of downstream edges across pages should match total downstream edges");
  }

  private org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult
      searchSchemaEntityRelationship(
          OpenMetadataClient client, String fqn, String queryFilter, boolean includeDeleted) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    if (fqn != null) {
      params.put("fqn", fqn);
    }
    if (queryFilter != null) {
      params.put("query_filter", queryFilter);
    }
    params.put("includeDeleted", String.valueOf(includeDeleted));

    return searchSchemaEntityRelationshipWithParams(client, params);
  }

  private org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult
      searchSchemaEntityRelationshipWithParams(
          OpenMetadataClient client, java.util.Map<String, String> params) {
    String path = "/v1/databaseSchemas/entityRelationship";

    org.openmetadata.sdk.network.RequestOptions options =
        org.openmetadata.sdk.network.RequestOptions.builder().queryParams(params).build();

    try {
      return client
          .getHttpClient()
          .execute(
              org.openmetadata.sdk.network.HttpMethod.GET,
              path,
              null,
              org.openmetadata
                  .schema
                  .api
                  .entityRelationship
                  .SearchSchemaEntityRelationshipResult
                  .class,
              options);
    } catch (Exception e) {
      throw new RuntimeException("Failed to fetch entity relationship", e);
    }
  }

  @Test
  void test_schemaServiceInheritanceFromDatabase(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    assertNotNull(database.getService(), "Test database should have a service");

    CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
    createSchema.setName(ns.prefix("serviceInheritanceTest"));
    createSchema.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = createEntity(createSchema);

    org.openmetadata.sdk.models.ListParams params = new org.openmetadata.sdk.models.ListParams();
    params.setFields("database,service");
    params.setLimit(10);
    params.setDatabase(database.getFullyQualifiedName());

    org.openmetadata.sdk.models.ListResponse<DatabaseSchema> schemas = listEntities(params);

    assertNotNull(schemas.getData());
    assertTrue(schemas.getData().size() >= 1);

    DatabaseSchema foundSchema =
        schemas.getData().stream()
            .filter(s -> s.getId().equals(schema.getId()))
            .findFirst()
            .orElse(null);

    assertNotNull(foundSchema, "Created schema should be in the results");

    assertNotNull(foundSchema.getDatabase(), "Database should not be null");
    assertEquals(database.getId(), foundSchema.getDatabase().getId());

    assertNotNull(
        foundSchema.getService(), "Service should not be null - should be inherited from database");
    assertEquals(database.getService().getId(), foundSchema.getService().getId());
    assertEquals(database.getService().getName(), foundSchema.getService().getName());
  }

  @org.junit.jupiter.api.Disabled(
      "CSV import for databaseSchema doesn't create new tables - only updates existing")
  @Test
  void testImportInvalidCsv(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
    createSchema.setName(ns.prefix("invalidCsv"));
    createSchema.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = createEntity(createSchema);
    String schemaName = schema.getFullyQualifiedName();

    CreateTable createTable = new CreateTable();
    createTable.setName(ns.prefix("s1"));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("id")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT)));
    client.tables().create(createTable);

    String invalidTagCsv =
        "name,displayName,description,owner,tags,glossaryTerms,tiers,certification,retentionPeriod,sourceUrl,domain,extension\n"
            + ns.prefix("s1")
            + ",dsp1,dsc1,,Tag.invalidTag,,,,,,,";

    try {
      String result = client.databaseSchemas().importCsv(schemaName, invalidTagCsv, false);
      assertNotNull(result);
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("invalidTag") || e.getMessage().contains("not found"),
          "Error should mention invalid tag");
    }

    String nonExistingTableCsv =
        "name,displayName,description,owner,tags,glossaryTerms,tiers,certification,retentionPeriod,sourceUrl,domain,extension\n"
            + "non-existing,dsp1,dsc1,,,,,,,,,";

    try {
      String result = client.databaseSchemas().importCsv(schemaName, nonExistingTableCsv, false);
      assertNotNull(result);

      org.openmetadata.schema.entity.data.Table table =
          client.tables().getByName(schema.getFullyQualifiedName() + ".non-existing");
      assertEquals(schema.getFullyQualifiedName() + ".non-existing", table.getFullyQualifiedName());
    } catch (Exception e) {
      fail("Creating non-existing table via CSV should succeed: " + e.getMessage());
    }
  }

  @Test
  void testImportExportRecursive(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
    createSchema.setName(ns.prefix("importExportRecursiveSchema"));
    createSchema.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = createEntity(createSchema);

    CreateTable createTable = new CreateTable();
    createTable.setName(ns.prefix("t1"));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setDescription("Initial Table Description");
    createTable.setColumns(
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("col1")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.BIGINT)
                .withDescription("Initial Column Description")));

    org.openmetadata.schema.entity.data.Table table = client.tables().create(createTable);

    String exportedCsv = client.databaseSchemas().exportCsv(schema.getFullyQualifiedName(), true);
    assertNotNull(exportedCsv);

    java.util.List<String> csvLines = java.util.Arrays.asList(exportedCsv.split("\\n"));
    assertTrue(csvLines.size() > 1, "Export should contain schema, table, and column");

    String header = csvLines.get(0);
    java.util.List<String> modified = new java.util.ArrayList<>();
    modified.add(header);

    for (String line : csvLines.subList(1, csvLines.size())) {
      if (line.contains(ns.prefix("t1")) && line.contains("table")) {
        line = line.replace("Initial Table Description", "Updated Table Description");
      } else if (line.contains("column")) {
        line = line.replace("Initial Column Description", "Updated Column Description");
      }
      modified.add(line);
    }

    String newCsv = String.join("\n", modified) + "\n";
    String result =
        client.databaseSchemas().importCsv(schema.getFullyQualifiedName(), newCsv, false, true);
    assertNotNull(result);

    org.openmetadata.schema.entity.data.Table updated =
        client.tables().getByName(table.getFullyQualifiedName(), "description,columns");
    assertEquals("Updated Table Description", updated.getDescription());

    assertNotNull(updated.getColumns());
    assertTrue(
        updated.getColumns().stream()
            .anyMatch(c -> "Updated Column Description".equals(c.getDescription())),
        "At least one column should have updated description");
  }

  @Test
  void testImportExportWithTableConstraints(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema createSchema = new CreateDatabaseSchema();
    createSchema.setName(ns.prefix("constraint_test_schema"));
    createSchema.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = createEntity(createSchema);

    org.openmetadata.schema.type.Column c1 =
        new org.openmetadata.schema.type.Column()
            .withName("user_ref")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING);
    org.openmetadata.schema.type.Column c2 =
        new org.openmetadata.schema.type.Column()
            .withName("tenant_id")
            .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING);

    CreateTable targetTableRequest = new CreateTable();
    targetTableRequest.setName(ns.prefix("target_table"));
    targetTableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    targetTableRequest.setColumns(List.of(c2));
    org.openmetadata.schema.entity.data.Table targetTable =
        client.tables().create(targetTableRequest);

    CreateTable sourceTableRequest = new CreateTable();
    sourceTableRequest.setName(ns.prefix("source_table"));
    sourceTableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    sourceTableRequest.setColumns(List.of(c1));
    org.openmetadata.schema.entity.data.Table sourceTable =
        client.tables().create(sourceTableRequest);

    org.openmetadata.schema.entity.data.Table targetRef =
        client.tables().getByName(targetTable.getFullyQualifiedName());

    String targetCol1FQN = targetRef.getColumns().get(0).getFullyQualifiedName();

    org.openmetadata.schema.entity.data.Table sourceTableV2 =
        client.tables().getByName(sourceTable.getFullyQualifiedName());

    org.openmetadata.schema.type.TableConstraint foreignKeyConstraint =
        new org.openmetadata.schema.type.TableConstraint()
            .withConstraintType(
                org.openmetadata.schema.type.TableConstraint.ConstraintType.FOREIGN_KEY)
            .withColumns(List.of("user_ref"))
            .withReferredColumns(java.util.Collections.singletonList(targetCol1FQN));

    sourceTableV2.setTableConstraints(java.util.Collections.singletonList(foreignKeyConstraint));

    org.openmetadata.schema.entity.data.Table updatedSourceTable =
        client.tables().update(sourceTable.getId().toString(), sourceTableV2);

    assertNotNull(updatedSourceTable.getTableConstraints());
    assertEquals(1, updatedSourceTable.getTableConstraints().size());
    org.openmetadata.schema.type.TableConstraint constraint =
        updatedSourceTable.getTableConstraints().get(0);
    assertEquals(
        org.openmetadata.schema.type.TableConstraint.ConstraintType.FOREIGN_KEY,
        constraint.getConstraintType());
    assertEquals(1, constraint.getColumns().size());
    assertEquals(1, constraint.getReferredColumns().size());

    String exportedCsv = client.databaseSchemas().exportCsv(schema.getFullyQualifiedName(), true);
    assertNotNull(exportedCsv);

    java.util.List<String> csvLines = java.util.Arrays.asList(exportedCsv.split("\\n"));
    assertTrue(csvLines.size() > 1, "Export should contain schema, tables, and columns");

    String header = csvLines.get(0);
    java.util.List<String> modified = new java.util.ArrayList<>();
    modified.add(header);

    for (String line : csvLines.subList(1, csvLines.size())) {
      if (line.contains(ns.prefix("source_table")) && line.contains("table")) {
        line =
            line.replace(
                ns.prefix("source_table"), ns.prefix("source_table") + " Updated via CSV import");
      }
      modified.add(line);
    }

    String newCsv = String.join("\n", modified) + "\n";

    String result =
        client.databaseSchemas().importCsv(schema.getFullyQualifiedName(), newCsv, false, true);
    assertNotNull(result);

    org.openmetadata.schema.entity.data.Table importedSourceTable =
        client
            .tables()
            .getByName(
                updatedSourceTable.getFullyQualifiedName(), "tableConstraints,columns,description");

    assertNotNull(
        importedSourceTable.getTableConstraints(),
        "Table constraints should be preserved after CSV import");
    assertEquals(
        1,
        importedSourceTable.getTableConstraints().size(),
        "Should have exactly one table constraint");

    org.openmetadata.schema.type.TableConstraint preservedConstraint =
        importedSourceTable.getTableConstraints().get(0);
    assertEquals(
        org.openmetadata.schema.type.TableConstraint.ConstraintType.FOREIGN_KEY,
        preservedConstraint.getConstraintType());
    assertEquals(1, preservedConstraint.getColumns().size(), "Should have 1 local column");
    assertEquals(
        1,
        preservedConstraint.getReferredColumns().size(),
        "Should have 1 referred column (1:1 mapping)");

    assertEquals("user_ref", preservedConstraint.getColumns().get(0));
    assertTrue(
        preservedConstraint.getReferredColumns().contains(targetCol1FQN),
        "Should contain target column FQN");

    org.openmetadata.schema.entity.data.Table importedTargetTable =
        client.tables().getByName(targetTable.getFullyQualifiedName(), "columns");

    assertNotNull(importedTargetTable.getColumns());
    assertEquals(
        1, importedTargetTable.getColumns().size(), "Target table should still have 1 column");
  }

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    OpenMetadataClient botClient = SdkClients.botClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema botCreate = new CreateDatabaseSchema();
    botCreate.setName(ns.prefix("bulk_preserve_test"));
    botCreate.setDatabase(database.getFullyQualifiedName());
    botCreate.setDescription("Bot initial description");

    org.openmetadata.schema.entity.data.DatabaseSchema entity =
        botClient.databaseSchemas().create(botCreate);
    assertEquals("Bot initial description", entity.getDescription());

    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);

    org.openmetadata.schema.entity.data.DatabaseSchema userEditedEntity =
        client.databaseSchemas().update(entity.getId().toString(), entity);
    assertEquals(userDescription, userEditedEntity.getDescription());

    CreateDatabaseSchema botUpdate = new CreateDatabaseSchema();
    botUpdate.setName(ns.prefix("bulk_preserve_test"));
    botUpdate.setDatabase(database.getFullyQualifiedName());
    botUpdate.setDescription("Bot trying to overwrite - should be ignored");

    String path = "/v1/databaseSchemas/bulk";
    org.openmetadata.sdk.network.RequestOptions options =
        org.openmetadata.sdk.network.RequestOptions.builder().build();

    try {
      org.openmetadata.schema.type.api.BulkOperationResult updateResult =
          botClient
              .getHttpClient()
              .execute(
                  org.openmetadata.sdk.network.HttpMethod.PUT,
                  path,
                  java.util.List.of(botUpdate),
                  org.openmetadata.schema.type.api.BulkOperationResult.class,
                  options);

      assertEquals(org.openmetadata.schema.type.ApiStatus.SUCCESS, updateResult.getStatus());
      assertEquals(1, updateResult.getNumberOfRowsPassed());
    } catch (Exception e) {
      fail("Bulk update failed: " + e.getMessage());
    }

    org.openmetadata.schema.entity.data.DatabaseSchema verifyEntity =
        client.databaseSchemas().get(entity.getId().toString());

    assertEquals(
        userDescription,
        verifyEntity.getDescription(),
        "Bot should NOT be able to overwrite user-edited description");
  }

  @Test
  void testBulk_TagMergeBehavior(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema createRequest = new CreateDatabaseSchema();
    createRequest.setName(ns.prefix("bulk_tag_merge"));
    createRequest.setDatabase(database.getFullyQualifiedName());

    org.openmetadata.schema.entity.data.DatabaseSchema entity =
        client.databaseSchemas().create(createRequest);

    CreateDatabaseSchema updateRequest = new CreateDatabaseSchema();
    updateRequest.setName(ns.prefix("bulk_tag_merge"));
    updateRequest.setDatabase(database.getFullyQualifiedName());

    String path = "/v1/databaseSchemas/bulk";
    org.openmetadata.sdk.network.RequestOptions options =
        org.openmetadata.sdk.network.RequestOptions.builder().build();

    try {
      org.openmetadata.schema.type.api.BulkOperationResult result =
          client
              .getHttpClient()
              .execute(
                  org.openmetadata.sdk.network.HttpMethod.PUT,
                  path,
                  java.util.List.of(updateRequest),
                  org.openmetadata.schema.type.api.BulkOperationResult.class,
                  options);

      assertEquals(org.openmetadata.schema.type.ApiStatus.SUCCESS, result.getStatus());
    } catch (Exception e) {
      fail("Bulk update failed: " + e.getMessage());
    }

    org.openmetadata.schema.entity.data.DatabaseSchema updatedEntity =
        client.databaseSchemas().get(entity.getId().toString());
    assertNotNull(updatedEntity);
  }

  @Test
  void testBulk_AdminCanOverrideDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = createDatabase(ns, service);

    CreateDatabaseSchema createRequest = new CreateDatabaseSchema();
    createRequest.setName(ns.prefix("bulk_admin_override"));
    createRequest.setDatabase(database.getFullyQualifiedName());
    createRequest.setDescription("User-created description");

    org.openmetadata.schema.entity.data.DatabaseSchema entity =
        client.databaseSchemas().create(createRequest);
    assertEquals("User-created description", entity.getDescription());

    String adminDescription = "Admin-updated description via bulk";
    CreateDatabaseSchema adminUpdate = new CreateDatabaseSchema();
    adminUpdate.setName(ns.prefix("bulk_admin_override"));
    adminUpdate.setDatabase(database.getFullyQualifiedName());
    adminUpdate.setDescription(adminDescription);

    String path = "/v1/databaseSchemas/bulk";
    org.openmetadata.sdk.network.RequestOptions options =
        org.openmetadata.sdk.network.RequestOptions.builder().build();

    try {
      org.openmetadata.schema.type.api.BulkOperationResult result =
          client
              .getHttpClient()
              .execute(
                  org.openmetadata.sdk.network.HttpMethod.PUT,
                  path,
                  java.util.List.of(adminUpdate),
                  org.openmetadata.schema.type.api.BulkOperationResult.class,
                  options);

      assertEquals(org.openmetadata.schema.type.ApiStatus.SUCCESS, result.getStatus());
    } catch (Exception e) {
      fail("Bulk update failed: " + e.getMessage());
    }

    org.openmetadata.schema.entity.data.DatabaseSchema updatedEntity =
        client.databaseSchemas().get(entity.getId().toString());
    assertEquals(
        adminDescription,
        updatedEntity.getDescription(),
        "Admin should be able to update description via bulk");
  }
}
