package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
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
import org.openmetadata.schema.type.api.BulkOperationResult;
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

  {
    supportsSearchIndex = false;
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

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

  @Test
  void post_storedProcedureWithInvalidDatabase_404(TestNamespace ns) {
    CreateStoredProcedure request =
        createRequest(ns.prefix("proc_invalid_schema"), ns).withDatabaseSchema("nonExistentSchema");

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating stored procedure with non-existent schema should fail");
  }

  @Test
  void patch_storedProcedureCodeLanguage_200_OK(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode initialCode =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE test_proc() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_patch_code"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(initialCode);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);
    assertEquals(StoredProcedureLanguage.SQL, proc.getStoredProcedureCode().getLanguage());

    String updatedCodeString =
        "sales_vw\n"
            + "create view sales_vw as\n"
            + "select * from public.sales\n"
            + "union all\n"
            + "select * from spectrum.sales\n"
            + "with no schema binding;";

    StoredProcedureCode updatedCode =
        new StoredProcedureCode()
            .withCode(updatedCodeString)
            .withLanguage(StoredProcedureLanguage.SQL);

    proc.setStoredProcedureCode(updatedCode);
    StoredProcedure updated = patchEntity(proc.getId().toString(), proc);

    assertNotNull(updated);
    assertNotNull(updated.getStoredProcedureCode());
    assertEquals(updatedCodeString, updated.getStoredProcedureCode().getCode());
    assertEquals(StoredProcedureLanguage.SQL, updated.getStoredProcedureCode().getLanguage());
  }

  @Test
  void patch_storedProcedureCodeOnly_200_OK(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode initialCode =
        new StoredProcedureCode().withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_patch_code_only"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(initialCode);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);

    String codeString =
        "sales_vw\n"
            + "create view sales_vw as\n"
            + "select * from public.sales\n"
            + "union all\n"
            + "select * from spectrum.sales\n"
            + "with no schema binding;";

    proc.getStoredProcedureCode().setCode(codeString);
    StoredProcedure updated = patchEntity(proc.getId().toString(), proc);

    assertNotNull(updated);
    assertNotNull(updated.getStoredProcedureCode());
    assertEquals(codeString, updated.getStoredProcedureCode().getCode());
  }

  @Test
  void patch_usingFqn_storedProcedureCode_200(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode initialCode =
        new StoredProcedureCode().withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_patch_fqn"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(initialCode);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);

    String codeString =
        "sales_vw\n"
            + "create view sales_vw as\n"
            + "select * from public.sales\n"
            + "union all\n"
            + "select * from spectrum.sales\n"
            + "with no schema binding;";

    StoredProcedureCode updatedCode =
        new StoredProcedureCode().withCode(codeString).withLanguage(StoredProcedureLanguage.SQL);

    proc.setStoredProcedureCode(updatedCode);

    StoredProcedure fetched = getEntityByName(proc.getFullyQualifiedName());
    fetched.setStoredProcedureCode(updatedCode);
    StoredProcedure updated = patchEntity(fetched.getId().toString(), fetched);

    assertNotNull(updated);
    assertNotNull(updated.getStoredProcedureCode());
    assertEquals(codeString, updated.getStoredProcedureCode().getCode());
    assertEquals(proc.getFullyQualifiedName(), updated.getFullyQualifiedName());
  }

  @Test
  void test_validateGetWithDifferentFields(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode(
                "CREATE OR REPLACE PROCEDURE test_fields() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_test_fields"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(code);

    StoredProcedure proc = createEntity(request);

    StoredProcedure fetchedById = getEntity(proc.getId().toString());
    assertNotNull(fetchedById.getService());
    assertNotNull(fetchedById.getServiceType());
    assertNotNull(fetchedById.getDatabase());
    assertNotNull(fetchedById.getDatabaseSchema());
    assertNotNull(fetchedById.getStoredProcedureCode());

    StoredProcedure fetchedByName = getEntityByName(proc.getFullyQualifiedName());
    assertNotNull(fetchedByName.getService());
    assertNotNull(fetchedByName.getServiceType());
    assertNotNull(fetchedByName.getDatabase());
    assertNotNull(fetchedByName.getDatabaseSchema());
    assertNotNull(fetchedByName.getStoredProcedureCode());

    String fields = "owners,tags,followers";
    StoredProcedure fetchedWithFields = getEntityWithFields(proc.getId().toString(), fields);
    assertNotNull(fetchedWithFields.getService());
    assertNotNull(fetchedWithFields.getServiceType());
    assertNotNull(fetchedWithFields.getDatabaseSchema());
    assertNotNull(fetchedWithFields.getDatabase());
  }

  @Test
  void test_storedProcedureLanguages(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    for (StoredProcedureLanguage language :
        new StoredProcedureLanguage[] {
          StoredProcedureLanguage.SQL, StoredProcedureLanguage.Python, StoredProcedureLanguage.Java
        }) {
      StoredProcedureCode code =
          new StoredProcedureCode()
              .withCode("PROCEDURE code for " + language)
              .withLanguage(language);

      CreateStoredProcedure request = new CreateStoredProcedure();
      request.setName(ns.prefix("proc_lang_" + language.value()));
      request.setDatabaseSchema(schema.getFullyQualifiedName());
      request.setStoredProcedureCode(code);

      StoredProcedure proc = createEntity(request);
      assertNotNull(proc);
      assertEquals(language, proc.getStoredProcedureCode().getLanguage());
      assertEquals("PROCEDURE code for " + language, proc.getStoredProcedureCode().getCode());
    }
  }

  @Test
  void test_storedProcedureCodeUpdate(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode initialCode =
        new StoredProcedureCode()
            .withCode("CREATE PROCEDURE v1() AS $$ BEGIN RETURN; END; $$")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_code_update"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(initialCode);

    StoredProcedure proc = createEntity(request);
    Double initialVersion = proc.getVersion();

    String updatedCodeString = "CREATE PROCEDURE v2() AS $$ BEGIN RETURN 42; END; $$";
    proc.getStoredProcedureCode().setCode(updatedCodeString);
    StoredProcedure updated = patchEntity(proc.getId().toString(), proc);

    assertNotNull(updated);
    assertEquals(updatedCodeString, updated.getStoredProcedureCode().getCode());
    assertTrue(updated.getVersion() > initialVersion, "Version should increment after code update");
  }

  @Test
  void test_storedProcedureFQNGeneration(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode("CREATE PROCEDURE fqn_test() AS $$ BEGIN RETURN; END; $$")
            .withLanguage(StoredProcedureLanguage.SQL);

    String procName = ns.prefix("proc_fqn");
    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(procName);
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(code);

    StoredProcedure proc = createEntity(request);
    assertNotNull(proc);

    String expectedFqn = schema.getFullyQualifiedName() + "." + procName;
    assertEquals(expectedFqn, proc.getFullyQualifiedName());
    assertTrue(proc.getFullyQualifiedName().contains(procName));
    assertTrue(proc.getFullyQualifiedName().contains(schema.getName()));
  }

  @Test
  void test_storedProcedureVersionHistory(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode("CREATE PROCEDURE v1() AS $$ BEGIN RETURN; END; $$")
            .withLanguage(StoredProcedureLanguage.SQL);

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("proc_version"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(code);

    StoredProcedure proc = createEntity(request);
    Double version1 = proc.getVersion();

    proc.setDescription("Updated description");
    StoredProcedure updated = patchEntity(proc.getId().toString(), proc);
    Double version2 = updated.getVersion();

    assertTrue(version2 > version1, "Version should increment after update");

    EntityHistory history = getVersionHistory(proc.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2, "Should have at least 2 versions");

    StoredProcedure historicalVersion = getVersion(proc.getId(), version1);
    assertNotNull(historicalVersion);
    assertEquals(version1, historicalVersion.getVersion());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateStoredProcedure> createRequests) {
    return SdkClients.adminClient().storedProcedures().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateStoredProcedure> createRequests) {
    return SdkClients.adminClient().storedProcedures().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateStoredProcedure createInvalidRequestForBulk(TestNamespace ns) {
    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.prefix("invalid_stored_proc"));
    return request;
  }
}
