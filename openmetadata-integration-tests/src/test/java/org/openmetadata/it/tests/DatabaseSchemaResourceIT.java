package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
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

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDatabaseSchema createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    Database database = createDatabase(client, ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema"));
    request.setDatabase(database.getFullyQualifiedName());
    request.setDescription("Test schema created by integration test");

    return request;
  }

  @Override
  protected CreateDatabaseSchema createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    Database database = createDatabase(client, ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(name);
    request.setDatabase(database.getFullyQualifiedName());

    return request;
  }

  private Database createDatabase(
      OpenMetadataClient client, TestNamespace ns, DatabaseService service) {
    CreateDatabase dbRequest = new CreateDatabase();
    dbRequest.setName(ns.prefix("database"));
    dbRequest.setService(service.getFullyQualifiedName());
    return client.databases().create(dbRequest);
  }

  @Override
  protected DatabaseSchema createEntity(
      CreateDatabaseSchema createRequest, OpenMetadataClient client) {
    return client.databaseSchemas().create(createRequest);
  }

  @Override
  protected DatabaseSchema getEntity(String id, OpenMetadataClient client) {
    return client.databaseSchemas().get(id);
  }

  @Override
  protected DatabaseSchema getEntityByName(String fqn, OpenMetadataClient client) {
    return client.databaseSchemas().getByName(fqn);
  }

  @Override
  protected DatabaseSchema patchEntity(
      String id, DatabaseSchema entity, OpenMetadataClient client) {
    return client.databaseSchemas().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.databaseSchemas().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.databaseSchemas().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.databaseSchemas().delete(id, params);
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
  protected ListResponse<DatabaseSchema> listEntities(
      ListParams params, OpenMetadataClient client) {
    return client.databaseSchemas().list(params);
  }

  @Override
  protected DatabaseSchema getEntityWithFields(
      String id, String fields, OpenMetadataClient client) {
    return client.databaseSchemas().get(id, fields);
  }

  @Override
  protected DatabaseSchema getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.databaseSchemas().getByName(fqn, fields);
  }

  @Override
  protected DatabaseSchema getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.databaseSchemas().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.databaseSchemas().getVersionList(id);
  }

  @Override
  protected DatabaseSchema getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.databaseSchemas().getVersion(id.toString(), version);
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
        () -> createEntity(request, client),
        "Creating schema without database should fail");
  }

  @Test
  void post_schemaWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    Database database = createDatabase(client, ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema_with_url"));
    request.setDatabase(database.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:5432/mydb/myschema");

    DatabaseSchema schema = createEntity(request, client);
    assertNotNull(schema);
    assertEquals("http://localhost:5432/mydb/myschema", schema.getSourceUrl());
  }

  @Test
  void put_schemaDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    Database database = createDatabase(client, ns, service);

    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema_update_desc"));
    request.setDatabase(database.getFullyQualifiedName());
    request.setDescription("Initial description");

    DatabaseSchema schema = createEntity(request, client);
    assertEquals("Initial description", schema.getDescription());

    // Update description
    schema.setDescription("Updated description");
    DatabaseSchema updated = patchEntity(schema.getId().toString(), schema, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_schemaInheritsDomainFromDatabase(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create database service and database
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(client, ns);
    Database database = createDatabase(client, ns, service);

    // Create schema under the database
    CreateDatabaseSchema request = new CreateDatabaseSchema();
    request.setName(ns.prefix("schema_inherit_domain"));
    request.setDatabase(database.getFullyQualifiedName());

    DatabaseSchema schema = createEntity(request, client);
    assertNotNull(schema);
    assertNotNull(schema.getDatabase());
    assertEquals(database.getFullyQualifiedName(), schema.getDatabase().getFullyQualifiedName());
  }
}
