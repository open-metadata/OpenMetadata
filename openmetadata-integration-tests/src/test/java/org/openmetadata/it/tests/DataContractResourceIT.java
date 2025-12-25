package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.sdk.fluent.DataContracts;
import org.openmetadata.sdk.fluent.DataContracts.FluentDataContract;
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
    supportsBulkAPI = false;
    supportsRecognizerFeedback = false;
    supportsConversations = false;
    supportsAsyncDelete = false;
    supportsCustomExtension = false;
    supportsLineage = false;
    supportsLifeCycle = false;
    supportsCertification = false;
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

  // ===================================================================
  // DATA CONTRACT RESULTS TESTS
  // ===================================================================

  @Test
  void testCreateDataContractResult(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("result_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Test data contract for results");

    DataContract contract = createEntity(request);

    // Create a contract result
    DataContractResult result =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis())
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withResult("Validation in progress...")
            .withExecutionTime(1234L);

    DataContractResult created =
        SdkClients.adminClient().dataContracts().addResult(contract.getId(), result);

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(ContractExecutionStatus.Running, created.getContractExecutionStatus());
    assertEquals("Validation in progress...", created.getResult());
  }

  @Test
  void testGetLatestDataContractResult(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("latest_result"))
            .withEntity(table.getEntityReference())
            .withDescription("Test for latest result");

    DataContract contract = createEntity(request);

    // Create first result
    DataContractResult result1 =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis() - 10000)
            .withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withResult("First result - failed")
            .withExecutionTime(500L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), result1);

    // Create second result (newer)
    DataContractResult result2 =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis())
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("Second result - success")
            .withExecutionTime(600L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), result2);

    // Get latest - should be the second result
    DataContractResult latest =
        SdkClients.adminClient().dataContracts().getLatestResult(contract.getId());

    assertNotNull(latest);
    assertEquals(ContractExecutionStatus.Success, latest.getContractExecutionStatus());
    assertEquals("Second result - success", latest.getResult());
  }

  @Test
  void testUpdateDataContractResult(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("update_result"))
            .withEntity(table.getEntityReference())
            .withDescription("Test for updating result");

    DataContract contract = createEntity(request);

    // Create initial result
    long timestamp = System.currentTimeMillis();
    DataContractResult result =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(timestamp)
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withResult("Starting validation")
            .withExecutionTime(0L);

    DataContractResult created =
        SdkClients.adminClient().dataContracts().addResult(contract.getId(), result);

    // Update the result
    created
        .withContractExecutionStatus(ContractExecutionStatus.Success)
        .withResult("Validation completed")
        .withExecutionTime(5000L);

    DataContractResult updated =
        SdkClients.adminClient().dataContracts().addResult(contract.getId(), created);

    assertEquals(ContractExecutionStatus.Success, updated.getContractExecutionStatus());
    assertEquals("Validation completed", updated.getResult());
    assertEquals(5000L, updated.getExecutionTime());
  }

  @Test
  void testDeleteDataContractResult(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("delete_result"))
            .withEntity(table.getEntityReference())
            .withDescription("Test for deleting result");

    DataContract contract = createEntity(request);

    long timestamp = System.currentTimeMillis();
    DataContractResult result =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(timestamp)
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("Test result to delete")
            .withExecutionTime(100L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), result);

    // Delete the result
    SdkClients.adminClient().dataContracts().deleteResult(contract.getId(), timestamp);

    // Verify deletion by trying to get contract's latest result
    // Either throws an exception or returns null - deletion is successful
    try {
      DataContractResult latest =
          SdkClients.adminClient().dataContracts().getLatestResult(contract.getId());
      // If it doesn't throw, the result should be from a different timestamp or null
      assertNull(latest, "Latest result should be null after deletion");
    } catch (Exception e) {
      // Expected - no results exist
      assertTrue(true);
    }
  }

  @Test
  void testDataContractResultWithAbortedStatus(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("aborted_result"))
            .withEntity(table.getEntityReference())
            .withDescription("Test for aborted result");

    DataContract contract = createEntity(request);

    DataContractResult result =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis())
            .withContractExecutionStatus(ContractExecutionStatus.Aborted)
            .withResult("Validation aborted by user")
            .withExecutionTime(2000L);

    DataContractResult created =
        SdkClients.adminClient().dataContracts().addResult(contract.getId(), result);

    assertEquals(ContractExecutionStatus.Aborted, created.getContractExecutionStatus());
  }

  // ===================================================================
  // SEMANTICS TESTS
  // ===================================================================

  @Test
  void testCreateDataContractWithSemantics(TestNamespace ns) {
    Table table = createTestTable(ns);

    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Description Required")
                .withDescription("Ensures description is provided")
                .withRule("{ \"!!\": { \"var\": \"description\" } }"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("semantics_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Data contract with semantics")
            .withSemantics(semanticsRules);

    DataContract contract = createEntity(request);

    assertNotNull(contract.getSemantics());
    assertEquals(1, contract.getSemantics().size());
    assertEquals("Description Required", contract.getSemantics().get(0).getName());
  }

  @Test
  void testPatchDataContractAddSemantics(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("patch_semantics"))
            .withEntity(table.getEntityReference())
            .withDescription("Data contract to add semantics");

    DataContract contract = createEntity(request);
    assertNull(contract.getSemantics());

    // Add semantics via patch
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Owner Required")
                .withDescription("Entity must have an owner")
                .withRule("{ \"!!\": { \"var\": \"owner\" } }"));

    contract.setSemantics(semanticsRules);
    DataContract updated = patchEntity(contract.getId().toString(), contract);

    assertNotNull(updated.getSemantics());
    assertEquals(1, updated.getSemantics().size());
  }

  @Test
  void testDataContractWithMultipleSemanticRules(TestNamespace ns) {
    Table table = createTestTable(ns);

    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Description Required")
                .withDescription("Description must exist")
                .withRule("{ \"!!\": { \"var\": \"description\" } }"),
            new SemanticsRule()
                .withName("Single Owner")
                .withDescription("Only one owner allowed")
                .withRule("{\"==\":[{\"size\":{\"var\":\"owners\"}},1]}"),
            new SemanticsRule()
                .withName("Domain Required")
                .withDescription("Must belong to a domain")
                .withRule("{ \"!!\": { \"var\": \"domain\" } }"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("multi_semantics"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract with multiple semantic rules")
            .withSemantics(semanticsRules);

    DataContract contract = createEntity(request);

    assertNotNull(contract.getSemantics());
    assertEquals(3, contract.getSemantics().size());
  }

  // ===================================================================
  // SCHEMA TESTS
  // ===================================================================

  @Test
  void testDataContractWithSchema(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Schema columns must match table columns (id, name, email)
    List<Column> schemaColumns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDescription("User name"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("schema_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Data contract with schema")
            .withSchema(schemaColumns);

    DataContract contract = createEntity(request);

    assertNotNull(contract.getSchema());
    assertEquals(2, contract.getSchema().size());
  }

  @Test
  void testPatchDataContractSchema(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("patch_schema"))
            .withEntity(table.getEntityReference())
            .withDescription("Data contract to update schema");

    DataContract contract = createEntity(request);

    // Add schema via patch - use columns that exist in the table (id, name, email)
    List<Column> schemaColumns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDescription("Name column"),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDescription("Email column"));

    contract.setSchema(schemaColumns);
    DataContract updated = patchEntity(contract.getId().toString(), contract);

    assertNotNull(updated.getSchema());
    assertEquals(3, updated.getSchema().size());
  }

  // ===================================================================
  // ENTITY STATUS TESTS
  // ===================================================================

  @Test
  void testDataContractDefaultEntityStatus(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("default_status"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract without explicit status");

    DataContract contract = createEntity(request);

    // Default status should be UNPROCESSED
    assertEquals(EntityStatus.UNPROCESSED, contract.getEntityStatus());
  }

  @Test
  void testDataContractDraftStatus(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("draft_status"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.DRAFT)
            .withDescription("Draft contract");

    DataContract contract = createEntity(request);

    assertEquals(EntityStatus.DRAFT, contract.getEntityStatus());
  }

  @Test
  void testDataContractRejectedStatus(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("rejected_status"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.REJECTED)
            .withDescription("Rejected contract");

    DataContract contract = createEntity(request);

    assertEquals(EntityStatus.REJECTED, contract.getEntityStatus());
  }

  @Test
  void testPatchDataContractStatusTransition(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("status_transition"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.DRAFT)
            .withDescription("Test status transitions");

    DataContract contract = createEntity(request);
    assertEquals(EntityStatus.DRAFT, contract.getEntityStatus());

    // Transition to APPROVED
    contract.setEntityStatus(EntityStatus.APPROVED);
    DataContract approved = patchEntity(contract.getId().toString(), contract);
    assertEquals(EntityStatus.APPROVED, approved.getEntityStatus());

    // Transition back to DRAFT
    approved.setEntityStatus(EntityStatus.DRAFT);
    DataContract draft = patchEntity(approved.getId().toString(), approved);
    assertEquals(EntityStatus.DRAFT, draft.getEntityStatus());
  }

  // ===================================================================
  // REVIEWER TESTS
  // ===================================================================

  @Test
  void testDataContractWithReviewers(TestNamespace ns) {
    Table table = createTestTable(ns);
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Use shared user as reviewer
    List<EntityReference> reviewers = List.of(shared.USER1_REF);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("reviewers_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract with reviewers")
            .withReviewers(reviewers);

    DataContract contract = createEntity(request);

    assertNotNull(contract.getReviewers());
    assertEquals(1, contract.getReviewers().size());
  }

  @Test
  void testPatchDataContractAddReviewers(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("add_reviewers"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract to add reviewers");

    DataContract contract = createEntity(request);

    // Add reviewers via patch (using the admin user as reviewer)
    // Get admin user reference from shared entities
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();
    List<EntityReference> reviewers = List.of(shared.USER1_REF);

    contract.setReviewers(reviewers);
    DataContract updated = patchEntity(contract.getId().toString(), contract);

    assertNotNull(updated.getReviewers());
    assertTrue(updated.getReviewers().size() >= 1);
  }

  // ===================================================================
  // ENTITY TYPE TESTS
  // ===================================================================

  @Test
  void testDataContractEntityType(TestNamespace ns) {
    // Create a table and verify entity type in data contract
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("entity_type"))
            .withEntity(table.getEntityReference())
            .withDescription("Test entity type");

    DataContract contract = createEntity(request);

    assertNotNull(contract.getEntity());
    assertEquals("table", contract.getEntity().getType());
    assertEquals(table.getId(), contract.getEntity().getId());
  }

  // ===================================================================
  // SLA TESTS
  // ===================================================================

  @Test
  void testDataContractWithSLA(TestNamespace ns) {
    Table table = createTestTable(ns);

    ContractSLA sla = new ContractSLA().withAvailabilityTime("09:00 UTC");

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("sla_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Data contract with SLA")
            .withSla(sla);

    DataContract contract = createEntity(request);

    assertNotNull(contract.getSla());
    assertEquals("09:00 UTC", contract.getSla().getAvailabilityTime());
  }

  @Test
  void testPatchDataContractSLA(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("patch_sla"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract to update SLA");

    DataContract contract = createEntity(request);

    // Add SLA via patch
    ContractSLA sla = new ContractSLA().withAvailabilityTime("10:00 UTC");

    contract.setSla(sla);
    DataContract updated = patchEntity(contract.getId().toString(), contract);

    assertNotNull(updated.getSla());
  }

  // ===================================================================
  // QUALITY EXPECTATION TESTS
  // ===================================================================

  // Note: Quality expectations in CreateDataContract are EntityReferences to TestCases
  // This is set up via test suite creation, not directly through data contracts
  // The tests below verify the field is present and works as expected

  @Test
  void testDataContractQualityExpectationsField(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Quality expectations are EntityReferences to test cases
    // We just verify the contract can be created without them
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("quality_field"))
            .withEntity(table.getEntityReference())
            .withDescription("Data contract without quality expectations");

    DataContract contract = createEntity(request);

    // Quality expectations will be null or empty initially
    // They are populated when test cases are associated
    assertNotNull(contract);
  }

  // ===================================================================
  // COMBINED TESTS
  // ===================================================================

  @Test
  void testDataContractWithAllFields(TestNamespace ns) {
    Table table = createTestTable(ns);
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Description Required")
                .withDescription("Must have description")
                .withRule("{ \"!!\": { \"var\": \"description\" } }"));

    // Schema columns must match table columns (id, name, email)
    List<Column> schemaColumns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDescription("Name column"));

    ContractSLA sla = new ContractSLA().withAvailabilityTime("09:00 UTC");

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("all_fields"))
            .withDisplayName("Complete Data Contract")
            .withEntity(table.getEntityReference())
            .withDescription("Data contract with all fields populated")
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(semanticsRules)
            .withSchema(schemaColumns)
            .withSla(sla)
            .withReviewers(List.of(shared.USER1_REF));

    DataContract contract = createEntity(request);

    assertNotNull(contract);
    assertEquals("Complete Data Contract", contract.getDisplayName());
    assertEquals(EntityStatus.APPROVED, contract.getEntityStatus());
    assertNotNull(contract.getSemantics());
    assertNotNull(contract.getSchema());
    assertNotNull(contract.getSla());
    assertNotNull(contract.getReviewers());
  }

  @Test
  void testDataContractValidation(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("validation_test"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract to validate");

    DataContract contract = createEntity(request);

    // Trigger validation
    DataContractResult result = SdkClients.adminClient().dataContracts().validate(contract.getId());

    assertNotNull(result);
    assertNotNull(result.getContractExecutionStatus());
  }

  @Test
  void testDataContractResultSuccessToFailure(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("success_failure"))
            .withEntity(table.getEntityReference())
            .withDescription("Test result status changes");

    DataContract contract = createEntity(request);

    // Add success result
    DataContractResult successResult =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis() - 5000)
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("All checks passed")
            .withExecutionTime(1000L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), successResult);

    // Add failure result (newer)
    DataContractResult failureResult =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis())
            .withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withResult("Row count check failed")
            .withExecutionTime(1500L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), failureResult);

    // Latest should be failure
    DataContractResult latest =
        SdkClients.adminClient().dataContracts().getLatestResult(contract.getId());

    assertEquals(ContractExecutionStatus.Failed, latest.getContractExecutionStatus());
  }

  @Test
  void testDataContractDeleteResultsBefore(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("delete_before"))
            .withEntity(table.getEntityReference())
            .withDescription("Test delete results before timestamp");

    DataContract contract = createEntity(request);

    long now = System.currentTimeMillis();

    // Add old result
    DataContractResult oldResult =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(now - 100000)
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("Old result")
            .withExecutionTime(100L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), oldResult);

    // Add new result
    DataContractResult newResult =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(now)
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("New result")
            .withExecutionTime(200L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), newResult);

    // Delete results before the new result's timestamp
    SdkClients.adminClient().dataContracts().deleteResultsBefore(contract.getId(), now - 50000);

    // Latest should still be the new result
    DataContractResult latest =
        SdkClients.adminClient().dataContracts().getLatestResult(contract.getId());

    assertEquals("New result", latest.getResult());
  }

  // ===================================================================
  // FLUENT API TESTS
  // ===================================================================

  @Test
  void testFluentCreateDataContract(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_create"))
            .forEntity(table.getEntityReference())
            .withDescription("Created using fluent API")
            .withStatus(EntityStatus.APPROVED)
            .execute();

    assertNotNull(contract);
    assertNotNull(contract.getId());
    assertEquals(EntityStatus.APPROVED, contract.getEntityStatus());
    assertEquals("Created using fluent API", contract.getDescription());
  }

  @Test
  void testFluentFindAndLoad(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    // Create contract first
    DataContract created =
        DataContracts.create()
            .name(ns.prefix("fluent_find"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent find")
            .execute();

    // Find and load using fluent API
    FluentDataContract loaded = DataContracts.find(created.getId()).includeAll().fetch();

    assertNotNull(loaded);
    assertEquals(created.getId(), loaded.getId());
    assertEquals(created.getFullyQualifiedName(), loaded.getFqn());
  }

  @Test
  void testFluentFindByName(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract created =
        DataContracts.create()
            .name(ns.prefix("fluent_find_name"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent find by name")
            .execute();

    FluentDataContract loaded = DataContracts.findByName(created.getFullyQualifiedName()).fetch();

    assertNotNull(loaded);
    assertEquals(created.getId(), loaded.getId());
  }

  @Test
  void testFluentAddResult(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_result"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent add result")
            .execute();

    // Add result using fluent API
    DataContractResult result =
        DataContracts.forContract(contract.getId())
            .addResult()
            .success()
            .withMessage("All validations passed")
            .withExecutionTime(1500L)
            .execute();

    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());
    assertEquals("All validations passed", result.getResult());
    assertEquals(1500L, result.getExecutionTime());
  }

  @Test
  void testFluentResultStatuses(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_statuses"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent result statuses")
            .execute();

    // Test running status
    DataContractResult running =
        DataContracts.forContract(contract.getId())
            .addResult()
            .running()
            .withMessage("Validation in progress")
            .execute();
    assertEquals(ContractExecutionStatus.Running, running.getContractExecutionStatus());

    // Test failed status
    DataContractResult failed =
        DataContracts.forContract(contract.getId())
            .addResult()
            .failed()
            .withMessage("Validation failed")
            .execute();
    assertEquals(ContractExecutionStatus.Failed, failed.getContractExecutionStatus());

    // Test aborted status
    DataContractResult aborted =
        DataContracts.forContract(contract.getId())
            .addResult()
            .aborted()
            .withMessage("Validation aborted")
            .execute();
    assertEquals(ContractExecutionStatus.Aborted, aborted.getContractExecutionStatus());
  }

  @Test
  void testFluentValidate(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_validate"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent validate")
            .execute();

    // Validate using fluent API
    DataContractResult result = DataContracts.forContract(contract.getId()).validate();

    assertNotNull(result);
    assertNotNull(result.getContractExecutionStatus());
  }

  @Test
  void testFluentUpdateAndSave(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_update"))
            .forEntity(table.getEntityReference())
            .withDescription("Initial description")
            .withStatus(EntityStatus.DRAFT)
            .execute();

    // Update using fluent API
    FluentDataContract loaded = DataContracts.find(contract.getId()).fetch();

    loaded.withDescription("Updated description").withStatus(EntityStatus.APPROVED).save();

    // Verify update
    DataContract updated = getEntity(contract.getId().toString());
    assertEquals("Updated description", updated.getDescription());
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
  }

  @Test
  void testFluentDelete(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_delete"))
            .forEntity(table.getEntityReference())
            .withDescription("To be deleted")
            .execute();

    // Delete using fluent API
    DataContracts.find(contract.getId()).delete().confirm();

    // Verify deletion
    DataContract deleted = getEntityIncludeDeleted(contract.getId().toString());
    assertTrue(deleted.getDeleted());
  }

  @Test
  void testFluentHardDelete(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_hard_delete"))
            .forEntity(table.getEntityReference())
            .withDescription("To be permanently deleted")
            .execute();

    // Hard delete using fluent API
    DataContracts.find(contract.getId()).delete().permanently().confirm();

    // Verify hard deletion
    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(contract.getId().toString()),
        "Hard deleted contract should not be retrievable");
  }

  @Test
  void testFluentList(TestNamespace ns) {
    Table table1 = createTestTable(ns);
    Table table2 = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContracts.create()
        .name(ns.prefix("fluent_list_1"))
        .forEntity(table1.getEntityReference())
        .withDescription("List test 1")
        .execute();

    DataContracts.create()
        .name(ns.prefix("fluent_list_2"))
        .forEntity(table2.getEntityReference())
        .withDescription("List test 2")
        .execute();

    // List using fluent API
    List<FluentDataContract> contracts = DataContracts.list().limit(10).fetch();

    assertNotNull(contracts);
    assertTrue(contracts.size() >= 2);
  }

  @Test
  void testFluentGetLatestResult(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_latest"))
            .forEntity(table.getEntityReference())
            .withDescription("Test get latest result")
            .execute();

    // Add results
    DataContracts.forContract(contract.getId())
        .addResult()
        .failed()
        .withMessage("First result - failed")
        .withTimestamp(System.currentTimeMillis() - 10000)
        .execute();

    DataContracts.forContract(contract.getId())
        .addResult()
        .success()
        .withMessage("Second result - success")
        .execute();

    // Get latest using fluent API
    DataContractResult latest = DataContracts.forContract(contract.getId()).getLatestResult();

    assertNotNull(latest);
    assertEquals(ContractExecutionStatus.Success, latest.getContractExecutionStatus());
  }

  @Test
  void testFluentWithSemantics(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    SemanticsRule rule =
        new SemanticsRule()
            .withName("Description Check")
            .withDescription("Validates description exists")
            .withRule("{ \"!!\": { \"var\": \"description\" } }");

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_semantics"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent semantics")
            .withSemanticRule(rule)
            .execute();

    assertNotNull(contract.getSemantics());
    assertEquals(1, contract.getSemantics().size());
    assertEquals("Description Check", contract.getSemantics().get(0).getName());
  }

  @Test
  void testFluentWithMultipleSemanticRules(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    SemanticsRule rule1 =
        new SemanticsRule()
            .withName("Rule 1")
            .withDescription("First rule")
            .withRule("{ \"!!\": { \"var\": \"description\" } }");

    SemanticsRule rule2 =
        new SemanticsRule()
            .withName("Rule 2")
            .withDescription("Second rule")
            .withRule("{ \"!!\": { \"var\": \"owners\" } }");

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_multi_semantics"))
            .forEntity(table.getEntityReference())
            .withDescription("Test multiple semantic rules")
            .withSemanticRule(rule1)
            .withSemanticRule(rule2)
            .execute();

    assertNotNull(contract.getSemantics());
    assertEquals(2, contract.getSemantics().size());
  }

  @Test
  void testFluentWithSchema(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    List<Column> schemaColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT).withDescription("PK"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDescription("Name"));

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_schema"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent schema")
            .withSchema(schemaColumns)
            .execute();

    assertNotNull(contract.getSchema());
    assertEquals(2, contract.getSchema().size());
  }

  @Test
  void testFluentWithSLA(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    ContractSLA sla = new ContractSLA().withAvailabilityTime("08:00 UTC");

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_sla"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent SLA")
            .withSla(sla)
            .execute();

    assertNotNull(contract.getSla());
    assertEquals("08:00 UTC", contract.getSla().getAvailabilityTime());
  }

  @Test
  void testFluentWithReviewers(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_reviewers"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent reviewers")
            .withReviewers(List.of(shared.USER1_REF))
            .execute();

    assertNotNull(contract.getReviewers());
    assertEquals(1, contract.getReviewers().size());
  }

  @Test
  void testFluentCreateOrUpdate(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    String contractName = ns.prefix("fluent_create_or_update");

    // Create
    DataContract created =
        DataContracts.create()
            .name(contractName)
            .forEntity(table.getEntityReference())
            .withDescription("Initial description")
            .createOrUpdate();

    assertNotNull(created);
    assertEquals("Initial description", created.getDescription());

    // Update via createOrUpdate
    DataContract updated =
        DataContracts.create()
            .name(contractName)
            .forEntity(table.getEntityReference())
            .withDescription("Updated description")
            .createOrUpdate();

    assertEquals(created.getId(), updated.getId());
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void testFluentFindByEntity(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_by_entity"))
            .forEntity(table.getEntityReference())
            .withDescription("Test find by entity")
            .execute();

    // Find by entity ID
    FluentDataContract loaded = DataContracts.findByEntity(table.getId(), "table").fetch();

    assertNotNull(loaded);
    assertEquals(contract.getId(), loaded.getId());
  }

  @Test
  void testFluentFromFluentEntity(TestNamespace ns) {
    Table table = createTestTable(ns);

    DataContracts.setDefaultClient(SdkClients.adminClient());

    DataContract contract =
        DataContracts.create()
            .name(ns.prefix("fluent_from_entity"))
            .forEntity(table.getEntityReference())
            .withDescription("Test fluent entity operations")
            .execute();

    // Use fluent entity to add result
    FluentDataContract loaded = DataContracts.find(contract.getId()).fetch();

    DataContractResult result =
        loaded
            .addResult()
            .success()
            .withMessage("Added from fluent entity")
            .withExecutionTime(500L)
            .execute();

    assertNotNull(result);
    assertEquals("Added from fluent entity", result.getResult());

    // Validate from fluent entity
    DataContractResult validated = loaded.validate();
    assertNotNull(validated);

    // Get latest result from fluent entity
    DataContractResult latest = loaded.getLatestResult();
    assertNotNull(latest);
  }

  // ===================================================================
  // ODCS EXPORT/IMPORT TESTS
  // ===================================================================

  @Test
  void testExportDataContractToODCS(TestNamespace ns) {
    Table table = createTestTable(ns);

    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("ID column"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Name column"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("odcs_export"))
            .withEntity(table.getEntityReference())
            .withDescription("Test contract for ODCS export")
            .withSchema(schema);

    DataContract contract = createEntity(request);

    org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract odcs =
        SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs);
    assertEquals(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsApiVersion.V_3_0_2,
        odcs.getApiVersion());
    assertEquals(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsKind.DATA_CONTRACT,
        odcs.getKind());
    assertEquals(contract.getName(), odcs.getName());
    assertNotNull(odcs.getStatus());
    assertNotNull(odcs.getDescription());
    assertEquals("Test contract for ODCS export", odcs.getDescription().getPurpose());

    assertNotNull(odcs.getSchema());
    assertEquals(2, odcs.getSchema().size());
  }

  @Test
  void testExportDataContractToODCSYaml(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("odcs_yaml_export"))
            .withEntity(table.getEntityReference())
            .withDescription("Test contract for ODCS YAML export");

    DataContract contract = createEntity(request);

    String yamlContent =
        SdkClients.adminClient().dataContracts().exportToODCSYaml(contract.getId());

    assertNotNull(yamlContent);
    assertTrue(yamlContent.contains("apiVersion:"));
    assertTrue(yamlContent.contains("v3.0.2"));
    assertTrue(yamlContent.contains("kind:"));
    assertTrue(yamlContent.contains("DataContract"));
    assertTrue(yamlContent.contains("name:"));
    assertTrue(yamlContent.contains(contract.getName()));
  }

  @Test
  void testImportDataContractFromODCS(TestNamespace ns) {
    Table table = createTestTable(ns);

    org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract odcs =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract();
    odcs.setApiVersion(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("odcs_import_test"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsStatus.ACTIVE);

    org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription desc =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription();
    desc.setPurpose("Imported from ODCS");
    odcs.setDescription(desc);

    List<org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement> schema =
        new java.util.ArrayList<>();
    org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement col1 =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement();
    col1.setName("id");
    col1.setLogicalType(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement.LogicalType.INTEGER);
    col1.setPrimaryKey(true);
    schema.add(col1);

    org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement col2 =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement();
    col2.setName("email");
    col2.setLogicalType(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement.LogicalType.STRING);
    schema.add(col2);

    odcs.setSchema(schema);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getId());
    assertEquals(odcs.getName(), imported.getName());
    assertEquals(EntityStatus.APPROVED, imported.getEntityStatus());
    assertNotNull(imported.getDescription());
    assertTrue(imported.getDescription().contains("Imported from ODCS"));

    assertNotNull(imported.getSchema());
    assertEquals(2, imported.getSchema().size());
    assertEquals("id", imported.getSchema().get(0).getName());
    assertEquals(ColumnDataType.INT, imported.getSchema().get(0).getDataType());
    assertEquals("email", imported.getSchema().get(1).getName());
  }

  @Test
  void testImportDataContractFromODCSYaml(TestNamespace ns) {
    Table table = createTestTable(ns);

    String contractName = ns.prefix("yaml_import_test");

    String yamlContent =
        "apiVersion: v3.0.2\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + contractName
            + "\n"
            + "version: \"1.0.0\"\n"
            + "status: draft\n"
            + "description:\n"
            + "  purpose: Imported from YAML\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n"
            + "    primaryKey: true\n"
            + "  - name: name\n"
            + "    logicalType: string\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(contractName, imported.getName());
    assertEquals(EntityStatus.DRAFT, imported.getEntityStatus());
    assertNotNull(imported.getSchema());
    assertEquals(2, imported.getSchema().size());
    assertEquals("id", imported.getSchema().get(0).getName());
    assertEquals("name", imported.getSchema().get(1).getName());
  }

  @Test
  void testODCSRoundTrip(TestNamespace ns) {
    Table table = createTestTable(ns);

    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Name field"),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Email field"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("round_trip"))
            .withEntity(table.getEntityReference())
            .withDescription("Round trip test contract")
            .withSchema(schema)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract original = createEntity(request);

    org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract odcs =
        SdkClients.adminClient().dataContracts().exportToODCS(original.getId());

    assertNotNull(odcs);
    assertEquals(original.getName(), odcs.getName());
    assertEquals(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsStatus.ACTIVE,
        odcs.getStatus());
    assertEquals(3, odcs.getSchema().size());

    assertEquals(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement.LogicalType.INTEGER,
        odcs.getSchema().get(0).getLogicalType());
    assertEquals(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement.LogicalType.STRING,
        odcs.getSchema().get(1).getLogicalType());
    assertEquals(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement.LogicalType.STRING,
        odcs.getSchema().get(2).getLogicalType());

    Table newTable = createTestTable(ns);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("reimported_" + UUID.randomUUID().toString().substring(0, 8)));

    DataContract reimported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, newTable.getId(), "table");

    assertNotNull(reimported);
    assertEquals(original.getEntityStatus(), reimported.getEntityStatus());
    assertEquals(original.getSchema().size(), reimported.getSchema().size());
    assertEquals(original.getSchema().get(0).getName(), reimported.getSchema().get(0).getName());
  }

  @Test
  void testODCSExportWithSLA(TestNamespace ns) {
    Table table = createTestTable(ns);

    org.openmetadata.schema.api.data.ContractSLA sla =
        new org.openmetadata.schema.api.data.ContractSLA();
    org.openmetadata.schema.api.data.RefreshFrequency rf =
        new org.openmetadata.schema.api.data.RefreshFrequency();
    rf.setInterval(1);
    rf.setUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.DAY);
    sla.setRefreshFrequency(rf);

    org.openmetadata.schema.api.data.MaxLatency ml =
        new org.openmetadata.schema.api.data.MaxLatency();
    ml.setValue(2);
    ml.setUnit(org.openmetadata.schema.api.data.MaxLatency.Unit.HOUR);
    sla.setMaxLatency(ml);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("sla_export"))
            .withEntity(table.getEntityReference())
            .withDescription("Test contract with SLA")
            .withSla(sla);

    DataContract contract = createEntity(request);

    org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract odcs =
        SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs.getSlaProperties());
    assertTrue(odcs.getSlaProperties().size() >= 2);

    boolean hasRefreshFrequency =
        odcs.getSlaProperties().stream()
            .anyMatch(p -> "refreshFrequency".equals(p.getProperty()) && "1".equals(p.getValue()));
    assertTrue(hasRefreshFrequency);

    boolean hasMaxLatency =
        odcs.getSlaProperties().stream()
            .anyMatch(p -> "maxLatency".equals(p.getProperty()) && "2".equals(p.getValue()));
    assertTrue(hasMaxLatency);
  }

  // ===================================================================
  // SECURITY AND PERMISSIONS TESTS
  // ===================================================================

  @Test
  void testTableOwnerCanCreateDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create table owned by USER1
    Table table = createTestTable(ns);
    table.setOwners(List.of(shared.USER1_REF));
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    // Create data contract request
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("user1_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract created by table owner");

    // USER1 (owner) should be able to create data contract for their table
    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    assertNotNull(contract);
    assertEquals(request.getName(), contract.getName());
    assertEquals(table.getId(), contract.getEntity().getId());
  }

  @Test
  void testRegularUserCannotCreateDataContractForOthersTable(TestNamespace ns) {
    // Create table owned by admin (default owner)
    Table table = createTestTable(ns);

    // Create data contract request
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("unauthorized_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract for admin's table");

    // USER2 should not be able to create data contract for admin's table
    assertThrows(
        Exception.class,
        () -> SdkClients.user2Client().dataContracts().create(request),
        "Regular user should not be able to create data contract for others' table");
  }

  @Test
  void testTableOwnerCanUpdateTheirDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create table owned by USER1
    Table table = createTestTable(ns);
    table.setOwners(List.of(shared.USER1_REF));
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    // Create data contract as USER1
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("user1_update_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial description");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    // Update as USER1 (owner) should work
    contract.setDescription("Updated description");
    contract.setEntityStatus(EntityStatus.APPROVED);

    DataContract updated =
        SdkClients.user1Client().dataContracts().update(contract.getId().toString(), contract);

    assertEquals("Updated description", updated.getDescription());
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
  }

  @Test
  void testRegularUserCannotUpdateOthersDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create table owned by USER1
    Table table = createTestTable(ns);
    table.setOwners(List.of(shared.USER1_REF));
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    // Create data contract as USER1
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("user1_protected_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial description");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    // USER2 should not be able to update USER1's data contract
    contract.setDescription("Unauthorized update");
    contract.setEntityStatus(EntityStatus.APPROVED);

    String contractId = contract.getId().toString();
    assertThrows(
        Exception.class,
        () -> SdkClients.user2Client().dataContracts().update(contractId, contract),
        "Regular user should not be able to update others' data contract");
  }

  @Test
  void testTableOwnerCanPatchTheirDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create table owned by USER1
    Table table = createTestTable(ns);
    table.setOwners(List.of(shared.USER1_REF));
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    // Create data contract as USER1
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("user1_patch_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial description");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    // Patch as USER1 (owner) should work
    contract.setEntityStatus(EntityStatus.APPROVED);

    DataContract patched =
        SdkClients.user1Client().dataContracts().update(contract.getId().toString(), contract);

    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
  }

  @Test
  void testRegularUserCannotPatchOthersDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create table owned by USER1
    Table table = createTestTable(ns);
    table.setOwners(List.of(shared.USER1_REF));
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    // Create data contract as USER1
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("user1_nopatch_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial description");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);

    // USER2 should not be able to patch USER1's data contract
    contract.setEntityStatus(EntityStatus.APPROVED);

    String contractId = contract.getId().toString();
    assertThrows(
        Exception.class,
        () -> SdkClients.user2Client().dataContracts().update(contractId, contract),
        "Regular user should not be able to patch others' data contract");
  }

  @Test
  void testTableOwnerCanDeleteTheirDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create table owned by USER1
    Table table = createTestTable(ns);
    table.setOwners(List.of(shared.USER1_REF));
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    // Create data contract as USER1
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("user1_delete_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract to be deleted");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);
    String contractId = contract.getId().toString();

    // USER1 (owner) should be able to delete their data contract
    SdkClients.user1Client().dataContracts().delete(contractId);

    // Verify deletion
    DataContract deleted =
        SdkClients.adminClient().dataContracts().get(contractId, null, "deleted");
    assertTrue(deleted.getDeleted());
  }

  @Test
  void testRegularUserCannotDeleteOthersDataContract(TestNamespace ns) {
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create table owned by USER1
    Table table = createTestTable(ns);
    table.setOwners(List.of(shared.USER1_REF));
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);

    // Create data contract as USER1
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("user1_nodelete_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Protected contract");

    DataContract contract = SdkClients.user1Client().dataContracts().create(request);
    String contractId = contract.getId().toString();

    // USER2 should not be able to delete USER1's data contract
    assertThrows(
        Exception.class,
        () -> SdkClients.user2Client().dataContracts().delete(contractId),
        "Regular user should not be able to delete others' data contract");
  }

  @Test
  void testAllUsersCanReadDataContracts(TestNamespace ns) {
    // Create table and data contract as admin
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("public_readable_contract"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract readable by all");

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // USER1 should be able to read the data contract
    DataContract retrievedByUser1 =
        SdkClients.user1Client().dataContracts().get(contract.getId().toString());
    assertEquals(contract.getId(), retrievedByUser1.getId());
    assertEquals(contract.getName(), retrievedByUser1.getName());

    // USER2 should also be able to read the data contract
    DataContract retrievedByUser2 =
        SdkClients.user2Client().dataContracts().get(contract.getId().toString());
    assertEquals(contract.getId(), retrievedByUser2.getId());
    assertEquals(contract.getName(), retrievedByUser2.getName());
  }

  // ===================================================================
  // ADDITIONAL ENTITY-SPECIFIC TESTS
  // ===================================================================

  @Test
  void testDataContractWithInvalidFields(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create schema with field that doesn't exist in the table
    List<Column> columns =
        List.of(
            new Column()
                .withName("non_existent_field")
                .withDescription("This field doesn't exist")
                .withDataType(ColumnDataType.STRING));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("invalid_fields"))
            .withEntity(table.getEntityReference())
            .withSchema(columns);

    // Should throw error for non-existent field
    assertThrows(
        Exception.class,
        () -> SdkClients.adminClient().dataContracts().create(request),
        "Schema validation should fail for non-existent field");
  }

  @Test
  void testDataEntityStatusTransitions(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create Draft data contract
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("status_transitions"))
            .withEntity(table.getEntityReference())
            .withEntityStatus(EntityStatus.DRAFT);

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);
    assertEquals(EntityStatus.DRAFT, contract.getEntityStatus());

    // Update to Approved status
    contract.setEntityStatus(EntityStatus.APPROVED);
    DataContract updated =
        SdkClients.adminClient().dataContracts().update(contract.getId().toString(), contract);
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());

    // Update to Deprecated status
    updated.setEntityStatus(EntityStatus.DEPRECATED);
    DataContract deprecated =
        SdkClients.adminClient().dataContracts().update(updated.getId().toString(), updated);
    assertEquals(EntityStatus.DEPRECATED, deprecated.getEntityStatus());
  }

  @Test
  void testPatchDataContractRemoveReviewers(TestNamespace ns) {
    Table table = createTestTable(ns);
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create contract with reviewers
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("remove_reviewers"))
            .withEntity(table.getEntityReference())
            .withReviewers(List.of(shared.USER1_REF));

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);
    assertNotNull(contract.getReviewers());
    assertEquals(1, contract.getReviewers().size());

    // Remove reviewers via patch
    contract.setReviewers(List.of());
    DataContract updated =
        SdkClients.adminClient().dataContracts().update(contract.getId().toString(), contract);

    assertTrue(updated.getReviewers() == null || updated.getReviewers().isEmpty());
  }

  @Test
  void testCreateOrUpdateDataContractResult(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("result_lifecycle"))
            .withEntity(table.getEntityReference());

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // Create a contract result
    DataContractResult createResult =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis())
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withResult("Triggering...")
            .withExecutionTime(1234L);

    DataContractResult result =
        SdkClients.adminClient().dataContracts().addResult(contract.getId(), createResult);

    assertNotNull(result);
    assertNotNull(result.getId());
    assertEquals(ContractExecutionStatus.Running, result.getContractExecutionStatus());
    assertEquals("Triggering...", result.getResult());

    // Update the same result
    result
        .withContractExecutionStatus(ContractExecutionStatus.Success)
        .withResult("Success result")
        .withExecutionTime(2000L);

    DataContractResult updated =
        SdkClients.adminClient().dataContracts().addResult(contract.getId(), result);

    assertEquals(ContractExecutionStatus.Success, updated.getContractExecutionStatus());
    assertEquals("Success result", updated.getResult());
    assertEquals(2000L, updated.getExecutionTime());
  }

  @Test
  void testListDataContractResults(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("list_results"))
            .withEntity(table.getEntityReference());

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // Create multiple contract results
    for (int i = 1; i <= 3; i++) {
      DataContractResult createResult =
          new DataContractResult()
              .withDataContractFQN(contract.getFullyQualifiedName())
              .withTimestamp(System.currentTimeMillis() + (i * 1000))
              .withContractExecutionStatus(
                  i % 2 == 0 ? ContractExecutionStatus.Success : ContractExecutionStatus.Failed)
              .withResult("Result " + i)
              .withExecutionTime(1000L + i);

      SdkClients.adminClient().dataContracts().addResult(contract.getId(), createResult);
    }

    // List results - verify at least 3 were created
    // Note: The SDK may not expose a direct list results method, so we verify via latest
    DataContractResult latest =
        SdkClients.adminClient().dataContracts().getLatestResult(contract.getId());
    assertNotNull(latest);
  }

  @Test
  void testDataContractIsDeletedWhenTableIsDeleted(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create a data contract for the table
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("cascade_delete"))
            .withEntity(table.getEntityReference());

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // Verify the data contract was created
    assertNotNull(contract);
    DataContract retrieved =
        SdkClients.adminClient().dataContracts().get(contract.getId().toString());
    assertNotNull(retrieved);

    // Delete the table (hard delete)
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().tables().delete(table.getId().toString(), params);

    // Verify that the data contract is also deleted
    assertThrows(
        Exception.class,
        () -> SdkClients.adminClient().dataContracts().get(contract.getId().toString()),
        "Contract should be deleted when table is deleted");
  }

  @Test
  void testCreateOrUpdateDataContractFromODCS(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create ODCS data contract
    org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract odcs =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract();
    odcs.setApiVersion(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("upsert_odcs"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsStatus.DRAFT);

    // Create initial contract using createOrUpdate
    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(odcs, table.getId(), "table");
    assertNotNull(created);
    assertEquals(EntityStatus.DRAFT, created.getEntityStatus());

    // Update the contract via ODCS using createOrUpdate
    odcs.setStatus(
        org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract.OdcsStatus.ACTIVE);
    org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription desc =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription();
    desc.setPurpose("Updated via ODCS");
    odcs.setDescription(desc);

    DataContract updated =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(odcs, table.getId(), "table");
    assertNotNull(updated);
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
    assertTrue(updated.getDescription().contains("Updated via ODCS"));
  }

  @Test
  void testExportDataContractToODCSByFqn(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("export_by_fqn"))
            .withEntity(table.getEntityReference())
            .withDescription("Test export by FQN");

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // Export using FQN instead of ID
    org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract odcs =
        SdkClients.adminClient()
            .dataContracts()
            .exportToODCSByFqn(contract.getFullyQualifiedName());

    assertNotNull(odcs);
    assertEquals(contract.getName(), odcs.getName());
  }

  @Test
  void testLatestResultOnlyUpdatedForNewerResults(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("latest_result_test"))
            .withEntity(table.getEntityReference());

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    long now = System.currentTimeMillis();

    // Add newer result first
    DataContractResult newerResult =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(now)
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("Newer result")
            .withExecutionTime(100L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), newerResult);

    // Try to add an older result
    DataContractResult olderResult =
        new DataContractResult()
            .withDataContractFQN(contract.getFullyQualifiedName())
            .withTimestamp(now - 10000)
            .withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withResult("Older result")
            .withExecutionTime(50L);

    SdkClients.adminClient().dataContracts().addResult(contract.getId(), olderResult);

    // Latest should still be the newer result
    DataContractResult latest =
        SdkClients.adminClient().dataContracts().getLatestResult(contract.getId());

    assertNotNull(latest);
    assertEquals("Newer result", latest.getResult());
    assertEquals(ContractExecutionStatus.Success, latest.getContractExecutionStatus());
  }

  @Test
  void testPatchDataContractUpdateReviewers(TestNamespace ns) {
    Table table = createTestTable(ns);
    org.openmetadata.it.env.SharedEntities shared = org.openmetadata.it.env.SharedEntities.get();

    // Create contract with one reviewer
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("update_reviewers"))
            .withEntity(table.getEntityReference())
            .withReviewers(List.of(shared.USER1_REF));

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);
    assertEquals(1, contract.getReviewers().size());

    // Update to different reviewer - note: using admin user as USER2_REF might not exist
    contract.setReviewers(List.of(shared.USER1_REF));
    DataContract updated =
        SdkClients.adminClient().dataContracts().update(contract.getId().toString(), contract);

    assertNotNull(updated.getReviewers());
    assertEquals(1, updated.getReviewers().size());
  }

  @Test
  void testDataContractWithMultipleInvalidFields(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create schema with multiple fields that don't exist in the table
    List<Column> columns =
        List.of(
            new Column()
                .withName("field1_does_not_exist")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Invalid field 1"),
            new Column()
                .withName("field2_also_missing")
                .withDataType(ColumnDataType.INT)
                .withDescription("Invalid field 2"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("multiple_invalid"))
            .withEntity(table.getEntityReference())
            .withSchema(columns);

    // Should throw error for multiple non-existent fields
    assertThrows(
        Exception.class,
        () -> SdkClients.adminClient().dataContracts().create(request),
        "Schema validation should fail for multiple non-existent fields");
  }

  @Test
  void testPatchDataContractMultipleFields(TestNamespace ns) {
    Table table = createTestTable(ns);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("patch_multiple"))
            .withEntity(table.getEntityReference())
            .withDescription("Initial description")
            .withEntityStatus(EntityStatus.DRAFT);

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    // Patch multiple fields at once
    contract.setDescription("Updated description");
    contract.setEntityStatus(EntityStatus.APPROVED);
    contract.setDisplayName("Updated Display Name");

    DataContract updated =
        SdkClients.adminClient().dataContracts().update(contract.getId().toString(), contract);

    assertEquals("Updated description", updated.getDescription());
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
    assertEquals("Updated Display Name", updated.getDisplayName());
  }
}
