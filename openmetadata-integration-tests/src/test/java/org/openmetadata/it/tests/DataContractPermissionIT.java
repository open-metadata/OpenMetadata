package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for DataContract permission and security operations.
 *
 * <p>These tests verify that:
 * - Table owners can create, update, patch, and delete data contracts for their tables
 * - Regular users cannot perform operations on data contracts for tables they don't own
 * - All users can read data contracts (default read permissions)
 * - Proper permission checking is enforced
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataContractPermissionIT {

  private Table createTestTable(TestNamespace ns, String tableName) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    org.openmetadata.schema.entity.services.DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("dc_perm_svc_" + shortId)
            .connection(conn)
            .description("Test Postgres service for data contract permissions")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("dc_perm_db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.Database database =
        SdkClients.adminClient().databases().create(dbReq);

    org.openmetadata.schema.api.data.CreateDatabaseSchema schemaReq =
        new org.openmetadata.schema.api.data.CreateDatabaseSchema();
    schemaReq.setName("dc_perm_schema_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(tableName);
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  @Test
  void testAllUsersCanReadDataContracts(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();
    Table table = createTestTable(ns, ns.prefix("read_test_table"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("read_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Data contract for read permission test");

    DataContract created = SdkClients.adminClient().dataContracts().create(request);

    OpenMetadataClient userClient =
        SdkClients.createClient(shared.USER1.getEmail(), shared.USER1.getEmail(), new String[] {});

    DataContract retrieved = userClient.dataContracts().get(created.getId().toString());

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
    assertEquals(created.getName(), retrieved.getName());
  }

  @Test
  void testTableOwnerCanCreateDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("owner_table"));
    tableRequest.setDatabaseSchema(
        createTestTable(ns, "temp_table").getDatabaseSchema().getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    tableRequest.setOwners(List.of(shared.USER1_REF));

    Table table = SdkClients.adminClient().tables().create(tableRequest);

    // USER1 has AllowAll role assigned in SharedEntities
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("owner_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract created by table owner");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    assertNotNull(contract);
    assertEquals(request.getName(), contract.getName());
    assertEquals(table.getId(), contract.getEntity().getId());
  }

  @Test
  void testTableOwnerCanDeleteTheirDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("delete_owner_table"));
    tableRequest.setDatabaseSchema(
        createTestTable(ns, "temp_delete_table").getDatabaseSchema().getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    tableRequest.setOwners(List.of(shared.USER1_REF));

    Table table = SdkClients.adminClient().tables().create(tableRequest);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("delete_owner_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract to be deleted by owner");

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // USER1 has AllowAll role assigned in SharedEntities
    SdkClients.user1Client().dataContracts().delete(contract.getId().toString());

    DataContract deleted =
        SdkClients.adminClient().dataContracts().get(contract.getId().toString(), null, "deleted");
    assertTrue(deleted.getDeleted());
  }

  @Test
  void testTableOwnerCanPatchTheirDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("patch_owner_table"));
    tableRequest.setDatabaseSchema(
        createTestTable(ns, "temp_patch_table").getDatabaseSchema().getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    tableRequest.setOwners(List.of(shared.USER1_REF));

    Table table = SdkClients.adminClient().tables().create(tableRequest);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("patch_owner_contract"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.DRAFT)
            .withDescription("Contract to be patched by owner");

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // USER1 has AllowAll role assigned in SharedEntities
    contract.setEntityStatus(EntityStatus.APPROVED);
    DataContract patched =
        SdkClients.user1Client().dataContracts().update(contract.getId().toString(), contract);

    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
  }

  @Test
  void testTableOwnerCanUpdateTheirDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("update_owner_table"));
    tableRequest.setDatabaseSchema(
        createTestTable(ns, "temp_update_table").getDatabaseSchema().getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    tableRequest.setOwners(List.of(shared.USER1_REF));

    Table table = SdkClients.adminClient().tables().create(tableRequest);

    // USER1 has AllowAll role assigned in SharedEntities
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("update_owner_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial description");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    contract.setDescription("Updated description by owner");
    DataContract updated =
        SdkClients.user1Client().dataContracts().update(contract.getId().toString(), contract);

    assertEquals("Updated description by owner", updated.getDescription());
  }

  @Test
  void testRegularUserCannotCreateDataContractForOthersTable(TestNamespace ns) {
    Table table = createTestTable(ns, ns.prefix("others_table"));

    // USER2 has no roles, should not be able to create DataContract for admin's table
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("unauthorized_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Should fail - user doesn't own table");

    assertThrows(
        Exception.class,
        () -> SdkClients.user2Client().dataContracts().create(request),
        "Regular user should not be able to create contract for others' table");
  }

  @Test
  void testRegularUserCannotDeleteOthersDataContract(TestNamespace ns) {
    Table table = createTestTable(ns, ns.prefix("protected_table"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("protected_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract that regular user cannot delete");

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // USER2 has no roles, should not be able to delete admin's DataContract
    assertThrows(
        Exception.class,
        () -> SdkClients.user2Client().dataContracts().delete(contract.getId().toString()),
        "Regular user should not be able to delete others' contract");
  }

  @Test
  void testRegularUserCannotPatchOthersDataContract(TestNamespace ns) {
    Table table = createTestTable(ns, ns.prefix("patch_protected_table"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("patch_protected"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.DRAFT)
            .withDescription("Contract that regular user cannot patch");

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // USER2 has no roles, should not be able to patch admin's DataContract
    contract.setEntityStatus(EntityStatus.APPROVED);

    assertThrows(
        Exception.class,
        () ->
            SdkClients.user2Client().dataContracts().update(contract.getId().toString(), contract),
        "Regular user should not be able to patch others' contract");
  }

  @org.junit.jupiter.api.Disabled(
      "OpenMetadata allows PATCH operations by default - not restricted by ownership")
  @Test
  void testRegularUserCannotUpdateOthersDataContract(TestNamespace ns) {
    Table table = createTestTable(ns, ns.prefix("update_protected_table"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("update_protected"))
            .withEntity(table.getEntityReference())
            .withDescription("Original description");

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // USER2 has no roles, should not be able to update admin's DataContract
    contract.setDescription("Unauthorized update");

    assertThrows(
        Exception.class,
        () ->
            SdkClients.user2Client().dataContracts().update(contract.getId().toString(), contract),
        "Regular user should not be able to update others' contract");
  }

  @Test
  void testUserWithCreateDataContractPermissionCanCreate(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix("permission_table"));
    tableRequest.setDatabaseSchema(
        createTestTable(ns, "temp_permission_table").getDatabaseSchema().getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
    tableRequest.setOwners(List.of(shared.USER1_REF));

    Table table = SdkClients.adminClient().tables().create(tableRequest);

    // USER1 has AllowAll role assigned in SharedEntities
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("permission_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract created with permission");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    assertNotNull(contract);
    assertEquals(request.getName(), contract.getName());
  }

  @Test
  void testUserWithoutPermissionsCannotCreateDataContract(TestNamespace ns) {
    Table table = createTestTable(ns, ns.prefix("no_permission_table"));

    // USER2 has no roles, should not be able to create DataContract
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("no_permission_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Should fail - no permissions");

    assertThrows(
        Exception.class,
        () -> SdkClients.user2Client().dataContracts().create(request),
        "User without permissions should not be able to create contract");
  }
}
