/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.data;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.resources.EntityResourceTest.TEAM11_REF;
import static org.openmetadata.service.resources.EntityResourceTest.USER1_REF;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.dqtests.TestCaseResourceTest;
import org.openmetadata.service.resources.dqtests.TestSuiteResourceTest;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@Execution(ExecutionMode.CONCURRENT)
public class DataContractResourceTest extends OpenMetadataApplicationTest {
  private static final String C1 = "id";
  private static final String C2 = "name";
  private static final String C3 = "description";
  private static final String EMAIL_COL = "email";

  private static final AtomicLong tableCounter = new AtomicLong(0);

  private final List<DataContract> createdContracts = new ArrayList<>();
  private final List<Table> createdTables = new ArrayList<>();

  private static String testDatabaseSchemaFQN = null;

  private static TestCaseResourceTest testCaseResourceTest;
  private static IngestionPipelineResourceTest ingestionPipelineResourceTest;
  private static DataContractRepository dataContractRepository;
  private static PipelineServiceClientInterface originalPipelineClient;
  private static PipelineServiceClientInterface mockPipelineClient;

  @BeforeAll
  public static void setup(TestInfo test) throws URISyntaxException, IOException {
    testCaseResourceTest = new TestCaseResourceTest();
    // testCaseResourceTest.setup(test);
    ingestionPipelineResourceTest = new IngestionPipelineResourceTest();
    ingestionPipelineResourceTest.setup(test);

    // Set up mock PipelineServiceClient for all tests
    dataContractRepository =
        (DataContractRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.DATA_CONTRACT);

    // Store original client for potential restoration (if needed)
    originalPipelineClient = dataContractRepository.getPipelineServiceClient();

    // Create and set mock PipelineServiceClient
    mockPipelineClient = mock(PipelineServiceClientInterface.class);
    dataContractRepository.setPipelineServiceClient(mockPipelineClient);
  }

  @AfterEach
  void cleanup() {
    for (DataContract contract : createdContracts) {
      try {
        deleteDataContract(contract.getId());
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
    createdContracts.clear();

    for (Table table : createdTables) {
      try {
        deleteTable(table.getId());
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
    createdTables.clear();
  }

  /**
   * Creates and ensures database schema for table creation
   */
  private synchronized String ensureDatabaseSchema() throws IOException {
    if (testDatabaseSchemaFQN == null) {
      // Create our own database service, database, and schema for data contract tests
      long uniqueId = System.nanoTime();

      // Create database service using the same pattern as other tests
      CreateDatabaseService createService =
          new CreateDatabaseService()
              .withName("test-dc-service-" + uniqueId)
              .withServiceType(DatabaseServiceType.Mysql)
              .withConnection(
                  new DatabaseConnection()
                      .withConfig(
                          new MysqlConnection()
                              .withHostPort("localhost:3306")
                              .withUsername("test")));

      WebTarget serviceTarget =
          APP.client()
              .target(
                  String.format(
                      "http://localhost:%s/api/v1/services/databaseServices", APP.getLocalPort()));
      Response serviceResponse =
          SecurityUtil.addHeaders(serviceTarget, ADMIN_AUTH_HEADERS)
              .post(Entity.json(createService));
      DatabaseService service =
          TestUtils.readResponse(
              serviceResponse, DatabaseService.class, Status.CREATED.getStatusCode());

      // Create database
      CreateDatabase createDatabase =
          new CreateDatabase()
              .withName("test-dc-db-" + uniqueId)
              .withService(service.getFullyQualifiedName());

      WebTarget dbTarget =
          APP.client()
              .target(String.format("http://localhost:%s/api/v1/databases", APP.getLocalPort()));
      Response dbResponse =
          SecurityUtil.addHeaders(dbTarget, ADMIN_AUTH_HEADERS).post(Entity.json(createDatabase));
      Database database =
          TestUtils.readResponse(dbResponse, Database.class, Status.CREATED.getStatusCode());

      // Create database schema
      CreateDatabaseSchema createSchema =
          new CreateDatabaseSchema()
              .withName("test-dc-schema-" + uniqueId)
              .withDatabase(database.getFullyQualifiedName());

      WebTarget schemaTarget =
          APP.client()
              .target(
                  String.format("http://localhost:%s/api/v1/databaseSchemas", APP.getLocalPort()));
      Response schemaResponse =
          SecurityUtil.addHeaders(schemaTarget, ADMIN_AUTH_HEADERS).post(Entity.json(createSchema));
      DatabaseSchema schema =
          TestUtils.readResponse(
              schemaResponse, DatabaseSchema.class, Status.CREATED.getStatusCode());

      testDatabaseSchemaFQN = schema.getFullyQualifiedName();
    }
    return testDatabaseSchemaFQN;
  }

  /**
   * Creates a unique table for testing data contracts using direct API calls
   */
  private Table createUniqueTable(String testName) throws IOException {
    // Ensure we have a database schema to work with
    String schemaFQN = ensureDatabaseSchema();

    // Use multiple entropy sources for absolute uniqueness
    long counter = tableCounter.incrementAndGet();
    long timestamp = System.nanoTime();
    String uniqueId = UUID.randomUUID().toString().replace("-", "");
    long threadId = Thread.currentThread().threadId();

    String tableName =
        "dc_test_"
            + testName
            + "_"
            + counter
            + "_"
            + timestamp
            + "_"
            + threadId
            + "_"
            + uniqueId.substring(0, 8);

    // Create table using the ensured database schema
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDatabaseSchema(schemaFQN)
            .withColumns(
                List.of(
                    new org.openmetadata.schema.type.Column()
                        .withName(C1)
                        .withDisplayName("ID")
                        .withDataType(org.openmetadata.schema.type.ColumnDataType.INT),
                    new org.openmetadata.schema.type.Column()
                        .withName(C2)
                        .withDisplayName("Name")
                        .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING),
                    new org.openmetadata.schema.type.Column()
                        .withName(C3)
                        .withDisplayName("Description")
                        .withDataType(org.openmetadata.schema.type.ColumnDataType.TEXT),
                    new org.openmetadata.schema.type.Column()
                        .withName(EMAIL_COL)
                        .withDisplayName("Email")
                        .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING)))
            .withTableConstraints(List.of());

    WebTarget target = APP.client().target(getTableUri());
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(createTable));
    Table createdTable =
        TestUtils.readResponse(response, Table.class, Status.CREATED.getStatusCode());
    createdTables.add(createdTable);
    return createdTable;
  }

  /**
   * Creates a unique data contract request for testing with Table
   */
  public CreateDataContract createDataContractRequest(String name, Table table) {
    String uniqueSuffix =
        UUID.randomUUID().toString().replace("-", "")
            + "_"
            + System.nanoTime()
            + "_"
            + Thread.currentThread().threadId()
            + "_"
            + tableCounter.incrementAndGet();
    String contractName = "contract_" + name + "_" + uniqueSuffix;

    return new CreateDataContract()
        .withName(contractName)
        .withEntity(table.getEntityReference())
        .withStatus(ContractStatus.Draft);
  }

  public DataContract createDataContract(CreateDataContract create) throws IOException {
    WebTarget target = getCollection();
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(create));
    DataContract dataContract =
        TestUtils.readResponse(response, DataContract.class, Status.CREATED.getStatusCode());
    createdContracts.add(dataContract);
    return dataContract;
  }

  private DataContract getDataContract(UUID id, String fields) throws HttpResponseException {
    WebTarget target = getResource(id);
    if (fields != null) {
      target = target.queryParam("fields", fields);
    }
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
  }

  private DataContract getDataContractByName(String name, String fields)
      throws HttpResponseException {
    WebTarget target = getResourceByName(name);
    if (fields != null) {
      target = target.queryParam("fields", fields);
    }
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
  }

  private DataContract getDataContractByEntityId(UUID entityId, String entityType)
      throws HttpResponseException {
    return getDataContractByEntityId(entityId, entityType, null);
  }

  private DataContract getDataContractByEntityId(UUID entityId, String entityType, String fields)
      throws HttpResponseException {
    WebTarget target =
        getCollection()
            .path("/entity")
            .queryParam("entityId", entityId)
            .queryParam("entityType", entityType);
    if (fields != null && !fields.isEmpty()) {
      target = target.queryParam("fields", fields);
    }
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
  }

  private DataContract updateDataContract(CreateDataContract create) throws IOException {
    WebTarget target = getCollection();
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).put(Entity.json(create));
    return TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
  }

  private DataContract patchDataContract(UUID id, String originalJson, DataContract updated)
      throws IOException {
    try {
      ObjectMapper mapper = new ObjectMapper();
      String updatedJson = JsonUtils.pojoToJson(updated);
      com.fasterxml.jackson.databind.JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

      WebTarget target = getResource(id);
      return TestUtils.patch(target, patch, DataContract.class, ADMIN_AUTH_HEADERS);
    } catch (Exception e) {
      throw new IOException("Failed to create patch", e);
    }
  }

  private void deleteDataContract(UUID id) throws IOException {
    WebTarget target = getResource(id);
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).delete();
    TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
  }

  private void deleteDataContract(UUID id, boolean recursive) throws IOException {
    WebTarget target = getResource(id);
    target = target.queryParam("recursive", recursive);
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).delete();
    TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
  }

  private void deleteTable(UUID id) {
    WebTarget tableTarget = APP.client().target(getTableUri() + "/" + id);
    Response response = SecurityUtil.addHeaders(tableTarget, ADMIN_AUTH_HEADERS).delete();
    response.readEntity(String.class); // Consume response
  }

  private DataContract createDataContractWithAuth(
      CreateDataContract create, Map<String, String> authHeaders) throws IOException {
    WebTarget target = getCollection();
    Response response = SecurityUtil.addHeaders(target, authHeaders).post(Entity.json(create));
    DataContract dataContract =
        TestUtils.readResponse(response, DataContract.class, Status.CREATED.getStatusCode());
    createdContracts.add(dataContract);
    return dataContract;
  }

  private WebTarget getCollection() {
    return APP.client().target(getDataContractUri());
  }

  private WebTarget getResource(UUID id) {
    return getCollection().path("/" + id);
  }

  private WebTarget getResourceByName(String name) {
    return getCollection().path("/name/" + name);
  }

  private String getDataContractUri() {
    return String.format("http://localhost:%s/api/v1/dataContracts", APP.getLocalPort());
  }

  private String getTableUri() {
    return String.format("http://localhost:%s/api/v1/tables", APP.getLocalPort());
  }

  private DataContractResult getLatestResult(DataContract dataContract)
      throws HttpResponseException {
    WebTarget latestTarget = getResource(dataContract.getId()).path("/results/latest");
    Response latestResponse = SecurityUtil.addHeaders(latestTarget, ADMIN_AUTH_HEADERS).get();
    return TestUtils.readResponse(
        latestResponse, DataContractResult.class, Status.OK.getStatusCode());
  }

  private DataContractResult runValidate(DataContract dataContract) throws HttpResponseException {
    WebTarget validateTarget = getResource(dataContract.getId()).path("/validate");
    Response validateResponse =
        SecurityUtil.addHeaders(validateTarget, ADMIN_AUTH_HEADERS).post(null);
    return TestUtils.readResponse(
        validateResponse, DataContractResult.class, Status.OK.getStatusCode());
  }

  private Response getResultById(UUID dataContractId, UUID resultId) {
    WebTarget resultTarget = getResource(dataContractId).path("/results").path(resultId.toString());
    return SecurityUtil.addHeaders(resultTarget, ADMIN_AUTH_HEADERS).get();
  }

  // ===================== CRUD Tests =====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    DataContract dataContract = createDataContract(create);

    assertNotNull(dataContract);
    assertNotNull(dataContract.getId());
    assertEquals(create.getName(), dataContract.getName());
    assertEquals(create.getStatus(), dataContract.getStatus());
    assertEquals(table.getId(), dataContract.getEntity().getId());
    assertEquals("table", dataContract.getEntity().getType());

    // Verify FQN follows expected pattern
    String expectedFQN = table.getFullyQualifiedName() + ".dataContract_" + create.getName();
    assertEquals(expectedFQN, dataContract.getFullyQualifiedName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testGetDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    DataContract retrieved = getDataContract(created.getId(), null);

    assertEquals(created.getId(), retrieved.getId());
    assertEquals(created.getName(), retrieved.getName());
    assertEquals(created.getFullyQualifiedName(), retrieved.getFullyQualifiedName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testGetDataContractByEntityId(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    DataContract retrieved =
        getDataContractByEntityId(table.getId(), org.openmetadata.service.Entity.TABLE);

    assertEquals(created.getId(), retrieved.getId());
    assertEquals(created.getName(), retrieved.getName());
    assertEquals(created.getFullyQualifiedName(), retrieved.getFullyQualifiedName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUpdateDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Update to Active status
    create.withStatus(ContractStatus.Active);
    DataContract updated = updateDataContract(create);

    assertEquals(ContractStatus.Active, updated.getStatus());
    assertEquals(created.getId(), updated.getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUpdateDataContractWithSemanticsAndQualityExpectations(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Create initial semantics rules
    List<SemanticsRule> initialSemantics =
        List.of(
            new SemanticsRule()
                .withName("ID Field Exists")
                .withDescription("Checks that the ID field exists")
                .withRule("{\"!!\": {\"var\": \"id\"}}"));

    // Create test cases for quality expectations
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateTestCase createTestCase1 =
        testCaseResourceTest
            .createRequest("test_case_completeness_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase1 =
        testCaseResourceTest.createAndCheckEntity(createTestCase1, ADMIN_AUTH_HEADERS);

    List<EntityReference> initialQualityExpectations = List.of(testCase1.getEntityReference());

    // Update with semantics and quality expectations
    create
        .withStatus(ContractStatus.Active)
        .withSemantics(initialSemantics)
        .withQualityExpectations(initialQualityExpectations);

    DataContract updated = updateDataContract(create);

    // Verify all updates
    assertEquals(ContractStatus.Active, updated.getStatus());
    assertEquals(created.getId(), updated.getId());
    assertNotNull(updated.getSemantics());
    assertEquals(1, updated.getSemantics().size());
    assertEquals("ID Field Exists", updated.getSemantics().get(0).getName());
    assertNotNull(updated.getQualityExpectations());
    assertEquals(1, updated.getQualityExpectations().size());
    assertEquals(testCase1.getId(), updated.getQualityExpectations().get(0).getId());
    assertNotNull(updated.getTestSuite());

    // GET the data contract and verify all fields are persisted correctly after first update
    DataContract retrievedAfterFirstUpdate =
        getDataContract(created.getId(), "semantics,qualityExpectations,testSuite,status,owners");
    assertEquals(ContractStatus.Active, retrievedAfterFirstUpdate.getStatus());
    assertEquals(created.getId(), retrievedAfterFirstUpdate.getId());
    assertNotNull(retrievedAfterFirstUpdate.getSemantics());
    assertEquals(1, retrievedAfterFirstUpdate.getSemantics().size());
    assertEquals("ID Field Exists", retrievedAfterFirstUpdate.getSemantics().get(0).getName());
    assertEquals(
        "Checks that the ID field exists",
        retrievedAfterFirstUpdate.getSemantics().get(0).getDescription());
    assertEquals(
        "{\"!!\": {\"var\": \"id\"}}", retrievedAfterFirstUpdate.getSemantics().get(0).getRule());
    assertNotNull(retrievedAfterFirstUpdate.getQualityExpectations());
    assertEquals(1, retrievedAfterFirstUpdate.getQualityExpectations().size());
    assertEquals(
        testCase1.getId(), retrievedAfterFirstUpdate.getQualityExpectations().get(0).getId());
    assertNotNull(retrievedAfterFirstUpdate.getTestSuite());

    // Now update with additional semantics and quality expectations
    List<SemanticsRule> updatedSemantics =
        List.of(
            new SemanticsRule()
                .withName("ID Field Exists")
                .withDescription("Checks that the ID field exists")
                .withRule("{\"!!\": {\"var\": \"id\"}}"),
            new SemanticsRule()
                .withName("Name Field Exists")
                .withDescription("Checks that the name field exists")
                .withRule("{\"!!\": {\"var\": \"name\"}}"));

    CreateTestCase createTestCase2 =
        testCaseResourceTest
            .createRequest("test_case_validity_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase2 =
        testCaseResourceTest.createAndCheckEntity(createTestCase2, ADMIN_AUTH_HEADERS);

    List<EntityReference> updatedQualityExpectations =
        List.of(testCase1.getEntityReference(), testCase2.getEntityReference());

    create.withSemantics(updatedSemantics).withQualityExpectations(updatedQualityExpectations);

    DataContract finalUpdated = updateDataContract(create);

    // Verify final updates
    assertEquals(ContractStatus.Active, finalUpdated.getStatus());
    assertEquals(created.getId(), finalUpdated.getId());
    assertNotNull(finalUpdated.getSemantics());
    assertEquals(2, finalUpdated.getSemantics().size());
    assertNotNull(finalUpdated.getQualityExpectations());
    assertEquals(2, finalUpdated.getQualityExpectations().size());
    assertNotNull(finalUpdated.getTestSuite());

    // GET the data contract and verify all fields are persisted correctly after final update
    DataContract retrievedAfterFinalUpdate =
        getDataContract(created.getId(), "semantics,qualityExpectations,testSuite,status,owners");
    assertEquals(ContractStatus.Active, retrievedAfterFinalUpdate.getStatus());
    assertEquals(created.getId(), retrievedAfterFinalUpdate.getId());
    assertNotNull(retrievedAfterFinalUpdate.getSemantics());
    assertEquals(2, retrievedAfterFinalUpdate.getSemantics().size());
    assertEquals("ID Field Exists", retrievedAfterFinalUpdate.getSemantics().get(0).getName());
    assertEquals(
        "Checks that the ID field exists",
        retrievedAfterFinalUpdate.getSemantics().get(0).getDescription());
    assertEquals(
        "{\"!!\": {\"var\": \"id\"}}", retrievedAfterFinalUpdate.getSemantics().get(0).getRule());
    assertEquals("Name Field Exists", retrievedAfterFinalUpdate.getSemantics().get(1).getName());
    assertEquals(
        "Checks that the name field exists",
        retrievedAfterFinalUpdate.getSemantics().get(1).getDescription());
    assertEquals(
        "{\"!!\": {\"var\": \"name\"}}", retrievedAfterFinalUpdate.getSemantics().get(1).getRule());
    assertNotNull(retrievedAfterFinalUpdate.getQualityExpectations());
    assertEquals(2, retrievedAfterFinalUpdate.getQualityExpectations().size());
    assertEquals(
        testCase1.getId(), retrievedAfterFinalUpdate.getQualityExpectations().get(0).getId());
    assertEquals(
        testCase2.getId(), retrievedAfterFinalUpdate.getQualityExpectations().get(1).getId());
    assertNotNull(retrievedAfterFinalUpdate.getTestSuite());

    // Now update with schema changes (add and remove columns)
    List<org.openmetadata.schema.type.Column> initialSchema =
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDisplayName("ID")
                .withDescription("Primary key"),
            new org.openmetadata.schema.type.Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDisplayName("Name")
                .withDescription("Entity name"));

    create.withSchema(initialSchema);
    DataContract schemaUpdated = updateDataContract(create);

    // Verify schema was added
    assertNotNull(schemaUpdated.getSchema());
    assertEquals(2, schemaUpdated.getSchema().size());
    assertEquals("id", schemaUpdated.getSchema().get(0).getName());
    assertEquals("name", schemaUpdated.getSchema().get(1).getName());

    // GET the data contract and verify schema is persisted
    DataContract retrievedWithSchema =
        getDataContract(created.getId(), "schema,semantics,qualityExpectations,testSuite,status");
    assertNotNull(retrievedWithSchema.getSchema());
    assertEquals(2, retrievedWithSchema.getSchema().size());
    assertEquals("id", retrievedWithSchema.getSchema().get(0).getName());
    assertEquals(ColumnDataType.BIGINT, retrievedWithSchema.getSchema().get(0).getDataType());
    assertEquals("name", retrievedWithSchema.getSchema().get(1).getName());
    assertEquals(ColumnDataType.VARCHAR, retrievedWithSchema.getSchema().get(1).getDataType());

    // Now update schema: remove 'name' column and add 'email' column
    List<org.openmetadata.schema.type.Column> updatedSchema =
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDisplayName("ID")
                .withDescription("Primary key"),
            new org.openmetadata.schema.type.Column()
                .withName("email")
                .withDataType(ColumnDataType.VARCHAR)
                .withDisplayName("Email")
                .withDescription("User email address"));

    create.withSchema(updatedSchema);
    DataContract finalSchemaUpdated = updateDataContract(create);

    // Verify schema changes
    assertNotNull(finalSchemaUpdated.getSchema());
    assertEquals(2, finalSchemaUpdated.getSchema().size());
    assertEquals("id", finalSchemaUpdated.getSchema().get(0).getName());
    assertEquals("email", finalSchemaUpdated.getSchema().get(1).getName());

    // GET the final data contract and verify all schema changes are persisted
    DataContract finalRetrieved =
        getDataContract(created.getId(), "schema,semantics,qualityExpectations,testSuite,status");
    assertNotNull(finalRetrieved.getSchema());
    assertEquals(2, finalRetrieved.getSchema().size());
    assertEquals("id", finalRetrieved.getSchema().get(0).getName());
    assertEquals(ColumnDataType.BIGINT, finalRetrieved.getSchema().get(0).getDataType());
    assertEquals("Primary key", finalRetrieved.getSchema().get(0).getDescription());
    assertEquals("email", finalRetrieved.getSchema().get(1).getName());
    assertEquals(ColumnDataType.VARCHAR, finalRetrieved.getSchema().get(1).getDataType());
    assertEquals("User email address", finalRetrieved.getSchema().get(1).getDescription());

    // Verify the other fields are still intact after schema changes
    assertEquals(ContractStatus.Active, finalRetrieved.getStatus());
    assertNotNull(finalRetrieved.getSemantics());
    assertEquals(2, finalRetrieved.getSemantics().size());
    assertNotNull(finalRetrieved.getQualityExpectations());
    assertEquals(2, finalRetrieved.getQualityExpectations().size());
    assertNotNull(finalRetrieved.getTestSuite());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateAndGetDataContractWithOwners(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create owners list with both user and team
    List<EntityReference> owners = new ArrayList<>();
    owners.add(USER1_REF);
    owners.add(TEAM11_REF);

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withOwners(owners);

    DataContract created = createDataContract(create);

    // Verify owners were set during creation
    assertNotNull(created.getOwners());
    assertEquals(2, created.getOwners().size());

    // Get the data contract by ID and verify owners are returned properly
    DataContract retrieved = getDataContract(created.getId(), "owners");

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
    assertNotNull(retrieved.getOwners());
    assertEquals(2, retrieved.getOwners().size());

    // Verify the owners contain the expected references
    List<UUID> ownerIds = retrieved.getOwners().stream().map(EntityReference::getId).toList();
    assertTrue(ownerIds.contains(USER1_REF.getId()));
    assertTrue(ownerIds.contains(TEAM11_REF.getId()));

    // Verify owner types are preserved
    Map<String, String> ownerTypeMap =
        retrieved.getOwners().stream()
            .collect(Collectors.toMap(owner -> owner.getId().toString(), EntityReference::getType));
    assertEquals(
        org.openmetadata.service.Entity.USER, ownerTypeMap.get(USER1_REF.getId().toString()));
    assertEquals(
        org.openmetadata.service.Entity.TEAM, ownerTypeMap.get(TEAM11_REF.getId().toString()));

    // Also test getting by name
    DataContract retrievedByName =
        getDataContractByName(retrieved.getFullyQualifiedName(), "owners");

    assertNotNull(retrievedByName);
    assertEquals(retrieved.getId(), retrievedByName.getId());
    assertNotNull(retrievedByName.getOwners());
    assertEquals(2, retrievedByName.getOwners().size());

    // Verify owners are the same when retrieved by name
    List<UUID> ownerIdsByName =
        retrievedByName.getOwners().stream().map(EntityReference::getId).toList();
    assertTrue(ownerIdsByName.contains(USER1_REF.getId()));
    assertTrue(ownerIdsByName.contains(TEAM11_REF.getId()));

    // Also test getting by entity ID with fields parameter
    DataContract retrievedByEntityId =
        getDataContractByEntityId(table.getId(), org.openmetadata.service.Entity.TABLE, "owners");

    assertNotNull(retrievedByEntityId);
    assertEquals(retrieved.getId(), retrievedByEntityId.getId());
    assertNotNull(retrievedByEntityId.getOwners());
    assertEquals(2, retrievedByEntityId.getOwners().size());

    // Verify owners are the same when retrieved by entity ID
    List<UUID> ownerIdsByEntityId =
        retrievedByEntityId.getOwners().stream().map(EntityReference::getId).toList();
    assertTrue(ownerIdsByEntityId.contains(USER1_REF.getId()));
    assertTrue(ownerIdsByEntityId.contains(TEAM11_REF.getId()));

    // Verify owner types are preserved when retrieved by entity ID
    Map<String, String> ownerTypeMapByEntityId =
        retrievedByEntityId.getOwners().stream()
            .collect(Collectors.toMap(owner -> owner.getId().toString(), EntityReference::getType));
    assertEquals(
        org.openmetadata.service.Entity.USER,
        ownerTypeMapByEntityId.get(USER1_REF.getId().toString()));
    assertEquals(
        org.openmetadata.service.Entity.TEAM,
        ownerTypeMapByEntityId.get(TEAM11_REF.getId().toString()));

    // Test that getting by entity ID without fields parameter returns contract without owners
    DataContract retrievedByEntityIdNoFields =
        getDataContractByEntityId(table.getId(), org.openmetadata.service.Entity.TABLE);

    assertNotNull(retrievedByEntityIdNoFields);
    assertEquals(retrieved.getId(), retrievedByEntityIdNoFields.getId());
    // Owners should be null or empty when fields parameter is not specified
    assertTrue(
        retrievedByEntityIdNoFields.getOwners() == null
            || retrievedByEntityIdNoFields.getOwners().isEmpty());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateContractWithSemantics(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    List<SemanticsRule> semanticsRules =
        new ArrayList<>(
            List.of(
                new SemanticsRule()
                    .withName("Description can't be empty")
                    .withDescription("Ensures description is provided")
                    .withRule("{ \"!!\": { \"var\": \"description\" } }")));

    // Add semantics to the contract
    create
        .withDescription("This is a test data contract with semantics")
        .withSemantics(semanticsRules);

    DataContract dataContract = createDataContract(create);

    assertNotNull(dataContract);
    assertEquals("This is a test data contract with semantics", dataContract.getDescription());
    assertEquals(1, dataContract.getSemantics().size());

    String originalJson = JsonUtils.pojoToJson(dataContract);
    semanticsRules.add(
        new SemanticsRule()
            .withName("Single Owner")
            .withDescription("I only support 1 owner")
            .withRule("{\"==\":[{\"size\":{\"var\":\"items\"}},1]}"));

    dataContract.setSemantics(semanticsRules);
    DataContract patched = patchDataContract(dataContract.getId(), originalJson, dataContract);
    assertNotNull(patched.getSemantics());
    assertEquals(2, patched.getSemantics().size());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractStatus(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    String originalJson = JsonUtils.pojoToJson(created);
    created.setStatus(ContractStatus.Active);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertEquals(ContractStatus.Active, patched.getStatus());
    assertEquals(created.getId(), patched.getId());

    // Verify that GET returns the correct status after PATCH
    DataContract retrieved = getDataContract(patched.getId(), "");
    assertEquals(ContractStatus.Active, retrieved.getStatus());
    assertEquals(created.getId(), retrieved.getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractWithoutStatus(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withStatus(null);
    DataContract created = createDataContract(create);
    assertNull(created.getStatus());

    String originalJson = JsonUtils.pojoToJson(created);
    created.setStatus(ContractStatus.Active);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertEquals(ContractStatus.Active, patched.getStatus());
    assertEquals(created.getId(), patched.getId());

    // Verify that GET returns the correct status after PATCH
    DataContract retrieved = getDataContract(patched.getId(), "");
    assertEquals(ContractStatus.Active, retrieved.getStatus());
    assertEquals(created.getId(), retrieved.getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractSchema(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    String originalJson = JsonUtils.pojoToJson(created);

    // Add schema fields via patch
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName(C1)
            .withDescription("Updated ID field")
            .withDataType(ColumnDataType.INT));
    columns.add(
        new Column()
            .withName(C2)
            .withDescription("Updated name field")
            .withDataType(ColumnDataType.STRING));
    created.setSchema(columns);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertNotNull(patched.getSchema());
    assertEquals(2, patched.getSchema().size());
    assertEquals("Updated ID field", patched.getSchema().get(0).getDescription());
    assertEquals("Updated name field", patched.getSchema().get(1).getDescription());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractQualityExpectations(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    String originalJson = JsonUtils.pojoToJson(created);

    // Create test cases first for quality expectations
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateTestCase createTestCase1 =
        testCaseResourceTest
            .createRequest("test_case_data_integrity_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase1 =
        testCaseResourceTest.createAndCheckEntity(createTestCase1, ADMIN_AUTH_HEADERS);

    CreateTestCase createTestCase2 =
        testCaseResourceTest
            .createRequest("test_case_completeness_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase2 =
        testCaseResourceTest.createAndCheckEntity(createTestCase2, ADMIN_AUTH_HEADERS);

    // Add quality expectations as EntityReferences to TestCases
    List<EntityReference> qualityExpectations = new ArrayList<>();
    qualityExpectations.add(testCase1.getEntityReference());
    qualityExpectations.add(testCase2.getEntityReference());
    created.setQualityExpectations(qualityExpectations);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertNotNull(patched.getQualityExpectations());
    assertEquals(2, patched.getQualityExpectations().size());
    assertEquals(testCase1.getId(), patched.getQualityExpectations().get(0).getId());
    assertEquals(testCase2.getId(), patched.getQualityExpectations().get(1).getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractMultipleFields(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    String originalJson = JsonUtils.pojoToJson(created);

    // Patch multiple fields at once: status, description, and schema
    created.setStatus(ContractStatus.Active);
    created.setDescription("Updated contract description via patch");

    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName(C1)
            .withDescription("Patched ID field")
            .withDataType(ColumnDataType.INT));
    created.setSchema(columns);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertEquals(ContractStatus.Active, patched.getStatus());
    assertEquals("Updated contract description via patch", patched.getDescription());
    assertNotNull(patched.getSchema());
    assertEquals(1, patched.getSchema().size());
    assertEquals("Patched ID field", patched.getSchema().getFirst().getDescription());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDeleteDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    deleteDataContract(created.getId());

    // Verify deletion
    assertThrows(HttpResponseException.class, () -> getDataContract(created.getId(), null));
  }

  // ===================== Business Logic Tests =====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithSchema(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Add schema fields that match the table's columns
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName(C1)
            .withDescription("Unique identifier")
            .withDataType(ColumnDataType.INT));
    columns.add(
        new Column()
            .withName(C2)
            .withDescription("Name field")
            .withDataType(ColumnDataType.STRING));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSchema(columns);

    DataContract dataContract = createDataContract(create);

    assertNotNull(dataContract.getSchema());
    assertEquals(2, dataContract.getSchema().size());
    assertEquals(C1, dataContract.getSchema().get(0).getName());
    assertEquals(C2, dataContract.getSchema().get(1).getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithQualityExpectations(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create test case first for quality expectations
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_completeness_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    List<EntityReference> qualityExpectations = new ArrayList<>();
    qualityExpectations.add(testCase.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withQualityExpectations(qualityExpectations);

    DataContract dataContract = createDataContract(create);

    assertNotNull(dataContract.getQualityExpectations());
    assertEquals(1, dataContract.getQualityExpectations().size());
    assertEquals(testCase.getId(), dataContract.getQualityExpectations().getFirst().getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithInvalidFields(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create schema with field that doesn't exist in the table
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("non_existent_field")
            .withDescription("This field doesn't exist")
            .withDataType(ColumnDataType.STRING));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSchema(columns);

    // Should throw error for non-existent field
    assertResponseContains(
        () -> createDataContract(create),
        Status.BAD_REQUEST,
        "Schema validation failed. The following fields specified in the data contract do not exist in the table: non_existent_field");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testEnforceUniqueDataContractPerEntity(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create first data contract
    CreateDataContract create1 = createDataContractRequest(test.getDisplayName(), table);
    createDataContract(create1);

    // Try to create another data contract for the same table entity
    CreateDataContract create2 =
        createDataContractRequest(test.getDisplayName() + "_duplicate", table);

    // Should enforce uniqueness - one contract per entity
    assertResponse(
        () -> createDataContract(create2),
        Status.BAD_REQUEST,
        String.format(
            "A data contract already exists for entity 'table' with ID %s", table.getId()));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithInvalidEntity(TestInfo test) {
    UUID invalidId = UUID.randomUUID();
    EntityReference invalidRef = new EntityReference().withId(invalidId).withType("table");

    String uniqueSuffix =
        UUID.randomUUID().toString().replace("-", "")
            + "_"
            + System.nanoTime()
            + "_"
            + Thread.currentThread().threadId()
            + "_"
            + tableCounter.incrementAndGet();
    String contractName = "contract_" + test.getDisplayName() + "_" + uniqueSuffix;

    CreateDataContract create =
        new CreateDataContract()
            .withName(contractName)
            .withEntity(invalidRef)
            .withStatus(ContractStatus.Draft);

    assertResponseContains(
        () -> createDataContract(create),
        Status.NOT_FOUND,
        "table instance for " + invalidId.toString() + " not found");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractStatusTransitions(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create Draft data contract
    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withStatus(ContractStatus.Draft);
    DataContract dataContract = createDataContract(create);
    assertEquals(ContractStatus.Draft, dataContract.getStatus());

    // Update to Active status
    create.withStatus(ContractStatus.Active);
    dataContract = updateDataContract(create);
    assertEquals(ContractStatus.Active, dataContract.getStatus());

    // Update to Deprecated status
    create.withStatus(ContractStatus.Deprecated);
    dataContract = updateDataContract(create);
    assertEquals(ContractStatus.Deprecated, dataContract.getStatus());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractYAMLAPI(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create test case first for quality expectations
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_email_format_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    String yamlContent =
        String.format(
            "name: %s\n"
                + "entity:\n"
                + "  id: %s\n"
                + "  type: table\n"
                + "status: Active\n"
                + "schema:\n"
                + "  - name: %s\n"
                + "    description: ID field with validation\n"
                + "    dataType: INT\n"
                + "  - name: %s\n"
                + "    description: Email field with format constraints\n"
                + "    dataType: STRING\n"
                + "qualityExpectations:\n"
                + "  - id: %s\n"
                + "    type: testCase",
            "contract_" + test.getDisplayName(), table.getId(), C1, EMAIL_COL, testCase.getId());

    DataContract dataContract = postYaml(yamlContent);

    assertNotNull(dataContract);
    assertEquals(ContractStatus.Active, dataContract.getStatus());
    assertEquals(2, dataContract.getSchema().size());
    assertEquals(1, dataContract.getQualityExpectations().size());
    assertEquals(testCase.getId(), dataContract.getQualityExpectations().getFirst().getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithInvalidYAML(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    String invalidYamlContent =
        String.format(
            "name: %s\n"
                + "entity:\n"
                + "  id: %s\n"
                + "  type: table\n"
                + "status: Active\n"
                + "schema:\n"
                + "  - name: %s\n"
                + "    description: ID field with validation\n"
                + "   badField: \"this is invalid yaml with wrong indentation\n"
                + "qualityExpectations:\n"
                + "  - name: ValueCheck\n"
                + "    description: Value must be numeric\n"
                + "    definition: Value must be a number",
            "contract_" + test.getDisplayName(), table.getId(), C1);

    assertResponseContains(
        () -> postYaml(invalidYamlContent), Status.BAD_REQUEST, "Invalid YAML content");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithNullEntityReference(TestInfo test) {
    String uniqueSuffix =
        UUID.randomUUID().toString().replace("-", "")
            + "_"
            + System.nanoTime()
            + "_"
            + Thread.currentThread().getId()
            + "_"
            + tableCounter.incrementAndGet();
    String contractName = "contract_" + test.getDisplayName() + "_" + uniqueSuffix;

    CreateDataContract create =
        new CreateDataContract()
            .withName(contractName)
            .withEntity(null) // Null entity reference
            .withStatus(ContractStatus.Draft);

    // Bean validation will catch this as "entity must not be null"
    assertResponseContains(
        () -> createDataContract(create), Status.BAD_REQUEST, "entity must not be null");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithMultipleInvalidFields(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create schema with multiple fields that don't exist in the table
    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName("invalid_field_1")
            .withDescription("First invalid field")
            .withDataType(ColumnDataType.STRING));
    columns.add(
        new Column()
            .withName("invalid_field_2")
            .withDescription("Second invalid field")
            .withDataType(ColumnDataType.INT));
    columns.add(
        new Column()
            .withName(C1) // This one is valid
            .withDescription("Valid field")
            .withDataType(ColumnDataType.INT));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSchema(columns);

    // Should fail with both invalid fields listed
    assertResponseContains(
        () -> createDataContract(create),
        Status.BAD_REQUEST,
        "Schema validation failed. The following fields specified in the data contract do not exist in the table: invalid_field_1, invalid_field_2");
  }

  /**
   * Post YAML content directly to create a data contract
   */
  private DataContract postYaml(String yamlData) throws IOException {
    WebTarget target = getCollection();
    Entity<String> entity = Entity.entity(yamlData, "application/yaml");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(entity);
    DataContract dataContract =
        TestUtils.readResponse(response, DataContract.class, Status.CREATED.getStatusCode());
    createdContracts.add(dataContract);
    return dataContract;
  }

  // ===================== Permission Tests =====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testTableOwnerCanCreateDataContract(TestInfo test) throws IOException {
    // Create a table owned by admin (who has Create permissions)
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    // Admin should be able to create data contract for their table
    DataContract dataContract = createDataContractWithAuth(create, ADMIN_AUTH_HEADERS);

    assertNotNull(dataContract);
    assertEquals(create.getName(), dataContract.getName());
    assertEquals(table.getId(), dataContract.getEntity().getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testRegularUserCannotCreateDataContractForOthersTable(TestInfo test) throws IOException {
    // Create a table owned by admin
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    // Regular user should not be able to create data contract for admin's table
    assertResponse(
        () -> createDataContractWithAuth(create, TEST_AUTH_HEADERS),
        Status.FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} operations [Create] not allowed");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUserWithCreateDataContractPermissionCanCreate(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    // Admin users have all permissions and should be able to create data contracts
    DataContract dataContract = createDataContractWithAuth(create, ADMIN_AUTH_HEADERS);
    assertNotNull(dataContract);
    assertEquals(create.getName(), dataContract.getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testTableOwnerCanUpdateTheirDataContract(TestInfo test) throws IOException {
    // Create a table and data contract as admin
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    createDataContract(create);

    // Update as admin should work
    create.withStatus(ContractStatus.Active);
    WebTarget target = getCollection();
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).put(Entity.json(create));
    DataContract updated =
        TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());

    assertEquals(ContractStatus.Active, updated.getStatus());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testRegularUserCannotUpdateOthersDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    createDataContract(create);

    // Regular user should not be able to update admin's data contract
    create.withStatus(ContractStatus.Active);
    WebTarget target = getCollection();

    assertResponse(
        () -> {
          Response response =
              SecurityUtil.addHeaders(target, TEST_AUTH_HEADERS).put(Entity.json(create));
          TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
        },
        Status.FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} operations [EditAll] not allowed");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testTableOwnerCanPatchTheirDataContract(TestInfo test) throws IOException {
    // Create a table and data contract as admin
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Patch as admin should work
    String originalJson = JsonUtils.pojoToJson(created);
    created.setStatus(ContractStatus.Active);

    try {
      ObjectMapper mapper = new ObjectMapper();
      String updatedJson = JsonUtils.pojoToJson(created);
      com.fasterxml.jackson.databind.JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

      WebTarget target = getResource(created.getId());
      DataContract patched = TestUtils.patch(target, patch, DataContract.class, ADMIN_AUTH_HEADERS);

      assertEquals(ContractStatus.Active, patched.getStatus());
    } catch (Exception e) {
      throw new IOException("Failed to patch data contract", e);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testRegularUserCannotPatchOthersDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Regular user should not be able to patch admin's data contract
    String originalJson = JsonUtils.pojoToJson(created);
    created.setStatus(ContractStatus.Active);

    try {
      ObjectMapper mapper = new ObjectMapper();
      String updatedJson = JsonUtils.pojoToJson(created);
      com.fasterxml.jackson.databind.JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

      WebTarget target = getResource(created.getId());

      assertResponse(
          () -> TestUtils.patch(target, patch, DataContract.class, TEST_AUTH_HEADERS),
          Status.FORBIDDEN,
          "Principal: CatalogPrincipal{name='test'} operations [EditAll] not allowed");
    } catch (Exception e) {
      throw new IOException("Failed to create patch", e);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testTableOwnerCanDeleteTheirDataContract(TestInfo test) throws IOException {
    // Create a table and data contract as admin
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Delete as admin should work
    WebTarget target = getResource(created.getId());
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).delete();
    TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());

    // Verify deletion
    assertThrows(HttpResponseException.class, () -> getDataContract(created.getId(), null));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testRegularUserCannotDeleteOthersDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Regular user should not be able to delete admin's data contract
    WebTarget target = getResource(created.getId());

    assertResponse(
        () -> {
          Response response = SecurityUtil.addHeaders(target, TEST_AUTH_HEADERS).delete();
          TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());
        },
        Status.FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} operations [Delete] not allowed");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testAllUsersCanReadDataContracts(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Regular users should be able to read data contracts (assuming default read permissions)
    WebTarget target = getResource(created.getId());
    Response response = SecurityUtil.addHeaders(target, TEST_AUTH_HEADERS).get();
    DataContract retrieved =
        TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());

    assertEquals(created.getId(), retrieved.getId());
    assertEquals(created.getName(), retrieved.getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUserWithoutPermissionsCannotCreateDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    // User without any permissions should not be able to create data contracts
    assertResponse(
        () -> createDataContractWithAuth(create, TEST_AUTH_HEADERS),
        Status.FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} operations [Create] not allowed");
  }

  // ===================== Reviewers Tests =====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithReviewers(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Get admin user entity reference
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    WebTarget userTarget = getResource("users").path("name").path("admin");
    Response response = SecurityUtil.addHeaders(userTarget, authHeaders).get();
    User adminUser = TestUtils.readResponse(response, User.class, Status.OK.getStatusCode());

    // Create user references for reviewers using the full entity reference
    List<EntityReference> reviewers = new ArrayList<>();
    reviewers.add(adminUser.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withReviewers(reviewers);

    DataContract dataContract = createDataContract(create);

    // Get with reviewers field to verify they were set
    DataContract retrieved = getDataContract(dataContract.getId(), "owners,reviewers");

    assertNotNull(retrieved.getReviewers());
    assertEquals(1, retrieved.getReviewers().size());
    assertEquals("admin", retrieved.getReviewers().getFirst().getName());
    assertEquals("user", retrieved.getReviewers().getFirst().getType());
    assertNotNull(retrieved.getReviewers().getFirst().getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractAddReviewers(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Get admin user entity reference
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    WebTarget userTarget = getResource("users").path("name").path("admin");
    Response response = SecurityUtil.addHeaders(userTarget, authHeaders).get();
    User adminUser = TestUtils.readResponse(response, User.class, Status.OK.getStatusCode());

    // Get the full data contract with all fields
    created = getDataContract(created.getId(), "reviewers");
    String originalJson = JsonUtils.pojoToJson(created);

    // Add reviewers via patch
    List<EntityReference> reviewers = new ArrayList<>();
    reviewers.add(adminUser.getEntityReference());
    created.setReviewers(reviewers);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertNotNull(patched.getReviewers());
    assertEquals(1, patched.getReviewers().size());
    assertEquals("admin", patched.getReviewers().get(0).getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractRemoveReviewers(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Get admin user entity reference
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    WebTarget userTarget = getResource("users").path("name").path("admin");
    Response response = SecurityUtil.addHeaders(userTarget, authHeaders).get();
    User adminUser = TestUtils.readResponse(response, User.class, Status.OK.getStatusCode());

    // Create with reviewers
    List<EntityReference> initialReviewers = new ArrayList<>();
    initialReviewers.add(adminUser.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withReviewers(initialReviewers);
    DataContract created = createDataContract(create);

    // Get full data contract with reviewers
    created = getDataContract(created.getId(), "owners,reviewers");
    assertNotNull(created.getReviewers());
    assertEquals(1, created.getReviewers().size());

    String originalJson = JsonUtils.pojoToJson(created);

    // Remove reviewers via patch
    created.setReviewers(new ArrayList<>());

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertNotNull(patched.getReviewers());
    assertEquals(0, patched.getReviewers().size());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractUpdateReviewers(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Get user entity references
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    WebTarget userTarget = getResource("users").path("name").path("admin");
    Response response = SecurityUtil.addHeaders(userTarget, authHeaders).get();
    User adminUser = TestUtils.readResponse(response, User.class, Status.OK.getStatusCode());

    userTarget = getResource("users").path("name").path("test");
    response = SecurityUtil.addHeaders(userTarget, authHeaders).get();
    User testUser = TestUtils.readResponse(response, User.class, Status.OK.getStatusCode());

    // Create with one reviewer
    List<EntityReference> initialReviewers = new ArrayList<>();
    initialReviewers.add(adminUser.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withReviewers(initialReviewers);
    DataContract created = createDataContract(create);

    // Get full data contract
    created = getDataContract(created.getId(), "reviewers");
    String originalJson = JsonUtils.pojoToJson(created);

    // Update to different reviewers (test user)
    List<EntityReference> newReviewers = new ArrayList<>();
    newReviewers.add(testUser.getEntityReference());
    created.setReviewers(newReviewers);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertNotNull(patched.getReviewers());
    assertEquals(1, patched.getReviewers().size());
    assertEquals("test", patched.getReviewers().get(0).getName());
  }

  // ===================== Data Contract Results Tests =====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateOrUpdateDataContractResult(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract dataContract = createDataContract(create);

    // no result yet
    assertNull(dataContract.getLatestResult());

    // Create a contract result
    DataContractResult createResult =
        new DataContractResult()
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withTimestamp(System.currentTimeMillis())
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withResult("Triggering...")
            .withExecutionTime(1234L);

    WebTarget resultsTarget = getResource(dataContract.getId()).path("/results");
    Response response =
        SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(createResult));
    DataContractResult result =
        TestUtils.readResponse(response, DataContractResult.class, Status.OK.getStatusCode());

    assertNotNull(result);
    assertNotNull(result.getId());
    assertEquals(dataContract.getFullyQualifiedName(), result.getDataContractFQN());
    assertEquals(ContractExecutionStatus.Running, result.getContractExecutionStatus());
    assertEquals("Triggering...", result.getResult());
    assertEquals(1234L, result.getExecutionTime());

    // Get latest result
    DataContractResult latest = getLatestResult(dataContract);

    assertNotNull(latest);
    assertEquals(result.getId(), latest.getId());

    latest
        .withContractExecutionStatus(ContractExecutionStatus.Success)
        .withResult("Success result")
        .withExecutionTime(2000L);

    // Update the same result
    SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(latest));
    // Check the result was properly updated in the db
    WebTarget getResultTarget =
        getResource(dataContract.getId()).path("/results").path(result.getId().toString());
    Response getResponse = SecurityUtil.addHeaders(getResultTarget, ADMIN_AUTH_HEADERS).get();
    DataContractResult updatedResult =
        TestUtils.readResponse(getResponse, DataContractResult.class, Status.OK.getStatusCode());

    assertNotNull(updatedResult);
    assertEquals(dataContract.getFullyQualifiedName(), updatedResult.getDataContractFQN());
    assertEquals(ContractExecutionStatus.Success, updatedResult.getContractExecutionStatus());
    assertEquals("Success result", updatedResult.getResult());
    assertEquals(2000L, updatedResult.getExecutionTime());

    // Ensure the latestResult is updated properly in the DataContract
    DataContract updatedContract = getDataContract(dataContract.getId(), "");
    assertNotNull(updatedContract.getLatestResult());
    assertEquals(updatedResult.getId(), updatedContract.getLatestResult().getResultId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testListDataContractResults(TestInfo test) throws Exception {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract dataContract = createDataContract(create);

    // Create multiple contract results with different dates and ids
    String dateStr = "2024-01-";
    for (int i = 1; i <= 5; i++) {
      DataContractResult createResult =
          new DataContractResult()
              .withDataContractFQN(dataContract.getFullyQualifiedName())
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + String.format("%02d", i)))
              .withContractExecutionStatus(
                  i % 2 == 0 ? ContractExecutionStatus.Success : ContractExecutionStatus.Failed)
              .withResult("Result " + i)
              .withExecutionTime(1000L + i);

      WebTarget resultsTarget = getResource(dataContract.getId()).path("/results");
      Response response =
          SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(createResult));
      assertEquals(Status.OK.getStatusCode(), response.getStatus());
      response.readEntity(String.class); // Consume response
    }

    // List results
    WebTarget listTarget = getResource(dataContract.getId()).path("/results");
    Response listResponse = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();
    String jsonResponse =
        TestUtils.readResponse(listResponse, String.class, Status.OK.getStatusCode());
    ResultList<DataContractResult> results =
        JsonUtils.readValue(
            jsonResponse,
            new com.fasterxml.jackson.core.type.TypeReference<ResultList<DataContractResult>>() {});

    assertNotNull(results);
    assertEquals(5, results.getData().size());

    // Verify results are in descending order by timestamp (newest first)
    for (int i = 0; i < results.getData().size() - 1; i++) {
      assertTrue(
          results.getData().get(i).getTimestamp() >= results.getData().get(i + 1).getTimestamp());
    }

    // Verify the newest result is from January 5th
    assertEquals("Result 5", results.getData().get(0).getResult());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testGetLatestDataContractResult(TestInfo test) throws Exception {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract dataContract = createDataContract(create);

    // Create multiple results with different dates
    String[] dates = {"2024-01-01", "2024-01-02", "2024-01-03"};
    for (int i = 0; i < dates.length; i++) {
      DataContractResult createResult =
          new DataContractResult()
              .withDataContractFQN(dataContract.getFullyQualifiedName())
              .withTimestamp(TestUtils.dateToTimestamp(dates[i]))
              .withContractExecutionStatus(ContractExecutionStatus.Success)
              .withResult("Result " + i)
              .withExecutionTime(1000L);

      WebTarget resultsTarget = getResource(dataContract.getId()).path("/results");
      Response response =
          SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(createResult));
      assertEquals(Status.OK.getStatusCode(), response.getStatus());
      response.readEntity(String.class); // Consume response
    }

    // Get latest result
    DataContractResult latest = getLatestResult(dataContract);

    assertNotNull(latest);
    assertEquals("Result 2", latest.getResult()); // Latest is from January 3rd (index 2)
    assertEquals(TestUtils.dateToTimestamp("2024-01-03"), latest.getTimestamp());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDeleteDataContractResults(TestInfo test) throws Exception {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract dataContract = createDataContract(create);

    // Create a result with a specific date
    long timestamp = TestUtils.dateToTimestamp("2024-01-15");
    DataContractResult createResult =
        new DataContractResult()
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withTimestamp(timestamp)
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("Test result")
            .withExecutionTime(1000L);

    WebTarget resultsTarget = getResource(dataContract.getId()).path("/results");
    Response createResponse =
        SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(createResult));
    assertEquals(Status.OK.getStatusCode(), createResponse.getStatus());
    createResponse.readEntity(String.class); // Consume response

    // Verify result exists
    WebTarget listTarget = getResource(dataContract.getId()).path("/results");
    Response listResponse = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();
    String jsonResponse =
        TestUtils.readResponse(listResponse, String.class, Status.OK.getStatusCode());
    ResultList<DataContractResult> results =
        JsonUtils.readValue(
            jsonResponse,
            new com.fasterxml.jackson.core.type.TypeReference<ResultList<DataContractResult>>() {});
    assertEquals(1, results.getData().size());

    // Delete the result
    WebTarget deleteTarget = getResource(dataContract.getId()).path("/results/" + timestamp);
    Response deleteResponse = SecurityUtil.addHeaders(deleteTarget, ADMIN_AUTH_HEADERS).delete();
    assertEquals(Status.OK.getStatusCode(), deleteResponse.getStatus());

    // Verify result is deleted
    Response listResponse2 = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();
    String jsonResponse2 =
        TestUtils.readResponse(listResponse2, String.class, Status.OK.getStatusCode());
    ResultList<DataContractResult> results2 =
        JsonUtils.readValue(
            jsonResponse2,
            new com.fasterxml.jackson.core.type.TypeReference<ResultList<DataContractResult>>() {});
    assertEquals(0, results2.getData().size());
  }

  // ===================== Test Suite Creation Tests =====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateDataContractWithoutQualityExpectations_NoTestSuiteCreated(TestInfo test)
      throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    // Create data contract without quality expectations
    DataContract dataContract = createDataContract(create);

    // Verify the contract was created
    assertNotNull(dataContract);
    assertEquals(create.getName(), dataContract.getName());

    // Verify no test suite was created for this data contract
    String expectedTestSuiteName = dataContract.getName() + " - Data Contract Expectations";

    // Try to get test suite - it should not exist
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    assertThrows(
        HttpResponseException.class,
        () ->
            testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateDataContractWithQualityExpectations_TestSuiteCreated(TestInfo test)
      throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create real test case first
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    List<EntityReference> qualityExpectations = List.of(testCase.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withQualityExpectations(qualityExpectations);

    // Create data contract with quality expectations
    DataContract dataContract = createDataContract(create);

    // Verify the contract was created with quality expectations
    assertNotNull(dataContract);
    assertNotNull(dataContract.getQualityExpectations());
    assertEquals(1, dataContract.getQualityExpectations().size());

    // Verify test suite was created using TestSuiteResourceTest
    String expectedTestSuiteName = dataContract.getName() + " - Data Contract Expectations";
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite testSuite =
        testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS);

    assertNotNull(testSuite);
    assertEquals(expectedTestSuiteName, testSuite.getName());
    assertEquals(
        "Logical test suite for Data Contract: " + dataContract.getName(),
        testSuite.getDescription());
    assertNotNull(testSuite.getTests());
    assertEquals(1, testSuite.getTests().size());
    assertEquals(testCase.getId(), testSuite.getTests().get(0).getId());
    assertEquals(testSuite.getDataContract().getId(), dataContract.getId());

    // Verify the Data Contract has the pointer to the test suite
    assertNotNull(dataContract.getTestSuite());
    assertEquals(testSuite.getId(), dataContract.getTestSuite().getId());

    // Verify ingestion pipeline was created for the test suite
    IngestionPipeline pipeline =
        ingestionPipelineResourceTest.getEntity(
            testSuite.getPipelines().get(0).getId(), "*", ADMIN_AUTH_HEADERS);

    assertNotNull(pipeline);
    assertEquals(PipelineType.TEST_SUITE, pipeline.getPipelineType());
    assertEquals(testSuite.getId(), pipeline.getService().getId());
    assertEquals("testSuite", pipeline.getService().getType());

    // Test deletion with recursive=true - should also delete the test suite
    deleteDataContract(dataContract.getId(), true);

    // Verify the data contract is deleted
    assertThrows(HttpResponseException.class, () -> getDataContract(dataContract.getId(), null));

    // Verify the test suite is also deleted
    assertThrows(
        HttpResponseException.class,
        () ->
            testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUpdateDataContractQualityExpectations_TestSuiteUpdated(TestInfo test)
      throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create first real test case
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateTestCase createTestCase1 =
        testCaseResourceTest
            .createRequest("test_case_1_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase1 =
        testCaseResourceTest.createAndCheckEntity(createTestCase1, ADMIN_AUTH_HEADERS);

    List<EntityReference> initialExpectations = List.of(testCase1.getEntityReference());

    // Create data contract with initial quality expectations
    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withQualityExpectations(initialExpectations);
    DataContract dataContract = createDataContract(create);

    // Verify initial test suite was created with 1 test
    String expectedTestSuiteName = dataContract.getName() + " - Data Contract Expectations";
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite initialTestSuite =
        testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS);
    assertEquals(1, initialTestSuite.getTests().size());

    // Create second real test case
    CreateTestCase createTestCase2 =
        testCaseResourceTest
            .createRequest("test_case_2_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase2 =
        testCaseResourceTest.createAndCheckEntity(createTestCase2, ADMIN_AUTH_HEADERS);

    // Update quality expectations with additional test case
    List<EntityReference> updatedExpectations =
        List.of(testCase1.getEntityReference(), testCase2.getEntityReference());

    // Update the data contract with new quality expectations
    String originalJson = JsonUtils.pojoToJson(dataContract);
    dataContract.setQualityExpectations(updatedExpectations);
    DataContract updatedContract =
        patchDataContract(dataContract.getId(), originalJson, dataContract);

    // Verify the contract was updated
    assertEquals(2, updatedContract.getQualityExpectations().size());

    // Verify test suite was updated with new test cases
    TestSuite updatedTestSuite =
        testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTestSuite.getTests());
    assertEquals(2, updatedTestSuite.getTests().size());

    // Verify both test cases are in the test suite
    List<UUID> testCaseIds =
        updatedTestSuite.getTests().stream().map(EntityReference::getId).toList();
    assertTrue(testCaseIds.contains(testCase1.getId()));
    assertTrue(testCaseIds.contains(testCase2.getId()));

    // Verify ingestion pipeline still exists and is properly configured
    IngestionPipeline updatedPipeline =
        ingestionPipelineResourceTest.getEntity(
            updatedTestSuite.getPipelines().get(0).getId(), "*", ADMIN_AUTH_HEADERS);

    assertNotNull(updatedPipeline);
    assertEquals(expectedTestSuiteName, updatedPipeline.getName());
    assertEquals(PipelineType.TEST_SUITE, updatedPipeline.getPipelineType());
    assertEquals(updatedTestSuite.getId(), updatedPipeline.getService().getId());
    assertEquals("testSuite", updatedPipeline.getService().getType());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testValidateDataContractWithFailingSemantics(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create semantics rules that will fail - checking for a field that doesn't exist
    List<SemanticsRule> failingSemantics =
        List.of(
            new SemanticsRule()
                .withName("Required Field Check")
                .withDescription("Checks for presence of a description")
                .withRule("{\"!!\": {\"var\": \"description\"}}"));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSemantics(failingSemantics);

    // Create data contract with failing semantics
    DataContract dataContract = createDataContract(create);

    // Verify the contract was created
    assertNotNull(dataContract);
    assertNotNull(dataContract.getSemantics());
    assertEquals(1, dataContract.getSemantics().size());

    // Call the validate endpoint
    DataContractResult result = runValidate(dataContract);

    // Verify the validation result shows failure
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());
    assertTrue(result.getResult().contains("Semantics validation failed"));

    // Verify semantics validation details
    assertNotNull(result.getSemanticsValidation());
    assertEquals(0, result.getSemanticsValidation().getPassed().intValue());
    assertEquals(1, result.getSemanticsValidation().getFailed().intValue());
    assertEquals(1, result.getSemanticsValidation().getTotal().intValue());
    assertNotNull(result.getSemanticsValidation().getFailedRules());
    assertEquals(1, result.getSemanticsValidation().getFailedRules().size());
    assertEquals(
        "Required Field Check",
        result.getSemanticsValidation().getFailedRules().get(0).getRuleName());

    // Verify the DataContract latestResult reflects the failed validation
    DataContract updatedContract = getDataContract(dataContract.getId(), "");
    DataContractResult latest = getLatestResult(dataContract);
    assertNotNull(updatedContract.getLatestResult());
    assertEquals(ContractExecutionStatus.Failed, updatedContract.getLatestResult().getStatus());
    assertTrue(
        updatedContract.getLatestResult().getMessage().contains("Semantics validation failed"));
    assertEquals(
        result.getId().toString(), updatedContract.getLatestResult().getResultId().toString());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testValidateDataContractWithPassingSemantics(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create semantics rules that will pass - checking for fields that exist in the table
    List<SemanticsRule> passingSemantics =
        List.of(
            new SemanticsRule()
                .withName("ID Field Exists")
                .withDescription("Checks that the ID field exists")
                .withRule("{\"!!\": {\"var\": \"id\"}}"),
            new SemanticsRule()
                .withName("Name Field Exists")
                .withDescription("Checks that the name field exists")
                .withRule("{\"!!\": {\"var\": \"name\"}}"));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSemantics(passingSemantics);

    // Create data contract with passing semantics
    DataContract dataContract = createDataContract(create);

    // Verify the contract was created
    assertNotNull(dataContract);
    assertNotNull(dataContract.getSemantics());
    assertEquals(2, dataContract.getSemantics().size());

    // Call the validate endpoint
    DataContractResult result = runValidate(dataContract);

    // Verify the validation result shows success
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());

    // Verify semantics validation details
    assertNotNull(result.getSemanticsValidation());
    assertEquals(2, result.getSemanticsValidation().getPassed().intValue());
    assertEquals(0, result.getSemanticsValidation().getFailed().intValue());
    assertEquals(2, result.getSemanticsValidation().getTotal().intValue());
    assertTrue(
        result.getSemanticsValidation().getFailedRules() == null
            || result.getSemanticsValidation().getFailedRules().isEmpty());

    // Verify the DataContract latestResult reflects the successful validation
    DataContract updatedContract = getDataContract(dataContract.getId(), "");
    assertNotNull(updatedContract.getLatestResult());
    assertEquals(ContractExecutionStatus.Success, updatedContract.getLatestResult().getStatus());
    assertEquals(
        result.getId().toString(), updatedContract.getLatestResult().getResultId().toString());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testLatestResultOnlyUpdatedForNewerResults(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract dataContract = createDataContract(create);

    // Initially no latest result
    assertNull(dataContract.getLatestResult());

    // Create first result with timestamp T1
    long timestamp1 = System.currentTimeMillis();
    DataContractResult createResult1 =
        new DataContractResult()
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withTimestamp(timestamp1)
            .withContractExecutionStatus(ContractExecutionStatus.Success)
            .withResult("First result")
            .withExecutionTime(1000L);

    WebTarget resultsTarget = getResource(dataContract.getId()).path("/results");
    Response response1 =
        SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(createResult1));
    DataContractResult result1 =
        TestUtils.readResponse(response1, DataContractResult.class, Status.OK.getStatusCode());

    // Verify first result becomes latestResult
    DataContract contractAfterFirst = getDataContract(dataContract.getId(), "");
    assertNotNull(contractAfterFirst.getLatestResult());
    assertEquals(timestamp1, contractAfterFirst.getLatestResult().getTimestamp().longValue());
    assertEquals("First result", contractAfterFirst.getLatestResult().getMessage());
    assertEquals(result1.getId(), contractAfterFirst.getLatestResult().getResultId());

    // Create second result with OLDER timestamp T2 < T1 (should NOT update latestResult)
    long timestamp2 = timestamp1 - 10000; // 10 seconds earlier
    DataContractResult createResult2 =
        new DataContractResult()
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withTimestamp(timestamp2)
            .withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withResult("Older result")
            .withExecutionTime(2000L);

    Response response2 =
        SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(createResult2));
    DataContractResult result2 =
        TestUtils.readResponse(response2, DataContractResult.class, Status.CREATED.getStatusCode());

    // Verify latestResult is NOT updated (should still be first result)
    DataContract contractAfterSecond = getDataContract(dataContract.getId(), "");
    assertNotNull(contractAfterSecond.getLatestResult());
    assertEquals(
        timestamp1,
        contractAfterSecond.getLatestResult().getTimestamp().longValue()); // Still first timestamp
    assertEquals(
        "First result", contractAfterSecond.getLatestResult().getMessage()); // Still first message
    assertEquals(
        result1.getId(),
        contractAfterSecond.getLatestResult().getResultId()); // Still first result ID

    // Create third result with NEWER timestamp T3 > T1 (should update latestResult)
    long timestamp3 = timestamp1 + 10000; // 10 seconds later
    DataContractResult createResult3 =
        new DataContractResult()
            .withDataContractFQN(dataContract.getFullyQualifiedName())
            .withTimestamp(timestamp3)
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withResult("Newest result")
            .withExecutionTime(3000L);

    Response response3 =
        SecurityUtil.addHeaders(resultsTarget, ADMIN_AUTH_HEADERS).put(Entity.json(createResult3));
    DataContractResult result3 =
        TestUtils.readResponse(response3, DataContractResult.class, Status.OK.getStatusCode());

    // Verify latestResult IS updated to the newest result
    DataContract contractAfterThird = getDataContract(dataContract.getId(), "");
    assertNotNull(contractAfterThird.getLatestResult());
    assertEquals(
        timestamp3,
        contractAfterThird.getLatestResult().getTimestamp().longValue()); // Now third timestamp
    assertEquals(
        "Newest result", contractAfterThird.getLatestResult().getMessage()); // Now third message
    assertEquals(
        result3.getId(), contractAfterThird.getLatestResult().getResultId()); // Now third result ID
  }

  @Test
  void testGetDataContractResultByIdWithNoResults(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract dataContract = createDataContract(create);

    // Verify the contract has no results initially
    assertNull(dataContract.getLatestResult());

    // Try to get a result by ID when no results exist
    UUID randomResultId = UUID.randomUUID();
    Response response = getResultById(dataContract.getId(), randomResultId);

    // Expecting BadRequestException (400) when trying to get result from contract with no results
    assertEquals(
        Status.BAD_REQUEST.getStatusCode(),
        response.getStatus(),
        "Expected 400 Bad Request when getting result from contract with no results");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testValidateDataContractWithPassingSemanticsAndDQExpectations(TestInfo test)
      throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create passing semantics rules - checking for fields that exist in the table
    List<SemanticsRule> passingSemantics =
        List.of(
            new SemanticsRule()
                .withName("ID Field Exists")
                .withDescription("Checks that the ID field exists")
                .withRule("{\"!!\": {\"var\": \"id\"}}"),
            new SemanticsRule()
                .withName("Name Field Exists")
                .withDescription("Checks that the name field exists")
                .withRule("{\"!!\": {\"var\": \"name\"}}"));

    // Create test cases for quality expectations
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateTestCase createTestCase1 =
        testCaseResourceTest
            .createRequest("test_case_completeness_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase1 =
        testCaseResourceTest.createAndCheckEntity(createTestCase1, ADMIN_AUTH_HEADERS);

    CreateTestCase createTestCase2 =
        testCaseResourceTest
            .createRequest("test_case_validity_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase2 =
        testCaseResourceTest.createAndCheckEntity(createTestCase2, ADMIN_AUTH_HEADERS);

    // Add quality expectations
    List<EntityReference> qualityExpectations =
        List.of(testCase1.getEntityReference(), testCase2.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withSemantics(passingSemantics)
            .withQualityExpectations(qualityExpectations);

    // Create data contract with both semantics and quality expectations
    DataContract dataContract = createDataContract(create);

    // Verify the contract was created properly
    assertNotNull(dataContract);
    assertNotNull(dataContract.getSemantics());
    assertEquals(2, dataContract.getSemantics().size());
    assertNotNull(dataContract.getQualityExpectations());
    assertEquals(2, dataContract.getQualityExpectations().size());
    assertNotNull(dataContract.getTestSuite());

    // Get the created test suite
    String expectedTestSuiteName = dataContract.getName() + " - Data Contract Expectations";
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite testSuite =
        testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS);

    // Mock PipelineServiceClient is already set up in @BeforeAll for all tests
    // Call the validate endpoint - this should pass semantics and trigger DQ validation (mocked)
    DataContractResult result = runValidate(dataContract);

    // Verify the validation result shows running (waiting for DQ results)
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Running, result.getContractExecutionStatus());

    // Verify semantics validation passed
    assertNotNull(result.getSemanticsValidation());
    assertEquals(2, result.getSemanticsValidation().getPassed().intValue());
    assertEquals(0, result.getSemanticsValidation().getFailed().intValue());
    assertEquals(2, result.getSemanticsValidation().getTotal().intValue());

    // Manually update the TestSuite with TestCaseResultSummary as if DQ pipeline executed
    List<ResultSummary> testCaseResultSummary = new ArrayList<>();
    testCaseResultSummary.add(
        new ResultSummary()
            .withTestCaseName(testCase1.getFullyQualifiedName())
            .withStatus(TestCaseStatus.Success)
            .withTimestamp(System.currentTimeMillis()));
    testCaseResultSummary.add(
        new ResultSummary()
            .withTestCaseName(testCase2.getFullyQualifiedName())
            .withStatus(TestCaseStatus.Success)
            .withTimestamp(System.currentTimeMillis()));

    // Update the test suite with result summaries
    String originalTestSuiteJson = JsonUtils.pojoToJson(testSuite);
    testSuite.setTestCaseResultSummary(testCaseResultSummary);
    TestSuite updatedTestSuite =
        testSuiteResourceTest.patchEntity(
            testSuite.getId(), originalTestSuiteJson, testSuite, ADMIN_AUTH_HEADERS);

    // Call updateContractDQResults to process the DQ results
    DataContractResult finalResult =
        dataContractRepository.updateContractDQResults(
            dataContract.getEntityReference(), updatedTestSuite);

    // Verify the final result shows success
    assertNotNull(finalResult);
    assertEquals(ContractExecutionStatus.Success, finalResult.getContractExecutionStatus());

    // Verify quality validation details
    assertNotNull(finalResult.getQualityValidation());
    assertEquals(2, finalResult.getQualityValidation().getPassed().intValue());
    assertEquals(0, finalResult.getQualityValidation().getFailed().intValue());
    assertEquals(2, finalResult.getQualityValidation().getTotal().intValue());

    // Verify semantics validation is still there
    assertNotNull(finalResult.getSemanticsValidation());
    assertEquals(2, finalResult.getSemanticsValidation().getPassed().intValue());
    assertEquals(0, finalResult.getSemanticsValidation().getFailed().intValue());

    // Verify the DataContract latestResult reflects the final successful validation
    DataContract updatedContract = getDataContract(dataContract.getId(), "");
    assertNotNull(updatedContract.getLatestResult());
    assertEquals(ContractExecutionStatus.Success, updatedContract.getLatestResult().getStatus());
    assertEquals(
        finalResult.getId().toString(), updatedContract.getLatestResult().getResultId().toString());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testValidateDataContractWithPassingSemanticsButFailingDQExpectations(TestInfo test)
      throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create passing semantics rules - checking for fields that exist in the table
    List<SemanticsRule> passingSemantics =
        List.of(
            new SemanticsRule()
                .withName("ID Field Exists")
                .withDescription("Checks that the ID field exists")
                .withRule("{\"!!\": {\"var\": \"id\"}}"),
            new SemanticsRule()
                .withName("Name Field Exists")
                .withDescription("Checks that the name field exists")
                .withRule("{\"!!\": {\"var\": \"name\"}}"));

    // Create test cases for quality expectations
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    CreateTestCase createTestCase1 =
        testCaseResourceTest
            .createRequest("test_case_completeness_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase1 =
        testCaseResourceTest.createAndCheckEntity(createTestCase1, ADMIN_AUTH_HEADERS);

    CreateTestCase createTestCase2 =
        testCaseResourceTest
            .createRequest("test_case_validity_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase2 =
        testCaseResourceTest.createAndCheckEntity(createTestCase2, ADMIN_AUTH_HEADERS);

    // Add quality expectations
    List<EntityReference> qualityExpectations =
        List.of(testCase1.getEntityReference(), testCase2.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withSemantics(passingSemantics)
            .withQualityExpectations(qualityExpectations);

    // Create data contract with both semantics and quality expectations
    DataContract dataContract = createDataContract(create);

    // Verify the contract was created properly
    assertNotNull(dataContract);
    assertNotNull(dataContract.getSemantics());
    assertEquals(2, dataContract.getSemantics().size());
    assertNotNull(dataContract.getQualityExpectations());
    assertEquals(2, dataContract.getQualityExpectations().size());
    assertNotNull(dataContract.getTestSuite());

    // Get the created test suite
    String expectedTestSuiteName = dataContract.getName() + " - Data Contract Expectations";
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite testSuite =
        testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS);

    // Mock PipelineServiceClient is already set up in @BeforeAll for all tests
    // Call the validate endpoint - this should pass semantics and trigger DQ validation (mocked)
    DataContractResult result = runValidate(dataContract);

    // Verify the validation result shows running (waiting for DQ results)
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Running, result.getContractExecutionStatus());

    // Verify semantics validation passed
    assertNotNull(result.getSemanticsValidation());
    assertEquals(2, result.getSemanticsValidation().getPassed().intValue());
    assertEquals(0, result.getSemanticsValidation().getFailed().intValue());
    assertEquals(2, result.getSemanticsValidation().getTotal().intValue());

    // Manually update the TestSuite with TestCaseResultSummary as if DQ pipeline executed with
    // FAILURES
    List<ResultSummary> testCaseResultSummary = new ArrayList<>();
    testCaseResultSummary.add(
        new ResultSummary()
            .withTestCaseName(testCase1.getFullyQualifiedName())
            .withStatus(TestCaseStatus.Failed) // This test case fails
            .withTimestamp(System.currentTimeMillis()));
    testCaseResultSummary.add(
        new ResultSummary()
            .withTestCaseName(testCase2.getFullyQualifiedName())
            .withStatus(TestCaseStatus.Success) // This test case passes
            .withTimestamp(System.currentTimeMillis()));

    // Update the test suite with result summaries
    String originalTestSuiteJson = JsonUtils.pojoToJson(testSuite);
    testSuite.setTestCaseResultSummary(testCaseResultSummary);
    TestSuite updatedTestSuite =
        testSuiteResourceTest.patchEntity(
            testSuite.getId(), originalTestSuiteJson, testSuite, ADMIN_AUTH_HEADERS);

    // Call updateContractDQResults to process the DQ results
    DataContractResult finalResult =
        dataContractRepository.updateContractDQResults(
            dataContract.getEntityReference(), updatedTestSuite);

    // Verify the final result shows FAILURE due to failing DQ tests
    assertNotNull(finalResult);
    assertEquals(ContractExecutionStatus.Failed, finalResult.getContractExecutionStatus());

    // Verify quality validation details show failure
    assertNotNull(finalResult.getQualityValidation());
    assertEquals(1, finalResult.getQualityValidation().getFailed().intValue()); // 1 failed test
    assertEquals(1, finalResult.getQualityValidation().getPassed().intValue()); // 1 passed test
    assertEquals(2, finalResult.getQualityValidation().getTotal().intValue()); // 2 total tests

    // Verify semantics validation is still there and passed
    assertNotNull(finalResult.getSemanticsValidation());
    assertEquals(2, finalResult.getSemanticsValidation().getPassed().intValue());
    assertEquals(0, finalResult.getSemanticsValidation().getFailed().intValue());

    // Verify the result message indicates quality validation failed
    assertTrue(finalResult.getResult().contains("Quality validation failed"));

    // Verify the DataContract latestResult reflects the final failed validation
    DataContract updatedContract = getDataContract(dataContract.getId(), "");
    assertNotNull(updatedContract.getLatestResult());
    assertEquals(ContractExecutionStatus.Failed, updatedContract.getLatestResult().getStatus());
    assertEquals(
        finalResult.getId().toString(), updatedContract.getLatestResult().getResultId().toString());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testValidateDataContractWithSchemaValidationFailure(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create schema fields that match the table's columns initially
    List<Column> contractSchema = new ArrayList<>();
    contractSchema.add(
        new Column().withName(C1).withDescription("ID field").withDataType(ColumnDataType.INT));
    contractSchema.add(
        new Column()
            .withName(C2)
            .withDescription("Name field")
            .withDataType(ColumnDataType.STRING));
    contractSchema.add(
        new Column()
            .withName(EMAIL_COL)
            .withDescription("Email field")
            .withDataType(ColumnDataType.STRING));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSchema(contractSchema);

    // Create data contract with schema that matches the table
    DataContract dataContract = createDataContract(create);

    // Verify the contract was created properly
    assertNotNull(dataContract);
    assertNotNull(dataContract.getSchema());
    assertEquals(3, dataContract.getSchema().size());

    // First, validate the contract when the schema is still valid - should pass
    DataContractResult initialResult = runValidate(dataContract);

    // Verify the initial validation passes
    assertNotNull(initialResult);
    assertEquals(ContractExecutionStatus.Success, initialResult.getContractExecutionStatus());

    // Verify schema validation details for initial success
    assertNotNull(initialResult.getSchemaValidation());
    assertEquals(0, initialResult.getSchemaValidation().getFailed().intValue()); // 0 fields failed
    assertEquals(3, initialResult.getSchemaValidation().getPassed().intValue()); // 3 fields passed
    assertEquals(3, initialResult.getSchemaValidation().getTotal().intValue()); // 3 total fields

    // Verify no failed fields
    assertTrue(
        initialResult.getSchemaValidation().getFailedFields() == null
            || initialResult.getSchemaValidation().getFailedFields().isEmpty());

    // Now let's "break" the table by modifying it to remove one of the columns that the contract
    // expects
    // We'll simulate this by updating the table to have fewer columns
    String originalTableJson = JsonUtils.pojoToJson(table);

    // Remove the EMAIL_COL from the table columns to break schema validation
    List<org.openmetadata.schema.type.Column> updatedColumns = new ArrayList<>();
    for (org.openmetadata.schema.type.Column col : table.getColumns()) {
      if (!EMAIL_COL.equals(col.getName())) {
        updatedColumns.add(col);
      }
    }
    table.setColumns(updatedColumns);

    // Patch the table to remove the email column using TableResourceTest
    TableResourceTest tableResourceTest = new TableResourceTest();
    Table patchedTable =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Verify the email column was removed
    assertEquals(
        3, patchedTable.getColumns().size()); // Should now have 3 columns (id, name, description)
    assertNull(
        patchedTable.getColumns().stream()
            .filter(col -> EMAIL_COL.equals(col.getName()))
            .findFirst()
            .orElse(null));

    // Now validate the data contract - it should fail schema validation
    DataContractResult result = runValidate(dataContract);

    // Verify the validation result shows failure due to schema validation
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());
    assertTrue(result.getResult().contains("Schema validation failed"));

    // Verify schema validation details
    assertNotNull(result.getSchemaValidation());
    assertEquals(1, result.getSchemaValidation().getFailed().intValue()); // 1 field failed (email)
    assertEquals(
        2, result.getSchemaValidation().getPassed().intValue()); // 2 fields passed (id, name)
    assertEquals(
        3, result.getSchemaValidation().getTotal().intValue()); // 3 total fields in contract

    // Verify the failed field is the email column
    assertNotNull(result.getSchemaValidation().getFailedFields());
    assertEquals(1, result.getSchemaValidation().getFailedFields().size());
    assertEquals(EMAIL_COL, result.getSchemaValidation().getFailedFields().get(0));

    // Verify the DataContract latestResult reflects the failed validation
    DataContract updatedContract = getDataContract(dataContract.getId(), "");
    assertNotNull(updatedContract.getLatestResult());
    assertEquals(ContractExecutionStatus.Failed, updatedContract.getLatestResult().getStatus());
    assertEquals(
        result.getId().toString(), updatedContract.getLatestResult().getResultId().toString());

    // Finally, verify that we have 2 DataContractResults properly stored
    WebTarget listTarget = getResource(dataContract.getId()).path("/results");
    Response listResponse = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();
    String jsonResponse =
        TestUtils.readResponse(listResponse, String.class, Status.OK.getStatusCode());
    ResultList<DataContractResult> allResults =
        JsonUtils.readValue(
            jsonResponse,
            new com.fasterxml.jackson.core.type.TypeReference<ResultList<DataContractResult>>() {});

    assertNotNull(allResults);
    assertEquals(2, allResults.getData().size());

    // Verify the results are in chronological order (newest first)
    DataContractResult firstResult = allResults.getData().get(0); // Most recent (failed)
    DataContractResult secondResult = allResults.getData().get(1); // Earlier (successful)

    // Verify the latest result is the failed one
    assertEquals(ContractExecutionStatus.Failed, firstResult.getContractExecutionStatus());
    assertEquals(result.getId(), firstResult.getId());

    // Verify the earlier result is the successful one
    assertEquals(ContractExecutionStatus.Success, secondResult.getContractExecutionStatus());
    assertEquals(initialResult.getId(), secondResult.getId());

    // Verify timestamps are in correct order (newer first)
    assertTrue(firstResult.getTimestamp() >= secondResult.getTimestamp());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testValidateDataContractAbortRunningValidation(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create passing semantics rules
    List<SemanticsRule> passingSemantics =
        List.of(
            new SemanticsRule()
                .withName("ID Field Exists")
                .withDescription("Checks that the ID field exists")
                .withRule("{\"!!\": {\"var\": \"id\"}}"));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSemantics(passingSemantics);

    DataContract dataContract = createDataContract(create);

    // Mock PipelineServiceClient is already set up in @BeforeAll for all tests
    DataContractResult firstResult = runValidate(dataContract);
    assertNotNull(firstResult);
    assertEquals(ContractExecutionStatus.Success, firstResult.getContractExecutionStatus());

    // Manually set the first result to Running status to simulate ongoing validation
    firstResult.withContractExecutionStatus(ContractExecutionStatus.Running);
    dataContractRepository.addContractResult(dataContract, firstResult);

    // Verify the contract shows running status
    DataContract contractAfterFirst = getDataContract(dataContract.getId(), "");
    assertNotNull(contractAfterFirst.getLatestResult());
    assertEquals(ContractExecutionStatus.Running, contractAfterFirst.getLatestResult().getStatus());
    assertEquals(firstResult.getId(), contractAfterFirst.getLatestResult().getResultId());

    // Start second validation - should abort the first running validation and create a new one
    DataContractResult secondResult = runValidate(dataContract);
    assertNotNull(secondResult);
    assertEquals(ContractExecutionStatus.Success, secondResult.getContractExecutionStatus());

    // Verify the latest result is now the second validation
    DataContract contractAfterSecond = getDataContract(dataContract.getId(), "");
    assertNotNull(contractAfterSecond.getLatestResult());
    assertEquals(
        ContractExecutionStatus.Success, contractAfterSecond.getLatestResult().getStatus());
    assertEquals(secondResult.getId(), contractAfterSecond.getLatestResult().getResultId());

    // Verify we have 2 results: one aborted, one successful
    WebTarget listTarget = getResource(dataContract.getId()).path("/results");
    Response listResponse = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();
    String jsonResponse =
        TestUtils.readResponse(listResponse, String.class, Status.OK.getStatusCode());
    ResultList<DataContractResult> allResults =
        JsonUtils.readValue(
            jsonResponse,
            new com.fasterxml.jackson.core.type.TypeReference<ResultList<DataContractResult>>() {});

    assertNotNull(allResults);
    assertEquals(2, allResults.getData().size());

    // The first result (most recent) should be the successful second validation
    DataContractResult latestResult = allResults.getData().get(0);
    assertEquals(ContractExecutionStatus.Success, latestResult.getContractExecutionStatus());
    assertEquals(secondResult.getId(), latestResult.getId());

    // The second result should be the aborted first validation
    DataContractResult abortedResult = allResults.getData().get(1);
    assertEquals(ContractExecutionStatus.Aborted, abortedResult.getContractExecutionStatus());
    assertEquals(firstResult.getId(), abortedResult.getId());
    assertTrue(abortedResult.getResult().contains("Aborted due to new validation request"));

    // Verify timestamps are in correct order (newer first)
    assertTrue(latestResult.getTimestamp() >= abortedResult.getTimestamp());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testGetDataContractByEntityWithoutContract(TestInfo test) throws IOException {
    // Create a table that will NOT have a data contract associated
    Table tableWithoutContract = createUniqueTable(test.getDisplayName());

    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> getDataContractByEntityId(tableWithoutContract.getId(), "table", "owners"));

    // Should return 404 since no data contract exists for this table
    assertEquals(Status.NOT_FOUND.getStatusCode(), exception.getStatusCode());

    // Verify the error message makes sense
    String errorMessage = exception.getMessage();
    assertTrue(
        errorMessage.contains("DataContract") || errorMessage.contains("not found"),
        "Error message should indicate that no data contract was found: " + errorMessage);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testGetDataContractByEntityWithoutContract(TestInfo test) throws IOException {
    // Create a table that will NOT have a data contract associated
    Table tableWithoutContract = createUniqueTable(test.getDisplayName());

    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> getDataContractByEntityId(tableWithoutContract.getId(), "table", "owners"));

    // Should return 404 since no data contract exists for this table
    assertEquals(Status.NOT_FOUND.getStatusCode(), exception.getStatusCode());

    // Verify the error message makes sense
    String errorMessage = exception.getMessage();
    assertTrue(
        errorMessage.contains("DataContract") || errorMessage.contains("not found"),
        "Error message should indicate that no data contract was found: " + errorMessage);
  }
}
