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

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.datacontract.odcs.ODCSImportResponse;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import java.util.List;

@Slf4j
@Execution(ExecutionMode.CONCURRENT)
public class DataContractResourceODCSTest extends OpenMetadataApplicationTest {
  
  private static final String ODCS_RESOURCES_PATH = "/odcs/";
  private static String testDatabaseSchemaFQN = null;
  
  @BeforeAll
  static void setup() throws IOException {
    // Setup will be done on first table creation
  }
  
  @Test
  void testImportCustomerOrdersContract(TestInfo test) throws IOException {
    // Create a test table
    Table table = createTestTable(test.getDisplayName());
    
    // Load ODCS YAML from resources
    String odcsYaml = loadResourceFile("customer-orders-contract.yaml");
    
    // Import the contract
    ODCSImportResponse response = importODCSContract(table.getId(), odcsYaml, "yaml");
    
    // Verify import response
    assertNotNull(response);
    assertEquals("Customer Orders Contract", response.getContract().getName());
    assertEquals(ContractStatus.Active, response.getContract().getStatus());
    assertEquals("v3.0.2", response.getImportReport().getOdcsVersion());
    
    // Verify schema mapping
    DataContract contract = response.getContract();
    assertNotNull(contract.getSchema());
    assertTrue(contract.getSchema().size() > 0);
    
    // Find specific columns
    Column orderIdCol = findColumn(contract, "order_id");
    assertNotNull(orderIdCol);
    assertEquals(ColumnDataType.STRING, orderIdCol.getDataType());
    assertTrue(orderIdCol.getConstraint() != null);
    
    Column orderAmountCol = findColumn(contract, "order_amount");
    assertNotNull(orderAmountCol);
    assertEquals(ColumnDataType.DECIMAL, orderAmountCol.getDataType());
    assertEquals("DECIMAL(10,2)", orderAmountCol.getDataTypeDisplay());
    
    Column customerEmailCol = findColumn(contract, "customer_email");
    assertNotNull(customerEmailCol);
    assertEquals("PII.Sensitive", customerEmailCol.getTags().get(0).getTagFQN());
    
    // Verify SLA
    assertNotNull(contract.getSla());
    assertEquals(24, contract.getSla().getRefreshFrequency().getInterval());
    assertEquals(4, contract.getSla().getMaxLatency().getValue());
    assertEquals("06:00 UTC", contract.getSla().getAvailabilityTime());
    
    // Verify quality expectations
    assertNotNull(contract.getQualityExpectations());
    assertTrue(contract.getQualityExpectations().size() > 0);
    
    // Verify team mapping
    assertNotNull(contract.getOwners());
    assertTrue(contract.getOwners().stream().anyMatch(o -> "john.doe".equals(o.getName())));
    
    assertNotNull(contract.getReviewers());
    assertTrue(contract.getReviewers().stream().anyMatch(r -> "alice.johnson".equals(r.getName())));
    
    // Verify import report
    assertTrue(response.getImportReport().getMappedFields().contains("schema"));
    assertTrue(response.getImportReport().getMappedFields().contains("quality"));
    assertTrue(response.getImportReport().getMappedFields().contains("slaProperties"));
    assertTrue(response.getImportReport().getMappedFields().contains("team"));
    assertTrue(response.getImportReport().getSkippedFields().contains("servers"));
    assertTrue(response.getImportReport().getSkippedFields().contains("pricing"));
  }
  
  @Test
  void testImportSimpleContract(TestInfo test) throws IOException {
    Table table = createTestTable(test.getDisplayName());
    String odcsYaml = loadResourceFile("simple-contract.yaml");
    
    ODCSImportResponse response = importODCSContract(table.getId(), odcsYaml, "yaml");
    
    assertEquals("Simple User Table Contract", response.getContract().getName());
    assertEquals(ContractStatus.Active, response.getContract().getStatus());
    assertEquals("v3.0.0", response.getImportReport().getOdcsVersion());
    
    // Verify simple schema
    assertEquals(4, response.getContract().getSchema().size());
    
    Column userIdCol = findColumn(response.getContract(), "user_id");
    assertEquals(ColumnDataType.INT, userIdCol.getDataType());
    
    Column emailCol = findColumn(response.getContract(), "email");
    assertNotNull(emailCol.getTags());
    assertEquals("PII.Sensitive", emailCol.getTags().get(0).getTagFQN());
  }
  
  @Test
  void testImportDraftContract(TestInfo test) throws IOException {
    Table table = createTestTable(test.getDisplayName());
    String odcsYaml = loadResourceFile("draft-contract.yaml");
    
    ODCSImportResponse response = importODCSContract(table.getId(), odcsYaml, "yaml");
    
    assertEquals("Product Catalog Contract (Draft)", response.getContract().getName());
    assertEquals(ContractStatus.Draft, response.getContract().getStatus());
    assertEquals("v3.0.1", response.getImportReport().getOdcsVersion());
  }
  
  @Test
  void testImportDeprecatedContract(TestInfo test) throws IOException {
    Table table = createTestTable(test.getDisplayName());
    String odcsYaml = loadResourceFile("deprecated-contract.yaml");
    
    ODCSImportResponse response = importODCSContract(table.getId(), odcsYaml, "yaml");
    
    assertEquals("Legacy Orders Contract", response.getContract().getName());
    assertEquals(ContractStatus.Deprecated, response.getContract().getStatus());
  }
  
  @Test
  void testImportRetiredContract(TestInfo test) throws IOException {
    Table table = createTestTable(test.getDisplayName());
    String odcsYaml = loadResourceFile("retired-contract.yaml");
    
    ODCSImportResponse response = importODCSContract(table.getId(), odcsYaml, "yaml");
    
    assertEquals("Retired Analytics Contract", response.getContract().getName());
    assertEquals(ContractStatus.Deprecated, response.getContract().getStatus()); // retired maps to deprecated
  }
  
  @Test
  void testImportComplexTypesContract(TestInfo test) throws IOException {
    Table table = createTestTable(test.getDisplayName());
    String odcsYaml = loadResourceFile("complex-types-contract.yaml");
    
    ODCSImportResponse response = importODCSContract(table.getId(), odcsYaml, "yaml");
    
    DataContract contract = response.getContract();
    assertEquals("Complex Data Types Contract", contract.getName());
    
    // Verify type mappings
    assertEquals(ColumnDataType.STRING, findColumn(contract, "string_col").getDataType());
    assertEquals(ColumnDataType.VARCHAR, findColumn(contract, "varchar_col").getDataType());
    assertEquals(ColumnDataType.INT, findColumn(contract, "integer_col").getDataType());
    assertEquals(ColumnDataType.BIGINT, findColumn(contract, "bigint_col").getDataType());
    assertEquals(ColumnDataType.DECIMAL, findColumn(contract, "decimal_col").getDataType());
    assertEquals(ColumnDataType.BOOLEAN, findColumn(contract, "boolean_col").getDataType());
    assertEquals(ColumnDataType.DATE, findColumn(contract, "date_col").getDataType());
    assertEquals(ColumnDataType.TIMESTAMP, findColumn(contract, "timestamp_col").getDataType());
    assertEquals(ColumnDataType.ARRAY, findColumn(contract, "array_col").getDataType());
    assertEquals(ColumnDataType.STRUCT, findColumn(contract, "object_col").getDataType());
    assertEquals(ColumnDataType.JSON, findColumn(contract, "json_col").getDataType());
    assertEquals(ColumnDataType.UNKNOWN, findColumn(contract, "custom_type_col").getDataType());
  }
  
  @Test
  void testImportInvalidVersion() throws IOException {
    Table table = createTestTable("testInvalidVersion");
    String odcsYaml = loadResourceFile("invalid-version.yaml");
    
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> 
        importODCSContract(table.getId(), odcsYaml, "yaml"));
    
    assertTrue(exception.getMessage().contains("Only ODCS versions v3.0.0, v3.0.1, v3.0.2 are supported"));
  }
  
  @Test
  void testImportInvalidYaml() throws IOException {
    Table table = createTestTable("testInvalidYaml");
    String odcsYaml = loadResourceFile("invalid-yaml.yaml");
    
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> 
        importODCSContract(table.getId(), odcsYaml, "yaml"));
    
    assertTrue(exception.getMessage().contains("Failed to import ODCS contract"));
  }
  
  @Test
  void testImportWithoutEntityId() throws IOException {
    String odcsYaml = loadResourceFile("simple-contract.yaml");
    
    WebTarget target = getCollection().path("/import/odcs")
        .queryParam("format", "yaml");
    
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
        .post(Entity.entity(odcsYaml, "application/yaml"));
    
    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), response.getStatus());
  }
  
  @Test
  void testImportWithNonExistentEntity() throws IOException {
    UUID fakeEntityId = UUID.randomUUID();
    String odcsYaml = loadResourceFile("simple-contract.yaml");
    
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> 
        importODCSContract(fakeEntityId, odcsYaml, "yaml"));
    
    assertTrue(exception.getMessage().contains("Entity with id " + fakeEntityId + " not found"));
  }
  
  @Test
  void testImportJsonFormat(TestInfo test) throws IOException {
    Table table = createTestTable(test.getDisplayName());
    String odcsJson = loadResourceFile("simple-contract.json");
    
    ODCSImportResponse response = importODCSContract(table.getId(), odcsJson, "json");
    
    assertEquals("JSON Format Contract", response.getContract().getName());
    assertEquals(ContractStatus.Active, response.getContract().getStatus());
    assertEquals("v3.0.0", response.getImportReport().getOdcsVersion());
    
    // Verify schema
    assertEquals(3, response.getContract().getSchema().size());
    
    Column idCol = findColumn(response.getContract(), "id");
    assertEquals(ColumnDataType.INT, idCol.getDataType());
  }
  
  @Test
  void testImportWithUnauthorizedUser() throws IOException {
    Table table = createTestTable("testUnauthorized");
    String odcsYaml = loadResourceFile("simple-contract.yaml");
    
    WebTarget target = getCollection().path("/import/odcs")
        .queryParam("entityId", table.getId())
        .queryParam("format", "yaml");
    
    // Use TEST_AUTH_HEADERS which has limited permissions
    Response response = SecurityUtil.addHeaders(target, TEST_AUTH_HEADERS)
        .post(Entity.entity(odcsYaml, "application/yaml"));
    
    assertEquals(Response.Status.FORBIDDEN.getStatusCode(), response.getStatus());
  }
  
  // Helper methods
  
  private String loadResourceFile(String filename) throws IOException {
    try (InputStream is = getClass().getResourceAsStream(ODCS_RESOURCES_PATH + filename)) {
      if (is == null) {
        throw new IOException("Resource file not found: " + filename);
      }
      return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
  
  private Table createTestTable(String testName) throws IOException {
    // Ensure database schema exists
    if (testDatabaseSchemaFQN == null) {
      testDatabaseSchemaFQN = createTestDatabaseSchema();
    }
    
    CreateTable createTable = new CreateTable()
        .withName("test_table_" + testName.replaceAll("[^a-zA-Z0-9]", "_") + "_" + System.currentTimeMillis())
        .withColumns(List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.INT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.STRING),
            new Column()
                .withName("description")
                .withDataType(ColumnDataType.TEXT)))
        .withDatabaseSchema(testDatabaseSchemaFQN);
    
    WebTarget target = getResource("tables");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
        .post(Entity.json(createTable));
    return TestUtils.readResponse(response, Table.class, Response.Status.CREATED.getStatusCode());
  }
  
  private String createTestDatabaseSchema() throws IOException {
    long uniqueId = System.nanoTime();
    
    // Create database service
    CreateDatabaseService createService = new CreateDatabaseService()
        .withName("test-odcs-service-" + uniqueId)
        .withServiceType(DatabaseServiceType.Mysql)
        .withConnection(new DatabaseConnection()
            .withConfig(new MysqlConnection()
                .withHostPort("localhost:3306")
                .withUsername("test")));
    
    WebTarget serviceTarget = getResource("services/databaseServices");
    Response serviceResponse = SecurityUtil.addHeaders(serviceTarget, ADMIN_AUTH_HEADERS)
        .post(Entity.json(createService));
    DatabaseService service = TestUtils.readResponse(serviceResponse, DatabaseService.class, 
        Response.Status.CREATED.getStatusCode());
    
    // Create database
    CreateDatabase createDatabase = new CreateDatabase()
        .withName("test-odcs-db-" + uniqueId)
        .withService(service.getFullyQualifiedName());
    
    WebTarget dbTarget = getResource("databases");
    Response dbResponse = SecurityUtil.addHeaders(dbTarget, ADMIN_AUTH_HEADERS)
        .post(Entity.json(createDatabase));
    Database database = TestUtils.readResponse(dbResponse, Database.class, 
        Response.Status.CREATED.getStatusCode());
    
    // Create schema
    CreateDatabaseSchema createSchema = new CreateDatabaseSchema()
        .withName("test-odcs-schema-" + uniqueId)
        .withDatabase(database.getFullyQualifiedName());
    
    WebTarget schemaTarget = getResource("databaseSchemas");
    Response schemaResponse = SecurityUtil.addHeaders(schemaTarget, ADMIN_AUTH_HEADERS)
        .post(Entity.json(createSchema));
    DatabaseSchema schema = TestUtils.readResponse(schemaResponse, DatabaseSchema.class, 
        Response.Status.CREATED.getStatusCode());
    
    return schema.getFullyQualifiedName();
  }
  
  private ODCSImportResponse importODCSContract(UUID entityId, String odcsContent, String format) 
      throws HttpResponseException {
    WebTarget target = getCollection().path("/import/odcs")
        .queryParam("entityId", entityId)
        .queryParam("format", format);
    
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
        .post(Entity.entity(odcsContent, "yaml".equals(format) ? "application/yaml" : MediaType.APPLICATION_JSON));
    
    return TestUtils.readResponse(response, ODCSImportResponse.class, Response.Status.OK.getStatusCode());
  }
  
  private Column findColumn(DataContract contract, String columnName) {
    return contract.getSchema().stream()
        .filter(c -> columnName.equals(c.getName()))
        .findFirst()
        .orElse(null);
  }
  
  private WebTarget getCollection() {
    return getResource("datacontracts");
  }
  
  // Use parent class static method instead of overriding
  private WebTarget getResourceTarget(String collection) {
    return getResource(collection);
  }
}