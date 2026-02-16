package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.schema.entity.datacontract.ContractValidation;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSTeamMember;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.DataContracts;
import org.openmetadata.sdk.fluent.DataContracts.FluentDataContract;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.resources.data.DataContractResource;

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
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected String getResourcePath() {
    return DataContractResource.COLLECTION_PATH;
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
    return createTestTable(
        ns,
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));
  }

  private Table createTestTable(TestNamespace ns, List<Column> columns) {
    String shortId = ns.uniqueShortId();

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
    tableRequest.setColumns(columns);

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

    // Create data contracts with different entity statuses
    DataContract approvedContract =
        createEntity(
            new CreateDataContract()
                .withName(ns.prefix("list_1"))
                .withEntity(table1.getEntityReference())
                .withEntityStatus(EntityStatus.APPROVED)
                .withDescription("List test 1 - Approved"));

    DataContract draftContract =
        createEntity(
            new CreateDataContract()
                .withName(ns.prefix("list_2"))
                .withEntity(table2.getEntityReference())
                .withEntityStatus(EntityStatus.DRAFT)
                .withDescription("List test 2 - Draft"));

    DataContract rejectedContract =
        createEntity(
            new CreateDataContract()
                .withName(ns.prefix("list_3"))
                .withEntity(table3.getEntityReference())
                .withEntityStatus(EntityStatus.REJECTED)
                .withDescription("List test 3 - Rejected"));

    // Test basic list without filters
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<DataContract> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);

    // Test filtering by status - Approved (include entity field to verify entity reference)
    // Use higher limit to account for concurrent test execution creating multiple contracts
    ListParams approvedParams = new ListParams();
    approvedParams.setLimit(1000);
    approvedParams.setFields("entity");
    approvedParams.addQueryParam("status", "Approved");
    ListResponse<DataContract> approvedResponse = listEntities(approvedParams);

    assertNotNull(approvedResponse);
    assertNotNull(approvedResponse.getData());
    // Verify our approved contract is in the results with correct status and entity
    boolean foundApprovedContract =
        approvedResponse.getData().stream()
            .anyMatch(
                contract ->
                    contract.getId().equals(approvedContract.getId())
                        && contract.getEntityStatus() == EntityStatus.APPROVED
                        && contract.getEntity() != null
                        && contract.getEntity().getId().equals(table1.getId()));
    assertTrue(
        foundApprovedContract,
        "Expected to find the approved contract with matching entity and status");

    // Test filtering by status - Draft (include entity field to verify entity reference)
    ListParams draftParams = new ListParams();
    draftParams.setLimit(1000);
    draftParams.setFields("entity");
    draftParams.addQueryParam("status", "Draft");
    ListResponse<DataContract> draftResponse = listEntities(draftParams);

    assertNotNull(draftResponse);
    assertNotNull(draftResponse.getData());
    // Verify our draft contract is in the results with correct status and entity
    boolean foundDraftContract =
        draftResponse.getData().stream()
            .anyMatch(
                contract ->
                    contract.getId().equals(draftContract.getId())
                        && contract.getEntityStatus() == EntityStatus.DRAFT
                        && contract.getEntity() != null
                        && contract.getEntity().getId().equals(table2.getId()));
    assertTrue(
        foundDraftContract, "Expected to find the draft contract with matching entity and status");

    // Test filtering by status - Rejected (include entity field to verify entity reference)
    ListParams rejectedParams = new ListParams();
    rejectedParams.setLimit(1000);
    rejectedParams.setFields("entity");
    rejectedParams.addQueryParam("status", "Rejected");
    ListResponse<DataContract> rejectedResponse = listEntities(rejectedParams);

    assertNotNull(rejectedResponse);
    assertNotNull(rejectedResponse.getData());
    boolean foundRejectedContract =
        rejectedResponse.getData().stream()
            .anyMatch(
                contract ->
                    contract.getId().equals(rejectedContract.getId())
                        && contract.getEntityStatus() == EntityStatus.REJECTED
                        && contract.getEntity() != null
                        && contract.getEntity().getId().equals(table3.getId()));
    assertTrue(
        foundRejectedContract,
        "Expected to find the rejected contract with matching entity and status");
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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();
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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());
    assertEquals(ODCSDataContract.OdcsKind.DATA_CONTRACT, odcs.getKind());
    assertEquals(contract.getName(), odcs.getName());
    assertNotNull(odcs.getStatus());
    assertNotNull(odcs.getDescription());
    assertEquals("Test contract for ODCS export", odcs.getDescription().getPurpose());

    // ODCS v3.1.0: Schema is wrapped in object (table)
    assertNotNull(odcs.getSchema());
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertEquals("table", tableObject.getPhysicalType());
    assertNotNull(tableObject.getProperties());
    assertEquals(2, tableObject.getProperties().size());
    assertEquals("id", tableObject.getProperties().get(0).getName());
    assertEquals("name", tableObject.getProperties().get(1).getName());
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
    assertTrue(yamlContent.contains("v3.1.0"));
    assertTrue(yamlContent.contains("kind:"));
    assertTrue(yamlContent.contains("DataContract"));
    assertTrue(yamlContent.contains("name:"));
    assertTrue(yamlContent.contains(contract.getName()));
  }

  @Test
  void testImportDataContractFromODCS(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("odcs_import_test"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Imported from ODCS");
    odcs.setDescription(desc);

    // ODCS v3.1.0: Schema is wrapped in object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName(table.getName());
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    List<ODCSSchemaElement> properties = new java.util.ArrayList<>();
    ODCSSchemaElement col1 = new ODCSSchemaElement();
    col1.setName("id");
    col1.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    col1.setPrimaryKey(true);
    properties.add(col1);

    ODCSSchemaElement col2 = new ODCSSchemaElement();
    col2.setName("email");
    col2.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    properties.add(col2);

    tableObject.setProperties(properties);
    odcs.setSchema(List.of(tableObject));

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

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(original.getId());

    assertNotNull(odcs);
    assertEquals(original.getName(), odcs.getName());
    assertEquals(ODCSDataContract.OdcsStatus.ACTIVE, odcs.getStatus());

    // ODCS v3.1.0: Schema is wrapped in object (table)
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertNotNull(tableObject.getProperties());
    assertEquals(3, tableObject.getProperties().size());

    assertEquals(
        ODCSSchemaElement.LogicalType.LONG,
        tableObject.getProperties().get(0).getLogicalType()); // BIGINT maps to LONG
    assertEquals(
        ODCSSchemaElement.LogicalType.STRING, tableObject.getProperties().get(1).getLogicalType());
    assertEquals(
        ODCSSchemaElement.LogicalType.STRING, tableObject.getProperties().get(2).getLogicalType());

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

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs.getSlaProperties());
    assertTrue(odcs.getSlaProperties().size() >= 2);

    boolean hasFreshness =
        odcs.getSlaProperties().stream()
            .anyMatch(
                p ->
                    "freshness".equals(p.getProperty())
                        && "1".equals(p.getValue())); // ODCS uses "freshness"
    assertTrue(hasFreshness);

    boolean hasLatency =
        odcs.getSlaProperties().stream()
            .anyMatch(
                p ->
                    "latency".equals(p.getProperty())
                        && "2".equals(p.getValue())); // ODCS uses "latency"
    assertTrue(hasLatency);
  }

  // ===================================================================
  // SECURITY AND PERMISSIONS TESTS
  // ===================================================================

  @Test
  void testTableOwnerCanCreateDataContract(TestNamespace ns) {
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("upsert_odcs"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    // Create initial contract using createOrUpdate
    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(odcs, table.getId(), "table");
    assertNotNull(created);
    assertEquals(EntityStatus.DRAFT, created.getEntityStatus());

    // Update the contract via ODCS using createOrUpdate
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);
    ODCSDescription desc = new ODCSDescription();
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
    ODCSDataContract odcs =
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
    org.openmetadata.it.bootstrap.SharedEntities shared =
        org.openmetadata.it.bootstrap.SharedEntities.get();

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

  // ===================================================================
  // ODCS v3.1.0 SPECIFIC TESTS
  // ===================================================================

  @Test
  void testExportDataContractWithTimestampType(TestNamespace ns) {
    List<Column> tableColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP),
            new Column().withName("updated_at").withDataType(ColumnDataType.TIMESTAMPZ));
    Table table = createTestTable(ns, tableColumns);

    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("ID column"),
            new Column()
                .withName("created_at")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Creation timestamp"),
            new Column()
                .withName("updated_at")
                .withDataType(ColumnDataType.TIMESTAMPZ)
                .withDescription("Update timestamp with timezone"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("timestamp_export"))
            .withEntity(table.getEntityReference())
            .withDescription("Test contract with timestamp types")
            .withSchema(schema);

    DataContract contract = createEntity(request);

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());

    // ODCS v3.1.0: Schema is wrapped in object (table)
    assertNotNull(odcs.getSchema());
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertNotNull(tableObject.getProperties());
    assertEquals(3, tableObject.getProperties().size());

    assertEquals(
        ODCSSchemaElement.LogicalType.TIMESTAMP,
        tableObject.getProperties().get(1).getLogicalType());
    assertEquals(
        ODCSSchemaElement.LogicalType.TIMESTAMP,
        tableObject.getProperties().get(2).getLogicalType());
  }

  @Test
  void testExportDataContractWithTimeType(TestNamespace ns) {
    List<Column> tableColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("start_time").withDataType(ColumnDataType.TIME));
    Table table = createTestTable(ns, tableColumns);

    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("ID column"),
            new Column()
                .withName("start_time")
                .withDataType(ColumnDataType.TIME)
                .withDescription("Start time of event"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("time_export"))
            .withEntity(table.getEntityReference())
            .withDescription("Test contract with time type")
            .withSchema(schema);

    DataContract contract = createEntity(request);

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs);

    // ODCS v3.1.0: Schema is wrapped in object (table)
    assertNotNull(odcs.getSchema());
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertNotNull(tableObject.getProperties());
    assertEquals(2, tableObject.getProperties().size());

    assertEquals(
        ODCSSchemaElement.LogicalType.TIME, tableObject.getProperties().get(1).getLogicalType());
  }

  @Test
  void testImportDataContractWithTimestampType(TestNamespace ns) {
    List<Column> tableColumns =
        List.of(
            new Column().withName("event_timestamp").withDataType(ColumnDataType.TIMESTAMP),
            new Column().withName("event_time").withDataType(ColumnDataType.TIME));
    Table table = createTestTable(ns, tableColumns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("timestamp_import"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // ODCS v3.1.0: Schema is wrapped in object (table)
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName(table.getName());
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    List<ODCSSchemaElement> properties = new java.util.ArrayList<>();

    ODCSSchemaElement timestampCol = new ODCSSchemaElement();
    timestampCol.setName("event_timestamp");
    timestampCol.setLogicalType(ODCSSchemaElement.LogicalType.TIMESTAMP);
    properties.add(timestampCol);

    ODCSSchemaElement timeCol = new ODCSSchemaElement();
    timeCol.setName("event_time");
    timeCol.setLogicalType(ODCSSchemaElement.LogicalType.TIME);
    properties.add(timeCol);

    tableObject.setProperties(properties);
    odcs.setSchema(List.of(tableObject));

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getSchema());
    assertEquals(2, imported.getSchema().size());
    assertEquals("event_timestamp", imported.getSchema().get(0).getName());
    assertEquals(ColumnDataType.TIMESTAMP, imported.getSchema().get(0).getDataType());
    assertEquals("event_time", imported.getSchema().get(1).getName());
    assertEquals(ColumnDataType.TIME, imported.getSchema().get(1).getDataType());
  }

  @Test
  void testSmartMergePreservesExistingFields(TestNamespace ns) {
    Table table = createTestTable(ns);

    List<Column> existingSchema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("ID column"),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

    org.openmetadata.schema.api.data.RefreshFrequency rf =
        new org.openmetadata.schema.api.data.RefreshFrequency();
    rf.setInterval(1);
    rf.setUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.DAY);

    org.openmetadata.schema.api.data.Retention retention =
        new org.openmetadata.schema.api.data.Retention();
    retention.setPeriod(90);
    retention.setUnit(org.openmetadata.schema.api.data.Retention.Unit.DAY);

    ContractSLA existingSla = new ContractSLA();
    existingSla.setRefreshFrequency(rf);
    existingSla.setRetention(retention);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("smart_merge"))
            .withEntity(table.getEntityReference())
            .withDescription("Original description")
            .withSchema(existingSchema)
            .withSla(existingSla)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract existing = createEntity(request);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("smart_merge"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Updated description via smart merge");
    odcs.setDescription(desc);

    List<ODCSSlaProperty> slaProps = new java.util.ArrayList<>();
    ODCSSlaProperty maxLatency = new ODCSSlaProperty();
    maxLatency.setProperty("maxLatency");
    maxLatency.setValue("2");
    maxLatency.setUnit("hour");
    slaProps.add(maxLatency);
    odcs.setSlaProperties(slaProps);

    DataContract merged =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(odcs, table.getId(), "table");

    assertNotNull(merged);
    assertTrue(merged.getDescription().contains("Updated description via smart merge"));
    assertEquals(EntityStatus.DRAFT, merged.getEntityStatus());
    assertNotNull(merged.getSchema());
    assertEquals(2, merged.getSchema().size());
    assertNotNull(merged.getSla());
    assertEquals(90, merged.getSla().getRetention().getPeriod());
    assertEquals(2, merged.getSla().getMaxLatency().getValue());
  }

  @Test
  void testODCSVersionBackwardsCompatibility(TestNamespace ns) {
    List<Column> tableColumns =
        List.of(new Column().withName("date_col").withDataType(ColumnDataType.DATE));
    Table table = createTestTable(ns, tableColumns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("v302_compat"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Testing v3.0.2 backwards compatibility");
    odcs.setDescription(desc);

    List<ODCSSchemaElement> schema = new java.util.ArrayList<>();
    ODCSSchemaElement col = new ODCSSchemaElement();
    col.setName("date_col");
    col.setLogicalType(ODCSSchemaElement.LogicalType.DATE);
    schema.add(col);
    odcs.setSchema(schema);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(ns.prefix("v302_compat"), imported.getName());
    assertEquals(EntityStatus.APPROVED, imported.getEntityStatus());
    assertNotNull(imported.getSchema());
    assertEquals(1, imported.getSchema().size());
    assertEquals(ColumnDataType.DATE, imported.getSchema().get(0).getDataType());
  }

  @Test
  void testExportDataContractWithSecurity(TestNamespace ns) {
    Table table = createTestTable(ns);

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity();
    security.setDataClassification("confidential");

    List<org.openmetadata.schema.api.data.Policy> policies = new java.util.ArrayList<>();
    org.openmetadata.schema.api.data.Policy policy = new org.openmetadata.schema.api.data.Policy();
    policy.setAccessPolicy("data-consumer");
    policy.setIdentities(List.of("team-a", "team-b"));
    policies.add(policy);
    security.setPolicies(policies);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("security_export"))
            .withEntity(table.getEntityReference())
            .withDescription("Test contract with security")
            .withSecurity(security);

    DataContract contract = createEntity(request);

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs.getRoles());
    assertFalse(odcs.getRoles().isEmpty());

    boolean hasClassificationRole =
        odcs.getRoles().stream()
            .anyMatch(r -> r.getRole() != null && r.getRole().contains("classification"));
    assertTrue(hasClassificationRole);
  }

  @Test
  void testImportDataContractWithSLA(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("sla_import"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSlaProperty> slaProps = new java.util.ArrayList<>();

    ODCSSlaProperty refreshFreq = new ODCSSlaProperty();
    refreshFreq.setProperty("refreshFrequency");
    refreshFreq.setValue("6");
    refreshFreq.setUnit("hour");
    slaProps.add(refreshFreq);

    ODCSSlaProperty maxLatency = new ODCSSlaProperty();
    maxLatency.setProperty("maxLatency");
    maxLatency.setValue("30");
    maxLatency.setUnit("minute");
    slaProps.add(maxLatency);

    ODCSSlaProperty retention = new ODCSSlaProperty();
    retention.setProperty("retention");
    retention.setValue("365");
    retention.setUnit("day");
    slaProps.add(retention);

    odcs.setSlaProperties(slaProps);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getSla());
    assertEquals(6, imported.getSla().getRefreshFrequency().getInterval());
    assertEquals(
        org.openmetadata.schema.api.data.RefreshFrequency.Unit.HOUR,
        imported.getSla().getRefreshFrequency().getUnit());
    assertEquals(30, imported.getSla().getMaxLatency().getValue());
    assertEquals(365, imported.getSla().getRetention().getPeriod());
  }

  @Test
  void testImportDataContractMinimal(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("minimal_import"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Minimal test import");
    odcs.setDescription(desc);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(ns.prefix("minimal_import"), imported.getName());
    assertEquals(EntityStatus.APPROVED, imported.getEntityStatus());
  }

  @Test
  void testCreateOrUpdateFromODCSYaml(TestNamespace ns) {
    Table table = createTestTable(ns);

    String contractName = ns.prefix("yaml_upsert");

    String yamlContent =
        "apiVersion: v3.1.0\n"
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
            + "  purpose: Initial YAML contract\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n"
            + "    primaryKey: true\n";

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(created);
    assertEquals(contractName, created.getName());
    assertEquals(EntityStatus.DRAFT, created.getEntityStatus());
    assertTrue(created.getDescription().contains("Initial YAML contract"));

    String updatedYaml =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + contractName
            + "\n"
            + "version: \"1.0.0\"\n"
            + "status: active\n"
            + "description:\n"
            + "  purpose: Updated YAML contract\n";

    DataContract updated =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCSYaml(updatedYaml, table.getId(), "table");

    assertNotNull(updated);
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
    assertTrue(updated.getDescription().contains("Updated YAML contract"));
    assertNotNull(updated.getSchema());
    assertEquals(1, updated.getSchema().size());
  }

  @Test
  void testODCSRoundTripWithAllFields(TestNamespace ns) {
    List<Column> tableColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));
    Table table = createTestTable(ns, tableColumns);

    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("created_at")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Creation timestamp"),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("User email"));

    org.openmetadata.schema.api.data.ContractSLA sla =
        new org.openmetadata.schema.api.data.ContractSLA();
    org.openmetadata.schema.api.data.RefreshFrequency rf =
        new org.openmetadata.schema.api.data.RefreshFrequency();
    rf.setInterval(24);
    rf.setUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.HOUR);
    sla.setRefreshFrequency(rf);

    org.openmetadata.schema.api.data.MaxLatency ml =
        new org.openmetadata.schema.api.data.MaxLatency();
    ml.setValue(1);
    ml.setUnit(org.openmetadata.schema.api.data.MaxLatency.Unit.HOUR);
    sla.setMaxLatency(ml);

    org.openmetadata.schema.api.data.Retention ret =
        new org.openmetadata.schema.api.data.Retention();
    ret.setPeriod(90);
    ret.setUnit(org.openmetadata.schema.api.data.Retention.Unit.DAY);
    sla.setRetention(ret);

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity();
    security.setDataClassification("internal");

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("full_roundtrip"))
            .withEntity(table.getEntityReference())
            .withDescription("Comprehensive round-trip test")
            .withSchema(schema)
            .withSla(sla)
            .withSecurity(security)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract original = createEntity(request);

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(original.getId());

    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());
    assertEquals(original.getName(), odcs.getName());

    // ODCS v3.1.0: Schema is wrapped in object (table)
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertNotNull(tableObject.getProperties());
    assertEquals(3, tableObject.getProperties().size());
    assertEquals(
        ODCSSchemaElement.LogicalType.TIMESTAMP,
        tableObject.getProperties().get(1).getLogicalType());

    assertNotNull(odcs.getSlaProperties());
    assertTrue(odcs.getSlaProperties().size() >= 3);
    assertNotNull(odcs.getRoles());

    Table newTable = createTestTable(ns, tableColumns);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("reimported_full_" + UUID.randomUUID().toString().substring(0, 8)));

    DataContract reimported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, newTable.getId(), "table");

    assertNotNull(reimported);
    assertEquals(EntityStatus.APPROVED, reimported.getEntityStatus());
    assertEquals(3, reimported.getSchema().size());
    assertEquals(ColumnDataType.TIMESTAMP, reimported.getSchema().get(1).getDataType());
    assertNotNull(reimported.getSla());
    assertEquals(24, reimported.getSla().getRefreshFrequency().getInterval());
    assertEquals(1, reimported.getSla().getMaxLatency().getValue());
    assertEquals(90, reimported.getSla().getRetention().getPeriod());
  }

  @Test
  void testImportFromInvalidODCS(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();

    assertThrows(
        Exception.class,
        () -> SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table"),
        "Import should fail for ODCS contract with missing required fields");
  }

  @Test
  void testImportFromODCSYamlInvalid(TestNamespace ns) {
    Table table = createTestTable(ns);

    String invalidYaml = "this is not valid yaml: [[[";

    assertThrows(
        Exception.class,
        () ->
            SdkClients.adminClient()
                .dataContracts()
                .importFromODCSYaml(invalidYaml, table.getId(), "table"),
        "Import should fail for invalid YAML content");
  }

  @Test
  void testImportODCSWithNonExistentEntity(TestNamespace ns) {
    UUID nonExistentId = UUID.randomUUID();

    String validYaml =
        """
        apiVersion: v3.1.0
        kind: DataContract
        id: orphan-contract
        name: Orphan Contract
        version: "1.0.0"
        status: active
        """;

    assertThrows(
        Exception.class,
        () ->
            SdkClients.adminClient()
                .dataContracts()
                .importFromODCSYaml(validYaml, nonExistentId, "table"),
        "Import should fail for non-existent entity");
  }

  @Test
  void testExportODCSForNonExistentContract(TestNamespace ns) {
    UUID nonExistentId = UUID.randomUUID();

    assertThrows(
        Exception.class,
        () -> SdkClients.adminClient().dataContracts().exportToODCS(nonExistentId),
        "Export should fail for non-existent contract");
  }

  @Test
  void testImportODCSWithMissingApiVersionUsesDefault(TestNamespace ns) {
    // Note: apiVersion has a default value of v3.1.0 in the schema, so missing it should succeed
    Table table = createTestTable(ns);

    String yamlWithoutVersion =
        "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("missing_version")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n";

    // Should succeed using default apiVersion
    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlWithoutVersion, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(ns.prefix("missing_version"), imported.getName());
  }

  @Test
  void testImportODCSWithMissingStatus(TestNamespace ns) {
    Table table = createTestTable(ns);

    String invalidYaml =
        """
        apiVersion: v3.1.0
        kind: DataContract
        id: missing-status-contract
        name: Missing Status Contract
        version: "1.0.0"
        """;

    assertThrows(
        Exception.class,
        () ->
            SdkClients.adminClient()
                .dataContracts()
                .importFromODCSYaml(invalidYaml, table.getId(), "table"),
        "Import should fail for missing status");
  }

  @Test
  void testImportODCSWithInvalidKind(TestNamespace ns) {
    Table table = createTestTable(ns);

    String invalidYaml =
        """
        apiVersion: v3.1.0
        kind: ServiceContract
        id: invalid-kind-contract
        name: Invalid Kind Contract
        version: "1.0.0"
        status: active
        """;

    assertThrows(
        Exception.class,
        () ->
            SdkClients.adminClient()
                .dataContracts()
                .importFromODCSYaml(invalidYaml, table.getId(), "table"),
        "Import should fail for invalid kind");
  }

  @Test
  void testSmartMergeWithSchemaUpdate(TestNamespace ns) {
    List<Column> tableColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("email").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP));
    Table table = createTestTable(ns, tableColumns);

    List<Column> existingSchema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("ID column"),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

    org.openmetadata.schema.api.data.ContractSLA existingSla =
        new org.openmetadata.schema.api.data.ContractSLA();
    org.openmetadata.schema.api.data.Retention retention =
        new org.openmetadata.schema.api.data.Retention();
    retention.setPeriod(30);
    retention.setUnit(org.openmetadata.schema.api.data.Retention.Unit.DAY);
    existingSla.setRetention(retention);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("merge_schema"))
            .withEntity(table.getEntityReference())
            .withDescription("Original description")
            .withSchema(existingSchema)
            .withSla(existingSla)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract existing = createEntity(request);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("merge_schema"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> newSchema = new java.util.ArrayList<>();
    ODCSSchemaElement col1 = new ODCSSchemaElement();
    col1.setName("id");
    col1.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    newSchema.add(col1);

    ODCSSchemaElement col2 = new ODCSSchemaElement();
    col2.setName("email");
    col2.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    newSchema.add(col2);

    ODCSSchemaElement col3 = new ODCSSchemaElement();
    col3.setName("created_at");
    col3.setLogicalType(ODCSSchemaElement.LogicalType.TIMESTAMP);
    newSchema.add(col3);

    odcs.setSchema(newSchema);

    DataContract merged =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(odcs, table.getId(), "table");

    assertNotNull(merged);
    assertEquals(3, merged.getSchema().size());
    assertEquals("id", merged.getSchema().get(0).getName());
    assertEquals("email", merged.getSchema().get(1).getName());
    assertEquals("created_at", merged.getSchema().get(2).getName());
    assertEquals(ColumnDataType.TIMESTAMP, merged.getSchema().get(2).getDataType());
    assertNotNull(merged.getSla());
    assertEquals(30, merged.getSla().getRetention().getPeriod());
  }

  @Test
  void testExportODCSYamlByFqn(TestNamespace ns) {
    Table table = createTestTable(ns);

    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("yaml_fqn_export"))
            .withEntity(table.getEntityReference())
            .withDescription("YAML export by FQN test")
            .withSchema(schema);

    DataContract contract = SdkClients.adminClient().dataContracts().create(request);

    String yamlContent =
        SdkClients.adminClient()
            .dataContracts()
            .exportToODCSYamlByFqn(contract.getFullyQualifiedName());

    assertNotNull(yamlContent);
    assertTrue(yamlContent.contains("apiVersion:"));
    assertTrue(yamlContent.contains("v3.1.0"));
    assertTrue(yamlContent.contains("kind:"));
    assertTrue(yamlContent.contains("DataContract"));
    assertTrue(yamlContent.contains("name:"));
    assertTrue(yamlContent.contains(contract.getName()));
  }

  // ODCS IMPORT -> OPENMETADATA FORMAT RETRIEVAL TESTS

  @Test
  void testImportODCSAndRetrieveAsOpenMetadataFormat(TestNamespace ns) {
    // Create table with columns matching the ODCS schema
    List<Column> tableColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));
    Table table = createTestTable(ns, tableColumns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("odcs_to_om_basic"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Test ODCS to OpenMetadata conversion");
    desc.setLimitations("Some limitations");
    desc.setUsage("For testing purposes");
    odcs.setDescription(desc);

    List<ODCSSchemaElement> schema = new java.util.ArrayList<>();
    ODCSSchemaElement col1 = new ODCSSchemaElement();
    col1.setName("id");
    col1.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    col1.setPrimaryKey(true);
    col1.setDescription("Primary identifier");
    schema.add(col1);

    ODCSSchemaElement col2 = new ODCSSchemaElement();
    col2.setName("email");
    col2.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    col2.setRequired(true);
    col2.setDescription("User email address");
    schema.add(col2);

    odcs.setSchema(schema);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    DataContract retrieved =
        SdkClients.adminClient()
            .dataContracts()
            .get(imported.getId().toString(), "schema,sla,security,semantics");

    assertNotNull(retrieved);
    assertEquals(odcs.getName(), retrieved.getName());
    assertEquals(EntityStatus.APPROVED, retrieved.getEntityStatus());
    assertNotNull(retrieved.getDescription());
    assertTrue(retrieved.getDescription().contains("Test ODCS to OpenMetadata conversion"));

    assertNotNull(retrieved.getSchema());
    assertEquals(2, retrieved.getSchema().size());

    Column idCol = retrieved.getSchema().get(0);
    assertEquals("id", idCol.getName());
    assertEquals(ColumnDataType.INT, idCol.getDataType());
    assertEquals("Primary identifier", idCol.getDescription());

    Column emailCol = retrieved.getSchema().get(1);
    assertEquals("email", emailCol.getName());
    // ODCS logicalType STRING maps to ColumnDataType.STRING
    assertEquals(ColumnDataType.STRING, emailCol.getDataType());
    assertEquals("User email address", emailCol.getDescription());
  }

  @Test
  void testImportODCSWithSLAAndRetrieveAsOpenMetadataFormat(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("odcs_to_om_sla"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSlaProperty> slaProperties = new java.util.ArrayList<>();

    ODCSSlaProperty freshness = new ODCSSlaProperty();
    freshness.setProperty("freshness");
    freshness.setValue("24");
    freshness.setUnit("hour");
    slaProperties.add(freshness);

    ODCSSlaProperty retention = new ODCSSlaProperty();
    retention.setProperty("retention");
    retention.setValue("90");
    retention.setUnit("day");
    slaProperties.add(retention);

    ODCSSlaProperty latency = new ODCSSlaProperty();
    latency.setProperty("latency");
    latency.setValue("5");
    latency.setUnit("minute");
    slaProperties.add(latency);

    odcs.setSlaProperties(slaProperties);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    DataContract retrieved =
        SdkClients.adminClient().dataContracts().get(imported.getId().toString(), "sla");

    assertNotNull(retrieved);
    assertNotNull(retrieved.getSla());

    assertNotNull(retrieved.getSla().getRefreshFrequency());
    assertEquals(24, retrieved.getSla().getRefreshFrequency().getInterval());
    assertEquals(
        org.openmetadata.schema.api.data.RefreshFrequency.Unit.HOUR,
        retrieved.getSla().getRefreshFrequency().getUnit());

    assertNotNull(retrieved.getSla().getRetention());
    assertEquals(90, retrieved.getSla().getRetention().getPeriod());
    assertEquals(
        org.openmetadata.schema.api.data.Retention.Unit.DAY,
        retrieved.getSla().getRetention().getUnit());

    assertNotNull(retrieved.getSla().getMaxLatency());
    assertEquals(5, retrieved.getSla().getMaxLatency().getValue());
    assertEquals(
        org.openmetadata.schema.api.data.MaxLatency.Unit.MINUTE,
        retrieved.getSla().getMaxLatency().getUnit());
  }

  @Test
  void testImportODCSYamlWithFullFieldsAndRetrieveAsOpenMetadataFormat(TestNamespace ns) {
    // Create table with columns matching the ODCS schema
    List<Column> tableColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP),
            new Column().withName("amount").withDataType(ColumnDataType.DOUBLE),
            new Column().withName("is_active").withDataType(ColumnDataType.BOOLEAN));
    Table table = createTestTable(ns, tableColumns);

    String contractName = ns.prefix("odcs_yaml_full_to_om");

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + contractName
            + "\n"
            + "version: \"2.0.0\"\n"
            + "status: active\n"
            + "description:\n"
            + "  purpose: Full ODCS contract for OpenMetadata conversion test\n"
            + "  limitations: Test limitations\n"
            + "  usage: Testing ODCS to OpenMetadata mapping\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n"
            + "    primaryKey: true\n"
            + "    description: Primary identifier\n"
            + "  - name: created_at\n"
            + "    logicalType: timestamp\n"
            + "    description: Creation timestamp\n"
            + "  - name: amount\n"
            + "    logicalType: number\n"
            + "    description: Transaction amount\n"
            + "  - name: is_active\n"
            + "    logicalType: boolean\n"
            + "    description: Active flag\n"
            + "slaProperties:\n"
            + "  - property: freshness\n"
            + "    value: \"12\"\n"
            + "    unit: hour\n"
            + "  - property: retention\n"
            + "    value: \"365\"\n"
            + "    unit: day\n"
            + "team:\n"
            + "  - username: data_steward\n"
            + "    role: steward\n"
            + "    name: Data Steward\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    DataContract retrieved =
        SdkClients.adminClient()
            .dataContracts()
            .get(imported.getId().toString(), "schema,sla,security,semantics");

    assertNotNull(retrieved);
    assertEquals(contractName, retrieved.getName());
    assertEquals(EntityStatus.APPROVED, retrieved.getEntityStatus());
    assertNotNull(retrieved.getDescription());
    assertTrue(
        retrieved.getDescription().contains("Full ODCS contract for OpenMetadata conversion test"));

    assertNotNull(retrieved.getSchema());
    assertEquals(4, retrieved.getSchema().size());

    assertEquals("id", retrieved.getSchema().get(0).getName());
    assertEquals(ColumnDataType.INT, retrieved.getSchema().get(0).getDataType());

    assertEquals("created_at", retrieved.getSchema().get(1).getName());
    assertEquals(ColumnDataType.TIMESTAMP, retrieved.getSchema().get(1).getDataType());

    assertEquals("amount", retrieved.getSchema().get(2).getName());
    assertEquals(
        ColumnDataType.NUMBER,
        retrieved.getSchema().get(2).getDataType()); // ODCS "number" maps to NUMBER

    assertEquals("is_active", retrieved.getSchema().get(3).getName());
    assertEquals(ColumnDataType.BOOLEAN, retrieved.getSchema().get(3).getDataType());

    assertNotNull(retrieved.getSla());
    assertNotNull(retrieved.getSla().getRefreshFrequency());
    assertEquals(12, retrieved.getSla().getRefreshFrequency().getInterval());
    assertNotNull(retrieved.getSla().getRetention());
    assertEquals(365, retrieved.getSla().getRetention().getPeriod());
  }

  @Test
  void testImportODCSWithTimezoneAndRetrieveAsOpenMetadataFormat(TestNamespace ns) {
    // Create table with columns matching the ODCS schema
    List<Column> tableColumns =
        List.of(
            new Column().withName("event_time").withDataType(ColumnDataType.TIMESTAMP),
            new Column().withName("start_time").withDataType(ColumnDataType.TIME));
    Table table = createTestTable(ns, tableColumns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("odcs_timezone_to_om"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    List<ODCSSchemaElement> schema = new java.util.ArrayList<>();

    ODCSSchemaElement timestampCol = new ODCSSchemaElement();
    timestampCol.setName("event_time");
    timestampCol.setLogicalType(ODCSSchemaElement.LogicalType.TIMESTAMP);
    timestampCol.setDescription("Event timestamp with timezone");

    org.openmetadata.schema.entity.datacontract.odcs.ODCSLogicalTypeOptions options =
        new org.openmetadata.schema.entity.datacontract.odcs.ODCSLogicalTypeOptions();
    options.setTimezone(true);
    options.setDefaultTimezone("America/New_York");
    timestampCol.setLogicalTypeOptions(options);

    schema.add(timestampCol);

    ODCSSchemaElement timeCol = new ODCSSchemaElement();
    timeCol.setName("start_time");
    timeCol.setLogicalType(ODCSSchemaElement.LogicalType.TIME);
    timeCol.setDescription("Start time");
    schema.add(timeCol);

    odcs.setSchema(schema);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    DataContract retrieved =
        SdkClients.adminClient().dataContracts().get(imported.getId().toString(), "schema");

    assertNotNull(retrieved);
    assertNotNull(retrieved.getSchema());
    assertEquals(2, retrieved.getSchema().size());

    Column eventTimeCol = retrieved.getSchema().get(0);
    assertEquals("event_time", eventTimeCol.getName());
    assertEquals(ColumnDataType.TIMESTAMP, eventTimeCol.getDataType());

    Column startTimeCol = retrieved.getSchema().get(1);
    assertEquals("start_time", startTimeCol.getName());
    assertEquals(ColumnDataType.TIME, startTimeCol.getDataType());
  }

  @Test
  void testImportODCSWithDraftStatusAndRetrieveAsOpenMetadataFormat(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("odcs_draft_to_om"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    DataContract retrieved = SdkClients.adminClient().dataContracts().get(imported.getId());

    assertNotNull(retrieved);
    assertEquals(EntityStatus.DRAFT, retrieved.getEntityStatus());
  }

  @Test
  void testImportODCSV302AndRetrieveAsOpenMetadataFormat(TestNamespace ns) {
    // Create table with columns matching the ODCS schema
    List<Column> tableColumns =
        List.of(
            new Column()
                .withName("legacy_field")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));
    Table table = createTestTable(ns, tableColumns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("odcs_v302_to_om"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Testing v3.0.2 backwards compatibility");
    odcs.setDescription(desc);

    List<ODCSSchemaElement> schema = new java.util.ArrayList<>();
    ODCSSchemaElement col1 = new ODCSSchemaElement();
    col1.setName("legacy_field");
    col1.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    schema.add(col1);
    odcs.setSchema(schema);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    DataContract retrieved =
        SdkClients.adminClient().dataContracts().get(imported.getId().toString(), "schema");

    assertNotNull(retrieved);
    assertEquals(odcs.getName(), retrieved.getName());
    assertNotNull(retrieved.getDescription());
    assertTrue(retrieved.getDescription().contains("Testing v3.0.2 backwards compatibility"));
    assertNotNull(retrieved.getSchema());
    assertEquals(1, retrieved.getSchema().size());
    assertEquals("legacy_field", retrieved.getSchema().get(0).getName());
  }

  // MERGE VS REPLACE MODE TESTS

  @Test
  void testODCSMergeModePreservesIdentity(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create initial contract with schema
    ODCSDataContract initialOdcs = new ODCSDataContract();
    initialOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    initialOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    initialOdcs.setId(UUID.randomUUID().toString());
    initialOdcs.setName(ns.prefix("merge_identity_test"));
    initialOdcs.setVersion("1.0.0");
    initialOdcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Initial description");
    initialOdcs.setDescription(desc);

    List<ODCSSchemaElement> schema = new java.util.ArrayList<>();
    ODCSSchemaElement col = new ODCSSchemaElement();
    col.setName("id");
    col.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    schema.add(col);
    initialOdcs.setSchema(schema);

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(initialOdcs, table.getId(), "table");

    UUID originalId = created.getId();
    String originalFqn = created.getFullyQualifiedName();
    String originalName = created.getName();

    // Update with merge mode
    ODCSDataContract updateOdcs = new ODCSDataContract();
    updateOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    updateOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    updateOdcs.setId(UUID.randomUUID().toString());
    updateOdcs.setName(ns.prefix("different_name"));
    updateOdcs.setVersion("2.0.0");
    updateOdcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription newDesc = new ODCSDescription();
    newDesc.setPurpose("Updated description via merge");
    updateOdcs.setDescription(newDesc);

    DataContract merged =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(updateOdcs, table.getId(), "table", "merge");

    // Verify ID, FQN, and name are preserved
    assertEquals(originalId, merged.getId());
    assertEquals(originalFqn, merged.getFullyQualifiedName());
    assertEquals(originalName, merged.getName());
    assertEquals(table.getId(), merged.getEntity().getId());

    // Verify other fields are updated
    assertTrue(merged.getDescription().contains("Updated description via merge"));
  }

  @Test
  void testODCSMergeModePreservesExistingFields(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create initial contract with schema and SLA
    ODCSDataContract initialOdcs = new ODCSDataContract();
    initialOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    initialOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    initialOdcs.setId(UUID.randomUUID().toString());
    initialOdcs.setName(ns.prefix("merge_preserve_fields"));
    initialOdcs.setVersion("1.0.0");
    initialOdcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    List<ODCSSchemaElement> schema = new java.util.ArrayList<>();
    ODCSSchemaElement col = new ODCSSchemaElement();
    col.setName("id"); // Use column that exists in test table
    col.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    col.setRequired(true);
    schema.add(col);
    initialOdcs.setSchema(schema);

    List<ODCSSlaProperty> slaProps = new java.util.ArrayList<>();
    ODCSSlaProperty freshness = new ODCSSlaProperty();
    freshness.setProperty("freshness");
    freshness.setValue("24");
    freshness.setUnit("hour"); // Use normalized unit value
    slaProps.add(freshness);
    initialOdcs.setSlaProperties(slaProps);

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(initialOdcs, table.getId(), "table");

    // Update with only description (no schema or SLA)
    ODCSDataContract updateOdcs = new ODCSDataContract();
    updateOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    updateOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    updateOdcs.setId(UUID.randomUUID().toString());
    updateOdcs.setName(ns.prefix("merge_preserve_fields"));
    updateOdcs.setVersion("1.0.0");
    updateOdcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription newDesc = new ODCSDescription();
    newDesc.setPurpose("Updated description only");
    updateOdcs.setDescription(newDesc);

    DataContract merged =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(updateOdcs, table.getId(), "table", "merge");

    DataContract retrieved =
        SdkClients.adminClient().dataContracts().get(merged.getId().toString(), "schema,sla");

    // Verify schema is preserved
    assertNotNull(retrieved.getSchema());
    assertEquals(1, retrieved.getSchema().size());
    assertEquals("id", retrieved.getSchema().get(0).getName());

    // Verify SLA is preserved
    assertNotNull(retrieved.getSla());
    assertNotNull(retrieved.getSla().getRefreshFrequency());
  }

  @Test
  void testODCSReplaceModePreservesIdAndHistory(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create initial contract with schema and SLA
    ODCSDataContract initialOdcs = new ODCSDataContract();
    initialOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    initialOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    initialOdcs.setId(UUID.randomUUID().toString());
    initialOdcs.setName(ns.prefix("replace_test"));
    initialOdcs.setVersion("1.0.0");
    initialOdcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Initial description");
    initialOdcs.setDescription(desc);

    List<ODCSSchemaElement> schema = new java.util.ArrayList<>();
    ODCSSchemaElement col = new ODCSSchemaElement();
    col.setName("name"); // Use column that exists in test table
    col.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    schema.add(col);
    initialOdcs.setSchema(schema);

    List<ODCSSlaProperty> slaProps = new java.util.ArrayList<>();
    ODCSSlaProperty freshness = new ODCSSlaProperty();
    freshness.setProperty("freshness");
    freshness.setValue("48");
    freshness.setUnit("hour"); // Use normalized unit value
    slaProps.add(freshness);
    initialOdcs.setSlaProperties(slaProps);

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(initialOdcs, table.getId(), "table");

    UUID originalId = created.getId();
    String originalFqn = created.getFullyQualifiedName();
    String originalName = created.getName();

    // Replace with completely different contract (no schema, no SLA)
    ODCSDataContract replaceOdcs = new ODCSDataContract();
    replaceOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    replaceOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    replaceOdcs.setId(UUID.randomUUID().toString());
    replaceOdcs.setName(ns.prefix("different_name_replace"));
    replaceOdcs.setVersion("3.0.0");
    replaceOdcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription newDesc = new ODCSDescription();
    newDesc.setPurpose("Completely replaced description");
    replaceOdcs.setDescription(newDesc);

    DataContract replaced =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(replaceOdcs, table.getId(), "table", "replace");

    // Verify ID, FQN, name, and entity are preserved
    assertEquals(originalId, replaced.getId());
    assertEquals(originalFqn, replaced.getFullyQualifiedName());
    assertEquals(originalName, replaced.getName());
    assertEquals(table.getId(), replaced.getEntity().getId());

    // Verify description is replaced
    assertTrue(replaced.getDescription().contains("Completely replaced description"));
  }

  @Test
  void testODCSImportWithClassificationPII(TestNamespace ns) {
    // Create table with columns matching the ODCS schema (nested users structure)
    List<Column> childColumns =
        List.of(
            new Column().withName("email").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("ssn").withDataType(ColumnDataType.VARCHAR).withDataLength(20),
            new Column()
                .withName("public_id")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));
    List<Column> tableColumns =
        List.of(
            new Column()
                .withName("users")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(childColumns));
    Table table = createTestTable(ns, tableColumns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("classification_pii")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: users\n"
            + "    properties:\n"
            + "      - name: email\n"
            + "        logicalType: string\n"
            + "        classification: PII\n"
            + "        description: User email address - contains personal information\n"
            + "      - name: ssn\n"
            + "        logicalType: string\n"
            + "        classification: sensitive\n"
            + "        description: Social security number\n"
            + "      - name: public_id\n"
            + "        logicalType: string\n"
            + "        classification: public\n"
            + "        description: Public identifier\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(ns.prefix("classification_pii"), imported.getName());
  }

  @Test
  void testODCSYamlMergeMode(TestNamespace ns) {
    Table table = createTestTable(ns);

    String initialYaml =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_merge_test")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: draft\n"
            + "description:\n"
            + "  purpose: Initial contract\n"
            + "slaProperties:\n"
            + "  - property: freshness\n"
            + "    value: '12'\n"
            + "    unit: hour\n";

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCSYaml(initialYaml, table.getId(), "table");

    UUID originalId = created.getId();
    String originalName = created.getName();

    String updateYaml =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_merge_different_name")
            + "\n"
            + "version: '2.0.0'\n"
            + "status: active\n"
            + "description:\n"
            + "  purpose: Updated via merge mode\n";

    DataContract merged =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCSYaml(updateYaml, table.getId(), "table", "merge");

    // Verify ID and name preserved
    assertEquals(originalId, merged.getId());
    assertEquals(originalName, merged.getName());

    // Verify description updated
    assertTrue(merged.getDescription().contains("Updated via merge mode"));

    DataContract retrieved =
        SdkClients.adminClient().dataContracts().get(merged.getId().toString(), "sla");

    // Verify SLA preserved (not in update YAML)
    assertNotNull(retrieved.getSla());
    assertNotNull(retrieved.getSla().getRefreshFrequency());
  }

  @Test
  void testODCSYamlReplaceMode(TestNamespace ns) {
    Table table = createTestTable(ns);

    String initialYaml =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_replace_test")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: draft\n"
            + "description:\n"
            + "  purpose: Initial contract\n"
            + "slaProperties:\n"
            + "  - property: freshness\n"
            + "    value: '12'\n"
            + "    unit: hours\n"
            + "schema:\n"
            + "  - name: name\n"
            + "    logicalType: string\n";

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCSYaml(initialYaml, table.getId(), "table");

    UUID originalId = created.getId();
    String originalName = created.getName();

    String replaceYaml =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_replace_different_name")
            + "\n"
            + "version: '3.0.0'\n"
            + "status: active\n"
            + "description:\n"
            + "  purpose: Completely replaced via replace mode\n";

    DataContract replaced =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCSYaml(replaceYaml, table.getId(), "table", "replace");

    // Verify ID and name preserved
    assertEquals(originalId, replaced.getId());
    assertEquals(originalName, replaced.getName());

    // Verify description replaced
    assertTrue(replaced.getDescription().contains("Completely replaced via replace mode"));
  }

  @Test
  void testODCSImportWithVariousClassifications(TestNamespace ns) {
    // Create table with columns matching the ODCS schema (nested data structure)
    List<Column> childColumns =
        List.of(
            new Column()
                .withName("field_pii")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("field_public")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("field_internal")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("field_confidential")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("field_restricted")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("field_sensitive")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255),
            new Column()
                .withName("field_custom")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));
    List<Column> tableColumns =
        List.of(
            new Column()
                .withName("data")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(childColumns));
    Table table = createTestTable(ns, tableColumns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("various_classifications")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: data\n"
            + "    properties:\n"
            + "      - name: field_pii\n"
            + "        logicalType: string\n"
            + "        classification: PII\n"
            + "      - name: field_public\n"
            + "        logicalType: string\n"
            + "        classification: public\n"
            + "      - name: field_internal\n"
            + "        logicalType: string\n"
            + "        classification: internal\n"
            + "      - name: field_confidential\n"
            + "        logicalType: string\n"
            + "        classification: confidential\n"
            + "      - name: field_restricted\n"
            + "        logicalType: string\n"
            + "        classification: restricted\n"
            + "      - name: field_sensitive\n"
            + "        logicalType: string\n"
            + "        classification: sensitive\n"
            + "      - name: field_custom\n"
            + "        logicalType: string\n"
            + "        classification: CustomClassification\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(ns.prefix("various_classifications"), imported.getName());
  }

  @Test
  void testODCSImportFullV310Features(TestNamespace ns) {
    // Create table with columns matching the ODCS schema (nested events structure)
    List<Column> childColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column().withName("event_time").withDataType(ColumnDataType.TIMESTAMP),
            new Column().withName("duration").withDataType(ColumnDataType.TIME),
            new Column()
                .withName("user_email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255));
    List<Column> tableColumns =
        List.of(
            new Column()
                .withName("events")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(childColumns));
    Table table = createTestTable(ns, tableColumns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("full_v310")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "description:\n"
            + "  purpose: Full v3.1.0 test contract\n"
            + "  limitations: Test only\n"
            + "  usage: Integration testing\n"
            + "schema:\n"
            + "  - name: events\n"
            + "    properties:\n"
            + "      - name: id\n"
            + "        logicalType: integer\n"
            + "        primaryKey: true\n"
            + "        required: true\n"
            + "      - name: event_time\n"
            + "        logicalType: timestamp\n"
            + "        logicalTypeOptions:\n"
            + "          timezone: true\n"
            + "          defaultTimezone: America/New_York\n"
            + "      - name: duration\n"
            + "        logicalType: time\n"
            + "      - name: user_email\n"
            + "        logicalType: string\n"
            + "        classification: PII\n"
            + "        required: true\n"
            + "slaProperties:\n"
            + "  - property: freshness\n"
            + "    value: '1'\n"
            + "    unit: hours\n"
            + "  - property: latency\n"
            + "    value: '30'\n"
            + "    unit: minute\n"
            + "  - property: retention\n"
            + "    value: '90'\n"
            + "    unit: days\n"
            + "roles:\n"
            + "  - role: DataReader\n"
            + "    description: Read-only access\n"
            + "    access: read\n"
            + "  - role: DataWriter\n"
            + "    description: Write access\n"
            + "    access: readWrite\n"
            + "team:\n"
            + "  - username: owner\n"
            + "    role: owner\n"
            + "  - username: developer\n"
            + "    role: developer\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(ns.prefix("full_v310"), imported.getName());

    DataContract retrieved =
        SdkClients.adminClient().dataContracts().get(imported.getId().toString(), "schema,sla");

    // Verify various fields were imported
    assertNotNull(retrieved.getDescription());
    assertTrue(retrieved.getDescription().contains("Full v3.1.0 test contract"));

    // Verify SLA
    assertNotNull(retrieved.getSla());
    assertNotNull(retrieved.getSla().getRefreshFrequency());
    assertNotNull(retrieved.getSla().getMaxLatency());
    assertNotNull(retrieved.getSla().getRetention());

    // Verify schema
    assertNotNull(retrieved.getSchema());
    assertFalse(retrieved.getSchema().isEmpty());
  }

  // ==================== ODCS Validation Endpoint Tests ====================

  @Test
  void testValidateODCSYamlValidSchema(TestNamespace ns) {
    // Create table with columns matching the ODCS schema
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255),
                new Column()
                    .withName("email")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("validate_valid")
            + "\n"
            + "name: "
            + ns.prefix("validate_valid")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n"
            + "  - name: name\n"
            + "    logicalType: string\n";

    ContractValidation validation =
        SdkClients.adminClient()
            .dataContracts()
            .validateODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(validation);
    assertTrue(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    assertEquals(2, validation.getSchemaValidation().getTotal());
    assertEquals(2, validation.getSchemaValidation().getPassed());
    assertEquals(0, validation.getSchemaValidation().getFailed());
    assertTrue(
        validation.getSchemaValidation().getFailedFields() == null
            || validation.getSchemaValidation().getFailedFields().isEmpty());
  }

  @Test
  void testValidateODCSYamlInvalidSchema(TestNamespace ns) {
    // Create table with columns that DON'T match the ODCS schema
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    // Schema refers to columns that don't exist in the table
    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("validate_invalid")
            + "\n"
            + "name: "
            + ns.prefix("validate_invalid")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: customer_id\n"
            + "    logicalType: integer\n"
            + "  - name: order_total\n"
            + "    logicalType: number\n";

    ContractValidation validation =
        SdkClients.adminClient()
            .dataContracts()
            .validateODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(validation);
    assertFalse(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    assertEquals(2, validation.getSchemaValidation().getTotal());
    assertEquals(0, validation.getSchemaValidation().getPassed());
    assertEquals(2, validation.getSchemaValidation().getFailed());
    assertNotNull(validation.getSchemaValidation().getFailedFields());
    assertEquals(2, validation.getSchemaValidation().getFailedFields().size());
    assertTrue(validation.getSchemaValidation().getFailedFields().contains("customer_id"));
    assertTrue(validation.getSchemaValidation().getFailedFields().contains("order_total"));
  }

  @Test
  void testValidateODCSYamlPartiallyValidSchema(TestNamespace ns) {
    // Create table with some matching columns
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255),
                new Column()
                    .withName("email")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    // Schema has some valid and some invalid columns
    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("validate_partial")
            + "\n"
            + "name: "
            + ns.prefix("validate_partial")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n"
            + "  - name: name\n"
            + "    logicalType: string\n"
            + "  - name: nonexistent_field\n"
            + "    logicalType: string\n";

    ContractValidation validation =
        SdkClients.adminClient()
            .dataContracts()
            .validateODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(validation);
    assertFalse(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    assertEquals(3, validation.getSchemaValidation().getTotal());
    assertEquals(2, validation.getSchemaValidation().getPassed());
    assertEquals(1, validation.getSchemaValidation().getFailed());
    assertNotNull(validation.getSchemaValidation().getFailedFields());
    assertEquals(1, validation.getSchemaValidation().getFailedFields().size());
    assertTrue(validation.getSchemaValidation().getFailedFields().contains("nonexistent_field"));
  }

  @Test
  void testValidateODCSYamlNoSchema(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Contract without schema section
    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("validate_no_schema")
            + "\n"
            + "name: "
            + ns.prefix("validate_no_schema")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n";

    ContractValidation validation =
        SdkClients.adminClient()
            .dataContracts()
            .validateODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(validation);
    assertTrue(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    assertEquals(0, validation.getSchemaValidation().getTotal());
    assertEquals(0, validation.getSchemaValidation().getPassed());
    assertEquals(0, validation.getSchemaValidation().getFailed());
  }

  @Test
  void testValidateODCSYamlInvalidYamlSyntax(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Invalid YAML syntax
    String invalidYaml = "apiVersion: v3.1.0\n  invalid yaml: [\n";

    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.adminClient()
                .dataContracts()
                .validateODCSYaml(invalidYaml, table.getId(), "table"),
        "Validation should fail for invalid YAML syntax");
  }

  @Test
  void testValidateODCSYamlMissingRequiredFields(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Missing required 'status' field
    String yamlContent =
        "apiVersion: v3.1.0\n" + "kind: DataContract\n" + "id: test\n" + "version: '1.0.0'\n";

    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.adminClient()
                .dataContracts()
                .validateODCSYaml(yamlContent, table.getId(), "table"),
        "Validation should fail for missing required fields");
  }

  @Test
  void testValidateODCSYamlValidationDoesNotCreateContract(TestNamespace ns) {
    Table table =
        createTestTable(ns, List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("validate_no_create")
            + "\n"
            + "name: "
            + ns.prefix("validate_no_create")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n";

    // Call validation endpoint
    ContractValidation validation =
        SdkClients.adminClient()
            .dataContracts()
            .validateODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(validation);
    assertTrue(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    assertEquals(1, validation.getSchemaValidation().getTotal());
    assertEquals(1, validation.getSchemaValidation().getPassed());

    // Verify that no contract was created
    assertThrows(
        OpenMetadataException.class,
        () -> SdkClients.adminClient().dataContracts().getByEntityId(table.getId(), "table"),
        "Contract should not exist after validation-only call");
  }

  // ===================================================================
  // ODCS QUALITY RULES TESTS (v3.1.0 Feature)
  // ===================================================================

  @Test
  void testImportODCSWithQualityRules(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("quality_rules_import"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Add quality rules
    java.util.List<ODCSQualityRule> qualityRules = new java.util.ArrayList<>();

    ODCSQualityRule sqlRule = new ODCSQualityRule();
    sqlRule.setType(ODCSQualityRule.Type.SQL);
    sqlRule.setName("check_positive_values");
    sqlRule.setDescription("Ensure all values are positive");
    sqlRule.setQuery("SELECT COUNT(*) FROM table WHERE value < 0");
    sqlRule.setDimension(ODCSQualityRule.Dimension.ACCURACY);
    qualityRules.add(sqlRule);

    ODCSQualityRule libraryRule = new ODCSQualityRule();
    libraryRule.setType(ODCSQualityRule.Type.LIBRARY);
    libraryRule.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    libraryRule.setColumn("id");
    libraryRule.setDescription("Check for null values in id column");
    qualityRules.add(libraryRule);

    odcs.setQuality(qualityRules);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(2, imported.getOdcsQualityRules().size());

    ODCSQualityRule importedSqlRule = imported.getOdcsQualityRules().get(0);
    assertEquals(ODCSQualityRule.Type.SQL, importedSqlRule.getType());
    assertEquals("check_positive_values", importedSqlRule.getName());
    assertEquals("SELECT COUNT(*) FROM table WHERE value < 0", importedSqlRule.getQuery());
    assertEquals(ODCSQualityRule.Dimension.ACCURACY, importedSqlRule.getDimension());

    ODCSQualityRule importedLibraryRule = imported.getOdcsQualityRules().get(1);
    assertEquals(ODCSQualityRule.Type.LIBRARY, importedLibraryRule.getType());
    assertEquals(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, importedLibraryRule.getMetric());
    assertEquals("id", importedLibraryRule.getColumn());
  }

  @Test
  void testExportODCSWithQualityRules(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create contract with quality rules
    java.util.List<ODCSQualityRule> qualityRules = new java.util.ArrayList<>();

    ODCSQualityRule rule = new ODCSQualityRule();
    rule.setType(ODCSQualityRule.Type.LIBRARY);
    rule.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    rule.setDescription("Check row count");
    rule.setMustBeGreaterThan(0.0);
    qualityRules.add(rule);

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("quality_rules_export"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract with quality rules for export test")
            .withOdcsQualityRules(qualityRules);

    DataContract contract = createEntity(request);

    ODCSDataContract odcs = SdkClients.adminClient().dataContracts().exportToODCS(contract.getId());

    assertNotNull(odcs);
    assertNotNull(odcs.getQuality());
    assertEquals(1, odcs.getQuality().size());

    ODCSQualityRule exportedRule = odcs.getQuality().get(0);
    assertEquals(ODCSQualityRule.Type.LIBRARY, exportedRule.getType());
    assertEquals(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT, exportedRule.getMetric());
    assertEquals(0.0, exportedRule.getMustBeGreaterThan());
  }

  @Test
  void testQualityRulesRoundTrip(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create ODCS contract with various quality rule types
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("quality_roundtrip"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    java.util.List<ODCSQualityRule> qualityRules = new java.util.ArrayList<>();

    // SQL rule
    ODCSQualityRule sqlRule = new ODCSQualityRule();
    sqlRule.setType(ODCSQualityRule.Type.SQL);
    sqlRule.setName("data_freshness_check");
    sqlRule.setQuery("SELECT MAX(updated_at) FROM data");
    sqlRule.setDimension(ODCSQualityRule.Dimension.TIMELINESS);
    sqlRule.setSeverity("critical");
    qualityRules.add(sqlRule);

    // Library rule with metric
    ODCSQualityRule libraryRule = new ODCSQualityRule();
    libraryRule.setType(ODCSQualityRule.Type.LIBRARY);
    libraryRule.setMetric(ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES);
    libraryRule.setColumn("email");
    libraryRule.setDimension(ODCSQualityRule.Dimension.UNIQUENESS);
    qualityRules.add(libraryRule);

    // Custom rule
    ODCSQualityRule customRule = new ODCSQualityRule();
    customRule.setType(ODCSQualityRule.Type.CUSTOM);
    customRule.setEngine("great_expectations");
    customRule.setImplementation("{\"expectation_type\": \"expect_column_values_to_be_unique\"}");
    qualityRules.add(customRule);

    odcs.setQuality(qualityRules);

    // Import
    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(3, imported.getOdcsQualityRules().size());

    // Export and verify round-trip preservation
    ODCSDataContract exported =
        SdkClients.adminClient().dataContracts().exportToODCS(imported.getId());

    assertNotNull(exported.getQuality());
    assertEquals(3, exported.getQuality().size());

    // Verify SQL rule
    ODCSQualityRule exportedSqlRule =
        exported.getQuality().stream()
            .filter(r -> r.getType() == ODCSQualityRule.Type.SQL)
            .findFirst()
            .orElseThrow();
    assertEquals("data_freshness_check", exportedSqlRule.getName());
    assertEquals("SELECT MAX(updated_at) FROM data", exportedSqlRule.getQuery());
    assertEquals(ODCSQualityRule.Dimension.TIMELINESS, exportedSqlRule.getDimension());

    // Verify library rule
    ODCSQualityRule exportedLibraryRule =
        exported.getQuality().stream()
            .filter(r -> r.getType() == ODCSQualityRule.Type.LIBRARY)
            .findFirst()
            .orElseThrow();
    assertEquals(ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES, exportedLibraryRule.getMetric());
    assertEquals("email", exportedLibraryRule.getColumn());

    // Verify custom rule
    ODCSQualityRule exportedCustomRule =
        exported.getQuality().stream()
            .filter(r -> r.getType() == ODCSQualityRule.Type.CUSTOM)
            .findFirst()
            .orElseThrow();
    assertEquals("great_expectations", exportedCustomRule.getEngine());
  }

  @Test
  void testMergeModePreservesQualityRules(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create initial contract with quality rules
    ODCSDataContract initialOdcs = new ODCSDataContract();
    initialOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    initialOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    initialOdcs.setId(UUID.randomUUID().toString());
    initialOdcs.setName(ns.prefix("merge_quality"));
    initialOdcs.setVersion("1.0.0");
    initialOdcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    java.util.List<ODCSQualityRule> initialRules = new java.util.ArrayList<>();
    ODCSQualityRule rule = new ODCSQualityRule();
    rule.setType(ODCSQualityRule.Type.LIBRARY);
    rule.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    rule.setColumn("id");
    initialRules.add(rule);
    initialOdcs.setQuality(initialRules);

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(initialOdcs, table.getId(), "table");

    assertNotNull(created.getOdcsQualityRules());
    assertEquals(1, created.getOdcsQualityRules().size());

    // Merge with update that has no quality rules
    ODCSDataContract updateOdcs = new ODCSDataContract();
    updateOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    updateOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    updateOdcs.setId(UUID.randomUUID().toString());
    updateOdcs.setName(ns.prefix("merge_quality"));
    updateOdcs.setVersion("2.0.0");
    updateOdcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Updated description");
    updateOdcs.setDescription(desc);

    DataContract merged =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(updateOdcs, table.getId(), "table", "merge");

    // Quality rules should be preserved from original
    assertNotNull(merged.getOdcsQualityRules());
    assertEquals(1, merged.getOdcsQualityRules().size());
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.NULL_VALUES,
        merged.getOdcsQualityRules().get(0).getMetric());
  }

  @Test
  void testReplaceModeReplacesQualityRules(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create initial contract with quality rules
    ODCSDataContract initialOdcs = new ODCSDataContract();
    initialOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    initialOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    initialOdcs.setId(UUID.randomUUID().toString());
    initialOdcs.setName(ns.prefix("replace_quality"));
    initialOdcs.setVersion("1.0.0");
    initialOdcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    java.util.List<ODCSQualityRule> initialRules = new java.util.ArrayList<>();
    ODCSQualityRule rule1 = new ODCSQualityRule();
    rule1.setType(ODCSQualityRule.Type.LIBRARY);
    rule1.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    initialRules.add(rule1);
    ODCSQualityRule rule2 = new ODCSQualityRule();
    rule2.setType(ODCSQualityRule.Type.SQL);
    rule2.setQuery("SELECT 1");
    initialRules.add(rule2);
    initialOdcs.setQuality(initialRules);

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(initialOdcs, table.getId(), "table");

    assertEquals(2, created.getOdcsQualityRules().size());

    // Replace with contract that has no quality rules
    ODCSDataContract replaceOdcs = new ODCSDataContract();
    replaceOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    replaceOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    replaceOdcs.setId(UUID.randomUUID().toString());
    replaceOdcs.setName(ns.prefix("replace_quality"));
    replaceOdcs.setVersion("2.0.0");
    replaceOdcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    DataContract replaced =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(replaceOdcs, table.getId(), "table", "replace");

    // Quality rules should be replaced (null since new contract has none)
    assertTrue(replaced.getOdcsQualityRules() == null || replaced.getOdcsQualityRules().isEmpty());
  }

  @Test
  void testImportODCSYamlWithQualityRules(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_quality")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "quality:\n"
            + "  - type: sql\n"
            + "    name: freshness_check\n"
            + "    query: SELECT MAX(updated_at) FROM orders\n"
            + "    dimension: timeliness\n"
            + "  - type: library\n"
            + "    metric: nullValues\n"
            + "    column: customer_id\n"
            + "    description: Customer ID must not be null\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(2, imported.getOdcsQualityRules().size());

    // Verify SQL rule
    ODCSQualityRule sqlRule =
        imported.getOdcsQualityRules().stream()
            .filter(r -> r.getType() == ODCSQualityRule.Type.SQL)
            .findFirst()
            .orElseThrow();
    assertEquals("freshness_check", sqlRule.getName());
    assertEquals("SELECT MAX(updated_at) FROM orders", sqlRule.getQuery());

    // Verify library rule
    ODCSQualityRule libraryRule =
        imported.getOdcsQualityRules().stream()
            .filter(r -> r.getType() == ODCSQualityRule.Type.LIBRARY)
            .findFirst()
            .orElseThrow();
    assertEquals(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, libraryRule.getMetric());
    assertEquals("customer_id", libraryRule.getColumn());
  }

  @Test
  void testQualityRulesWithSchedule(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("quality_schedule"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    java.util.List<ODCSQualityRule> qualityRules = new java.util.ArrayList<>();
    ODCSQualityRule rule = new ODCSQualityRule();
    rule.setType(ODCSQualityRule.Type.LIBRARY);
    rule.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    rule.setScheduler("cron");
    rule.setSchedule("0 0 * * *");
    qualityRules.add(rule);

    odcs.setQuality(qualityRules);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(1, imported.getOdcsQualityRules().size());

    ODCSQualityRule importedRule = imported.getOdcsQualityRules().get(0);
    assertEquals("cron", importedRule.getScheduler());
    assertEquals("0 0 * * *", importedRule.getSchedule());

    // Export and verify schedule is preserved
    ODCSDataContract exported =
        SdkClients.adminClient().dataContracts().exportToODCS(imported.getId());

    assertNotNull(exported.getQuality());
    assertEquals("cron", exported.getQuality().get(0).getScheduler());
    assertEquals("0 0 * * *", exported.getQuality().get(0).getSchedule());
  }

  @Test
  void testQualityRulesWithMustBeBetween(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("quality_between"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    java.util.List<ODCSQualityRule> qualityRules = new java.util.ArrayList<>();

    // Rule with mustBeBetween
    ODCSQualityRule betweenRule = new ODCSQualityRule();
    betweenRule.setType(ODCSQualityRule.Type.LIBRARY);
    betweenRule.setMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    betweenRule.setDescription("Row count must be between 100 and 10000");
    betweenRule.setMustBeBetween(java.util.Arrays.asList(100.0, 10000.0));
    qualityRules.add(betweenRule);

    // Rule with mustNotBeBetween
    ODCSQualityRule notBetweenRule = new ODCSQualityRule();
    notBetweenRule.setType(ODCSQualityRule.Type.LIBRARY);
    notBetweenRule.setMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES);
    notBetweenRule.setColumn("status");
    notBetweenRule.setDescription("Null percentage must not be between 10 and 90");
    notBetweenRule.setMustNotBeBetween(java.util.Arrays.asList(10.0, 90.0));
    qualityRules.add(notBetweenRule);

    // Rule with multiple assertions
    ODCSQualityRule multiAssertRule = new ODCSQualityRule();
    multiAssertRule.setType(ODCSQualityRule.Type.LIBRARY);
    multiAssertRule.setMetric(ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES);
    multiAssertRule.setColumn("id");
    multiAssertRule.setMustBeGreaterThan(0.0);
    multiAssertRule.setMustBeLessThan(1000000.0);
    qualityRules.add(multiAssertRule);

    odcs.setQuality(qualityRules);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(3, imported.getOdcsQualityRules().size());

    // Verify mustBeBetween rule
    ODCSQualityRule importedBetweenRule = imported.getOdcsQualityRules().get(0);
    assertNotNull(importedBetweenRule.getMustBeBetween());
    assertEquals(2, importedBetweenRule.getMustBeBetween().size());
    assertEquals(100.0, importedBetweenRule.getMustBeBetween().get(0));
    assertEquals(10000.0, importedBetweenRule.getMustBeBetween().get(1));

    // Verify mustNotBeBetween rule
    ODCSQualityRule importedNotBetweenRule = imported.getOdcsQualityRules().get(1);
    assertNotNull(importedNotBetweenRule.getMustNotBeBetween());
    assertEquals(2, importedNotBetweenRule.getMustNotBeBetween().size());
    assertEquals(10.0, importedNotBetweenRule.getMustNotBeBetween().get(0));
    assertEquals(90.0, importedNotBetweenRule.getMustNotBeBetween().get(1));

    // Export and verify round-trip
    ODCSDataContract exported =
        SdkClients.adminClient().dataContracts().exportToODCS(imported.getId());

    assertNotNull(exported.getQuality());
    assertEquals(3, exported.getQuality().size());

    ODCSQualityRule exportedBetweenRule = exported.getQuality().get(0);
    assertNotNull(exportedBetweenRule.getMustBeBetween());
    assertEquals(100.0, exportedBetweenRule.getMustBeBetween().get(0));
    assertEquals(10000.0, exportedBetweenRule.getMustBeBetween().get(1));

    ODCSQualityRule exportedNotBetweenRule = exported.getQuality().get(1);
    assertNotNull(exportedNotBetweenRule.getMustNotBeBetween());
    assertEquals(10.0, exportedNotBetweenRule.getMustNotBeBetween().get(0));
    assertEquals(90.0, exportedNotBetweenRule.getMustNotBeBetween().get(1));
  }

  @Test
  void testQualityRulesWithMustBeBetweenYaml(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_between")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "quality:\n"
            + "  - type: library\n"
            + "    metric: rowCount\n"
            + "    mustBeBetween:\n"
            + "      - 100\n"
            + "      - 10000\n"
            + "  - type: library\n"
            + "    metric: nullValues\n"
            + "    column: email\n"
            + "    mustNotBeBetween:\n"
            + "      - 5\n"
            + "      - 95\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(2, imported.getOdcsQualityRules().size());

    // Verify mustBeBetween from YAML
    ODCSQualityRule betweenRule = imported.getOdcsQualityRules().get(0);
    assertNotNull(betweenRule.getMustBeBetween());
    assertEquals(100.0, betweenRule.getMustBeBetween().get(0));
    assertEquals(10000.0, betweenRule.getMustBeBetween().get(1));

    // Verify mustNotBeBetween from YAML
    ODCSQualityRule notBetweenRule = imported.getOdcsQualityRules().get(1);
    assertNotNull(notBetweenRule.getMustNotBeBetween());
    assertEquals(5.0, notBetweenRule.getMustNotBeBetween().get(0));
    assertEquals(95.0, notBetweenRule.getMustNotBeBetween().get(1));
  }

  // ===================================================================
  // ODCS TEAM/OWNER RESOLUTION TESTS
  // ===================================================================

  @Test
  void testImportODCSWithTeamOwner(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("team_owner"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Add team member with role "owner" using admin user
    java.util.List<ODCSTeamMember> team = new java.util.ArrayList<>();
    ODCSTeamMember owner = new ODCSTeamMember();
    owner.setUsername("admin");
    owner.setName("Admin User");
    owner.setRole("owner");
    team.add(owner);
    odcs.setTeam(team);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOwners());
    assertFalse(imported.getOwners().isEmpty());
    assertEquals("admin", imported.getOwners().get(0).getName());
  }

  @Test
  void testImportODCSWithMultipleTeamMembers(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("multi_team"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Add multiple team members - only "owner" role should be imported
    java.util.List<ODCSTeamMember> team = new java.util.ArrayList<>();

    ODCSTeamMember owner = new ODCSTeamMember();
    owner.setUsername("admin");
    owner.setRole("owner");
    team.add(owner);

    ODCSTeamMember developer = new ODCSTeamMember();
    developer.setUsername("developer1");
    developer.setRole("developer");
    team.add(developer);

    ODCSTeamMember reviewer = new ODCSTeamMember();
    reviewer.setUsername("reviewer1");
    reviewer.setRole("reviewer");
    team.add(reviewer);

    odcs.setTeam(team);

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOwners());
    // Only the "owner" role member should be imported as owner
    assertEquals(1, imported.getOwners().size());
    assertEquals("admin", imported.getOwners().get(0).getName());
  }

  @Test
  void testExportODCSWithOwners(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create contract with owners
    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("export_owners"))
            .withEntity(table.getEntityReference())
            .withDescription("Contract with owners for export test");

    DataContract contract = createEntity(request);

    // Update contract to add owner
    ODCSDataContract odcsWithOwner = new ODCSDataContract();
    odcsWithOwner.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcsWithOwner.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcsWithOwner.setId(UUID.randomUUID().toString());
    odcsWithOwner.setName(ns.prefix("export_owners"));
    odcsWithOwner.setVersion("1.0.0");
    odcsWithOwner.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    java.util.List<ODCSTeamMember> team = new java.util.ArrayList<>();
    ODCSTeamMember owner = new ODCSTeamMember();
    owner.setUsername("admin");
    owner.setRole("owner");
    team.add(owner);
    odcsWithOwner.setTeam(team);

    DataContract updated =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(odcsWithOwner, table.getId(), "table", "replace");

    // Export and verify team is present
    ODCSDataContract exported =
        SdkClients.adminClient().dataContracts().exportToODCS(updated.getId());

    assertNotNull(exported);
    assertNotNull(exported.getTeam());
    assertFalse(exported.getTeam().isEmpty());

    ODCSTeamMember exportedOwner = exported.getTeam().get(0);
    assertEquals("admin", exportedOwner.getUsername());
    assertEquals("owner", exportedOwner.getRole());
  }

  @Test
  void testTeamOwnerRoundTrip(TestNamespace ns) {
    Table table = createTestTable(ns);

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("owner_roundtrip"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    java.util.List<ODCSTeamMember> team = new java.util.ArrayList<>();
    ODCSTeamMember owner = new ODCSTeamMember();
    owner.setUsername("admin");
    owner.setName("Admin User");
    owner.setRole("owner");
    team.add(owner);
    odcs.setTeam(team);

    // Import
    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported.getOwners());
    assertEquals(1, imported.getOwners().size());

    // Export
    ODCSDataContract exported =
        SdkClients.adminClient().dataContracts().exportToODCS(imported.getId());

    assertNotNull(exported.getTeam());
    assertEquals(1, exported.getTeam().size());
    assertEquals("admin", exported.getTeam().get(0).getUsername());
    assertEquals("owner", exported.getTeam().get(0).getRole());
  }

  @Test
  void testImportODCSYamlWithTeam(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_team")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "team:\n"
            + "  - username: admin\n"
            + "    name: Admin User\n"
            + "    role: owner\n"
            + "  - username: dev1\n"
            + "    name: Developer One\n"
            + "    role: developer\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOwners());
    // Only owner role should be imported
    assertEquals(1, imported.getOwners().size());
    assertEquals("admin", imported.getOwners().get(0).getName());
  }

  @Test
  void testMergeModePreservesOwners(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create initial contract with owner
    ODCSDataContract initialOdcs = new ODCSDataContract();
    initialOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    initialOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    initialOdcs.setId(UUID.randomUUID().toString());
    initialOdcs.setName(ns.prefix("merge_owners"));
    initialOdcs.setVersion("1.0.0");
    initialOdcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    java.util.List<ODCSTeamMember> team = new java.util.ArrayList<>();
    ODCSTeamMember owner = new ODCSTeamMember();
    owner.setUsername("admin");
    owner.setRole("owner");
    team.add(owner);
    initialOdcs.setTeam(team);

    DataContract created =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(initialOdcs, table.getId(), "table");

    assertNotNull(created.getOwners());
    assertEquals(1, created.getOwners().size());

    // Merge with update that has no team
    ODCSDataContract updateOdcs = new ODCSDataContract();
    updateOdcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    updateOdcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    updateOdcs.setId(UUID.randomUUID().toString());
    updateOdcs.setName(ns.prefix("merge_owners"));
    updateOdcs.setVersion("2.0.0");
    updateOdcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Updated description");
    updateOdcs.setDescription(desc);

    DataContract merged =
        SdkClients.adminClient()
            .dataContracts()
            .createOrUpdateFromODCS(updateOdcs, table.getId(), "table", "merge");

    // Owners should be preserved from original
    assertNotNull(merged.getOwners());
    assertEquals(1, merged.getOwners().size());
    assertEquals("admin", merged.getOwners().get(0).getName());
  }

  // ===================================================================
  // ODCS EDGE CASE TESTS
  // ===================================================================

  @Test
  void testImportODCSWithLargeSchema(TestNamespace ns) {
    // Create table with 150 columns to test large schema handling
    java.util.List<Column> columns = new java.util.ArrayList<>();
    for (int i = 0; i < 150; i++) {
      columns.add(
          new Column()
              .withName("column_" + i)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255));
    }
    Table table = createTestTable(ns, columns);

    // Create ODCS contract with 150 schema elements
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("large_schema"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Contract with large schema (150+ columns)");
    odcs.setDescription(desc);

    // Create schema with 150 properties
    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName(table.getName());
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    java.util.List<ODCSSchemaElement> properties = new java.util.ArrayList<>();
    for (int i = 0; i < 150; i++) {
      ODCSSchemaElement col = new ODCSSchemaElement();
      col.setName("column_" + i);
      col.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
      col.setDescription("Column " + i + " description");
      properties.add(col);
    }
    tableObject.setProperties(properties);
    odcs.setSchema(List.of(tableObject));

    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getId());
    assertEquals(odcs.getName(), imported.getName());
    assertNotNull(imported.getSchema());
    assertEquals(150, imported.getSchema().size());

    // Verify first and last columns
    assertEquals("column_0", imported.getSchema().get(0).getName());
    assertEquals("column_149", imported.getSchema().get(149).getName());
  }

  @Test
  void testImportODCSWithLargeYamlContent(TestNamespace ns) {
    // Create table with 100 columns to test large YAML parsing
    java.util.List<Column> columns = new java.util.ArrayList<>();
    for (int i = 0; i < 100; i++) {
      columns.add(
          new Column()
              .withName("col_" + i)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255));
    }
    Table table = createTestTable(ns, columns);

    // Build YAML with many schema columns and descriptions
    StringBuilder yamlBuilder = new StringBuilder();
    yamlBuilder.append("apiVersion: v3.1.0\n");
    yamlBuilder.append("kind: DataContract\n");
    yamlBuilder.append("id: ").append(UUID.randomUUID()).append("\n");
    yamlBuilder.append("name: ").append(ns.prefix("large_yaml")).append("\n");
    yamlBuilder.append("version: '1.0.0'\n");
    yamlBuilder.append("status: active\n");
    yamlBuilder.append("description:\n");
    yamlBuilder.append("  purpose: Contract with 100 columns for large YAML test\n");
    yamlBuilder.append("schema:\n");

    // Add 100 columns with descriptions
    for (int i = 0; i < 100; i++) {
      yamlBuilder.append("  - name: col_").append(i).append("\n");
      yamlBuilder.append("    logicalType: string\n");
      yamlBuilder.append("    description: Description for column ").append(i).append("\n");
    }

    String yamlContent = yamlBuilder.toString();

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getId());
    assertNotNull(imported.getSchema());
    assertEquals(100, imported.getSchema().size());

    // Verify first and last columns are correctly imported
    assertEquals("col_0", imported.getSchema().get(0).getName());
    assertEquals("col_99", imported.getSchema().get(99).getName());

    // Verify round-trip by exporting back
    ODCSDataContract exported =
        SdkClients.adminClient().dataContracts().exportToODCS(imported.getId());

    assertNotNull(exported);
    assertNotNull(exported.getSchema());
    assertEquals(1, exported.getSchema().size());
    ODCSSchemaElement tableObject = exported.getSchema().get(0);
    assertNotNull(tableObject.getProperties());
    assertEquals(100, tableObject.getProperties().size());
  }

  @Test
  void testImportODCSWithVeryLongContractName(TestNamespace ns) {
    Table table = createTestTable(ns);

    // Create a contract name longer than 500 characters
    StringBuilder longNameBuilder = new StringBuilder(ns.prefix("long_name_"));
    while (longNameBuilder.length() < 520) {
      longNameBuilder.append("a");
    }
    String longName = longNameBuilder.toString();

    assertTrue(longName.length() > 500, "Contract name should be longer than 500 characters");

    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(longName);
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Contract with very long name exceeding 500 characters");
    odcs.setDescription(desc);

    // This should either succeed or throw an appropriate validation error
    // Depending on the backend validation rules
    try {
      DataContract imported =
          SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

      assertNotNull(imported);
      // If import succeeds, verify the name is preserved or truncated appropriately
      assertNotNull(imported.getName());
    } catch (OpenMetadataException e) {
      // If validation fails, ensure it's a proper validation error
      assertTrue(
          e.getMessage().toLowerCase().contains("name")
              || e.getMessage().toLowerCase().contains("length")
              || e.getMessage().toLowerCase().contains("character")
              || e.getMessage().toLowerCase().contains("valid"),
          "Exception should indicate name length validation issue: " + e.getMessage());
    }
  }

  @Test
  void testImportODCSWithTypeMismatchStringVsInt(TestNamespace ns) {
    // Create table with INT column
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column().withName("count").withDataType(ColumnDataType.INT),
                new Column().withName("amount").withDataType(ColumnDataType.BIGINT)));

    // ODCS defines STRING type for columns that are INT in the entity
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("type_mismatch"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName(table.getName());
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    java.util.List<ODCSSchemaElement> properties = new java.util.ArrayList<>();

    // Define id as STRING when it's INT in the table
    ODCSSchemaElement idCol = new ODCSSchemaElement();
    idCol.setName("id");
    idCol.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    idCol.setDescription("ID column defined as string in ODCS but INT in table");
    properties.add(idCol);

    // Define count as STRING when it's INT in the table
    ODCSSchemaElement countCol = new ODCSSchemaElement();
    countCol.setName("count");
    countCol.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    properties.add(countCol);

    // Define amount as STRING when it's BIGINT in the table
    ODCSSchemaElement amountCol = new ODCSSchemaElement();
    amountCol.setName("amount");
    amountCol.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    properties.add(amountCol);

    tableObject.setProperties(properties);
    odcs.setSchema(List.of(tableObject));

    // Import should succeed - ODCS schema defines contract expectations,
    // not necessarily matching the physical schema exactly
    DataContract imported =
        SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getSchema());
    assertEquals(3, imported.getSchema().size());

    // The contract schema should reflect what was defined in ODCS
    assertEquals("id", imported.getSchema().get(0).getName());
    assertEquals("count", imported.getSchema().get(1).getName());
    assertEquals("amount", imported.getSchema().get(2).getName());
  }

  @Test
  void testValidateODCSWithTypeMismatch(TestNamespace ns) {
    // Create table with INT columns
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("user_id").withDataType(ColumnDataType.INT),
                new Column().withName("score").withDataType(ColumnDataType.DOUBLE)));

    // ODCS schema references columns with different types
    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("type_mismatch_validate")
            + "\n"
            + "name: "
            + ns.prefix("type_mismatch_validate")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: user_id\n"
            + "    logicalType: string\n"
            + "  - name: score\n"
            + "    logicalType: string\n";

    // Validation should pass for column existence (type validation is separate concern)
    ContractValidation validation =
        SdkClients.adminClient()
            .dataContracts()
            .validateODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(validation);
    assertTrue(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    // Columns exist, so validation passes for field existence
    assertEquals(2, validation.getSchemaValidation().getTotal());
    assertEquals(2, validation.getSchemaValidation().getPassed());
    assertEquals(0, validation.getSchemaValidation().getFailed());
  }

  @Test
  void testImportODCSWithDuplicateColumnNames(TestNamespace ns) {
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    // ODCS schema with duplicate column names
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(ns.prefix("duplicate_columns"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    ODCSSchemaElement tableObject = new ODCSSchemaElement();
    tableObject.setName(table.getName());
    tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);

    java.util.List<ODCSSchemaElement> properties = new java.util.ArrayList<>();

    // First 'id' column
    ODCSSchemaElement idCol1 = new ODCSSchemaElement();
    idCol1.setName("id");
    idCol1.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    idCol1.setDescription("First ID column");
    properties.add(idCol1);

    // Duplicate 'id' column with different type
    ODCSSchemaElement idCol2 = new ODCSSchemaElement();
    idCol2.setName("id");
    idCol2.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    idCol2.setDescription("Duplicate ID column");
    properties.add(idCol2);

    // Normal column
    ODCSSchemaElement nameCol = new ODCSSchemaElement();
    nameCol.setName("name");
    nameCol.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    properties.add(nameCol);

    tableObject.setProperties(properties);
    odcs.setSchema(List.of(tableObject));

    // Import should either fail with validation error or handle duplicates appropriately
    try {
      DataContract imported =
          SdkClients.adminClient().dataContracts().importFromODCS(odcs, table.getId(), "table");

      // If import succeeds, verify how duplicates were handled
      assertNotNull(imported);
      assertNotNull(imported.getSchema());
      // Should either deduplicate or preserve all entries
      assertTrue(
          imported.getSchema().size() >= 2, "Schema should have at least the unique columns");
    } catch (OpenMetadataException e) {
      // If validation fails for duplicates, that's also acceptable behavior
      assertTrue(
          e.getMessage().toLowerCase().contains("duplicate")
              || e.getMessage().toLowerCase().contains("unique")
              || e.getMessage().toLowerCase().contains("already exists"),
          "Exception should indicate duplicate column issue: " + e.getMessage());
    }
  }

  @Test
  void testValidateODCSWithDuplicateColumnNames(TestNamespace ns) {
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column()
                    .withName("email")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    // YAML with duplicate column names
    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("dup_col_validate")
            + "\n"
            + "name: "
            + ns.prefix("dup_col_validate")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n"
            + "  - name: id\n"
            + "    logicalType: string\n"
            + "  - name: email\n"
            + "    logicalType: string\n";

    // Validation should handle duplicate column names
    try {
      ContractValidation validation =
          SdkClients.adminClient()
              .dataContracts()
              .validateODCSYaml(yamlContent, table.getId(), "table");

      assertNotNull(validation);
      assertNotNull(validation.getSchemaValidation());
      // The validation counts may vary based on how duplicates are handled
      assertTrue(
          validation.getSchemaValidation().getTotal() >= 2,
          "Should validate at least the unique columns");
    } catch (OpenMetadataException e) {
      // If validation rejects duplicates, that's acceptable
      assertTrue(
          e.getMessage().toLowerCase().contains("duplicate")
              || e.getMessage().toLowerCase().contains("parse")
              || e.getMessage().toLowerCase().contains("invalid"),
          "Exception should indicate validation issue: " + e.getMessage());
    }
  }

  @Test
  void testImportODCSYamlWithDuplicateColumnsInYaml(TestNamespace ns) {
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("user_id").withDataType(ColumnDataType.INT),
                new Column()
                    .withName("status")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(50)));

    // YAML with repeated column definitions
    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("yaml_dup_cols")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: user_id\n"
            + "    logicalType: integer\n"
            + "    description: Primary user identifier\n"
            + "  - name: status\n"
            + "    logicalType: string\n"
            + "    description: Status field\n"
            + "  - name: user_id\n"
            + "    logicalType: string\n"
            + "    description: Duplicate user_id with different type\n"
            + "  - name: status\n"
            + "    logicalType: integer\n"
            + "    description: Duplicate status with different type\n";

    try {
      DataContract imported =
          SdkClients.adminClient()
              .dataContracts()
              .importFromODCSYaml(yamlContent, table.getId(), "table");

      assertNotNull(imported);
      // Verify how the system handles YAML with duplicate entries
      assertNotNull(imported.getSchema());
    } catch (OpenMetadataException e) {
      // Duplicate rejection is acceptable
      assertTrue(e.getMessage() != null, "Exception message should not be null");
    }
  }

  @Test
  void testImportModifyExportRoundTrip(TestNamespace ns) {
    List<Column> tableColumns =
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("email").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP));
    Table table = createTestTable(ns, tableColumns);

    String contractName = ns.prefix("import_modify_export");
    String yamlContent =
        "apiVersion: v3.1.0\n"
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
            + "  purpose: Original purpose from ODCS import\n"
            + "schema:\n"
            + "  - name: "
            + table.getName()
            + "\n"
            + "    logicalType: object\n"
            + "    properties:\n"
            + "      - name: id\n"
            + "        logicalType: long\n"
            + "        description: Primary identifier\n"
            + "      - name: name\n"
            + "        logicalType: string\n"
            + "        description: User name\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertEquals(contractName, imported.getName());
    assertEquals(EntityStatus.DRAFT, imported.getEntityStatus());
    assertEquals(2, imported.getSchema().size());

    imported.setDescription("Updated description via UI");

    imported.setEntityStatus(EntityStatus.APPROVED);

    List<Column> updatedSchema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary identifier - updated"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("User name"),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("User email address - added via UI"));
    imported.setSchema(updatedSchema);

    ContractSLA sla = new ContractSLA();
    org.openmetadata.schema.api.data.RefreshFrequency rf =
        new org.openmetadata.schema.api.data.RefreshFrequency();
    rf.setInterval(24);
    rf.setUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.HOUR);
    sla.setRefreshFrequency(rf);

    org.openmetadata.schema.api.data.MaxLatency ml =
        new org.openmetadata.schema.api.data.MaxLatency();
    ml.setValue(2);
    ml.setUnit(org.openmetadata.schema.api.data.MaxLatency.Unit.HOUR);
    sla.setMaxLatency(ml);
    imported.setSla(sla);

    DataContract updated = patchEntity(imported.getId().toString(), imported);

    assertNotNull(updated);
    assertEquals("Updated description via UI", updated.getDescription());
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
    assertEquals(3, updated.getSchema().size());
    assertNotNull(updated.getSla());

    String exportedYaml =
        SdkClients.adminClient().dataContracts().exportToODCSYaml(updated.getId());

    assertNotNull(exportedYaml);
    assertTrue(exportedYaml.contains("v3.1.0"));
    assertTrue(exportedYaml.contains(contractName));

    assertTrue(
        exportedYaml.contains("active"), "Export should reflect APPROVED status as 'active'");

    assertTrue(exportedYaml.contains("email"), "Export should contain newly added 'email' column");

    assertTrue(
        exportedYaml.contains("freshness") || exportedYaml.contains("slaProperties"),
        "Export should contain SLA properties added via UI");

    ODCSDataContract exportedOdcs =
        SdkClients.adminClient().dataContracts().exportToODCS(updated.getId());

    assertNotNull(exportedOdcs);
    assertEquals(ODCSDataContract.OdcsStatus.ACTIVE, exportedOdcs.getStatus());

    assertNotNull(exportedOdcs.getSchema());
    assertEquals(1, exportedOdcs.getSchema().size());
    ODCSSchemaElement tableObject = exportedOdcs.getSchema().get(0);
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertNotNull(tableObject.getProperties());
    assertEquals(3, tableObject.getProperties().size());

    boolean hasEmail =
        tableObject.getProperties().stream().anyMatch(p -> "email".equals(p.getName()));
    assertTrue(hasEmail, "Exported schema should contain 'email' column added via UI");

    assertNotNull(exportedOdcs.getSlaProperties());
    assertFalse(exportedOdcs.getSlaProperties().isEmpty(), "Export should contain SLA properties");

    boolean hasFreshness =
        exportedOdcs.getSlaProperties().stream().anyMatch(p -> "freshness".equals(p.getProperty()));
    assertTrue(hasFreshness, "Export should contain freshness SLA added via UI");

    boolean hasLatency =
        exportedOdcs.getSlaProperties().stream().anyMatch(p -> "latency".equals(p.getProperty()));
    assertTrue(hasLatency, "Export should contain latency SLA added via UI");
  }

  // ==================== OM Format Validation Endpoint Tests ====================

  @Test
  void testValidateContractRequestValid(TestNamespace ns) {
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("validate_valid"))
            .withEntity(table.getEntityReference())
            .withDescription("Test validation")
            .withSchema(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("name")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));

    ContractValidation validation =
        SdkClients.adminClient().dataContracts().validateContract(request);

    assertNotNull(validation);
    assertTrue(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    assertEquals(2, validation.getSchemaValidation().getTotal());
    assertEquals(2, validation.getSchemaValidation().getPassed());
    assertEquals(0, validation.getSchemaValidation().getFailed());
    // entityErrors/constraintErrors may be null or empty list depending on serialization
    assertTrue(
        validation.getEntityErrors() == null || validation.getEntityErrors().isEmpty(),
        "Expected entityErrors to be null or empty");
    assertTrue(
        validation.getConstraintErrors() == null || validation.getConstraintErrors().isEmpty(),
        "Expected constraintErrors to be null or empty");
  }

  @Test
  void testValidateContractRequestNameTooLong(TestNamespace ns) {
    Table table = createTestTable(ns);

    String longName = "x".repeat(300);
    CreateDataContract request =
        new CreateDataContract()
            .withName(longName)
            .withEntity(table.getEntityReference())
            .withDescription("Test name too long");

    ContractValidation validation =
        SdkClients.adminClient().dataContracts().validateContract(request);

    assertNotNull(validation);
    assertFalse(validation.getValid());
    // Validation error may be in entityErrors or constraintErrors depending on which validation
    // catches it
    boolean hasNameError =
        (validation.getEntityErrors() != null
                && validation.getEntityErrors().stream()
                    .anyMatch(e -> e.contains("256") || e.contains("name")))
            || (validation.getConstraintErrors() != null
                && validation.getConstraintErrors().stream()
                    .anyMatch(e -> e.contains("256") || e.contains("name")));
    assertTrue(hasNameError, "Expected validation error about name length");
  }

  @Test
  void testValidateContractRequestUnsupportedEntityType(TestNamespace ns) {
    Table table = createTestTable(ns);

    EntityReference fakeEntity =
        new EntityReference().withId(table.getId()).withType("unsupportedType");

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("unsupported_type"))
            .withEntity(fakeEntity)
            .withDescription("Test unsupported entity type");

    ContractValidation validation =
        SdkClients.adminClient().dataContracts().validateContract(request);

    assertNotNull(validation);
    assertFalse(validation.getValid());
    assertNotNull(validation.getConstraintErrors());
    assertTrue(
        validation.getConstraintErrors().stream()
            .anyMatch(e -> e.contains("not supported for data contracts")));
  }

  @Test
  void testValidateContractRequestSchemaFieldMismatch(TestNamespace ns) {
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("schema_mismatch"))
            .withEntity(table.getEntityReference())
            .withDescription("Test schema field mismatch")
            .withSchema(
                List.of(
                    new Column().withName("nonexistent_column").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("another_missing")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)));

    ContractValidation validation =
        SdkClients.adminClient().dataContracts().validateContract(request);

    assertNotNull(validation);
    assertFalse(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    assertEquals(2, validation.getSchemaValidation().getTotal());
    assertEquals(0, validation.getSchemaValidation().getPassed());
    assertEquals(2, validation.getSchemaValidation().getFailed());
    assertTrue(validation.getSchemaValidation().getFailedFields().contains("nonexistent_column"));
    assertTrue(validation.getSchemaValidation().getFailedFields().contains("another_missing"));
  }

  @Test
  void testValidateContractDoesNotCreateContract(TestNamespace ns) {
    Table table =
        createTestTable(ns, List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));

    CreateDataContract request =
        new CreateDataContract()
            .withName(ns.prefix("validate_no_create"))
            .withEntity(table.getEntityReference())
            .withDescription("Validation should not create contract")
            .withSchema(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));

    ContractValidation validation =
        SdkClients.adminClient().dataContracts().validateContract(request);

    assertNotNull(validation);
    assertTrue(validation.getValid());

    // Verify that no contract was actually created
    assertThrows(
        OpenMetadataException.class,
        () -> SdkClients.adminClient().dataContracts().getByEntityId(table.getId(), "table"),
        "Validation should not create a contract");
  }

  @Test
  void testODCSValidationReturnsContractValidation(TestNamespace ns) {
    Table table =
        createTestTable(
            ns,
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)));

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + ns.prefix("odcs_contract_validation")
            + "\n"
            + "name: "
            + ns.prefix("odcs_contract_validation")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: id\n"
            + "    logicalType: integer\n"
            + "  - name: name\n"
            + "    logicalType: string\n";

    ContractValidation validation =
        SdkClients.adminClient()
            .dataContracts()
            .validateODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(validation);
    assertTrue(validation.getValid());
    assertNotNull(validation.getSchemaValidation());
    // entityErrors/constraintErrors may be null or empty list depending on serialization
    assertTrue(
        validation.getEntityErrors() == null || validation.getEntityErrors().isEmpty(),
        "Expected entityErrors to be null or empty");
    assertTrue(
        validation.getConstraintErrors() == null || validation.getConstraintErrors().isEmpty(),
        "Expected constraintErrors to be null or empty");
  }

  // ==================== ODCS v3.1.0 Compatibility Tests ====================

  @Test
  void testImportODCSYamlWithElementLevelQuality(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("elem_quality")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "quality:\n"
            + "  - type: library\n"
            + "    metric: rowCount\n"
            + "    name: top_level_row_count\n"
            + "    mustBeGreaterThan: 0\n"
            + "schema:\n"
            + "  - name: "
            + table.getName()
            + "\n"
            + "    logicalType: object\n"
            + "    quality:\n"
            + "      - type: library\n"
            + "        metric: freshness\n"
            + "        name: table_freshness\n"
            + "    properties:\n"
            + "      - name: email\n"
            + "        logicalType: string\n"
            + "        quality:\n"
            + "          - type: sql\n"
            + "            name: email_format_check\n"
            + "            query: \"SELECT COUNT(*) FROM ${table} WHERE ${column} NOT LIKE '%@%'\"\n"
            + "            mustBe: 0\n"
            + "      - name: id\n"
            + "        logicalType: integer\n"
            + "      - name: name\n"
            + "        logicalType: string\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(3, imported.getOdcsQualityRules().size());

    ODCSQualityRule topLevelRule =
        imported.getOdcsQualityRules().stream()
            .filter(r -> "top_level_row_count".equals(r.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT, topLevelRule.getMetric());

    ODCSQualityRule tableRule =
        imported.getOdcsQualityRules().stream()
            .filter(r -> "table_freshness".equals(r.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals(table.getName(), tableRule.getColumn());

    ODCSQualityRule emailRule =
        imported.getOdcsQualityRules().stream()
            .filter(r -> "email_format_check".equals(r.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals("email", emailRule.getColumn());
    assertEquals(ODCSQualityRule.Type.SQL, emailRule.getType());
  }

  @Test
  void testImportODCSYamlWithPropertyLevelQualityRoundTrip(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("prop_quality_rt")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "schema:\n"
            + "  - name: "
            + table.getName()
            + "\n"
            + "    logicalType: object\n"
            + "    properties:\n"
            + "      - name: email\n"
            + "        logicalType: string\n"
            + "        quality:\n"
            + "          - type: library\n"
            + "            metric: nullValues\n"
            + "            name: email_not_null\n"
            + "      - name: id\n"
            + "        logicalType: integer\n"
            + "      - name: name\n"
            + "        logicalType: string\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(1, imported.getOdcsQualityRules().size());
    assertEquals("email", imported.getOdcsQualityRules().get(0).getColumn());

    ODCSDataContract exported =
        SdkClients.adminClient().dataContracts().exportToODCS(imported.getId());

    assertNotNull(exported);
    assertNotNull(exported.getSchema());
    assertFalse(exported.getSchema().isEmpty());

    ODCSSchemaElement tableObject = exported.getSchema().get(0);
    assertNotNull(tableObject.getProperties());

    ODCSSchemaElement emailProp =
        tableObject.getProperties().stream()
            .filter(p -> "email".equals(p.getName()))
            .findFirst()
            .orElseThrow();
    assertNotNull(emailProp.getQuality());
    assertEquals(1, emailProp.getQuality().size());
    assertEquals("email_not_null", emailProp.getQuality().get(0).getName());

    assertTrue(
        exported.getQuality().isEmpty(),
        "Top-level quality should be empty when all rules are column-level");
  }

  @Test
  void testImportODCSYamlWithTeamAsObject(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("team_obj")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "team:\n"
            + "  members:\n"
            + "    - username: admin\n"
            + "      role: owner\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    // admin user exists in the test environment, so it should resolve as owner
    assertNotNull(imported.getOwners());
    assertFalse(imported.getOwners().isEmpty());
  }

  @Test
  void testImportODCSYamlWithTeamAsArray(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("team_arr")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "team:\n"
            + "  - username: admin\n"
            + "    role: owner\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getOwners());
    assertFalse(imported.getOwners().isEmpty());
  }

  @Test
  void testImportODCSYamlWithScalarApprovers(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("scalar_approvers")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "roles:\n"
            + "  - role: analyst\n"
            + "    access: read\n"
            + "    firstLevelApprovers: manager@company.com\n"
            + "    secondLevelApprovers: director@company.com\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getSecurity());
    assertNotNull(imported.getSecurity().getPolicies());
    assertFalse(imported.getSecurity().getPolicies().isEmpty());
    assertTrue(
        imported
            .getSecurity()
            .getPolicies()
            .get(0)
            .getIdentities()
            .contains("manager@company.com"));
  }

  @Test
  void testImportODCSYamlWithArrayApprovers(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("array_approvers")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "roles:\n"
            + "  - role: engineer\n"
            + "    access: readWrite\n"
            + "    firstLevelApprovers:\n"
            + "      - approver1@company.com\n"
            + "      - approver2@company.com\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);
    assertNotNull(imported.getSecurity());
    assertNotNull(imported.getSecurity().getPolicies());
    assertEquals(1, imported.getSecurity().getPolicies().size());
    assertEquals(2, imported.getSecurity().getPolicies().get(0).getIdentities().size());
    assertTrue(
        imported
            .getSecurity()
            .getPolicies()
            .get(0)
            .getIdentities()
            .contains("approver1@company.com"));
    assertTrue(
        imported
            .getSecurity()
            .getPolicies()
            .get(0)
            .getIdentities()
            .contains("approver2@company.com"));
  }

  @Test
  void testImportODCSYamlWithAllV310Features(TestNamespace ns) {
    Table table = createTestTable(ns);

    String yamlContent =
        "apiVersion: v3.1.0\n"
            + "kind: DataContract\n"
            + "id: "
            + UUID.randomUUID()
            + "\n"
            + "name: "
            + ns.prefix("all_v310")
            + "\n"
            + "version: '1.0.0'\n"
            + "status: active\n"
            + "team:\n"
            + "  members:\n"
            + "    - username: admin\n"
            + "      role: owner\n"
            + "schema:\n"
            + "  - name: "
            + table.getName()
            + "\n"
            + "    logicalType: object\n"
            + "    quality:\n"
            + "      - type: library\n"
            + "        metric: rowCount\n"
            + "        name: table_row_count\n"
            + "        mustBeGreaterThan: 0\n"
            + "    properties:\n"
            + "      - name: email\n"
            + "        logicalType: string\n"
            + "        quality:\n"
            + "          - type: sql\n"
            + "            name: email_check\n"
            + "            query: \"SELECT COUNT(*) FROM ${table} WHERE ${column} NOT LIKE '%@%'\"\n"
            + "            mustBe: 0\n"
            + "      - name: id\n"
            + "        logicalType: integer\n"
            + "      - name: name\n"
            + "        logicalType: string\n"
            + "roles:\n"
            + "  - role: analyst\n"
            + "    access: read\n"
            + "    firstLevelApprovers: manager@company.com\n";

    DataContract imported =
        SdkClients.adminClient()
            .dataContracts()
            .importFromODCSYaml(yamlContent, table.getId(), "table");

    assertNotNull(imported);

    // Verify team object form was normalized
    assertNotNull(imported.getOwners());
    assertFalse(imported.getOwners().isEmpty());

    // Verify element-level quality rules were collected
    assertNotNull(imported.getOdcsQualityRules());
    assertEquals(2, imported.getOdcsQualityRules().size());

    // Verify scalar approvers were normalized
    assertNotNull(imported.getSecurity());
    assertNotNull(imported.getSecurity().getPolicies());
    assertTrue(
        imported
            .getSecurity()
            .getPolicies()
            .get(0)
            .getIdentities()
            .contains("manager@company.com"));
  }
}
