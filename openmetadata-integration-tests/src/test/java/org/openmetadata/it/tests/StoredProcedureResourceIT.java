package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for StoredProcedure entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds stored procedure-specific tests for
 * code, language, and schema relationships.
 *
 * <p>Migrated from: org.openmetadata.service.resources.databases.StoredProcedureResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class StoredProcedureResourceIT
    extends BaseEntityIT<StoredProcedure, CreateStoredProcedure> {

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateStoredProcedure createMinimalRequest(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE test_proc() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("storedproc"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setDescription("Test stored procedure created by integration test");
    request.setStoredProcedureCode(code);

    return request;
  }

  @Override
  protected CreateStoredProcedure createRequest(String name, TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE "
                    + name
                    + "() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(name);
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(code);

    return request;
  }

  @Override
  protected StoredProcedure createEntity(CreateStoredProcedure createRequest) {
    return SdkClients.adminClient().storedProcedures().create(createRequest);
  }

  @Override
  protected StoredProcedure getEntity(String id) {
    return SdkClients.adminClient().storedProcedures().get(id);
  }

  @Override
  protected StoredProcedure getEntityByName(String fqn) {
    return SdkClients.adminClient().storedProcedures().getByName(fqn);
  }

  @Override
  protected StoredProcedure patchEntity(String id, StoredProcedure entity) {
    return SdkClients.adminClient().storedProcedures().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().storedProcedures().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().storedProcedures().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().storedProcedures().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "storedProcedure";
  }

  @Override
  protected void validateCreatedEntity(
      StoredProcedure entity, CreateStoredProcedure createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getDatabaseSchema(), "StoredProcedure must have a database schema");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain stored procedure name");
  }

  @Override
  protected ListResponse<StoredProcedure> listEntities(ListParams params) {
    return SdkClients.adminClient().storedProcedures().list(params);
  }

  @Override
  protected StoredProcedure getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().storedProcedures().get(id, fields);
  }

  @Override
  protected StoredProcedure getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().storedProcedures().getByName(fqn, fields);
  }

  @Override
  protected StoredProcedure getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().storedProcedures().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().storedProcedures().getVersionList(id);
  }

  @Override
  protected StoredProcedure getVersion(UUID id, Double version) {
    return SdkClients.adminClient().storedProcedures().getVersion(id.toString(), version);
  }

  // ===================================================================
  // STORED PROCEDURE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_storedProcWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Database schema is required field
    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_no_schema"));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating stored procedure without schema should fail");
  }

  @Test
  void post_storedProcWithCode_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE my_proc() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_with_code"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(code);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);
    assertNotNull(proc.getStoredProcedureCode());
    assertEquals(StoredProcedureLanguage.SQL, proc.getStoredProcedureCode().getLanguage());
  }

  @Test
  void post_storedProcWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE proc_url() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_with_url"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:5432/mydb/myschema/myproc");
    request.setStoredProcedureCode(code);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);
    assertEquals("http://localhost:5432/mydb/myschema/myproc", proc.getSourceUrl());
  }

  @Test
  void put_storedProcCode_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode initialCode =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE initial() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_update_code"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(initialCode);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);

    // Update code via patch
    StoredProcedureCode updatedCode =
        new StoredProcedureCode()
            .withCode("SELECT * FROM my_table")
            .withLanguage(StoredProcedureLanguage.SQL);

    proc.setStoredProcedureCode(updatedCode);
    StoredProcedure updated = patchEntity(proc.getId().toString(), proc);
    assertNotNull(updated);
    assertNotNull(updated.getStoredProcedureCode());
  }

  @Test
  void test_storedProcInheritsDomainFromSchema(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create database service and schema
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE inherit() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    // Create stored procedure under the schema
    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_inherit_domain"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(code);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);
    assertNotNull(proc.getDatabaseSchema());
    assertEquals(schema.getFullyQualifiedName(), proc.getDatabaseSchema().getFullyQualifiedName());
  }
}
