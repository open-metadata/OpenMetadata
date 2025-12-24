package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for DataContract entity operations.
 *
 * <p>DataContract entities define schema and quality guarantees for data assets.
 * They can be attached to tables, topics, dashboards, etc.
 *
 * <p>Migrated from: org.openmetadata.service.resources.data.DataContractResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DataContractResourceIT extends BaseEntityIT<DataContract, CreateDataContract> {

  {
    supportsFollowers = false;
    supportsOwners = false;
    supportsTags = false;
    supportsDataProducts = false;
    supportsDomains = false;
    supportsPatchDomains = false;
    supportsSearchIndex = false; // DataContract doesn't have a search index
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDataContract createMinimalRequest(TestNamespace ns) {
    Table table = createTestTable(ns);

    return new CreateDataContract()
        .withName(ns.prefix("datacontract"))
        .withEntity(table.getEntityReference())
        .withDescription("Data contract for integration test");
  }

  @Override
  protected CreateDataContract createRequest(String name, TestNamespace ns) {
    Table table = createTestTable(ns);

    return new CreateDataContract()
        .withName(name)
        .withEntity(table.getEntityReference())
        .withDescription("Data contract created by integration test");
  }

  private Table createTestTable(TestNamespace ns) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("dc_svc_" + shortId)
            .connection(conn)
            .description("Test Postgres service for data contract")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("dc_db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("dc_schema_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName("dc_table_" + shortId);
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

  @Override
  protected DataContract createEntity(CreateDataContract createRequest) {
    return SdkClients.adminClient().dataContracts().create(createRequest);
  }

  @Override
  protected DataContract getEntity(String id) {
    return SdkClients.adminClient().dataContracts().get(id);
  }

  @Override
  protected DataContract getEntityByName(String fqn) {
    return SdkClients.adminClient().dataContracts().getByName(fqn);
  }

  @Override
  protected DataContract patchEntity(String id, DataContract entity) {
    return SdkClients.adminClient().dataContracts().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().dataContracts().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().dataContracts().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().dataContracts().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "dataContract";
  }

  @Override
  protected void validateCreatedEntity(DataContract entity, CreateDataContract createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getEntity(), "DataContract must have an entity reference");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<DataContract> listEntities(ListParams params) {
    return SdkClients.adminClient().dataContracts().list(params);
  }

  @Override
  protected DataContract getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().dataContracts().get(id, fields);
  }

  @Override
  protected DataContract getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().dataContracts().getByName(fqn, fields);
  }

  @Override
  protected DataContract getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().dataContracts().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().dataContracts().getVersionList(id);
  }

  @Override
  protected DataContract getVersion(UUID id, Double version) {
    return SdkClients.adminClient().dataContracts().getVersion(id.toString(), version);
  }

  // ===================================================================
  // OVERRIDDEN TESTS - DataContract FQN doesn't quote dots in names
  // ===================================================================

  @Override
  @Test
  void post_entityWithDots_200(TestNamespace ns) {
    // DataContract FQN uses a different pattern that doesn't quote dots in names
    // Just verify that the entity can be created with dots in name
    String nameWithDots = ns.prefix("foo.bar");
    CreateDataContract createRequest = createRequest(nameWithDots, ns);
    DataContract created = createEntity(createRequest);

    assertNotNull(created.getId());
    assertEquals(nameWithDots, created.getName());
    assertNotNull(created.getFullyQualifiedName());
  }

  // ===================================================================
  // DATA CONTRACT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void testCreateDataContract(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("test_create"))
            .withEntity(table.getEntityReference())
            .withDescription("Test data contract creation");

    DataContract contract = createEntity(request);

    assertNotNull(contract);
    assertNotNull(contract.getId());
    assertEquals(request.getName(), contract.getName());
    assertEquals(request.getDescription(), contract.getDescription());
    assertNotNull(contract.getEntity());
    assertEquals(table.getId(), contract.getEntity().getId());
  }

  @Test
  void testGetDataContractByEntityId(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("test_get_by_entity"))
            .withEntity(table.getEntityReference())
            .withDescription("Test get by entity ID");

    DataContract contract = createEntity(request);

    DataContract fetched =
        SdkClients.adminClient().dataContracts().getByEntityId(table.getId(), "table");

    assertNotNull(fetched);
    assertEquals(contract.getId(), fetched.getId());
  }

  @Test
  void testUpdateDataContract(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("test_update"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial description");

    DataContract contract = createEntity(request);
    assertEquals("Initial description", contract.getDescription());

    contract.setDescription("Updated description");
    DataContract updated = patchEntity(contract.getId().toString(), contract);

    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void testDeleteDataContract(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("test_delete"))
            .withEntity(table.getEntityReference())
            .withDescription("Test deletion");

    DataContract contract = createEntity(request);
    String contractId = contract.getId().toString();

    deleteEntity(contractId);

    DataContract deleted = getEntityIncludeDeleted(contractId);
    assertTrue(deleted.getDeleted());
  }

  @Test
  void testEnforceUniqueDataContractPerEntity(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request1 =
        new CreateDataContract()
            .withName(ns.prefix("contract1"))
            .withEntity(table.getEntityReference())
            .withDescription("First contract");

    createEntity(request1);

    CreateDataContract request2 =
        new CreateDataContract()
            .withName(ns.prefix("contract2"))
            .withEntity(table.getEntityReference())
            .withDescription("Second contract - should fail");

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating second contract for same entity should fail");
  }

  @Test
  void testDataContractWithInvalidEntity(TestNamespace ns) {
    UUID fakeId = UUID.randomUUID();
    EntityReference fakeEntity = new EntityReference().withId(fakeId).withType("table");

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("invalid_entity"))
            .withEntity(fakeEntity)
            .withDescription("Should fail");

    assertThrows(
        Exception.class, () -> createEntity(request), "Contract with invalid entity should fail");
  }

  @Test
  void testDataContractWithNullEntityReference(TestNamespace ns) {
    CreateDataContract request =
        new CreateDataContract().withName(ns.prefix("null_entity")).withDescription("Should fail");

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Contract without entity reference should fail");
  }

  @Test
  void testDataContractVersionHistory(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("version_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Version test contract");

    DataContract contract = createEntity(request);
    Double initialVersion = contract.getVersion();

    contract.setDescription("Updated description");
    DataContract updated = patchEntity(contract.getId().toString(), contract);
    assertTrue(updated.getVersion() >= initialVersion);

    EntityHistory history = getVersionHistory(contract.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 1);

    DataContract version = getVersion(contract.getId(), initialVersion);
    assertNotNull(version);
  }

  @Test
  void testDataContractSoftDeleteAndRestore(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("soft_delete"))
            .withEntity(table.getEntityReference())
            .withDescription("Soft delete test");

    DataContract contract = createEntity(request);
    String contractId = contract.getId().toString();

    deleteEntity(contractId);
    DataContract deleted = getEntityIncludeDeleted(contractId);
    assertTrue(deleted.getDeleted());

    restoreEntity(contractId);
    DataContract restored = getEntity(contractId);
    assertFalse(restored.getDeleted() != null && restored.getDeleted());
  }

  @Test
  void testDataContractHardDelete(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("hard_delete"))
            .withEntity(table.getEntityReference())
            .withDescription("Hard delete test");

    DataContract contract = createEntity(request);
    String contractId = contract.getId().toString();

    hardDeleteEntity(contractId);

    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(contractId),
        "Hard deleted contract should not be retrievable");
  }

  @Test
  void testDataContractWithDisplayName(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("display_name"))
            .withDisplayName("My Data Contract Display Name")
            .withEntity(table.getEntityReference())
            .withDescription("Display name test");

    DataContract contract = createEntity(request);

    assertEquals("My Data Contract Display Name", contract.getDisplayName());
  }

  @Test
  void testDataContractGetById(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("get_by_id"))
            .withEntity(table.getEntityReference())
            .withDescription("Get by ID test");

    DataContract contract = createEntity(request);

    DataContract fetched = getEntity(contract.getId().toString());
    assertEquals(contract.getId(), fetched.getId());
    assertEquals(contract.getName(), fetched.getName());
  }

  @Test
  void testDataContractGetByName(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("get_by_name"))
            .withEntity(table.getEntityReference())
            .withDescription("Get by name test");

    DataContract contract = createEntity(request);

    assertNotNull(contract.getFullyQualifiedName());
    DataContract fetched = getEntityByName(contract.getFullyQualifiedName());
    assertEquals(contract.getId(), fetched.getId());
  }

  @Test
  void testListDataContracts(TestNamespace ns) {
    Table table1 = createTestTable(ns);
    Table table2 = createTestTable(ns);
    Table table3 = createTestTable(ns);

    createEntity(
        new CreateDataContract()
            .withName(ns.prefix("list_1"))
            .withEntity(table1.getEntityReference())
            .withDescription("List test 1"));

    createEntity(
        new CreateDataContract()
            .withName(ns.prefix("list_2"))
            .withEntity(table2.getEntityReference())
            .withDescription("List test 2"));

    createEntity(
        new CreateDataContract()
            .withName(ns.prefix("list_3"))
            .withEntity(table3.getEntityReference())
            .withDescription("List test 3"));

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<DataContract> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void testDataContractWithEntityStatus(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("entity_status"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withDescription("Entity status test");

    DataContract contract = createEntity(request);
    assertEquals(EntityStatus.APPROVED, contract.getEntityStatus());
  }

  @Test
  void testPatchDataContractEntityStatus(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("patch_status"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withDescription("Patch status test");

    DataContract contract = createEntity(request);
    assertEquals(EntityStatus.APPROVED, contract.getEntityStatus());

    contract.setEntityStatus(EntityStatus.DRAFT);
    DataContract updated = patchEntity(contract.getId().toString(), contract);
    assertEquals(EntityStatus.DRAFT, updated.getEntityStatus());
  }

  @Test
  void testCreateOrUpdateDataContract(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("create_or_update"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial creation");

    DataContract contract = SdkClients.adminClient().dataContracts().createOrUpdate(request);
    assertNotNull(contract);
    assertEquals("Initial creation", contract.getDescription());

    request.setDescription("Updated via createOrUpdate");
    DataContract updated = SdkClients.adminClient().dataContracts().createOrUpdate(request);
    assertEquals("Updated via createOrUpdate", updated.getDescription());
    assertEquals(contract.getId(), updated.getId());
  }

  @Test
  void testDataContractFqnFormat(TestNamespace ns) {
    Table table = createTestTable(ns);

    String contractName = ns.prefix("fqn_test");
    CreateDataContract request =
        new CreateDataContract()
            .withName(contractName)
            .withEntity(table.getEntityReference())
            .withDescription("FQN format test");

    DataContract contract = createEntity(request);

    assertNotNull(contract.getFullyQualifiedName());
    assertTrue(contract.getFullyQualifiedName().contains(contractName));
  }

  @Test
  void testDataContractCreatedByAndCreatedAt(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("created_fields"))
            .withEntity(table.getEntityReference())
            .withDescription("Created fields test");

    DataContract contract = createEntity(request);

    assertNotNull(contract.getUpdatedAt());
    assertNotNull(contract.getUpdatedBy());
  }

  @Test
  void testGetDataContractByEntityWithoutContract(TestNamespace ns) {
    Table table = createTestTable(ns);

    assertThrows(
        Exception.class,
        () -> SdkClients.adminClient().dataContracts().getByEntityId(table.getId(), "table"),
        "Getting contract for entity without contract should fail");
  }

  @Test
  void testDataContractPagination(TestNamespace ns) {
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<DataContract> page1 = listEntities(params);

    assertNotNull(page1);
    assertNotNull(page1.getData());
    assertNotNull(page1.getPaging());
  }
}
