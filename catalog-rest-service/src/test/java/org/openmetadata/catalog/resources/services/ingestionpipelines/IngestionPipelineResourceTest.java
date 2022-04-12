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

package org.openmetadata.catalog.resources.services.ingestionpipelines;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.catalog.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.catalog.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceEntityInterface;
import org.openmetadata.catalog.jdbi3.IngestionPipelineRepository;
import org.openmetadata.catalog.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.catalog.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.metadataIngestion.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.catalog.metadataIngestion.FilterPattern;
import org.openmetadata.catalog.metadataIngestion.MessagingServiceMetadataPipeline;
import org.openmetadata.catalog.metadataIngestion.SourceConfig;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.services.connections.database.BigQueryConnection;
import org.openmetadata.catalog.services.connections.database.ConnectionArguments;
import org.openmetadata.catalog.services.connections.database.ConnectionOptions;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class IngestionPipelineResourceTest extends EntityResourceTest<IngestionPipeline, CreateIngestionPipeline> {
  public static SourceConfig DATABASE_METADATA_CONFIG;
  public static SourceConfig DASHBOARD_METADATA_CONFIG;
  public static SourceConfig MESSAGING_METADATA_CONFIG;
  public static AirflowConfiguration AIRFLOW_CONFIG;
  public static DatabaseServiceResourceTest DATABASE_SERVICE_RESOURCE_TEST;

  public IngestionPipelineResourceTest() {
    super(
        Entity.INGESTION_PIPELINE,
        IngestionPipeline.class,
        IngestionPipelineResource.IngestionPipelineList.class,
        "services/ingestionPipelines",
        IngestionPipelineResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(List.of("information_schema.*", "test.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(List.of("sales.*", "users.*")));
    DashboardServiceMetadataPipeline dashboardServiceMetadataPipeline =
        new DashboardServiceMetadataPipeline()
            .withDashboardFilterPattern(new FilterPattern().withIncludes(List.of("dashboard.*", "users.*")));
    MessagingServiceMetadataPipeline messagingServiceMetadataPipeline =
        new MessagingServiceMetadataPipeline()
            .withTopicFilterPattern(new FilterPattern().withExcludes(List.of("orders.*")));
    DATABASE_METADATA_CONFIG = new SourceConfig().withConfig(databaseServiceMetadataPipeline);
    DASHBOARD_METADATA_CONFIG = new SourceConfig().withConfig(dashboardServiceMetadataPipeline);
    MESSAGING_METADATA_CONFIG = new SourceConfig().withConfig(messagingServiceMetadataPipeline);
    AIRFLOW_CONFIG = new AirflowConfiguration();
    AIRFLOW_CONFIG.setApiEndpoint("http://localhost:8080");
    AIRFLOW_CONFIG.setUsername("admin");
    AIRFLOW_CONFIG.setPassword("admin");
    DATABASE_SERVICE_RESOURCE_TEST = new DatabaseServiceResourceTest();
  }

  @Override
  public CreateIngestionPipeline createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateIngestionPipeline()
        .withName(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withPipelineType(PipelineType.METADATA)
        .withService(getContainer())
        .withSourceConfig(DATABASE_METADATA_CONFIG)
        .withAirflowConfig(new AirflowConfig().withStartDate("2021-11-21").withForceDeploy(false))
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
      IngestionPipeline ingestion, CreateIngestionPipeline createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(ingestion),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getAirflowConfig().getConcurrency(), ingestion.getAirflowConfig().getConcurrency());
    validateSourceConfig(createRequest.getSourceConfig(), ingestion.getSource().getSourceConfig(), ingestion);
  }

  @Override
  public void compareEntities(IngestionPipeline expected, IngestionPipeline updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertReference(expected.getService(), updated.getService());
    assertEquals(expected.getSource().getSourceConfig(), updated.getSource().getSourceConfig());
  }

  @Override
  public EntityInterface<IngestionPipeline> getEntityInterface(IngestionPipeline entity) {
    return new IngestionPipelineRepository.IngestionPipelineEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void post_validIngestionPipeline_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateIngestionPipeline create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_IngestionPipelineWithConfig_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withSourceConfig(DATABASE_METADATA_CONFIG), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_IngestionPipelineWithoutRequiredService_4xx(TestInfo test) {
    CreateIngestionPipeline create = createRequest(test).withService(null);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_IngestionPipelineWithDeploy_4xx(TestInfo test) {
    CreateIngestionPipeline create =
        createRequest(test)
            .withService(BIGQUERY_REFERENCE)
            .withAirflowConfig(new AirflowConfig().withStartDate("2021-11-21").withForceDeploy(true));
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    // TODO check for error
  }

  @Test
  void post_AirflowWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {REDSHIFT_REFERENCE, BIGQUERY_REFERENCE};

    // Create Ingestion for each service and test APIs
    for (EntityReference service : differentServices) {
      IngestionPipeline ingestion = createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);
      assertEquals(service.getName(), ingestion.getService().getName());
    }
  }

  @Test
  void post_AirflowWithDatabaseServiceMetadata_200_ok(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withStartDate("2021-11-21").withScheduleInterval("5 * * * *"));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    IngestionPipeline ingestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(DATABASE_METADATA_CONFIG)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(DATABASE_METADATA_CONFIG, ingestion.getSource().getSourceConfig(), ingestion);
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
  }

  @Test
  void post_AirflowWithDatabaseServiceQueryUsage_200_ok(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    DatabaseServiceQueryUsagePipeline queryUsagePipeline =
        new DatabaseServiceQueryUsagePipeline().withQueryLogDuration(1).withStageFileLocation("/tmp/test.log");
    SourceConfig queryUsageConfig = new SourceConfig().withConfig(queryUsagePipeline);
    // Updating description is ignored when backend already has description
    IngestionPipeline ingestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(queryUsageConfig)
                .withPipelineType(PipelineType.USAGE)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(queryUsageConfig, ingestion.getSource().getSourceConfig(), ingestion);
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
  }

  @Test
  void put_IngestionPipelineUrlUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    IngestionPipeline ingestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(DATABASE_METADATA_CONFIG)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(false)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(List.of("test.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(List.of("sales.*")));

    SourceConfig updatedSourceConfig = new SourceConfig().withConfig(metadataPipeline);
    IngestionPipeline updatedIngestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(updatedSourceConfig)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    validateSourceConfig(updatedSourceConfig, updatedIngestion.getSource().getSourceConfig(), ingestion);
  }

  @Test
  void put_IngestionPipelineForDashboardSourceUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withService(new EntityReference().withId(SUPERSET_REFERENCE.getId()).withType("dashboardService"))
            .withDescription("description")
            .withSourceConfig(DASHBOARD_METADATA_CONFIG)
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    IngestionPipeline ingestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(DASHBOARD_METADATA_CONFIG)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.build(SUPERSET_REFERENCE.getName(), ingestion.getName());
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    DashboardServiceMetadataPipeline dashboardServiceMetadataPipeline =
        new DashboardServiceMetadataPipeline()
            .withDashboardFilterPattern(new FilterPattern().withIncludes(List.of("test1.*", "test2.*")));

    SourceConfig updatedSourceConfig = new SourceConfig().withConfig(dashboardServiceMetadataPipeline);
    IngestionPipeline updatedIngestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(updatedSourceConfig)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    validateSourceConfig(updatedSourceConfig, updatedIngestion.getSource().getSourceConfig(), ingestion);
  }

  @Test
  void put_IngestionPipelineForMessagingSourceUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withService(new EntityReference().withId(KAFKA_REFERENCE.getId()).withType("messagingService"))
            .withDescription("description")
            .withSourceConfig(MESSAGING_METADATA_CONFIG)
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    IngestionPipeline ingestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(MESSAGING_METADATA_CONFIG)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.build(KAFKA_REFERENCE.getName(), ingestion.getName());
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    MessagingServiceMetadataPipeline messagingServiceMetadataPipeline =
        new MessagingServiceMetadataPipeline()
            .withTopicFilterPattern(new FilterPattern().withIncludes(List.of("topic1.*", "topic2.*")));
    SourceConfig updatedSourceConfig = new SourceConfig().withConfig(messagingServiceMetadataPipeline);
    IngestionPipeline updatedIngestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(updatedSourceConfig)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    validateSourceConfig(updatedSourceConfig, updatedIngestion.getSource().getSourceConfig(), ingestion);
  }

  @Test
  void post_AirflowWithDatabaseServiceMetadata_GeneratedIngestionPipelineConfig_200_ok(TestInfo test)
      throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"))
            .withOwner(USER_OWNER1);
    IngestionPipeline ingestionPipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update pipeline attributes
    // TODO move this updateAndCheckEntity
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    IngestionPipeline ingestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(DATABASE_METADATA_CONFIG)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate.toString())),
            OK,
            ADMIN_AUTH_HEADERS);

    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(DATABASE_METADATA_CONFIG, ingestion.getSource().getSourceConfig(), ingestionPipeline);
    assertEquals(startDate.toString(), ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());

    ingestion = getEntity(ingestion.getId(), "owner", ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());

    // Update and connector orgs and options to database connection
    DatabaseService databaseService =
        Entity.getEntity(ingestionPipeline.getService(), Fields.EMPTY_FIELDS, Include.ALL);
    DatabaseConnection databaseConnection = databaseService.getConnection();
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com");
    ConnectionOptions connectionOptions =
        new ConnectionOptions().withAdditionalProperty("key1", "value1").withAdditionalProperty("key2", "value2");
    BigQueryConnection bigQueryConnection =
        JsonUtils.convertValue(databaseService.getConnection().getConfig(), BigQueryConnection.class);
    bigQueryConnection.setConnectionArguments(connectionArguments);
    bigQueryConnection.setConnectionOptions(connectionOptions);
    databaseConnection.setConfig(bigQueryConnection);
    CreateDatabaseService createDatabaseService =
        new CreateDatabaseService()
            .withName(databaseService.getName())
            .withServiceType(databaseService.getServiceType())
            .withConnection(databaseConnection);
    DatabaseService updatedService =
        DATABASE_SERVICE_RESOURCE_TEST.updateEntity(createDatabaseService, OK, ADMIN_AUTH_HEADERS);
    BigQueryConnection expectedBigQueryConnection = (BigQueryConnection) databaseService.getConnection().getConfig();
    BigQueryConnection actualBigQueryConnection =
        JsonUtils.convertValue(updatedService.getConnection().getConfig(), BigQueryConnection.class);
    DatabaseServiceResourceTest.validateBigQueryConnection(expectedBigQueryConnection, actualBigQueryConnection);
  }

  @Test
  void list_IngestionPipelinesList_200(TestInfo test) throws IOException {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createSnowflakeService =
        new CreateDatabaseService()
            .withName("snowflake_test_list")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake)
            .withConnection(TestUtils.SNOWFLAKE_DATABASE_CONNECTION);
    DatabaseService snowflakeDatabaseService =
        databaseServiceResourceTest.createEntity(createSnowflakeService, ADMIN_AUTH_HEADERS);
    EntityReference snowflakeRef = new DatabaseServiceEntityInterface(snowflakeDatabaseService).getEntityReference();

    CreateDatabaseService createBigQueryService =
        new CreateDatabaseService()
            .withName("bigquery_test_list")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.BigQuery)
            .withConnection(TestUtils.BIGQUERY_DATABASE_CONNECTION);
    DatabaseService databaseService =
        databaseServiceResourceTest.createEntity(createBigQueryService, ADMIN_AUTH_HEADERS);
    EntityReference bigqueryRef = new DatabaseServiceEntityInterface(databaseService).getEntityReference();

    CreateIngestionPipeline requestPipeline_1 =
        createRequest(test)
            .withName("ingestion_1")
            .withPipelineType(PipelineType.METADATA)
            .withService(bigqueryRef)
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"));
    IngestionPipeline pipelineBigquery1 = createAndCheckEntity(requestPipeline_1, ADMIN_AUTH_HEADERS);
    CreateIngestionPipeline requestPipeline_2 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(bigqueryRef)
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"));
    IngestionPipeline pipelineBigquery2 = createAndCheckEntity(requestPipeline_2, ADMIN_AUTH_HEADERS);
    CreateIngestionPipeline requestPipeline_3 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(snowflakeRef)
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate("2021-11-21"));
    IngestionPipeline IngestionPipeline3 = createAndCheckEntity(requestPipeline_3, ADMIN_AUTH_HEADERS);
    // List charts by filtering on service name and ensure right charts in the response
    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("service", bigqueryRef.getName());
          }
        };
    Predicate<IngestionPipeline> isPipelineBigquery1 = p -> p.getId().equals(pipelineBigquery1.getId());
    Predicate<IngestionPipeline> isPipelineBigquery2 = u -> u.getId().equals(pipelineBigquery2.getId());
    Predicate<IngestionPipeline> isPipelineBigquery3 = u -> u.getId().equals(IngestionPipeline3.getId());
    List<IngestionPipeline> actualBigqueryPipelines = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(2, actualBigqueryPipelines.size());
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery1));
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery2));
    queryParams =
        new HashMap<>() {
          {
            put("service", snowflakeRef.getName());
          }
        };
    List<IngestionPipeline> actualSnowflakePipelines = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(1, actualSnowflakePipelines.size());
    assertTrue(actualSnowflakePipelines.stream().anyMatch(isPipelineBigquery3));
  }

  @Test
  void put_IngestionPipelineUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test).withService(BIGQUERY_REFERENCE).withDescription(null).withOwner(null);
    IngestionPipeline ingestion = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

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

  private IngestionPipeline updateIngestionPipeline(
      CreateIngestionPipeline create, Status status, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getCollection(), create, IngestionPipeline.class, status, authHeaders);
  }

  @Override
  public EntityInterface<IngestionPipeline> validateGetWithDifferentFields(IngestionPipeline ingestion, boolean byName)
      throws HttpResponseException {
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
    // Checks for other owner, tags, and followers is done in the base class
    return getEntityInterface(ingestion);
  }

  private void validateSourceConfig(SourceConfig orig, SourceConfig updated, IngestionPipeline ingestionPipeline) {
    String serviceType = ingestionPipeline.getService().getType();
    if (serviceType.equals(Entity.DATABASE_SERVICE)
        && ingestionPipeline.getPipelineType().equals(PipelineType.METADATA)) {
      DatabaseServiceMetadataPipeline origConfig = (DatabaseServiceMetadataPipeline) orig.getConfig();
      DatabaseServiceMetadataPipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DatabaseServiceMetadataPipeline.class);
      assertEquals(origConfig, updatedConfig);
    } else if (serviceType.equals(Entity.DATABASE_SERVICE)
        && ingestionPipeline.getPipelineType().equals(PipelineType.USAGE)) {
      DatabaseServiceQueryUsagePipeline origConfig = (DatabaseServiceQueryUsagePipeline) orig.getConfig();
      DatabaseServiceQueryUsagePipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DatabaseServiceQueryUsagePipeline.class);
      assertEquals(origConfig, updatedConfig);
    } else if (serviceType.equals(Entity.DASHBOARD_SERVICE)) {
      DashboardServiceMetadataPipeline origConfig = (DashboardServiceMetadataPipeline) orig.getConfig();
      DashboardServiceMetadataPipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DashboardServiceMetadataPipeline.class);
      assertEquals(origConfig, updatedConfig);
    } else if (serviceType.equals(Entity.MESSAGING_SERVICE)) {
      MessagingServiceMetadataPipeline origConfig = (MessagingServiceMetadataPipeline) orig.getConfig();
      MessagingServiceMetadataPipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), MessagingServiceMetadataPipeline.class);
      assertEquals(origConfig, updatedConfig);
    }
  }
}
