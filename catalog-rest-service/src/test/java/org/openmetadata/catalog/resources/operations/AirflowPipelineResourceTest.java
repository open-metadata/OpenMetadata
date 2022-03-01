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

package org.openmetadata.catalog.resources.operations;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.Entity.DATABASE_SERVICE;
import static org.openmetadata.catalog.Entity.helper;
import static org.openmetadata.catalog.airflow.AirflowUtils.INGESTION_CONNECTION_ARGS;
import static org.openmetadata.catalog.airflow.AirflowUtils.INGESTION_DATABASE;
import static org.openmetadata.catalog.airflow.AirflowUtils.INGESTION_HOST_PORT;
import static org.openmetadata.catalog.airflow.AirflowUtils.INGESTION_OPTIONS;
import static org.openmetadata.catalog.airflow.AirflowUtils.INGESTION_PASSWORD;
import static org.openmetadata.catalog.airflow.AirflowUtils.INGESTION_SERVICE_NAME;
import static org.openmetadata.catalog.airflow.AirflowUtils.INGESTION_USERNAME;
import static org.openmetadata.catalog.fernet.Fernet.decryptIfTokenized;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AirflowUtils;
import org.openmetadata.catalog.airflow.models.IngestionAirflowPipeline;
import org.openmetadata.catalog.airflow.models.IngestionTaskConfig;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionComponent;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionConfig;
import org.openmetadata.catalog.airflow.models.OpenMetadataIngestionTask;
import org.openmetadata.catalog.api.operations.pipelines.CreateAirflowPipeline;
import org.openmetadata.catalog.api.operations.pipelines.PipelineConfig;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.jdbi3.AirflowPipelineRepository;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.operations.pipelines.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.operations.pipelines.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.catalog.operations.pipelines.FilterPattern;
import org.openmetadata.catalog.operations.pipelines.PipelineType;
import org.openmetadata.catalog.resources.EntityOperationsResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ConnectionArguments;
import org.openmetadata.catalog.type.ConnectionOptions;
import org.openmetadata.catalog.type.DatabaseConnection;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class AirflowPipelineResourceTest extends EntityOperationsResourceTest<AirflowPipeline, CreateAirflowPipeline> {
  public static PipelineConfig INGESTION_CONFIG;
  public static AirflowConfiguration AIRFLOW_CONFIG;
  public static DatabaseServiceResourceTest DATABASE_SERVICE_RESOURCE_TEST;

  public AirflowPipelineResourceTest() {
    super(
        Entity.AIRFLOW_PIPELINE,
        AirflowPipeline.class,
        AirflowPipelineResource.AirflowPipelineList.class,
        "airflowPipeline",
        AirflowPipelineResource.FIELDS,
        false,
        true,
        false,
        true,
        true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(Arrays.asList("information_schema.*", "test.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(Arrays.asList("sales.*", "users.*")));

    INGESTION_CONFIG =
        new PipelineConfig()
            .withSchema(PipelineConfig.Schema.DATABASE_SERVICE_METADATA_PIPELINE)
            .withConfig(databaseServiceMetadataPipeline);
    AIRFLOW_CONFIG = new AirflowConfiguration();
    AIRFLOW_CONFIG.setApiEndpoint("http://localhost:8080");
    AIRFLOW_CONFIG.setUsername("admin");
    AIRFLOW_CONFIG.setPassword("admin");
    DATABASE_SERVICE_RESOURCE_TEST = new DatabaseServiceResourceTest();
  }

  @Override
  public CreateAirflowPipeline createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateAirflowPipeline()
        .withName(name)
        .withPipelineType(PipelineType.METADATA)
        .withService(getContainer())
        .withPipelineConfig(INGESTION_CONFIG)
        .withStartDate("2021-11-21")
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner);
  }

  @Override
  public EntityReference getContainer() {
    return BIGQUERY_REFERENCE;
  }

  @Override
  public void validateCreatedEntity(
      AirflowPipeline ingestion, CreateAirflowPipeline createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(ingestion),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getConcurrency(), ingestion.getConcurrency());
    validatePipelineConfig(createRequest.getPipelineConfig(), ingestion.getPipelineConfig());
  }

  @Override
  public void compareEntities(AirflowPipeline expected, AirflowPipeline updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertService(expected.getService(), updated.getService());
    assertEquals(expected.getPipelineConfig(), updated.getPipelineConfig());
  }

  @Override
  public EntityInterface<AirflowPipeline> getEntityInterface(AirflowPipeline entity) {
    return new AirflowPipelineRepository.AirflowPipelineEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void post_validAirflowPipeline_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateAirflowPipeline create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AirflowPipelineWithConfig_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withPipelineConfig(INGESTION_CONFIG), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AirflowPipelineWithoutRequiredService_4xx(TestInfo test) {
    CreateAirflowPipeline create = createRequest(test).withService(null);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_AirflowPipelineWithDeploy_4xx(TestInfo test) {
    CreateAirflowPipeline create = createRequest(test).withService(BIGQUERY_REFERENCE).withForceDeploy(true);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    // TODO check for error
  }

  @Test
  void post_AirflowWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {REDSHIFT_REFERENCE, BIGQUERY_REFERENCE};

    // Create Ingestion for each service and test APIs
    for (EntityReference service : differentServices) {
      AirflowPipeline ingestion = createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);
      assertEquals(service.getName(), ingestion.getService().getName());
    }
  }

  @Test
  void post_AirflowWithDatabaseServiceMetadata_200_ok(TestInfo test) throws IOException {
    CreateAirflowPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withScheduleInterval("5 * * * *");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    AirflowPipeline ingestion =
        updateAirflowPipeline(
            request
                .withPipelineConfig(INGESTION_CONFIG)
                .withConcurrency(pipelineConcurrency)
                .withScheduleInterval(expectedScheduleInterval)
                .withStartDate(startDate.toString()),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = BIGQUERY_REFERENCE.getName() + "." + ingestion.getName();
    validatePipelineConfig(INGESTION_CONFIG, ingestion.getPipelineConfig());
    assertEquals(startDate.toString(), ingestion.getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
  }

  @Test
  void post_AirflowWithDatabaseServiceQueryUsage_200_ok(TestInfo test) throws IOException {
    CreateAirflowPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withScheduleInterval("5 * * * *");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    DatabaseServiceQueryUsagePipeline queryUsagePipeline =
        new DatabaseServiceQueryUsagePipeline().withQueryLogDuration(1).withStageFileLocation("/tmp/test.log");
    PipelineConfig queryUsageConfig =
        new PipelineConfig()
            .withSchema(PipelineConfig.Schema.DATABASE_SERVICE_QUERY_USAGE_PIPELINE)
            .withConfig(queryUsagePipeline);
    // Updating description is ignored when backend already has description
    AirflowPipeline ingestion =
        updateAirflowPipeline(
            request
                .withPipelineConfig(queryUsageConfig)
                .withConcurrency(pipelineConcurrency)
                .withScheduleInterval(expectedScheduleInterval)
                .withStartDate(startDate.toString()),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = BIGQUERY_REFERENCE.getName() + "." + ingestion.getName();
    validatePipelineConfig(queryUsageConfig, ingestion.getPipelineConfig());
    assertEquals(startDate.toString(), ingestion.getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
  }

  @Test
  void put_AirflowPipelineUrlUpdate_200(TestInfo test) throws IOException {
    CreateAirflowPipeline request =
        createRequest(test)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withScheduleInterval("5 * * * *");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    AirflowPipeline ingestion =
        updateAirflowPipeline(
            request
                .withPipelineConfig(INGESTION_CONFIG)
                .withConcurrency(pipelineConcurrency)
                .withScheduleInterval(expectedScheduleInterval)
                .withStartDate(startDate.toString()),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = BIGQUERY_REFERENCE.getName() + "." + ingestion.getName();
    assertEquals(startDate.toString(), ingestion.getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(false)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(List.of("test.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(List.of("sales.*")));

    PipelineConfig updatedPipelineConfig =
        new PipelineConfig()
            .withSchema(PipelineConfig.Schema.DATABASE_SERVICE_METADATA_PIPELINE)
            .withConfig(metadataPipeline);
    AirflowPipeline updatedIngestion =
        updateAirflowPipeline(
            request
                .withPipelineConfig(updatedPipelineConfig)
                .withConcurrency(pipelineConcurrency)
                .withScheduleInterval(expectedScheduleInterval)
                .withStartDate(startDate.toString()),
            OK,
            ADMIN_AUTH_HEADERS);
    assertEquals(startDate.toString(), ingestion.getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
    validatePipelineConfig(updatedPipelineConfig, updatedIngestion.getPipelineConfig());
  }

  @Test
  void post_AirflowWithDatabaseServiceMetadata_GeneratedIngestionPipelineConfig_200_ok(TestInfo test)
      throws IOException, ParseException {
    CreateAirflowPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withScheduleInterval("5 * * * *")
            .withOwner(USER_OWNER1);
    AirflowPipeline airflowPipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update pipeline attributes
    // TODO move this updateAndCheckEntity
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    AirflowPipeline ingestion =
        updateAirflowPipeline(
            request
                .withPipelineConfig(INGESTION_CONFIG)
                .withConcurrency(pipelineConcurrency)
                .withScheduleInterval(expectedScheduleInterval)
                .withStartDate(startDate.toString()),
            OK,
            ADMIN_AUTH_HEADERS);

    String expectedFQN = BIGQUERY_REFERENCE.getName() + "." + ingestion.getName();
    validatePipelineConfig(INGESTION_CONFIG, ingestion.getPipelineConfig());
    assertEquals(startDate.toString(), ingestion.getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());

    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
    validateGeneratedAirflowPipelineConfig(airflowPipeline);

    // Update and connector orgs and options to database connection
    DatabaseService databaseService = helper(airflowPipeline).findEntity("service", DATABASE_SERVICE);
    DatabaseConnection databaseConnection = databaseService.getDatabaseConnection();
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions().withAdditionalProperty("key1", "value1").withAdditionalProperty("key2", "value2");
    databaseConnection.withConnectionOptions(connectionOptions).withConnectionArguments(connectionArguments);
    databaseService.setDatabaseConnection(databaseConnection);
    // TODO this needs to be fixed
    //    DatabaseService updatedService =
    //        DATABASE_SERVICE_RESOURCE_TEST.updateEntity(databaseService, OK, ADMIN_AUTH_HEADERS);
    //    assertEquals(databaseService.getDatabaseConnection(), updatedService.getDatabaseConnection());
    //    validateGeneratedAirflowPipelineConfig(airflowPipeline);
  }

  @Test
  void list_AirflowPipelinesList_200(TestInfo test) throws IOException {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createSnowflakeService =
        new CreateDatabaseService()
            .withName("snowflake_test_list")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake)
            .withDatabaseConnection(TestUtils.DATABASE_CONNECTION);
    DatabaseService snowflakeDatabaseService =
        databaseServiceResourceTest.createEntity(createSnowflakeService, ADMIN_AUTH_HEADERS);
    EntityReference snowflakeRef =
        new EntityReference()
            .withName(snowflakeDatabaseService.getName())
            .withId(snowflakeDatabaseService.getId())
            .withType(Entity.DATABASE_SERVICE);

    CreateDatabaseService createBigQueryService =
        new CreateDatabaseService()
            .withName("bigquery_test_list")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.BigQuery)
            .withDatabaseConnection(TestUtils.DATABASE_CONNECTION);
    DatabaseService databaseService =
        databaseServiceResourceTest.createEntity(createBigQueryService, ADMIN_AUTH_HEADERS);
    EntityReference bigqueryRef =
        new EntityReference()
            .withName(databaseService.getName())
            .withId(databaseService.getId())
            .withType(Entity.DATABASE_SERVICE);

    CreateAirflowPipeline requestPipeline_1 =
        createRequest(test)
            .withName("ingestion_1")
            .withPipelineType(PipelineType.METADATA)
            .withService(bigqueryRef)
            .withDescription("description")
            .withScheduleInterval("5 * * * *");
    AirflowPipeline pipelineBigquery1 = createAndCheckEntity(requestPipeline_1, ADMIN_AUTH_HEADERS);
    CreateAirflowPipeline requestPipeline_2 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(bigqueryRef)
            .withDescription("description")
            .withScheduleInterval("5 * * * *");
    AirflowPipeline pipelineBigquery2 = createAndCheckEntity(requestPipeline_2, ADMIN_AUTH_HEADERS);
    CreateAirflowPipeline requestPipeline_3 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(snowflakeRef)
            .withDescription("description")
            .withScheduleInterval("5 * * * *");
    AirflowPipeline airflowPipeline3 = createAndCheckEntity(requestPipeline_3, ADMIN_AUTH_HEADERS);
    // List charts by filtering on service name and ensure right charts in the response
    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("service", bigqueryRef.getName());
          }
        };
    Predicate<AirflowPipeline> isPipelineBigquery1 = p -> p.getId().equals(pipelineBigquery1.getId());
    Predicate<AirflowPipeline> isPipelineBigquery2 = u -> u.getId().equals(pipelineBigquery2.getId());
    Predicate<AirflowPipeline> isPipelineBigquery3 = u -> u.getId().equals(airflowPipeline3.getId());
    List<AirflowPipeline> actualBigqueryPipelines = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(2, actualBigqueryPipelines.size());
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery1));
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery2));
    queryParams =
        new HashMap<>() {
          {
            put("service", snowflakeRef.getName());
          }
        };
    List<AirflowPipeline> actualSnowflakePipelines = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(1, actualSnowflakePipelines.size());
    assertTrue(actualSnowflakePipelines.stream().anyMatch(isPipelineBigquery3));
  }

  @Test
  void put_AirflowPipelineUpdate_200(TestInfo test) throws IOException {
    CreateAirflowPipeline request =
        createRequest(test).withService(BIGQUERY_REFERENCE).withDescription(null).withOwner(null);
    AirflowPipeline ingestion = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description and tasks
    ChangeDescription change = getChangeDescription(ingestion.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
    change.getFieldsAdded().add(new FieldChange().withName("owner").withNewValue(USER_OWNER1));
    updateAndCheckEntity(
        request.withDescription("newDescription").withOwner(USER_OWNER1), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void delete_nonEmptyPipeline_4xx() {
    // TODO
  }

  private AirflowPipeline updateAirflowPipeline(
      CreateAirflowPipeline create, Status status, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getCollection(), create, AirflowPipeline.class, status, authHeaders);
  }

  /**
   * Validate returned fields GET .../operations/airflowpipelines/{id}?fields="..." or GET
   * .../operations/airflowpipelines/name/{fqn}?fields="..."
   */
  @Override
  public void validateGetWithDifferentFields(AirflowPipeline ingestion, boolean byName) throws HttpResponseException {
    String fields = "";
    ingestion =
        byName
            ? getEntityByName(ingestion.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(ingestion.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(ingestion.getService());
    assertListNull(ingestion.getOwner());

    fields = "owner";
    ingestion =
        byName
            ? getEntityByName(ingestion.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(ingestion.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(ingestion.getOwner(), ingestion.getService());
  }

  private void validatePipelineConfig(PipelineConfig orig, PipelineConfig updated) {
    assertEquals(orig.getSchema(), updated.getSchema());
    if (orig.getSchema().equals(PipelineConfig.Schema.DATABASE_SERVICE_METADATA_PIPELINE)) {
      DatabaseServiceMetadataPipeline origConfig = (DatabaseServiceMetadataPipeline) orig.getConfig();
      DatabaseServiceMetadataPipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DatabaseServiceMetadataPipeline.class);
      assertEquals(origConfig, updatedConfig);
    } else if (orig.getSchema().equals(PipelineConfig.Schema.DATABASE_SERVICE_QUERY_USAGE_PIPELINE)) {
      DatabaseServiceQueryUsagePipeline origConfig = (DatabaseServiceQueryUsagePipeline) orig.getConfig();
      DatabaseServiceQueryUsagePipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DatabaseServiceQueryUsagePipeline.class);
      assertEquals(origConfig, updatedConfig);
    }
  }

  private void validateGeneratedAirflowPipelineConfig(AirflowPipeline airflowPipeline)
      throws IOException, ParseException {
    IngestionAirflowPipeline ingestionPipeline =
        AirflowUtils.toIngestionPipeline(airflowPipeline, AIRFLOW_CONFIG, true);
    DatabaseService databaseService = helper(airflowPipeline).findEntity("service", DATABASE_SERVICE);
    DatabaseConnection databaseConnection = databaseService.getDatabaseConnection();
    DatabaseServiceMetadataPipeline metadataPipeline =
        JsonUtils.convertValue(airflowPipeline.getPipelineConfig().getConfig(), DatabaseServiceMetadataPipeline.class);
    assertEquals(ingestionPipeline.getConcurrency(), airflowPipeline.getConcurrency());
    // there should be one airflow task that encompases all of metadata pipeline config
    assertEquals(1, ingestionPipeline.getTasks().size());
    OpenMetadataIngestionTask airflowTask = ingestionPipeline.getTasks().get(0);
    IngestionTaskConfig taskConfig = airflowTask.getConfig();
    Map<String, Object> taskParams = taskConfig.getOpKwargs();
    assertEquals("metadata_ingestion_workflow", taskConfig.getPythonCallableName());
    assertEquals("metadata_ingestion.py", taskConfig.getPythonCallableFile());
    assertNotNull(taskParams);
    OpenMetadataIngestionConfig openMetadataIngestionConfig =
        (OpenMetadataIngestionConfig) taskParams.get("workflow_config");
    OpenMetadataIngestionComponent source = openMetadataIngestionConfig.getSource();
    assertEquals(
        databaseService.getServiceType().value().toLowerCase(Locale.ROOT), source.getType().toLowerCase(Locale.ROOT));
    assertEquals(databaseService.getName(), source.getConfig().get(INGESTION_SERVICE_NAME));
    assertEquals(databaseConnection.getHostPort(), source.getConfig().get(INGESTION_HOST_PORT));
    assertEquals(databaseConnection.getUsername(), source.getConfig().get(INGESTION_USERNAME));
    assertEquals(decryptIfTokenized(databaseConnection.getPassword()), source.getConfig().get(INGESTION_PASSWORD));
    assertEquals(databaseConnection.getDatabase(), source.getConfig().get(INGESTION_DATABASE));
    if (databaseConnection.getConnectionArguments() != null) {
      assertEquals(
          databaseConnection.getConnectionArguments().getAdditionalProperties(),
          source.getConfig().get(INGESTION_CONNECTION_ARGS));
    }
    if (databaseConnection.getConnectionOptions() != null) {
      assertEquals(
          databaseConnection.getConnectionOptions().getAdditionalProperties(),
          source.getConfig().get(INGESTION_OPTIONS));
    }
  }
}
