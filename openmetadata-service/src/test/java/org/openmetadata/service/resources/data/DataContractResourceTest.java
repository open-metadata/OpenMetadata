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
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.AfterEach;
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
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.QualityExpectation;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.security.SecurityUtil;
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

  @AfterEach
  void cleanup() throws IOException {
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
    long threadId = Thread.currentThread().getId();

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
            + Thread.currentThread().getId()
            + "_"
            + tableCounter.incrementAndGet();
    String contractName = "contract_" + name + "_" + uniqueSuffix;

    return new CreateDataContract()
        .withName(contractName)
        .withEntity(table.getEntityReference())
        .withStatus(ContractStatus.Draft);
  }

  private DataContract createDataContract(CreateDataContract create) throws IOException {
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

  private DataContract getDataContractByEntityId(UUID entityId, String entityType)
      throws HttpResponseException {
    WebTarget target =
        getCollection()
            .path("/entity")
            .queryParam("entityId", entityId)
            .queryParam("entityType", entityType);
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

  private void deleteTable(UUID id) {
    WebTarget tableTarget = APP.client().target(getTableUri() + "/" + id);
    Response response = SecurityUtil.addHeaders(tableTarget, ADMIN_AUTH_HEADERS).delete();
    response.readEntity(String.class); // Consume response
  }

  // ===================== Permission Helper Methods =====================

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

  private String getDataContractUri() {
    return String.format("http://localhost:%s/api/v1/dataContracts", APP.getLocalPort());
  }

  private String getTableUri() {
    return String.format("http://localhost:%s/api/v1/tables", APP.getLocalPort());
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
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractSchema(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    String originalJson = JsonUtils.pojoToJson(created);

    // Add schema fields via patch
    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(
        new Field()
            .withName(C1)
            .withDescription("Updated ID field")
            .withDataType(FieldDataType.INT));
    schemaFields.add(
        new Field()
            .withName(C2)
            .withDescription("Updated name field")
            .withDataType(FieldDataType.STRING));
    created.setSchema(schemaFields);

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

    // Add quality expectations via patch
    List<QualityExpectation> qualityExpectations = new ArrayList<>();
    qualityExpectations.add(
        new QualityExpectation()
            .withName("DataIntegrity")
            .withDescription("Data must be consistent and valid")
            .withDefinition("All records must pass validation rules"));
    qualityExpectations.add(
        new QualityExpectation()
            .withName("Completeness")
            .withDescription("All required fields must be populated")
            .withDefinition("No null values in required columns"));
    created.setQualityExpectations(qualityExpectations);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertNotNull(patched.getQualityExpectations());
    assertEquals(2, patched.getQualityExpectations().size());
    assertEquals("DataIntegrity", patched.getQualityExpectations().get(0).getName());
    assertEquals("Completeness", patched.getQualityExpectations().get(1).getName());
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

    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(
        new Field()
            .withName(C1)
            .withDescription("Patched ID field")
            .withDataType(FieldDataType.INT));
    created.setSchema(schemaFields);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertEquals(ContractStatus.Active, patched.getStatus());
    assertEquals("Updated contract description via patch", patched.getDescription());
    assertNotNull(patched.getSchema());
    assertEquals(1, patched.getSchema().size());
    assertEquals("Patched ID field", patched.getSchema().get(0).getDescription());
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
    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(
        new Field()
            .withName(C1)
            .withDescription("Unique identifier")
            .withDataType(FieldDataType.INT));
    schemaFields.add(
        new Field().withName(C2).withDescription("Name field").withDataType(FieldDataType.STRING));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSchema(schemaFields);

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

    List<QualityExpectation> qualityExpectations = new ArrayList<>();
    qualityExpectations.add(
        new QualityExpectation()
            .withName("Completeness")
            .withDescription("Data should be complete")
            .withDefinition("All required fields should have values"));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withQualityExpectations(qualityExpectations);

    DataContract dataContract = createDataContract(create);

    assertNotNull(dataContract.getQualityExpectations());
    assertEquals(1, dataContract.getQualityExpectations().size());
    assertEquals("Completeness", dataContract.getQualityExpectations().get(0).getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithInvalidFields(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create schema with field that doesn't exist in the table
    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(
        new Field()
            .withName("non_existent_field")
            .withDescription("This field doesn't exist")
            .withDataType(FieldDataType.STRING));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSchema(schemaFields);

    // Should throw error for non-existent field
    assertResponseContains(
        () -> createDataContract(create),
        Status.BAD_REQUEST,
        "Field 'non_existent_field' specified in the data contract does not exist in table");
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
            + Thread.currentThread().getId()
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
                + "  - name: EmailFormat\n"
                + "    description: Email must be properly formatted\n"
                + "    definition: Email must contain @ and valid domain",
            "contract_" + test.getDisplayName(), table.getId(), C1, EMAIL_COL);

    DataContract dataContract = postYaml(yamlContent);

    assertNotNull(dataContract);
    assertEquals(ContractStatus.Active, dataContract.getStatus());
    assertEquals(2, dataContract.getSchema().size());
    assertEquals(1, dataContract.getQualityExpectations().size());
    assertEquals("EmailFormat", dataContract.getQualityExpectations().get(0).getName());
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
    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(
        new Field()
            .withName("invalid_field_1")
            .withDescription("First invalid field")
            .withDataType(FieldDataType.STRING));
    schemaFields.add(
        new Field()
            .withName("invalid_field_2")
            .withDescription("Second invalid field")
            .withDataType(FieldDataType.INT));
    schemaFields.add(
        new Field()
            .withName(C1) // This one is valid
            .withDescription("Valid field")
            .withDataType(FieldDataType.INT));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSchema(schemaFields);

    // Should fail on the first invalid field encountered
    assertResponseContains(
        () -> createDataContract(create),
        Status.BAD_REQUEST,
        "Field 'invalid_field_1' specified in the data contract does not exist in table");
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
}
