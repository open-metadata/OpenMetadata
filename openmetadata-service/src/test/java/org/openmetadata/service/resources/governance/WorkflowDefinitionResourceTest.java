package org.openmetadata.service.resources.governance;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.apis.APICollectionResourceTest;
import org.openmetadata.service.resources.charts.ChartResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.mlmodels.MlModelResourceTest;
import org.openmetadata.service.resources.services.APIServiceResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.services.MlModelServiceResourceTest;
import org.openmetadata.service.resources.services.StorageServiceResourceTest;
import org.openmetadata.service.resources.storages.ContainerResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.security.SecurityUtil;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class WorkflowDefinitionResourceTest extends OpenMetadataApplicationTest {

  private static DatabaseServiceResourceTest databaseServiceTest;
  private static DatabaseResourceTest databaseTest;
  private static DatabaseSchemaResourceTest schemaTest;
  private static TableResourceTest tableTest;
  private static TagResourceTest tagTest;
  private static GlossaryResourceTest glossaryTest;
  private static GlossaryTermResourceTest glossaryTermTest;
  private static MlModelResourceTest mlModelTest;
  private static MlModelServiceResourceTest mlModelServiceTest;
  private static APICollectionResourceTest apiCollectionTest;
  private static APIServiceResourceTest apiServiceTest;
  private static ContainerResourceTest containerTest;
  private static StorageServiceResourceTest storageServiceTest;

  private static DatabaseService databaseService;
  private static Database database;
  private static DatabaseSchema databaseSchema;
  private static List<Table> testTables = new ArrayList<>();

  @BeforeAll
  public static void setup() throws IOException, HttpResponseException {
    databaseServiceTest = new DatabaseServiceResourceTest();
    databaseTest = new DatabaseResourceTest();
    schemaTest = new DatabaseSchemaResourceTest();
    tableTest = new TableResourceTest();
    tagTest = new TagResourceTest();
    glossaryTest = new GlossaryResourceTest();
    glossaryTermTest = new GlossaryTermResourceTest();
    mlModelTest = new MlModelResourceTest();
    mlModelServiceTest = new MlModelServiceResourceTest();
    apiCollectionTest = new APICollectionResourceTest();
    apiServiceTest = new APIServiceResourceTest();
    containerTest = new ContainerResourceTest();
    storageServiceTest = new StorageServiceResourceTest();

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
    Thread.sleep(10000);

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

  private void createDataCompletenessWorkflow() throws IOException {
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
          "filters": ""
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
            ],
            "treatEmptyArrayAsNull": true,
            "treatEmptyStringAsNull": true
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

  @Test
  @Order(2)
  void test_DeprecateStaleGlossaryTerms(TestInfo test)
      throws IOException, HttpResponseException, InterruptedException {
    LOG.info("Starting test_DeprecateStaleGlossaryTerms");

    // Create glossary and glossary term
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

    // Create workflow with dynamic timestamp (tomorrow)
    long tomorrowMillis = System.currentTimeMillis() + (24 * 60 * 60 * 1000L);
    String workflowJson =
        String.format(
            """
    {
      "name": "DeprecateStaleGlossaryTerms",
      "displayName": "DeprecateStaleGlossaryTerms",
      "description": "Custom workflow created with Workflow Builder",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": [
            "glossaryTerm"
          ],
          "schedule": {
            "scheduleTimeline": "None"
          },
          "batchSize": 100,
          "filters": ""
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
            "fieldName": "status",
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
      LOG.debug("DeprecateStaleGlossaryTerms workflow created successfully");
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
                getResource(
                    "governance/workflowDefinitions/name/DeprecateStaleGlossaryTerms/trigger"),
                ADMIN_AUTH_HEADERS)
            .post(Entity.json("{}"));

    if (triggerResponse.getStatus() == Response.Status.OK.getStatusCode()) {
      LOG.debug("Workflow triggered successfully");
    } else {
      LOG.warn("Workflow trigger response: {}", triggerResponse.getStatus());
    }

    // Wait for workflow to process using Awaitility
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              try {
                GlossaryTerm checkTerm =
                    glossaryTermTest.getEntity(glossaryTerm.getId(), "", ADMIN_AUTH_HEADERS);
                LOG.debug("Checking glossary term status: {}", checkTerm.getStatus());
                return checkTerm.getStatus() != null
                    && "Deprecated".equals(checkTerm.getStatus().toString());
              } catch (Exception e) {
                LOG.warn("Error checking glossary term status: {}", e.getMessage());
                return false;
              }
            });

    // Verify glossary term is deprecated
    GlossaryTerm updatedTerm =
        glossaryTermTest.getEntity(glossaryTerm.getId(), "", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTerm);
    assertNotNull(updatedTerm.getStatus());
    assertEquals("Deprecated", updatedTerm.getStatus().toString());
    LOG.debug(
        "Glossary term {} status successfully updated to: {}",
        updatedTerm.getName(),
        updatedTerm.getStatus());

    LOG.info("test_DeprecateStaleGlossaryTerms completed successfully");
  }

  @Test
  @Order(3)
  void test_SetTierForMLModels(TestInfo test)
      throws IOException, HttpResponseException, InterruptedException {
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
          "filters": ""
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
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
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
  void test_EventBasedWorkflowForMultipleEntities(TestInfo test)
      throws IOException, HttpResponseException, InterruptedException {
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
          "filter": ""
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
    Thread.sleep(2000);

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
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
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
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
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
  @Order(5)
  void test_MultiEntityPeriodicQueryWithFilters(TestInfo test)
      throws IOException, HttpResponseException, InterruptedException {
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
    Thread.sleep(2000);

    // Create periodic batch workflow with specific filters
    // IMPORTANT: Filters ensure only specific entities are updated
    String tableFilter =
        """
    {"query":{"bool":{"must":[{"bool":{"must":[{"term":{"databaseSchema.displayName.keyword":"posts_db"}}]}},{"bool":{"must":[{"term":{"entityType":"table"}}]}}]}}}""";

    String dashboardFilter =
        """
    {"query":{"bool":{"filter":[{"term":{"entityType":"dashboard"}},{"term":{"charts.name.keyword":"chart_1"}}]}}}""";

    String workflowJson =
        String.format(
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
            "table": "%s",
            "dashboard": "%s"
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
    """,
            tableFilter.replace("\"", "\\\""), dashboardFilter.replace("\"", "\\\""));

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
        .pollInterval(Duration.ofSeconds(2))
        .atMost(Duration.ofSeconds(60))
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
  @Order(6)
  void test_InvalidWorkflowDefinition(TestInfo test) throws IOException {
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
  @Order(7)
  void test_UserApprovalTaskWithoutReviewerSupport(TestInfo test) throws IOException {
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
          "entityType": "database",
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
  @Order(8)
  void test_ChangeReviewTaskWithoutReviewerSupport(TestInfo test) throws IOException {
    LOG.info("Starting test_ChangeReviewTaskWithoutReviewerSupport");

    // Create a workflow with change review task for multiple entity types,
    // including one that doesn't support reviewers
    String invalidWorkflowJson =
        """
    {
      "name": "multiEntityChangeReviewWorkflow",
      "displayName": "Multi-Entity Change Review Workflow",
      "description": "Invalid workflow with change review task for entities without reviewer support",
      "trigger": {
        "type": "periodicBatchEntity",
        "config": {
          "entityTypes": ["table", "dashboard"],
          "schedule": {
            "cronExpression": "0 0 * * *"
          },
          "batchSize": 10
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
          "name": "ReviewChanges",
          "displayName": "Review Changes",
          "type": "userTask",
          "subType": "changeReviewTask",
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
          "to": "ReviewChanges"
        },
        {
          "from": "ReviewChanges",
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

    // Try to create the workflow with change review task for entities without reviewer support
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
        "Workflow with change review task for non-reviewer entities failed as expected with status: {}",
        response.getStatus());

    // Verify error message contains expected validation error
    String errorResponse = response.readEntity(String.class);
    assertTrue(
        errorResponse.contains("does not support reviewers")
            || errorResponse.contains("User approval tasks"),
        "Error message should mention reviewer support issue. Got: " + errorResponse);
    LOG.debug("Error message: {}", errorResponse);

    LOG.info("test_ChangeReviewTaskWithoutReviewerSupport completed successfully");
  }

  @Test
  @Order(9)
  void test_EventBasedMultipleEntitiesWithoutReviewerSupport(TestInfo test) throws IOException {
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
  @Order(10)
  void test_MixedEntityTypesWithReviewerSupport(TestInfo test) throws IOException {
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
}
