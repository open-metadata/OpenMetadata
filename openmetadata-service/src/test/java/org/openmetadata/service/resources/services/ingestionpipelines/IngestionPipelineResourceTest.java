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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.MessagingServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.ConnectionArguments;
import org.openmetadata.schema.services.connections.database.ConnectionOptions;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class IngestionPipelineResourceTest extends EntityResourceTest<IngestionPipeline, CreateIngestionPipeline> {
  public static SourceConfig DATABASE_METADATA_CONFIG;
  public static SourceConfig DASHBOARD_METADATA_CONFIG;
  public static SourceConfig MESSAGING_METADATA_CONFIG;
  public static DatabaseServiceResourceTest DATABASE_SERVICE_RESOURCE_TEST;
  public static Date START_DATE;

  private static final String COLLECTION = "services/ingestionPipelines";

  public IngestionPipelineResourceTest() {
    super(
        Entity.INGESTION_PIPELINE,
        IngestionPipeline.class,
        IngestionPipelineResource.IngestionPipelineList.class,
        COLLECTION,
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
    DATABASE_SERVICE_RESOURCE_TEST = new DatabaseServiceResourceTest();
    START_DATE = new DateTime("2022-06-10T15:06:47+00:00").toDate();
  }

  @Override
  public CreateIngestionPipeline createRequest(String name) {
    return new CreateIngestionPipeline()
        .withName(name)
        .withPipelineType(PipelineType.METADATA)
        .withService(getContainer())
        .withSourceConfig(DATABASE_METADATA_CONFIG)
        .withAirflowConfig(new AirflowConfig().withStartDate(new DateTime("2022-06-10T15:06:47+00:00").toDate()));
  }

  @Override
  public EntityReference getContainer() {
    return BIGQUERY_REFERENCE;
  }

  @Override
  public EntityReference getContainer(IngestionPipeline entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      IngestionPipeline ingestion, CreateIngestionPipeline createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getAirflowConfig().getConcurrency(), ingestion.getAirflowConfig().getConcurrency());
    validateSourceConfig(createRequest.getSourceConfig(), ingestion.getSourceConfig(), ingestion);
    assertNotNull(ingestion.getOpenMetadataServerConnection());
  }

  @Override
  public void compareEntities(IngestionPipeline expected, IngestionPipeline updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertReference(expected.getService(), updated.getService());
    assertEquals(expected.getSourceConfig(), updated.getSourceConfig());
  }

  @Override
  protected void compareChangeEventsEntities(
      IngestionPipeline expected, IngestionPipeline updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertReference(expected.getService(), updated.getService());
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
    assertNotNull(create);
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
            .withService(BIGQUERY_REFERENCE)
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE).withScheduleInterval("5 * * * *"));
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(DATABASE_METADATA_CONFIG, ingestion.getSourceConfig(), ingestion);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    assertEquals(LogLevels.INFO, ingestion.getLoggerLevel());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
  }

  @Test
  void post_AirflowWithDatabaseServiceQueryUsage_200_ok(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(queryUsageConfig, ingestion.getSourceConfig(), ingestion);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
  }

  @Test
  void put_IngestionPipelineUrlUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update the pipeline. Updating description is ignored when backend already has description
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
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
                .withLoggerLevel(LogLevels.ERROR)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());

    assertEquals(LogLevels.ERROR, updatedIngestion.getLoggerLevel());

    validateSourceConfig(updatedSourceConfig, updatedIngestion.getSourceConfig(), ingestion);
  }

  @Test
  void put_IngestionPipelineForDashboardSourceUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withService(METABASE_REFERENCE)
            .withDescription("description")
            .withSourceConfig(DASHBOARD_METADATA_CONFIG)
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.build(METABASE_REFERENCE.getName(), ingestion.getName());
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    validateSourceConfig(updatedSourceConfig, updatedIngestion.getSourceConfig(), ingestion);
  }

  @Test
  void put_IngestionPipelineForMessagingSourceUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withService(KAFKA_REFERENCE)
            .withDescription("description")
            .withSourceConfig(MESSAGING_METADATA_CONFIG)
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.build(KAFKA_REFERENCE.getName(), ingestion.getName());
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    validateSourceConfig(updatedSourceConfig, updatedIngestion.getSourceConfig(), ingestion);
  }

  @Test
  void post_AirflowWithDatabaseServiceMetadata_GeneratedIngestionPipelineConfig_200_ok(TestInfo test)
      throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE))
            .withOwner(USER1_REF);
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
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);

    String expectedFQN = FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(DATABASE_METADATA_CONFIG, ingestion.getSourceConfig(), ingestionPipeline);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());

    ingestion = getEntity(ingestion.getId(), FIELD_OWNER, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());

    // Update and connector orgs and options to database connection
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService databaseService =
        databaseServiceResourceTest.getEntity(ingestionPipeline.getService().getId(), "connection", ADMIN_AUTH_HEADERS);

    DatabaseConnection databaseConnection = databaseService.getConnection();
    Map<String, String> advConfig = new HashMap<>();
    advConfig.put("hive.execution.engine", "tez");
    advConfig.put("tez.queue.name", "tez");
    ConnectionArguments connectionArguments =
        new ConnectionArguments()
            .withAdditionalProperty("credentials", "/tmp/creds.json")
            .withAdditionalProperty("client_email", "ingestion-bot@domain.com")
            .withAdditionalProperty("configuration", advConfig);
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

    CreateDatabaseService createBigQueryService =
        new CreateDatabaseService()
            .withName("bigquery_test_list")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.BigQuery)
            .withConnection(TestUtils.BIGQUERY_DATABASE_CONNECTION);
    DatabaseService bigqueryDatabaseService =
        databaseServiceResourceTest.createEntity(createBigQueryService, ADMIN_AUTH_HEADERS);

    CreateIngestionPipeline requestPipeline_1 =
        createRequest(test)
            .withName("ingestion_1")
            .withPipelineType(PipelineType.METADATA)
            .withService(bigqueryDatabaseService.getEntityReference())
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline pipelineBigquery1 = createAndCheckEntity(requestPipeline_1, ADMIN_AUTH_HEADERS);
    CreateIngestionPipeline requestPipeline_2 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(bigqueryDatabaseService.getEntityReference())
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline pipelineBigquery2 = createAndCheckEntity(requestPipeline_2, ADMIN_AUTH_HEADERS);
    CreateIngestionPipeline requestPipeline_3 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(snowflakeDatabaseService.getEntityReference())
            .withDescription("description")
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline IngestionPipeline3 = createAndCheckEntity(requestPipeline_3, ADMIN_AUTH_HEADERS);
    // List charts by filtering on service name and ensure right charts in the response
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", bigqueryDatabaseService.getName());

    Predicate<IngestionPipeline> isPipelineBigquery1 = p -> p.getId().equals(pipelineBigquery1.getId());
    Predicate<IngestionPipeline> isPipelineBigquery2 = u -> u.getId().equals(pipelineBigquery2.getId());
    Predicate<IngestionPipeline> isPipelineBigquery3 = u -> u.getId().equals(IngestionPipeline3.getId());
    List<IngestionPipeline> actualBigqueryPipelines = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(2, actualBigqueryPipelines.size());
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery1));
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery2));
    queryParams = new HashMap<>();
    queryParams.put("service", snowflakeDatabaseService.getName());

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
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, FIELD_OWNER, USER1_REF);
    updateAndCheckEntity(
        request.withDescription("newDescription").withOwner(USER1_REF), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertNotNull(change);
  }

  @Test
  void post_dbtPipeline_configIsEncrypted(TestInfo test) throws IOException {
    AWSCredentials awsCredentials =
        new AWSCredentials()
            .withAwsAccessKeyId("123456789")
            .withAwsSecretAccessKey("asdfqwer1234")
            .withAwsRegion("eu-west-2");
    DbtPipeline dbtPipeline =
        new DbtPipeline().withDbtConfigSource(new DbtS3Config().withDbtSecurityConfig(awsCredentials));
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.DBT)
            .withSourceConfig(new SourceConfig().withConfig(dbtPipeline))
            .withService(BIGQUERY_REFERENCE)
            .withDescription(null)
            .withOwner(null);
    IngestionPipeline ingestion = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    DbtPipeline actualDbtPipeline = JsonUtils.convertValue(ingestion.getSourceConfig().getConfig(), DbtPipeline.class);
    DbtS3Config actualDbtS3Config = JsonUtils.convertValue(actualDbtPipeline.getDbtConfigSource(), DbtS3Config.class);
    assertEquals(actualDbtS3Config.getDbtSecurityConfig().getAwsAccessKeyId(), awsCredentials.getAwsAccessKeyId());
    assertEquals(actualDbtS3Config.getDbtSecurityConfig().getAwsRegion(), awsCredentials.getAwsRegion());
    assertEquals(
        "secret:/openmetadata/pipeline/"
            + request.getName().toLowerCase(Locale.ROOT)
            + "/sourceconfig/config/dbtconfigsource/dbtsecurityconfig/awssecretaccesskey",
        actualDbtS3Config.getDbtSecurityConfig().getAwsSecretAccessKey());
  }

  @Test
  void put_pipelineStatus(TestInfo test) throws IOException {
    CreateIngestionPipeline requestPipeline =
        createRequest(test)
            .withName("ingestion_testStatus")
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withAirflowConfig(new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline ingestionPipeline = createAndCheckEntity(requestPipeline, ADMIN_AUTH_HEADERS);

    String runId = UUID.randomUUID().toString();

    // Create the first status
    TestUtils.put(
        getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
        new PipelineStatus().withPipelineState(PipelineStatusType.RUNNING).withRunId(runId).withTimestamp(3L),
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    PipelineStatus pipelineStatus =
        TestUtils.get(
            getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(pipelineStatus.getPipelineState(), PipelineStatusType.RUNNING);

    // Update it
    TestUtils.put(
        getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
        new PipelineStatus().withPipelineState(PipelineStatusType.SUCCESS).withRunId(runId).withTimestamp(3L),
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    pipelineStatus =
        TestUtils.get(
            getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(pipelineStatus.getPipelineState(), PipelineStatusType.SUCCESS);

    // DELETE all status from the pipeline
    TestUtils.delete(getDeletePipelineStatus(ingestionPipeline.getId().toString()), ADMIN_AUTH_HEADERS);
    // We get no content back
    Response response =
        SecurityUtil.addHeaders(
                getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId), ADMIN_AUTH_HEADERS)
            .get();
    TestUtils.readResponse(response, PipelineStatus.class, Status.NO_CONTENT.getStatusCode());
  }

  private IngestionPipeline updateIngestionPipeline(CreateIngestionPipeline create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.put(getCollection(), create, IngestionPipeline.class, Status.OK, authHeaders);
  }

  protected final WebTarget getPipelineStatusTarget(String fqn) {
    return getCollection().path("/" + fqn + "/pipelineStatus");
  }

  protected final WebTarget getPipelineStatusByRunId(String fqn, String runId) {
    return getCollection().path("/" + fqn + "/pipelineStatus/" + runId);
  }

  protected final WebTarget getDeletePipelineStatus(String id) {
    return getCollection().path("/" + id + "/pipelineStatus");
  }

  @Override
  public IngestionPipeline validateGetWithDifferentFields(IngestionPipeline ingestion, boolean byName)
      throws HttpResponseException {
    String fields = "";
    ingestion =
        byName
            ? getEntityByName(ingestion.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(ingestion.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(ingestion.getService());
    assertListNull(ingestion.getOwner());

    fields = FIELD_OWNER;
    ingestion =
        byName
            ? getEntityByName(ingestion.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(ingestion.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return ingestion;
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
