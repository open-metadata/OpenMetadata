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
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.QualityExpectation;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

public class DataContractResourceTest extends EntityResourceTest<DataContract, CreateDataContract> {
  // Column names used in tests
  private static final String C1 = "id";
  private static final String C2 = "name";
  private static final String C3 = "description";
  private static final String EMAIL_COL = "email";

  public DataContractResourceTest() {
    super(
        org.openmetadata.service.Entity.DATA_CONTRACT,
        DataContract.class,
        DataContractResource.DataContractList.class,
        "dataContracts",
        DataContractResource.FIELDS);
  }

  /**
   * Creates a unique table for the test to avoid data contract uniqueness constraint violations
   */
  private Table createTestTable(String name) throws IOException {
    String uniqueId = UUID.randomUUID().toString();
    String tableName = "dc_test_" + name + "_" + uniqueId;

    org.openmetadata.service.resources.databases.TableResourceTest tableResourceTest =
        new org.openmetadata.service.resources.databases.TableResourceTest();

    org.openmetadata.schema.api.data.CreateTable createTable =
        tableResourceTest
            .createRequest(tableName)
            .withDatabaseSchema(DATABASE_SCHEMA.getFullyQualifiedName())
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

    Table createdTable = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
    return createdTable;
  }

  @Override
  public CreateDataContract createRequest(String name) {
    try {
      // Create a unique table for each test
      Table testTable = createTestTable(name);
      return new CreateDataContract()
          .withName(name)
          .withEntity(testTable.getEntityReference())
          .withStatus(ContractStatus.Draft);
    } catch (IOException e) {
      // Fallback to TEST_TABLE1 if table creation fails
      System.err.println("Failed to create test table: " + e.getMessage());
      return new CreateDataContract()
          .withName(name)
          .withEntity(TEST_TABLE1.getEntityReference())
          .withStatus(ContractStatus.Draft);
    }
  }

  /**
   * Creates a data contract request for a specific test table
   */
  public CreateDataContract createRequest(String name, Table table) {
    return new CreateDataContract()
        .withName(name)
        .withEntity(table.getEntityReference())
        .withStatus(ContractStatus.Draft);
  }

  @Override
  public void validateCreatedEntity(
      DataContract dataContract,
      CreateDataContract createRequest,
      Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), dataContract.getName());
    assertEquals(createRequest.getStatus(), dataContract.getStatus());
    assertEquals(createRequest.getEntity().getId(), dataContract.getEntity().getId());
    assertEquals(createRequest.getEntity().getType(), dataContract.getEntity().getType());

    // Validate that the FQN follows the expected pattern
    String expectedFQN =
        createRequest.getEntity().getFullyQualifiedName()
            + ".dataContract_"
            + createRequest.getName();
    assertEquals(expectedFQN, dataContract.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(
      DataContract expected, DataContract updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getStatus(), updated.getStatus());
    assertEquals(expected.getEntity().getId(), updated.getEntity().getId());
    assertEquals(expected.getEntity().getType(), updated.getEntity().getType());
  }

  @Override
  public DataContract validateGetWithDifferentFields(DataContract dataContract, boolean byName)
      throws HttpResponseException {
    // Common fields that are expected in all the responses
    String fields = "";
    dataContract =
        byName
            ? getEntityByName(dataContract.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dataContract.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(dataContract.getName());
    assertNotNull(dataContract.getEntity());

    fields = "owners";
    dataContract =
        byName
            ? getEntityByName(dataContract.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dataContract.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(dataContract.getName());
    assertNotNull(dataContract.getOwners());

    return dataContract;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (fieldName.equals("schema")) {
      @SuppressWarnings("unchecked")
      List<Field> expectedSchemaFields = (List<Field>) expected;
      @SuppressWarnings("unchecked")
      List<Field> actualSchemaFields = (List<Field>) actual;
      assertEquals(expectedSchemaFields.size(), actualSchemaFields.size());
    } else if (fieldName.equals("qualityExpectations")) {
      @SuppressWarnings("unchecked")
      List<QualityExpectation> expectedQualityExpectations = (List<QualityExpectation>) expected;
      @SuppressWarnings("unchecked")
      List<QualityExpectation> actualQualityExpectations = (List<QualityExpectation>) actual;
      assertEquals(expectedQualityExpectations.size(), actualQualityExpectations.size());
    } else {
      assertEquals(expected, actual);
    }
  }

  @Test
  void testDataContractFields(TestInfo test) throws IOException {
    // Create Data Contract for TEST_TABLE1
    CreateDataContract create = createRequest(getEntityName(test), TEST_TABLE1);
    DataContract dataContract = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add schema fields that match the table's columns
    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(new Field().withName(C1).withDescription("Unique identifier"));
    schemaFields.add(new Field().withName(C2).withDescription("Name field"));

    // Add quality expectations
    List<QualityExpectation> qualityExpectations = new ArrayList<>();
    qualityExpectations.add(
        new QualityExpectation()
            .withName("Completeness")
            .withDescription("Data should be complete")
            .withDefinition("All required fields should have values"));
    qualityExpectations.add(
        new QualityExpectation()
            .withName("Uniqueness")
            .withDescription("IDs should be unique")
            .withDefinition("ID column should have unique values"));

    // Update with schema and quality expectations
    ChangeDescription change = getChangeDescription(dataContract, MINOR_UPDATE);
    fieldAdded(change, "schema", schemaFields);
    fieldAdded(change, "qualityExpectations", qualityExpectations);

    create.withSchema(schemaFields).withQualityExpectations(qualityExpectations);
    updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void testDataContractWithYAML(TestInfo test) throws IOException {
    // Test creating a data contract using YAML format
    String yamlContent =
        "name: "
            + getEntityName(test)
            + "\n"
            + "entity:\n"
            + "  id: "
            + TEST_TABLE2.getId()
            + "\n"
            + "  type: table\n"
            + "status: Active\n"
            + "schema:\n"
            + "  - name: "
            + C1
            + "\n"
            + "    description: ID field with validation\n"
            + "  - name: "
            + EMAIL_COL
            + "\n"
            + "    description: Email field with format constraints\n"
            + "qualityExpectations:\n"
            + "  - name: EmailFormat\n"
            + "    description: Email must be properly formatted\n"
            + "    definition: Email must contain @ and valid domain";

    // Create the data contract using direct YAML API endpoint
    DataContract dataContract = postYaml(yamlContent, ADMIN_AUTH_HEADERS);

    assertNotNull(dataContract);
    assertEquals(ContractStatus.Active, dataContract.getStatus());
    assertEquals(2, dataContract.getSchema().size());
    assertEquals(1, dataContract.getQualityExpectations().size());
    assertEquals("EmailFormat", dataContract.getQualityExpectations().get(0).getName());
  }

  @Test
  void testDataContractWithInvalidYAML(TestInfo test) {
    // Test creating a data contract with invalid YAML format
    String invalidYamlContent =
        "name: "
            + getEntityName(test)
            + "\n"
            + "entity:\n"
            + "  id: "
            + TEST_TABLE1.getId()
            + "\n"
            + "  type: table\n"
            + "status: Active\n"
            + "schema:\n"
            + "  - name: "
            + C1
            + "\n"
            + "    description: ID field with validation\n"
            + "  - name: value\n"
            + "    description: Value field\n"
            +
            // Invalid YAML indentation and structure
            "   badField: \"this is invalid yaml with wrong indentation\n"
            + "qualityExpectations:\n"
            + "  - name: ValueCheck\n"
            + "    description: Value must be numeric\n"
            + "    definition: Value must be a number";

    // Should return a 400 Bad Request for invalid YAML
    // The exact error message might vary, so we'll check for the response code only
    try {
      postYaml(invalidYamlContent, ADMIN_AUTH_HEADERS);
      // If we get here, the test should fail
      assertEquals(true, false, "Invalid YAML should have thrown an exception");
    } catch (HttpResponseException e) {
      assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), e.getStatusCode());
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  /**
   * Post YAML content directly to create a data contract
   */
  private DataContract postYaml(String yamlData, Map<String, String> authHeaders)
      throws IOException {
    WebTarget target = getCollection();
    // Set content type to YAML when posting
    Entity<String> entity = Entity.entity(yamlData, "application/yaml");
    Response response = SecurityUtil.addHeaders(target, authHeaders).post(entity);
    return TestUtils.readResponse(response, DataContract.class, Status.CREATED.getStatusCode());
  }

  @Test
  void testDataContractWithInvalidEntity(TestInfo test) {
    // Try creating a data contract with invalid entity reference
    UUID invalidId = UUID.randomUUID();
    EntityReference invalidRef = new EntityReference().withId(invalidId).withType("table");

    CreateDataContract create = createRequest(getEntityName(test)).withEntity(invalidRef);

    // Use TestUtils.assertResponse instead of assertThatThrownBy for consistent error handling
    TestUtils.assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        Response.Status.NOT_FOUND,
        "table instance for " + invalidId.toString() + " not found");
  }

  @Test
  void testDataContractStatus(TestInfo test) throws IOException {
    // Create a Draft data contract
    CreateDataContract create =
        createRequest(getEntityName(test), TEST_TABLE2).withStatus(ContractStatus.Draft);
    DataContract dataContract = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertEquals(ContractStatus.Draft, dataContract.getStatus());

    // Update to Active status
    ChangeDescription change = getChangeDescription(dataContract, MINOR_UPDATE);
    fieldUpdated(change, "status", ContractStatus.Draft, ContractStatus.Active);

    create.withStatus(ContractStatus.Active);
    dataContract =
        updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(ContractStatus.Active, dataContract.getStatus());

    // Update to Deprecated status
    change = getChangeDescription(dataContract, MINOR_UPDATE);
    fieldUpdated(change, "status", ContractStatus.Active, ContractStatus.Deprecated);

    create.withStatus(ContractStatus.Deprecated);
    dataContract =
        updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(ContractStatus.Deprecated, dataContract.getStatus());
  }

  @Test
  void testDataContractWithEffectiveDates(TestInfo test) throws IOException {
    // In the future we can add tests for effective dates here
    // Currently we've removed them from the schema simplification
  }

  @Test
  void testDataContractWithInvalidFields(TestInfo test) throws IOException {
    // Create schema with field that doesn't exist in the table
    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(
        new Field().withName("non_existent_field").withDescription("This field doesn't exist"));

    CreateDataContract create =
        createRequest(getEntityName(test), TEST_TABLE1).withSchema(schemaFields);

    // Should throw IllegalArgumentException with specific message
    TestUtils.assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        "Field 'non_existent_field' specified in the data contract does not exist in table");
  }

  @Test
  void testEnforceUniqueDataContractPerEntity(TestInfo test) throws IOException {
    // Create first data contract for this entity
    CreateDataContract create1 = createRequest(getEntityName(test), TEST_TABLE1);
    DataContract contract1 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);

    // Try to create another data contract for the same entity
    CreateDataContract create2 = createRequest(getEntityName(test) + "_duplicate", TEST_TABLE1);

    // Should enforce uniqueness - one contract per entity
    TestUtils.assertResponse(
        () -> createEntity(create2, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        "A data contract already exists for entity");
  }

  @Test
  void testVersionTracking(TestInfo test) throws IOException {
    // Create initial data contract
    CreateDataContract create = createRequest(getEntityName(test), TEST_TABLE2);
    DataContract dataContract = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // First update - add schema fields
    List<Field> schemaFields = new ArrayList<>();
    schemaFields.add(new Field().withName(C1).withDescription("First version description"));

    ChangeDescription change = getChangeDescription(dataContract, MINOR_UPDATE);
    fieldAdded(change, "schema", schemaFields);

    create.withSchema(schemaFields);
    dataContract =
        updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Second update - change field description
    List<Field> updatedFields = new ArrayList<>();
    updatedFields.add(new Field().withName(C1).withDescription("Updated description"));

    change = getChangeDescription(dataContract, MINOR_UPDATE);
    fieldUpdated(change, "schema", schemaFields, updatedFields);

    create.withSchema(updatedFields);
    dataContract =
        updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Check that change descriptions are properly tracked
    assertNotNull(dataContract.getChangeDescription());
  }
}
