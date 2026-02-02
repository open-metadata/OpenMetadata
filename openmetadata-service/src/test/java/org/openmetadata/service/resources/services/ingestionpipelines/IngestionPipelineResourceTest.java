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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.external.AutomatorAppConfig;
import org.openmetadata.schema.entity.app.external.Resource;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.services.ingestionPipelines.Progress;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressProperty;
import org.openmetadata.schema.entity.services.ingestionPipelines.StepSummary;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
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
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class IngestionPipelineResourceTest
    extends EntityResourceTest<IngestionPipeline, CreateIngestionPipeline> {
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
            .withSchemaFilterPattern(
                new FilterPattern().withExcludes(List.of("information_schema.*", "test.*")))
            .withTableFilterPattern(
                new FilterPattern().withIncludes(List.of("sales.*", "users.*")));
    DashboardServiceMetadataPipeline dashboardServiceMetadataPipeline =
        new DashboardServiceMetadataPipeline()
            .withDashboardFilterPattern(
                new FilterPattern().withIncludes(List.of("dashboard.*", "users.*")));
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
        .withAirflowConfig(
            new AirflowConfig().withStartDate(new DateTime("2022-06-10T15:06:47+00:00").toDate()));
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
      IngestionPipeline ingestion,
      CreateIngestionPipeline createRequest,
      Map<String, String> authHeaders) {
    assertEquals(
        createRequest.getAirflowConfig().getConcurrency(),
        ingestion.getAirflowConfig().getConcurrency());
    validateSourceConfig(createRequest.getSourceConfig(), ingestion.getSourceConfig(), ingestion);
    // SECURITY: OpenMetadataServerConnection should NOT be returned in GET/LIST API responses
    // to prevent JWT token exposure. It's only populated during deploy operations.
    assertNull(ingestion.getOpenMetadataServerConnection());
  }

  @Override
  public void compareEntities(
      IngestionPipeline expected, IngestionPipeline updated, Map<String, String> authHeaders) {
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void get_listPipelinesFiltered(TestInfo test) throws IOException {

    CreateIngestionPipeline createMessaging =
        new CreateIngestionPipeline()
            .withName(getEntityName(test))
            .withPipelineType(PipelineType.METADATA)
            .withSourceConfig(MESSAGING_METADATA_CONFIG)
            .withService(REDPANDA_REFERENCE)
            .withAirflowConfig(
                new AirflowConfig().withStartDate(START_DATE).withScheduleInterval("5 * * * *"));
    createAndCheckEntity(createMessaging, ADMIN_AUTH_HEADERS);

    CreateIngestionPipeline createDatabase = createRequest(test);
    createAndCheckEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // If we filter by service type, we get just one
    Map<String, String> paramsMessaging = new HashMap<>();
    paramsMessaging.put("serviceType", "messagingService");
    ResultList<IngestionPipeline> resList = listEntities(paramsMessaging, ADMIN_AUTH_HEADERS);
    assertEquals(1, resList.getData().size());

    Map<String, String> paramsType = new HashMap<>();
    paramsType.put("pipelineType", "metadata");
    ResultList<IngestionPipeline> resListMeta = listEntities(paramsType, ADMIN_AUTH_HEADERS);
    // We get at least the 2 pipelines created here
    assertTrue(resListMeta.getData().size() >= 2);

    Map<String, String> paramsMessagingService = new HashMap<>();
    paramsMessagingService.put("service", REDPANDA_REFERENCE.getFullyQualifiedName());
    ResultList<IngestionPipeline> redpandaIngestionList =
        listEntities(paramsMessagingService, ADMIN_AUTH_HEADERS);
    assertEquals(1, redpandaIngestionList.getData().size());
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
    createAndCheckEntity(
        createRequest(test).withSourceConfig(DATABASE_METADATA_CONFIG), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_IngestionPipelineWithoutRequiredService_4xx(TestInfo test) {
    CreateIngestionPipeline create = createRequest(test).withService(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_AirflowWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {REDSHIFT_REFERENCE, BIGQUERY_REFERENCE};

    // Create Ingestion for each service and test APIs
    for (EntityReference service : differentServices) {
      IngestionPipeline ingestion =
          createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);
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
            .withAirflowConfig(
                new AirflowConfig().withStartDate(START_DATE).withScheduleInterval("5 * * * *"));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    IngestionPipeline ingestion =
        updateIngestionPipeline(
            request
                .withSourceConfig(DATABASE_METADATA_CONFIG)
                .withLoggerLevel(LogLevels.INFO)
                .withAirflowConfig(
                    new AirflowConfig()
                        .withConcurrency(pipelineConcurrency)
                        .withScheduleInterval(expectedScheduleInterval)
                        .withStartDate(startDate)),
            ADMIN_AUTH_HEADERS);
    String expectedFQN =
        FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(DATABASE_METADATA_CONFIG, ingestion.getSourceConfig(), ingestion);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    assertEquals(LogLevels.INFO, ingestion.getLoggerLevel());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNERS, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
  }

  @Test
  void post_AirflowWithDatabaseServiceQueryUsage_200_ok(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("description")
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    DatabaseServiceQueryUsagePipeline queryUsagePipeline =
        new DatabaseServiceQueryUsagePipeline()
            .withQueryLogDuration(1)
            .withStageFileLocation("/tmp/test.log");
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
    String expectedFQN =
        FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(queryUsageConfig, ingestion.getSourceConfig(), ingestion);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNERS, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
  }

  @Test
  void put_IngestionPipelineUrlUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("description")
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
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
    String expectedFQN =
        FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNERS, ADMIN_AUTH_HEADERS);
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
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
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
    String expectedFQN =
        FullyQualifiedName.build(METABASE_REFERENCE.getName(), ingestion.getName());
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), FIELD_OWNERS, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    DashboardServiceMetadataPipeline dashboardServiceMetadataPipeline =
        new DashboardServiceMetadataPipeline()
            .withDashboardFilterPattern(
                new FilterPattern().withIncludes(List.of("test1.*", "test2.*")));

    SourceConfig updatedSourceConfig =
        new SourceConfig().withConfig(dashboardServiceMetadataPipeline);
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
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
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
    ingestion = getEntity(ingestion.getId(), FIELD_OWNERS, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());
    MessagingServiceMetadataPipeline messagingServiceMetadataPipeline =
        new MessagingServiceMetadataPipeline()
            .withTopicFilterPattern(
                new FilterPattern().withIncludes(List.of("topic1.*", "topic2.*")));
    SourceConfig updatedSourceConfig =
        new SourceConfig().withConfig(messagingServiceMetadataPipeline);
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
  void post_AirflowWithDatabaseServiceMetadata_GeneratedIngestionPipelineConfig_200_ok(
      TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("description")
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE))
            .withOwners(List.of(USER1_REF));
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

    String expectedFQN =
        FullyQualifiedName.add(BIGQUERY_REFERENCE.getFullyQualifiedName(), ingestion.getName());
    validateSourceConfig(DATABASE_METADATA_CONFIG, ingestion.getSourceConfig(), ingestionPipeline);
    assertEquals(startDate, ingestion.getAirflowConfig().getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getAirflowConfig().getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());

    ingestion = getEntity(ingestion.getId(), FIELD_OWNERS, ADMIN_AUTH_HEADERS);
    assertEquals(expectedScheduleInterval, ingestion.getAirflowConfig().getScheduleInterval());

    // Update and connector orgs and options to database connection
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService databaseService =
        databaseServiceResourceTest.getEntity(
            ingestionPipeline.getService().getId(), "connection", ADMIN_AUTH_HEADERS);

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
        new ConnectionOptions()
            .withAdditionalProperty("key1", "value1")
            .withAdditionalProperty("key2", "value2");
    BigQueryConnection bigQueryConnection =
        JsonUtils.convertValue(
            databaseService.getConnection().getConfig(), BigQueryConnection.class);
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
    BigQueryConnection expectedBigQueryConnection =
        (BigQueryConnection) databaseService.getConnection().getConfig();
    BigQueryConnection actualBigQueryConnection =
        JsonUtils.convertValue(
            updatedService.getConnection().getConfig(), BigQueryConnection.class);
    DatabaseServiceResourceTest.validateBigQueryConnection(
        expectedBigQueryConnection, actualBigQueryConnection, true);
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
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline pipelineBigquery1 =
        createAndCheckEntity(requestPipeline_1, ADMIN_AUTH_HEADERS);
    CreateIngestionPipeline requestPipeline_2 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(bigqueryDatabaseService.getEntityReference())
            .withDescription("description")
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline pipelineBigquery2 =
        createAndCheckEntity(requestPipeline_2, ADMIN_AUTH_HEADERS);
    CreateIngestionPipeline requestPipeline_3 =
        createRequest(test)
            .withName("ingestion_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(snowflakeDatabaseService.getEntityReference())
            .withDescription("description")
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline IngestionPipeline3 =
        createAndCheckEntity(requestPipeline_3, ADMIN_AUTH_HEADERS);
    // List charts by filtering on service name and ensure right charts in the response
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", bigqueryDatabaseService.getName());

    Predicate<IngestionPipeline> isPipelineBigquery1 =
        p -> p.getId().equals(pipelineBigquery1.getId());
    Predicate<IngestionPipeline> isPipelineBigquery2 =
        u -> u.getId().equals(pipelineBigquery2.getId());
    Predicate<IngestionPipeline> isPipelineBigquery3 =
        u -> u.getId().equals(IngestionPipeline3.getId());
    List<IngestionPipeline> actualBigqueryPipelines =
        listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(2, actualBigqueryPipelines.size());
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery1));
    assertTrue(actualBigqueryPipelines.stream().anyMatch(isPipelineBigquery2));
    queryParams = new HashMap<>();
    queryParams.put("service", snowflakeDatabaseService.getName());

    List<IngestionPipeline> actualSnowflakePipelines =
        listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(1, actualSnowflakePipelines.size());
    assertTrue(actualSnowflakePipelines.stream().anyMatch(isPipelineBigquery3));
  }

  @Test
  void put_IngestionPipelineUpdate_200(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test).withService(BIGQUERY_REFERENCE).withDescription(null).withOwners(null);
    IngestionPipeline ingestion = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description and tasks
    ChangeDescription change = getChangeDescription(ingestion, MINOR_UPDATE);
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, FIELD_OWNERS, List.of(USER1_REF));
    updateAndCheckEntity(
        request.withDescription("newDescription").withOwners(List.of(USER1_REF)),
        OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
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
        new DbtPipeline()
            .withDbtConfigSource(new DbtS3Config().withDbtSecurityConfig(awsCredentials));
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.DBT)
            .withSourceConfig(new SourceConfig().withConfig(dbtPipeline))
            .withService(BIGQUERY_REFERENCE)
            .withDescription(null)
            .withOwners(null);
    IngestionPipeline ingestion = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    DbtPipeline actualDbtPipeline =
        JsonUtils.convertValue(ingestion.getSourceConfig().getConfig(), DbtPipeline.class);
    DbtS3Config actualDbtS3Config =
        JsonUtils.convertValue(actualDbtPipeline.getDbtConfigSource(), DbtS3Config.class);
    assertEquals(
        actualDbtS3Config.getDbtSecurityConfig().getAwsAccessKeyId(),
        awsCredentials.getAwsAccessKeyId());
    assertEquals(
        actualDbtS3Config.getDbtSecurityConfig().getAwsRegion(), awsCredentials.getAwsRegion());
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK,
        actualDbtS3Config.getDbtSecurityConfig().getAwsSecretAccessKey());

    ingestion = getEntity(ingestion.getId(), INGESTION_BOT_AUTH_HEADERS);

    actualDbtPipeline =
        JsonUtils.convertValue(ingestion.getSourceConfig().getConfig(), DbtPipeline.class);
    actualDbtS3Config =
        JsonUtils.convertValue(actualDbtPipeline.getDbtConfigSource(), DbtS3Config.class);
    assertEquals(
        actualDbtS3Config.getDbtSecurityConfig().getAwsAccessKeyId(),
        awsCredentials.getAwsAccessKeyId());
    assertEquals(
        actualDbtS3Config.getDbtSecurityConfig().getAwsRegion(), awsCredentials.getAwsRegion());
    assertEquals(
        awsCredentials.getAwsSecretAccessKey(),
        actualDbtS3Config.getDbtSecurityConfig().getAwsSecretAccessKey());
  }

  @Test
  void put_pipelineStatus(TestInfo test) throws IOException {
    CreateIngestionPipeline requestPipeline =
        createRequest(test)
            .withName("ingestion_testStatus")
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline ingestionPipeline = createAndCheckEntity(requestPipeline, ADMIN_AUTH_HEADERS);

    String runId = UUID.randomUUID().toString();

    // Create the first status
    TestUtils.put(
        getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.RUNNING)
            .withRunId(runId)
            .withTimestamp(3L),
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    PipelineStatus pipelineStatus =
        TestUtils.get(
            getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(PipelineStatusType.RUNNING, pipelineStatus.getPipelineState());

    // Update it
    TestUtils.put(
        getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.SUCCESS)
            .withRunId(runId)
            .withTimestamp(3L),
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    pipelineStatus =
        TestUtils.get(
            getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(PipelineStatusType.SUCCESS, pipelineStatus.getPipelineState());

    // DELETE all status from the pipeline
    TestUtils.delete(
        getDeletePipelineStatus(ingestionPipeline.getId().toString()), ADMIN_AUTH_HEADERS);
    // We get no content back
    Response response =
        SecurityUtil.addHeaders(
                getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId),
                ADMIN_AUTH_HEADERS)
            .get();
    TestUtils.readResponse(response, PipelineStatus.class, Status.NO_CONTENT.getStatusCode());
  }

  @Test
  void put_pipelineStatus_403(TestInfo test) throws IOException {
    CreateIngestionPipeline requestPipeline = createRequest(getEntityName(test));
    IngestionPipeline ingestionPipeline = createAndCheckEntity(requestPipeline, ADMIN_AUTH_HEADERS);

    String runId = UUID.randomUUID().toString();

    // Create a status without having the EDIT_INGESTION_PIPELINE_STATUS permission
    assertResponse(
        () ->
            TestUtils.put(
                getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
                new PipelineStatus()
                    .withPipelineState(PipelineStatusType.RUNNING)
                    .withRunId(runId)
                    .withTimestamp(3L),
                Response.Status.CREATED,
                authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(
            USER2.getName(), List.of(MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS)));
  }

  @Test
  void delete_pipelineStatusByRunId_success_204(TestInfo test) throws IOException {
    CreateIngestionPipeline requestPipeline =
        createRequest(test)
            .withName("ingestion_testDeleteByRunId")
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline ingestionPipeline = createAndCheckEntity(requestPipeline, ADMIN_AUTH_HEADERS);

    String runId1 = UUID.randomUUID().toString();
    String runId2 = UUID.randomUUID().toString();

    // Create first pipeline status
    TestUtils.put(
        getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.RUNNING)
            .withRunId(runId1)
            .withTimestamp(3L),
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    // Create second pipeline status
    TestUtils.put(
        getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.SUCCESS)
            .withRunId(runId2)
            .withTimestamp(4L),
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    // Verify both statuses exist
    PipelineStatus status1 =
        TestUtils.get(
            getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId1),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(PipelineStatusType.RUNNING, status1.getPipelineState());

    PipelineStatus status2 =
        TestUtils.get(
            getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId2),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(PipelineStatusType.SUCCESS, status2.getPipelineState());

    // Delete first status by runId (should return 204 No Content)
    Response deleteResponse =
        SecurityUtil.addHeaders(
                getDeletePipelineStatusByRunId(ingestionPipeline.getId().toString(), runId1),
                ADMIN_AUTH_HEADERS)
            .delete();
    assertEquals(Status.NO_CONTENT.getStatusCode(), deleteResponse.getStatus());

    // Verify first status is deleted (should return 204 No Content)
    Response response1 =
        SecurityUtil.addHeaders(
                getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId1),
                ADMIN_AUTH_HEADERS)
            .get();
    TestUtils.readResponse(response1, PipelineStatus.class, Status.NO_CONTENT.getStatusCode());

    // Verify second status still exists
    status2 =
        TestUtils.get(
            getPipelineStatusByRunId(ingestionPipeline.getFullyQualifiedName(), runId2),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);
    assertEquals(PipelineStatusType.SUCCESS, status2.getPipelineState());
  }

  @Test
  void delete_pipelineStatusByRunId_nonExistentPipeline_404(TestInfo test) throws IOException {
    UUID nonExistentPipelineId = UUID.randomUUID();
    UUID runId = UUID.randomUUID();

    // Try to delete status from non-existent pipeline
    assertResponse(
        () ->
            TestUtils.delete(
                getDeletePipelineStatusByRunId(nonExistentPipelineId.toString(), runId.toString()),
                ADMIN_AUTH_HEADERS),
        Response.Status.NOT_FOUND,
        String.format("ingestionPipeline instance for %s not found", nonExistentPipelineId));
  }

  @Test
  void delete_pipelineStatusByRunId_nonExistentRunId_204(TestInfo test) throws IOException {
    CreateIngestionPipeline requestPipeline =
        createRequest(test)
            .withName("ingestion_testDeleteNonExistentRunId")
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withAirflowConfig(
                new AirflowConfig().withScheduleInterval("5 * * * *").withStartDate(START_DATE));
    IngestionPipeline ingestionPipeline = createAndCheckEntity(requestPipeline, ADMIN_AUTH_HEADERS);

    UUID nonExistentRunId = UUID.randomUUID();

    // Delete non-existent runId (should succeed with 204 as no records to delete)
    Response deleteResponse =
        SecurityUtil.addHeaders(
                getDeletePipelineStatusByRunId(
                    ingestionPipeline.getId().toString(), nonExistentRunId.toString()),
                ADMIN_AUTH_HEADERS)
            .delete();
    assertEquals(Status.NO_CONTENT.getStatusCode(), deleteResponse.getStatus());
  }

  @Test
  void delete_pipelineStatusByRunId_unauthorized_403(TestInfo test) throws IOException {
    CreateIngestionPipeline requestPipeline = createRequest(getEntityName(test));
    IngestionPipeline ingestionPipeline = createAndCheckEntity(requestPipeline, ADMIN_AUTH_HEADERS);

    String runId = UUID.randomUUID().toString();

    // Create pipeline status
    TestUtils.put(
        getPipelineStatusTarget(ingestionPipeline.getFullyQualifiedName()),
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.RUNNING)
            .withRunId(runId)
            .withTimestamp(3L),
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    // Try to delete with unauthorized user
    assertResponse(
        () ->
            TestUtils.delete(
                getDeletePipelineStatusByRunId(ingestionPipeline.getId().toString(), runId),
                authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), List.of(MetadataOperation.DELETE)));
  }

  @Test
  void post_ingestionPipeline_403(TestInfo test) throws HttpResponseException {
    CreateIngestionPipeline create = createRequest(getEntityName(test));
    create
        .withPipelineType(PipelineType.APPLICATION)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new ApplicationPipeline()
                        .withAppConfig(
                            new AutomatorAppConfig()
                                .withResources(new Resource().withQueryFilter(""))
                                .withActions(List.of()))));

    // Create ingestion pipeline without having the CREATE_INGESTION_PIPELINE_AUTOMATOR permission
    assertResponse(
        () -> createEntity(create, authHeaders(USER1.getName())),
        FORBIDDEN,
        permissionNotAllowed(
            USER1.getName(), List.of(MetadataOperation.CREATE_INGESTION_PIPELINE_AUTOMATOR)));

    // Admin has permissions and can create it
    createEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a dashboard service with owner data consumer
    DashboardServiceResourceTest serviceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    DashboardService service = serviceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can an ingestion pipeline for the service
    createEntity(
        createRequest("ingestion").withService(service.getEntityReference()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void testListByProvider(TestInfo test) throws IOException {
    // Create a pipeline with a provider
    CreateIngestionPipeline create = createRequest(test).withProvider(ProviderType.AUTOMATION);
    IngestionPipeline ingestionPipeline = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    CreateIngestionPipeline createNoProvider = createRequest(test, 1);
    createAndCheckEntity(createNoProvider, ADMIN_AUTH_HEADERS);

    // List pipelines by provider
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("provider", ProviderType.AUTOMATION.value());
    ResultList<IngestionPipeline> resultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, resultList.getData().size());
    assertEquals(ingestionPipeline.getId(), resultList.getData().get(0).getId());

    Map<String, String> multipleQueryParams = new HashMap<>();
    multipleQueryParams.put("provider", ProviderType.AUTOMATION.value());
    multipleQueryParams.put("serviceType", "databaseService");
    multipleQueryParams.put("pipelineType", "metadata");
    ResultList<IngestionPipeline> multipleParamsResult =
        listEntities(multipleQueryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, multipleParamsResult.getData().size());
    assertEquals(ingestionPipeline.getId(), multipleParamsResult.getData().get(0).getId());
  }

  @Test
  void get_ingestionPipeline_doesNotExposeJwtToken_security(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("Security test pipeline");
    IngestionPipeline created = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // GET by ID should NOT return openMetadataServerConnection (contains JWT)
    IngestionPipeline fetched = getEntity(created.getId(), ADMIN_AUTH_HEADERS);
    assertNull(
        fetched.getOpenMetadataServerConnection(),
        "SECURITY: GET by ID must NOT return openMetadataServerConnection to prevent JWT token exposure");

    // GET by name should NOT return openMetadataServerConnection
    IngestionPipeline fetchedByName =
        getEntityByName(created.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS);
    assertNull(
        fetchedByName.getOpenMetadataServerConnection(),
        "SECURITY: GET by name must NOT return openMetadataServerConnection to prevent JWT token exposure");
  }

  @Test
  void get_ingestionPipeline_doesNotExposeJwtToken_regularUser_security(TestInfo test)
      throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("Security test pipeline for regular user")
            .withOwners(List.of(USER1_REF));
    IngestionPipeline created = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Regular user (owner) should also NOT see JWT token
    IngestionPipeline fetched = getEntity(created.getId(), authHeaders(USER1.getName()));
    assertNull(
        fetched.getOpenMetadataServerConnection(),
        "SECURITY: Regular users must NOT see openMetadataServerConnection");
  }

  @Test
  void list_ingestionPipelines_doesNotExposeJwtToken_security(TestInfo test) throws IOException {
    CreateIngestionPipeline request1 =
        createRequest(test)
            .withName("security_test_list_1")
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE);
    createAndCheckEntity(request1, ADMIN_AUTH_HEADERS);

    CreateIngestionPipeline request2 =
        createRequest(test)
            .withName("security_test_list_2")
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE);
    createAndCheckEntity(request2, ADMIN_AUTH_HEADERS);

    // LIST should NOT return openMetadataServerConnection for ANY pipeline
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", BIGQUERY_REFERENCE.getFullyQualifiedName());
    ResultList<IngestionPipeline> pipelines = listEntities(queryParams, ADMIN_AUTH_HEADERS);

    for (IngestionPipeline pipeline : pipelines.getData()) {
      assertNull(
          pipeline.getOpenMetadataServerConnection(),
          String.format(
              "SECURITY: LIST must NOT return openMetadataServerConnection for pipeline [%s]",
              pipeline.getName()));
    }
  }

  @Test
  void get_ingestionPipelineVersions_doesNotExposeJwtToken_security(TestInfo test)
      throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("Security test for versions");
    IngestionPipeline created = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update to create a new version
    request.withDescription("Updated description for version test");
    updateIngestionPipeline(request, ADMIN_AUTH_HEADERS);

    // GET version should NOT return openMetadataServerConnection
    IngestionPipeline version =
        getVersion(created.getId(), created.getVersion(), ADMIN_AUTH_HEADERS);
    assertNull(
        version.getOpenMetadataServerConnection(),
        "SECURITY: GET version must NOT return openMetadataServerConnection");
  }

  @Test
  void bot_canAccessPipeline_butApiDoesNotExposeJwt_security(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("Security test for bot access");
    IngestionPipeline created = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Even ingestion bot should NOT see JWT token via GET API
    // The JWT is only needed internally during deploy operations
    IngestionPipeline fetchedByBot = getEntity(created.getId(), INGESTION_BOT_AUTH_HEADERS);
    assertNull(
        fetchedByBot.getOpenMetadataServerConnection(),
        "SECURITY: Even bot users must NOT see openMetadataServerConnection via GET API. "
            + "JWT should only be passed to pipeline service during deploy.");
  }

  @Test
  void put_ingestionPipeline_doesNotExposeJwtToken_security(TestInfo test) throws IOException {
    CreateIngestionPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(BIGQUERY_REFERENCE)
            .withDescription("Security test for PUT");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // PUT (update) response should NOT return openMetadataServerConnection
    IngestionPipeline updated =
        updateIngestionPipeline(
            request.withDescription("Updated description for security test"), ADMIN_AUTH_HEADERS);
    assertNull(
        updated.getOpenMetadataServerConnection(),
        "SECURITY: PUT response must NOT return openMetadataServerConnection");
  }

  private IngestionPipeline updateIngestionPipeline(
      CreateIngestionPipeline create, Map<String, String> authHeaders)
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

  protected final WebTarget getDeletePipelineStatusByRunId(String id, String runId) {
    return getCollection().path("/" + id + "/pipelineStatus/" + runId);
  }

  @Override
  public IngestionPipeline validateGetWithDifferentFields(
      IngestionPipeline ingestion, boolean byName) throws HttpResponseException {
    String fields = "";
    ingestion =
        byName
            ? getEntityByName(ingestion.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(ingestion.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(ingestion.getService());
    assertListNull(ingestion.getOwners());

    fields = "owners,followers";
    ingestion =
        byName
            ? getEntityByName(ingestion.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(ingestion.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return ingestion;
  }

  private void validateSourceConfig(
      SourceConfig orig, SourceConfig updated, IngestionPipeline ingestionPipeline) {
    String serviceType = ingestionPipeline.getService().getType();
    if (serviceType.equals(Entity.DATABASE_SERVICE)
        && ingestionPipeline.getPipelineType().equals(PipelineType.METADATA)) {
      DatabaseServiceMetadataPipeline origConfig =
          (DatabaseServiceMetadataPipeline) orig.getConfig();
      DatabaseServiceMetadataPipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DatabaseServiceMetadataPipeline.class);
      assertEquals(origConfig, updatedConfig);
    } else if (serviceType.equals(Entity.DATABASE_SERVICE)
        && ingestionPipeline.getPipelineType().equals(PipelineType.USAGE)) {
      DatabaseServiceQueryUsagePipeline origConfig =
          (DatabaseServiceQueryUsagePipeline) orig.getConfig();
      DatabaseServiceQueryUsagePipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DatabaseServiceQueryUsagePipeline.class);
      assertEquals(origConfig, updatedConfig);
    } else if (serviceType.equals(Entity.DASHBOARD_SERVICE)) {
      DashboardServiceMetadataPipeline origConfig =
          (DashboardServiceMetadataPipeline) orig.getConfig();
      DashboardServiceMetadataPipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), DashboardServiceMetadataPipeline.class);
      assertEquals(origConfig, updatedConfig);
    } else if (serviceType.equals(Entity.MESSAGING_SERVICE)) {
      MessagingServiceMetadataPipeline origConfig =
          (MessagingServiceMetadataPipeline) orig.getConfig();
      MessagingServiceMetadataPipeline updatedConfig =
          JsonUtils.convertValue(updated.getConfig(), MessagingServiceMetadataPipeline.class);
      assertEquals(origConfig, updatedConfig);
    }
  }

  @Test
  void testProgressTrackingInIngestionStatus(TestInfo test) throws IOException {
    // Create a test ingestion pipeline
    CreateIngestionPipeline create = createRequest(test);
    IngestionPipeline pipeline = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    String runId = UUID.randomUUID().toString();

    // Create progress data with all entity types using ProgressProperty
    Progress progressData = new Progress();
    progressData.withAdditionalProperty(
        "databases",
        new ProgressProperty().withTotal(1).withProcessed(1).withEstimatedRemainingSeconds(0));
    progressData.withAdditionalProperty(
        "schemas",
        new ProgressProperty().withTotal(47).withProcessed(30).withEstimatedRemainingSeconds(120));
    progressData.withAdditionalProperty(
        "tables",
        new ProgressProperty()
            .withTotal(9621)
            .withProcessed(5000)
            .withEstimatedRemainingSeconds(600));
    progressData.withAdditionalProperty(
        "stored_procedures",
        new ProgressProperty().withTotal(100).withProcessed(0).withEstimatedRemainingSeconds(null));

    // Create step summary with progress
    List<StepSummary> steps = new ArrayList<>();
    StepSummary stepSummary =
        new StepSummary()
            .withName("TestSource")
            .withRecords(5000)
            .withUpdatedRecords(100)
            .withWarnings(5)
            .withErrors(2)
            .withFiltered(50)
            .withProgress(progressData);
    steps.add(stepSummary);

    // Create and submit pipeline status with progress data
    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withRunId(runId)
            .withPipelineState(PipelineStatusType.RUNNING)
            .withStartDate(System.currentTimeMillis())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(steps);

    TestUtils.put(
        getPipelineStatusTarget(pipeline.getFullyQualifiedName()),
        pipelineStatus,
        Response.Status.CREATED,
        ADMIN_AUTH_HEADERS);

    // Retrieve the status and verify it was stored correctly
    PipelineStatus retrievedStatus =
        TestUtils.get(
            getPipelineStatusByRunId(pipeline.getFullyQualifiedName(), runId),
            PipelineStatus.class,
            ADMIN_AUTH_HEADERS);

    assertNotNull(retrievedStatus);
    assertNotNull(retrievedStatus.getStatus());
    assertEquals(1, retrievedStatus.getStatus().size());
    assertNotNull(retrievedStatus.getStatus().get(0).getProgress());

    // Verify progress data was persisted correctly
    Progress retrievedProgress = retrievedStatus.getStatus().get(0).getProgress();
    assertEquals(4, retrievedProgress.getAdditionalProperties().size());

    // Verify databases progress
    ProgressProperty dbProgress = retrievedProgress.getAdditionalProperties().get("databases");
    assertNotNull(dbProgress);
    assertEquals(1, dbProgress.getTotal());
    assertEquals(1, dbProgress.getProcessed());
    assertEquals(0, dbProgress.getEstimatedRemainingSeconds());

    // Verify schemas progress
    ProgressProperty schemaProgress = retrievedProgress.getAdditionalProperties().get("schemas");
    assertNotNull(schemaProgress);
    assertEquals(47, schemaProgress.getTotal());
    assertEquals(30, schemaProgress.getProcessed());
    assertEquals(120, schemaProgress.getEstimatedRemainingSeconds());

    // Verify tables progress
    ProgressProperty tableProgress = retrievedProgress.getAdditionalProperties().get("tables");
    assertNotNull(tableProgress);
    assertEquals(9621, tableProgress.getTotal());
    assertEquals(5000, tableProgress.getProcessed());
    assertEquals(600, tableProgress.getEstimatedRemainingSeconds());

    // Verify stored procedures progress (no estimate yet)
    ProgressProperty spProgress =
        retrievedProgress.getAdditionalProperties().get("stored_procedures");
    assertNotNull(spProgress);
    assertEquals(100, spProgress.getTotal());
    assertEquals(0, spProgress.getProcessed());
    assertNull(spProgress.getEstimatedRemainingSeconds());
  }
}
