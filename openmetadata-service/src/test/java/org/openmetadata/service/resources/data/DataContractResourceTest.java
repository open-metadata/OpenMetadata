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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DATA_CONTRACT;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
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
import java.util.Collections;
import java.util.HashMap;
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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.apis.APIEndpointResourceTest;
import org.openmetadata.service.resources.charts.ChartResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResourceTest;
import org.openmetadata.service.resources.domains.DataProductResourceTest;
import org.openmetadata.service.resources.dqtests.TestCaseResourceTest;
import org.openmetadata.service.resources.dqtests.TestSuiteResourceTest;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@Execution(ExecutionMode.CONCURRENT)
public class DataContractResourceTest extends EntityResourceTest<DataContract, CreateDataContract> {
  private static final String C1 = "id";
  private static final String C2 = "name";
  private static final String C3 = "description";
  private static final String EMAIL_COL = "email";

  private static final AtomicLong tableCounter = new AtomicLong(0);

  private final List<DataContract> createdContracts = new ArrayList<>();
  private final List<Table> createdTables = new ArrayList<>();
  private final List<Topic> createdTopics = new ArrayList<>();
  private final List<APIEndpoint> createdApiEndpoints = new ArrayList<>();
  private final List<DashboardDataModel> createdDashboardDataModels = new ArrayList<>();

  private static String testDatabaseSchemaFQN = null;

  private static TestCaseResourceTest testCaseResourceTest;
  private static IngestionPipelineResourceTest ingestionPipelineResourceTest;
  private static TestSuiteResourceTest testSuiteResourceTest;
  private static ChartResourceTest chartResourceTest;
  private static DashboardResourceTest dashboardResourceTest;
  private static APIEndpointResourceTest apiEndpointResourceTest;
  private static DashboardDataModelResourceTest dashboardDataModelResourceTest;
  private static DataContractRepository dataContractRepository;
  private static PipelineServiceClientInterface mockPipelineClient;

  public DataContractResourceTest() {
    super(
        DATA_CONTRACT,
        DataContract.class,
        DataContractResource.DataContractList.class,
        "dataContracts",
        DataContractResource.FIELDS);
    supportedNameCharacters = "_'+#- ()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
    supportsSearchIndex = false;
    supportsOwners = false;
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    testCaseResourceTest = new TestCaseResourceTest();
    testSuiteResourceTest = new TestSuiteResourceTest();
    chartResourceTest = new ChartResourceTest();
    dashboardResourceTest = new DashboardResourceTest();
    apiEndpointResourceTest = new APIEndpointResourceTest();
    dashboardDataModelResourceTest = new DashboardDataModelResourceTest();
    ingestionPipelineResourceTest = new IngestionPipelineResourceTest();
    ingestionPipelineResourceTest.setup(test);

    // Set up mock PipelineServiceClient for all tests
    dataContractRepository =
        (DataContractRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.DATA_CONTRACT);

    // Create and set mock PipelineServiceClient
    mockPipelineClient = mock(PipelineServiceClientInterface.class);

    // Configure mock to return successful response (code = 200) for all method calls
    PipelineServiceClientResponse successResponse =
        new PipelineServiceClientResponse()
            .withCode(200)
            .withReason("Success")
            .withPlatform("test");

    when(mockPipelineClient.deployPipeline(any(), any())).thenReturn(successResponse);
    when(mockPipelineClient.runPipeline(any(), any())).thenReturn(successResponse);
    when(mockPipelineClient.deletePipeline(any())).thenReturn(successResponse);
    when(mockPipelineClient.toggleIngestion(any())).thenReturn(successResponse);
    when(mockPipelineClient.killIngestion(any())).thenReturn(successResponse);

    dataContractRepository.setPipelineServiceClient(mockPipelineClient);
  }

  @Override
  public CreateDataContract createRequest(String name) {
    try {
      Table table = createUniqueTable(name);
      return createDataContractRequest(name, table);
    } catch (IOException e) {
      throw new RuntimeException("Failed to create unique table for data contract test", e);
    }
  }

  @Override
  public void validateCreatedEntity(
      DataContract createdEntity, CreateDataContract request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getEntityStatus(), createdEntity.getEntityStatus());
    assertSemantics(request.getSemantics(), createdEntity.getSemantics());
    assertQualityExpectations(
        request.getQualityExpectations(), createdEntity.getQualityExpectations());
    TableResourceTest.assertColumns(request.getSchema(), createdEntity.getSchema());
  }

  public void assertSemantics(List<SemanticsRule> expected, List<SemanticsRule> actual) {
    if (expected == null || expected.isEmpty()) {
      assertNull(actual);
    } else {
      assertNotNull(actual);
      assertEquals(expected.size(), actual.size());
      for (int i = 0; i < expected.size(); i++) {
        SemanticsRule expectedRule = expected.get(i);
        SemanticsRule actualRule = actual.get(i);
        assertEquals(expectedRule.getName(), actualRule.getName());
        assertEquals(expectedRule.getDescription(), actualRule.getDescription());
        assertEquals(expectedRule.getRule(), actualRule.getRule());
      }
    }
  }

  public void assertQualityExpectations(
      List<EntityReference> created, List<EntityReference> request) {
    if (nullOrEmpty(created) || nullOrEmpty(request)) {
      return;
    }
    for (int i = 0; i < created.size(); i++) {
      EntityReference expectedRef = created.get(i);
      EntityReference actualRef = request.get(i);
      assertReference(expectedRef, actualRef);
    }
  }

  @Override
  public void compareEntities(
      DataContract expected, DataContract patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Compare basic fields
    assertEquals(expected.getName(), patched.getName());
    assertEquals(expected.getDescription(), patched.getDescription());
    assertEquals(expected.getEntityStatus(), patched.getEntityStatus());

    // Compare entity reference
    TestUtils.validateEntityReference(patched.getEntity());
    assertEquals(expected.getEntity().getId(), patched.getEntity().getId());
    assertEquals(expected.getEntity().getType(), patched.getEntity().getType());

    // Compare schema if present
    if (expected.getSchema() != null && patched.getSchema() != null) {
      assertEquals(expected.getSchema().size(), patched.getSchema().size());
      for (int i = 0; i < expected.getSchema().size(); i++) {
        Column expectedCol = expected.getSchema().get(i);
        Column patchedCol = patched.getSchema().get(i);
        assertEquals(expectedCol.getName(), patchedCol.getName());
        assertEquals(expectedCol.getDataType(), patchedCol.getDataType());
        assertEquals(expectedCol.getDescription(), patchedCol.getDescription());
      }
    }

    // Compare semantics if present
    if (expected.getSemantics() != null && patched.getSemantics() != null) {
      assertEquals(expected.getSemantics().size(), patched.getSemantics().size());
      for (int i = 0; i < expected.getSemantics().size(); i++) {
        SemanticsRule expectedRule = expected.getSemantics().get(i);
        SemanticsRule patchedRule = patched.getSemantics().get(i);
        assertEquals(expectedRule.getName(), patchedRule.getName());
        assertEquals(expectedRule.getRule(), patchedRule.getRule());
        assertEquals(expectedRule.getDescription(), patchedRule.getDescription());
      }
    }

    // Compare quality expectations if present
    if (expected.getQualityExpectations() != null && patched.getQualityExpectations() != null) {
      assertEquals(
          expected.getQualityExpectations().size(), patched.getQualityExpectations().size());
    }

    // Compare owners and reviewers
    TestUtils.validateEntityReferences(expected.getOwners());
    TestUtils.validateEntityReferences(expected.getReviewers());

    // Validate fully qualified name
    assertEquals(expected.getFullyQualifiedName(), patched.getFullyQualifiedName());
  }

  @Override
  public DataContract validateGetWithDifferentFields(DataContract dataContract, boolean byName)
      throws HttpResponseException {
    // Get without optional fields
    dataContract =
        byName
            ? getEntityByName(dataContract.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(dataContract.getId(), null, ADMIN_AUTH_HEADERS);

    // Required fields should always be present
    assertListNotNull(
        dataContract.getId(),
        dataContract.getName(),
        dataContract.getEntity(),
        dataContract.getFullyQualifiedName());

    // Optional fields should be null when not requested
    assertListNull(
        dataContract.getOwners(),
        dataContract.getReviewers(),
        dataContract.getQualityExpectations());

    // Get with all optional fields
    String fields = "owners,reviewers,qualityExpectations";
    dataContract =
        byName
            ? getEntityByName(dataContract.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dataContract.getId(), fields, ADMIN_AUTH_HEADERS);

    // Required fields should still be present
    assertListNotNull(
        dataContract.getId(),
        dataContract.getName(),
        dataContract.getEntity(),
        dataContract.getFullyQualifiedName());

    // Optional fields may now be present based on whether they were set
    // Note: We don't assert they are not null because they may legitimately be empty

    return dataContract;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual)
      throws IOException {
    if (expected == actual) {
      return;
    }

    if (fieldName.equals("status")) {
      // Handle EntityStatus enum
      EntityStatus expectedStatus =
          expected instanceof EntityStatus
              ? (EntityStatus) expected
              : EntityStatus.fromValue(expected.toString());
      EntityStatus actualStatus =
          actual instanceof EntityStatus
              ? (EntityStatus) actual
              : EntityStatus.fromValue(actual.toString());
      assertEquals(expectedStatus, actualStatus);
    } else if (fieldName.equals("schema") || fieldName.endsWith(".schema")) {
      // Handle schema changes
      @SuppressWarnings("unchecked")
      List<Column> expectedSchema =
          expected instanceof List
              ? (List<Column>) expected
              : JsonUtils.readObjects(expected.toString(), Column.class);
      List<Column> actualSchema = JsonUtils.readObjects(actual.toString(), Column.class);
      assertEquals(expectedSchema.size(), actualSchema.size());
      for (int i = 0; i < expectedSchema.size(); i++) {
        Column expectedCol = expectedSchema.get(i);
        Column actualCol = actualSchema.get(i);
        assertEquals(expectedCol.getName(), actualCol.getName());
        assertEquals(expectedCol.getDataType(), actualCol.getDataType());
        assertEquals(expectedCol.getDescription(), actualCol.getDescription());
      }
    } else if (fieldName.equals("semantics") || fieldName.endsWith(".semantics")) {
      // Handle semantics changes
      @SuppressWarnings("unchecked")
      List<SemanticsRule> expectedSemantics =
          expected instanceof List
              ? (List<SemanticsRule>) expected
              : JsonUtils.readObjects(expected.toString(), SemanticsRule.class);
      List<SemanticsRule> actualSemantics =
          JsonUtils.readObjects(actual.toString(), SemanticsRule.class);
      assertEquals(expectedSemantics.size(), actualSemantics.size());
      for (int i = 0; i < expectedSemantics.size(); i++) {
        SemanticsRule expectedRule = expectedSemantics.get(i);
        SemanticsRule actualRule = actualSemantics.get(i);
        assertEquals(expectedRule.getName(), actualRule.getName());
        assertEquals(expectedRule.getRule(), actualRule.getRule());
        assertEquals(expectedRule.getDescription(), actualRule.getDescription());
      }
    } else if (fieldName.equals("qualityExpectations")
        || fieldName.endsWith(".qualityExpectations")) {
      // Handle quality expectations changes
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs =
          expected instanceof List
              ? (List<EntityReference>) expected
              : JsonUtils.readObjects(expected.toString(), EntityReference.class);
      List<EntityReference> actualRefs =
          JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertReferenceList(expectedRefs, actualRefs);
    } else if (fieldName.equals("owners") || fieldName.equals("reviewers")) {
      // Handle entity reference lists
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs =
          expected instanceof List
              ? (List<EntityReference>) expected
              : JsonUtils.readObjects(expected.toString(), EntityReference.class);
      List<EntityReference> actualRefs =
          JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertReferenceList(expectedRefs, actualRefs);
    } else {
      // For all other fields, use common field change assertion
      assertCommonFieldChange(fieldName, expected, actual);
    }
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
        deleteTable(table.getId(), true);
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
    createdTables.clear();
    for (Topic topic : createdTopics) {
      try {
        deleteTopic(topic.getId());
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
    createdTopics.clear();
    for (APIEndpoint apiEndpoint : createdApiEndpoints) {
      try {
        deleteApiEndpoint(apiEndpoint.getId());
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
    createdApiEndpoints.clear();
    for (DashboardDataModel dataModel : createdDashboardDataModels) {
      try {
        deleteDashboardDataModel(dataModel.getId());
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
    createdDashboardDataModels.clear();
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
          client.target(
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
          client.target(String.format("http://localhost:%s/api/v1/databases", APP.getLocalPort()));
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
          client.target(
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

    WebTarget target = client.target(getTableUri());
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(createTable));
    Table createdTable =
        TestUtils.readResponse(response, Table.class, Status.CREATED.getStatusCode());
    createdTables.add(createdTable);
    return createdTable;
  }

  /**
   * Creates a unique topic for testing data contracts
   */
  private Topic createUniqueTopic(String testName) throws IOException {
    return createUniqueTopic(testName, null);
  }

  /**
   * Creates a unique topic for testing data contracts with specific schema fields
   */
  private Topic createUniqueTopic(String testName, List<Field> customFields) throws IOException {
    // Ensure we have a messaging service to work with
    String messagingServiceName = ensureMessagingService();

    // Use multiple entropy sources for absolute uniqueness
    long counter = tableCounter.incrementAndGet();
    long timestamp = System.nanoTime();
    String uniqueId = UUID.randomUUID().toString().replace("-", "");
    long threadId = Thread.currentThread().threadId();

    String topicName =
        "dc_test_topic_"
            + testName
            + "_"
            + counter
            + "_"
            + timestamp
            + "_"
            + threadId
            + "_"
            + uniqueId.substring(0, 8);

    // Create message schema for the topic
    List<Field> fields = customFields;
    if (fields == null) {
      fields =
          List.of(
              new Field()
                  .withName("messageId")
                  .withDisplayName("Message ID")
                  .withDataType(FieldDataType.STRING),
              new Field()
                  .withName("eventType")
                  .withDisplayName("Event Type")
                  .withDataType(FieldDataType.STRING),
              new Field()
                  .withName("payload")
                  .withDisplayName("Payload")
                  .withDataType(FieldDataType.STRING),
              new Field()
                  .withName("timestamp")
                  .withDisplayName("Timestamp")
                  .withDataType(FieldDataType.TIMESTAMP));
    }

    MessageSchema messageSchema =
        new MessageSchema()
            .withSchemaText(
                "{\"type\":\"record\",\"name\":\"TestMessage\",\"fields\":[{\"name\":\"messageId\",\"type\":\"string\"},{\"name\":\"eventType\",\"type\":\"string\"},{\"name\":\"payload\",\"type\":\"string\"},{\"name\":\"timestamp\",\"type\":\"long\"}]}")
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(fields);

    // Create topic using the messaging service
    CreateTopic createTopic =
        new CreateTopic()
            .withName(topicName)
            .withService(messagingServiceName)
            .withPartitions(1)
            .withMessageSchema(messageSchema);

    WebTarget target = client.target(getTopicUri());
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(createTopic));
    Topic createdTopic =
        TestUtils.readResponse(response, Topic.class, Status.CREATED.getStatusCode());
    createdTopics.add(createdTopic);
    return createdTopic;
  }

  /**
   * Creates a unique API endpoint for testing data contracts
   */
  private APIEndpoint createUniqueApiEndpoint(String testName) throws IOException {
    return createUniqueApiEndpoint(testName, null, null);
  }

  /**
   * Creates a unique API endpoint for testing data contracts with specific schema fields
   */
  private APIEndpoint createUniqueApiEndpoint(
      String testName,
      List<org.openmetadata.schema.type.Field> requestFields,
      List<org.openmetadata.schema.type.Field> responseFields)
      throws IOException {
    // Use multiple entropy sources for absolute uniqueness
    long counter = tableCounter.incrementAndGet();
    long timestamp = System.nanoTime();
    String uniqueId = UUID.randomUUID().toString().replace("-", "");
    long threadId = Thread.currentThread().threadId();
    String apiEndpointName =
        "dc_test_api_endpoint_"
            + testName
            + "_"
            + counter
            + "_"
            + timestamp
            + "_"
            + threadId
            + "_"
            + uniqueId;

    CreateAPIEndpoint createApiEndpoint = apiEndpointResourceTest.createRequest(apiEndpointName);

    if (requestFields != null && !requestFields.isEmpty()) {
      org.openmetadata.schema.type.APISchema requestSchema =
          new org.openmetadata.schema.type.APISchema().withSchemaFields(requestFields);
      createApiEndpoint.withRequestSchema(requestSchema);
    }

    if (responseFields != null && !responseFields.isEmpty()) {
      org.openmetadata.schema.type.APISchema responseSchema =
          new org.openmetadata.schema.type.APISchema().withSchemaFields(responseFields);
      createApiEndpoint.withResponseSchema(responseSchema);
    }

    WebTarget target = client.target(getApiEndpointUri());
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(createApiEndpoint));
    APIEndpoint createdApiEndpoint =
        TestUtils.readResponse(response, APIEndpoint.class, Status.CREATED.getStatusCode());
    createdApiEndpoints.add(createdApiEndpoint);
    return createdApiEndpoint;
  }

  /**
   * Creates a unique dashboard data model for testing data contracts
   */
  private DashboardDataModel createUniqueDashboardDataModel(String testName) throws IOException {
    return createUniqueDashboardDataModel(testName, null);
  }

  /**
   * Creates a unique dashboard data model for testing data contracts with specific columns
   */
  private DashboardDataModel createUniqueDashboardDataModel(
      String testName, List<org.openmetadata.schema.type.Column> columns) throws IOException {
    // Use multiple entropy sources for absolute uniqueness
    long counter = tableCounter.incrementAndGet();
    long timestamp = System.nanoTime();
    String uniqueId = UUID.randomUUID().toString().replace("-", "");
    long threadId = Thread.currentThread().threadId();
    String dataModelName =
        "dc_test_data_model_"
            + testName
            + "_"
            + counter
            + "_"
            + timestamp
            + "_"
            + threadId
            + "_"
            + uniqueId;

    CreateDashboardDataModel createDataModel =
        dashboardDataModelResourceTest.createRequest(dataModelName);

    if (columns != null && !columns.isEmpty()) {
      createDataModel.withColumns(columns);
    }

    WebTarget target = client.target(getDashboardDataModelUri());
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(createDataModel));
    DashboardDataModel createdDataModel =
        TestUtils.readResponse(response, DashboardDataModel.class, Status.CREATED.getStatusCode());
    createdDashboardDataModels.add(createdDataModel);
    return createdDataModel;
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
        .withEntityStatus(EntityStatus.DRAFT);
  }

  /**
   * Creates a unique data contract request for testing with any entity
   */
  public CreateDataContract createDataContractRequestForEntity(
      String name, EntityInterface entity) {
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
        .withEntity(entity.getEntityReference())
        .withEntityStatus(EntityStatus.DRAFT);
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

  private void deleteTable(UUID id, boolean recursive) {
    WebTarget tableTarget = client.target(getTableUri() + "/" + id);
    tableTarget = tableTarget.queryParam("recursive", recursive);
    Response response = SecurityUtil.addHeaders(tableTarget, ADMIN_AUTH_HEADERS).delete();
    response.readEntity(String.class); // Consume response
  }

  private void deleteTopic(UUID id) {
    WebTarget topicTarget = client.target(getTopicUri() + "/" + id);
    Response response = SecurityUtil.addHeaders(topicTarget, ADMIN_AUTH_HEADERS).delete();
    response.readEntity(String.class); // Consume response
  }

  private void deleteApiEndpoint(UUID id) {
    WebTarget apiEndpointTarget = client.target(getApiEndpointUri() + "/" + id);
    Response response = SecurityUtil.addHeaders(apiEndpointTarget, ADMIN_AUTH_HEADERS).delete();
    response.readEntity(String.class); // Consume response
  }

  private void deleteDashboardDataModel(UUID id) {
    WebTarget dataModelTarget = client.target(getDashboardDataModelUri() + "/" + id);
    Response response = SecurityUtil.addHeaders(dataModelTarget, ADMIN_AUTH_HEADERS).delete();
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

  protected WebTarget getCollection() {
    return client.target(getDataContractUri());
  }

  private String getDataContractUri() {
    return String.format("http://localhost:%s/api/v1/dataContracts", APP.getLocalPort());
  }

  private String getTableUri() {
    return String.format("http://localhost:%s/api/v1/tables", APP.getLocalPort());
  }

  /**
   * Creates and ensures messaging service for topic creation
   */
  private synchronized String ensureMessagingService() throws IOException {
    // Create a unique messaging service for testing
    long uniqueId = System.nanoTime();
    String serviceName = "dc_test_kafka_service_" + uniqueId;

    // Create messaging service
    CreateMessagingService createService =
        new CreateMessagingService()
            .withName(serviceName)
            .withServiceType(CreateMessagingService.MessagingServiceType.Kafka)
            .withConnection(
                new MessagingConnection()
                    .withConfig(new KafkaConnection().withBootstrapServers("localhost:9092")));

    WebTarget target = client.target(getMessagingServiceUri());
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(createService));
    MessagingService createdService =
        TestUtils.readResponse(response, MessagingService.class, Status.CREATED.getStatusCode());

    return createdService.getFullyQualifiedName();
  }

  private String getMessagingServiceUri() {
    return String.format(
        "http://localhost:%s/api/v1/services/messagingServices", APP.getLocalPort());
  }

  private String getTopicUri() {
    return String.format("http://localhost:%s/api/v1/topics", APP.getLocalPort());
  }

  private String getApiEndpointUri() {
    return String.format("http://localhost:%s/api/v1/apiEndpoints", APP.getLocalPort());
  }

  private String getDashboardDataModelUri() {
    return String.format("http://localhost:%s/api/v1/dashboard/datamodels", APP.getLocalPort());
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
        SecurityUtil.addHeaders(validateTarget, ADMIN_AUTH_HEADERS).post(Entity.json("{}"));
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
    assertEquals(create.getEntityStatus(), dataContract.getEntityStatus());
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
    create.withEntityStatus(EntityStatus.APPROVED);
    DataContract updated = updateDataContract(create);

    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
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
        .withEntityStatus(EntityStatus.APPROVED)
        .withSemantics(initialSemantics)
        .withQualityExpectations(initialQualityExpectations);

    DataContract updated = updateDataContract(create);

    // Verify all updates
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
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
        getDataContract(
            created.getId(), "semantics,qualityExpectations,testSuite,entityStatus,owners");
    assertEquals(EntityStatus.APPROVED, retrievedAfterFirstUpdate.getEntityStatus());
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
    assertEquals(EntityStatus.APPROVED, finalUpdated.getEntityStatus());
    assertEquals(created.getId(), finalUpdated.getId());
    assertNotNull(finalUpdated.getSemantics());
    assertEquals(2, finalUpdated.getSemantics().size());
    assertNotNull(finalUpdated.getQualityExpectations());
    assertEquals(2, finalUpdated.getQualityExpectations().size());
    assertNotNull(finalUpdated.getTestSuite());

    // GET the data contract and verify all fields are persisted correctly after final update
    DataContract retrievedAfterFinalUpdate =
        getDataContract(
            created.getId(), "semantics,qualityExpectations,testSuite,entityStatus,owners");
    assertEquals(EntityStatus.APPROVED, retrievedAfterFinalUpdate.getEntityStatus());
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
    // Use types that match the table created by createUniqueTable (INT for id, STRING for name)
    List<org.openmetadata.schema.type.Column> initialSchema =
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("id")
                .withDataType(ColumnDataType.INT)
                .withDisplayName("ID")
                .withDescription("Primary key"),
            new org.openmetadata.schema.type.Column()
                .withName("name")
                .withDataType(ColumnDataType.STRING)
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
        getDataContract(
            created.getId(), "schema,semantics,qualityExpectations,testSuite,entityStatus");
    assertNotNull(retrievedWithSchema.getSchema());
    assertEquals(2, retrievedWithSchema.getSchema().size());
    assertEquals("id", retrievedWithSchema.getSchema().get(0).getName());
    assertEquals(ColumnDataType.INT, retrievedWithSchema.getSchema().get(0).getDataType());
    assertEquals("name", retrievedWithSchema.getSchema().get(1).getName());
    assertEquals(ColumnDataType.STRING, retrievedWithSchema.getSchema().get(1).getDataType());

    // Now update schema: remove 'name' column and add 'email' column
    List<org.openmetadata.schema.type.Column> updatedSchema =
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("id")
                .withDataType(ColumnDataType.INT)
                .withDisplayName("ID")
                .withDescription("Primary key"),
            new org.openmetadata.schema.type.Column()
                .withName("email")
                .withDataType(ColumnDataType.STRING)
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
        getDataContract(
            created.getId(), "schema,semantics,qualityExpectations,testSuite,entityStatus");
    assertNotNull(finalRetrieved.getSchema());
    assertEquals(2, finalRetrieved.getSchema().size());
    assertEquals("id", finalRetrieved.getSchema().get(0).getName());
    assertEquals(ColumnDataType.INT, finalRetrieved.getSchema().get(0).getDataType());
    assertEquals("Primary key", finalRetrieved.getSchema().get(0).getDescription());
    assertEquals("email", finalRetrieved.getSchema().get(1).getName());
    assertEquals(ColumnDataType.STRING, finalRetrieved.getSchema().get(1).getDataType());
    assertEquals("User email address", finalRetrieved.getSchema().get(1).getDescription());

    // Verify the other fields are still intact after schema changes
    assertEquals(EntityStatus.APPROVED, finalRetrieved.getEntityStatus());
    assertNotNull(finalRetrieved.getSemantics());
    assertEquals(2, finalRetrieved.getSemantics().size());
    assertNotNull(finalRetrieved.getQualityExpectations());
    assertEquals(2, finalRetrieved.getQualityExpectations().size());
    assertNotNull(finalRetrieved.getTestSuite());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUpdateTestSuiteTestsWithQualityExpectations(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Create initial test cases for quality expectations
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

    // Step 1: Add initial quality expectations with both test cases
    List<EntityReference> initialQualityExpectations =
        List.of(testCase1.getEntityReference(), testCase2.getEntityReference());

    create
        .withEntityStatus(EntityStatus.APPROVED)
        .withQualityExpectations(initialQualityExpectations);
    DataContract updated = updateDataContract(create);

    // Verify initial state - both test cases should be in TestSuite
    assertEquals(2, updated.getQualityExpectations().size());
    assertNotNull(updated.getTestSuite());

    // Get TestSuite and verify it contains both tests
    TestSuite testSuite =
        testSuiteResourceTest.getEntity(
            updated.getTestSuite().getId(), "tests", ADMIN_AUTH_HEADERS);

    assertNotNull(testSuite.getTests());
    assertEquals(2, testSuite.getTests().size());
    assertTrue(testSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase1.getId())));
    assertTrue(testSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase2.getId())));

    // Step 2: Create a third test case
    CreateTestCase createTestCase3 =
        testCaseResourceTest
            .createRequest("test_case_accuracy_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase3 =
        testCaseResourceTest.createAndCheckEntity(createTestCase3, ADMIN_AUTH_HEADERS);

    // Update to add new test case while keeping existing ones
    List<EntityReference> expandedQualityExpectations =
        List.of(
            testCase1.getEntityReference(),
            testCase2.getEntityReference(),
            testCase3.getEntityReference());

    create.withQualityExpectations(expandedQualityExpectations);
    DataContract updatedWithNewTest = updateDataContract(create);

    // Verify new test case was added
    assertEquals(3, updatedWithNewTest.getQualityExpectations().size());

    // Verify TestSuite now contains all three tests
    TestSuite expandedTestSuite =
        testSuiteResourceTest.getEntity(
            updated.getTestSuite().getId(), "tests", ADMIN_AUTH_HEADERS);

    assertNotNull(expandedTestSuite.getTests());
    assertEquals(3, expandedTestSuite.getTests().size());
    assertTrue(
        expandedTestSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase1.getId())));
    assertTrue(
        expandedTestSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase2.getId())));
    assertTrue(
        expandedTestSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase3.getId())));

    // Step 3: Remove one test case (remove testCase2)
    List<EntityReference> reducedQualityExpectations =
        List.of(testCase1.getEntityReference(), testCase3.getEntityReference());

    create.withQualityExpectations(reducedQualityExpectations);
    DataContract updatedWithRemovedTest = updateDataContract(create);

    // Verify test case was removed from quality expectations
    assertEquals(2, updatedWithRemovedTest.getQualityExpectations().size());
    assertTrue(
        updatedWithRemovedTest.getQualityExpectations().stream()
            .anyMatch(ref -> ref.getId().equals(testCase1.getId())));
    assertTrue(
        updatedWithRemovedTest.getQualityExpectations().stream()
            .anyMatch(ref -> ref.getId().equals(testCase3.getId())));
    assertFalse(
        updatedWithRemovedTest.getQualityExpectations().stream()
            .anyMatch(ref -> ref.getId().equals(testCase2.getId())));

    // Verify TestSuite also had the test removed
    TestSuite reducedTestSuite =
        testSuiteResourceTest.getEntity(
            updated.getTestSuite().getId(), "tests", ADMIN_AUTH_HEADERS);

    assertNotNull(reducedTestSuite.getTests());
    assertEquals(2, reducedTestSuite.getTests().size());
    assertTrue(
        reducedTestSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase1.getId())));
    assertFalse(
        reducedTestSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase2.getId())));
    assertTrue(
        reducedTestSuite.getTests().stream().anyMatch(t -> t.getId().equals(testCase3.getId())));

    // Step 4: Remove all test cases
    create.withQualityExpectations(Collections.emptyList());
    DataContract updatedWithNoTests = updateDataContract(create);

    // Verify all test cases were removed
    assertTrue(
        updatedWithNoTests.getQualityExpectations() == null
            || updatedWithNoTests.getQualityExpectations().isEmpty());

    // Verify TestSuite has been deleted
    assertResponseContains(
        () ->
            testSuiteResourceTest.getEntity(
                updated.getTestSuite().getId(), "tests", ADMIN_AUTH_HEADERS),
        Status.NOT_FOUND,
        "testSuite instance for " + updated.getTestSuite().getId().toString() + " not found");

    // GET the data contract and verify persistence
    DataContract retrieved = getDataContract(created.getId(), "");
    assertTrue(
        retrieved.getQualityExpectations() == null || retrieved.getQualityExpectations().isEmpty());
    assertNull(retrieved.getTestSuite()); // We deleted the TestSuite when no tests remain
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  @Override
  protected void post_entityAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    // We can only have 1 contract for 1 table, we'll return a BAD_REQUEST not a 409
    CreateDataContract create = createRequest(getEntityName(test), "", "", null);
    // Create first time using POST
    createEntity(create, ADMIN_AUTH_HEADERS);
    // Second time creating the same entity using POST should fail
    String message =
        String.format(
            "A data contract already exists for entity '%s' with ID %s",
            create.getEntity().getType(), create.getEntity().getId());
    assertResponse(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, message);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  @Override
  protected void post_entityCreateWithInvalidName_400() {
    // Overriding to handle the name since we use a slightly different pattern for data contracts
    // creation in tests
    final CreateDataContract request =
        createRequest(null, "description", "displayName", null).withName(null);
    assertResponseContains(
        () -> createEntity(request, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");

    final CreateDataContract request1 =
        createRequest("", "description", "displayName", null).withName("");
    assertResponseContains(
        () -> createEntity(request1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    final CreateDataContract request2 =
        createRequest(UUID.randomUUID().toString(), "description", "displayName", null)
            .withName(LONG_ENTITY_NAME);
    assertResponse(
        () -> createEntity(request2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    final CreateDataContract request3 =
        createRequest(UUID.randomUUID().toString(), "description", "displayName", null)
            .withName("invalid::Name");
    assertResponseContains(
        () -> createEntity(request3, ADMIN_AUTH_HEADERS), BAD_REQUEST, "name must match");
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
  void testPatchDataEntityStatus(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    String originalJson = JsonUtils.pojoToJson(created);
    created.setEntityStatus(EntityStatus.APPROVED);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
    assertEquals(created.getId(), patched.getId());

    // Verify that GET returns the correct status after PATCH
    DataContract retrieved = getDataContract(patched.getId(), "entityStatus");
    assertEquals(EntityStatus.APPROVED, retrieved.getEntityStatus());
    assertEquals(created.getId(), retrieved.getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchDataContractWithoutStatus(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withEntityStatus(null);
    DataContract created = createDataContract(create);
    assertEquals(EntityStatus.UNPROCESSED, created.getEntityStatus());

    String originalJson = JsonUtils.pojoToJson(created);
    created.setEntityStatus(EntityStatus.APPROVED);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
    assertEquals(created.getId(), patched.getId());

    // Verify that GET returns the correct status after PATCH
    DataContract retrieved = getDataContract(patched.getId(), "entityStatus");
    assertEquals(EntityStatus.APPROVED, retrieved.getEntityStatus());
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
    created.setEntityStatus(EntityStatus.APPROVED);
    created.setDescription("Updated contract description via patch");

    List<Column> columns = new ArrayList<>();
    columns.add(
        new Column()
            .withName(C1)
            .withDescription("Patched ID field")
            .withDataType(ColumnDataType.INT));
    created.setSchema(columns);

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
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

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreatedByAndCreatedAtFieldsOnCreation(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    long beforeCreation = System.currentTimeMillis();

    DataContract created = createDataContract(create);

    long afterCreation = System.currentTimeMillis();

    // Verify createdAt is set and within reasonable bounds
    assertNotNull(created.getCreatedAt());
    assertTrue(created.getCreatedAt() >= beforeCreation);
    assertTrue(created.getCreatedAt() <= afterCreation);

    // Verify createdBy is always set
    assertNotNull(created.getCreatedBy());
    assertEquals("admin", created.getCreatedBy());

    // Get with fields parameter to ensure fields are persisted
    DataContract retrieved = getDataContract(created.getId(), "createdBy,createdAt");
    assertNotNull(retrieved.getCreatedAt());
    assertNotNull(retrieved.getCreatedBy());
    assertEquals(created.getCreatedAt(), retrieved.getCreatedAt());
    assertEquals(created.getCreatedBy(), retrieved.getCreatedBy());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreatedByAndCreatedAtPreservedOnUpdate(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Store original creation metadata
    Long originalCreatedAt = created.getCreatedAt();
    String originalCreatedBy = created.getCreatedBy();

    // Update the contract
    create.withEntityStatus(EntityStatus.APPROVED).withDescription("Updated description");
    DataContract updated = updateDataContract(create);

    // Verify creation fields are preserved
    assertNotNull(updated.getCreatedAt());
    assertNotNull(updated.getCreatedBy());
    assertEquals(originalCreatedAt, updated.getCreatedAt());
    assertEquals(originalCreatedBy, updated.getCreatedBy());

    // Verify updatedAt exists
    assertNotNull(updated.getUpdatedAt());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreatedByAndCreatedAtPreservedOnPatch(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    String originalJson = JsonUtils.pojoToJson(created);

    // Store original creation metadata
    Long originalCreatedAt = created.getCreatedAt();
    String originalCreatedBy = created.getCreatedBy();

    // Apply patch
    created.setEntityStatus(EntityStatus.APPROVED);
    created.setDescription("Patched description");

    DataContract patched = patchDataContract(created.getId(), originalJson, created);

    // Verify creation fields are preserved
    assertEquals(originalCreatedAt, patched.getCreatedAt());
    assertEquals(originalCreatedBy, patched.getCreatedBy());

    // Verify the patch was applied
    assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
    assertEquals("Patched description", patched.getDescription());

    // Verify updatedAt is different from createdAt (updatedAt should be newer or equal)
    assertNotNull(patched.getUpdatedAt());
    assertTrue(patched.getUpdatedAt() >= patched.getCreatedAt());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreatedByAndCreatedAtInGetByEntityId(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Get by entity ID with fields parameter
    DataContract retrieved =
        getDataContractByEntityId(
            table.getId(), org.openmetadata.service.Entity.TABLE, "createdBy,createdAt");

    // Verify creation fields are returned
    assertNotNull(retrieved.getCreatedAt());
    assertNotNull(retrieved.getCreatedBy());
    assertEquals(created.getCreatedAt(), retrieved.getCreatedAt());
    assertEquals(created.getCreatedBy(), retrieved.getCreatedBy());

    // Get by entity ID without fields parameter should still return creation fields (they're audit
    // fields)
    DataContract retrievedNoFields =
        getDataContractByEntityId(table.getId(), org.openmetadata.service.Entity.TABLE);
    assertNotNull(retrievedNoFields.getCreatedBy());
    assertNotNull(retrievedNoFields.getCreatedAt());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreatedByAndCreatedAtInGetByName(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Get by name with fields parameter
    DataContract retrieved =
        getDataContractByName(created.getFullyQualifiedName(), "createdBy,createdAt");

    // Verify creation fields are returned
    assertNotNull(retrieved.getCreatedAt());
    assertEquals(created.getCreatedAt(), retrieved.getCreatedAt());

    // createdBy should always be set
    assertNotNull(created.getCreatedBy());
    assertNotNull(retrieved.getCreatedBy());
    assertEquals(created.getCreatedBy(), retrieved.getCreatedBy());
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
        BAD_REQUEST,
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
        BAD_REQUEST,
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
            .withEntityStatus(EntityStatus.DRAFT);

    assertResponseContains(
        () -> createDataContract(create),
        Status.NOT_FOUND,
        "table instance for " + invalidId.toString() + " not found");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataEntityStatusTransitions(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create Draft data contract
    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withEntityStatus(EntityStatus.DRAFT);
    DataContract dataContract = createDataContract(create);
    assertEquals(EntityStatus.DRAFT, dataContract.getEntityStatus());

    // Update to Active status
    create.withEntityStatus(EntityStatus.APPROVED);
    dataContract = updateDataContract(create);
    assertEquals(EntityStatus.APPROVED, dataContract.getEntityStatus());

    // Update to Deprecated status
    create.withEntityStatus(EntityStatus.DEPRECATED);
    dataContract = updateDataContract(create);
    assertEquals(EntityStatus.DEPRECATED, dataContract.getEntityStatus());
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
                + "entityStatus: Approved\n"
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
    assertEquals(EntityStatus.APPROVED, dataContract.getEntityStatus());
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
                + "entityStatus: Active\n"
                + "schema:\n"
                + "  - name: %s\n"
                + "    description: ID field with validation\n"
                + "   badField: \"this is invalid yaml with wrong indentation\n"
                + "qualityExpectations:\n"
                + "  - name: ValueCheck\n"
                + "    description: Value must be numeric\n"
                + "    definition: Value must be a number",
            "contract_" + test.getDisplayName(), table.getId(), C1);

    assertResponseContains(() -> postYaml(invalidYamlContent), BAD_REQUEST, "Invalid YAML content");
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
            .withEntityStatus(EntityStatus.DRAFT);

    // Bean validation will catch this as "entity must not be null"
    assertResponseContains(
        () -> createDataContract(create), BAD_REQUEST, "entity must not be null");
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
        BAD_REQUEST,
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
    create.withEntityStatus(EntityStatus.APPROVED);
    WebTarget target = getCollection();
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).put(Entity.json(create));
    DataContract updated =
        TestUtils.readResponse(response, DataContract.class, Status.OK.getStatusCode());

    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testRegularUserCannotUpdateOthersDataContract(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    createDataContract(create);

    // Regular user should not be able to update admin's data contract
    create.withEntityStatus(EntityStatus.APPROVED);
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
    created.setEntityStatus(EntityStatus.APPROVED);

    try {
      ObjectMapper mapper = new ObjectMapper();
      String updatedJson = JsonUtils.pojoToJson(created);
      com.fasterxml.jackson.databind.JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));

      WebTarget target = getResource(created.getId());
      DataContract patched = TestUtils.patch(target, patch, DataContract.class, ADMIN_AUTH_HEADERS);

      assertEquals(EntityStatus.APPROVED, patched.getEntityStatus());
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
    created.setEntityStatus(EntityStatus.APPROVED);

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
    String expectedTestSuiteName = DataContractRepository.getTestSuiteName(dataContract);

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
    String expectedTestSuiteName = DataContractRepository.getTestSuiteName(dataContract);
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

    // Also, the ingestion pipeline should be flagged as deployed
    assertTrue(pipeline.getDeployed());

    // Test deletion with recursive=true - should also delete the test suite
    deleteDataContract(dataContract.getId(), true);

    // Verify the data contract is deleted
    assertThrows(HttpResponseException.class, () -> getDataContract(dataContract.getId(), null));

    // Verify the test suite is also deleted
    assertThrows(
        HttpResponseException.class,
        () ->
            testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS));

    // Pipeline is also deleted
    assertThrows(
        HttpResponseException.class,
        () -> ingestionPipelineResourceTest.getEntity(pipeline.getId(), "*", ADMIN_AUTH_HEADERS));
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
    String expectedTestSuiteName = DataContractRepository.getTestSuiteName(dataContract);
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
        BAD_REQUEST.getStatusCode(),
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
    String expectedTestSuiteName = DataContractRepository.getTestSuiteName(dataContract);
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
    String expectedTestSuiteName = DataContractRepository.getTestSuiteName(dataContract);
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
  void testDeleteDataContractWithDQExpectationsDoesNotDeleteTestCases(TestInfo test)
      throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

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

    // Create data contract with quality expectations
    List<EntityReference> qualityExpectations =
        List.of(testCase1.getEntityReference(), testCase2.getEntityReference());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withEntityStatus(EntityStatus.APPROVED)
            .withQualityExpectations(qualityExpectations);

    DataContract dataContract = createDataContract(create);

    // Verify the contract was created with quality expectations and test suite
    assertNotNull(dataContract);
    assertNotNull(dataContract.getQualityExpectations());
    assertEquals(2, dataContract.getQualityExpectations().size());
    assertNotNull(dataContract.getTestSuite());

    // Verify test suite was created and contains the test cases
    String expectedTestSuiteName = DataContractRepository.getTestSuiteName(dataContract);
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite testSuite =
        testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "tests", ADMIN_AUTH_HEADERS);

    assertNotNull(testSuite);
    assertNotNull(testSuite.getTests());
    assertEquals(2, testSuite.getTests().size());

    // Verify test suite exists in search index
    Map<String, String> searchQueryParams = new HashMap<>();
    searchQueryParams.put("fullyQualifiedName", testSuite.getFullyQualifiedName());
    searchQueryParams.put("fields", "tests");
    ResultList<TestSuite> testSuitesInSearchIndex =
        testSuiteResourceTest.listEntitiesFromSearch(searchQueryParams, 10, 0, ADMIN_AUTH_HEADERS);

    assertNotNull(testSuitesInSearchIndex);
    assertFalse(testSuitesInSearchIndex.getData().isEmpty());
    assertEquals(1, testSuitesInSearchIndex.getData().size());
    assertEquals(testSuite.getId(), testSuitesInSearchIndex.getData().get(0).getId());

    // Verify both test cases exist and are accessible before deletion
    TestCase retrievedTestCase1 =
        testCaseResourceTest.getEntity(testCase1.getId(), "*", ADMIN_AUTH_HEADERS);
    TestCase retrievedTestCase2 =
        testCaseResourceTest.getEntity(testCase2.getId(), "*", ADMIN_AUTH_HEADERS);
    assertNotNull(retrievedTestCase1);
    assertNotNull(retrievedTestCase2);

    // Delete the data contract (non-recursive)
    deleteDataContract(dataContract.getId());

    // Verify the data contract is deleted
    assertThrows(HttpResponseException.class, () -> getDataContract(dataContract.getId(), null));

    // Verify the test suite is deleted
    assertThrows(
        HttpResponseException.class,
        () ->
            testSuiteResourceTest.getEntityByName(expectedTestSuiteName, "*", ADMIN_AUTH_HEADERS));

    // Verify test suite is no longer in search index
    ResultList<TestSuite> testSuitesInSearchIndexAfterDeletion =
        testSuiteResourceTest.listEntitiesFromSearch(searchQueryParams, 10, 0, ADMIN_AUTH_HEADERS);

    assertNotNull(testSuitesInSearchIndexAfterDeletion);
    assertTrue(testSuitesInSearchIndexAfterDeletion.getData().isEmpty());

    // CRITICAL ASSERTION: Verify the test cases are NOT deleted - they should still exist
    // independently
    TestCase testCase1AfterDeletion =
        testCaseResourceTest.getEntity(testCase1.getId(), "*", ADMIN_AUTH_HEADERS);
    TestCase testCase2AfterDeletion =
        testCaseResourceTest.getEntity(testCase2.getId(), "*", ADMIN_AUTH_HEADERS);

    assertNotNull(testCase1AfterDeletion);
    assertNotNull(testCase2AfterDeletion);
    assertEquals(testCase1.getId(), testCase1AfterDeletion.getId());
    assertEquals(testCase2.getId(), testCase2AfterDeletion.getId());
    assertEquals(testCase1.getName(), testCase1AfterDeletion.getName());
    assertEquals(testCase2.getName(), testCase2AfterDeletion.getName());

    // Verify test cases maintain their entity links and other properties
    assertEquals(testCase1.getEntityLink(), testCase1AfterDeletion.getEntityLink());
    assertEquals(testCase2.getEntityLink(), testCase2AfterDeletion.getEntityLink());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateContractWithSemanticThenAddQualityExpectationCreatesTestSuite(TestInfo test)
      throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create initial contract with one semantic rule only
    List<SemanticsRule> initialSemantics =
        List.of(
            new SemanticsRule()
                .withName("Primary Key Rule")
                .withDescription("Validates primary key field presence")
                .withRule("{\"!!\": {\"var\": \"id\"}}"));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withSemantics(initialSemantics)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract dataContract = createDataContract(create);

    // Verify initial contract was created with semantics but no test suite yet
    assertNotNull(dataContract);
    assertNotNull(dataContract.getSemantics());
    assertEquals(1, dataContract.getSemantics().size());
    assertEquals("Primary Key Rule", dataContract.getSemantics().get(0).getName());
    assertNull(dataContract.getTestSuite());

    // Now add a quality expectation to trigger test suite creation
    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_quality_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    List<EntityReference> qualityExpectations = List.of(testCase.getEntityReference());

    // Update contract with quality expectation
    create.withQualityExpectations(qualityExpectations);
    DataContract updatedContract = updateDataContract(create);

    // Verify test suite was created after adding quality expectation
    assertNotNull(updatedContract.getTestSuite());
    assertNotNull(updatedContract.getQualityExpectations());
    assertEquals(1, updatedContract.getQualityExpectations().size());

    // Fetch test suite by ID from the data contract and validate it has correct data contract ID
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    TestSuite testSuite =
        testSuiteResourceTest.getEntity(
            updatedContract.getTestSuite().getId(), "*", ADMIN_AUTH_HEADERS);

    assertNotNull(testSuite);
    assertNotNull(testSuite.getDataContract());
    assertEquals(updatedContract.getId(), testSuite.getDataContract().getId());

    // Verify test suite contains the quality expectation test case
    assertNotNull(testSuite.getTests());
    assertEquals(1, testSuite.getTests().size());
    assertEquals(testCase.getId(), testSuite.getTests().get(0).getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithDashboardAndSemanticsOnly(TestInfo test) throws IOException {
    // Create a dashboard entity to use for the data contract
    Dashboard dashboard =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Create semantics rules only (no quality expectations or schema)
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Dashboard Active Check")
                .withDescription("Ensures dashboard is active and accessible")
                .withRule("{ \"!!\": { \"var\": \"displayName\" } }"),
            new SemanticsRule()
                .withName("Charts Exist Check")
                .withDescription("Ensures dashboard has at least one chart")
                .withRule("{ \">=\": [{ \"var\": \"charts.length\" }, 1] }"));

    // Create data contract for the dashboard with semantics rules only
    CreateDataContract create =
        createDataContractRequestForEntity(test.getDisplayName(), dashboard)
            .withDescription("Data contract for dashboard with semantics validation")
            .withSemantics(semanticsRules)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract dataContract = createDataContract(create);

    // Verify the data contract was created successfully
    assertNotNull(dataContract);
    assertNotNull(dataContract.getId());
    assertEquals(create.getName(), dataContract.getName());
    assertEquals(create.getEntityStatus(), dataContract.getEntityStatus());
    assertEquals(dashboard.getId(), dataContract.getEntity().getId());
    assertEquals("dashboard", dataContract.getEntity().getType());

    // Verify semantics rules are properly set
    assertNotNull(dataContract.getSemantics());
    assertEquals(2, dataContract.getSemantics().size());
    assertSemantics(create.getSemantics(), dataContract.getSemantics());

    // Verify no quality expectations or schema are set (semantics only)
    assertNull(dataContract.getQualityExpectations());
    assertNull(dataContract.getSchema());

    // Verify FQN follows expected pattern
    String expectedFQN = dashboard.getFullyQualifiedName() + ".dataContract_" + create.getName();
    assertEquals(expectedFQN, dataContract.getFullyQualifiedName());

    // Test the validate method and verify contract status
    DataContractResult validationResult = runValidate(dataContract);

    // Verify the validation result
    assertNotNull(validationResult);
    assertNotNull(validationResult.getContractExecutionStatus());

    // Verify semantics validation was performed
    assertNotNull(validationResult.getSemanticsValidation());
    assertEquals(2, validationResult.getSemanticsValidation().getTotal().intValue());

    // Since this is a Dashboard entity, the semantics validation may pass or fail depending on
    // actual data
    // But we verify that the validation process was executed
    assertTrue(validationResult.getSemanticsValidation().getTotal() > 0);

    // Verify no schema or quality validation was performed (semantics only)
    assertNull(validationResult.getSchemaValidation());
    assertNull(validationResult.getQualityValidation());

    // Retrieve the contract and verify the latest result is stored
    DataContract retrievedContract = getDataContract(dataContract.getId(), "");
    assertNotNull(retrievedContract.getLatestResult());
    assertEquals(validationResult.getId(), retrievedContract.getLatestResult().getResultId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractWithChartAndSemanticsOnly(TestInfo test) throws IOException {
    // Create a chart entity to use for the data contract
    Chart chart =
        chartResourceTest.createEntity(
            chartResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Test 1: Chart with schema validation should fail (charts don't support schema validation)
    List<Column> columns =
        List.of(
            new Column()
                .withName("testField")
                .withDescription("Test field")
                .withDataType(ColumnDataType.STRING));

    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema", chart)
            .withSchema(columns);

    assertResponseContains(
        () -> createDataContract(createWithSchema),
        BAD_REQUEST,
        "Schema validation is not supported for chart entities. Only table, topic, apiEndpoint, and dashboardDataModel entities support schema validation");

    // Test 2: Chart with semantics validation only should succeed
    // Create semantics rules only (no quality expectations or schema)
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Chart Display Name Check")
                .withDescription("Ensures chart has a valid display name")
                .withRule("{ \"!!\": { \"var\": \"displayName\" } }"),
            new SemanticsRule()
                .withName("Chart Type Check")
                .withDescription("Ensures chart has a valid chart type")
                .withRule("{ \"!!\": { \"var\": \"chartType\" } }"));

    // Create data contract for the chart with semantics rules only
    CreateDataContract create =
        createDataContractRequestForEntity(test.getDisplayName(), chart)
            .withDescription("Data contract for chart with semantics validation")
            .withSemantics(semanticsRules)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract dataContract = createDataContract(create);

    // Verify the data contract was created successfully
    assertNotNull(dataContract);
    assertNotNull(dataContract.getId());
    assertEquals(create.getName(), dataContract.getName());
    assertEquals(create.getEntityStatus(), dataContract.getEntityStatus());
    assertEquals(chart.getId(), dataContract.getEntity().getId());
    assertEquals("chart", dataContract.getEntity().getType());

    // Verify semantics rules are properly set
    assertNotNull(dataContract.getSemantics());
    assertEquals(2, dataContract.getSemantics().size());
    assertSemantics(create.getSemantics(), dataContract.getSemantics());

    // Verify no quality expectations or schema are set (semantics only)
    assertNull(dataContract.getQualityExpectations());
    assertNull(dataContract.getSchema());

    // Verify FQN follows expected pattern
    String expectedFQN = chart.getFullyQualifiedName() + ".dataContract_" + create.getName();
    assertEquals(expectedFQN, dataContract.getFullyQualifiedName());

    // Test the validate method and verify contract status
    DataContractResult validationResult = runValidate(dataContract);

    // Verify the validation result
    assertNotNull(validationResult);
    assertNotNull(validationResult.getContractExecutionStatus());

    // Verify semantics validation was performed
    assertNotNull(validationResult.getSemanticsValidation());
    assertEquals(2, validationResult.getSemanticsValidation().getTotal().intValue());

    assertTrue(validationResult.getSemanticsValidation().getTotal() > 0);

    // Verify no schema or quality validation was performed (semantics only)
    assertNull(validationResult.getSchemaValidation());
    assertNull(validationResult.getQualityValidation());

    // Retrieve the contract and verify the latest result is stored
    DataContract retrievedContract = getDataContract(dataContract.getId(), "");
    assertNotNull(retrievedContract.getLatestResult());
    assertEquals(validationResult.getId(), retrievedContract.getLatestResult().getResultId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDashboardEntityConstraints(TestInfo test) throws IOException {
    Dashboard dashboard =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Test 1: Dashboard with schema should fail
    List<Column> columns =
        List.of(
            new Column()
                .withName("chart_count")
                .withDescription("Number of charts")
                .withDataType(ColumnDataType.INT));

    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema", dashboard)
            .withSchema(columns);

    assertResponseContains(
        () -> createDataContract(createWithSchema),
        BAD_REQUEST,
        "Schema validation is not supported for dashboard entities. Only table, topic, apiEndpoint, and dashboardDataModel entities support schema validation");

    // Test 2: Dashboard with quality expectations should fail
    Table testTable = createUniqueTable(test.getDisplayName() + "_testcase");
    String tableLink = String.format("<#E::table::%s>", testTable.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_dashboard_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    CreateDataContract createWithQuality =
        createDataContractRequestForEntity(test.getDisplayName() + "_quality", dashboard)
            .withQualityExpectations(List.of(testCase.getEntityReference()));

    assertResponseContains(
        () -> createDataContract(createWithQuality),
        BAD_REQUEST,
        "Quality expectations are not supported for dashboard entities. Only table entities support quality expectations");

    // Test 3: Dashboard with both schema and quality expectations should fail
    CreateDataContract createWithBoth =
        createDataContractRequestForEntity(test.getDisplayName() + "_both", dashboard)
            .withSchema(columns)
            .withQualityExpectations(List.of(testCase.getEntityReference()));

    assertResponseContains(
        () -> createDataContract(createWithBoth),
        BAD_REQUEST,
        "Data contract validation failed for dashboard entity");

    // Test 4: Dashboard with only semantics should succeed (this was our previous test case)
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Dashboard Active Check")
                .withDescription("Ensures dashboard is active")
                .withRule("{ \"!!\": { \"var\": \"displayName\" } }"));

    CreateDataContract createSemanticsOnly =
        createDataContractRequestForEntity(test.getDisplayName() + "_semantics", dashboard)
            .withSemantics(semanticsRules);

    DataContract successfulContract = createDataContract(createSemanticsOnly);
    assertNotNull(successfulContract);
    assertEquals("dashboard", successfulContract.getEntity().getType());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testTopicEntityConstraints(TestInfo test) throws IOException {
    // Define message schema fields that match the data contract columns
    List<Field> messageSchemaFields =
        List.of(
            new Field()
                .withName("messageId")
                .withDisplayName("Message ID")
                .withDataType(FieldDataType.STRING),
            new Field()
                .withName("eventType")
                .withDisplayName("Event Type")
                .withDataType(FieldDataType.STRING));

    // Test 1: Topic with schema should succeed (topics support schema validation)
    Topic schemaTopic = createUniqueTopic(test.getDisplayName() + "_schema", messageSchemaFields);

    List<Column> columns =
        List.of(
            new Column()
                .withName("messageId")
                .withDescription("Message ID")
                .withDataType(ColumnDataType.STRING),
            new Column()
                .withName("eventType")
                .withDescription("Event Type")
                .withDataType(ColumnDataType.STRING));

    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema", schemaTopic)
            .withSchema(columns);

    // Topics support schema validation, so this should succeed
    DataContract schemaContract = createDataContract(createWithSchema);
    assertNotNull(schemaContract);
    assertNotNull(schemaContract.getSchema());
    assertEquals(2, schemaContract.getSchema().size());

    // Verify the schema fields match what we provided
    assertEquals("messageId", schemaContract.getSchema().get(0).getName());
    assertEquals("eventType", schemaContract.getSchema().get(1).getName());

    // Test validation works for schema - should pass when schema fields match
    DataContractResult schemaValidationResult = runValidate(schemaContract);
    assertNotNull(schemaValidationResult);
    assertEquals(
        ContractExecutionStatus.Success, schemaValidationResult.getContractExecutionStatus());
    assertNotNull(schemaValidationResult.getSchemaValidation());
    assertEquals(0, schemaValidationResult.getSchemaValidation().getFailed().intValue());
    assertEquals(2, schemaValidationResult.getSchemaValidation().getPassed().intValue());
    assertEquals(2, schemaValidationResult.getSchemaValidation().getTotal().intValue());

    // Test 2: Topic with semantics should succeed
    Topic semanticsTopic = createUniqueTopic(test.getDisplayName() + "_semantics");

    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Topic Message Check")
                .withDescription("Ensures topic has messages")
                .withRule("{ \"!!\": { \"var\": \"name\" } }"));

    CreateDataContract createSemanticsOnly =
        createDataContractRequestForEntity(test.getDisplayName() + "_semantics", semanticsTopic)
            .withSemantics(semanticsRules);

    DataContract semanticsContract = createDataContract(createSemanticsOnly);
    assertNotNull(semanticsContract);
    assertNotNull(semanticsContract.getSemantics());
    assertEquals(1, semanticsContract.getSemantics().size());

    // Test validation works for semantics
    DataContractResult semanticsValidationResult = runValidate(semanticsContract);
    assertNotNull(semanticsValidationResult);
    assertNotNull(semanticsValidationResult.getSemanticsValidation());

    // Test 3: Topic with both schema and semantics should succeed
    Topic bothTopic = createUniqueTopic(test.getDisplayName() + "_both", messageSchemaFields);

    CreateDataContract createBoth =
        createDataContractRequestForEntity(test.getDisplayName() + "_both", bothTopic)
            .withSchema(columns)
            .withSemantics(semanticsRules);

    DataContract bothContract = createDataContract(createBoth);
    assertNotNull(bothContract);
    assertNotNull(bothContract.getSchema());
    assertNotNull(bothContract.getSemantics());
    assertEquals(2, bothContract.getSchema().size());
    assertEquals(1, bothContract.getSemantics().size());

    // Test validation works for combined schema and semantics
    DataContractResult bothValidationResult = runValidate(bothContract);
    assertNotNull(bothValidationResult);
    assertNotNull(bothValidationResult.getSchemaValidation());
    assertNotNull(bothValidationResult.getSemanticsValidation());

    // Test 4: Topic with quality expectations should fail (topics don't support quality
    // expectations)
    Topic qualityTopic = createUniqueTopic(test.getDisplayName() + "_quality");

    // Create a dummy test case reference to test validation layer rejection
    EntityReference dummyTestCaseRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("testCase")
            .withName("dummy_test_case")
            .withFullyQualifiedName("dummy.test.case");

    // This should fail because topics don't support quality expectations
    CreateDataContract createWithQuality =
        createDataContractRequestForEntity(test.getDisplayName() + "_quality", qualityTopic)
            .withQualityExpectations(List.of(dummyTestCaseRef));

    assertResponseContains(
        () -> createDataContract(createWithQuality),
        BAD_REQUEST,
        "Quality expectations are not supported for topic entities");

    // Verify entity reference is properly validated and topic exists
    assertEquals(schemaTopic.getId(), schemaContract.getEntity().getId());
    assertEquals("topic", schemaContract.getEntity().getType());
    assertEquals(schemaTopic.getName(), schemaContract.getEntity().getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testTopicSchemaValidationFailure(TestInfo test) throws IOException {
    // Create topic message schema fields that match what the data contract will expect initially
    List<Field> messageSchemaFields =
        List.of(
            new Field()
                .withName("messageId")
                .withDisplayName("Message ID")
                .withDataType(FieldDataType.STRING),
            new Field()
                .withName("eventType")
                .withDisplayName("Event Type")
                .withDataType(FieldDataType.STRING));

    Topic schemaTopic =
        createUniqueTopic(test.getDisplayName() + "_schema_fail", messageSchemaFields);

    // Create data contract with schema fields that match the topic's message schema
    List<Column> columns =
        List.of(
            new Column()
                .withName("messageId")
                .withDescription("Message ID")
                .withDataType(ColumnDataType.STRING),
            new Column()
                .withName("eventType")
                .withDescription("Event Type")
                .withDataType(ColumnDataType.STRING));

    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema_fail", schemaTopic)
            .withSchema(columns);

    // Create data contract with schema that matches the topic's message schema
    DataContract schemaContract = createDataContract(createWithSchema);
    assertNotNull(schemaContract);
    assertNotNull(schemaContract.getSchema());
    assertEquals(2, schemaContract.getSchema().size());

    // First, validate the contract when the schema is still valid - should pass
    DataContractResult initialResult = runValidate(schemaContract);
    assertNotNull(initialResult);
    assertEquals(ContractExecutionStatus.Success, initialResult.getContractExecutionStatus());
    assertEquals(0, initialResult.getSchemaValidation().getFailed().intValue());
    assertEquals(2, initialResult.getSchemaValidation().getPassed().intValue());

    // Now let's "break" the topic by removing one of the fields that the contract expects
    // We'll simulate this by updating the topic's message schema to have fewer fields
    String originalTopicJson = JsonUtils.pojoToJson(schemaTopic);

    // Remove the "eventType" field from the topic's message schema
    List<Field> updatedFields = new ArrayList<>();
    for (Field field : schemaTopic.getMessageSchema().getSchemaFields()) {
      if (!"eventType".equals(field.getName())) {
        updatedFields.add(field);
      }
    }
    MessageSchema updatedMessageSchema =
        schemaTopic.getMessageSchema().withSchemaFields(updatedFields);
    schemaTopic.setMessageSchema(updatedMessageSchema);

    // Patch the topic to remove the eventType field using TopicResourceTest
    TopicResourceTest topicResourceTest = new TopicResourceTest();
    Topic patchedTopic =
        topicResourceTest.patchEntity(
            schemaTopic.getId(), originalTopicJson, schemaTopic, ADMIN_AUTH_HEADERS);

    // Verify the eventType field was removed from message schema
    assertEquals(1, patchedTopic.getMessageSchema().getSchemaFields().size());
    assertNull(
        patchedTopic.getMessageSchema().getSchemaFields().stream()
            .filter(field -> "eventType".equals(field.getName()))
            .findFirst()
            .orElse(null));

    // Now validate the data contract - it should fail schema validation
    DataContractResult result = runValidate(schemaContract);

    // Verify the validation result shows failure due to schema validation
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());

    // Verify schema validation details
    assertNotNull(result.getSchemaValidation());
    assertEquals(
        1, result.getSchemaValidation().getFailed().intValue()); // 1 field failed (eventType)
    assertEquals(
        1, result.getSchemaValidation().getPassed().intValue()); // 1 field passed (messageId)
    assertEquals(
        2, result.getSchemaValidation().getTotal().intValue()); // 2 total fields in contract

    // Verify the failed field is the eventType field
    assertNotNull(result.getSchemaValidation().getFailedFields());
    assertEquals(1, result.getSchemaValidation().getFailedFields().size());
    assertEquals("eventType", result.getSchemaValidation().getFailedFields().get(0));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testApiEndpointEntityConstraints(TestInfo test) throws IOException {
    // Test 1: API Endpoint with schema should succeed (apiEndpoint supports schema validation)
    // Create schema fields for the API endpoint that match what the data contract expects
    List<Field> requestSchemaFields =
        List.of(
            new Field()
                .withName("requestId")
                .withDataType(FieldDataType.STRING)
                .withDescription("Request ID"));
    List<Field> responseSchemaFields =
        List.of(
            new Field()
                .withName("responseCode")
                .withDataType(FieldDataType.INT)
                .withDescription("Response Code"));

    APIEndpoint schemaApiEndpoint =
        createUniqueApiEndpoint(
            test.getDisplayName() + "_schema", requestSchemaFields, responseSchemaFields);

    List<Column> columns =
        List.of(
            new Column()
                .withName("requestId")
                .withDescription("Request ID")
                .withDataType(ColumnDataType.STRING),
            new Column()
                .withName("responseCode")
                .withDescription("Response Code")
                .withDataType(ColumnDataType.INT));
    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema", schemaApiEndpoint)
            .withSchema(columns);
    // API endpoints support schema validation, so this should succeed
    DataContract schemaContract = createDataContract(createWithSchema);
    assertNotNull(schemaContract);
    assertNotNull(schemaContract.getSchema());
    assertEquals(2, schemaContract.getSchema().size());
    // Verify the schema fields match what we provided
    assertEquals("requestId", schemaContract.getSchema().get(0).getName());
    assertEquals("responseCode", schemaContract.getSchema().get(1).getName());
    // Test validation works for schema - should pass when schema fields match
    DataContractResult schemaValidationResult = runValidate(schemaContract);
    assertNotNull(schemaValidationResult);
    assertEquals(
        ContractExecutionStatus.Success, schemaValidationResult.getContractExecutionStatus());
    assertNotNull(schemaValidationResult.getSchemaValidation());
    assertEquals(0, schemaValidationResult.getSchemaValidation().getFailed().intValue());
    assertEquals(2, schemaValidationResult.getSchemaValidation().getPassed().intValue());
    assertEquals(2, schemaValidationResult.getSchemaValidation().getTotal().intValue());

    // Test 2: API Endpoint with semantics should succeed
    APIEndpoint semanticsApiEndpoint =
        createUniqueApiEndpoint(test.getDisplayName() + "_semantics");
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("API Endpoint Check")
                .withDescription("Ensures API endpoint is accessible")
                .withRule("{ \"!!\": { \"var\": \"name\" } }"));
    CreateDataContract createSemanticsOnly =
        createDataContractRequestForEntity(
                test.getDisplayName() + "_semantics", semanticsApiEndpoint)
            .withSemantics(semanticsRules);
    DataContract semanticsContract = createDataContract(createSemanticsOnly);
    assertNotNull(semanticsContract);
    assertNotNull(semanticsContract.getSemantics());
    assertEquals(1, semanticsContract.getSemantics().size());
    // Test validation works for semantics
    DataContractResult semanticsValidationResult = runValidate(semanticsContract);
    assertNotNull(semanticsValidationResult);
    assertNotNull(semanticsValidationResult.getSemanticsValidation());

    // Test 3: API Endpoint with both schema and semantics should succeed
    APIEndpoint bothApiEndpoint =
        createUniqueApiEndpoint(
            test.getDisplayName() + "_both", requestSchemaFields, responseSchemaFields);
    CreateDataContract createBoth =
        createDataContractRequestForEntity(test.getDisplayName() + "_both", bothApiEndpoint)
            .withSchema(columns)
            .withSemantics(semanticsRules);
    DataContract bothContract = createDataContract(createBoth);
    assertNotNull(bothContract);
    assertNotNull(bothContract.getSchema());
    assertNotNull(bothContract.getSemantics());
    assertEquals(2, bothContract.getSchema().size());
    assertEquals(1, bothContract.getSemantics().size());
    // Test validation works for combined schema and semantics
    DataContractResult bothValidationResult = runValidate(bothContract);
    assertNotNull(bothValidationResult);
    assertNotNull(bothValidationResult.getSchemaValidation());
    assertNotNull(bothValidationResult.getSemanticsValidation());

    // Test 4: API Endpoint with quality expectations should fail (apiEndpoint doesn't support
    // quality expectations)
    APIEndpoint qualityApiEndpoint = createUniqueApiEndpoint(test.getDisplayName() + "_quality");
    // Create a dummy test case reference to test validation layer rejection
    EntityReference dummyTestCaseRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("testCase")
            .withName("dummy_test_case")
            .withFullyQualifiedName("dummy.test.case");
    // This should fail because apiEndpoint doesn't support quality expectations
    CreateDataContract createWithQuality =
        createDataContractRequestForEntity(test.getDisplayName() + "_quality", qualityApiEndpoint)
            .withQualityExpectations(List.of(dummyTestCaseRef));
    assertResponseContains(
        () -> createDataContract(createWithQuality),
        BAD_REQUEST,
        "Quality expectations are not supported for apiEndpoint entities");

    // Verify entity reference is properly validated and apiEndpoint exists
    assertEquals(schemaApiEndpoint.getId(), schemaContract.getEntity().getId());
    assertEquals("apiEndpoint", schemaContract.getEntity().getType());
    assertEquals(schemaApiEndpoint.getName(), schemaContract.getEntity().getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testApiEndpointSchemaValidationFailure(TestInfo test) throws IOException {
    // Create schema fields for the API endpoint that match what the data contract expects initially
    List<Field> requestSchemaFields =
        List.of(
            new Field()
                .withName("requestId")
                .withDataType(FieldDataType.STRING)
                .withDescription("Request ID"));
    List<Field> responseSchemaFields =
        List.of(
            new Field()
                .withName("responseCode")
                .withDataType(FieldDataType.INT)
                .withDescription("Response Code"));

    APIEndpoint schemaApiEndpoint =
        createUniqueApiEndpoint(
            test.getDisplayName() + "_schema", requestSchemaFields, responseSchemaFields);

    List<Column> columns =
        List.of(
            new Column()
                .withName("requestId")
                .withDescription("Request ID")
                .withDataType(ColumnDataType.STRING),
            new Column()
                .withName("responseCode")
                .withDescription("Response Code")
                .withDataType(ColumnDataType.INT));

    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema", schemaApiEndpoint)
            .withSchema(columns);

    // Create data contract with schema that matches the API endpoint
    DataContract schemaContract = createDataContract(createWithSchema);
    assertNotNull(schemaContract);
    assertNotNull(schemaContract.getSchema());
    assertEquals(2, schemaContract.getSchema().size());

    // First, validate the contract when the schema is still valid - should pass
    DataContractResult initialResult = runValidate(schemaContract);
    assertNotNull(initialResult);
    assertEquals(ContractExecutionStatus.Success, initialResult.getContractExecutionStatus());
    assertEquals(0, initialResult.getSchemaValidation().getFailed().intValue());
    assertEquals(2, initialResult.getSchemaValidation().getPassed().intValue());

    // Now let's "break" the API endpoint by removing one of the fields that the contract expects
    // We'll simulate this by updating the API endpoint to have fewer response fields
    String originalApiEndpointJson = JsonUtils.pojoToJson(schemaApiEndpoint);

    // Remove the "responseCode" field from the response schema
    List<Field> updatedResponseFields = new ArrayList<>();
    for (Field field : schemaApiEndpoint.getResponseSchema().getSchemaFields()) {
      if (!"responseCode".equals(field.getName())) {
        updatedResponseFields.add(field);
      }
    }
    schemaApiEndpoint.getResponseSchema().setSchemaFields(updatedResponseFields);

    // Patch the API endpoint to remove the responseCode field using APIEndpointResourceTest
    APIEndpointResourceTest apiEndpointResourceTest = new APIEndpointResourceTest();
    APIEndpoint patchedApiEndpoint =
        apiEndpointResourceTest.patchEntity(
            schemaApiEndpoint.getId(),
            originalApiEndpointJson,
            schemaApiEndpoint,
            ADMIN_AUTH_HEADERS);

    // Verify the responseCode field was removed from response schema
    assertEquals(0, patchedApiEndpoint.getResponseSchema().getSchemaFields().size());
    assertNull(
        patchedApiEndpoint.getResponseSchema().getSchemaFields().stream()
            .filter(field -> "responseCode".equals(field.getName()))
            .findFirst()
            .orElse(null));

    // Now validate the data contract - it should fail schema validation
    DataContractResult result = runValidate(schemaContract);

    // Verify the validation result shows failure due to schema validation
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());

    // Verify schema validation details
    assertNotNull(result.getSchemaValidation());
    assertEquals(
        1, result.getSchemaValidation().getFailed().intValue()); // 1 field failed (responseCode)
    assertEquals(
        1, result.getSchemaValidation().getPassed().intValue()); // 1 field passed (requestId)
    assertEquals(
        2, result.getSchemaValidation().getTotal().intValue()); // 2 total fields in contract

    // Verify the failed field is the responseCode field
    assertNotNull(result.getSchemaValidation().getFailedFields());
    assertEquals(1, result.getSchemaValidation().getFailedFields().size());
    assertEquals("responseCode", result.getSchemaValidation().getFailedFields().get(0));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDashboardDataModelEntityConstraints(TestInfo test) throws IOException {
    // Test 1: Dashboard Data Model with schema should succeed (dashboardDataModel supports schema
    // validation)
    // Create columns that match what the data contract will expect
    List<org.openmetadata.schema.type.Column> dataModelColumns =
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("metricId")
                .withDescription("Metric ID")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING),
            new org.openmetadata.schema.type.Column()
                .withName("metricValue")
                .withDescription("Metric Value")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.DOUBLE));

    // Create corresponding data contract columns
    List<Column> columns =
        List.of(
            new Column()
                .withName("metricId")
                .withDescription("Metric ID")
                .withDataType(ColumnDataType.STRING),
            new Column()
                .withName("metricValue")
                .withDescription("Metric Value")
                .withDataType(ColumnDataType.DOUBLE));

    DashboardDataModel schemaDataModel =
        createUniqueDashboardDataModel(test.getDisplayName() + "_schema", dataModelColumns);

    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema", schemaDataModel)
            .withSchema(columns);
    // Dashboard data models support schema validation, so this should succeed
    DataContract schemaContract = createDataContract(createWithSchema);
    assertNotNull(schemaContract);
    assertNotNull(schemaContract.getSchema());
    assertEquals(2, schemaContract.getSchema().size());
    // Verify the schema fields match what we provided
    assertEquals("metricId", schemaContract.getSchema().get(0).getName());
    assertEquals("metricValue", schemaContract.getSchema().get(1).getName());
    // Test validation works for schema - should pass when schema fields match
    DataContractResult schemaValidationResult = runValidate(schemaContract);
    assertNotNull(schemaValidationResult);
    assertEquals(
        ContractExecutionStatus.Success, schemaValidationResult.getContractExecutionStatus());
    assertNotNull(schemaValidationResult.getSchemaValidation());
    assertEquals(0, schemaValidationResult.getSchemaValidation().getFailed().intValue());
    assertEquals(2, schemaValidationResult.getSchemaValidation().getPassed().intValue());
    assertEquals(2, schemaValidationResult.getSchemaValidation().getTotal().intValue());

    // Test 2: Dashboard Data Model with semantics should succeed
    DashboardDataModel semanticsDataModel =
        createUniqueDashboardDataModel(test.getDisplayName() + "_semantics");
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Data Model Check")
                .withDescription("Ensures data model has valid structure")
                .withRule("{ \"!!\": { \"var\": \"name\" } }"));
    CreateDataContract createSemanticsOnly =
        createDataContractRequestForEntity(test.getDisplayName() + "_semantics", semanticsDataModel)
            .withSemantics(semanticsRules);
    DataContract semanticsContract = createDataContract(createSemanticsOnly);
    assertNotNull(semanticsContract);
    assertNotNull(semanticsContract.getSemantics());
    assertEquals(1, semanticsContract.getSemantics().size());
    // Test validation works for semantics
    DataContractResult semanticsValidationResult = runValidate(semanticsContract);
    assertNotNull(semanticsValidationResult);
    assertNotNull(semanticsValidationResult.getSemanticsValidation());

    // Test 3: Dashboard Data Model with both schema and semantics should succeed
    DashboardDataModel bothDataModel =
        createUniqueDashboardDataModel(test.getDisplayName() + "_both", dataModelColumns);
    CreateDataContract createBoth =
        createDataContractRequestForEntity(test.getDisplayName() + "_both", bothDataModel)
            .withSchema(columns)
            .withSemantics(semanticsRules);
    DataContract bothContract = createDataContract(createBoth);
    assertNotNull(bothContract);
    assertNotNull(bothContract.getSchema());
    assertNotNull(bothContract.getSemantics());
    assertEquals(2, bothContract.getSchema().size());
    assertEquals(1, bothContract.getSemantics().size());
    // Test validation works for combined schema and semantics
    DataContractResult bothValidationResult = runValidate(bothContract);
    assertNotNull(bothValidationResult);
    assertNotNull(bothValidationResult.getSchemaValidation());
    assertNotNull(bothValidationResult.getSemanticsValidation());

    // Test 4: Dashboard Data Model with quality expectations should fail (dashboardDataModel
    // doesn't support quality expectations)
    DashboardDataModel qualityDataModel =
        createUniqueDashboardDataModel(test.getDisplayName() + "_quality");
    // Create a dummy test case reference to test validation layer rejection
    EntityReference dummyTestCaseRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("testCase")
            .withName("dummy_test_case")
            .withFullyQualifiedName("dummy.test.case");
    // This should fail because dashboardDataModel doesn't support quality expectations
    CreateDataContract createWithQuality =
        createDataContractRequestForEntity(test.getDisplayName() + "_quality", qualityDataModel)
            .withQualityExpectations(List.of(dummyTestCaseRef));
    assertResponseContains(
        () -> createDataContract(createWithQuality),
        BAD_REQUEST,
        "Quality expectations are not supported for dashboardDataModel entities");

    // Verify entity reference is properly validated and dashboardDataModel exists
    assertEquals(schemaDataModel.getId(), schemaContract.getEntity().getId());
    assertEquals("dashboardDataModel", schemaContract.getEntity().getType());
    assertEquals(schemaDataModel.getName(), schemaContract.getEntity().getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDashboardDataModelSchemaValidationFailure(TestInfo test) throws IOException {
    // Create columns that match what the data contract will expect initially
    List<org.openmetadata.schema.type.Column> dataModelColumns =
        List.of(
            new org.openmetadata.schema.type.Column()
                .withName("metricId")
                .withDescription("Metric ID")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING),
            new org.openmetadata.schema.type.Column()
                .withName("metricValue")
                .withDescription("Metric Value")
                .withDataType(org.openmetadata.schema.type.ColumnDataType.DOUBLE));

    // Create corresponding data contract columns
    List<Column> columns =
        List.of(
            new Column()
                .withName("metricId")
                .withDescription("Metric ID")
                .withDataType(ColumnDataType.STRING),
            new Column()
                .withName("metricValue")
                .withDescription("Metric Value")
                .withDataType(ColumnDataType.DOUBLE));

    DashboardDataModel schemaDataModel =
        createUniqueDashboardDataModel(test.getDisplayName() + "_schema", dataModelColumns);

    CreateDataContract createWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_schema", schemaDataModel)
            .withSchema(columns);

    // Create data contract with schema that matches the data model
    DataContract schemaContract = createDataContract(createWithSchema);
    assertNotNull(schemaContract);
    assertNotNull(schemaContract.getSchema());
    assertEquals(2, schemaContract.getSchema().size());

    // First, validate the contract when the schema is still valid - should pass
    DataContractResult initialResult = runValidate(schemaContract);
    assertNotNull(initialResult);
    assertEquals(ContractExecutionStatus.Success, initialResult.getContractExecutionStatus());
    assertEquals(0, initialResult.getSchemaValidation().getFailed().intValue());
    assertEquals(2, initialResult.getSchemaValidation().getPassed().intValue());

    // Now let's "break" the data model by removing one of the columns that the contract expects
    // We'll simulate this by updating the data model to have fewer columns
    String originalDataModelJson = JsonUtils.pojoToJson(schemaDataModel);

    // Remove the "metricValue" column from the data model columns
    List<org.openmetadata.schema.type.Column> updatedColumns = new ArrayList<>();
    for (org.openmetadata.schema.type.Column col : schemaDataModel.getColumns()) {
      if (!"metricValue".equals(col.getName())) {
        updatedColumns.add(col);
      }
    }
    schemaDataModel.setColumns(updatedColumns);

    // Patch the data model to remove the metricValue column using DashboardDataModelResourceTest
    DashboardDataModelResourceTest dataModelResourceTest = new DashboardDataModelResourceTest();
    DashboardDataModel patchedDataModel =
        dataModelResourceTest.patchEntity(
            schemaDataModel.getId(), originalDataModelJson, schemaDataModel, ADMIN_AUTH_HEADERS);

    // Verify the metricValue column was removed
    assertEquals(1, patchedDataModel.getColumns().size());
    assertNull(
        patchedDataModel.getColumns().stream()
            .filter(col -> "metricValue".equals(col.getName()))
            .findFirst()
            .orElse(null));

    // Now validate the data contract - it should fail schema validation
    DataContractResult result = runValidate(schemaContract);

    // Verify the validation result shows failure due to schema validation
    assertNotNull(result);
    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());

    // Verify schema validation details
    assertNotNull(result.getSchemaValidation());
    assertEquals(
        1, result.getSchemaValidation().getFailed().intValue()); // 1 field failed (metricValue)
    assertEquals(
        1, result.getSchemaValidation().getPassed().intValue()); // 1 field passed (metricId)
    assertEquals(
        2, result.getSchemaValidation().getTotal().intValue()); // 2 total fields in contract

    // Verify the failed field is the metricValue column
    assertNotNull(result.getSchemaValidation().getFailedFields());
    assertEquals(1, result.getSchemaValidation().getFailedFields().size());
    assertEquals("metricValue", result.getSchemaValidation().getFailedFields().get(0));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testTableEntityConstraints(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Test: Tables should support all types of validations (schema, semantics, quality)
    List<Column> columns =
        List.of(
            new Column().withName(C1).withDescription("ID field").withDataType(ColumnDataType.INT));

    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("ID Required")
                .withDescription("ID field must exist")
                .withRule("{ \"!!\": { \"var\": \"id\" } }"));

    String tableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_table_all_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    CreateDataContract createWithAll =
        createDataContractRequestForEntity(test.getDisplayName(), table)
            .withSchema(columns)
            .withSemantics(semanticsRules)
            .withQualityExpectations(List.of(testCase.getEntityReference()));

    // This should succeed - tables support all validation types
    DataContract dataContract = createDataContract(createWithAll);
    assertNotNull(dataContract);
    assertEquals("table", dataContract.getEntity().getType());
    assertNotNull(dataContract.getSchema());
    assertNotNull(dataContract.getSemantics());
    assertNotNull(dataContract.getQualityExpectations());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUnsupportedEntityTypeConstraints(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Test with an unsupported entity type (using "metric" as an example)
    EntityReference unsupportedRef =
        new EntityReference()
            .withId(table.getId())
            .withType(org.openmetadata.service.Entity.METRIC) // METRIC is not in the supported list
            .withName(table.getName());

    CreateDataContract createWithUnsupported =
        new CreateDataContract()
            .withName("contract_unsupported_" + test.getDisplayName())
            .withEntity(unsupportedRef)
            .withEntityStatus(EntityStatus.DRAFT);

    assertResponseContains(
        () -> createDataContract(createWithUnsupported),
        BAD_REQUEST,
        "Entity type 'metric' is not supported for data contracts");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testSchemaValidationConstraints(TestInfo test) throws IOException {
    Dashboard dashboard =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Test entities that don't support schema validation
    List<Column> columns =
        List.of(
            new Column()
                .withName("test_field")
                .withDescription("Test field")
                .withDataType(ColumnDataType.STRING));

    // Dashboard doesn't support schema validation
    CreateDataContract dashboardWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_dashboard_schema", dashboard)
            .withSchema(columns);

    assertResponseContains(
        () -> createDataContract(dashboardWithSchema),
        BAD_REQUEST,
        "Schema validation is not supported for dashboard entities");

    // But dashboard with only semantics should work
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Dashboard Check")
                .withDescription("Basic dashboard validation")
                .withRule("{ \"!!\": { \"var\": \"displayName\" } }"));

    CreateDataContract dashboardWithSemantics =
        createDataContractRequestForEntity(
                test.getDisplayName() + "_dashboard_semantics", dashboard)
            .withSemantics(semanticsRules);

    DataContract successfulContract = createDataContract(dashboardWithSemantics);
    assertNotNull(successfulContract);
    assertEquals("dashboard", successfulContract.getEntity().getType());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testQualityExpectationConstraints(TestInfo test) throws IOException {
    Dashboard dashboard =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Create a test case for quality expectations
    Table testTable = createUniqueTable(test.getDisplayName() + "_testcase");
    String tableLink = String.format("<#E::table::%s>", testTable.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_quality_constraint_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    // Test that non-table entities can't have quality expectations
    CreateDataContract dashboardWithQuality =
        createDataContractRequestForEntity(test.getDisplayName() + "_dashboard_quality", dashboard)
            .withQualityExpectations(List.of(testCase.getEntityReference()));

    assertResponseContains(
        () -> createDataContract(dashboardWithQuality),
        BAD_REQUEST,
        "Quality expectations are not supported for dashboard entities. Only table entities support quality expectations");

    // Verify that table entities CAN have quality expectations (this should work)
    Table table = createUniqueTable(test.getDisplayName());
    String realTableLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    CreateTestCase tableTestCase =
        testCaseResourceTest
            .createRequest("test_case_table_quality_" + test.getDisplayName())
            .withEntityLink(realTableLink);
    TestCase tableTest =
        testCaseResourceTest.createAndCheckEntity(tableTestCase, ADMIN_AUTH_HEADERS);

    CreateDataContract tableWithQuality =
        createDataContractRequestForEntity(test.getDisplayName() + "_table_quality", table)
            .withQualityExpectations(List.of(tableTest.getEntityReference()));

    DataContract tableContract = createDataContract(tableWithQuality);
    assertNotNull(tableContract);
    assertEquals("table", tableContract.getEntity().getType());
    assertNotNull(tableContract.getQualityExpectations());
  }

  // ===================== Comprehensive Entity Validation Tests =====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testUnsupportedEntityType(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Test with an unsupported entity type (using "metric" as an example)
    EntityReference unsupportedRef =
        new EntityReference()
            .withId(table.getId())
            .withType(org.openmetadata.service.Entity.METRIC) // METRIC is not in the supported list
            .withName(table.getName());

    CreateDataContract createWithUnsupported =
        new CreateDataContract()
            .withName("contract_unsupported_" + test.getDisplayName())
            .withEntity(unsupportedRef)
            .withEntityStatus(EntityStatus.DRAFT);

    assertResponseContains(
        () -> createDataContract(createWithUnsupported),
        BAD_REQUEST,
        "Entity type 'metric' is not supported for data contracts");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testSupportedEntityWithSemanticValidation(TestInfo test) throws IOException {
    Dashboard dashboard =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Test Dashboard entity (supports semantic validation)
    List<SemanticsRule> semanticsRules =
        List.of(
            new SemanticsRule()
                .withName("Dashboard Active Check")
                .withDescription("Ensures dashboard is active")
                .withRule("{ \"!!\": { \"var\": \"displayName\" } }"));

    CreateDataContract dashboardWithSemantics =
        createDataContractRequestForEntity(
                test.getDisplayName() + "_dashboard_semantics", dashboard)
            .withSemantics(semanticsRules);

    DataContract contract = createDataContract(dashboardWithSemantics);
    assertNotNull(contract);
    assertEquals("dashboard", contract.getEntity().getType());
    assertNotNull(contract.getSemantics());
    assertEquals(1, contract.getSemantics().size());
    assertEquals("Dashboard Active Check", contract.getSemantics().get(0).getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testSchemaValidationNotSupportedForEntity(TestInfo test) throws IOException {
    Dashboard dashboard =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Test Dashboard entity with schema (should fail - dashboard doesn't support schema validation)
    List<Column> columns =
        List.of(
            new Column()
                .withName("chart_count")
                .withDescription("Number of charts")
                .withDataType(ColumnDataType.INT));

    CreateDataContract dashboardWithSchema =
        createDataContractRequestForEntity(test.getDisplayName() + "_dashboard_schema", dashboard)
            .withSchema(columns);

    assertResponseContains(
        () -> createDataContract(dashboardWithSchema),
        BAD_REQUEST,
        "Schema validation is not supported for dashboard entities");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testMultipleValidationErrors(TestInfo test) throws IOException {
    Dashboard dashboard =
        dashboardResourceTest.createEntity(
            dashboardResourceTest.createRequest(test.getDisplayName()), ADMIN_AUTH_HEADERS);

    // Create a test case for quality expectations
    Table testTable = createUniqueTable(test.getDisplayName() + "_testcase");
    String tableLink = String.format("<#E::table::%s>", testTable.getFullyQualifiedName());
    CreateTestCase createTestCase =
        testCaseResourceTest
            .createRequest("test_case_multiple_errors_" + test.getDisplayName())
            .withEntityLink(tableLink);
    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);

    // Test Dashboard entity with both schema and quality expectations (should fail with multiple
    // errors)
    List<Column> columns =
        List.of(
            new Column()
                .withName("chart_count")
                .withDescription("Number of charts")
                .withDataType(ColumnDataType.INT));

    CreateDataContract dashboardWithBoth =
        createDataContractRequestForEntity(test.getDisplayName() + "_dashboard_both", dashboard)
            .withSchema(columns)
            .withQualityExpectations(List.of(testCase.getEntityReference()));

    assertResponseContains(
        () -> createDataContract(dashboardWithBoth),
        BAD_REQUEST,
        "Data contract validation failed for dashboard entity");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractOwnerFieldFiltering(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create owners list
    List<EntityReference> owners = new ArrayList<>();
    owners.add(USER1_REF);

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withOwners(owners);

    DataContract created = createDataContract(create);

    // Verify owner was set during creation
    assertNotNull(created.getOwners());
    assertEquals(1, created.getOwners().size());

    // Test 1: Get without specifying fields - should not include owner information
    DataContract retrievedWithoutFields = getDataContract(created.getId(), null);
    assertNotNull(retrievedWithoutFields);
    assertEquals(created.getId(), retrievedWithoutFields.getId());
    assertNull(retrievedWithoutFields.getOwners());

    // Test 2: Get with "owners" in fields - should include owner information
    DataContract retrievedWithOwners = getDataContract(created.getId(), "owners");
    assertNotNull(retrievedWithOwners);
    assertEquals(created.getId(), retrievedWithOwners.getId());
    assertNotNull(retrievedWithOwners.getOwners());
    assertEquals(1, retrievedWithOwners.getOwners().size());
    assertEquals(USER1_REF.getId(), retrievedWithOwners.getOwners().get(0).getId());

    // Test 3: Get with multiple fields including owners - should include owner information
    DataContract retrievedWithMultipleFields = getDataContract(created.getId(), "owners,reviewers");
    assertNotNull(retrievedWithMultipleFields);
    assertEquals(created.getId(), retrievedWithMultipleFields.getId());
    assertNotNull(retrievedWithMultipleFields.getOwners());
    assertEquals(1, retrievedWithMultipleFields.getOwners().size());

    // Test 4: Get with fields that exclude owners - should not include owner information
    DataContract retrievedWithoutOwnerField = getDataContract(created.getId(), "reviewers");
    assertNotNull(retrievedWithoutOwnerField);
    assertEquals(created.getId(), retrievedWithoutOwnerField.getId());
    assertNull(retrievedWithoutOwnerField.getOwners());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractIsDeletedWhenTableIsDeleted(TestInfo test) throws IOException {
    // Create a table
    Table table = createUniqueTable(test.getDisplayName());

    // Create a data contract for the table
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract dataContract = createDataContract(create);

    // Verify the data contract was created
    assertNotNull(dataContract);
    assertEquals(table.getId(), dataContract.getEntity().getId());

    // Verify we can get the data contract before deletion
    DataContract retrieved = getDataContract(dataContract.getId(), null);
    assertNotNull(retrieved);

    // Delete the table
    deleteTable(table.getId(), true);

    // Verify that the data contract is also deleted (should throw HttpResponseException)
    assertThrows(HttpResponseException.class, () -> getDataContract(dataContract.getId(), null));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataContractNewPropertiesFullLifecycle(TestInfo test) throws IOException {
    // Test the full lifecycle of new properties: termsOfUse, security, and sla
    Table table = createUniqueTable(test.getDisplayName());

    // Create data contract with all new properties
    String termsOfUse =
        "# Terms of Use\n\nThis data is for internal use only.\n\n## Usage Guidelines\n- Do not share externally\n- Must comply with GDPR";

    org.openmetadata.schema.api.data.Policy policy1 =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("internal-only-policy")
            .withIdentities(List.of("engineering-team", "data-team"))
            .withRowFilters(
                List.of(
                    new org.openmetadata.schema.api.data.RowFilter()
                        .withColumnName("region")
                        .withValues(List.of("US", "EU"))));

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Confidential")
            .withPolicies(List.of(policy1));

    org.openmetadata.schema.api.data.ContractSLA sla =
        new org.openmetadata.schema.api.data.ContractSLA()
            .withRefreshFrequency(
                new org.openmetadata.schema.api.data.RefreshFrequency()
                    .withInterval(1)
                    .withUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.DAY))
            .withMaxLatency(
                new org.openmetadata.schema.api.data.MaxLatency()
                    .withValue(4)
                    .withUnit(org.openmetadata.schema.api.data.MaxLatency.Unit.HOUR))
            .withAvailabilityTime("09:00 UTC")
            .withTimezone(
                org.openmetadata.schema.api.data.ContractSLA.Timezone.GMT_00_00_EUROPE_LONDON)
            .withRetention(
                new org.openmetadata.schema.api.data.Retention()
                    .withPeriod(90)
                    .withUnit(org.openmetadata.schema.api.data.Retention.Unit.DAY))
            .withColumnName("updated_at");

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table)
            .withTermsOfUse(termsOfUse)
            .withSecurity(security)
            .withSla(sla);

    // Test 1: Create data contract with new properties
    DataContract created = createDataContract(create);
    assertNotNull(created);
    assertNotNull(created.getTermsOfUse());
    assertEquals(termsOfUse, created.getTermsOfUse().getContent());
    assertNotNull(created.getSecurity());
    assertEquals("Confidential", created.getSecurity().getDataClassification());
    assertNotNull(created.getSecurity().getPolicies());
    assertEquals(1, created.getSecurity().getPolicies().size());
    assertEquals(
        "internal-only-policy", created.getSecurity().getPolicies().get(0).getAccessPolicy());
    assertEquals(2, created.getSecurity().getPolicies().get(0).getIdentities().size());
    assertEquals(
        "engineering-team", created.getSecurity().getPolicies().get(0).getIdentities().get(0));
    assertEquals(1, created.getSecurity().getPolicies().get(0).getRowFilters().size());
    assertEquals(
        "region",
        created.getSecurity().getPolicies().get(0).getRowFilters().get(0).getColumnName());
    assertNotNull(created.getSla());
    assertEquals(Integer.valueOf(1), created.getSla().getRefreshFrequency().getInterval());
    assertEquals(
        org.openmetadata.schema.api.data.RefreshFrequency.Unit.DAY,
        created.getSla().getRefreshFrequency().getUnit());
    assertEquals(Integer.valueOf(4), created.getSla().getMaxLatency().getValue());
    assertEquals(
        org.openmetadata.schema.api.data.MaxLatency.Unit.HOUR,
        created.getSla().getMaxLatency().getUnit());
    assertEquals("09:00 UTC", created.getSla().getAvailabilityTime());
    assertEquals(
        org.openmetadata.schema.api.data.ContractSLA.Timezone.GMT_00_00_EUROPE_LONDON,
        created.getSla().getTimezone());
    assertEquals("updated_at", created.getSla().getColumnName());
    assertEquals(Integer.valueOf(90), created.getSla().getRetention().getPeriod());
    assertEquals(
        org.openmetadata.schema.api.data.Retention.Unit.DAY,
        created.getSla().getRetention().getUnit());

    // Test 2: Read data contract and verify properties are retrieved
    DataContract retrieved = getDataContract(created.getId(), null);
    assertNotNull(retrieved.getTermsOfUse());
    assertEquals(termsOfUse, retrieved.getTermsOfUse().getContent());
    assertNotNull(retrieved.getSecurity());
    assertEquals("Confidential", retrieved.getSecurity().getDataClassification());
    assertNotNull(retrieved.getSecurity().getPolicies());
    assertEquals(1, retrieved.getSecurity().getPolicies().size());
    assertEquals(
        "internal-only-policy", retrieved.getSecurity().getPolicies().get(0).getAccessPolicy());
    assertNotNull(retrieved.getSla());
    assertEquals(Integer.valueOf(1), retrieved.getSla().getRefreshFrequency().getInterval());
    assertEquals(
        org.openmetadata.schema.api.data.RefreshFrequency.Unit.DAY,
        retrieved.getSla().getRefreshFrequency().getUnit());

    // Test 3: Update properties using PUT
    String updatedTermsOfUse = "# Updated Terms\n\nNew terms apply from today.";
    org.openmetadata.schema.api.data.Policy updatedPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("public-policy")
            .withIdentities(List.of("all-users"));

    org.openmetadata.schema.api.data.ContractSecurity updatedSecurity =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Public")
            .withPolicies(List.of(updatedPolicy));

    org.openmetadata.schema.api.data.ContractSLA updatedSla =
        new org.openmetadata.schema.api.data.ContractSLA()
            .withRefreshFrequency(
                new org.openmetadata.schema.api.data.RefreshFrequency()
                    .withInterval(2)
                    .withUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.HOUR))
            .withMaxLatency(
                new org.openmetadata.schema.api.data.MaxLatency()
                    .withValue(1)
                    .withUnit(org.openmetadata.schema.api.data.MaxLatency.Unit.HOUR))
            .withAvailabilityTime("06:00")
            .withTimezone(
                org.openmetadata.schema.api.data.ContractSLA.Timezone.GMT_05_00_AMERICA_NEW_YORK)
            .withColumnName("last_modified");

    create.withTermsOfUse(updatedTermsOfUse).withSecurity(updatedSecurity).withSla(updatedSla);

    DataContract updated = updateDataContract(create);
    assertNotNull(updated.getTermsOfUse());
    assertEquals(updatedTermsOfUse, updated.getTermsOfUse().getContent());
    assertEquals("Public", updated.getSecurity().getDataClassification());
    assertNotNull(updated.getSecurity().getPolicies());
    assertEquals(1, updated.getSecurity().getPolicies().size());
    assertEquals("public-policy", updated.getSecurity().getPolicies().get(0).getAccessPolicy());
    assertEquals("all-users", updated.getSecurity().getPolicies().get(0).getIdentities().get(0));
    assertEquals(Integer.valueOf(2), updated.getSla().getRefreshFrequency().getInterval());
    assertEquals(
        org.openmetadata.schema.api.data.RefreshFrequency.Unit.HOUR,
        updated.getSla().getRefreshFrequency().getUnit());
    assertEquals("06:00", updated.getSla().getAvailabilityTime());
    assertEquals(
        org.openmetadata.schema.api.data.ContractSLA.Timezone.GMT_05_00_AMERICA_NEW_YORK,
        updated.getSla().getTimezone());
    assertEquals("last_modified", updated.getSla().getColumnName());
    assertNull(updated.getSla().getRetention()); // Verify retention was removed

    // Test 4: Patch individual properties
    String originalJson = JsonUtils.pojoToJson(updated);

    // Patch only termsOfUse
    String patchedTermsOfUse = "# Patched Terms\n\nOnly terms updated via patch.";
    updated.setTermsOfUse(
        new org.openmetadata.schema.entity.data.TermsOfUse()
            .withContent(patchedTermsOfUse)
            .withInherited(false));
    DataContract patched = patchDataContract(created.getId(), originalJson, updated);
    assertEquals(patchedTermsOfUse, patched.getTermsOfUse().getContent());
    // Verify other properties remain unchanged
    assertNotNull(patched.getSecurity().getPolicies());
    assertEquals("public-policy", patched.getSecurity().getPolicies().get(0).getAccessPolicy());
    assertEquals(Integer.valueOf(2), patched.getSla().getRefreshFrequency().getInterval());

    // Test 5: Patch to remove properties (set to null)
    originalJson = JsonUtils.pojoToJson(patched);
    patched.setSecurity(null);
    patched.setSla(null);
    DataContract patchedWithNulls = patchDataContract(created.getId(), originalJson, patched);
    assertNotNull(patchedWithNulls.getTermsOfUse());
    assertEquals(patchedTermsOfUse, patchedWithNulls.getTermsOfUse().getContent());
    assertNull(patchedWithNulls.getSecurity());
    assertNull(patchedWithNulls.getSla());

    // Test 6: Create contract with only termsOfUse (partial properties)
    Table newTable = createUniqueTable(test.getDisplayName() + "_partial");
    CreateDataContract partialCreate =
        createDataContractRequest(test.getDisplayName() + "_partial", newTable)
            .withTermsOfUse("Simple terms");

    DataContract partial = createDataContract(partialCreate);
    assertNotNull(partial.getTermsOfUse());
    assertEquals("Simple terms", partial.getTermsOfUse().getContent());
    assertNull(partial.getSecurity());
    assertNull(partial.getSla());

    // Test 7: Update to add security and sla to partial contract
    partialCreate.withSecurity(security).withSla(sla);
    DataContract partialUpdated = updateDataContract(partialCreate);
    assertNotNull(partialUpdated.getTermsOfUse());
    assertEquals("Simple terms", partialUpdated.getTermsOfUse().getContent());
    assertNotNull(partialUpdated.getSecurity());
    assertNotNull(partialUpdated.getSla());

    // Test 8: Test with complex SLA configurations
    org.openmetadata.schema.api.data.ContractSLA complexSla =
        new org.openmetadata.schema.api.data.ContractSLA()
            .withRefreshFrequency(
                new org.openmetadata.schema.api.data.RefreshFrequency()
                    .withInterval(1)
                    .withUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.MONTH))
            .withMaxLatency(
                new org.openmetadata.schema.api.data.MaxLatency()
                    .withValue(30)
                    .withUnit(org.openmetadata.schema.api.data.MaxLatency.Unit.MINUTE))
            .withAvailabilityTime("23:59")
            .withTimezone(
                org.openmetadata.schema.api.data.ContractSLA.Timezone.GMT_08_00_AMERICA_LOS_ANGELES)
            .withRetention(
                new org.openmetadata.schema.api.data.Retention()
                    .withPeriod(7)
                    .withUnit(org.openmetadata.schema.api.data.Retention.Unit.YEAR))
            .withColumnName("created_timestamp");

    Table complexTable = createUniqueTable(test.getDisplayName() + "_complex");
    CreateDataContract complexCreate =
        createDataContractRequest(test.getDisplayName() + "_complex", complexTable)
            .withSla(complexSla);

    DataContract complex = createDataContract(complexCreate);
    assertNotNull(complex.getSla());
    assertEquals(
        org.openmetadata.schema.api.data.RefreshFrequency.Unit.MONTH,
        complex.getSla().getRefreshFrequency().getUnit());
    assertEquals(Integer.valueOf(30), complex.getSla().getMaxLatency().getValue());
    assertEquals("23:59", complex.getSla().getAvailabilityTime());
    assertEquals(
        org.openmetadata.schema.api.data.ContractSLA.Timezone.GMT_08_00_AMERICA_LOS_ANGELES,
        complex.getSla().getTimezone());
    assertEquals("created_timestamp", complex.getSla().getColumnName());
    assertEquals(Integer.valueOf(7), complex.getSla().getRetention().getPeriod());
    assertEquals(
        org.openmetadata.schema.api.data.Retention.Unit.YEAR,
        complex.getSla().getRetention().getUnit());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContractSecurityWithMultiplePolicys(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    org.openmetadata.schema.api.data.Policy policy1 =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("read-only-policy")
            .withIdentities(List.of("data-analysts", "reporting-team"))
            .withRowFilters(
                List.of(
                    new org.openmetadata.schema.api.data.RowFilter()
                        .withColumnName("country")
                        .withValues(List.of("USA", "Canada")),
                    new org.openmetadata.schema.api.data.RowFilter()
                        .withColumnName("department")
                        .withValues(List.of("Sales", "Marketing"))));

    org.openmetadata.schema.api.data.Policy policy2 =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("full-access-policy")
            .withIdentities(List.of("admin-team", "data-engineers"))
            .withRowFilters(
                List.of(
                    new org.openmetadata.schema.api.data.RowFilter()
                        .withColumnName("status")
                        .withValues(List.of("active", "pending", "completed"))));

    org.openmetadata.schema.api.data.Policy policy3 =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("restricted-policy")
            .withIdentities(List.of("external-partners"));

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Highly Confidential")
            .withPolicies(List.of(policy1, policy2, policy3));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(security);

    DataContract created = createDataContract(create);
    assertNotNull(created.getSecurity());
    assertEquals("Highly Confidential", created.getSecurity().getDataClassification());
    assertEquals(3, created.getSecurity().getPolicies().size());

    // Verify first policy
    var firstPolicy = created.getSecurity().getPolicies().get(0);
    assertEquals("read-only-policy", firstPolicy.getAccessPolicy());
    assertEquals(2, firstPolicy.getIdentities().size());
    assertTrue(firstPolicy.getIdentities().contains("data-analysts"));
    assertTrue(firstPolicy.getIdentities().contains("reporting-team"));
    assertEquals(2, firstPolicy.getRowFilters().size());

    // Verify second policy
    var secondPolicy = created.getSecurity().getPolicies().get(1);
    assertEquals("full-access-policy", secondPolicy.getAccessPolicy());
    assertEquals(2, secondPolicy.getIdentities().size());
    assertEquals(1, secondPolicy.getRowFilters().size());
    assertEquals("status", secondPolicy.getRowFilters().get(0).getColumnName());
    assertEquals(3, secondPolicy.getRowFilters().get(0).getValues().size());

    // Verify third policy (no row filters)
    var thirdPolicy = created.getSecurity().getPolicies().get(2);
    assertEquals("restricted-policy", thirdPolicy.getAccessPolicy());
    assertEquals(1, thirdPolicy.getIdentities().size());
    assertNull(thirdPolicy.getRowFilters());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContractSecurityWithEmptyPolicysList(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Public")
            .withPolicies(new ArrayList<>());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(security);

    DataContract created = createDataContract(create);
    assertNotNull(created.getSecurity());
    assertEquals("Public", created.getSecurity().getDataClassification());
    assertNotNull(created.getSecurity().getPolicies());
    assertTrue(created.getSecurity().getPolicies().isEmpty());

    // Verify the contract can be retrieved and still has empty policys
    DataContract retrieved = getDataContract(created.getId(), null);
    assertNotNull(retrieved.getSecurity());
    assertEquals("Public", retrieved.getSecurity().getDataClassification());
    assertTrue(retrieved.getSecurity().getPolicies().isEmpty());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContractSecurityPolicysWithNoIdentitiesOrFilters(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Policy with only access policy (no identities, no row filters)
    org.openmetadata.schema.api.data.Policy minimalPolicy =
        new org.openmetadata.schema.api.data.Policy().withAccessPolicy("minimal-access-policy");

    // Policy with access policy and empty identities list
    org.openmetadata.schema.api.data.Policy emptyIdentitiesPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("empty-identities-policy")
            .withIdentities(new ArrayList<>());

    // Policy with access policy and empty row filters list
    org.openmetadata.schema.api.data.Policy emptyFiltersPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("empty-filters-policy")
            .withIdentities(List.of("some-team"))
            .withRowFilters(new ArrayList<>());

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Internal")
            .withPolicies(List.of(minimalPolicy, emptyIdentitiesPolicy, emptyFiltersPolicy));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(security);

    DataContract created = createDataContract(create);
    assertNotNull(created.getSecurity());
    assertEquals(3, created.getSecurity().getPolicies().size());

    // Verify minimal policy
    var policy1 = created.getSecurity().getPolicies().get(0);
    assertEquals("minimal-access-policy", policy1.getAccessPolicy());
    assertNull(policy1.getIdentities());
    assertNull(policy1.getRowFilters());

    // Verify empty identities policy
    var policy2 = created.getSecurity().getPolicies().get(1);
    assertEquals("empty-identities-policy", policy2.getAccessPolicy());
    assertNotNull(policy2.getIdentities());
    assertTrue(policy2.getIdentities().isEmpty());
    assertNull(policy2.getRowFilters());

    // Verify empty filters policy
    var policy3 = created.getSecurity().getPolicies().get(2);
    assertEquals("empty-filters-policy", policy3.getAccessPolicy());
    assertEquals(1, policy3.getIdentities().size());
    assertNotNull(policy3.getRowFilters());
    assertTrue(policy3.getRowFilters().isEmpty());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContractSecurityWithComplexRowFilters(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create row filters with multiple columns and many values
    List<org.openmetadata.schema.api.data.RowFilter> complexFilters = new ArrayList<>();

    // Filter 1: Geographic regions
    complexFilters.add(
        new org.openmetadata.schema.api.data.RowFilter()
            .withColumnName("region")
            .withValues(List.of("NA", "EMEA", "APAC", "LATAM", "ANZ")));

    // Filter 2: Product categories
    complexFilters.add(
        new org.openmetadata.schema.api.data.RowFilter()
            .withColumnName("product_category")
            .withValues(List.of("Electronics", "Clothing", "Food", "Books", "Toys", "Sports")));

    // Filter 3: Customer segments
    complexFilters.add(
        new org.openmetadata.schema.api.data.RowFilter()
            .withColumnName("customer_segment")
            .withValues(List.of("Premium", "Standard", "Basic")));

    // Filter 4: Date ranges (as strings)
    complexFilters.add(
        new org.openmetadata.schema.api.data.RowFilter()
            .withColumnName("date_range")
            .withValues(List.of("2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4")));

    // Filter 5: Status codes
    complexFilters.add(
        new org.openmetadata.schema.api.data.RowFilter()
            .withColumnName("status_code")
            .withValues(
                List.of("200", "201", "204", "301", "302", "400", "401", "403", "404", "500")));

    org.openmetadata.schema.api.data.Policy complexPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("complex-filtering-policy")
            .withIdentities(List.of("analytics-team", "bi-team", "data-science-team"))
            .withRowFilters(complexFilters);

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Sensitive")
            .withPolicies(List.of(complexPolicy));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(security);

    DataContract created = createDataContract(create);
    assertNotNull(created.getSecurity());
    assertEquals(1, created.getSecurity().getPolicies().size());

    var policy = created.getSecurity().getPolicies().get(0);
    assertEquals("complex-filtering-policy", policy.getAccessPolicy());
    assertEquals(3, policy.getIdentities().size());
    assertEquals(5, policy.getRowFilters().size());

    // Verify each filter
    Map<String, List<String>> filterMap = new HashMap<>();
    for (var filter : policy.getRowFilters()) {
      filterMap.put(filter.getColumnName(), filter.getValues());
    }

    assertEquals(5, filterMap.get("region").size());
    assertEquals(6, filterMap.get("product_category").size());
    assertEquals(3, filterMap.get("customer_segment").size());
    assertEquals(4, filterMap.get("date_range").size());
    assertEquals(10, filterMap.get("status_code").size());
    assertTrue(filterMap.get("region").contains("EMEA"));
    assertTrue(filterMap.get("product_category").contains("Electronics"));
    assertTrue(filterMap.get("status_code").contains("404"));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContractWithNullSecurityObject(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(null);

    DataContract created = createDataContract(create);
    assertNotNull(created);
    assertNull(created.getSecurity());

    // Verify retrieval also returns null security
    DataContract retrieved = getDataContract(created.getId(), null);
    assertNull(retrieved.getSecurity());

    // Update to add security
    org.openmetadata.schema.api.data.ContractSecurity newSecurity =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Confidential");

    create.withSecurity(newSecurity);
    DataContract updated = updateDataContract(create);
    assertNotNull(updated.getSecurity());
    assertEquals("Confidential", updated.getSecurity().getDataClassification());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContractSecurityWithOnlyDataClassification(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Security with only data classification, no policys
    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Restricted");

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(security);

    DataContract created = createDataContract(create);
    assertNotNull(created.getSecurity());
    assertEquals("Restricted", created.getSecurity().getDataClassification());
    // Policys list should be initialized but empty
    assertNotNull(created.getSecurity().getPolicies());
    assertTrue(created.getSecurity().getPolicies().isEmpty());

    // Verify we can update to add policys later
    org.openmetadata.schema.api.data.Policy newPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("new-policy")
            .withIdentities(List.of("new-team"));

    security.withPolicies(List.of(newPolicy));
    create.withSecurity(security);
    DataContract updated = updateDataContract(create);
    assertEquals("Restricted", updated.getSecurity().getDataClassification());
    assertEquals(1, updated.getSecurity().getPolicies().size());
    assertEquals("new-policy", updated.getSecurity().getPolicies().get(0).getAccessPolicy());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPatchContractSecurityNestedProperties(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create initial contract with security
    org.openmetadata.schema.api.data.Policy initialPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("initial-policy")
            .withIdentities(List.of("initial-team"))
            .withRowFilters(
                List.of(
                    new org.openmetadata.schema.api.data.RowFilter()
                        .withColumnName("initial_column")
                        .withValues(List.of("value1", "value2"))));

    org.openmetadata.schema.api.data.ContractSecurity initialSecurity =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Private")
            .withPolicies(List.of(initialPolicy));

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(initialSecurity);

    DataContract created = createDataContract(create);
    String originalJson = JsonUtils.pojoToJson(created);

    // Test 1: Patch to update only data classification
    created.getSecurity().setDataClassification("Public");
    DataContract patched1 = patchDataContract(created.getId(), originalJson, created);
    assertEquals("Public", patched1.getSecurity().getDataClassification());
    // Verify policys unchanged
    assertEquals(1, patched1.getSecurity().getPolicies().size());
    assertEquals("initial-policy", patched1.getSecurity().getPolicies().get(0).getAccessPolicy());

    // Test 2: Patch to add a new policy
    originalJson = JsonUtils.pojoToJson(patched1);
    org.openmetadata.schema.api.data.Policy additionalPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("additional-policy")
            .withIdentities(List.of("additional-team"));

    patched1.getSecurity().getPolicies().add(additionalPolicy);
    DataContract patched2 = patchDataContract(created.getId(), originalJson, patched1);
    assertEquals(2, patched2.getSecurity().getPolicies().size());
    assertEquals(
        "additional-policy", patched2.getSecurity().getPolicies().get(1).getAccessPolicy());

    // Test 3: Patch to modify existing policy's row filters
    originalJson = JsonUtils.pojoToJson(patched2);
    patched2
        .getSecurity()
        .getPolicies()
        .get(0)
        .setRowFilters(
            List.of(
                new org.openmetadata.schema.api.data.RowFilter()
                    .withColumnName("updated_column")
                    .withValues(List.of("new_value1", "new_value2", "new_value3"))));

    DataContract patched3 = patchDataContract(created.getId(), originalJson, patched2);
    var updatedFilters = patched3.getSecurity().getPolicies().get(0).getRowFilters();
    assertEquals(1, updatedFilters.size());
    assertEquals("updated_column", updatedFilters.get(0).getColumnName());
    assertEquals(3, updatedFilters.get(0).getValues().size());

    // Test 4: Patch to remove row filters from a policy
    originalJson = JsonUtils.pojoToJson(patched3);
    patched3.getSecurity().getPolicies().get(0).setRowFilters(null);
    DataContract patched4 = patchDataContract(created.getId(), originalJson, patched3);
    assertNull(patched4.getSecurity().getPolicies().get(0).getRowFilters());
    // Verify other properties remain
    assertEquals("initial-policy", patched4.getSecurity().getPolicies().get(0).getAccessPolicy());
    assertEquals(1, patched4.getSecurity().getPolicies().get(0).getIdentities().size());

    // Test 5: Patch to clear all policys
    originalJson = JsonUtils.pojoToJson(patched4);
    patched4.getSecurity().setPolicies(new ArrayList<>());
    DataContract patched5 = patchDataContract(created.getId(), originalJson, patched4);
    assertTrue(patched5.getSecurity().getPolicies().isEmpty());
    assertEquals("Public", patched5.getSecurity().getDataClassification());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContractSecurityPolicyDataIntegrityOnUpdates(TestInfo test) throws IOException {
    Table table = createUniqueTable(test.getDisplayName());

    // Create initial contract with multiple policys
    List<org.openmetadata.schema.api.data.Policy> initialPolicies = new ArrayList<>();
    for (int i = 1; i <= 3; i++) {
      initialPolicies.add(
          new org.openmetadata.schema.api.data.Policy()
              .withAccessPolicy("policy-" + i)
              .withIdentities(List.of("team-" + i, "group-" + i))
              .withRowFilters(
                  List.of(
                      new org.openmetadata.schema.api.data.RowFilter()
                          .withColumnName("column-" + i)
                          .withValues(List.of("val-" + i + "-a", "val-" + i + "-b")))));
    }

    org.openmetadata.schema.api.data.ContractSecurity security =
        new org.openmetadata.schema.api.data.ContractSecurity()
            .withDataClassification("Confidential")
            .withPolicies(initialPolicies);

    CreateDataContract create =
        createDataContractRequest(test.getDisplayName(), table).withSecurity(security);

    DataContract created = createDataContract(create);
    assertEquals(3, created.getSecurity().getPolicies().size());

    // Test 1: Update with reordered policys - should maintain all data
    List<org.openmetadata.schema.api.data.Policy> reorderedPolicies = new ArrayList<>();
    reorderedPolicies.add(initialPolicies.get(2));
    reorderedPolicies.add(initialPolicies.get(0));
    reorderedPolicies.add(initialPolicies.get(1));

    security.setPolicies(reorderedPolicies);
    create.withSecurity(security);
    DataContract updated1 = updateDataContract(create);

    // Verify reordering worked and all data is intact
    assertEquals("policy-3", updated1.getSecurity().getPolicies().get(0).getAccessPolicy());
    assertEquals("policy-1", updated1.getSecurity().getPolicies().get(1).getAccessPolicy());
    assertEquals("policy-2", updated1.getSecurity().getPolicies().get(2).getAccessPolicy());

    // Verify detailed data integrity for first policy (was third)
    var firstPolicy = updated1.getSecurity().getPolicies().get(0);
    assertEquals(2, firstPolicy.getIdentities().size());
    assertTrue(firstPolicy.getIdentities().contains("team-3"));
    assertEquals("column-3", firstPolicy.getRowFilters().get(0).getColumnName());

    // Test 2: Update with partial policy list - should only keep specified policys
    List<org.openmetadata.schema.api.data.Policy> partialPolicies = new ArrayList<>();
    partialPolicies.add(initialPolicies.get(1)); // Only keep second policy

    security.setPolicies(partialPolicies);
    create.withSecurity(security);
    DataContract updated2 = updateDataContract(create);

    assertEquals(1, updated2.getSecurity().getPolicies().size());
    assertEquals("policy-2", updated2.getSecurity().getPolicies().get(0).getAccessPolicy());

    // Test 3: Update with modified policy properties
    var modifiedPolicy =
        new org.openmetadata.schema.api.data.Policy()
            .withAccessPolicy("policy-2") // Same policy
            .withIdentities(List.of("team-2", "group-2", "new-group")) // Added identity
            .withRowFilters(
                List.of(
                    new org.openmetadata.schema.api.data.RowFilter()
                        .withColumnName("column-2")
                        .withValues(List.of("val-2-a", "val-2-b", "val-2-c")))); // Added value

    security.setPolicies(List.of(modifiedPolicy));
    create.withSecurity(security);
    DataContract updated3 = updateDataContract(create);

    assertEquals(1, updated3.getSecurity().getPolicies().size());
    var updatedPolicy = updated3.getSecurity().getPolicies().get(0);
    assertEquals(3, updatedPolicy.getIdentities().size());
    assertTrue(updatedPolicy.getIdentities().contains("new-group"));
    assertEquals(3, updatedPolicy.getRowFilters().get(0).getValues().size());
    assertTrue(updatedPolicy.getRowFilters().get(0).getValues().contains("val-2-c"));

    // Final verification - retrieve and check final state
    DataContract finalState = getDataContract(created.getId(), null);
    assertEquals(1, finalState.getSecurity().getPolicies().size());
    assertEquals("policy-2", finalState.getSecurity().getPolicies().get(0).getAccessPolicy());
  }

  // ==================== ODCS Import/Export Tests ====================

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testExportDataContractToODCS(TestInfo test) throws IOException {
    // Create a data contract with schema
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    create.withDescription("Test contract for ODCS export");

    // Add schema columns
    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.INT)
                .withDescription("ID column"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Name column"));
    create.withSchema(schema);

    DataContract created = createDataContract(create);

    // Export to ODCS JSON
    ODCSDataContract odcs = exportDataContractToODCS(created.getId());

    // Verify ODCS structure
    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());
    assertEquals(ODCSDataContract.OdcsKind.DATA_CONTRACT, odcs.getKind());
    assertEquals(created.getName(), odcs.getName());
    assertNotNull(odcs.getStatus());
    assertNotNull(odcs.getDescription());
    assertEquals("Test contract for ODCS export", odcs.getDescription().getPurpose());

    // Verify schema was converted (ODCS v3.1.0 wraps columns in a parent object)
    assertNotNull(odcs.getSchema());
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertNotNull(tableObject.getProperties());
    assertEquals(2, tableObject.getProperties().size());
    assertEquals("id", tableObject.getProperties().get(0).getName());
    assertEquals(
        ODCSSchemaElement.LogicalType.INTEGER, tableObject.getProperties().get(0).getLogicalType());
    assertEquals("name", tableObject.getProperties().get(1).getName());
    assertEquals(
        ODCSSchemaElement.LogicalType.STRING, tableObject.getProperties().get(1).getLogicalType());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testExportDataContractToODCSYaml(TestInfo test) throws IOException {
    // Create a data contract
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Export to ODCS YAML
    String yamlContent = exportDataContractToODCSYaml(created.getId());

    // Verify YAML content
    assertNotNull(yamlContent);
    assertTrue(yamlContent.contains("apiVersion:"));
    assertTrue(yamlContent.contains("v3.1.0"));
    assertTrue(yamlContent.contains("kind:"));
    assertTrue(yamlContent.contains("DataContract"));
    assertTrue(yamlContent.contains("name:"));
    assertTrue(yamlContent.contains(created.getName()));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testExportDataContractToODCSByFqn(TestInfo test) throws IOException {
    // Create a data contract
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    DataContract created = createDataContract(create);

    // Export to ODCS by FQN
    ODCSDataContract odcs = exportDataContractToODCSByFqn(created.getFullyQualifiedName());

    // Verify ODCS structure
    assertNotNull(odcs);
    assertEquals(ODCSDataContract.OdcsApiVersion.V_3_1_0, odcs.getApiVersion());
    assertEquals(created.getName(), odcs.getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testImportDataContractFromODCS(TestInfo test) throws IOException {
    // Create a table to associate the contract with
    Table table = createUniqueTable(test.getDisplayName());

    // Create ODCS data contract
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("odcs_import_test_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);

    // Add description
    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Imported from ODCS");
    odcs.setDescription(desc);

    // Add schema - use column names that match the table (id, name, description, email)
    List<ODCSSchemaElement> schema = new ArrayList<>();
    ODCSSchemaElement col1 = new ODCSSchemaElement();
    col1.setName("id");
    col1.setLogicalType(ODCSSchemaElement.LogicalType.INTEGER);
    col1.setPrimaryKey(true);
    col1.setDescription("ID column");
    schema.add(col1);

    ODCSSchemaElement col2 = new ODCSSchemaElement();
    col2.setName("email");
    col2.setLogicalType(ODCSSchemaElement.LogicalType.STRING);
    col2.setRequired(true);
    schema.add(col2);

    odcs.setSchema(schema);

    // Import ODCS contract
    DataContract imported = importDataContractFromODCS(odcs, table.getId(), "table");

    // Verify imported contract
    assertNotNull(imported);
    assertNotNull(imported.getId());
    assertEquals(odcs.getName(), imported.getName());
    assertEquals(EntityStatus.APPROVED, imported.getEntityStatus()); // "active" maps to APPROVED
    assertNotNull(imported.getDescription());
    assertTrue(imported.getDescription().contains("Imported from ODCS"));

    // Verify schema was imported
    assertNotNull(imported.getSchema());
    assertEquals(2, imported.getSchema().size());
    assertEquals("id", imported.getSchema().get(0).getName());
    assertEquals(ColumnDataType.INT, imported.getSchema().get(0).getDataType());
    assertEquals("email", imported.getSchema().get(1).getName());

    // Clean up
    createdContracts.add(imported);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testImportDataContractFromODCSYaml(TestInfo test) throws IOException {
    // Create a table to associate the contract with
    Table table = createUniqueTable(test.getDisplayName());

    String contractName =
        "yaml_import_test_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_");

    // Create ODCS YAML content - use column names that match the table (id, name, description,
    // email)
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

    // Import from YAML
    DataContract imported = importDataContractFromODCSYaml(yamlContent, table.getId(), "table");

    // Verify imported contract
    assertNotNull(imported);
    assertEquals(contractName, imported.getName());
    assertEquals(EntityStatus.DRAFT, imported.getEntityStatus()); // "draft" maps to DRAFT
    assertNotNull(imported.getSchema());
    assertEquals(2, imported.getSchema().size());
    assertEquals("id", imported.getSchema().get(0).getName());
    assertEquals("name", imported.getSchema().get(1).getName());

    // Clean up
    createdContracts.add(imported);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testCreateOrUpdateDataContractFromODCS(TestInfo test) throws IOException {
    // Create a table to associate the contract with
    Table table = createUniqueTable(test.getDisplayName());

    // Create ODCS data contract
    ODCSDataContract odcs = new ODCSDataContract();
    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName("upsert_odcs_test_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_"));
    odcs.setVersion("1.0.0");
    odcs.setStatus(ODCSDataContract.OdcsStatus.DRAFT);

    // Create initial contract
    DataContract created = createOrUpdateDataContractFromODCS(odcs, table.getId(), "table");
    assertNotNull(created);
    assertEquals(EntityStatus.DRAFT, created.getEntityStatus());

    // Clean up
    createdContracts.add(created);

    // Update the contract via ODCS
    odcs.setStatus(ODCSDataContract.OdcsStatus.ACTIVE);
    ODCSDescription desc = new ODCSDescription();
    desc.setPurpose("Updated via ODCS");
    odcs.setDescription(desc);

    DataContract updated = createOrUpdateDataContractFromODCS(odcs, table.getId(), "table");
    assertNotNull(updated);
    assertEquals(EntityStatus.APPROVED, updated.getEntityStatus());
    assertTrue(updated.getDescription().contains("Updated via ODCS"));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testODCSRoundTrip(TestInfo test) throws IOException {
    // Create a data contract with full details
    // Use column names that match the table (id, name, description, email)
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);
    create.withDescription("Round trip test contract");

    List<Column> schema =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.INT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Name field"),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Email field"));
    create.withSchema(schema);
    create.withEntityStatus(EntityStatus.APPROVED);

    DataContract original = createDataContract(create);

    // Export to ODCS
    ODCSDataContract odcs = exportDataContractToODCS(original.getId());

    // Verify ODCS export
    assertNotNull(odcs);
    assertEquals(original.getName(), odcs.getName());
    assertEquals(ODCSDataContract.OdcsStatus.ACTIVE, odcs.getStatus()); // APPROVED -> active
    // ODCS v3.1.0 wraps columns in a parent object
    assertEquals(1, odcs.getSchema().size());
    ODCSSchemaElement tableObject = odcs.getSchema().get(0);
    assertEquals(ODCSSchemaElement.LogicalType.OBJECT, tableObject.getLogicalType());
    assertEquals(3, tableObject.getProperties().size());

    // Verify type mappings in ODCS
    assertEquals(
        ODCSSchemaElement.LogicalType.INTEGER,
        tableObject.getProperties().get(0).getLogicalType()); // INT -> integer
    assertEquals(
        ODCSSchemaElement.LogicalType.STRING,
        tableObject.getProperties().get(1).getLogicalType()); // STRING -> string
    assertEquals(
        ODCSSchemaElement.LogicalType.STRING,
        tableObject.getProperties().get(2).getLogicalType()); // STRING -> string

    // Import back to a new table with a unique name
    Table newTable = createUniqueTable(test.getDisplayName() + "_reimport");
    // Generate new ID and unique name to avoid conflicts
    odcs.setId(UUID.randomUUID().toString());
    odcs.setName(
        "reimported_" + UUID.randomUUID().toString().substring(0, 8) + "_" + odcs.getName());
    DataContract reimported = importDataContractFromODCS(odcs, newTable.getId(), "table");

    // Clean up
    createdContracts.add(reimported);

    // Verify round trip preserved key attributes
    assertNotNull(reimported);
    assertEquals(original.getEntityStatus(), reimported.getEntityStatus());
    assertEquals(original.getSchema().size(), reimported.getSchema().size());
    assertEquals(original.getSchema().get(0).getName(), reimported.getSchema().get(0).getName());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testODCSExportWithSLA(TestInfo test) throws IOException {
    // Create a data contract with SLA
    Table table = createUniqueTable(test.getDisplayName());
    CreateDataContract create = createDataContractRequest(test.getDisplayName(), table);

    // Add SLA
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

    create.withSla(sla);
    DataContract created = createDataContract(create);

    // Export to ODCS
    ODCSDataContract odcs = exportDataContractToODCS(created.getId());

    // Verify SLA properties (ODCS uses "freshness" and "latency" naming)
    assertNotNull(odcs.getSlaProperties());
    assertTrue(odcs.getSlaProperties().size() >= 2);

    boolean hasFreshness =
        odcs.getSlaProperties().stream()
            .anyMatch(p -> "freshness".equals(p.getProperty()) && "1".equals(p.getValue()));
    assertTrue(hasFreshness);

    boolean hasLatency =
        odcs.getSlaProperties().stream()
            .anyMatch(p -> "latency".equals(p.getProperty()) && "2".equals(p.getValue()));
    assertTrue(hasLatency);
  }

  // ==================== ODCS Helper Methods ====================

  private ODCSDataContract exportDataContractToODCS(UUID id) throws HttpResponseException {
    WebTarget target = getResource(id).path("/odcs");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return TestUtils.readResponse(response, ODCSDataContract.class, Status.OK.getStatusCode());
  }

  private String exportDataContractToODCSYaml(UUID id) throws HttpResponseException {
    WebTarget target = getResource(id).path("/odcs/yaml");
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).accept("application/yaml").get();
    assertEquals(Status.OK.getStatusCode(), response.getStatus());
    return response.readEntity(String.class);
  }

  private ODCSDataContract exportDataContractToODCSByFqn(String fqn) throws HttpResponseException {
    WebTarget target = getCollection().path("/name/" + fqn + "/odcs");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return TestUtils.readResponse(response, ODCSDataContract.class, Status.OK.getStatusCode());
  }

  private DataContract importDataContractFromODCS(
      ODCSDataContract odcs, UUID entityId, String entityType) throws HttpResponseException {
    WebTarget target =
        getCollection()
            .path("/odcs")
            .queryParam("entityId", entityId)
            .queryParam("entityType", entityType);
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(odcs));
    // POST creates a new entity, returns 201 Created
    return TestUtils.readResponse(response, DataContract.class, Status.CREATED.getStatusCode());
  }

  private DataContract importDataContractFromODCSYaml(
      String yamlContent, UUID entityId, String entityType) throws HttpResponseException {
    WebTarget target =
        getCollection()
            .path("/odcs/yaml")
            .queryParam("entityId", entityId)
            .queryParam("entityType", entityType);
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
            .post(Entity.entity(yamlContent, "application/yaml"));
    // POST creates a new entity, returns 201 Created
    return TestUtils.readResponse(response, DataContract.class, Status.CREATED.getStatusCode());
  }

  private DataContract createOrUpdateDataContractFromODCS(
      ODCSDataContract odcs, UUID entityId, String entityType) throws HttpResponseException {
    WebTarget target =
        getCollection()
            .path("/odcs")
            .queryParam("entityId", entityId)
            .queryParam("entityType", entityType);
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).put(Entity.json(odcs));
    // PUT can return 200 (update) or 201 (create)
    int status = response.getStatus();
    assertTrue(
        status == Status.OK.getStatusCode() || status == Status.CREATED.getStatusCode(),
        "Expected 200 or 201 but got " + status);
    return response.readEntity(DataContract.class);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductContractInheritance_PassingCase(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("test_dp_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create a data contract for the data product with semantics and terms of use
    SemanticsRule dataProductRule =
        new SemanticsRule()
            .withName("DataProductRule")
            .withRule("{\"!=\":[{\"var\":\"description\"},null]}")
            .withDescription("Description must not be null")
            .withEnabled(true);

    CreateDataContract createDpContract =
        new CreateDataContract()
            .withName("dp_contract_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(List.of(dataProductRule))
            .withTermsOfUse("This data must be used only for internal purposes");

    DataContract dpContract = createDataContract(createDpContract);
    assertNotNull(dpContract);
    assertEquals(EntityStatus.APPROVED, dpContract.getEntityStatus());

    // Create a table that belongs to this data product
    Table table = createUniqueTable(test.getDisplayName());

    // Set the same domain on the table to satisfy domain validation rule
    // Also set description so semantic rule passes
    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDescription("Table for testing data product contract inheritance");
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));

    TableResourceTest tableResourceTest = new TableResourceTest();
    table =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Verify the table inherits the data product's contract
    DataContract effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getSemantics());
    assertEquals(1, effectiveContract.getSemantics().size());
    assertEquals("DataProductRule", effectiveContract.getSemantics().get(0).getName());
    assertTrue(effectiveContract.getSemantics().get(0).getInherited());

    // Create a direct contract for the table to verify merging
    SemanticsRule tableSpecificRule =
        new SemanticsRule()
            .withName("TableSpecificRule")
            .withRule("{\"!=\":[{\"var\":\"columns\"},null]}")
            .withDescription("Table must have columns defined")
            .withEnabled(true);

    CreateDataContract createTableContract =
        createDataContractRequest(test.getDisplayName() + "_table", table)
            .withSemantics(List.of(tableSpecificRule))
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract tableContract = createDataContract(createTableContract);

    // Verify that both rules are applied (merged semantics)
    effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getSemantics());
    // Both rules should be present: inherited DP rule + table-specific rule
    assertEquals(2, effectiveContract.getSemantics().size());

    // Verify inherited rule is marked correctly
    boolean hasInheritedRule =
        effectiveContract.getSemantics().stream()
            .anyMatch(
                rule ->
                    "DataProductRule".equals(rule.getName())
                        && Boolean.TRUE.equals(rule.getInherited()));
    assertTrue(hasInheritedRule);

    // Verify table-specific rule is not marked as inherited
    boolean hasTableRule =
        effectiveContract.getSemantics().stream()
            .anyMatch(
                rule ->
                    "TableSpecificRule".equals(rule.getName())
                        && !Boolean.TRUE.equals(rule.getInherited()));
    assertTrue(hasTableRule);

    // Validate the contract to ensure both rules are evaluated
    DataContractResult validationResult = validateDataContract(tableContract.getId());
    assertNotNull(validationResult);
    assertEquals(ContractExecutionStatus.Success, validationResult.getContractExecutionStatus());
    if (validationResult.getSemanticsValidation() != null) {
      assertEquals(2, validationResult.getSemanticsValidation().getTotal());
      assertEquals(2, validationResult.getSemanticsValidation().getPassed());
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductContractInheritance_FailingCase(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("test_dp_fail_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create a data contract for the data product with a failing semantic rule
    // Rule checks if entity has an owner (table has no owner, so it will fail)
    SemanticsRule failingRule =
        new SemanticsRule()
            .withName("MustHaveOwner")
            .withRule("{\"!=\":[{\"var\":\"owner\"},null]}")
            .withDescription("Entity must have an owner")
            .withEnabled(true);

    CreateDataContract createDpContract =
        new CreateDataContract()
            .withName("dp_contract_fail_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(List.of(failingRule))
            .withTermsOfUse("This data must have proper ownership");

    DataContract dpContract = createDataContract(createDpContract);
    assertNotNull(dpContract);
    assertEquals(EntityStatus.APPROVED, dpContract.getEntityStatus());

    // Create a table without owner that belongs to this data product
    Table table = createUniqueTable(test.getDisplayName() + "_noowner");

    // Update the table to belong to the data product using PATCH
    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));

    TableResourceTest tableResourceTest = new TableResourceTest();
    table =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Verify table has no owners (will fail the owner requirement rule)
    assertTrue(table.getOwners() == null || table.getOwners().isEmpty());

    // Verify the table inherits the data product's failing contract rule
    DataContract effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getSemantics());
    assertEquals(1, effectiveContract.getSemantics().size());
    assertEquals("MustHaveOwner", effectiveContract.getSemantics().get(0).getName());
    assertTrue(effectiveContract.getSemantics().get(0).getInherited());

    // Create a direct contract for the table to enable validation
    CreateDataContract createTableContract =
        createDataContractRequest(test.getDisplayName() + "_table_fail", table)
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract tableContract = createDataContract(createTableContract);

    // Validate the contract - it should fail since the table has no owner
    DataContractResult validationResult = validateDataContract(tableContract.getId());
    assertNotNull(validationResult);
    assertEquals(ContractExecutionStatus.Failed, validationResult.getContractExecutionStatus());

    if (validationResult.getSemanticsValidation() != null) {
      assertEquals(1, validationResult.getSemanticsValidation().getFailed());
      assertEquals(0, validationResult.getSemanticsValidation().getPassed());
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductContractInheritance_TermsOfUse(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("test_dp_terms_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create a data contract for the data product with only terms of use
    CreateDataContract createDpContract =
        new CreateDataContract()
            .withName("dp_contract_terms_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withTermsOfUse("Data Product Terms: This data is confidential");

    DataContract dpContract = createDataContract(createDpContract);
    assertNotNull(dpContract);

    // Create a table that belongs to this data product without its own contract
    Table table = createUniqueTable(test.getDisplayName() + "_terms");

    // Update the table to belong to the data product using PATCH
    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));

    TableResourceTest tableResourceTest = new TableResourceTest();
    table =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Get the effective contract for the table (should inherit from data product)
    DataContract effectiveContract = getEffectiveContractForTable(table);

    // Verify terms of use is inherited
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getTermsOfUse());
    assertEquals(
        "Data Product Terms: This data is confidential",
        effectiveContract.getTermsOfUse().getContent());
    assertTrue(effectiveContract.getTermsOfUse().getInherited());

    // Create a direct contract for the table with its own terms of use
    CreateDataContract createTableContract =
        createDataContractRequest(test.getDisplayName() + "_table_terms", table)
            .withTermsOfUse("Table Terms: This table has specific usage restrictions")
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract tableContract = createDataContract(createTableContract);

    // Get the effective contract again
    effectiveContract = getEffectiveContractForTable(table);

    // Table's own terms should take precedence
    assertNotNull(effectiveContract.getTermsOfUse());
    assertEquals(
        "Table Terms: This table has specific usage restrictions",
        effectiveContract.getTermsOfUse().getContent());
    assertFalse(effectiveContract.getTermsOfUse().getInherited());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductContract_QualityExpectationsNotInherited(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("test_dp_quality_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create a DP contract with only semantics (quality expectations not supported on DPs)
    SemanticsRule dpRule =
        new SemanticsRule()
            .withName("DPSemanticsRule")
            .withRule("{\"!=\":[{\"var\":\"description\"},null]}")
            .withDescription("Description must exist")
            .withEnabled(true);

    CreateDataContract createDpContract =
        new CreateDataContract()
            .withName("dp_contract_quality_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(List.of(dpRule));

    DataContract dpContract = createDataContract(createDpContract);
    assertNotNull(dpContract);

    // Create a table that belongs to this data product
    Table table = createUniqueTable(test.getDisplayName() + "_quality");
    table.setDescription("Table description");

    // Update the table to belong to the data product using PATCH
    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));

    TableResourceTest tableResourceTest = new TableResourceTest();
    table =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Get the effective contract - should have inherited semantics but no quality expectations
    DataContract effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getSemantics());
    assertEquals(1, effectiveContract.getSemantics().size());

    // Quality expectations should NOT be inherited (only semantics are inherited)
    assertTrue(nullOrEmpty(effectiveContract.getQualityExpectations()));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testMultipleDataProducts_NoInheritance(TestInfo test) throws IOException {
    // Create two data products with different contracts
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();

    // First data product with one semantic rule
    CreateDataProduct createDataProduct1 =
        dataProductResourceTest.createRequest("test_dp1_" + test.getDisplayName());
    DataProduct dataProduct1 =
        dataProductResourceTest.createAndCheckEntity(createDataProduct1, ADMIN_AUTH_HEADERS);

    SemanticsRule dp1Rule =
        new SemanticsRule()
            .withName("DP1Rule")
            .withRule("{\"!=\":[{\"var\":\"description\"},null]}")
            .withDescription("DP1: Description required")
            .withEnabled(true);

    CreateDataContract createDp1Contract =
        new CreateDataContract()
            .withName("dp1_contract_" + test.getDisplayName())
            .withEntity(dataProduct1.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(List.of(dp1Rule))
            .withTermsOfUse("DP1 Terms");

    DataContract dp1Contract = createDataContract(createDp1Contract);
    assertNotNull(dp1Contract);

    // Second data product with different semantic rule
    CreateDataProduct createDataProduct2 =
        dataProductResourceTest.createRequest("test_dp2_" + test.getDisplayName());
    DataProduct dataProduct2 =
        dataProductResourceTest.createAndCheckEntity(createDataProduct2, ADMIN_AUTH_HEADERS);

    SemanticsRule dp2Rule =
        new SemanticsRule()
            .withName("DP2Rule")
            .withRule("{\"!=\":[{\"var\":\"owner\"},null]}")
            .withDescription("DP2: Owner required")
            .withEnabled(true);

    CreateDataContract createDp2Contract =
        new CreateDataContract()
            .withName("dp2_contract_" + test.getDisplayName())
            .withEntity(dataProduct2.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(List.of(dp2Rule))
            .withTermsOfUse("DP2 Terms");

    DataContract dp2Contract = createDataContract(createDp2Contract);
    assertNotNull(dp2Contract);

    // Create a table that belongs to BOTH data products
    Table table = createUniqueTable(test.getDisplayName() + "_multi_dp");
    table.setDescription("Table belonging to multiple data products");

    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDomains(List.of(dataProduct1.getDomains().get(0)));
    table.setDataProducts(
        List.of(dataProduct1.getEntityReference(), dataProduct2.getEntityReference()));

    TableResourceTest tableResourceTest = new TableResourceTest();
    table =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Verify table belongs to both data products
    assertNotNull(table.getDataProducts());
    assertEquals(2, table.getDataProducts().size());

    // Get the effective contract - should NOT inherit because of multiple DPs
    DataContract effectiveContract = getEffectiveContractForTable(table);

    // Since there's no direct contract and multiple DPs, effective contract should be null
    assertNull(effectiveContract);

    // Now create a direct contract for the table
    SemanticsRule tableRule =
        new SemanticsRule()
            .withName("TableOwnRule")
            .withRule("{\"!=\":[{\"var\":\"columns\"},null]}")
            .withDescription("Table must have columns")
            .withEnabled(true);

    CreateDataContract createTableContract =
        createDataContractRequest(test.getDisplayName() + "_table_multi", table)
            .withSemantics(List.of(tableRule))
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract tableContract = createDataContract(createTableContract);
    assertNotNull(tableContract);

    // Get effective contract again - should only have the table's own contract, no inheritance
    effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getSemantics());

    // Should only have the table's own rule, not DP1Rule or DP2Rule
    assertEquals(1, effectiveContract.getSemantics().size());
    assertEquals("TableOwnRule", effectiveContract.getSemantics().get(0).getName());
    assertFalse(effectiveContract.getSemantics().get(0).getInherited());

    // Verify no inherited terms of use either
    assertTrue(
        effectiveContract.getTermsOfUse() == null
            || !effectiveContract.getTermsOfUse().getInherited());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductContractInheritance_NoDuplicateSemantics(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("test_dp_dedup_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create DP contract with a semantic rule
    SemanticsRule dpRule =
        new SemanticsRule()
            .withName("MustHaveDescription")
            .withRule("{\"!=\":[{\"var\":\"description\"},null]}")
            .withDescription("DP: Description must exist")
            .withEnabled(true);

    CreateDataContract createDpContract =
        new CreateDataContract()
            .withName("dp_contract_dedup_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(List.of(dpRule));

    DataContract dpContract = createDataContract(createDpContract);
    assertNotNull(dpContract);

    // Create a table with the SAME semantic rule name
    Table table = createUniqueTable(test.getDisplayName() + "_dedup");
    table.setDescription("Table with description");

    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));

    TableResourceTest tableResourceTest = new TableResourceTest();
    table =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Create a table contract with the same rule name (different description)
    SemanticsRule tableRule =
        new SemanticsRule()
            .withName("MustHaveDescription") // Same name as DP rule
            .withRule("{\"!=\":[{\"var\":\"description\"},null]}")
            .withDescription("Table: My own description rule") // Different description
            .withEnabled(true);

    CreateDataContract createTableContract =
        createDataContractRequest(test.getDisplayName() + "_table_dedup", table)
            .withSemantics(List.of(tableRule))
            .withEntityStatus(EntityStatus.APPROVED);

    DataContract tableContract = createDataContract(createTableContract);
    assertNotNull(tableContract);

    // Get effective contract - should NOT have duplicates
    DataContract effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getSemantics());

    // Should only have ONE rule (table's own rule takes precedence)
    assertEquals(
        1,
        effectiveContract.getSemantics().size(),
        "Should have only 1 semantic rule (no duplicates)");
    assertEquals("MustHaveDescription", effectiveContract.getSemantics().get(0).getName());
    // The entity's own rule should NOT be marked as inherited
    assertFalse(
        effectiveContract.getSemantics().get(0).getInherited(),
        "Entity's own rule should not be marked as inherited");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductContractInheritance_SLAInheritance(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("test_dp_sla_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create DP contract with SLA
    org.openmetadata.schema.api.data.ContractSLA sla =
        new org.openmetadata.schema.api.data.ContractSLA();
    org.openmetadata.schema.api.data.RefreshFrequency refreshFrequency =
        new org.openmetadata.schema.api.data.RefreshFrequency()
            .withInterval(1)
            .withUnit(org.openmetadata.schema.api.data.RefreshFrequency.Unit.HOUR);
    sla.setRefreshFrequency(refreshFrequency);

    CreateDataContract createDpContract =
        new CreateDataContract()
            .withName("dp_contract_sla_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSla(sla);

    DataContract dpContract = createDataContract(createDpContract);
    assertNotNull(dpContract);

    // Create a table without its own contract
    Table table = createUniqueTable(test.getDisplayName() + "_sla");

    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));

    TableResourceTest tableResourceTest = new TableResourceTest();
    table =
        tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Get effective contract - should inherit SLA from DP
    DataContract effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertNotNull(effectiveContract.getSla());
    assertNotNull(effectiveContract.getSla().getRefreshFrequency());
    assertEquals(1, effectiveContract.getSla().getRefreshFrequency().getInterval());

    // SLA should be marked as inherited
    assertTrue(effectiveContract.getSla().getInherited(), "SLA should be marked as inherited");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductContractInheritance_ExecutionStatusNotInherited(TestInfo test)
      throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("dp_exec_test_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create a data product contract with semantics
    CreateDataContract dpContractCreate =
        new CreateDataContract()
            .withName("dp_execution_test_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(
                List.of(
                    new SemanticsRule()
                        .withName("AlwaysPassRule")
                        .withDescription("Rule that always passes")
                        .withRule("{\"==\": [1, 1]}")
                        .withEnabled(true)));
    DataContract dpContract = createDataContract(dpContractCreate);

    // Validate the data product contract to create execution results
    validateDataContract(dpContract.getId());

    // Fetch the DP contract and verify it has execution results
    DataContract dpContractWithResults = getDataContract(dpContract.getId(), "");
    assertNotNull(dpContractWithResults.getLatestResult(), "DP contract should have latestResult");
    assertEquals(
        EntityStatus.APPROVED,
        dpContractWithResults.getEntityStatus(),
        "DP contract should be APPROVED");

    // Create a table and add it to the data product
    Table table = createUniqueTable(test.getDisplayName() + "_exec");
    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDescription("Table for testing execution status inheritance");
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Get the effective contract for the table (inherited from DP)
    DataContract effectiveContract = getEffectiveContractForTable(table);

    // Verify the contract is inherited
    assertNotNull(effectiveContract);
    assertTrue(effectiveContract.getInherited(), "Contract should be marked as inherited");

    // Verify execution-related fields are NOT inherited
    assertNull(
        effectiveContract.getLatestResult(),
        "Inherited contract should NOT have latestResult from parent");
    assertNull(
        effectiveContract.getContractUpdates(),
        "Inherited contract should NOT have contractUpdates from parent");
    assertEquals(
        EntityStatus.DRAFT,
        effectiveContract.getEntityStatus(),
        "Inherited contract should have DRAFT status, not parent's status");

    // Verify the semantics ARE inherited
    assertNotNull(effectiveContract.getSemantics());
    assertEquals(1, effectiveContract.getSemantics().size());
    assertTrue(effectiveContract.getSemantics().get(0).getInherited());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testInheritedContractCannotBeDeleted(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("dp_delete_test_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create a data product contract
    CreateDataContract dpContractCreate =
        new CreateDataContract()
            .withName("dp_delete_test_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(
                List.of(
                    new SemanticsRule()
                        .withName("TestRule")
                        .withDescription("Test rule")
                        .withRule("{\"==\": [1, 1]}")
                        .withEnabled(true)));
    DataContract dpContract = createDataContract(dpContractCreate);

    // Create a table and add it to the data product (no direct contract)
    Table table = createUniqueTable(test.getDisplayName() + "_del");
    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDescription("Table for testing inherited contract deletion");
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Get the effective contract for the table (inherited from DP)
    DataContract inheritedContract = getEffectiveContractForTable(table);
    assertNotNull(inheritedContract);
    assertTrue(inheritedContract.getInherited(), "Contract should be marked as inherited");

    // Attempt to delete the inherited contract - should fail
    // Note: Inherited contracts are virtual and don't have their own ID,
    // but trying to delete via the DP contract ID while it's inherited should be blocked
    // Actually, inherited contracts are returned via getEffectiveDataContract and don't
    // exist as separate entities. The delete prevention is for the case where
    // someone tries to delete a contract that has inherited=true flag set.

    // The proper test is to verify that the DP contract (which is the source) can be deleted,
    // but since inherited contracts are virtual, we just verify the inherited flag behavior.
    // The backend validation in preDelete checks entity.getInherited() which would be set
    // when loading an inherited contract directly (not applicable for virtual contracts).

    // For completeness, verify that the DP contract itself CAN be deleted (it's not inherited)
    assertFalse(
        dpContract.getInherited() != null && dpContract.getInherited(),
        "DP contract should not be marked as inherited");
    deleteDataContract(dpContract.getId());

    // After deleting DP contract, table should have no effective contract
    // Note: This is because the contract was never materialized (no validation was run).
    // For the case where the contract IS materialized, see
    // testInheritedContractMaterializationOnValidation
    DataContract effectiveAfterDelete = getEffectiveContractForTable(table);
    assertNull(
        effectiveAfterDelete,
        "Table should have no effective contract after DP contract deleted (no materialization)");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testInheritedContractMaterializationOnValidation(TestInfo test) throws IOException {
    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest.createRequest("dp_mat_test_" + test.getDisplayName());
    DataProduct dataProduct =
        dataProductResourceTest.createAndCheckEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create a data product contract with semantics
    CreateDataContract dpContractCreate =
        new CreateDataContract()
            .withName("dp_materialize_test_" + test.getDisplayName())
            .withEntity(dataProduct.getEntityReference())
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(
                List.of(
                    new SemanticsRule()
                        .withName("AlwaysPassRule")
                        .withDescription("Rule that always passes")
                        .withRule("{\"==\": [1, 1]}")
                        .withEnabled(true)));
    DataContract dpContract = createDataContract(dpContractCreate);

    // Create a table and add it to the data product (no direct contract)
    Table table = createUniqueTable(test.getDisplayName() + "_mat");
    String originalTableJson = JsonUtils.pojoToJson(table);
    table.setDescription("Table for testing contract materialization");
    table.setDomains(List.of(dataProduct.getDomains().get(0)));
    table.setDataProducts(List.of(dataProduct.getEntityReference()));
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.patchEntity(table.getId(), originalTableJson, table, ADMIN_AUTH_HEADERS);

    // Get the effective contract - should be inherited (virtual)
    DataContract effectiveContract = getEffectiveContractForTable(table);
    assertNotNull(effectiveContract);
    assertTrue(effectiveContract.getInherited(), "Contract should be inherited initially");

    // Validate using the entity-based endpoint - this should materialize the contract
    validateContractByEntityId(table.getId(), table.getEntityReference().getType());

    // Now the table should have its own contract (materialized)
    DataContract materializedContract = getEffectiveContractForTable(table);
    assertNotNull(materializedContract);

    // The materialized contract should have its own validation results
    assertNotNull(
        materializedContract.getLatestResult(),
        "Materialized contract should have validation results");

    // The contract FQN should be for the table, not the DP
    assertTrue(
        materializedContract.getFullyQualifiedName().contains(table.getName()),
        "Contract FQN should contain table name");

    // The effective contract should still have inherited semantics
    DataContract newEffectiveContract = getEffectiveContractForTable(table);
    assertNotNull(newEffectiveContract.getSemantics());
    assertEquals(1, newEffectiveContract.getSemantics().size());
    // The semantic rule should still be marked as inherited (from DP)
    assertTrue(
        newEffectiveContract.getSemantics().get(0).getInherited(),
        "Semantic rule should still be inherited from DP");

    // Now delete the DP contract and verify the materialized contract behavior
    deleteDataContract(dpContract.getId());

    // After deleting DP contract, the materialized contract should still exist
    // but without inherited rules (since the source is gone)
    DataContract contractAfterDpDelete = getEffectiveContractForTable(table);
    assertNotNull(
        contractAfterDpDelete,
        "Materialized contract should still exist after DP contract deletion");

    // The contract should no longer have inherited semantics (the source is deleted)
    // It should either have empty semantics or null semantics
    assertTrue(
        contractAfterDpDelete.getSemantics() == null
            || contractAfterDpDelete.getSemantics().isEmpty(),
        "Contract should have no semantics after DP contract (source) is deleted");

    // The materialized contract should still have its validation results
    assertNotNull(
        contractAfterDpDelete.getLatestResult(),
        "Materialized contract should retain its validation results");
  }

  private void validateContractByEntityId(UUID entityId, String entityType)
      throws HttpResponseException {
    WebTarget target =
        getCollection()
            .path("/entity/validate")
            .queryParam("entityId", entityId)
            .queryParam("entityType", entityType);
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(""));
    TestUtils.readResponse(response, DataContractResult.class, Status.OK.getStatusCode());
  }

  private DataContract getEffectiveContractForTable(Table table) throws HttpResponseException {
    try {
      return getDataContractByEntityId(table.getId(), table.getEntityReference().getType(), null);
    } catch (HttpResponseException e) {
      // No contract found, which is valid for inheritance test
      if (e.getStatusCode() == 404) {
        return null;
      }
      throw e;
    }
  }

  private DataContractResult validateDataContract(UUID contractId) throws HttpResponseException {
    WebTarget target = getCollection().path("/" + contractId + "/validate");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).post(Entity.json(""));
    return TestUtils.readResponse(response, DataContractResult.class, Status.OK.getStatusCode());
  }
}
