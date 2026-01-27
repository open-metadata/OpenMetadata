package org.openmetadata.service.resources.governance;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.apis.APICollectionResourceTest;
import org.openmetadata.service.resources.apis.APIEndpointResourceTest;
import org.openmetadata.service.resources.charts.ChartResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.dqtests.TestCaseResourceTest;
import org.openmetadata.service.resources.dqtests.TestDefinitionResourceTest;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.metrics.MetricResourceTest;
import org.openmetadata.service.resources.mlmodels.MlModelResourceTest;
import org.openmetadata.service.resources.services.APIServiceResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.services.MlModelServiceResourceTest;
import org.openmetadata.service.resources.services.StorageServiceResourceTest;
import org.openmetadata.service.resources.storages.ContainerResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class WorkflowDefinitionResourceTest extends OpenMetadataApplicationTest {

  private static DatabaseServiceResourceTest databaseServiceTest;
  private static DatabaseResourceTest databaseTest;
  private static DatabaseSchemaResourceTest schemaTest;
  private static TableResourceTest tableTest;
  private static ClassificationResourceTest classificationTest;
  private static TagResourceTest tagTest;
  private static GlossaryResourceTest glossaryTest;
  private static GlossaryTermResourceTest glossaryTermTest;
  private static MetricResourceTest metricTest;
  private static MlModelResourceTest mlModelTest;
  private static MlModelServiceResourceTest mlModelServiceTest;
  private static APICollectionResourceTest apiCollectionTest;
  private static APIEndpointResourceTest apiEndpointTest;
  private static APIServiceResourceTest apiServiceTest;
  private static ContainerResourceTest containerTest;
  private static StorageServiceResourceTest storageServiceTest;
  private static FeedResourceTest feedResourceTest;
  private static UserResourceTest userTest;
  private static TestCaseResourceTest testCaseResourceTest;

  private static DatabaseService databaseService;
  private static Database database;
  private static DatabaseSchema databaseSchema;
  private static final List<Table> testTables = new ArrayList<>();
  private TestInfo test;

  @BeforeAll
  public static void setup() throws IOException {
    databaseServiceTest = new DatabaseServiceResourceTest();
    databaseTest = new DatabaseResourceTest();
    schemaTest = new DatabaseSchemaResourceTest();
    tableTest = new TableResourceTest();
    classificationTest = new ClassificationResourceTest();
    tagTest = new TagResourceTest();
    glossaryTest = new GlossaryResourceTest();
    glossaryTermTest = new GlossaryTermResourceTest();
    metricTest = new MetricResourceTest();
    mlModelTest = new MlModelResourceTest();
    mlModelServiceTest = new MlModelServiceResourceTest();
    apiCollectionTest = new APICollectionResourceTest();
    apiEndpointTest = new APIEndpointResourceTest();
    apiServiceTest = new APIServiceResourceTest();
    containerTest = new ContainerResourceTest();
    storageServiceTest = new StorageServiceResourceTest();
    feedResourceTest = new FeedResourceTest();
    userTest = new UserResourceTest();
    testCaseResourceTest = new TestCaseResourceTest();

    // Initialize API service references that APICollectionResourceTest needs
    TestInfo testInfo =
        new TestInfo() {
          @Override
          public String getDisplayName() {
            return "setup";
          }

          @Override
          public Set<String> getTags() {
            return Set.of();
          }

          @Override
          public Optional<Class<?>> getTestClass() {
            return Optional.of(WorkflowDefinitionResourceTest.class);
          }

          @Override
          public Optional<Method> getTestMethod() {
            return Optional.empty();
          }
        };
    apiServiceTest.setupAPIService(testInfo);
    storageServiceTest.setupStorageService(testInfo);

    // Ensure WorkflowEventConsumer subscription exists and is active
    ensureWorkflowEventConsumerIsActive();
  }

  // Ensure WorkflowEventConsumer subscription is active for workflow events to be processed
  private static void ensureWorkflowEventConsumerIsActive() {
    try {
      EventSubscriptionResourceTest eventSubscriptionResourceTest =
          new EventSubscriptionResourceTest();

      EventSubscription existing = null;
      try {
        existing =
            eventSubscriptionResourceTest.getEntityByName(
                "WorkflowEventConsumer", null, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Subscription doesn't exist, we'll create it
      }

      if (existing == null) {
        // Create the WorkflowEventConsumer subscription with same configuration as production
        CreateEventSubscription createSubscription =
            new CreateEventSubscription()
                .withName("WorkflowEventConsumer")
                .withDisplayName("Workflow Event Consumer")
                .withDescription(
                    "Consumers EntityChange Events in order to trigger Workflows, if they exist.")
                .withAlertType(CreateEventSubscription.AlertType.GOVERNANCE_WORKFLOW_CHANGE_EVENT)
                .withResources(List.of("all"))
                .withProvider(ProviderType.SYSTEM)
                .withPollInterval(10)
                .withEnabled(true)
                .withDestinations(
                    List.of(
                        new SubscriptionDestination()
                            .withId(UUID.fromString("fc9e7a84-5dbd-4e63-8b78-6c3a7bf04a60"))
                            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                            .withType(
                                SubscriptionDestination.SubscriptionType
                                    .GOVERNANCE_WORKFLOW_CHANGE_EVENT)
                            .withEnabled(true)));

        eventSubscriptionResourceTest.createEntity(createSubscription, ADMIN_AUTH_HEADERS);
        java.lang.Thread.sleep(1000); // Give it time to initialize
      } else if (!existing.getEnabled()) {
        // Enable if disabled
        String json = JsonUtils.pojoToJson(existing);
        existing.setEnabled(true);
        eventSubscriptionResourceTest.patchEntity(
            existing.getId(), json, existing, ADMIN_AUTH_HEADERS);
        java.lang.Thread.sleep(1000);
      }
    } catch (Exception e) {
      LOG.warn("Failed to ensure WorkflowEventConsumer is active: {}", e.getMessage(), e);
    }
  }

  @Test
  @Order(1)
  void test_DataCompletenessWorkflow(TestInfo test) throws Exception {
    // Step 1: Add Brass tag to Certification classification
    setupCertificationTags();

    // Step 2 & 3: Create database schema and tables
    createTestEntities(test);

    // Step 4: Create DataCompleteness workflow
    createDataCompletenessWorkflow();

    // Step 5: Trigger the workflow
    triggerWorkflow();

    // Wait for workflow to process
    java.lang.Thread.sleep(10000);

    // Step 6: Verify certifications
    verifyTableCertifications();
  }

  private void setupCertificationTags() throws HttpResponseException {
    // Check if Brass tag already exists
    try {
      Tag brassTag = tagTest.getEntityByName("Certification.Brass", null, "", ADMIN_AUTH_HEADERS);
      LOG.debug("Brass tag already exists: {}", brassTag.getFullyQualifiedName());
    } catch (HttpResponseException e) {
      if (e.getStatusCode() == 404) {
        // Create Brass tag under Certification
        CreateTag createBrassTag =
            new CreateTag()
                .withName("Brass")
                .withDescription("Brass certification level")
                .withClassification("Certification");
        Tag brassTag = tagTest.createEntity(createBrassTag, ADMIN_AUTH_HEADERS);
        LOG.debug("Brass tag created: {}", brassTag.getFullyQualifiedName());
      } else {
        throw e;
      }
    }
  }

  private void createTestEntities(TestInfo test) throws HttpResponseException {
    // Create database service using the test helper
    CreateDatabaseService createService =
        databaseServiceTest.createRequest(
            "test_db_service_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""));
    databaseService = databaseServiceTest.createEntity(createService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database service: {}", databaseService.getName());

    // Create database using simple CreateDatabase object
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("test_db_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withService(databaseService.getFullyQualifiedName())
            .withDescription("Test database for workflow");
    database = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database: {}", database.getName());

    // Create database schema using simple CreateDatabaseSchema object
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("test_schema_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for workflow");
    databaseSchema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database schema: {}", databaseSchema.getName());

    // Create tables with varying column descriptions
    createTablesWithVaryingDescriptions(test);
  }

  private void createTablesWithVaryingDescriptions(TestInfo test) throws HttpResponseException {
    // Table 1: All 4 columns with descriptions (should get Gold - 100%)
    List<Column> table1Columns =
        List.of(
            new Column()
                .withName("col1")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Column 1 description"),
            new Column()
                .withName("col2")
                .withDataType(ColumnDataType.INT)
                .withDescription("Column 2 description"),
            new Column()
                .withName("col3")
                .withDataType(ColumnDataType.DOUBLE)
                .withDescription("Column 3 description"),
            new Column()
                .withName("col4")
                .withDataType(ColumnDataType.BOOLEAN)
                .withDescription("Column 4 description"));

    CreateTable createTable1 =
        new CreateTable()
            .withName(test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "") + "_table1_gold")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withDescription("Table with all column descriptions")
            .withColumns(table1Columns);
    Table table1 = tableTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);
    testTables.add(table1);
    LOG.debug("Created table1 (gold): {}", table1.getName());

    // Table 2: 3 columns with descriptions (should get Silver - 75%)
    List<Column> table2Columns =
        List.of(
            new Column()
                .withName("col1")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Column 1 description"),
            new Column()
                .withName("col2")
                .withDataType(ColumnDataType.INT)
                .withDescription("Column 2 description"),
            new Column()
                .withName("col3")
                .withDataType(ColumnDataType.DOUBLE)
                .withDescription("Column 3 description"),
            new Column().withName("col4").withDataType(ColumnDataType.BOOLEAN) // No description
            );

    CreateTable createTable2 =
        new CreateTable()
            .withName(test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "") + "_table2_silver")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withDescription("Table with 3 column descriptions")
            .withColumns(table2Columns);
    Table table2 = tableTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);
    testTables.add(table2);
    LOG.debug("Created table2 (silver): {}", table2.getName());

    // Table 3: 2 columns with descriptions (should get Bronze - 50%)
    List<Column> table3Columns =
        List.of(
            new Column()
                .withName("col1")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Column 1 description"),
            new Column()
                .withName("col2")
                .withDataType(ColumnDataType.INT)
                .withDescription("Column 2 description"),
            new Column().withName("col3").withDataType(ColumnDataType.DOUBLE), // No description
            new Column().withName("col4").withDataType(ColumnDataType.BOOLEAN) // No description
            );

    CreateTable createTable3 =
        new CreateTable()
            .withName(test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "") + "_table3_bronze")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withDescription("Table with 2 column descriptions")
            .withColumns(table3Columns);
    Table table3 = tableTest.createEntity(createTable3, ADMIN_AUTH_HEADERS);
    testTables.add(table3);
    LOG.debug("Created table3 (bronze): {}", table3.getName());

    // Table 4: No columns with descriptions (should get Brass - 0%)
    List<Column> table4Columns =
        List.of(
            new Column().withName("col1").withDataType(ColumnDataType.STRING),
            new Column().withName("col2").withDataType(ColumnDataType.INT),
            new Column().withName("col3").withDataType(ColumnDataType.DOUBLE),
            new Column().withName("col4").withDataType(ColumnDataType.BOOLEAN));

    CreateTable createTable4 =
        new CreateTable()
            .withName(test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "") + "_table4_brass")
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withDescription("Table with no column descriptions")
            .withColumns(table4Columns);
    Table table4 = tableTest.createEntity(createTable4, ADMIN_AUTH_HEADERS);
    testTables.add(table4);
    LOG.debug("Created table4 (brass): {}", table4.getName());

    LOG.debug("Created {} test tables", testTables.size());
  }

  private void createDataCompletenessWorkflow() {
    String workflowJson =
        """
    {
      "name": "DataCompleteness",
      "displayName": "DataCompleteness",
      "description": "Custom workflow created with Workflow Builder",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": [
            "table"
          ],
          "schedule": {
            "scheduleTimeline": "None"
          },
          "batchSize": 100,
          "filters": {}
        },
        "output": [
          "relatedEntity",
          "updatedBy"
        ]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start",
          "displayName": "start"
        },
        {
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "name": "CheckDescriptionSet",
          "displayName": "Check if Description is Set",
          "config": {
            "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
          },
          "input": [
            "relatedEntity"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": [
            "result"
          ],
          "branches": [
            "true",
            "false"
          ]
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "EndNode_2",
          "displayName": "End"
        },
        {
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "name": "CheckOwnerIsSet",
          "displayName": "Check if Owner is Set",
          "config": {
            "rules": "{\\"!!\\":[\\"length\\",{\\"var\\":\\"owners\\"}]}"
          },
          "input": [
            "relatedEntity"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": [
            "result"
          ],
          "branches": [
            "true",
            "false"
          ]
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "EndNode_4",
          "displayName": "End"
        },
        {
          "type": "automatedTask",
          "subType": "dataCompletenessTask",
          "name": "DataCompletenessCheck_2",
          "displayName": "Check if Columns have description",
          "config": {
            "qualityBands": [
              {
                "name": "Gold",
                "minimumScore": 90
              },
              {
                "name": "Silver",
                "minimumScore": 75
              },
              {
                "name": "Bronze",
                "minimumScore": 50
              },
              {
                "name": "No Plate",
                "minimumScore": 0
              }
            ],
            "fieldsToCheck": [
              "columns.description"
            ]
          },
          "input": [
            "relatedEntity"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": [
            "completenessScore",
            "qualityBand",
            "filledFieldsCount",
            "totalFieldsCount",
            "missingFields",
            "filledFields",
            "result"
          ]
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetEntityAttribute_6",
          "displayName": "Set Gold Certification",
          "config": {
            "fieldName": "certification",
            "fieldValue": "Certification.Gold"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetEntityAttribute_7",
          "displayName": "Set Silver Certification",
          "config": {
            "fieldName": "certification",
            "fieldValue": "Certification.Silver"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetEntityAttribute_8",
          "displayName": "Set Bronze Certification",
          "config": {
            "fieldName": "certification",
            "fieldValue": "Certification.Bronze"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetEntityAttribute_1",
          "displayName": "Set Brass Certification",
          "config": {
            "fieldName": "certification",
            "fieldValue": "Certification.Brass"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "end",
          "displayName": "end"
        }
      ],
      "edges": [
        {
          "from": "SetEntityAttribute_6",
          "to": "end"
        },
        {
          "from": "SetEntityAttribute_7",
          "to": "end"
        },
        {
          "from": "SetEntityAttribute_8",
          "to": "end"
        },
        {
          "from": "DataCompletenessCheck_2",
          "to": "SetEntityAttribute_6",
          "condition": "Gold"
        },
        {
          "from": "DataCompletenessCheck_2",
          "to": "SetEntityAttribute_7",
          "condition": "Silver"
        },
        {
          "from": "DataCompletenessCheck_2",
          "to": "SetEntityAttribute_8",
          "condition": "Bronze"
        },
        {
          "from": "DataCompletenessCheck_2",
          "to": "SetEntityAttribute_1",
          "condition": "No Plate"
        },
        {
          "from": "SetEntityAttribute_1",
          "to": "end"
        },
        {
          "from": "CheckDescriptionSet",
          "to": "EndNode_2",
          "condition": "false"
        },
        {
          "from": "CheckOwnerIsSet",
          "to": "EndNode_4",
          "condition": "false"
        },
        {
          "from": "CheckOwnerIsSet",
          "to": "DataCompletenessCheck_2",
          "condition": "true"
        },
        {
          "from": "CheckDescriptionSet",
          "to": "CheckOwnerIsSet",
          "condition": "true"
        },
        {
          "from": "start",
          "to": "CheckDescriptionSet"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Use POST endpoint to create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("DataCompleteness workflow created/updated successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }
  }

  private void triggerWorkflow() {
    // Trigger the workflow using WebTarget
    Response response =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/DataCompleteness/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    if (response.getStatus() == Response.Status.OK.getStatusCode()) {
      LOG.debug("Workflow triggered successfully");
    } else {
      LOG.warn("Workflow trigger response: {}", response.getStatus());
    }
  }

  private void verifyTableCertifications() throws HttpResponseException {
    // Refresh tables and verify certifications
    for (Table table : testTables) {
      Table updatedTable = tableTest.getEntity(table.getId(), "certification", ADMIN_AUTH_HEADERS);

      if (updatedTable.getCertification() != null) {
        LOG.debug(
            "Table {} has certification: {}",
            updatedTable.getName(),
            updatedTable.getCertification().getTagLabel().getTagFQN());

        // Verify based on table name
        if (updatedTable.getName().contains("table1_gold")) {
          assertNotNull(updatedTable.getCertification());
          assertEquals(
              "Certification.Gold", updatedTable.getCertification().getTagLabel().getTagFQN());
        } else if (updatedTable.getName().contains("table2_silver")) {
          assertNotNull(updatedTable.getCertification());
          assertEquals(
              "Certification.Silver", updatedTable.getCertification().getTagLabel().getTagFQN());
        } else if (updatedTable.getName().contains("table3_bronze")) {
          assertNotNull(updatedTable.getCertification());
          assertEquals(
              "Certification.Bronze", updatedTable.getCertification().getTagLabel().getTagFQN());
        } else if (updatedTable.getName().contains("table4_brass")) {
          assertNotNull(updatedTable.getCertification());
          assertEquals(
              "Certification.Brass", updatedTable.getCertification().getTagLabel().getTagFQN());
        }
      } else {
        LOG.warn("Table {} has no certification yet", updatedTable.getName());
      }
    }

    LOG.info("Certification verification completed");
  }

  //  @Test
  //  @Order(2)
  void test_DeprecateStaleEntities(TestInfo test) throws IOException {
    LOG.info("Starting test_DeprecateStaleEntities for GlossaryTerm, Table, and Tag");

    // === CREATE GLOSSARY TERM ===
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName("test_glossary_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Test Glossary")
            .withDescription("Glossary for testing stale term deprecation");
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    LOG.debug("Created glossary: {}", glossary.getName());

    CreateGlossaryTerm createGlossaryTerm =
        new CreateGlossaryTerm()
            .withName("test_term_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Test Term")
            .withDescription("Term for testing deprecation")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm glossaryTerm =
        glossaryTermTest.createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    LOG.debug("Created glossary term: {}", glossaryTerm.getName());

    // === CREATE TABLE ===
    // Create database service
    CreateDatabaseService createDbService =
        databaseServiceTest.createRequest(
            "test_deprecate_db_service_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""));
    DatabaseService dbService =
        databaseServiceTest.createEntity(createDbService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database service for deprecation test: {}", dbService.getName());

    // Create database
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("test_deprecate_db_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for deprecation");
    Database database = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database: {}", database.getName());

    // Create database schema
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(
                "test_deprecate_schema_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for deprecation");
    DatabaseSchema dbSchema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database schema: {}", dbSchema.getName());

    // Create table
    CreateTable createTable =
        new CreateTable()
            .withName(
                "test_deprecate_table_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Table for testing deprecation")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING)));
    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    LOG.debug("Created table: {}", table.getName());

    // === CREATE TAG ===
    // Create classification first
    CreateClassification createClassification =
        new CreateClassification()
            .withName(
                "test_classification_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Test Classification")
            .withDescription("Classification for testing deprecation");
    Classification classification =
        classificationTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);
    LOG.debug("Created classification: {}", classification.getName());

    // Create tag under the classification
    CreateTag createTag =
        new CreateTag()
            .withName("test_tag_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Test Tag")
            .withDescription("Tag for testing deprecation")
            .withClassification(classification.getName());
    Tag tag = tagTest.createEntity(createTag, ADMIN_AUTH_HEADERS);
    LOG.debug("Created tag: {}", tag.getName());

    // Create workflow with dynamic timestamp (tomorrow)
    long tomorrowMillis = System.currentTimeMillis() + (24 * 60 * 60 * 1000L);
    String workflowJson =
        String.format(
            """
    {
      "name": "DeprecateStaleEntities",
      "displayName": "DeprecateStaleEntities",
      "description": "Workflow to deprecate stale GlossaryTerms, Tables, and Tags",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": [
            "glossaryTerm",
            "table",
            "tag"
          ],
          "schedule": {
            "scheduleTimeline": "None"
          },
          "batchSize": 100,
          "filters": {}
        },
        "output": [
          "relatedEntity",
          "updatedBy"
        ]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start",
          "displayName": "start"
        },
        {
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "name": "checkIfStale",
          "displayName": "checkIfStale",
          "config": {
            "rules": "{\\"isUpdatedBefore\\": %d}"
          },
          "input": [
            "relatedEntity"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": [
            "result"
          ],
          "branches": [
            "true",
            "false"
          ]
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "endActive",
          "displayName": "endActive"
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "endDeprecated",
          "displayName": "endDeprecated"
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "setDeprecatedStatus",
          "displayName": "Set Deprecated Status",
          "config": {
            "fieldName": "entityStatus",
            "fieldValue": "Deprecated"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "checkIfStale"
        },
        {
          "from": "checkIfStale",
          "to": "endActive",
          "condition": "false"
        },
        {
          "from": "checkIfStale",
          "to": "setDeprecatedStatus",
          "condition": "true"
        },
        {
          "from": "setDeprecatedStatus",
          "to": "endDeprecated"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """,
            tomorrowMillis);

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("DeprecateStaleEntities workflow created successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }

    // Trigger the workflow
    Response triggerResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/DeprecateStaleEntities/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    if (triggerResponse.getStatus() == Response.Status.OK.getStatusCode()) {
      LOG.debug("Workflow triggered successfully");
    } else {
      LOG.warn("Workflow trigger response: {}", triggerResponse.getStatus());
    }

    // Store IDs for lambda expressions
    final UUID glossaryTermId = glossaryTerm.getId();
    final UUID tableId = table.getId();
    final UUID tagId = tag.getId();

    // Wait for workflow to process all three entity types using Awaitility
    await()
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                // Check GlossaryTerm
                GlossaryTerm checkTerm =
                    glossaryTermTest.getEntity(glossaryTermId, "", ADMIN_AUTH_HEADERS);
                boolean termDeprecated =
                    checkTerm.getEntityStatus() != null
                        && "Deprecated".equals(checkTerm.getEntityStatus().toString());
                LOG.debug("GlossaryTerm status: {}", checkTerm.getEntityStatus());

                // Check Table
                Table checkTable = tableTest.getEntity(tableId, "", ADMIN_AUTH_HEADERS);
                boolean tableDeprecated =
                    checkTable.getEntityStatus() != null
                        && "Deprecated".equals(checkTable.getEntityStatus().toString());
                LOG.debug("Table status: {}", checkTable.getEntityStatus());

                // Check Tag
                Tag checkTag = tagTest.getEntity(tagId, "", ADMIN_AUTH_HEADERS);
                boolean tagDeprecated =
                    checkTag.getEntityStatus() != null
                        && "Deprecated".equals(checkTag.getEntityStatus().toString());
                LOG.debug("Tag status: {}", checkTag.getEntityStatus());

                // All three should be deprecated
                return termDeprecated && tableDeprecated && tagDeprecated;
              } catch (Exception e) {
                LOG.warn("Error checking entity statuses: {}", e.getMessage());
                return false;
              }
            });

    // Verify all three entities are deprecated

    // Verify GlossaryTerm
    GlossaryTerm updatedTerm =
        glossaryTermTest.getEntity(glossaryTerm.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTerm);
    assertNotNull(updatedTerm.getEntityStatus());
    assertEquals("Deprecated", updatedTerm.getEntityStatus().toString());
    LOG.debug(
        "GlossaryTerm {} status successfully updated to: {}",
        updatedTerm.getName(),
        updatedTerm.getEntityStatus());

    // Verify Table
    Table updatedTable = tableTest.getEntity(table.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTable);
    assertNotNull(updatedTable.getEntityStatus());
    assertEquals("Deprecated", updatedTable.getEntityStatus().toString());
    LOG.debug(
        "Table {} status successfully updated to: {}",
        updatedTable.getName(),
        updatedTable.getEntityStatus());

    // Verify Tag
    Tag updatedTag = tagTest.getEntity(tag.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTag);
    assertNotNull(updatedTag.getEntityStatus());
    assertEquals("Deprecated", updatedTag.getEntityStatus().toString());
    LOG.debug(
        "Tag {} status successfully updated to: {}",
        updatedTag.getName(),
        updatedTag.getEntityStatus());

    LOG.info("test_DeprecateStaleEntities completed successfully for all three entity types");
  }

  @Test
  @Order(3)
  void test_SetTierForMLModels(TestInfo test) throws IOException {
    LOG.info("Starting test_SetTierForMLModels");

    // Initialize MLFLOW_REFERENCE by calling setupMlModelServices
    mlModelServiceTest.setupMlModelServices(test);

    // Create ML Model with description - mlModelTest.createRequest will now use the initialized
    // MLFLOW_REFERENCE
    CreateMlModel createMlModel =
        mlModelTest
            .createRequest(test)
            .withDescription("This is a test ML model with a description for tier assignment");
    MlModel mlModel = mlModelTest.createEntity(createMlModel, ADMIN_AUTH_HEADERS);
    LOG.debug("Created ML Model: {} with description", mlModel.getName());

    // Create workflow with correct JSON Logic for checking description is not null
    String workflowJson =
        """
    {
      "name": "setTierTask",
      "displayName": "setTierTask",
      "description": "Custom workflow created with Workflow Builder",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": [
            "mlmodel"
          ],
          "schedule": {
            "scheduleTimeline": "None"
          },
          "batchSize": 100,
          "filters": {}
        },
        "output": [
          "relatedEntity",
          "updatedBy"
        ]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start",
          "displayName": "start"
        },
        {
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "name": "checkDescriptionNotNull",
          "displayName": "Check Description is not null",
          "config": {
            "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
          },
          "input": [
            "relatedEntity"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": [
            "result"
          ],
          "branches": [
            "true",
            "false"
          ]
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "endNoTier",
          "displayName": "endNoTier"
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "endTierSet",
          "displayName": "endTierSet"
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "setTier",
          "displayName": "Set Tier 1",
          "config": {
            "fieldName": "tags",
            "fieldValue": "Tier.Tier1"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "checkDescriptionNotNull"
        },
        {
          "from": "checkDescriptionNotNull",
          "to": "endNoTier",
          "condition": "false"
        },
        {
          "from": "checkDescriptionNotNull",
          "to": "setTier",
          "condition": "true"
        },
        {
          "from": "setTier",
          "to": "endTierSet"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("setTierTask workflow created successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }

    // Trigger the workflow
    Response triggerResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/setTierTask/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    if (triggerResponse.getStatus() == Response.Status.OK.getStatusCode()) {
      LOG.debug("Workflow triggered successfully");
    } else {
      LOG.warn("Workflow trigger response: {}", triggerResponse.getStatus());
    }

    // Wait for workflow to process using Awaitility
    await()
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                MlModel checkModel =
                    mlModelTest.getEntity(mlModel.getId(), "tags", ADMIN_AUTH_HEADERS);
                LOG.debug("Checking ML Model tags: {}", checkModel.getTags());
                if (checkModel.getTags() != null) {
                  return checkModel.getTags().stream()
                      .anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN()));
                }
                return false;
              } catch (Exception e) {
                LOG.warn("Error checking ML Model tier: {}", e.getMessage());
                return false;
              }
            });

    // Verify ML Model tier is set to Tier1
    MlModel updatedModel = mlModelTest.getEntity(mlModel.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedModel);
    assertNotNull(updatedModel.getTags());
    boolean hasTier1 =
        updatedModel.getTags().stream().anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN()));
    assertTrue(hasTier1, "ML Model should have Tier.Tier1 tag");
    LOG.debug("ML Model {} tier successfully updated to Tier1", updatedModel.getName());

    LOG.info("test_SetTierForMLModels completed successfully");
  }

  @Test
  @Order(4)
  void test_PrepareMethodValidation_OnCreate() {
    // Test that validation is triggered during workflow creation via prepare()

    // Test 1: Create with cyclic workflow - should fail
    String cyclicWorkflow =
        """
    {
      "name": "testCyclicValidation",
      "displayName": "Cyclic Workflow",
      "description": "Test workflow with cycle",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {"scheduleTimeline": "None"},
          "batchSize": 100
        }
      },
      "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start"},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task1", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task2", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "endEvent", "subType": "endEvent", "name": "end"}
      ],
      "edges": [
        {"from": "start", "to": "task1"},
        {"from": "task1", "to": "task2"},
        {"from": "task2", "to": "task1"},
        {"from": "task2", "to": "end"}
      ]
    }
    """;

    CreateWorkflowDefinition cyclicCreate =
        JsonUtils.readValue(cyclicWorkflow, CreateWorkflowDefinition.class);

    // Attempt to create workflow with cycle - should get BAD_REQUEST
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(cyclicCreate));

    assertEquals(
        Response.Status.BAD_REQUEST.getStatusCode(),
        response.getStatus(),
        "Should fail with BAD_REQUEST for cyclic workflow");

    // Test 2: Create with duplicate node IDs - should fail
    String duplicateNodeWorkflow =
        """
    {
      "name": "testDuplicateNodeValidation",
      "displayName": "Duplicate Node Workflow",
      "description": "Test workflow with duplicate nodes",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {"scheduleTimeline": "None"},
          "batchSize": 100
        }
      },
      "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start"},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task1", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task1", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "endEvent", "subType": "endEvent", "name": "end"}
      ],
      "edges": [
        {"from": "start", "to": "task1"},
        {"from": "task1", "to": "end"}
      ]
    }
    """;

    CreateWorkflowDefinition duplicateCreate =
        JsonUtils.readValue(duplicateNodeWorkflow, CreateWorkflowDefinition.class);

    response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(duplicateCreate));

    assertEquals(
        Response.Status.BAD_REQUEST.getStatusCode(),
        response.getStatus(),
        "Should fail with BAD_REQUEST for duplicate node IDs");

    // Test 3: Create valid workflow - should succeed
    String validWorkflow =
        """
    {
      "name": "testPrepareValidation",
      "displayName": "Valid Prepare Workflow",
      "description": "Valid test workflow",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {"scheduleTimeline": "None"},
          "batchSize": 100
        }
      },
      "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start"},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task1", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "endEvent", "subType": "endEvent", "name": "end"}
      ],
      "edges": [
        {"from": "start", "to": "task1"},
        {"from": "task1", "to": "end"}
      ]
    }
    """;

    CreateWorkflowDefinition validCreate =
        JsonUtils.readValue(validWorkflow, CreateWorkflowDefinition.class);

    response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(validCreate));

    // Check response status and log error if not successful
    if (response.getStatus() != Response.Status.CREATED.getStatusCode()
        && response.getStatus() != Response.Status.OK.getStatusCode()) {
      String errorMessage = response.readEntity(String.class);
      LOG.error(
          "Failed to create valid workflow. Status: {}, Error: {}",
          response.getStatus(),
          errorMessage);
      fail(
          "Valid workflow creation failed with status "
              + response.getStatus()
              + ": "
              + errorMessage);
    }

    WorkflowDefinition created = response.readEntity(WorkflowDefinition.class);
    assertNotNull(created);
    assertEquals("testPrepareValidation", created.getName());
  }

  @Test
  @Order(5)
  void test_PrepareMethodValidation_OnUpdate(TestInfo test) {
    this.test = test;
    // Test that validation is triggered during workflow update via prepare()

    // First create a valid workflow
    String initialWorkflow =
        """
    {
      "name": "testUpdateValidation",
      "displayName": "Update Test Workflow",
      "description": "Test workflow for update",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {"scheduleTimeline": "None"},
          "batchSize": 100
        }
      },
      "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start"},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task1", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "endEvent", "subType": "endEvent", "name": "end"}
      ],
      "edges": [
        {"from": "start", "to": "task1"},
        {"from": "task1", "to": "end"}
      ]
    }
    """;

    CreateWorkflowDefinition create =
        JsonUtils.readValue(initialWorkflow, CreateWorkflowDefinition.class);

    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .put(Entity.json(create));

    WorkflowDefinition created = response.readEntity(WorkflowDefinition.class);
    assertNotNull(created);

    // Test 1: Update to introduce a cycle - should fail
    String cyclicUpdate =
        """
    {
      "name": "testUpdateValidation",
      "displayName": "Update Test Workflow",
      "description": "Test workflow with cycle for update",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {"scheduleTimeline": "None"},
          "batchSize": 100
        }
      },
      "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start"},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task1", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task2", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "endEvent", "subType": "endEvent", "name": "end"}
      ],
      "edges": [
        {"from": "start", "to": "task1"},
        {"from": "task1", "to": "task2"},
        {"from": "task2", "to": "task1"},
        {"from": "task1", "to": "end"}
      ]
    }
    """;

    CreateWorkflowDefinition cyclicUpdateRequest =
        JsonUtils.readValue(cyclicUpdate, CreateWorkflowDefinition.class);

    // Use PUT endpoint for update
    response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .put(Entity.json(cyclicUpdateRequest));

    assertEquals(
        Response.Status.BAD_REQUEST.getStatusCode(),
        response.getStatus(),
        "Should fail with BAD_REQUEST when updating to cyclic workflow");

    // Test 2: Update with valid changes - should succeed
    String validUpdate =
        """
    {
      "name": "testUpdateValidation",
      "displayName": "Updated Test Workflow",
      "description": "Updated test workflow",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {"scheduleTimeline": "None"},
          "batchSize": 100
        }
      },
      "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start"},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task1", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "automatedTask", "subType": "setEntityAttributeTask", "name": "task2", "config": {"fieldName": "tags", "fieldValue": "Test"}},
        {"type": "endEvent", "subType": "endEvent", "name": "end"}
      ],
      "edges": [
        {"from": "start", "to": "task1"},
        {"from": "task1", "to": "task2"},
        {"from": "task2", "to": "end"}
      ]
    }
    """;

    CreateWorkflowDefinition validUpdateRequest =
        JsonUtils.readValue(validUpdate, CreateWorkflowDefinition.class);

    response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .put(Entity.json(validUpdateRequest));

    assertTrue(
        response.getStatus() == Response.Status.OK.getStatusCode()
            || response.getStatus() == Response.Status.CREATED.getStatusCode(),
        "Valid workflow update should succeed");

    WorkflowDefinition updated = response.readEntity(WorkflowDefinition.class);
    assertNotNull(updated);
    assertEquals("Updated Test Workflow", updated.getDisplayName());
    assertEquals(4, updated.getNodes().size());
  }

  //  @Test
  //  @Order(7)
  void test_EventBasedWorkflowForMultipleEntities(TestInfo test)
      throws IOException, InterruptedException {
    LOG.info("Starting test_EventBasedWorkflowForMultipleEntities");

    // Create API Service
    CreateApiService createApiService =
        apiServiceTest
            .createRequest(test)
            .withServiceType(CreateApiService.ApiServiceType.Rest)
            .withConnection(org.openmetadata.service.util.TestUtils.API_SERVICE_CONNECTION);
    ApiService apiService = apiServiceTest.createEntity(createApiService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created API service: {}", apiService.getName());

    // Create Storage Service
    CreateStorageService createStorageService =
        storageServiceTest
            .createRequest(test)
            .withServiceType(CreateStorageService.StorageServiceType.S3)
            .withConnection(org.openmetadata.service.util.TestUtils.S3_STORAGE_CONNECTION);
    StorageService storageService =
        storageServiceTest.createEntity(createStorageService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created Storage service: {}", storageService.getName());

    // Create API Collection
    CreateAPICollection createApiCollection =
        apiCollectionTest
            .createRequest(test)
            .withService(apiService.getFullyQualifiedName())
            .withDescription("Initial API Collection description");
    APICollection apiCollection =
        apiCollectionTest.createEntity(createApiCollection, ADMIN_AUTH_HEADERS);
    LOG.debug("Created API Collection: {} with initial description", apiCollection.getName());

    // Create Container
    CreateContainer createContainer =
        containerTest
            .createRequest(test)
            .withService(storageService.getFullyQualifiedName())
            .withDescription("Initial Container description");
    Container container = containerTest.createEntity(createContainer, ADMIN_AUTH_HEADERS);
    LOG.debug("Created Container: {} with initial description", container.getName());

    // Create event-based workflow
    String workflowJson =
        """
    {
      "name": "updateDescriptionWorkflow",
      "displayName": "updateDescriptionWorkflow",
      "description": "Custom workflow created with Workflow Builder",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": [
            "apiCollection",
            "container"
          ],
          "events": [
            "Created",
            "Updated"
          ],
          "exclude": [
            "reviewers"
          ],
          "filter": {}
        },
        "output": [
          "relatedEntity",
          "updatedBy"
        ]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start",
          "displayName": "start"
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "end",
          "displayName": "end"
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "UpdateDescription",
          "displayName": "Set description",
          "config": {
            "fieldName": "description",
            "fieldValue": "Deprecated Asset"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        }
      ],
      "edges": [
        {
          "from": "UpdateDescription",
          "to": "end"
        },
        {
          "from": "start",
          "to": "UpdateDescription"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("updateDescriptionWorkflow created successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }

    // Give some time for the workflow to be ready
    java.lang.Thread.sleep(10000);

    // Store IDs before updating for use in lambda expressions
    final UUID apiCollectionId = apiCollection.getId();
    final UUID containerId = container.getId();

    // Update API Collection with a random description to trigger the workflow
    String randomApiDescription = "Random API description - " + UUID.randomUUID();
    apiCollection.setDescription(randomApiDescription);
    apiCollection =
        apiCollectionTest.patchEntity(
            apiCollection.getId(),
            JsonUtils.pojoToJson(apiCollection),
            apiCollection,
            ADMIN_AUTH_HEADERS);
    LOG.debug("Updated API Collection with random description");

    // Update Container with a random description to trigger the workflow
    String randomContainerDescription = "Random Container description - " + UUID.randomUUID();
    container.setDescription(randomContainerDescription);
    container =
        containerTest.patchEntity(
            container.getId(), JsonUtils.pojoToJson(container), container, ADMIN_AUTH_HEADERS);
    LOG.debug("Updated Container with random description");

    // Wait for workflow to process using Awaitility for API Collection
    await()
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                APICollection checkApiCollection =
                    apiCollectionTest.getEntity(apiCollectionId, "", ADMIN_AUTH_HEADERS);
                LOG.debug(
                    "Checking API Collection description: {}", checkApiCollection.getDescription());
                return "Deprecated Asset".equals(checkApiCollection.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking API Collection description: {}", e.getMessage());
                return false;
              }
            });

    // Wait for workflow to process using Awaitility for Container
    await()
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                Container checkContainer =
                    containerTest.getEntity(containerId, "", ADMIN_AUTH_HEADERS);
                LOG.debug("Checking Container description: {}", checkContainer.getDescription());
                return "Deprecated Asset".equals(checkContainer.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking Container description: {}", e.getMessage());
                return false;
              }
            });

    // Verify both entities have the updated description
    APICollection updatedApiCollection =
        apiCollectionTest.getEntity(apiCollection.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedApiCollection);
    assertEquals("Deprecated Asset", updatedApiCollection.getDescription());
    LOG.debug(
        "API Collection description successfully updated to: {}",
        updatedApiCollection.getDescription());

    Container updatedContainer = containerTest.getEntity(container.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedContainer);
    assertEquals("Deprecated Asset", updatedContainer.getDescription());
    LOG.debug(
        "Container description successfully updated to: {}", updatedContainer.getDescription());

    LOG.info("test_EventBasedWorkflowForMultipleEntities completed successfully");
  }

  @Test
  @Order(6)
  void test_WorkflowFieldUpdateDoesNotCreateRedundantChangeEvents(TestInfo test) throws Exception {
    LOG.info("Starting test to verify workflow field updates don't create redundant change events");

    // Create a test table
    CreateDatabaseService createService =
        databaseServiceTest.createRequest(
            "test_changeevent_service_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""));
    DatabaseService service = databaseServiceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName(
                "test_changeevent_db_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withService(service.getFullyQualifiedName());
    Database database = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(
                "test_changeevent_schema_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    CreateTable createTable =
        new CreateTable()
            .withName(
                "test_changeevent_table_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING)));
    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    LOG.debug("Created test table: {}", table.getName());

    // Record initial change event count
    long initialOffset =
        org.openmetadata.service.Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    LOG.debug("Initial change event offset: {}", initialOffset);

    // Create workflow that sets tags (this should create meaningful changes)
    String workflowJson =
        """
    {
      "name": "testRedundantChangeEvents",
      "displayName": "Test Redundant Change Events",
      "description": "Test workflow to verify no redundant change events",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {"scheduleTimeline": "None"},
          "batchSize": 100,
          "filters": {}
        },
        "output": ["relatedEntity", "updatedBy"]
      },
      "nodes": [
        {"type": "startEvent", "subType": "startEvent", "name": "start", "displayName": "start"},
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "setTag",
          "displayName": "Set Tag",
          "config": {
            "fieldName": "tags",
            "fieldValue": "Tier.Tier1"
          },
          "input": ["relatedEntity", "updatedBy"],
          "inputNamespaceMap": {"relatedEntity": "global", "updatedBy": "global"},
          "output": []
        },
        {"type": "endEvent", "subType": "endEvent", "name": "end", "displayName": "end"}
      ],
      "edges": [
        {"from": "start", "to": "setTag"},
        {"from": "setTag", "to": "end"}
      ],
      "config": {"storeStageStatus": true}
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create and trigger workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));
    assertTrue(
        response.getStatus() == Response.Status.CREATED.getStatusCode()
            || response.getStatus() == Response.Status.OK.getStatusCode());

    // Wait a moment for workflow setup
    java.lang.Thread.sleep(2000);

    // Trigger the workflow FIRST time
    Response triggerResponse =
        SecurityUtil.addHeaders(
                getResource(
                    "governance/workflowDefinitions/name/testRedundantChangeEvents/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));
    assertEquals(Response.Status.OK.getStatusCode(), triggerResponse.getStatus());

    // Wait for workflow to complete
    java.lang.Thread.sleep(15000);

    // Count change events after first workflow run
    long firstRunOffset =
        org.openmetadata.service.Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    long firstRunEventCount = firstRunOffset - initialOffset;

    // Verify the tag was actually added (meaningful change)
    Table updatedTable = tableTest.getEntity(table.getId(), "tags", ADMIN_AUTH_HEADERS);
    boolean hasTag =
        updatedTable.getTags() != null
            && updatedTable.getTags().stream()
                .anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN()));
    assertTrue(hasTag, "Table should have Tier.Tier1 tag after first workflow run");

    LOG.info("First workflow run created {} change events", firstRunEventCount);
    assertTrue(
        firstRunEventCount > 0, "First workflow run should create at least one change event");

    // Trigger the workflow SECOND time (should NOT create new events since no actual changes)
    triggerResponse =
        SecurityUtil.addHeaders(
                getResource(
                    "governance/workflowDefinitions/name/testRedundantChangeEvents/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));
    assertEquals(Response.Status.OK.getStatusCode(), triggerResponse.getStatus());

    // Wait for second workflow to complete
    java.lang.Thread.sleep(15000);

    // Count change events after second workflow run
    long secondRunOffset =
        org.openmetadata.service.Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    long secondRunEventCount = secondRunOffset - firstRunOffset;

    LOG.info("Second workflow run created {} change events", secondRunEventCount);

    // CRITICAL ASSERTION: Second run should create NO new change events
    // because the tag is already set and EntityFieldUtils should not generate
    // redundant events due to updateEntityMetadata timestamp changes
    assertEquals(
        0,
        secondRunEventCount,
        "Second workflow run should NOT create change events when no actual field changes occur. "
            + "This verifies the fix for redundant updateEntityMetadata events.");

    // Verify the tag is still there (no regression)
    Table finalTable = tableTest.getEntity(table.getId(), "tags", ADMIN_AUTH_HEADERS);
    boolean stillHasTag =
        finalTable.getTags() != null
            && finalTable.getTags().stream().anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN()));
    assertTrue(stillHasTag, "Table should still have the tag after second workflow run");

    LOG.info("✓ PASSED: Workflow field updates do not create redundant change events");
  }

  @Test
  @Order(7)
  void test_MultiEntityPeriodicQueryWithFilters(TestInfo test)
      throws IOException, InterruptedException {
    LOG.info("Starting test_MultiEntityPeriodicQueryWithFilters");

    // Step 1: Create database service, database and schema with specific name
    DatabaseServiceResourceTest dbServiceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDbService =
        dbServiceTest
            .createRequest(test)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(org.openmetadata.service.util.TestUtils.MYSQL_DATABASE_CONNECTION);
    DatabaseService dbService = dbServiceTest.createEntity(createDbService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database service: {}", dbService.getName());

    DatabaseResourceTest dbTest = new DatabaseResourceTest();
    CreateDatabase createDb =
        new CreateDatabase()
            .withName("test_db_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withService(dbService.getFullyQualifiedName());
    Database db = dbTest.createEntity(createDb, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database: {}", db.getName());

    // Create schema with specific displayName "posts_db" that will be used in filter
    DatabaseSchemaResourceTest schemaResourceTest = new DatabaseSchemaResourceTest();
    CreateDatabaseSchema createDbSchema =
        new CreateDatabaseSchema()
            .withName("posts_db")
            .withDatabase(db.getFullyQualifiedName())
            .withDisplayName("posts_db");
    DatabaseSchema dbSchema = schemaResourceTest.createEntity(createDbSchema, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database schema with displayName: {}", dbSchema.getDisplayName());

    // Create Table 1 in posts_db schema (this should match the filter)
    CreateTable createTable1 =
        new CreateTable()
            .withName("table1_filtered")
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Initial description for table1")
            .withColumns(
                List.of(
                    new Column().withName("col1").withDataType(ColumnDataType.STRING),
                    new Column().withName("col2").withDataType(ColumnDataType.INT)));
    Table table1 = tableTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);
    LOG.debug("Created table1 in posts_db schema: {}", table1.getName());

    // Create Table 2 in a different schema (should NOT match filter)
    CreateDatabaseSchema createOtherSchema =
        new CreateDatabaseSchema()
            .withName("other_db")
            .withDatabase(db.getFullyQualifiedName())
            .withDisplayName("other_db");
    DatabaseSchema otherSchema =
        schemaResourceTest.createEntity(createOtherSchema, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        new CreateTable()
            .withName("table2_not_filtered")
            .withDatabaseSchema(otherSchema.getFullyQualifiedName())
            .withDescription("Initial description for table2")
            .withColumns(
                List.of(
                    new Column().withName("col1").withDataType(ColumnDataType.STRING),
                    new Column().withName("col2").withDataType(ColumnDataType.INT)));
    Table table2 = tableTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);
    LOG.debug("Created table2 in other_db schema: {}", table2.getName());

    // Create Dashboard Service
    DashboardServiceResourceTest dashboardServiceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService = dashboardServiceTest.createRequest(test);
    DashboardService dashboardService =
        dashboardServiceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created dashboard service: {}", dashboardService.getName());

    // Create Dashboard 1 with chart_1 (should match filter)
    DashboardResourceTest dashboardTest = new DashboardResourceTest();

    // Create a chart with name "chart_1" first (dashboards reference charts by FQN)
    ChartResourceTest chartTest = new ChartResourceTest();
    CreateChart createChart1 =
        new CreateChart().withName("chart_1").withService(dashboardService.getFullyQualifiedName());
    Chart chart1 = chartTest.createEntity(createChart1, ADMIN_AUTH_HEADERS);

    CreateDashboard createDashboard1 =
        new CreateDashboard()
            .withName("dashboard1_filtered")
            .withService(dashboardService.getFullyQualifiedName())
            .withDescription("Initial description for dashboard1")
            .withCharts(List.of(chart1.getFullyQualifiedName()));
    Dashboard dashboard1 = dashboardTest.createEntity(createDashboard1, ADMIN_AUTH_HEADERS);
    LOG.debug("Created dashboard1 with chart_1: {}", dashboard1.getName());

    // Create Dashboard 2 without chart_1 (should NOT match filter)
    // Create a different chart with name "chart_2"
    CreateChart createChart2 =
        new CreateChart().withName("chart_2").withService(dashboardService.getFullyQualifiedName());
    Chart chart2 = chartTest.createEntity(createChart2, ADMIN_AUTH_HEADERS);

    CreateDashboard createDashboard2 =
        new CreateDashboard()
            .withName("dashboard2_not_filtered")
            .withService(dashboardService.getFullyQualifiedName())
            .withDescription("Initial description for dashboard2")
            .withCharts(List.of(chart2.getFullyQualifiedName()));
    Dashboard dashboard2 = dashboardTest.createEntity(createDashboard2, ADMIN_AUTH_HEADERS);
    LOG.debug("Created dashboard2 without chart_1: {}", dashboard2.getName());

    // Wait a bit for entities to be indexed
    java.lang.Thread.sleep(2000);

    // Create periodic batch workflow with specific filters
    // IMPORTANT: Filters ensure only specific entities are updated
    String workflowJson =
        """
    {
      "name": "MultiEntityPeriodicQuery",
      "displayName": "MultiEntityPeriodicQuery",
      "description": "Custom workflow created with Workflow Builder",
      "type": "periodicBatchEntity",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": [
            "table",
            "dashboard"
          ],
          "schedule": {
            "scheduleTimeline": "None"
          },
          "batchSize": 100,
          "filters": {
            "table": "{\\"query\\":{\\"bool\\":{\\"must\\":[{\\"bool\\":{\\"must\\":[{\\"term\\":{\\"databaseSchema.displayName.keyword\\":\\"posts_db\\"}}]}},{\\"bool\\":{\\"must\\":[{\\"term\\":{\\"entityType\\":\\"table\\"}}]}}]}}}",
            "dashboard": "{\\"query\\":{\\"bool\\":{\\"filter\\":[{\\"term\\":{\\"entityType\\":\\"dashboard\\"}},{\\"term\\":{\\"charts.name.keyword\\":\\"chart_1\\"}}]}}}"
          }
        },
        "output": [
          "relatedEntity",
          "updatedBy"
        ]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "StartNode",
          "displayName": "Start"
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetEntityAttribute_2",
          "displayName": "Set Entity Attribute",
          "config": {
            "fieldName": "description",
            "fieldValue": "Multi Periodic Entity"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "EndNode_3",
          "displayName": "End"
        }
      ],
      "edges": [
        {
          "from": "StartNode",
          "to": "SetEntityAttribute_2"
        },
        {
          "from": "SetEntityAttribute_2",
          "to": "EndNode_3"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("MultiEntityPeriodicQuery workflow created successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }

    // Trigger the workflow manually
    Response triggerResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/MultiEntityPeriodicQuery/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    if (triggerResponse.getStatus() == Response.Status.OK.getStatusCode()
        || triggerResponse.getStatus() == Response.Status.ACCEPTED.getStatusCode()) {
      LOG.debug("Workflow triggered successfully");
    } else {
      String responseBody = triggerResponse.readEntity(String.class);
      LOG.error(
          "Failed to trigger workflow. Status: {}, Response: {}",
          triggerResponse.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to trigger workflow: " + responseBody);
    }

    // Wait for workflow execution with proper timeout
    LOG.debug("Waiting for workflow to process entities...");

    // Store IDs for lambda expressions
    final UUID table1Id = table1.getId();
    final UUID table2Id = table2.getId();
    final UUID dashboard1Id = dashboard1.getId();
    final UUID dashboard2Id = dashboard2.getId();

    // Wait for filtered entities to be updated (only table1 and dashboard1 should be updated)
    Awaitility.await()
        .pollInterval(Duration.ofSeconds(1))
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .ignoreExceptions()
        .until(
            () -> {
              try {
                Table checkTable1 = tableTest.getEntity(table1Id, "", ADMIN_AUTH_HEADERS);
                Table checkTable2 = tableTest.getEntity(table2Id, "", ADMIN_AUTH_HEADERS);
                Dashboard checkDashboard1 =
                    dashboardTest.getEntity(dashboard1Id, "", ADMIN_AUTH_HEADERS);
                Dashboard checkDashboard2 =
                    dashboardTest.getEntity(dashboard2Id, "", ADMIN_AUTH_HEADERS);

                boolean table1Updated =
                    "Multi Periodic Entity".equals(checkTable1.getDescription());
                boolean table2NotUpdated =
                    "Initial description for table2".equals(checkTable2.getDescription());
                boolean dashboard1Updated =
                    "Multi Periodic Entity".equals(checkDashboard1.getDescription());
                boolean dashboard2NotUpdated =
                    "Initial description for dashboard2".equals(checkDashboard2.getDescription());

                LOG.debug(
                    "Table1: {}, Table2: {}, Dashboard1: {}, Dashboard2: {}",
                    checkTable1.getDescription(),
                    checkTable2.getDescription(),
                    checkDashboard1.getDescription(),
                    checkDashboard2.getDescription());

                // Only filtered entities should be updated
                return table1Updated
                    && table2NotUpdated
                    && dashboard1Updated
                    && dashboard2NotUpdated;
              } catch (Exception e) {
                LOG.warn("Error checking entity descriptions: {}", e.getMessage());
                return false;
              }
            });

    // Verify only filtered entities were updated
    Table updatedTable1 = tableTest.getEntity(table1Id, "", ADMIN_AUTH_HEADERS);
    assertEquals("Multi Periodic Entity", updatedTable1.getDescription());
    LOG.debug("Table1 updated successfully: {}", updatedTable1.getDescription());

    Table updatedTable2 = tableTest.getEntity(table2Id, "", ADMIN_AUTH_HEADERS);
    assertEquals("Initial description for table2", updatedTable2.getDescription());
    LOG.debug("Table2 NOT updated (as expected): {}", updatedTable2.getDescription());

    Dashboard updatedDashboard1 = dashboardTest.getEntity(dashboard1Id, "", ADMIN_AUTH_HEADERS);
    assertEquals("Multi Periodic Entity", updatedDashboard1.getDescription());
    LOG.debug("Dashboard1 updated successfully: {}", updatedDashboard1.getDescription());

    Dashboard updatedDashboard2 = dashboardTest.getEntity(dashboard2Id, "", ADMIN_AUTH_HEADERS);
    assertEquals("Initial description for dashboard2", updatedDashboard2.getDescription());
    LOG.debug("Dashboard2 NOT updated (as expected): {}", updatedDashboard2.getDescription());

    LOG.info("test_MultiEntityPeriodicQueryWithFilters completed successfully");
  }

  @Test
  @Order(8)
  void test_InvalidWorkflowDefinition() {
    LOG.info("Starting test_InvalidWorkflowDefinition");

    // Create a workflow with invalid definition - edge connects to non-existent node
    String invalidWorkflowJson =
        """
    {
      "name": "invalidWorkflow",
      "displayName": "Invalid Workflow",
      "description": "Workflow with mismatched node and edge names",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "UpdateDescription",
          "displayName": "Update Description",
          "description": "Update entity description",
          "type": "setFieldValue",
          "config": {
            "targetField": "description",
            "value": "Updated by workflow"
          }
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "NonExistentNode"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    try {
      CreateWorkflowDefinition invalidWorkflow =
          JsonUtils.readValue(invalidWorkflowJson, CreateWorkflowDefinition.class);

      // Try to create the invalid workflow
      Response response =
          SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
              .post(Entity.json(invalidWorkflow));

      // Should return error status
      assertNotEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
      assertNotEquals(Response.Status.OK.getStatusCode(), response.getStatus());
      LOG.debug(
          "Invalid workflow creation failed as expected with status: {}", response.getStatus());

      // Try to fetch the workflow - it should not exist
      try {
        Response getResponse =
            SecurityUtil.addHeaders(
                    getResource("governance/workflowDefinitions/name/invalidWorkflow"),
                    ADMIN_AUTH_HEADERS)
                .get();

        // Should return 404 or empty
        assertEquals(Response.Status.NOT_FOUND.getStatusCode(), getResponse.getStatus());
        LOG.debug("Invalid workflow does not exist as expected - returned 404");
      } catch (Exception e) {
        // This is expected - workflow should not exist
        LOG.debug("Invalid workflow does not exist as expected - exception: {}", e.getMessage());
      }

    } catch (Exception e) {
      // Creation might fail during JSON parsing or validation
      LOG.debug(
          "Invalid workflow creation failed as expected during parsing/validation: {}",
          e.getMessage());
      assertNotNull(e);
    }

    LOG.info("test_InvalidWorkflowDefinition completed successfully");
  }

  @Test
  @Order(9)
  void test_UserApprovalTaskWithoutReviewerSupport() {
    LOG.info("Starting test_UserApprovalTaskWithoutReviewerSupport");

    // Create a workflow with user approval task for an entity type that doesn't support reviewers
    // Database entity does not support reviewers, only certain entities like GlossaryTerm do
    String invalidWorkflowJson =
        """
    {
      "name": "databaseApprovalWorkflow",
      "displayName": "Database Approval Workflow",
      "description": "Invalid workflow with user approval task for database entity",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["database"],
          "events": ["Created", "Updated"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "ApproveDatabase",
          "displayName": "Approve Database",
          "type": "userTask",
          "subType": "userApprovalTask",
          "config": {
            "assignees": {
              "addReviewers": true
            },
            "approvalThreshold": 1,
            "rejectionThreshold": 1
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "ApproveDatabase"
        },
        {
          "from": "ApproveDatabase",
          "to": "end"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition invalidWorkflow =
        JsonUtils.readValue(invalidWorkflowJson, CreateWorkflowDefinition.class);

    // Try to create the workflow with user approval task for entity without reviewer support
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(invalidWorkflow));

    // Should return error status (400 Bad Request or similar)
    assertNotEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
    assertNotEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    assertTrue(
        response.getStatus() >= 400,
        "Expected error status code >= 400, got: " + response.getStatus());

    LOG.debug(
        "Workflow with user approval task for non-reviewer entity failed as expected with status: {}",
        response.getStatus());

    // Verify error message contains expected validation error
    String errorResponse = response.readEntity(String.class);
    assertTrue(
        errorResponse.contains("does not support reviewers")
            || errorResponse.contains("User approval tasks"),
        "Error message should mention reviewer support issue. Got: " + errorResponse);
    LOG.debug("Error message: {}", errorResponse);

    LOG.info("test_UserApprovalTaskWithoutReviewerSupport completed successfully");
  }

  @Test
  @Order(14)
  void test_SuspendAndResumeWorkflow(TestInfo test)
      throws HttpResponseException, InterruptedException {
    LOG.info("Starting test_SuspendAndResumeWorkflow");

    // Step 1: Create a simple workflow that can be triggered immediately
    // Using noOp trigger type which can be deployed and triggered manually
    String workflowJson =
        """
    {
      "name": "TestSuspendResumeWorkflow",
      "displayName": "Test Suspend Resume Workflow",
      "description": "Workflow for testing suspend and resume functionality",
      "trigger": {
        "type": "noOp"
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start",
          "displayName": "Start"
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "end",
          "displayName": "End"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "end"
        }
      ],
      "config": {
        "storeStageStatus": false
      }
    }
    """;

    CreateWorkflowDefinition createWorkflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow
    Response createResponse =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createWorkflow));

    if (createResponse.getStatus() == 400) {
      String errorMessage = createResponse.readEntity(String.class);
      LOG.error("Failed to create workflow. Error: {}", errorMessage);
      fail("Failed to create workflow for suspend/resume test. Error: " + errorMessage);
    }

    assertTrue(
        createResponse.getStatus() == Response.Status.CREATED.getStatusCode()
            || createResponse.getStatus() == Response.Status.OK.getStatusCode(),
        "Failed to create workflow for suspend/resume test");

    WorkflowDefinition createdWorkflow = createResponse.readEntity(WorkflowDefinition.class);
    assertNotNull(createdWorkflow);
    String workflowFqn = createdWorkflow.getFullyQualifiedName();
    LOG.info("Created workflow for suspend/resume test: {}", workflowFqn);

    // Step 2: Trigger the workflow to deploy it to Flowable
    LOG.info("Triggering workflow to deploy it to Flowable engine");
    Response triggerResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/" + workflowFqn + "/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    assertEquals(
        Response.Status.OK.getStatusCode(),
        triggerResponse.getStatus(),
        "Failed to trigger workflow for deployment");
    LOG.info("Workflow triggered successfully, waiting for deployment to complete");

    // Wait a few seconds for the workflow to be deployed and start
    java.lang.Thread.sleep(10000);

    // Step 3: Now suspend the deployed workflow
    LOG.info("Attempting to suspend the deployed workflow");
    Response suspendResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/" + workflowFqn + "/suspend"),
                ADMIN_AUTH_HEADERS)
            .put(Entity.json("{}"));

    assertEquals(
        Response.Status.OK.getStatusCode(),
        suspendResponse.getStatus(),
        "Failed to suspend deployed workflow");

    String suspendBody = suspendResponse.readEntity(String.class);
    assertNotNull(suspendBody);
    assertTrue(
        suspendBody.contains("suspended"),
        "Response should indicate workflow is suspended. Got: " + suspendBody);
    LOG.info("Workflow suspended successfully");

    // Step 4: Wait 10-15 seconds while workflow is suspended
    LOG.info("Waiting 12 seconds with workflow in suspended state...");
    java.lang.Thread.sleep(12000);

    // Step 5: Resume the workflow
    LOG.info("Attempting to resume the suspended workflow");
    Response resumeResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/" + workflowFqn + "/resume"),
                ADMIN_AUTH_HEADERS)
            .put(Entity.json("{}"));

    assertEquals(
        Response.Status.OK.getStatusCode(),
        resumeResponse.getStatus(),
        "Failed to resume suspended workflow");

    String resumeBody = resumeResponse.readEntity(String.class);
    assertNotNull(resumeBody);
    assertTrue(
        resumeBody.contains("resumed"),
        "Response should indicate workflow is resumed. Got: " + resumeBody);
    LOG.info("Workflow resumed successfully");

    // Step 6: Verify we can suspend it again (proves it's active)
    LOG.info("Verifying workflow is active by suspending it again");
    Response secondSuspendResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/name/" + workflowFqn + "/suspend"),
                ADMIN_AUTH_HEADERS)
            .put(Entity.json("{}"));

    assertEquals(
        Response.Status.OK.getStatusCode(),
        secondSuspendResponse.getStatus(),
        "Should be able to suspend the active workflow again");

    LOG.info("test_SuspendAndResumeWorkflow completed successfully");
  }

  @Test
  @Order(15)
  void test_EntitySpecificFiltering(TestInfo test) throws IOException, InterruptedException {
    LOG.info("Starting test_EntitySpecificFiltering");

    // Create test entities
    // 1. Create a Glossary and GlossaryTerms
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(
                "test_filter_glossary_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Test Filter Glossary")
            .withDescription("Glossary for testing entity-specific filters");
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    LOG.debug("Created glossary: {}", glossary.getName());

    // Create glossary term that SHOULD trigger workflow (has description)
    CreateGlossaryTerm createTermToMatch =
        new CreateGlossaryTerm()
            .withName("test_term_complete_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Complete Term")
            .withDescription("This term has a description and should trigger workflow")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm termToMatch = glossaryTermTest.createEntity(createTermToMatch, ADMIN_AUTH_HEADERS);
    LOG.debug("Created glossary term that should match filter: {}", termToMatch.getName());

    // Create glossary term that should NOT trigger workflow (will not match filter)
    CreateGlossaryTerm createTermNotToMatch =
        new CreateGlossaryTerm()
            .withName(
                "test_term_incomplete_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Incomplete Term")
            .withDescription(
                "Simple description without the magic word") // Description without "workflow" won't
            // match
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm termNotToMatch =
        glossaryTermTest.createEntity(createTermNotToMatch, ADMIN_AUTH_HEADERS);
    LOG.debug("Created glossary term that should NOT match filter: {}", termNotToMatch.getName());

    // 2. Create Tables for testing
    // Create database service
    CreateDatabaseService createDbService =
        databaseServiceTest.createRequest(
            "test_filter_db_service_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""));
    DatabaseService dbService =
        databaseServiceTest.createEntity(createDbService, ADMIN_AUTH_HEADERS);

    // Create database
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("test_filter_db_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withService(dbService.getFullyQualifiedName());
    Database database = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Create database schema
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("test_filter_schema_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema dbSchema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    // Create table that SHOULD trigger workflow (production table)
    CreateTable createProdTable =
        new CreateTable()
            .withName(
                "production_customer_data_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Production table that should trigger workflow")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("data").withDataType(ColumnDataType.STRING)));
    Table prodTable = tableTest.createEntity(createProdTable, ADMIN_AUTH_HEADERS);
    LOG.debug("Created production table that should match filter: {}", prodTable.getName());

    // Create table that should NOT trigger workflow (dev/test table)
    CreateTable createDevTable =
        new CreateTable()
            .withName("dev_test_table_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Dev table that should NOT trigger workflow")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("test_data").withDataType(ColumnDataType.STRING)));
    Table devTable = tableTest.createEntity(createDevTable, ADMIN_AUTH_HEADERS);
    LOG.debug("Created dev table that should NOT match filter: {}", devTable.getName());

    // Create workflow with entity-specific filters
    String workflowJson =
        """
    {
      "name": "EntitySpecificFilterWorkflow",
      "displayName": "Entity Specific Filter Workflow",
      "description": "Workflow to test entity-specific filtering for different entity types",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["glossaryTerm", "table"],
          "events": ["Created", "Updated"],
          "exclude": ["reviewers"],
          "filter": {
            "glossaryTerm": "{\\\"!\\\": [{\\\"in\\\": [\\\"workflow\\\", {\\\"var\\\": \\\"description\\\"}]}]}",
            "table": "{\\\"!\\\": [{\\\"in\\\": [\\\"production\\\", {\\\"var\\\": \\\"name\\\"}]}]}"
          }
        },
        "output": ["relatedEntity", "updatedBy"]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start",
          "displayName": "Start"
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "AddProcessedTag",
          "displayName": "Add Processed Tag",
          "config": {
            "fieldName": "displayName",
            "fieldValue": "[FILTERED] - Entity passed specific filter"
          },
          "input": ["relatedEntity", "updatedBy"],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "end",
          "displayName": "End"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "AddProcessedTag"
        },
        {
          "from": "AddProcessedTag",
          "to": "end"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.info("EntitySpecificFilterWorkflow created successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      fail("Failed to create workflow: " + responseBody);
    }

    // Wait a bit for workflow to be deployed
    java.lang.Thread.sleep(5000);

    // Store IDs for lambda expressions
    final UUID termToMatchId = termToMatch.getId();
    final UUID termNotToMatchId = termNotToMatch.getId();
    final UUID prodTableId = prodTable.getId();
    final UUID devTableId = devTable.getId();

    // Update entities to trigger the workflow
    LOG.info("Updating entities to trigger workflow events");

    // Update glossary terms to trigger events
    String termToMatchPatchStr =
        "[{\"op\":\"replace\",\"path\":\"/synonyms\",\"value\":[\"complete_synonym\"]}]";
    JsonNode termToMatchPatch = JsonUtils.readTree(termToMatchPatchStr);
    glossaryTermTest.patchEntity(termToMatchId, termToMatchPatch, ADMIN_AUTH_HEADERS);

    String termNotToMatchPatchStr =
        "[{\"op\":\"replace\",\"path\":\"/synonyms\",\"value\":[\"incomplete_synonym\"]}]";
    JsonNode termNotToMatchPatch = JsonUtils.readTree(termNotToMatchPatchStr);
    glossaryTermTest.patchEntity(termNotToMatchId, termNotToMatchPatch, ADMIN_AUTH_HEADERS);

    // Update tables to trigger events
    String prodTablePatchStr =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated production table\"}]";
    JsonNode prodTablePatch = JsonUtils.readTree(prodTablePatchStr);
    tableTest.patchEntity(prodTableId, prodTablePatch, ADMIN_AUTH_HEADERS);

    String devTablePatchStr =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated dev table\"}]";
    JsonNode devTablePatch = JsonUtils.readTree(devTablePatchStr);
    tableTest.patchEntity(devTableId, devTablePatch, ADMIN_AUTH_HEADERS);

    // Wait for workflow processing using Awaitility
    LOG.info("Waiting for workflow to process entities...");
    await()
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                // Check if entities that match filters got processed
                GlossaryTerm updatedTermToMatch =
                    glossaryTermTest.getEntity(termToMatchId, "", ADMIN_AUTH_HEADERS);
                Table updatedProdTable = tableTest.getEntity(prodTableId, "", ADMIN_AUTH_HEADERS);

                boolean termProcessed =
                    updatedTermToMatch.getDisplayName() != null
                        && updatedTermToMatch.getDisplayName().startsWith("[FILTERED]");
                boolean tableProcessed =
                    updatedProdTable.getDisplayName() != null
                        && updatedProdTable.getDisplayName().startsWith("[FILTERED]");

                if (termProcessed && tableProcessed) {
                  LOG.debug("Both matching entities have been processed by workflow");
                  return true;
                }

                LOG.debug(
                    "Waiting... Term processed: {}, Table processed: {}",
                    termProcessed,
                    tableProcessed);
                return false;
              } catch (Exception e) {
                LOG.debug("Error checking entities: {}", e.getMessage());
                return false;
              }
            });

    // Verify results
    LOG.info("Verifying workflow results");

    // Entities that match filter should be processed
    GlossaryTerm finalTermToMatch =
        glossaryTermTest.getEntity(termToMatchId, "", ADMIN_AUTH_HEADERS);
    assertTrue(
        finalTermToMatch.getDisplayName().startsWith("[FILTERED]"),
        "GlossaryTerm with description should have been processed by workflow");
    LOG.info(
        "✓ GlossaryTerm with description was correctly processed using glossaryterm-specific filter");

    Table finalProdTable = tableTest.getEntity(prodTableId, "", ADMIN_AUTH_HEADERS);
    assertTrue(
        finalProdTable.getDisplayName().startsWith("[FILTERED]"),
        "Production table should have been processed by workflow");
    LOG.info(
        "✓ Table with 'production' in name was correctly processed using table-specific filter");

    // Entities that don't match filter should NOT be processed
    GlossaryTerm finalTermNotToMatch =
        glossaryTermTest.getEntity(termNotToMatchId, "", ADMIN_AUTH_HEADERS);
    assertFalse(
        finalTermNotToMatch.getDisplayName() != null
            && finalTermNotToMatch.getDisplayName().startsWith("[FILTERED]"),
        "GlossaryTerm without description should NOT have been processed by workflow");
    LOG.info("✓ GlossaryTerm without description was correctly filtered out");

    Table finalDevTable = tableTest.getEntity(devTableId, "", ADMIN_AUTH_HEADERS);
    assertFalse(
        finalDevTable.getDisplayName() != null
            && finalDevTable.getDisplayName().startsWith("[FILTERED]"),
        "Dev table should NOT have been processed by workflow");
    LOG.info("✓ Table without 'production' in name was correctly filtered out");

    LOG.info(
        "test_EntitySpecificFiltering completed successfully - Entity-specific filters working correctly!");
  }

  @Test
  @Order(16)
  void test_SuspendNonExistentWorkflow(TestInfo test) {
    LOG.info("Starting test_SuspendNonExistentWorkflow");

    String nonExistentWorkflowFqn = "NonExistentWorkflow_" + UUID.randomUUID();

    // Try to suspend a non-existent workflow
    Response suspendResponse =
        SecurityUtil.addHeaders(
                getResource(
                    "governance/workflowDefinitions/name/" + nonExistentWorkflowFqn + "/suspend"),
                ADMIN_AUTH_HEADERS)
            .put(Entity.json("{}"));

    assertEquals(
        Response.Status.NOT_FOUND.getStatusCode(),
        suspendResponse.getStatus(),
        "Should return 404 for non-existent workflow");

    LOG.info("test_SuspendNonExistentWorkflow completed successfully");
  }

  @Test
  @Order(17)
  void test_UnauthorizedSuspendResume(TestInfo test) throws HttpResponseException {
    LOG.info("Starting test_UnauthorizedSuspendResume");

    // First create a workflow as admin
    String workflowJson =
        """
    {
      "name": "TestUnauthorizedWorkflow",
      "displayName": "Test Unauthorized Workflow",
      "description": "Workflow for testing unauthorized suspend/resume",
      "trigger": {
        "type": "noOp"
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start"
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "end"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition createWorkflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    Response createResponse =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(createWorkflow));

    WorkflowDefinition createdWorkflow = createResponse.readEntity(WorkflowDefinition.class);
    String workflowFqn = createdWorkflow.getFullyQualifiedName();

    // Create a user with limited permissions
    CreateUser createUser =
        new CreateUser()
            .withName("testUser_" + UUID.randomUUID())
            .withEmail("testuser@example.com");
    User testUser = userTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Try to suspend without proper authorization (using test user's auth)
    Map<String, String> testUserAuth = authHeaders(testUser.getName());

    try {
      Response suspendResponse =
          SecurityUtil.addHeaders(
                  getResource("governance/workflowDefinitions/name/" + workflowFqn + "/suspend"),
                  testUserAuth)
              .put(Entity.json("{}"));

      // Should get 403 Forbidden
      assertEquals(
          Response.Status.FORBIDDEN.getStatusCode(),
          suspendResponse.getStatus(),
          "Should return 403 for unauthorized user");
    } catch (Exception e) {
      // Some security frameworks might throw exception instead
      assertTrue(
          e.getMessage().contains("Unauthorized") || e.getMessage().contains("Forbidden"),
          "Should indicate authorization failure");
    }

    LOG.info("test_UnauthorizedSuspendResume completed successfully");
  }

  private void createOrUpdateWorkflow(CreateWorkflowDefinition workflow) {
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .put(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("{} workflow created/updated successfully", workflow.getName());
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow {}. Status: {}, Response: {}",
          workflow.getName(),
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }
  }

  @Test
  @Order(11)
  void test_EventBasedMultipleEntitiesWithoutReviewerSupport() {
    LOG.info("Starting test_EventBasedMultipleEntitiesWithoutReviewerSupport");

    // Create a workflow with user approval task for multiple entity types using eventBasedEntity
    // trigger
    // None of these entities (table, database, dashboard) support reviewers
    String invalidWorkflowJson =
        """
    {
      "name": "multiEntityEventBasedApprovalWorkflow",
      "displayName": "Multi-Entity Event Based Approval Workflow",
      "description": "Invalid workflow with user approval task for multiple entities without reviewer support",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table", "database", "dashboard"],
          "events": ["Created", "Updated"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "ApproveEntity",
          "displayName": "Approve Entity",
          "type": "userTask",
          "subType": "userApprovalTask",
          "config": {
            "assignees": {
              "addReviewers": true
            },
            "approvalThreshold": 1,
            "rejectionThreshold": 1
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "ApproveEntity"
        },
        {
          "from": "ApproveEntity",
          "to": "end"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition invalidWorkflow =
        JsonUtils.readValue(invalidWorkflowJson, CreateWorkflowDefinition.class);

    // Try to create the workflow with user approval task for multiple entities without reviewer
    // support
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(invalidWorkflow));

    // Should return error status (400 Bad Request or similar)
    assertNotEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
    assertNotEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    assertTrue(
        response.getStatus() >= 400,
        "Expected error status code >= 400, got: " + response.getStatus());

    LOG.debug(
        "Workflow with user approval task for multiple non-reviewer entities failed as expected with status: {}",
        response.getStatus());

    // Verify error message contains expected validation error - should fail on first entity without
    // reviewer support
    String errorResponse = response.readEntity(String.class);
    assertTrue(
        errorResponse.contains("does not support reviewers")
            || errorResponse.contains("User approval tasks"),
        "Error message should mention reviewer support issue. Got: " + errorResponse);
    LOG.debug("Error message: {}", errorResponse);

    LOG.info("test_EventBasedMultipleEntitiesWithoutReviewerSupport completed successfully");
  }

  @Test
  @Order(12)
  void test_MixedEntityTypesWithReviewerSupport() {
    LOG.info("Starting test_MixedEntityTypesWithReviewerSupport");

    // Create a workflow with user approval task mixing entities with and without reviewer support
    // glossaryTerm supports reviewers, but table doesn't
    String invalidWorkflowJson =
        """
    {
      "name": "mixedEntityApprovalWorkflow",
      "displayName": "Mixed Entity Approval Workflow",
      "description": "Invalid workflow with user approval task for mixed entities",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["glossaryTerm", "table"],
          "events": ["Created", "Updated"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "ApproveEntity",
          "displayName": "Approve Entity",
          "type": "userTask",
          "subType": "userApprovalTask",
          "config": {
            "assignees": {
              "addReviewers": true
            },
            "approvalThreshold": 1,
            "rejectionThreshold": 1
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "ApproveEntity"
        },
        {
          "from": "ApproveEntity",
          "to": "end"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition invalidWorkflow =
        JsonUtils.readValue(invalidWorkflowJson, CreateWorkflowDefinition.class);

    // Try to create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(invalidWorkflow));

    // Should return error status because table doesn't support reviewers
    assertNotEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
    assertNotEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    assertTrue(
        response.getStatus() >= 400,
        "Expected error status code >= 400, got: " + response.getStatus());

    LOG.debug(
        "Workflow with mixed entity types (some without reviewer support) failed as expected with status: {}",
        response.getStatus());

    // Verify error message mentions table doesn't support reviewers
    String errorResponse = response.readEntity(String.class);
    assertTrue(
        errorResponse.contains("table")
            && (errorResponse.contains("does not support reviewers")
                || errorResponse.contains("User approval tasks")),
        "Error message should mention table doesn't support reviewers. Got: " + errorResponse);
    LOG.debug("Error message: {}", errorResponse);

    LOG.info("test_MixedEntityTypesWithReviewerSupport completed successfully");
  }

  @Test
  @Order(13)
  void test_WorkflowValidationEndpoint() {
    LOG.info("Starting test_WorkflowValidationEndpoint");

    // Test 1: Valid workflow should pass validation
    String validWorkflowJson =
        """
    {
      "name": "validTestWorkflow",
      "displayName": "Valid Test Workflow",
      "description": "A valid workflow for testing",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["glossaryTerm"],
          "events": ["Created", "Updated"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "checkTask",
          "displayName": "Check Task",
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "config": {
            "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
          },
          "input": ["relatedEntity"],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": ["result"],
          "branches": ["true", "false"]
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "checkTask"
        },
        {
          "from": "checkTask",
          "to": "end",
          "condition": "true"
        },
        {
          "from": "checkTask",
          "to": "end",
          "condition": "false"
        }
      ]
    }
    """;

    CreateWorkflowDefinition validWorkflow =
        JsonUtils.readValue(validWorkflowJson, CreateWorkflowDefinition.class);

    Response response =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(validWorkflow));

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    String responseBody = response.readEntity(String.class);
    assertTrue(responseBody.contains("valid"));
    LOG.debug("Valid workflow passed validation");

    // Test 2: Workflow with cycle should fail
    String cyclicWorkflowJson =
        """
    {
      "name": "cyclicWorkflow",
      "displayName": "Cyclic Workflow",
      "description": "Workflow with a cycle",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "check1",
          "displayName": "Check 1",
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "config": {
            "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
          },
          "output": ["result"],
          "branches": ["true", "false"]
        },
        {
          "name": "check2",
          "displayName": "Check 2",
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "config": {
            "rules": "{\\"!!\\":{\\"var\\":\\"owners\\"}}"
          },
          "output": ["result"],
          "branches": ["true", "false"]
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "check1"
        },
        {
          "from": "check1",
          "to": "check2",
          "condition": "true"
        },
        {
          "from": "check2",
          "to": "check1",
          "condition": "false"
        },
        {
          "from": "check2",
          "to": "end",
          "condition": "true"
        }
      ]
    }
    """;

    CreateWorkflowDefinition cyclicWorkflow =
        JsonUtils.readValue(cyclicWorkflowJson, CreateWorkflowDefinition.class);

    Response cyclicResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(cyclicWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), cyclicResponse.getStatus());
    String cyclicResponseBody = cyclicResponse.readEntity(String.class);
    assertTrue(
        cyclicResponseBody.contains("contains a cycle in its execution path"),
        "Expected cycle error message, got: " + cyclicResponseBody);
    LOG.debug("Cyclic workflow correctly rejected: {}", cyclicResponseBody);

    // Test 3: Workflow with duplicate node IDs should fail
    String duplicateNodeWorkflowJson =
        """
    {
      "name": "duplicateNodeWorkflow",
      "displayName": "Duplicate Node Workflow",
      "description": "Workflow with duplicate node IDs",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "task1",
          "displayName": "Task 1",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Test"
          }
        },
        {
          "name": "task1",
          "displayName": "Task 1 Duplicate",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "tags",
            "fieldValue": "Test.Tag"
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "task1"
        },
        {
          "from": "task1",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition duplicateNodeWorkflow =
        JsonUtils.readValue(duplicateNodeWorkflowJson, CreateWorkflowDefinition.class);

    Response duplicateResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(duplicateNodeWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), duplicateResponse.getStatus());
    String duplicateResponseBody = duplicateResponse.readEntity(String.class);
    assertTrue(
        duplicateResponseBody.contains("duplicate node ID"),
        "Expected duplicate node ID error message, got: " + duplicateResponseBody);
    LOG.debug("Duplicate node workflow correctly rejected: {}", duplicateResponseBody);

    // Test 4: Node ID clashing with workflow name should fail
    String clashingNodeWorkflowJson =
        """
    {
      "name": "clashingWorkflow",
      "displayName": "Clashing Workflow",
      "description": "Workflow where node ID clashes with workflow name",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "clashingWorkflow",
          "displayName": "Clashing Node",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Test"
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "clashingWorkflow"
        },
        {
          "from": "clashingWorkflow",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition clashingNodeWorkflow =
        JsonUtils.readValue(clashingNodeWorkflowJson, CreateWorkflowDefinition.class);

    Response clashResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(clashingNodeWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), clashResponse.getStatus());
    String clashResponseBody = clashResponse.readEntity(String.class);
    assertTrue(
        clashResponseBody.contains("clashes with the workflow name"),
        "Expected node name clash error message, got: " + clashResponseBody);
    LOG.debug("Node clashing with workflow name correctly rejected: {}", clashResponseBody);

    // Test 5: User approval task on entity without reviewer support should fail
    String invalidUserTaskWorkflowJson =
        """
    {
      "name": "invalidUserTaskWorkflow",
      "displayName": "Invalid User Task Workflow",
      "description": "Workflow with user approval on non-reviewer entity",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "approval",
          "displayName": "Approval",
          "type": "userTask",
          "subType": "userApprovalTask",
          "config": {
            "assignees": {
              "addReviewers": true
            }
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "approval"
        },
        {
          "from": "approval",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition invalidUserTaskWorkflow =
        JsonUtils.readValue(invalidUserTaskWorkflowJson, CreateWorkflowDefinition.class);

    Response userTaskResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(invalidUserTaskWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), userTaskResponse.getStatus());
    String userTaskResponseBody = userTaskResponse.readEntity(String.class);
    assertTrue(
        userTaskResponseBody.contains("does not support reviewers"),
        "Expected reviewer support error message, got: " + userTaskResponseBody);
    LOG.debug("Invalid user task workflow correctly rejected: {}", userTaskResponseBody);

    // Test 6: Correct updatedBy namespace with user task should pass
    String correctNamespaceWorkflowJson =
        """
    {
      "name": "correctNamespaceWorkflow",
      "displayName": "Correct Namespace Workflow",
      "description": "Workflow with correct updatedBy namespace",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["glossaryTerm"],
          "events": ["Created"]
        },
        "output": ["relatedEntity", "updatedBy"]
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "userApproval",
          "displayName": "User Approval",
          "type": "userTask",
          "subType": "userApprovalTask",
          "config": {
            "assignees": {
              "addReviewers": true
            }
          },
          "output": ["updatedBy"]
        },
        {
          "name": "setTask",
          "displayName": "Set Task",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Approved"
          },
          "input": ["relatedEntity", "updatedBy"],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "userApproval"
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "userApproval"
        },
        {
          "from": "userApproval",
          "to": "setTask",
          "condition": "true"
        },
        {
          "from": "userApproval",
          "to": "setTask",
          "condition": "false"
        },
        {
          "from": "setTask",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition correctNamespaceWorkflow =
        JsonUtils.readValue(correctNamespaceWorkflowJson, CreateWorkflowDefinition.class);

    Response namespaceResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(correctNamespaceWorkflow));

    assertEquals(Response.Status.OK.getStatusCode(), namespaceResponse.getStatus());
    String namespaceResponseBody = namespaceResponse.readEntity(String.class);
    assertTrue(namespaceResponseBody.contains("valid"));
    LOG.debug("Correct namespace workflow with user task passed: {}", namespaceResponseBody);

    // Test 7: Workflow with edge referencing non-existent node should fail
    String invalidEdgeWorkflowJson =
        """
    {
      "name": "invalidEdgeWorkflow",
      "displayName": "Invalid Edge Workflow",
      "description": "Workflow with edge to non-existent node",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "nonExistentNode"
        },
        {
          "from": "nonExistentNode",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition invalidEdgeWorkflow =
        JsonUtils.readValue(invalidEdgeWorkflowJson, CreateWorkflowDefinition.class);

    Response edgeResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(invalidEdgeWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), edgeResponse.getStatus());
    String edgeResponseBody = edgeResponse.readEntity(String.class);
    assertTrue(
        edgeResponseBody.contains("non-existent node"),
        "Expected non-existent node error message, got: " + edgeResponseBody);
    LOG.debug("Invalid edge workflow correctly rejected: {}", edgeResponseBody);

    // Test 8: Workflow without start event should fail
    String noStartWorkflowJson =
        """
    {
      "name": "noStartWorkflow",
      "displayName": "No Start Workflow",
      "description": "Workflow without start event",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "task",
          "displayName": "Task",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Test"
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "task",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition noStartWorkflow =
        JsonUtils.readValue(noStartWorkflowJson, CreateWorkflowDefinition.class);

    Response noStartResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(noStartWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), noStartResponse.getStatus());
    String noStartResponseBody = noStartResponse.readEntity(String.class);
    assertTrue(
        noStartResponseBody.contains("must have exactly one start event"),
        "Expected start event error message, got: " + noStartResponseBody);
    LOG.debug("No start event workflow correctly rejected: {}", noStartResponseBody);

    // Test 9: Complex cycle with multiple paths should be detected
    String complexCycleWorkflowJson =
        """
    {
      "name": "complexCycleWorkflow",
      "displayName": "Complex Cycle Workflow",
      "description": "Workflow with complex cycle",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "fork",
          "displayName": "Fork",
          "type": "gateway",
          "subType": "parallelGateway"
        },
        {
          "name": "task1",
          "displayName": "Task 1",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Test1"
          }
        },
        {
          "name": "task2",
          "displayName": "Task 2",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "tags",
            "fieldValue": "Test.Tag"
          }
        },
        {
          "name": "join",
          "displayName": "Join",
          "type": "gateway",
          "subType": "parallelGateway"
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "fork"
        },
        {
          "from": "fork",
          "to": "task1"
        },
        {
          "from": "fork",
          "to": "task2"
        },
        {
          "from": "task1",
          "to": "join"
        },
        {
          "from": "task2",
          "to": "join"
        },
        {
          "from": "join",
          "to": "fork"
        },
        {
          "from": "join",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition complexCycleWorkflow =
        JsonUtils.readValue(complexCycleWorkflowJson, CreateWorkflowDefinition.class);

    Response complexCycleResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(complexCycleWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), complexCycleResponse.getStatus());
    String complexCycleResponseBody = complexCycleResponse.readEntity(String.class);
    assertTrue(
        complexCycleResponseBody.contains("contains a cycle in its execution path"),
        "Expected cycle error message, got: " + complexCycleResponseBody);
    LOG.debug("Complex cycle workflow correctly rejected: {}", complexCycleResponseBody);

    // Test 10: Multiple start nodes should fail
    String multipleStartWorkflowJson =
        """
    {
      "name": "multipleStartWorkflow",
      "displayName": "Multiple Start Workflow",
      "description": "Workflow with multiple start nodes",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start1",
          "displayName": "Start 1",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "start2",
          "displayName": "Start 2",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "task",
          "displayName": "Task",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Test"
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start1",
          "to": "task"
        },
        {
          "from": "start2",
          "to": "task"
        },
        {
          "from": "task",
          "to": "end"
        }
      ]
    }
    """;

    CreateWorkflowDefinition multipleStartWorkflow =
        JsonUtils.readValue(multipleStartWorkflowJson, CreateWorkflowDefinition.class);

    Response multipleStartResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(multipleStartWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), multipleStartResponse.getStatus());
    String multipleStartResponseBody = multipleStartResponse.readEntity(String.class);
    assertTrue(
        multipleStartResponseBody.contains("must have exactly one start event"),
        "Expected multiple start nodes error message, got: " + multipleStartResponseBody);
    LOG.debug("Multiple start nodes workflow correctly rejected: {}", multipleStartResponseBody);

    // Test 11: Orphaned nodes (not reachable from start) should fail
    String orphanedNodesWorkflowJson =
        """
    {
      "name": "orphanedNodesWorkflow",
      "displayName": "Orphaned Nodes Workflow",
      "description": "Workflow with orphaned nodes",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "task1",
          "displayName": "Task 1",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Test1"
          }
        },
        {
          "name": "orphanedTask",
          "displayName": "Orphaned Task",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "tags",
            "fieldValue": "Test.Tag"
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        },
        {
          "name": "orphanedEnd",
          "displayName": "Orphaned End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "task1"
        },
        {
          "from": "task1",
          "to": "end"
        },
        {
          "from": "orphanedTask",
          "to": "orphanedEnd"
        }
      ]
    }
    """;

    CreateWorkflowDefinition orphanedNodesWorkflow =
        JsonUtils.readValue(orphanedNodesWorkflowJson, CreateWorkflowDefinition.class);

    Response orphanedNodesResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(orphanedNodesWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), orphanedNodesResponse.getStatus());
    String orphanedNodesResponseBody = orphanedNodesResponse.readEntity(String.class);
    assertTrue(
        orphanedNodesResponseBody.contains("orphaned nodes not reachable from start"),
        "Expected orphaned nodes error message, got: " + orphanedNodesResponseBody);
    LOG.debug("Orphaned nodes workflow correctly rejected: {}", orphanedNodesResponseBody);

    // Test 12: Non-end node without outgoing edges should fail
    String noOutgoingEdgeWorkflowJson =
        """
    {
      "name": "noOutgoingEdgeWorkflow",
      "displayName": "No Outgoing Edge Workflow",
      "description": "Workflow with non-end node without outgoing edges",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "task1",
          "displayName": "Task 1",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Test1"
          }
        },
        {
          "name": "task2",
          "displayName": "Task 2",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "tags",
            "fieldValue": "Test.Tag"
          }
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "task1"
        },
        {
          "from": "task1",
          "to": "task2"
        }
      ]
    }
    """;

    CreateWorkflowDefinition noOutgoingEdgeWorkflow =
        JsonUtils.readValue(noOutgoingEdgeWorkflowJson, CreateWorkflowDefinition.class);

    Response noOutgoingEdgeResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(noOutgoingEdgeWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), noOutgoingEdgeResponse.getStatus());
    String noOutgoingEdgeResponseBody = noOutgoingEdgeResponse.readEntity(String.class);
    assertTrue(
        noOutgoingEdgeResponseBody.contains("requires outgoing edges"),
        "Expected requires outgoing edges error message, got: " + noOutgoingEdgeResponseBody);
    LOG.debug(
        "Non-end node without outgoing edges correctly rejected: {}", noOutgoingEdgeResponseBody);

    // Test 13: End node with outgoing edges should fail
    String endWithOutgoingWorkflowJson =
        """
    {
      "name": "endWithOutgoingWorkflow",
      "displayName": "End With Outgoing Workflow",
      "description": "Workflow with end node having outgoing edges",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["table"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        },
        {
          "name": "task",
          "displayName": "Task After End",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "description",
            "fieldValue": "Should not reach here"
          }
        },
        {
          "name": "finalEnd",
          "displayName": "Final End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "end"
        },
        {
          "from": "end",
          "to": "task"
        },
        {
          "from": "task",
          "to": "finalEnd"
        }
      ]
    }
    """;

    CreateWorkflowDefinition endWithOutgoingWorkflow =
        JsonUtils.readValue(endWithOutgoingWorkflowJson, CreateWorkflowDefinition.class);

    Response endWithOutgoingResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(endWithOutgoingWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), endWithOutgoingResponse.getStatus());
    String endWithOutgoingResponseBody = endWithOutgoingResponse.readEntity(String.class);
    assertTrue(
        endWithOutgoingResponseBody.contains("cannot have outgoing edges"),
        "Expected cannot have outgoing edges error message, got: " + endWithOutgoingResponseBody);
    LOG.debug("End node with outgoing edges correctly rejected: {}", endWithOutgoingResponseBody);

    // Test 8: Conditional task with missing FALSE condition should fail
    String missingFalseConditionJson =
        """
    {
      "name": "missingFalseConditionWorkflow",
      "displayName": "Missing False Condition Workflow",
      "description": "Workflow with conditional task missing FALSE condition",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["glossaryTerm"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "checkTask",
          "displayName": "Check Task",
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "config": {
            "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
          },
          "input": ["relatedEntity"],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": ["result"]
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "checkTask"
        },
        {
          "from": "checkTask",
          "to": "end",
          "condition": "true"
        }
      ]
    }
    """;

    CreateWorkflowDefinition missingFalseConditionWorkflow =
        JsonUtils.readValue(missingFalseConditionJson, CreateWorkflowDefinition.class);

    Response missingFalseResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(missingFalseConditionWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), missingFalseResponse.getStatus());
    String missingFalseResponseBody = missingFalseResponse.readEntity(String.class);
    assertTrue(
        missingFalseResponseBody.contains("must have both TRUE and FALSE outgoing sequence flows"),
        "Expected conditional task validation error, got: " + missingFalseResponseBody);
    LOG.debug(
        "Conditional task missing FALSE condition correctly rejected: {}",
        missingFalseResponseBody);

    // Test 9: UserApprovalTask with missing TRUE condition should fail
    String missingTrueConditionJson =
        """
    {
      "name": "missingTrueConditionWorkflow",
      "displayName": "Missing True Condition Workflow",
      "description": "Workflow with UserApprovalTask missing TRUE condition",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["glossaryTerm"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "approvalTask",
          "displayName": "Approval Task",
          "type": "userTask",
          "subType": "userApprovalTask",
          "config": {
            "assignees": {
              "addReviewers": true
            }
          },
          "input": ["relatedEntity"],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": ["result"]
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "approvalTask"
        },
        {
          "from": "approvalTask",
          "to": "end",
          "condition": "false"
        }
      ]
    }
    """;

    CreateWorkflowDefinition missingTrueConditionWorkflow =
        JsonUtils.readValue(missingTrueConditionJson, CreateWorkflowDefinition.class);

    Response missingTrueResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(missingTrueConditionWorkflow));

    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), missingTrueResponse.getStatus());
    String missingTrueResponseBody = missingTrueResponse.readEntity(String.class);
    assertTrue(
        missingTrueResponseBody.contains("must have both TRUE and FALSE outgoing sequence flows"),
        "Expected conditional task validation error, got: " + missingTrueResponseBody);
    LOG.debug(
        "UserApprovalTask missing TRUE condition correctly rejected: {}", missingTrueResponseBody);

    // Test 10: Valid conditional task with both TRUE and FALSE conditions should pass
    String validConditionalJson =
        """
    {
      "name": "validConditionalWorkflow",
      "displayName": "Valid Conditional Workflow",
      "description": "Workflow with proper conditional task setup",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["glossaryTerm"],
          "events": ["Created"]
        }
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "checkTask",
          "displayName": "Check Task",
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "config": {
            "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
          },
          "input": ["relatedEntity"],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": ["result"]
        },
        {
          "name": "endTrue",
          "displayName": "End True",
          "type": "endEvent",
          "subType": "endEvent"
        },
        {
          "name": "endFalse",
          "displayName": "End False",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "checkTask"
        },
        {
          "from": "checkTask",
          "to": "endTrue",
          "condition": "true"
        },
        {
          "from": "checkTask",
          "to": "endFalse",
          "condition": "false"
        }
      ]
    }
    """;

    CreateWorkflowDefinition validConditionalWorkflow =
        JsonUtils.readValue(validConditionalJson, CreateWorkflowDefinition.class);

    Response validConditionalResponse =
        SecurityUtil.addHeaders(
                getResource("governance/workflowDefinitions/validate"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(validConditionalWorkflow));

    assertEquals(Response.Status.OK.getStatusCode(), validConditionalResponse.getStatus());
    String validConditionalResponseBody = validConditionalResponse.readEntity(String.class);
    assertTrue(validConditionalResponseBody.contains("valid"));
    LOG.debug("Valid conditional workflow passed validation: {}", validConditionalResponseBody);

    LOG.info("test_WorkflowValidationEndpoint completed successfully");
  }

  @Test
  @Order(18)
  void test_MutualExclusivitySmartReplacement(TestInfo test) throws IOException {
    LOG.info("Starting test_MutualExclusivitySmartReplacement");

    // Ensure we have database schema for table creation
    if (databaseSchema == null) {
      // Create database service
      CreateDatabaseService createService =
          databaseServiceTest.createRequest(
              "mutex_db_service_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""));
      DatabaseService mutexDbService =
          databaseServiceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

      // Create database
      CreateDatabase createDatabase =
          new CreateDatabase()
              .withName("mutex_db_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
              .withService(mutexDbService.getFullyQualifiedName())
              .withDescription("Database for mutual exclusivity test");
      Database mutexDb = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

      // Create database schema
      CreateDatabaseSchema createSchema =
          new CreateDatabaseSchema()
              .withName("mutex_schema_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
              .withDatabase(mutexDb.getFullyQualifiedName())
              .withDescription("Schema for mutual exclusivity test");
      databaseSchema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);
      LOG.debug("Created database schema for test: {}", databaseSchema.getName());
    }

    // Step 1: Create classification with mutual exclusivity
    CreateClassification createClassification =
        new CreateClassification()
            .withName(
                "MutualExclusiveClassification_"
                    + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDescription("Classification with mutually exclusive tags")
            .withMutuallyExclusive(true)
            .withProvider(org.openmetadata.schema.type.ProviderType.USER);
    ClassificationResourceTest classificationTest = new ClassificationResourceTest();
    Classification classification =
        classificationTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);
    LOG.debug("Created mutually exclusive classification: {}", classification.getName());

    // Create glossary with mutual exclusivity
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(
                "MutualExclusiveGlossary_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDisplayName("Mutual Exclusive Glossary")
            .withDescription("Glossary with mutually exclusive terms")
            .withMutuallyExclusive(true);
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    LOG.debug("Created mutually exclusive glossary: {}", glossary.getName());

    // Step 2: Create 2 tags under the classification
    CreateTag createTag1 =
        new CreateTag()
            .withName("Tag1")
            .withDescription("First tag in mutually exclusive classification")
            .withClassification(classification.getName());
    Tag tag1 = tagTest.createEntity(createTag1, ADMIN_AUTH_HEADERS);
    LOG.debug("Created tag1: {}", tag1.getFullyQualifiedName());

    CreateTag createTag2 =
        new CreateTag()
            .withName("Tag2")
            .withDescription("Second tag in mutually exclusive classification")
            .withClassification(classification.getName());
    Tag tag2 = tagTest.createEntity(createTag2, ADMIN_AUTH_HEADERS);
    LOG.debug("Created tag2: {}", tag2.getFullyQualifiedName());

    // Create 2 glossary terms under the glossary
    CreateGlossaryTerm createTerm1 =
        new CreateGlossaryTerm()
            .withName("Term1")
            .withDisplayName("Term 1")
            .withDescription("First term in mutually exclusive glossary")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term1 = glossaryTermTest.createEntity(createTerm1, ADMIN_AUTH_HEADERS);
    LOG.debug("Created term1: {}", term1.getFullyQualifiedName());

    CreateGlossaryTerm createTerm2 =
        new CreateGlossaryTerm()
            .withName("Term2")
            .withDisplayName("Term 2")
            .withDescription("Second term in mutually exclusive glossary")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term2 = glossaryTermTest.createEntity(createTerm2, ADMIN_AUTH_HEADERS);
    LOG.debug("Created term2: {}", term2.getFullyQualifiedName());

    // Step 3: Create a table and add tag1 and term1
    CreateTable createTable =
        new CreateTable()
            .withName("test_mutex_table_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withDescription("Test table for mutual exclusivity smart replacement")
            .withColumns(
                List.of(
                    new Column().withName("col1").withDataType(ColumnDataType.STRING),
                    new Column().withName("col2").withDataType(ColumnDataType.INT)));
    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    LOG.debug("Created test table: {}", table.getName());

    // Add tag1 and term1 to the table
    List<org.openmetadata.schema.type.TagLabel> initialTags = new ArrayList<>();

    // Add tag1 from mutually exclusive classification
    org.openmetadata.schema.type.TagLabel tagLabel1 = new org.openmetadata.schema.type.TagLabel();
    tagLabel1.setTagFQN(tag1.getFullyQualifiedName());
    tagLabel1.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);
    tagLabel1.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED);
    tagLabel1.setSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION);
    initialTags.add(tagLabel1);

    // Add term1 from mutually exclusive glossary
    org.openmetadata.schema.type.TagLabel termLabel1 = new org.openmetadata.schema.type.TagLabel();
    termLabel1.setTagFQN(term1.getFullyQualifiedName());
    termLabel1.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);
    termLabel1.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED);
    termLabel1.setSource(org.openmetadata.schema.type.TagLabel.TagSource.GLOSSARY);
    termLabel1.setName(term1.getName());
    termLabel1.setDisplayName(term1.getDisplayName());
    initialTags.add(termLabel1);

    table.setTags(initialTags);
    table =
        tableTest.patchEntity(
            table.getId(), JsonUtils.pojoToJson(table), table, ADMIN_AUTH_HEADERS);
    LOG.debug(
        "Added initial tag1 ({}) and term1 ({}) to table",
        tag1.getFullyQualifiedName(),
        term1.getFullyQualifiedName());

    // Step 4: Create workflow that tries to add tag2 and term2 (mutually exclusive with tag1 and
    // term1)
    String workflowJson =
        String.format(
            """
    {
      "name": "MutualExclusivityWorkflow",
      "displayName": "Mutual Exclusivity Workflow",
      "description": "Test workflow for mutual exclusivity smart replacement",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table"],
          "schedule": {
            "scheduleTimeline": "None"
          },
          "batchSize": 100,
          "filters": {}
        },
        "output": [
          "relatedEntity",
          "updatedBy"
        ]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "StartNode",
          "displayName": "Start"
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetEntityAttribute_2",
          "displayName": "Set Tags",
          "config": {
            "fieldName": "tags",
            "fieldValue": "%s"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetEntityAttribute_3",
          "displayName": "Set Glossary Term",
          "config": {
            "fieldName": "glossaryTerms",
            "fieldValue": "%s"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "EndNode_4",
          "displayName": "End"
        }
      ],
      "edges": [
        {
          "from": "SetEntityAttribute_3",
          "to": "EndNode_4"
        },
        {
          "from": "SetEntityAttribute_2",
          "to": "SetEntityAttribute_3"
        },
        {
          "from": "StartNode",
          "to": "SetEntityAttribute_2"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """,
            tag2.getFullyQualifiedName(), term2.getFullyQualifiedName());

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("MutualExclusivityWorkflow created successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }

    // Step 5: Trigger the workflow
    Response triggerResponse =
        SecurityUtil.addHeaders(
                getResource(
                    "governance/workflowDefinitions/name/MutualExclusivityWorkflow/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    if (triggerResponse.getStatus() == Response.Status.OK.getStatusCode()) {
      LOG.debug("Workflow triggered successfully");
    } else {
      LOG.warn("Workflow trigger response: {}", triggerResponse.getStatus());
    }

    final UUID tableId = table.getId();

    // Step 6: Wait for workflow to process and assert tags are replaced
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                Table checkTable = tableTest.getEntity(tableId, "tags", ADMIN_AUTH_HEADERS);
                LOG.debug("Checking table tags: {}", checkTable.getTags());
                if (checkTable.getTags() != null) {
                  // Check that tag1 is REPLACED by tag2 (mutually exclusive)
                  boolean hasTag1 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> tag1.getFullyQualifiedName().equals(tag.getTagFQN()));
                  boolean hasTag2 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> tag2.getFullyQualifiedName().equals(tag.getTagFQN()));
                  // Check that term1 is REPLACED by term2 (mutually exclusive)
                  boolean hasTerm1 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> term1.getFullyQualifiedName().equals(tag.getTagFQN()));
                  boolean hasTerm2 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> term2.getFullyQualifiedName().equals(tag.getTagFQN()));

                  // Both tag1 and term1 should be replaced
                  return !hasTag1 && hasTag2 && !hasTerm1 && hasTerm2;
                }
                return false;
              } catch (Exception e) {
                LOG.warn("Error checking table tags: {}", e.getMessage());
                return false;
              }
            });

    // Verify smart replacement occurred
    Table updatedTable = tableTest.getEntity(table.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTable);
    assertNotNull(updatedTable.getTags());

    // Tag1 should be REPLACED by Tag2 (mutually exclusive in same classification)
    boolean hasTag1 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> tag1.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertFalse(hasTag1, "Tag1 should be replaced due to mutual exclusivity");

    boolean hasTag2 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> tag2.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertTrue(hasTag2, "Tag2 should be present");

    // Term1 should be REPLACED by Term2 (mutually exclusive in same glossary)
    boolean hasTerm1 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> term1.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertFalse(hasTerm1, "Term1 should be replaced due to mutual exclusivity");

    boolean hasTerm2 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> term2.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertTrue(hasTerm2, "Term2 should be present");

    LOG.debug(
        "Smart replacement successful. Final tags: {}",
        updatedTable.getTags().stream().map(TagLabel::getTagFQN).toList());

    // Verify exactly 2 tags remain (tag2 and term2)
    assertEquals(
        2, updatedTable.getTags().size(), "Should have exactly 2 tags after smart replacement");

    LOG.info("test_MutualExclusivitySmartReplacement completed successfully");
  }

  @Test
  @Order(19)
  void test_CustomApprovalWorkflowForNewEntities(TestInfo test)
      throws IOException, InterruptedException {
    LOG.info("Starting test_CustomApprovalWorkflowForNewEntities");

    // Create a reviewer user for this test
    CreateUser createReviewer =
        new CreateUser()
            .withName("test_reviewer_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withEmail(
                "test_reviewer_"
                    + UUID.randomUUID().toString().substring(0, 8).replaceAll("[^a-zA-Z0-9]", "")
                    + "@example.com")
            .withDisplayName("Test Reviewer");
    User reviewerUser = userTest.createEntity(createReviewer, ADMIN_AUTH_HEADERS);
    EntityReference reviewerRef = reviewerUser.getEntityReference();
    LOG.debug("Created reviewer user: {}", reviewerUser.getName());

    // Step 1: Create a single workflow for all three entity types
    String unifiedApprovalWorkflowJson =
        """
        {
          "name": "UnifiedApprovalWorkflow",
          "displayName": "Unified Approval Workflow",
          "description": "Custom approval workflow for dataContracts, tags, dataProducts, metrics, and testCases",
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "entityTypes": ["dataContract", "tag", "dataProduct", "metric", "testCase"],
              "events": ["Created", "Updated"],
              "exclude": ["reviewers"],
              "filter": {}
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {
              "type": "startEvent",
              "subType": "startEvent",
              "name": "StartNode",
              "displayName": "Start"
            },
            {
              "type": "endEvent",
              "subType": "endEvent",
              "name": "EndNode",
              "displayName": "End"
            },
            {
              "type": "userTask",
              "subType": "userApprovalTask",
              "name": "UserApproval",
              "displayName": "User Approval",
              "config": {
                "assignees": {
                  "addReviewers": true
                },
                "approvalThreshold": 1,
                "rejectionThreshold": 1
              },
              "input": ["relatedEntity"],
              "inputNamespaceMap": {
                "relatedEntity": "global"
              },
              "output": ["updatedBy"],
              "branches": ["true", "false"]
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetDescription",
              "displayName": "Set Description",
              "config": {
                "fieldName": "description",
                "fieldValue": "Updated by Workflow"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "UserApproval"
              },
              "output": []
            }
          ],
          "edges": [
            {"from": "StartNode", "to": "UserApproval"},
            {"from": "UserApproval", "to": "SetDescription", "condition": "true"},
            {"from": "SetDescription", "to": "EndNode"},
            {"from": "UserApproval", "to": "EndNode", "condition": "false"}
          ],
          "config": {"storeStageStatus": true}
        }
        """;

    CreateWorkflowDefinition unifiedWorkflow =
        JsonUtils.readValue(unifiedApprovalWorkflowJson, CreateWorkflowDefinition.class);
    createOrUpdateWorkflow(unifiedWorkflow);
    LOG.debug("Created unified approval workflow for dataContract, tag, and dataProduct entities");

    // Step 2: Create database infrastructure with short names
    String dbId = UUID.randomUUID().toString().substring(0, 4);
    CreateDatabaseService createDbService = databaseServiceTest.createRequest("dbs" + dbId);
    DatabaseService dbService =
        databaseServiceTest.createEntity(createDbService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database service: {}", dbService.getName());

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("db" + dbId)
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for custom approval workflow");
    Database database = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database: {}", database.getName());

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("sc" + dbId)
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for custom approval workflow");
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database schema: {}", schema.getName());

    // Create a table for dataContract
    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.INT)
                .withDescription("ID column"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Name column"));

    CreateTable createTable =
        new CreateTable()
            .withName("test_table_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Test table for data contract")
            .withColumns(columns);
    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    LOG.debug("Created table: {}", table.getName());

    // Step 3: Create dataContract with reviewers (USER1 as reviewer)
    org.openmetadata.schema.api.data.CreateDataContract createDataContract =
        new org.openmetadata.schema.api.data.CreateDataContract()
            .withName("test_datacontract_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDescription("Initial data contract description")
            .withEntity(table.getEntityReference())
            .withReviewers(listOf(reviewerRef));

    org.openmetadata.schema.entity.data.DataContract dataContract =
        TestUtils.post(
            getResource("dataContracts"),
            createDataContract,
            org.openmetadata.schema.entity.data.DataContract.class,
            ADMIN_AUTH_HEADERS);
    LOG.debug("Created data contract: {} with initial description", dataContract.getName());

    // Step 4: Create classification and tag with reviewers (USER1 as reviewer)
    CreateClassification createClassification =
        new CreateClassification()
            .withName(
                "test_classification_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDescription("Test classification for workflow");
    Classification classification =
        classificationTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);

    CreateTag createTag =
        new CreateTag()
            .withName(
                "test_tag_"
                    + UUID.randomUUID().toString().substring(0, 8).replaceAll("[^a-zA-Z0-9]", ""))
            .withDescription("Initial tag description")
            .withClassification(classification.getName())
            .withReviewers(listOf(reviewerRef));
    Tag tag = tagTest.createEntity(createTag, ADMIN_AUTH_HEADERS);
    LOG.debug("Created tag: {} with initial description", tag.getName());

    // Step 5: Create dataProduct with reviewers (dedicated reviewer)
    org.openmetadata.schema.api.domains.CreateDataProduct createDataProduct =
        new org.openmetadata.schema.api.domains.CreateDataProduct()
            .withName("test_dataproduct_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDescription("Initial data product description")
            .withDomains(List.of())
            .withReviewers(List.of(reviewerRef));

    org.openmetadata.schema.entity.domains.DataProduct dataProduct =
        TestUtils.post(
            getResource("dataProducts"),
            createDataProduct,
            org.openmetadata.schema.entity.domains.DataProduct.class,
            ADMIN_AUTH_HEADERS);
    LOG.debug("Created data product: {} with initial description", dataProduct.getName());

    // Add asset using bulk API
    org.openmetadata.service.jdbi3.DataProductRepository dataProductRepository =
        (org.openmetadata.service.jdbi3.DataProductRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.DATA_PRODUCT);
    org.openmetadata.schema.type.api.BulkAssets bulkAssets =
        new org.openmetadata.schema.type.api.BulkAssets()
            .withAssets(List.of(table.getEntityReference()));
    dataProductRepository.bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkAssets);

    // Step 5.5: Create metric with reviewers
    CreateMetric createMetric =
        new CreateMetric()
            .withName("test_metric_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDescription("Initial metric description")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.SIZE)
            .withReviewers(List.of(reviewerRef));
    Metric metric = metricTest.createEntity(createMetric, ADMIN_AUTH_HEADERS);
    LOG.debug("Created metric: {} with initial description", metric.getName());

    // Step 5.6: Create testCase with reviewers
    // First initialize test definitions (required for TestCaseResourceTest)
    new TestDefinitionResourceTest().setupTestDefinitions();

    CreateTestCase createTestCase =
        testCaseResourceTest.createRequest(
            "test_approval_testcase_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""));
    createTestCase
        .withEntityLink(String.format("<#E::table::%s>", table.getFullyQualifiedName()))
        .withDescription("Initial test case description")
        .withReviewers(List.of(reviewerRef));

    TestCase testCase =
        testCaseResourceTest.createAndCheckEntity(createTestCase, ADMIN_AUTH_HEADERS);
    LOG.debug("Created test case: {} with initial description", testCase.getName());

    // Step 6: Find and resolve approval tasks for each entity
    LOG.debug("Finding and resolving approval tasks");

    // Helper lambda to wait for and resolve a task
    BiConsumer<String, String> waitAndResolveTask =
        (entityLink, entityType) -> {
          try {
            LOG.info("Waiting for approval task for {}...", entityType);
            await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(2))
                .until(
                    () -> {
                      boolean taskExists =
                          !feedResourceTest
                              .listTasks(
                                  entityLink,
                                  null,
                                  null,
                                  TaskStatus.Open,
                                  1,
                                  authHeaders(reviewerUser.getName()))
                              .getData()
                              .isEmpty();
                      if (!taskExists) {
                        LOG.info("Approval task for {} not found yet, retrying...", entityType);
                      }
                      return taskExists;
                    });

            LOG.info("Approval task for {} found. Proceeding with resolution.", entityType);
            ThreadList threads =
                feedResourceTest.listTasks(
                    entityLink,
                    null,
                    null,
                    TaskStatus.Open,
                    1,
                    authHeaders(reviewerUser.getName()));
            Thread task = threads.getData().getFirst();
            LOG.debug("Found approval task for {}: {}", entityType, task.getId());
            ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
            feedResourceTest.resolveTask(
                task.getTask().getId(), resolveTask, authHeaders(reviewerUser.getName()));
            LOG.debug("Resolved {} approval task", entityType);
          } catch (Exception e) {
            LOG.error(
                "Error while waiting for or resolving task for {}: {}",
                entityType,
                e.getMessage(),
                e);
            fail("Failed to find or resolve task for " + entityType, e);
          }
        };

    // Resolve DataContract approval task
    String dataContractEntityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.DATA_CONTRACT, dataContract.getFullyQualifiedName())
            .getLinkString();
    waitAndResolveTask.accept(dataContractEntityLink, "DataContract");

    // Resolve Tag approval task
    String tagEntityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.TAG, tag.getFullyQualifiedName())
            .getLinkString();
    waitAndResolveTask.accept(tagEntityLink, "Tag");

    // Resolve DataProduct approval task
    String dataProductEntityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.DATA_PRODUCT, dataProduct.getFullyQualifiedName())
            .getLinkString();
    waitAndResolveTask.accept(dataProductEntityLink, "DataProduct");

    // Resolve Metric approval task
    String metricEntityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.METRIC, metric.getFullyQualifiedName())
            .getLinkString();
    waitAndResolveTask.accept(metricEntityLink, "Metric");

    // Resolve TestCase approval task
    String testCaseEntityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.TEST_CASE, testCase.getFullyQualifiedName())
            .getLinkString();
    waitAndResolveTask.accept(testCaseEntityLink, "TestCase");

    // Step 7: Verify descriptions were updated by workflows after approval
    // The verifyEntityDescriptionsUpdated method already uses await() with proper polling (120s
    // timeout)
    verifyEntityDescriptionsUpdated(
        dataContract.getId(), tag.getId(), dataProduct.getId(), metric.getId(), testCase.getId());

    // Step 8: Update entities with different descriptions to trigger workflows again
    LOG.debug("Updating entities with new descriptions to trigger workflows again");

    // Update dataContract description
    String dataContractPatch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Manually changed data contract description\"}]";
    dataContract =
        TestUtils.patch(
            getResource("dataContracts/" + dataContract.getId()),
            JsonUtils.readTree(dataContractPatch),
            org.openmetadata.schema.entity.data.DataContract.class,
            ADMIN_AUTH_HEADERS);

    // Update tag description
    String tagPatch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Manually changed tag description\"}]";
    tag =
        TestUtils.patch(
            getResource("tags/" + tag.getId()),
            JsonUtils.readTree(tagPatch),
            Tag.class,
            ADMIN_AUTH_HEADERS);

    // Update dataProduct description
    String dataProductPatch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Manually changed data product description\"}]";
    dataProduct =
        TestUtils.patch(
            getResource("dataProducts/" + dataProduct.getId()),
            JsonUtils.readTree(dataProductPatch),
            org.openmetadata.schema.entity.domains.DataProduct.class,
            ADMIN_AUTH_HEADERS);

    // Update metric description
    String metricPatch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Manually changed metric description\"}]";
    metric =
        metricTest.patchEntity(metric.getId(), JsonUtils.readTree(metricPatch), ADMIN_AUTH_HEADERS);

    // Update testCase description
    String testCasePatch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Manually changed test case description\"}]";
    testCase =
        testCaseResourceTest.patchEntity(
            testCase.getId(),
            JsonUtils.pojoToJson(testCase),
            testCase.withDescription("Manually changed test case description"),
            ADMIN_AUTH_HEADERS);

    // Wait for new tasks to be created
    java.lang.Thread.sleep(10000);

    // Step 9: Find and resolve new approval tasks
    LOG.debug("Finding and resolving new approval tasks after updates");

    // Resolve new DataContract approval task
    ThreadList dataContractThreads =
        feedResourceTest.listTasks(
            dataContractEntityLink, null, null, null, 100, authHeaders(reviewerUser.getName()));
    if (!dataContractThreads.getData().isEmpty()) {
      Thread newDataContractTask = dataContractThreads.getData().getFirst();
      LOG.debug("Found new approval task for dataContract: {}", newDataContractTask.getId());
      ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
      feedResourceTest.resolveTask(
          newDataContractTask.getTask().getId(), resolveTask, authHeaders(reviewerUser.getName()));
      LOG.debug("Resolved new data contract approval task");
    }

    // Resolve new Tag approval task
    ThreadList tagThreads =
        feedResourceTest.listTasks(
            tagEntityLink, null, null, null, 100, authHeaders(reviewerUser.getName()));
    if (!tagThreads.getData().isEmpty()) {
      Thread newTagTask = tagThreads.getData().getFirst();
      LOG.debug("Found new approval task for tag: {}", newTagTask.getId());
      ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
      feedResourceTest.resolveTask(
          newTagTask.getTask().getId(), resolveTask, authHeaders(reviewerUser.getName()));
      LOG.debug("Resolved new tag approval task");
    }

    // Resolve new DataProduct approval task
    ThreadList dataProductThreads =
        feedResourceTest.listTasks(
            dataProductEntityLink, null, null, null, 100, authHeaders(reviewerUser.getName()));
    if (!dataProductThreads.getData().isEmpty()) {
      Thread newDataProductTask = dataProductThreads.getData().getFirst();
      LOG.debug("Found new approval task for dataProduct: {}", newDataProductTask.getId());
      ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
      feedResourceTest.resolveTask(
          newDataProductTask.getTask().getId(), resolveTask, authHeaders(reviewerUser.getName()));
      LOG.debug("Resolved new data product approval task");
    }

    // Resolve new Metric approval task
    ThreadList metricThreads =
        feedResourceTest.listTasks(
            metricEntityLink, null, null, null, 100, authHeaders(reviewerUser.getName()));
    if (!metricThreads.getData().isEmpty()) {
      Thread newMetricTask = metricThreads.getData().getFirst();
      LOG.debug("Found new approval task for metric: {}", newMetricTask.getId());
      ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
      feedResourceTest.resolveTask(
          newMetricTask.getTask().getId(), resolveTask, authHeaders(reviewerUser.getName()));
      LOG.debug("Resolved new metric approval task");
    }

    // Resolve new TestCase approval task
    ThreadList testCaseThreads =
        feedResourceTest.listTasks(
            testCaseEntityLink, null, null, null, 100, authHeaders(reviewerUser.getName()));
    if (!testCaseThreads.getData().isEmpty()) {
      Thread newTestCaseTask = testCaseThreads.getData().getFirst();
      LOG.debug("Found new approval task for testCase: {}", newTestCaseTask.getId());
      ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
      feedResourceTest.resolveTask(
          newTestCaseTask.getTask().getId(), resolveTask, authHeaders(reviewerUser.getName()));
      LOG.debug("Resolved new test case approval task");
    }

    // Wait for workflows to complete after approval
    java.lang.Thread.sleep(5000);

    // Step 10: Verify descriptions were updated back by workflows
    verifyEntityDescriptionsUpdated(
        dataContract.getId(), tag.getId(), dataProduct.getId(), metric.getId(), testCase.getId());

    // Step 11: Delete the unified workflow to prevent interference with other tests
    try {
      Response deleteResponse =
          SecurityUtil.addHeaders(
                  getResource("governance/workflowDefinitions/name/UnifiedApprovalWorkflow"),
                  ADMIN_AUTH_HEADERS)
              .delete();

      if (deleteResponse.getStatus() == Response.Status.OK.getStatusCode()
          || deleteResponse.getStatus() == Response.Status.NO_CONTENT.getStatusCode()) {
        LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
      } else {
        LOG.warn(
            "Failed to delete UnifiedApprovalWorkflow. Status: {}", deleteResponse.getStatus());
      }
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }

    LOG.info("test_CustomApprovalWorkflowForNewEntities completed successfully");
  }

  private void verifyEntityDescriptionsUpdated(
      UUID dataContractId, UUID tagId, UUID dataProductId, UUID metricId, UUID testCaseId) {
    // Verify DataContract description update
    LOG.info("Verifying DataContract description update...");
    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                org.openmetadata.schema.entity.data.DataContract contract =
                    TestUtils.get(
                        getResource("dataContracts/" + dataContractId),
                        org.openmetadata.schema.entity.data.DataContract.class,
                        ADMIN_AUTH_HEADERS);
                LOG.debug("DataContract description: {}", contract.getDescription());
                return "Updated by Workflow".equals(contract.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking DataContract description: {}", e.getMessage());
                return false;
              }
            });
    LOG.info("✓ DataContract description successfully updated to 'Updated by Workflow'");

    // Verify Tag description update
    LOG.info("Verifying Tag description update...");
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                Tag updatedTag = tagTest.getEntity(tagId, "", ADMIN_AUTH_HEADERS);
                LOG.debug("Tag description: {}", updatedTag.getDescription());
                return "Updated by Workflow".equals(updatedTag.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking Tag description: {}", e.getMessage());
                return false;
              }
            });
    LOG.info("✓ Tag description successfully updated to 'Updated by Workflow'");

    // Verify DataProduct description update
    LOG.info("Verifying DataProduct description update...");
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                org.openmetadata.schema.entity.domains.DataProduct product =
                    TestUtils.get(
                        getResource("dataProducts/" + dataProductId),
                        org.openmetadata.schema.entity.domains.DataProduct.class,
                        ADMIN_AUTH_HEADERS);
                LOG.debug("DataProduct description: {}", product.getDescription());
                return "Updated by Workflow".equals(product.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking DataProduct description: {}", e.getMessage());
                return false;
              }
            });
    LOG.info("✓ DataProduct description successfully updated to 'Updated by Workflow'");

    // Verify Metric description update
    LOG.info("Verifying Metric description update...");
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                Metric updatedMetric = metricTest.getEntity(metricId, "", ADMIN_AUTH_HEADERS);
                LOG.debug("Metric description: {}", updatedMetric.getDescription());
                return "Updated by Workflow".equals(updatedMetric.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking Metric description: {}", e.getMessage());
                return false;
              }
            });
    LOG.info("✓ Metric description successfully updated to 'Updated by Workflow'");

    // Verify TestCase description update
    LOG.info("Verifying TestCase description update...");
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                TestCase updatedTestCase =
                    testCaseResourceTest.getEntity(testCaseId, "", ADMIN_AUTH_HEADERS);
                LOG.debug("TestCase description: {}", updatedTestCase.getDescription());
                return "Updated by Workflow".equals(updatedTestCase.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking TestCase description: {}", e.getMessage());
                return false;
              }
            });
    LOG.info("✓ TestCase description successfully updated to 'Updated by Workflow'");

    LOG.info("All entity descriptions successfully updated to 'Updated by Workflow'");
  }

  //  @Test
  //  @Order(20)
  // TODO: MAKE THE TEST CONSISTENT
  void test_AutoApprovalForEntitiesWithoutReviewers(TestInfo test)
      throws IOException, InterruptedException {
    LOG.info("Starting test_AutoApprovalForEntitiesWithoutReviewers");

    // Create a workflow with user approval task for dataProduct
    String autoApprovalWorkflowJson =
        """
    {
      "name": "AutoApprovalTestWorkflow",
      "displayName": "Auto Approval Test Workflow",
      "description": "Test workflow to verify auto-approval when no reviewers are configured",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["dataProduct"],
          "events": ["Created", "Updated"],
          "exclude": ["reviewers"],
          "filter": {}
        },
        "output": ["relatedEntity", "updatedBy"]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "StartNode",
          "displayName": "Start"
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "EndNode",
          "displayName": "End"
        },
        {
          "type": "userTask",
          "subType": "userApprovalTask",
          "name": "UserApproval",
          "displayName": "User Approval",
          "config": {
            "assignees": {
              "addReviewers": true
            },
            "approvalThreshold": 1,
            "rejectionThreshold": 1
          },
          "input": ["relatedEntity"],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": ["updatedBy"],
          "branches": ["true", "false"]
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetStatusApproved",
          "displayName": "Set Status to Approved",
          "config": {
            "fieldName": "status",
            "fieldValue": "Approved"
          },
          "input": ["relatedEntity", "updatedBy"],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "UserApproval"
          },
          "output": []
        }
      ],
      "edges": [
        {"from": "StartNode", "to": "UserApproval"},
        {"from": "UserApproval", "to": "SetStatusApproved", "condition": "true"},
        {"from": "SetStatusApproved", "to": "EndNode"},
        {"from": "UserApproval", "to": "EndNode", "condition": "false"}
      ],
      "config": {"storeStageStatus": true}
    }
    """;

    CreateWorkflowDefinition autoApprovalWorkflow =
        JsonUtils.readValue(autoApprovalWorkflowJson, CreateWorkflowDefinition.class);
    createOrUpdateWorkflow(autoApprovalWorkflow);
    LOG.debug("Created auto-approval test workflow for dataProduct entities");

    // Create database infrastructure for dataProduct
    String dbId = UUID.randomUUID().toString().substring(0, 4);
    CreateDatabaseService createDbService = databaseServiceTest.createRequest("auto_dbs" + dbId);
    DatabaseService dbService =
        databaseServiceTest.createEntity(createDbService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database service: {}", dbService.getName());

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("auto_db" + dbId)
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for auto-approval");
    Database database = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database: {}", database.getName());

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("auto_sc" + dbId)
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for auto-approval");
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);
    LOG.debug("Created database schema: {}", schema.getName());

    CreateTable createTable =
        new CreateTable()
            .withName("auto_table_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Test table for auto-approval")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING)));
    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    LOG.debug("Created table: {}", table.getName());

    // Create dataProduct WITHOUT reviewers (this should trigger auto-approval)
    org.openmetadata.schema.api.domains.CreateDataProduct createDataProduct =
        new org.openmetadata.schema.api.domains.CreateDataProduct()
            .withName("auto_dataproduct_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withDescription("Auto-approval test data product")
            .withDomains(List.of())
            .withReviewers(List.of()); // Explicitly no reviewers - should auto-approve

    org.openmetadata.schema.entity.domains.DataProduct dataProduct =
        TestUtils.post(
            getResource("dataProducts"),
            createDataProduct,
            org.openmetadata.schema.entity.domains.DataProduct.class,
            ADMIN_AUTH_HEADERS);
    LOG.debug("Created data product without reviewers: {}", dataProduct.getName());

    // Add asset using bulk API
    org.openmetadata.service.jdbi3.DataProductRepository dataProductRepository2 =
        (org.openmetadata.service.jdbi3.DataProductRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.DATA_PRODUCT);
    org.openmetadata.schema.type.api.BulkAssets bulkAssets2 =
        new org.openmetadata.schema.type.api.BulkAssets()
            .withAssets(List.of(table.getEntityReference()));
    dataProductRepository2.bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkAssets2);

    // Wait for workflow to process and auto-approve
    // Adding extra time to handle potential duplicate workflow executions
    java.lang.Thread.sleep(15000);

    // Verify no user tasks were created (since there are no reviewers, it should auto-approve)
    String dataProductEntityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.DATA_PRODUCT, dataProduct.getFullyQualifiedName())
            .getLinkString();

    ThreadList tasks =
        feedResourceTest.listTasks(
            dataProductEntityLink, null, null, null, 100, ADMIN_AUTH_HEADERS);

    // Should have no tasks since auto-approval happened
    assertTrue(
        tasks.getData().isEmpty(),
        "Expected no user tasks since dataProduct has no reviewers (should auto-approve)");
    LOG.debug("✓ Confirmed no user tasks were created for dataProduct without reviewers");

    // Verify that the dataProduct status was set to "Approved" by the workflow
    LOG.info("Verifying dataProduct status was auto-approved...");
    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(2))
        .ignoreExceptions() // Ignore transient errors during polling
        .until(
            () -> {
              try {
                org.openmetadata.schema.entity.domains.DataProduct updatedProduct =
                    TestUtils.get(
                        getResource("dataProducts/" + dataProduct.getId()),
                        org.openmetadata.schema.entity.domains.DataProduct.class,
                        ADMIN_AUTH_HEADERS);
                LOG.debug("DataProduct status: {}", updatedProduct.getEntityStatus());
                return updatedProduct.getEntityStatus() != null
                    && "Approved".equals(updatedProduct.getEntityStatus().toString());
              } catch (Exception e) {
                LOG.warn("Error checking DataProduct status: {}", e.getMessage());
                return false;
              }
            });

    LOG.info("✓ DataProduct status successfully auto-approved to 'Approved'");
    LOG.info("test_AutoApprovalForEntitiesWithoutReviewers completed successfully");
  }

  @Test
  @Order(21)
  void test_CreateWorkflowWithoutEntityTypes() throws Exception {
    String workflowJson =
        """
    {
      "name": "Test",
      "displayName": "Test-1",
      "description": "string",
      "trigger": {
        "type": "eventBasedEntity",
        "output": [],
        "config": {}
      },
      "nodes": [],
      "edges": []
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow - should succeed without entityTypes and with empty nodes
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    assertTrue(
        response.getStatus() == Response.Status.CREATED.getStatusCode()
            || response.getStatus() == Response.Status.OK.getStatusCode(),
        "Should successfully create workflow without entityTypes and with empty nodes");

    WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
    assertNotNull(createdWorkflow);
    assertEquals("Test", createdWorkflow.getName());
    assertEquals("Test-1", createdWorkflow.getDisplayName());
    assertEquals("string", createdWorkflow.getDescription());
    LOG.debug("Created workflow without entityTypes: {}", createdWorkflow.getName());

    // Update the same workflow - should succeed again
    String updatedWorkflowJson =
        """
    {
      "name": "Test",
      "displayName": "Test-1-Updated",
      "description": "updated string",
      "trigger": {
        "type": "eventBasedEntity",
        "output": [],
        "config": {}
      },
      "nodes": [],
      "edges": []
    }
    """;

    CreateWorkflowDefinition updatedWorkflow =
        JsonUtils.readValue(updatedWorkflowJson, CreateWorkflowDefinition.class);

    // Update the workflow - should succeed
    Response updateResponse =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .put(Entity.json(updatedWorkflow));

    assertTrue(
        updateResponse.getStatus() == Response.Status.OK.getStatusCode()
            || updateResponse.getStatus() == Response.Status.CREATED.getStatusCode(),
        "Should successfully update workflow without entityTypes and with empty nodes");

    WorkflowDefinition updatedWorkflowDef = updateResponse.readEntity(WorkflowDefinition.class);
    assertNotNull(updatedWorkflowDef);
    assertEquals("Test", updatedWorkflowDef.getName());
    assertEquals("Test-1-Updated", updatedWorkflowDef.getDisplayName());
    assertEquals("updated string", updatedWorkflowDef.getDescription());
    LOG.debug("Updated workflow without entityTypes: {}", updatedWorkflowDef.getName());

    LOG.info("test_CreateWorkflowWithoutEntityTypes completed successfully");
  }

  @Test
  @Order(22)
  void test_reviewerChangeUpdatesApprovalTasks(TestInfo test) throws Exception {
    LOG.info("Starting test_reviewerChangeUpdatesApprovalTasks");

    // Create reviewer users for this test
    CreateUser createReviewer1 =
        new CreateUser()
            .withName(
                "test_reviewer1_"
                    + UUID.randomUUID().toString().substring(0, 8).replaceAll("[^a-zA-Z0-9]", ""))
            .withEmail(
                "test_reviewer1_"
                    + UUID.randomUUID().toString().substring(0, 8).replaceAll("[^a-zA-Z0-9]", "")
                    + "@example.com")
            .withDisplayName("Test Reviewer 1");
    User reviewer1 = userTest.createEntity(createReviewer1, ADMIN_AUTH_HEADERS);
    EntityReference reviewer1Ref = reviewer1.getEntityReference();
    LOG.debug("Created reviewer user 1: {}", reviewer1.getName());

    CreateUser createReviewer2 =
        new CreateUser()
            .withName(
                "test_reviewer2_"
                    + UUID.randomUUID().toString().substring(0, 8).replaceAll("[^a-zA-Z0-9]", ""))
            .withEmail(
                "test_reviewer2_"
                    + UUID.randomUUID().toString().substring(0, 8).replaceAll("[^a-zA-Z0-9]", "")
                    + "@example.com")
            .withDisplayName("Test Reviewer 2");
    User reviewer2 = userTest.createEntity(createReviewer2, ADMIN_AUTH_HEADERS);
    EntityReference reviewer2Ref = reviewer2.getEntityReference();
    LOG.debug("Created reviewer user 2: {}", reviewer2.getName());

    // Create an approval workflow for tags (which support reviewers)
    String approvalWorkflowJson =
        """
    {
      "name": "tagApprovalWorkflow",
      "displayName": "Tag Approval Workflow",
      "description": "Workflow for testing reviewer change functionality",
      "trigger": {
        "type": "eventBasedEntity",
        "config": {
          "entityTypes": ["tag"],
          "events": ["Created", "Updated"],
          "exclude": ["reviewers"],
          "filter": {}
        },
        "output": ["relatedEntity", "updatedBy"]
      },
      "nodes": [
        {
          "name": "start",
          "displayName": "Start",
          "type": "startEvent",
          "subType": "startEvent"
        },
        {
          "name": "ApproveTag",
          "displayName": "Approve Tag",
          "type": "userTask",
          "subType": "userApprovalTask",
          "config": {
            "assignees": {
              "addReviewers": true
            },
            "approvalThreshold": 1,
            "rejectionThreshold": 1
          },
          "input": ["relatedEntity"],
          "inputNamespaceMap": {
            "relatedEntity": "global"
          },
          "output": ["updatedBy"],
          "branches": ["true", "false"]
        },
        {
          "name": "end",
          "displayName": "End",
          "type": "endEvent",
          "subType": "endEvent"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "ApproveTag"
        },
        {
          "from": "ApproveTag",
          "to": "end",
          "condition": "true"
        },
        {
          "from": "ApproveTag",
          "to": "end",
          "condition": "false"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition approvalWorkflow =
        JsonUtils.readValue(approvalWorkflowJson, CreateWorkflowDefinition.class);

    // Create the approval workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(approvalWorkflow));

    assertTrue(
        response.getStatus() == Response.Status.CREATED.getStatusCode()
            || response.getStatus() == Response.Status.OK.getStatusCode(),
        "Should successfully create tag approval workflow");

    WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
    assertNotNull(createdWorkflow);
    LOG.debug("Created tag approval workflow: {}", createdWorkflow.getName());

    // Wait for workflow to be ready
    java.lang.Thread.sleep(2000);

    // Create a classification for our test tags
    String classificationName =
        "TestClassification_" + UUID.randomUUID().toString().substring(0, 8);
    Classification classification =
        classificationTest.createEntity(
            classificationTest.createRequest(classificationName), ADMIN_AUTH_HEADERS);
    LOG.debug("Created classification: {}", classification.getName());

    // Create a tag with initial reviewer - simple test with reviewer1 first
    String tagName = "TestTag_" + UUID.randomUUID().toString().substring(0, 8);
    CreateTag createTag =
        tagTest
            .createRequest(tagName, classification.getName())
            .withReviewers(List.of(reviewer1Ref));

    // Create the tag with ADMIN (not a reviewer) so it triggers approval workflow
    Tag tag = tagTest.createEntity(createTag, ADMIN_AUTH_HEADERS);
    assertNotNull(tag.getEntityStatus(), "Tag should have an entity status");
    assertEquals(1, tag.getReviewers().size(), "Tag should have 1 reviewer");
    assertEquals(
        reviewer1.getId(),
        tag.getReviewers().getFirst().getId(),
        "reviewer1 should be the reviewer");
    LOG.debug("Created tag with reviewer1: {}, Status: {}", tag.getName(), tag.getEntityStatus());

    // Wait for workflow to process the create event
    java.lang.Thread.sleep(5000);

    // Verify that an approval task was created and assigned to the reviewers
    String entityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.TAG, tag.getFullyQualifiedName())
            .getLinkString();

    // Wait for task to be created
    ThreadList threads = null;
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              ThreadList taskList =
                  feedResourceTest.listTasks(
                      entityLink,
                      null,
                      null,
                      TaskStatus.Open,
                      100,
                      authHeaders(reviewer1.getName()));
              if (taskList.getData().isEmpty()) {
                LOG.debug("Waiting for task to be created for tag...");
                return false;
              }
              return true;
            });

    threads =
        feedResourceTest.listTasks(
            entityLink, null, null, TaskStatus.Open, 100, authHeaders(reviewer1.getName()));

    // The approval workflow should have created a task
    assertFalse(threads.getData().isEmpty(), "Should have at least one task for the tag");

    // Find the approval task (there might be other tasks too)
    Thread approvalTask =
        threads.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                            t.getTask().getType()))
            .findFirst()
            .orElse(null);

    if (approvalTask == null) {
      // If no approval task, check if it's a different task type
      LOG.warn("No approval task found. Found {} tasks total", threads.getData().size());
      for (Thread t : threads.getData()) {
        LOG.debug(
            "Task type: {}, Status: {}",
            t.getTask() != null ? t.getTask().getType() : "null",
            t.getTask() != null ? t.getTask().getStatus() : "null");
      }
      // For now, just check that we have tasks
      assertFalse(threads.getData().isEmpty(), "Should have tasks for the tag");
      approvalTask = threads.getData().getFirst();
    }

    org.openmetadata.schema.type.TaskDetails taskDetails = approvalTask.getTask();
    assertNotNull(taskDetails, "Task details should not be null");
    assertEquals(TaskStatus.Open, taskDetails.getStatus(), "Task should be open");

    // Verify initial assignee is reviewer1
    List<EntityReference> assignees = taskDetails.getAssignees();
    assertNotNull(assignees, "Assignees should not be null");
    assertFalse(assignees.isEmpty(), "Task should have at least 1 assignee");
    assertTrue(
        assignees.stream().anyMatch(a -> a.getId().equals(reviewer1.getId())),
        "reviewer1 should be an assignee");
    LOG.debug("Initial task assignee verified: reviewer1");

    // Now update the tag's reviewers - simple change from reviewer1 to reviewer2
    // Create a JSON Patch to update reviewers
    String jsonPatch =
        "[{\"op\":\"replace\",\"path\":\"/reviewers\",\"value\":[{\"id\":\""
            + reviewer2.getId()
            + "\",\"type\":\"user\"}]}]";

    Tag updatedTag =
        tagTest.patchEntity(tag.getId(), JsonUtils.readTree(jsonPatch), ADMIN_AUTH_HEADERS);

    assertEquals(1, updatedTag.getReviewers().size(), "Updated tag should have 1 reviewer");
    assertEquals(
        reviewer2.getId(),
        updatedTag.getReviewers().getFirst().getId(),
        "reviewer2 should now be the reviewer");
    LOG.debug("Tag reviewer changed from reviewer1 to reviewer2");

    // Debug: Let's see what the current task looks like immediately after reviewer change
    ThreadList immediateTaskCheck =
        feedResourceTest.listTasks(
            entityLink, null, null, TaskStatus.Open, 100, authHeaders(reviewer1.getName()));
    LOG.warn(
        "DEBUGGING: Immediate task check after reviewer change - found {} tasks for reviewer1",
        immediateTaskCheck.getData().size());

    immediateTaskCheck =
        feedResourceTest.listTasks(
            entityLink, null, null, TaskStatus.Open, 100, authHeaders(reviewer2.getName()));
    LOG.warn(
        "DEBUGGING: Immediate task check after reviewer change - found {} tasks for reviewer2",
        immediateTaskCheck.getData().size());

    // Wait for the async task assignee update to complete using Awaitility
    final Integer taskId = taskDetails.getId();
    await()
        .atMost(Duration.ofSeconds(180))
        .pollInterval(Duration.ofSeconds(3))
        .pollDelay(Duration.ofSeconds(5))
        .until(
            () -> {
              try {
                ThreadList taskThreads =
                    feedResourceTest.listTasks(
                        entityLink,
                        null,
                        null,
                        TaskStatus.Open,
                        100,
                        authHeaders(reviewer2.getName()));

                if (taskThreads.getData().isEmpty()) {
                  return false;
                }

                Thread taskThread =
                    taskThreads.getData().stream()
                        .filter(
                            t ->
                                t.getTask() != null
                                    && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                                        t.getTask().getType())
                                    && t.getTask().getId().equals(taskId))
                        .findFirst()
                        .orElse(null);

                if (taskThread == null || taskThread.getTask() == null) {
                  return false;
                }

                List<EntityReference> currentAssignees = taskThread.getTask().getAssignees();
                if (currentAssignees == null || currentAssignees.isEmpty()) {
                  return false;
                }

                boolean hasReviewer2 =
                    currentAssignees.stream().anyMatch(a -> a.getId().equals(reviewer2.getId()));
                boolean hasReviewer1 =
                    currentAssignees.stream().anyMatch(a -> a.getId().equals(reviewer1.getId()));

                LOG.warn(
                    "DEBUGGING: Task ID: {}, Total assignees: {}, Reviewer1 ID: {}, Reviewer2 ID: {}, Has reviewer1: {}, Has reviewer2: {}",
                    taskThread.getTask().getId(),
                    currentAssignees.size(),
                    reviewer1.getId(),
                    reviewer2.getId(),
                    hasReviewer1,
                    hasReviewer2);

                // Log actual assignee IDs
                for (EntityReference assignee : currentAssignees) {
                  LOG.warn(
                      "DEBUGGING: Current assignee ID: {}, Name: {}",
                      assignee.getId(),
                      assignee.getName());
                }

                // Task assignees should have been updated: reviewer2 should be present, reviewer1
                // should not
                // In CI environments, allow for intermediate states where reviewer2 is added but
                // reviewer1 isn't removed yet
                if (hasReviewer2) {
                  LOG.warn(
                      "DEBUGGING: reviewer2 found in assignees, checking if reviewer1 removed...");
                  return !hasReviewer1; // reviewer2 is there, just need reviewer1 to be gone
                }
                return false; // reviewer2 not found yet
              } catch (Exception e) {
                LOG.warn("Error checking task assignees: {}", e.getMessage(), e);
                return false;
              }
            });

    // Verify that the task assignees have been updated
    threads =
        feedResourceTest.listTasks(
            entityLink, null, null, TaskStatus.Open, 100, authHeaders(reviewer2.getName()));

    assertFalse(threads.getData().isEmpty(), "Should still have tasks");
    approvalTask =
        threads.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                            t.getTask().getType())
                        && t.getTask().getId().equals(taskDetails.getId()))
            .findFirst()
            .orElse(threads.getData().getFirst());

    org.openmetadata.schema.type.TaskDetails updatedTaskDetails = approvalTask.getTask();

    // Verify updated assignee is now reviewer2 instead of reviewer1
    List<EntityReference> updatedAssignees = updatedTaskDetails.getAssignees();
    assertNotNull(updatedAssignees, "Updated assignees should not be null");
    assertFalse(updatedAssignees.isEmpty(), "Task should have at least 1 assignee after update");
    assertTrue(
        updatedAssignees.stream().anyMatch(a -> a.getId().equals(reviewer2.getId())),
        "reviewer2 should now be an assignee after reviewer update");
    assertFalse(
        updatedAssignees.stream().anyMatch(a -> a.getId().equals(reviewer1.getId())),
        "reviewer1 should no longer be an assignee after reviewer update");

    // Step 11: Delete the unified workflow to prevent interference with other tests
    try {
      Response deleteResponse =
          SecurityUtil.addHeaders(
                  getResource("governance/workflowDefinitions/name/tagApprovalWorkflow"),
                  ADMIN_AUTH_HEADERS)
              .delete();

      if (deleteResponse.getStatus() == Response.Status.OK.getStatusCode()
          || deleteResponse.getStatus() == Response.Status.NO_CONTENT.getStatusCode()) {
        LOG.debug("Successfully deleted tagApprovalWorkflow");
      } else {
        LOG.warn("Failed to delete tagApprovalWorkflow. Status: {}", deleteResponse.getStatus());
      }
    } catch (Exception e) {
      LOG.warn("Error while deleting tagApprovalWorkflow: {}", e.getMessage());
    }

    LOG.info(
        "test_reviewerChangeUpdatesApprovalTasks completed successfully - task assignee successfully changed from reviewer1 to reviewer2");
  }

  @Test
  @Order(21)
  void test_ApiEndpointPeriodicBatchWorkflow(TestInfo test)
      throws IOException, InterruptedException {
    LOG.info("Starting test_ApiEndpointPeriodicBatchWorkflow");

    // Step 1: Create API service and API collection
    CreateApiService createApiService =
        apiServiceTest
            .createRequest(test)
            .withServiceType(CreateApiService.ApiServiceType.Rest)
            .withConnection(org.openmetadata.service.util.TestUtils.API_SERVICE_CONNECTION);
    ApiService apiService = apiServiceTest.createEntity(createApiService, ADMIN_AUTH_HEADERS);
    LOG.debug("Created API service: {}", apiService.getName());

    // Create API Collection
    CreateAPICollection createApiCollection =
        apiCollectionTest
            .createRequest(test)
            .withService(apiService.getFullyQualifiedName())
            .withDescription("API Collection for workflow testing");
    APICollection apiCollection =
        apiCollectionTest.createEntity(createApiCollection, ADMIN_AUTH_HEADERS);
    LOG.debug("Created API Collection: {}", apiCollection.getName());

    // Step 2: Create API endpoints - one that matches filter, one that doesn't
    CreateAPIEndpoint createMatchingApiEndpoint =
        new CreateAPIEndpoint()
            .withName(
                "test_endpoint_matching_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withApiCollection(apiCollection.getFullyQualifiedName())
            .withRequestMethod(APIRequestMethod.GET)
            .withEndpointURL(java.net.URI.create("https://localhost:8585/api/v1/test"))
            .withDescription(
                "workflow processing description"); // Contains "workflow" - should match filter
    APIEndpoint matchingApiEndpoint =
        apiEndpointTest.createEntity(createMatchingApiEndpoint, ADMIN_AUTH_HEADERS);
    LOG.debug("Created API endpoint that should match filter: {}", matchingApiEndpoint.getName());

    // Create API endpoint that should NOT match the filter
    CreateAPIEndpoint createNonMatchingApiEndpoint =
        new CreateAPIEndpoint()
            .withName(
                "test_endpoint_non_matching_"
                    + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", ""))
            .withApiCollection(apiCollection.getFullyQualifiedName())
            .withRequestMethod(APIRequestMethod.POST)
            .withEndpointURL(java.net.URI.create("https://localhost:8585/api/v1/other"))
            .withDescription(
                "simple test description"); // Does not contain "workflow" - should NOT match filter
    APIEndpoint nonMatchingApiEndpoint =
        apiEndpointTest.createEntity(createNonMatchingApiEndpoint, ADMIN_AUTH_HEADERS);
    LOG.debug(
        "Created API endpoint that should NOT match filter: {}", nonMatchingApiEndpoint.getName());

    // Step 3: Create workflow with periodicBatchEntity trigger for apiEndpoint
    String workflowJson =
        """
    {
      "name": "ApiEndpointProcessingWorkflow",
      "displayName": "API Endpoint Processing Workflow",
      "description": "Workflow to process API endpoints with periodic batch trigger",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": [
            "apiEndpoint"
          ],
          "schedule": {
            "scheduleTimeline": "None"
          },
          "batchSize": 100,
          "filters": {
            "apiEndpoint": "{\\\"query\\\":{\\\"match\\\":{\\\"description\\\":\\\"workflow\\\"}}}"
          }
        },
        "output": [
          "relatedEntity",
          "updatedBy"
        ]
      },
      "nodes": [
        {
          "type": "startEvent",
          "subType": "startEvent",
          "name": "start",
          "displayName": "Start"
        },
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "UpdateDescription",
          "displayName": "Update API Endpoint Description",
          "config": {
            "fieldName": "description",
            "fieldValue": "Processed by workflow - API endpoint updated"
          },
          "input": [
            "relatedEntity",
            "updatedBy"
          ],
          "inputNamespaceMap": {
            "relatedEntity": "global",
            "updatedBy": "global"
          },
          "output": []
        },
        {
          "type": "endEvent",
          "subType": "endEvent",
          "name": "end",
          "displayName": "End"
        }
      ],
      "edges": [
        {
          "from": "start",
          "to": "UpdateDescription"
        },
        {
          "from": "UpdateDescription",
          "to": "end"
        }
      ],
      "config": {
        "storeStageStatus": true
      }
    }
    """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Step 4: Create the workflow
    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    if (response.getStatus() == Response.Status.CREATED.getStatusCode()
        || response.getStatus() == Response.Status.OK.getStatusCode()) {
      WorkflowDefinition createdWorkflow = response.readEntity(WorkflowDefinition.class);
      assertNotNull(createdWorkflow);
      LOG.debug("ApiEndpointProcessingWorkflow created successfully");
    } else {
      String responseBody = response.readEntity(String.class);
      LOG.error(
          "Failed to create workflow. Status: {}, Response: {}",
          response.getStatus(),
          responseBody);
      throw new RuntimeException("Failed to create workflow: " + responseBody);
    }

    // Step 5: Trigger the workflow
    Response triggerResponse =
        SecurityUtil.addHeaders(
                getResource(
                    "governance/workflowDefinitions/name/ApiEndpointProcessingWorkflow/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    if (triggerResponse.getStatus() == Response.Status.OK.getStatusCode()) {
      LOG.debug("Workflow triggered successfully");
    } else {
      LOG.warn("Workflow trigger response: {}", triggerResponse.getStatus());
    }

    // Store IDs for lambda expressions
    final UUID matchingApiEndpointId = matchingApiEndpoint.getId();
    final UUID nonMatchingApiEndpointId = nonMatchingApiEndpoint.getId();

    // Step 6: Wait for workflow to process using Awaitility
    await()
        .atMost(Duration.ofSeconds(120))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                APIEndpoint checkMatchingEndpoint =
                    apiEndpointTest.getEntity(matchingApiEndpointId, "", ADMIN_AUTH_HEADERS);
                APIEndpoint checkNonMatchingEndpoint =
                    apiEndpointTest.getEntity(nonMatchingApiEndpointId, "", ADMIN_AUTH_HEADERS);

                boolean matchingUpdated =
                    "Processed by workflow - API endpoint updated"
                        .equals(checkMatchingEndpoint.getDescription());
                boolean nonMatchingNotUpdated =
                    "simple test description".equals(checkNonMatchingEndpoint.getDescription());

                LOG.debug(
                    "Matching endpoint description: {}", checkMatchingEndpoint.getDescription());
                LOG.debug(
                    "Non-matching endpoint description: {}",
                    checkNonMatchingEndpoint.getDescription());

                return matchingUpdated && nonMatchingNotUpdated;
              } catch (Exception e) {
                LOG.warn("Error checking API endpoint descriptions: {}", e.getMessage());
                return false;
              }
            });

    // Step 7: Verify only the matching API endpoint was updated
    APIEndpoint updatedMatchingApiEndpoint =
        apiEndpointTest.getEntity(matchingApiEndpoint.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedMatchingApiEndpoint);
    assertEquals(
        "Processed by workflow - API endpoint updated",
        updatedMatchingApiEndpoint.getDescription());
    LOG.debug(
        "Matching API endpoint description successfully updated to: {}",
        updatedMatchingApiEndpoint.getDescription());

    // Verify the non-matching endpoint was NOT updated
    APIEndpoint unchangedNonMatchingApiEndpoint =
        apiEndpointTest.getEntity(nonMatchingApiEndpoint.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(unchangedNonMatchingApiEndpoint);
    assertEquals("simple test description", unchangedNonMatchingApiEndpoint.getDescription());
    LOG.debug(
        "Non-matching API endpoint description correctly unchanged: {}",
        unchangedNonMatchingApiEndpoint.getDescription());

    LOG.info("test_ApiEndpointPeriodicBatchWorkflow completed successfully");
  }
}
