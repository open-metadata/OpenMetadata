package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.services.ingestionPipelines.Progress;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressProperty;
import org.openmetadata.schema.entity.services.ingestionPipelines.StepSummary;
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
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for IngestionPipeline entity operations.
 *
 * <p>This test class requires K8s (K3s) pipeline scheduler for delete/deploy operations. Enable
 * K8s tests by setting ENABLE_K8S_TESTS=true environment variable or system property.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds ingestion pipeline-specific tests
 * for source configs and pipeline types.
 *
 * <p>Migrated from:
 * org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest
 *
 * <p>Run with: mvn test -Dtest=IngestionPipelineResourceIT -DENABLE_K8S_TESTS=true
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IngestionPipelineResourceIT
    extends BaseEntityIT<IngestionPipeline, CreateIngestionPipeline> {

  private static final Logger LOG = LoggerFactory.getLogger(IngestionPipelineResourceIT.class);
  private static final Date START_DATE = new DateTime("2022-06-10T15:06:47+00:00").toDate();

  // IngestionPipeline only supports owners,followers fields - no tags, no domain
  {
    supportsTags = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected String getResourcePath() {
    return IngestionPipelineResource.COLLECTION_PATH;
  }

  @BeforeAll
  void setupK8s() {
    // IngestionPipelineResourceIT requires K8s for delete/deploy operations
    TestSuiteBootstrap.setupK8s();
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateIngestionPipeline createMinimalRequest(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true).withIncludeViews(true);

    SourceConfig sourceConfig = new SourceConfig().withConfig(metadataPipeline);

    return new CreateIngestionPipeline()
        .withName(ns.prefix("ingestion"))
        .withDescription("Test ingestion pipeline created by integration test")
        .withPipelineType(PipelineType.METADATA)
        .withService(service.getEntityReference())
        .withSourceConfig(sourceConfig)
        .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));
  }

  @Override
  protected CreateIngestionPipeline createRequest(String name, TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true).withIncludeViews(true);

    SourceConfig sourceConfig = new SourceConfig().withConfig(metadataPipeline);

    return new CreateIngestionPipeline()
        .withName(name)
        .withDescription("Test ingestion pipeline")
        .withPipelineType(PipelineType.METADATA)
        .withService(service.getEntityReference())
        .withSourceConfig(sourceConfig)
        .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));
  }

  @Override
  protected IngestionPipeline createEntity(CreateIngestionPipeline createRequest) {
    return SdkClients.adminClient().ingestionPipelines().create(createRequest);
  }

  @Override
  protected IngestionPipeline getEntity(String id) {
    return SdkClients.adminClient().ingestionPipelines().get(id);
  }

  @Override
  protected IngestionPipeline getEntityByName(String fqn) {
    return SdkClients.adminClient().ingestionPipelines().getByName(fqn);
  }

  @Override
  protected IngestionPipeline patchEntity(String id, IngestionPipeline entity) {
    return SdkClients.adminClient().ingestionPipelines().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().ingestionPipelines().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().ingestionPipelines().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().ingestionPipelines().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "ingestionPipeline";
  }

  @Override
  protected void validateCreatedEntity(
      IngestionPipeline entity, CreateIngestionPipeline createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "IngestionPipeline must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain ingestion pipeline name");
  }

  @Override
  protected ListResponse<IngestionPipeline> listEntities(ListParams params) {
    return SdkClients.adminClient().ingestionPipelines().list(params);
  }

  @Override
  protected IngestionPipeline getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().ingestionPipelines().get(id, fields);
  }

  @Override
  protected IngestionPipeline getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().ingestionPipelines().getByName(fqn, fields);
  }

  @Override
  protected IngestionPipeline getEntityIncludeDeleted(String id) {
    // IngestionPipeline only supports owners,followers fields
    return SdkClients.adminClient().ingestionPipelines().get(id, "owners,followers", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().ingestionPipelines().getVersionList(id);
  }

  @Override
  protected IngestionPipeline getVersion(UUID id, Double version) {
    return SdkClients.adminClient().ingestionPipelines().getVersion(id.toString(), version);
  }

  // ===================================================================
  // INGESTION PIPELINE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_ingestionPipelineWithMetadataType_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true).withIncludeViews(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("ing_metadata"))
            .withDescription("Metadata ingestion pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertEquals(PipelineType.METADATA, pipeline.getPipelineType());
  }

  @Test
  void post_ingestionPipelineWithFilterPatterns_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(
                new FilterPattern().withExcludes(List.of("information_schema.*", "test.*")))
            .withTableFilterPattern(
                new FilterPattern().withIncludes(List.of("sales.*", "users.*")));

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("ing_filters"))
            .withDescription("Ingestion with filter patterns")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getSourceConfig());
  }

  @Test
  void put_ingestionPipelineDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("ing_update_desc"))
            .withDescription("Initial description")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertEquals("Initial description", pipeline.getDescription());

    // Update description
    pipeline.setDescription("Updated description");
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_ingestionPipelineNameUniquenessWithinService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    String pipelineName = ns.prefix("unique_ing");
    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request1 =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withDescription("First pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline1 = createEntity(request1);
    assertNotNull(pipeline1);

    // Attempt to create duplicate within same service
    CreateIngestionPipeline request2 =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withDescription("Duplicate pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate ingestion pipeline in same service should fail");
  }

  @Test
  void test_listPipelinesFilteredByServiceType(TestNamespace ns) {
    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    MessagingService messagingService = MessagingServiceTestFactory.createKafka(ns);

    DatabaseServiceMetadataPipeline dbMetadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);
    MessagingServiceMetadataPipeline messagingMetadataPipeline =
        new MessagingServiceMetadataPipeline()
            .withTopicFilterPattern(new FilterPattern().withExcludes(List.of("orders.*")));

    CreateIngestionPipeline dbRequest =
        new CreateIngestionPipeline()
            .withName(ns.prefix("db_pipeline"))
            .withPipelineType(PipelineType.METADATA)
            .withService(dbService.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(dbMetadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    CreateIngestionPipeline messagingRequest =
        new CreateIngestionPipeline()
            .withName(ns.prefix("messaging_pipeline"))
            .withPipelineType(PipelineType.METADATA)
            .withService(messagingService.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(messagingMetadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline dbPipeline = createEntity(dbRequest);
    IngestionPipeline messagingPipeline = createEntity(messagingRequest);

    ListParams params = new ListParams();
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("serviceType", "messagingService");
    params.setQueryParams(queryParams);

    ListResponse<IngestionPipeline> result = listEntities(params);
    assertTrue(
        result.getData().stream().anyMatch(p -> p.getId().equals(messagingPipeline.getId())));

    queryParams.put("serviceType", "databaseService");
    params.setQueryParams(queryParams);
    result = listEntities(params);
    assertTrue(result.getData().stream().anyMatch(p -> p.getId().equals(dbPipeline.getId())));
  }

  @Test
  void test_listPipelinesFilteredByPipelineType(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline metadataRequest =
        new CreateIngestionPipeline()
            .withName(ns.prefix("metadata_pipeline"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline metadataPipelineEntity = createEntity(metadataRequest);

    ListParams params = new ListParams();
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("pipelineType", "metadata");
    params.setQueryParams(queryParams);

    ListResponse<IngestionPipeline> result = listEntities(params);
    assertTrue(result.getData().size() >= 1);
    assertTrue(
        result.getData().stream().anyMatch(p -> p.getId().equals(metadataPipelineEntity.getId())));
  }

  @Test
  void test_listPipelinesFilteredByService(TestNamespace ns) {
    DatabaseService service1 = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseService service2 = DatabaseServiceTestFactory.createSnowflake(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request1 =
        new CreateIngestionPipeline()
            .withName(ns.prefix("pipeline1"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service1.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    CreateIngestionPipeline request2 =
        new CreateIngestionPipeline()
            .withName(ns.prefix("pipeline2"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service2.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline1 = createEntity(request1);
    IngestionPipeline pipeline2 = createEntity(request2);

    ListParams params = new ListParams();
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("service", service1.getFullyQualifiedName());
    params.setQueryParams(queryParams);

    ListResponse<IngestionPipeline> result = listEntities(params);
    assertEquals(1, result.getData().size());
    assertEquals(pipeline1.getId(), result.getData().get(0).getId());
  }

  @Test
  void test_updatePipelineScheduleInterval(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("schedule_update"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(
                new AirflowConfig().withStartDate(START_DATE).withScheduleInterval("5 * * * *"));

    IngestionPipeline pipeline = createEntity(request);
    assertEquals("5 * * * *", pipeline.getAirflowConfig().getScheduleInterval());

    pipeline.setAirflowConfig(
        new AirflowConfig().withStartDate(START_DATE).withScheduleInterval("7 * * * *"));
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals("7 * * * *", updated.getAirflowConfig().getScheduleInterval());
  }

  @Test
  void test_updatePipelineConcurrency(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("concurrency_update"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE).withConcurrency(50));

    IngestionPipeline pipeline = createEntity(request);
    assertEquals(50, pipeline.getAirflowConfig().getConcurrency());

    pipeline.setAirflowConfig(new AirflowConfig().withStartDate(START_DATE).withConcurrency(110));
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals(110, updated.getAirflowConfig().getConcurrency());
  }

  @Test
  void test_updatePipelineStartDate(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    Date initialStartDate = START_DATE;
    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("startdate_update"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(initialStartDate));

    IngestionPipeline pipeline = createEntity(request);
    assertEquals(initialStartDate, pipeline.getAirflowConfig().getStartDate());

    Date newStartDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    pipeline.setAirflowConfig(new AirflowConfig().withStartDate(newStartDate));
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals(newStartDate, updated.getAirflowConfig().getStartDate());
  }

  @Test
  void test_updateDatabaseServiceMetadataSourceConfig(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline initialPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(List.of("test.*")));

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("source_update"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(initialPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getSourceConfig());

    DatabaseServiceMetadataPipeline updatedPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(false)
            .withIncludeViews(true)
            .withSchemaFilterPattern(
                new FilterPattern().withExcludes(List.of("information_schema.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(List.of("sales.*")));

    pipeline.setSourceConfig(new SourceConfig().withConfig(updatedPipeline));
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertNotNull(updated.getSourceConfig());
  }

  @Test
  void test_updateDashboardServiceSourceConfig(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    DashboardServiceMetadataPipeline initialPipeline =
        new DashboardServiceMetadataPipeline()
            .withDashboardFilterPattern(new FilterPattern().withIncludes(List.of("dashboard.*")));

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("dashboard_source_update"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(initialPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getSourceConfig());

    DashboardServiceMetadataPipeline updatedPipeline =
        new DashboardServiceMetadataPipeline()
            .withDashboardFilterPattern(
                new FilterPattern().withIncludes(List.of("test1.*", "test2.*")));

    pipeline.setSourceConfig(new SourceConfig().withConfig(updatedPipeline));
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertNotNull(updated.getSourceConfig());
  }

  @Test
  void test_updateMessagingServiceSourceConfig(TestNamespace ns) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    MessagingServiceMetadataPipeline initialPipeline =
        new MessagingServiceMetadataPipeline()
            .withTopicFilterPattern(new FilterPattern().withExcludes(List.of("orders.*")));

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("messaging_source_update"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(initialPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getSourceConfig());

    MessagingServiceMetadataPipeline updatedPipeline =
        new MessagingServiceMetadataPipeline()
            .withTopicFilterPattern(
                new FilterPattern().withIncludes(List.of("topic1.*", "topic2.*")));

    pipeline.setSourceConfig(new SourceConfig().withConfig(updatedPipeline));
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertNotNull(updated.getSourceConfig());
  }

  @Test
  void test_createUsagePipeline(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceQueryUsagePipeline usagePipeline =
        new DatabaseServiceQueryUsagePipeline()
            .withQueryLogDuration(1)
            .withStageFileLocation("/tmp/test.log");

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("usage_pipeline"))
            .withPipelineType(PipelineType.USAGE)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(usagePipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertEquals(PipelineType.USAGE, pipeline.getPipelineType());
    assertNotNull(pipeline.getSourceConfig());
  }

  @Test
  void test_updateLoggerLevel(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("logger_level_update"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withLoggerLevel(LogLevels.INFO)
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);
    assertEquals(LogLevels.INFO, pipeline.getLoggerLevel());

    pipeline.setLoggerLevel(LogLevels.ERROR);
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals(LogLevels.ERROR, updated.getLoggerLevel());
  }

  @Test
  void test_pipelineStatusCreation(TestNamespace ns) throws OpenMetadataException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("status_test"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);

    String runId = UUID.randomUUID().toString();
    PipelineStatus status =
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.RUNNING)
            .withRunId(runId)
            .withTimestamp(System.currentTimeMillis());

    OpenMetadataClient client = SdkClients.adminClient();
    String path =
        "/v1/services/ingestionPipelines/" + pipeline.getFullyQualifiedName() + "/pipelineStatus";
    client.getHttpClient().execute(HttpMethod.PUT, path, status, PipelineStatus.class);

    String statusPath =
        "/v1/services/ingestionPipelines/"
            + pipeline.getFullyQualifiedName()
            + "/pipelineStatus/"
            + runId;
    PipelineStatus retrieved =
        client.getHttpClient().execute(HttpMethod.GET, statusPath, null, PipelineStatus.class);

    assertNotNull(retrieved);
    assertEquals(PipelineStatusType.RUNNING, retrieved.getPipelineState());
    assertEquals(runId, retrieved.getRunId());
  }

  @Test
  void test_pipelineStatusUpdate(TestNamespace ns) throws OpenMetadataException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("status_update_test"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);

    String runId = UUID.randomUUID().toString();
    PipelineStatus initialStatus =
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.RUNNING)
            .withRunId(runId)
            .withTimestamp(System.currentTimeMillis());

    OpenMetadataClient client = SdkClients.adminClient();
    String path =
        "/v1/services/ingestionPipelines/" + pipeline.getFullyQualifiedName() + "/pipelineStatus";
    client.getHttpClient().execute(HttpMethod.PUT, path, initialStatus, PipelineStatus.class);

    PipelineStatus updatedStatus =
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.SUCCESS)
            .withRunId(runId)
            .withTimestamp(System.currentTimeMillis());

    client.getHttpClient().execute(HttpMethod.PUT, path, updatedStatus, PipelineStatus.class);

    String statusPath =
        "/v1/services/ingestionPipelines/"
            + pipeline.getFullyQualifiedName()
            + "/pipelineStatus/"
            + runId;
    PipelineStatus retrieved =
        client.getHttpClient().execute(HttpMethod.GET, statusPath, null, PipelineStatus.class);

    assertNotNull(retrieved);
    assertEquals(PipelineStatusType.SUCCESS, retrieved.getPipelineState());
  }

  @Test
  void test_pipelineStatusDeletion(TestNamespace ns) throws OpenMetadataException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("status_delete_test"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);

    String runId = UUID.randomUUID().toString();
    PipelineStatus status =
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.SUCCESS)
            .withRunId(runId)
            .withTimestamp(System.currentTimeMillis());

    OpenMetadataClient client = SdkClients.adminClient();
    String path =
        "/v1/services/ingestionPipelines/" + pipeline.getFullyQualifiedName() + "/pipelineStatus";
    client.getHttpClient().execute(HttpMethod.PUT, path, status, PipelineStatus.class);

    String deletePath = "/v1/services/ingestionPipelines/" + pipeline.getId() + "/pipelineStatus";
    client.getHttpClient().execute(HttpMethod.DELETE, deletePath, null, Void.class);
  }

  @Test
  void test_pipelineStatusDeletionByRunId(TestNamespace ns) throws OpenMetadataException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("status_delete_runid_test"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);

    String runId1 = UUID.randomUUID().toString();
    String runId2 = UUID.randomUUID().toString();

    OpenMetadataClient client = SdkClients.adminClient();
    String path =
        "/v1/services/ingestionPipelines/" + pipeline.getFullyQualifiedName() + "/pipelineStatus";

    PipelineStatus status1 =
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.RUNNING)
            .withRunId(runId1)
            .withTimestamp(System.currentTimeMillis());
    client.getHttpClient().execute(HttpMethod.PUT, path, status1, PipelineStatus.class);

    PipelineStatus status2 =
        new PipelineStatus()
            .withPipelineState(PipelineStatusType.SUCCESS)
            .withRunId(runId2)
            .withTimestamp(System.currentTimeMillis());
    client.getHttpClient().execute(HttpMethod.PUT, path, status2, PipelineStatus.class);

    String deletePath =
        "/v1/services/ingestionPipelines/" + pipeline.getId() + "/pipelineStatus/" + runId1;
    client.getHttpClient().execute(HttpMethod.DELETE, deletePath, null, Void.class);

    String statusPath =
        "/v1/services/ingestionPipelines/"
            + pipeline.getFullyQualifiedName()
            + "/pipelineStatus/"
            + runId2;
    PipelineStatus retrieved =
        client.getHttpClient().execute(HttpMethod.GET, statusPath, null, PipelineStatus.class);
    assertNotNull(retrieved);
    assertEquals(runId2, retrieved.getRunId());
  }

  @Test
  void test_pipelineProgressTracking(TestNamespace ns) throws OpenMetadataException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("progress_test"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);

    String runId = UUID.randomUUID().toString();

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

    PipelineStatus status =
        new PipelineStatus()
            .withRunId(runId)
            .withPipelineState(PipelineStatusType.RUNNING)
            .withStartDate(System.currentTimeMillis())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(steps);

    OpenMetadataClient client = SdkClients.adminClient();
    String path =
        "/v1/services/ingestionPipelines/" + pipeline.getFullyQualifiedName() + "/pipelineStatus";
    client.getHttpClient().execute(HttpMethod.PUT, path, status, PipelineStatus.class);

    String statusPath =
        "/v1/services/ingestionPipelines/"
            + pipeline.getFullyQualifiedName()
            + "/pipelineStatus/"
            + runId;
    PipelineStatus retrieved =
        client.getHttpClient().execute(HttpMethod.GET, statusPath, null, PipelineStatus.class);

    assertNotNull(retrieved);
    assertNotNull(retrieved.getStatus());
    assertEquals(1, retrieved.getStatus().size());
    assertNotNull(retrieved.getStatus().get(0).getProgress());

    Progress retrievedProgress = retrieved.getStatus().get(0).getProgress();
    assertEquals(3, retrievedProgress.getAdditionalProperties().size());

    ProgressProperty dbProgress = retrievedProgress.getAdditionalProperties().get("databases");
    assertNotNull(dbProgress);
    assertEquals(1, dbProgress.getTotal());
    assertEquals(1, dbProgress.getProcessed());

    ProgressProperty schemaProgress = retrievedProgress.getAdditionalProperties().get("schemas");
    assertNotNull(schemaProgress);
    assertEquals(47, schemaProgress.getTotal());
    assertEquals(30, schemaProgress.getProcessed());

    ProgressProperty tableProgress = retrievedProgress.getAdditionalProperties().get("tables");
    assertNotNull(tableProgress);
    assertEquals(9621, tableProgress.getTotal());
    assertEquals(5000, tableProgress.getProcessed());
  }

  @Test
  void test_multipleServicesWithSamePipelineName(TestNamespace ns) {
    DatabaseService service1 = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseService service2 = DatabaseServiceTestFactory.createSnowflake(ns);

    String pipelineName = ns.prefix("same_name");
    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request1 =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withPipelineType(PipelineType.METADATA)
            .withService(service1.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    CreateIngestionPipeline request2 =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withPipelineType(PipelineType.METADATA)
            .withService(service2.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline1 = createEntity(request1);
    IngestionPipeline pipeline2 = createEntity(request2);

    assertNotNull(pipeline1);
    assertNotNull(pipeline2);
    assertNotEquals(pipeline1.getFullyQualifiedName(), pipeline2.getFullyQualifiedName());
  }

  @Test
  void test_pipelineWithAllAirflowConfigOptions(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    Integer concurrency = 75;
    Integer retries = 3;
    Integer retryDelay = 300;
    String scheduleInterval = "0 */6 * * *";
    Date startDate = new DateTime("2023-01-01T00:00:00+00:00").toDate();
    Date endDate = new DateTime("2024-12-31T23:59:59+00:00").toDate();

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("full_airflow_config"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(
                new AirflowConfig()
                    .withStartDate(startDate)
                    .withEndDate(endDate)
                    .withScheduleInterval(scheduleInterval)
                    .withConcurrency(concurrency)
                    .withMaxActiveRuns(5)
                    .withWorkflowTimeout(3600)
                    .withRetries(retries)
                    .withRetryDelay(retryDelay));

    IngestionPipeline pipeline = createEntity(request);

    assertNotNull(pipeline.getAirflowConfig());
    assertEquals(startDate, pipeline.getAirflowConfig().getStartDate());
    assertEquals(endDate, pipeline.getAirflowConfig().getEndDate());
    assertEquals(scheduleInterval, pipeline.getAirflowConfig().getScheduleInterval());
    assertEquals(concurrency, pipeline.getAirflowConfig().getConcurrency());
    assertEquals(5, pipeline.getAirflowConfig().getMaxActiveRuns());
    assertEquals(3600, pipeline.getAirflowConfig().getWorkflowTimeout());
    assertEquals(retries, pipeline.getAirflowConfig().getRetries());
    assertEquals(retryDelay, pipeline.getAirflowConfig().getRetryDelay());
  }

  @Test
  void post_IngestionPipelineWithoutRequiredService_400() {
    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName("pipeline_without_service")
            .withPipelineType(PipelineType.METADATA)
            .withService(null)
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating ingestion pipeline without service should fail");
  }

  @Test
  void post_AirflowWithDifferentServices_200_OK(TestNamespace ns) {
    DatabaseService postgres = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseService snowflake = DatabaseServiceTestFactory.createSnowflake(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request1 =
        new CreateIngestionPipeline()
            .withName(ns.prefix("pipeline_postgres"))
            .withPipelineType(PipelineType.METADATA)
            .withService(postgres.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline1 = createEntity(request1);
    assertEquals(postgres.getName(), pipeline1.getService().getName());

    CreateIngestionPipeline request2 =
        new CreateIngestionPipeline()
            .withName(ns.prefix("pipeline_snowflake"))
            .withPipelineType(PipelineType.METADATA)
            .withService(snowflake.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline2 = createEntity(request2);
    assertEquals(snowflake.getName(), pipeline2.getService().getName());
  }

  @Test
  void post_dbtPipeline_configIsEncrypted(TestNamespace ns) throws OpenMetadataException {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    AWSCredentials awsCredentials =
        new AWSCredentials()
            .withAwsAccessKeyId("123456789")
            .withAwsSecretAccessKey("asdfqwer1234")
            .withAwsRegion("eu-west-2");

    DbtPipeline dbtPipeline =
        new DbtPipeline()
            .withDbtConfigSource(new DbtS3Config().withDbtSecurityConfig(awsCredentials));

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("dbt_pipeline"))
            .withPipelineType(PipelineType.DBT)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(dbtPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request);

    DbtPipeline actualDbtPipeline =
        JsonUtils.convertValue(pipeline.getSourceConfig().getConfig(), DbtPipeline.class);
    DbtS3Config actualDbtS3Config =
        JsonUtils.convertValue(actualDbtPipeline.getDbtConfigSource(), DbtS3Config.class);

    assertEquals(
        awsCredentials.getAwsAccessKeyId(),
        actualDbtS3Config.getDbtSecurityConfig().getAwsAccessKeyId());
    assertEquals(
        awsCredentials.getAwsRegion(), actualDbtS3Config.getDbtSecurityConfig().getAwsRegion());

    String maskedSecret = actualDbtS3Config.getDbtSecurityConfig().getAwsSecretAccessKey();
    assertTrue(
        maskedSecret == null || maskedSecret.contains("*"),
        "Secret should be masked for admin user");

    IngestionPipeline botPipeline =
        SdkClients.ingestionBotClient().ingestionPipelines().get(pipeline.getId().toString());

    DbtPipeline botDbtPipeline =
        JsonUtils.convertValue(botPipeline.getSourceConfig().getConfig(), DbtPipeline.class);
    DbtS3Config botDbtS3Config =
        JsonUtils.convertValue(botDbtPipeline.getDbtConfigSource(), DbtS3Config.class);

    assertEquals(
        awsCredentials.getAwsAccessKeyId(),
        botDbtS3Config.getDbtSecurityConfig().getAwsAccessKeyId());
    assertEquals(
        awsCredentials.getAwsRegion(), botDbtS3Config.getDbtSecurityConfig().getAwsRegion());
    assertEquals(
        awsCredentials.getAwsSecretAccessKey(),
        botDbtS3Config.getDbtSecurityConfig().getAwsSecretAccessKey());
  }

  @Test
  void test_listPipelinesByProvider(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline automationRequest =
        new CreateIngestionPipeline()
            .withName(ns.prefix("automation_pipeline"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE))
            .withProvider(ProviderType.AUTOMATION);

    IngestionPipeline automationPipeline = createEntity(automationRequest);

    CreateIngestionPipeline userRequest =
        new CreateIngestionPipeline()
            .withName(ns.prefix("user_pipeline"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE))
            .withProvider(ProviderType.USER);

    IngestionPipeline userPipeline = createEntity(userRequest);

    // Use cleaner API with service filter for test isolation
    ListParams automationParams =
        new ListParams()
            .withService(service.getFullyQualifiedName())
            .withProvider(ProviderType.AUTOMATION.value());

    ListResponse<IngestionPipeline> result = listEntities(automationParams);
    assertTrue(
        result.getData().stream().anyMatch(p -> p.getId().equals(automationPipeline.getId())),
        "Automation pipeline should be found with provider filter");

    ListParams userParams =
        new ListParams()
            .withService(service.getFullyQualifiedName())
            .withProvider(ProviderType.USER.value());

    result = listEntities(userParams);
    assertTrue(
        result.getData().stream().anyMatch(p -> p.getId().equals(userPipeline.getId())),
        "User pipeline should be found with provider filter");

    // Test with multiple filters
    ListParams multiParams =
        new ListParams()
            .withService(service.getFullyQualifiedName())
            .withProvider(ProviderType.AUTOMATION.value())
            .withServiceType("databaseService")
            .withPipelineType("metadata");

    result = listEntities(multiParams);
    assertTrue(
        result.getData().stream().anyMatch(p -> p.getId().equals(automationPipeline.getId())),
        "Automation pipeline should be found with multiple filters");
  }

  // ===================================================================
  // SECURITY TESTS - JWT Token Exposure Prevention
  // ===================================================================

  @Test
  void get_ingestionPipeline_doesNotExposeJwtToken_security(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("security_get_test"))
            .withDescription("Security test pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline created = createEntity(request);

    IngestionPipeline fetched = getEntity(created.getId().toString());
    assertNull(
        fetched.getOpenMetadataServerConnection(),
        "SECURITY: GET by ID must NOT return openMetadataServerConnection to prevent JWT token exposure");

    IngestionPipeline fetchedByName = getEntityByName(created.getFullyQualifiedName());
    assertNull(
        fetchedByName.getOpenMetadataServerConnection(),
        "SECURITY: GET by name must NOT return openMetadataServerConnection to prevent JWT token exposure");
  }

  @Test
  void list_ingestionPipelines_doesNotExposeJwtToken_security(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request1 =
        new CreateIngestionPipeline()
            .withName(ns.prefix("security_list_1"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    CreateIngestionPipeline request2 =
        new CreateIngestionPipeline()
            .withName(ns.prefix("security_list_2"))
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    createEntity(request1);
    createEntity(request2);

    ListParams params = new ListParams().withService(service.getFullyQualifiedName());
    ListResponse<IngestionPipeline> pipelines = listEntities(params);

    for (IngestionPipeline pipeline : pipelines.getData()) {
      assertNull(
          pipeline.getOpenMetadataServerConnection(),
          String.format(
              "SECURITY: LIST must NOT return openMetadataServerConnection for pipeline [%s]",
              pipeline.getName()));
    }
  }

  @Test
  void get_ingestionPipelineVersion_doesNotExposeJwtToken_security(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("security_version_test"))
            .withDescription("Security test for versions")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline created = createEntity(request);

    created.setDescription("Updated description for version test");
    patchEntity(created.getId().toString(), created);

    IngestionPipeline version = getVersion(created.getId(), created.getVersion());
    assertNull(
        version.getOpenMetadataServerConnection(),
        "SECURITY: GET version must NOT return openMetadataServerConnection");
  }

  @Test
  void bot_canAccessPipeline_butApiDoesNotExposeJwt_security(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("security_bot_test"))
            .withDescription("Security test for bot access")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline created = createEntity(request);

    IngestionPipeline fetchedByBot =
        SdkClients.ingestionBotClient().ingestionPipelines().get(created.getId().toString());
    assertNull(
        fetchedByBot.getOpenMetadataServerConnection(),
        "SECURITY: Even bot users must NOT see openMetadataServerConnection via GET API. "
            + "JWT should only be passed to pipeline service during deploy.");
  }

  @Test
  void put_ingestionPipeline_doesNotExposeJwtToken_security(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("security_put_test"))
            .withDescription("Security test for PUT")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline created = createEntity(request);

    created.setDescription("Updated description for security test");
    IngestionPipeline updated = patchEntity(created.getId().toString(), created);
    assertNull(
        updated.getOpenMetadataServerConnection(),
        "SECURITY: PUT response must NOT return openMetadataServerConnection");
  }

  @Test
  void create_ingestionPipeline_doesNotExposeJwtToken_security(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("security_create_test"))
            .withDescription("Security test for CREATE")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline created = createEntity(request);
    assertNull(
        created.getOpenMetadataServerConnection(),
        "SECURITY: CREATE response must NOT return openMetadataServerConnection");
  }
}
