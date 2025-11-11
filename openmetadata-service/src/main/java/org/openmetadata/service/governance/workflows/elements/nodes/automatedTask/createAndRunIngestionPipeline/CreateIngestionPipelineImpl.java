package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.openmetadata.service.Entity.API_SERVICE;
import static org.openmetadata.service.Entity.DASHBOARD_SERVICE;
import static org.openmetadata.service.Entity.DATABASE_SERVICE;
import static org.openmetadata.service.Entity.MESSAGING_SERVICE;
import static org.openmetadata.service.Entity.METADATA_SERVICE;
import static org.openmetadata.service.Entity.MLMODEL_SERVICE;
import static org.openmetadata.service.Entity.PIPELINE_SERVICE;
import static org.openmetadata.service.Entity.SEARCH_SERVICE;
import static org.openmetadata.service.Entity.STORAGE_SERVICE;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApiServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceAutoClassificationPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceProfilerPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryLineagePipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.MessagingServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.MlmodelServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.PipelineServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SearchServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class CreateIngestionPipelineImpl {
  private static final List<String> DEFAULT_TIERS_TO_PROCESS = List.of("Tier1", "Tier2");
  private static final Map<PipelineType, String> SUPPORT_FEATURE_MAP = new HashMap<>();

  static {
    SUPPORT_FEATURE_MAP.put(PipelineType.METADATA, "supportsMetadataExtraction");
    SUPPORT_FEATURE_MAP.put(PipelineType.USAGE, "supportsUsageExtraction");
    SUPPORT_FEATURE_MAP.put(PipelineType.LINEAGE, "supportsLineageExtraction");
    SUPPORT_FEATURE_MAP.put(PipelineType.PROFILER, "supportsProfiler");
    SUPPORT_FEATURE_MAP.put(PipelineType.AUTO_CLASSIFICATION, "supportsProfiler");
  }

  private static final Map<PipelineType, Function<Map<String, FilterPattern>, Object>>
      DATABASE_PIPELINE_MAP = new HashMap<>();

  static {
    DATABASE_PIPELINE_MAP.put(
        PipelineType.METADATA, CreateIngestionPipelineImpl::getDatabaseServiceMetadataPipeline);
    DATABASE_PIPELINE_MAP.put(
        PipelineType.USAGE, CreateIngestionPipelineImpl::getDatabaseServiceQueryUsagePipeline);
    DATABASE_PIPELINE_MAP.put(
        PipelineType.LINEAGE, CreateIngestionPipelineImpl::getDatabaseServiceQueryLineagePipeline);
    DATABASE_PIPELINE_MAP.put(
        PipelineType.PROFILER, CreateIngestionPipelineImpl::getDatabaseServiceProfilerPipeline);
    DATABASE_PIPELINE_MAP.put(
        PipelineType.AUTO_CLASSIFICATION,
        CreateIngestionPipelineImpl::getDatabaseServiceAutoClassificationPipeline);
  }

  private static final Map<String, Function<Map<String, FilterPattern>, Object>>
      SERVICE_TO_PIPELINE_MAP = new HashMap<>();

  static {
    SERVICE_TO_PIPELINE_MAP.put(
        MESSAGING_SERVICE, CreateIngestionPipelineImpl::getMessagingServiceMetadataPipeline);
    SERVICE_TO_PIPELINE_MAP.put(
        DASHBOARD_SERVICE, CreateIngestionPipelineImpl::getDashboardServiceMetadataPipeline);
    SERVICE_TO_PIPELINE_MAP.put(
        PIPELINE_SERVICE, CreateIngestionPipelineImpl::getPipelineServiceMetadataPipeline);
    SERVICE_TO_PIPELINE_MAP.put(
        MLMODEL_SERVICE, CreateIngestionPipelineImpl::getMlmodelServiceMetadataPipeline);
    SERVICE_TO_PIPELINE_MAP.put(
        METADATA_SERVICE, CreateIngestionPipelineImpl::getDatabaseServiceMetadataPipeline);
    SERVICE_TO_PIPELINE_MAP.put(
        STORAGE_SERVICE, CreateIngestionPipelineImpl::getStorageServiceMetadataPipeline);
    SERVICE_TO_PIPELINE_MAP.put(
        SEARCH_SERVICE, CreateIngestionPipelineImpl::getSearchServiceMetadataPipeline);
    SERVICE_TO_PIPELINE_MAP.put(
        API_SERVICE, CreateIngestionPipelineImpl::getApiServiceMetadataPipeline);
  }

  private static final Map<String, List<String>> SERVICE_FILTERS_MAP = new HashMap<>();

  public static final String DATABASE_FILTER_PATTERN = "databaseFilterPattern";
  public static final String SCHEMA_FILTER_PATTERN = "schemaFilterPattern";
  public static final String TABLE_FILTER_PATTERN = "tableFilterPattern";
  public static final String TOPIC_FILTER_PATTERN = "topicFilterPattern";
  public static final String DASHBOARD_FILTER_PATTERN = "dashboardFilterPattern";
  public static final String CHART_FILTER_PATTERN = "chartFilterPattern";
  public static final String DATA_MODEL_FILTER_PATTERN = "dataModelFilterPattern";
  public static final String PROJECT_FILTER_PATTERN = "projectFilterPattern";
  public static final String PIPELINE_FILTER_PATTERN = "pipelineFilterPattern";
  public static final String ML_MODEL_FILTER_PATTERN = "mlModelFilterPattern";
  public static final String CONTAINER_FILTER_PATTERN = "containerFilterPattern";
  public static final String SEARCH_INDEX_FILTER_PATTERN = "searchIndexFilterPattern";
  public static final String API_COLLECTION_FILTER_PATTERN = "apiCollectionFilterPattern";

  static {
    SERVICE_FILTERS_MAP.put(
        DATABASE_SERVICE,
        List.of(DATABASE_FILTER_PATTERN, SCHEMA_FILTER_PATTERN, TABLE_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(MESSAGING_SERVICE, List.of(TOPIC_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(
        DASHBOARD_SERVICE,
        List.of(
            DASHBOARD_FILTER_PATTERN,
            CHART_FILTER_PATTERN,
            DATA_MODEL_FILTER_PATTERN,
            PROJECT_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(PIPELINE_SERVICE, List.of(PIPELINE_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(MLMODEL_SERVICE, List.of(ML_MODEL_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(
        METADATA_SERVICE,
        List.of(DATABASE_FILTER_PATTERN, SCHEMA_FILTER_PATTERN, TABLE_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(STORAGE_SERVICE, List.of(CONTAINER_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(SEARCH_SERVICE, List.of(SEARCH_INDEX_FILTER_PATTERN));
    SERVICE_FILTERS_MAP.put(API_SERVICE, List.of(API_COLLECTION_FILTER_PATTERN));
  }

  private final IngestionPipelineMapper mapper;
  private final PipelineServiceClientInterface pipelineServiceClient;

  public CreateIngestionPipelineImpl(
      IngestionPipelineMapper mapper, PipelineServiceClientInterface pipelineServiceClient) {
    this.mapper = mapper;
    this.pipelineServiceClient = pipelineServiceClient;
  }

  public CreateIngestionPipelineResult execute(
      ServiceEntityInterface service, PipelineType pipelineType, boolean deploy) {
    if (!supportsPipelineType(
        pipelineType, JsonUtils.getMap(service.getConnection().getConfig()))) {
      LOG.debug(
          String.format(
              "[GovernanceWorkflows] Service '%s' does not support Ingestion Pipeline of type '%s'",
              service.getName(), pipelineType));
      return new CreateIngestionPipelineResult(null, true);
    }
    LOG.info(
        "[GovernanceWorkflows] Creating '{}' Agent for '{}'",
        pipelineType.value(),
        service.getName());

    boolean wasSuccessful = true;

    IngestionPipeline ingestionPipeline = getOrCreateIngestionPipeline(pipelineType, service);

    if (deploy) {
      LOG.info(
          "[GovernanceWorkflows] Deploying '{}' for '{}'",
          ingestionPipeline.getDisplayName(),
          service.getName());
      wasSuccessful = deployPipeline(pipelineServiceClient, ingestionPipeline, service);
      if (wasSuccessful) {
        // Mark the pipeline as deployed
        ingestionPipeline.setDeployed(true);
        IngestionPipelineRepository repository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
        repository.createOrUpdate(null, ingestionPipeline, ingestionPipeline.getUpdatedBy());
      } else {
        LOG.warn(
            "[GovernanceWorkflows] '{}' deployment failed for '{}'",
            pipelineType.value(),
            service.getName());
      }
    }

    return new CreateIngestionPipelineResult(ingestionPipeline.getId(), wasSuccessful);
  }

  private boolean supportsPipelineType(
      PipelineType pipelineType, Map<String, Object> connectionConfig) {
    return Optional.ofNullable(connectionConfig.get(SUPPORT_FEATURE_MAP.get(pipelineType)))
        .map(supports -> (boolean) supports)
        .orElse(false);
  }

  private boolean deployPipeline(
      PipelineServiceClientInterface pipelineServiceClient,
      IngestionPipeline ingestionPipeline,
      ServiceEntityInterface service) {
    PipelineServiceClientResponse response =
        pipelineServiceClient.deployPipeline(ingestionPipeline, service);
    return response.getCode() == 200;
  }

  private String getPipelineName(PipelineType pipelineType) {
    Map<PipelineType, String> pipelineNameByType =
        Map.of(
            PipelineType.METADATA, "Metadata Agent",
            PipelineType.USAGE, "Usage Agent",
            PipelineType.LINEAGE, "Lineage Agent",
            PipelineType.PROFILER, "Profiler Agent",
            PipelineType.AUTO_CLASSIFICATION, "AutoClassification Agent");

    return pipelineNameByType.get(pipelineType);
  }

  private IngestionPipeline getOrCreateIngestionPipeline(
      PipelineType pipelineType, ServiceEntityInterface service) {
    String displayName = getPipelineName(pipelineType);
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    return Optional.ofNullable(getIngestionPipeline(repository, pipelineType, service, displayName))
        .orElseGet(() -> createIngestionPipeline(repository, pipelineType, service, displayName));
  }

  private IngestionPipeline createIngestionPipeline(
      IngestionPipelineRepository repository,
      PipelineType pipelineType,
      ServiceEntityInterface service,
      String displayName) {
    org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline create =
        new org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline()
            .withAirflowConfig(
                getAirflowConfig(pipelineType)) // Run every Sunday at midnight by default
            .withLoggerLevel(LogLevels.INFO)
            .withName(UUID.randomUUID().toString())
            .withDisplayName(displayName)
            .withOwners(service.getOwners())
            .withPipelineType(pipelineType)
            .withService(service.getEntityReference())
            .withProvider(ProviderType.AUTOMATION)
            .withSourceConfig(
                new SourceConfig().withConfig(getSourceConfig(pipelineType, service)));
    IngestionPipeline ingestionPipeline = mapper.createToEntity(create, "governance-bot");

    return repository.create(null, ingestionPipeline);
  }

  private AirflowConfig getAirflowConfig(PipelineType pipelineType) {
    String scheduleInterval = "0 0 * * 0";

    if (List.of(PipelineType.LINEAGE, PipelineType.USAGE).contains(pipelineType)) {
      scheduleInterval = "0 2 * * 0";
    } else if (List.of(PipelineType.PROFILER, PipelineType.AUTO_CLASSIFICATION)
        .contains(pipelineType)) {
      scheduleInterval = "0 4 * * 0";
    }

    return new AirflowConfig()
        .withStartDate(getYesterdayDate())
        .withScheduleInterval(scheduleInterval);
  }

  private IngestionPipeline getIngestionPipeline(
      IngestionPipelineRepository repository,
      PipelineType pipelineType,
      ServiceEntityInterface service,
      String displayName) {
    for (String ingestionPipelineStr :
        repository.listAllByParentFqn(service.getFullyQualifiedName())) {
      IngestionPipeline ingestionPipeline =
          JsonUtils.readOrConvertValue(ingestionPipelineStr, IngestionPipeline.class);
      if (ingestionPipeline.getPipelineType().equals(pipelineType)
          && ingestionPipeline.getDisplayName().equals(displayName)) {
        OpenMetadataConnection openMetadataServerConnection =
            new OpenMetadataConnectionBuilder(repository.getOpenMetadataApplicationConfig())
                .build();
        return ingestionPipeline
            .withService(service.getEntityReference())
            .withOpenMetadataServerConnection(openMetadataServerConnection);
      }
    }
    return null;
  }

  private Map<String, FilterPattern> getServiceDefaultFilters(ServiceEntityInterface service) {
    Map<String, FilterPattern> defaultFilters = new HashMap<>();

    String entityType = Entity.getEntityTypeFromObject(service);
    Map<String, Object> serviceConfig = JsonUtils.getMap(service.getConnection().getConfig());

    for (Map.Entry<String, Object> configEntry : serviceConfig.entrySet()) {
      String configKey = configEntry.getKey();
      if (SERVICE_FILTERS_MAP.get(entityType).contains(configKey)) {
        defaultFilters.put(
            configKey, JsonUtils.readOrConvertValue(configEntry.getValue(), FilterPattern.class));
      }
    }

    return defaultFilters;
  }

  private Object getSourceConfig(PipelineType pipelineType, ServiceEntityInterface service) {
    String entityType = Entity.getEntityTypeFromObject(service);
    Map<String, FilterPattern> serviceDefaultFilters = getServiceDefaultFilters(service);
    if (entityType.equals(DATABASE_SERVICE)) {
      return DATABASE_PIPELINE_MAP.get(pipelineType).apply(serviceDefaultFilters);
    } else if (pipelineType.equals(PipelineType.METADATA)) {
      return SERVICE_TO_PIPELINE_MAP.get(entityType).apply(serviceDefaultFilters);
    } else {
      return null;
    }
  }

  private Date getYesterdayDate() {
    return Date.from(
        LocalDate.now(ZoneOffset.UTC).minusDays(1).atStartOfDay(ZoneId.of("UTC")).toInstant());
  }

  // Database Pipelines
  private static DatabaseServiceMetadataPipeline getDatabaseServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new DatabaseServiceMetadataPipeline()
        .withDatabaseFilterPattern(defaultFilters.get(DATABASE_FILTER_PATTERN))
        .withSchemaFilterPattern(defaultFilters.get(SCHEMA_FILTER_PATTERN))
        .withTableFilterPattern(defaultFilters.get(TABLE_FILTER_PATTERN));
  }

  private static DatabaseServiceQueryUsagePipeline getDatabaseServiceQueryUsagePipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new DatabaseServiceQueryUsagePipeline();
  }

  private static DatabaseServiceQueryLineagePipeline getDatabaseServiceQueryLineagePipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new DatabaseServiceQueryLineagePipeline()
        .withDatabaseFilterPattern(defaultFilters.get(DATABASE_FILTER_PATTERN))
        .withSchemaFilterPattern(defaultFilters.get(SCHEMA_FILTER_PATTERN))
        .withTableFilterPattern(defaultFilters.get(TABLE_FILTER_PATTERN));
  }

  private static DatabaseServiceProfilerPipeline getDatabaseServiceProfilerPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new DatabaseServiceProfilerPipeline()
        .withDatabaseFilterPattern(defaultFilters.get(DATABASE_FILTER_PATTERN))
        .withSchemaFilterPattern(defaultFilters.get(SCHEMA_FILTER_PATTERN))
        .withTableFilterPattern(defaultFilters.get(TABLE_FILTER_PATTERN))
        .withClassificationFilterPattern(
            new FilterPattern().withIncludes(DEFAULT_TIERS_TO_PROCESS));
  }

  private static DatabaseServiceAutoClassificationPipeline
      getDatabaseServiceAutoClassificationPipeline(Map<String, FilterPattern> defaultFilters) {
    return new DatabaseServiceAutoClassificationPipeline()
        .withDatabaseFilterPattern(defaultFilters.get(DATABASE_FILTER_PATTERN))
        .withSchemaFilterPattern(defaultFilters.get(SCHEMA_FILTER_PATTERN))
        .withTableFilterPattern(defaultFilters.get(TABLE_FILTER_PATTERN))
        .withEnableAutoClassification(true)
        .withStoreSampleData(false);
  }

  // Other Services Metadata Pipelines
  private static MessagingServiceMetadataPipeline getMessagingServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new MessagingServiceMetadataPipeline()
        .withTopicFilterPattern(defaultFilters.get(TOPIC_FILTER_PATTERN));
  }

  private static DashboardServiceMetadataPipeline getDashboardServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new DashboardServiceMetadataPipeline()
        .withDashboardFilterPattern(defaultFilters.get(DASHBOARD_FILTER_PATTERN))
        .withChartFilterPattern(defaultFilters.get(CHART_FILTER_PATTERN))
        .withDataModelFilterPattern(defaultFilters.get(DATA_MODEL_FILTER_PATTERN))
        .withProjectFilterPattern(defaultFilters.get(PROJECT_FILTER_PATTERN));
  }

  private static PipelineServiceMetadataPipeline getPipelineServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new PipelineServiceMetadataPipeline()
        .withPipelineFilterPattern(defaultFilters.get(PIPELINE_FILTER_PATTERN));
  }

  private static MlmodelServiceMetadataPipeline getMlmodelServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new MlmodelServiceMetadataPipeline()
        .withMlModelFilterPattern(defaultFilters.get(ML_MODEL_FILTER_PATTERN));
  }

  private static StorageServiceMetadataPipeline getStorageServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new StorageServiceMetadataPipeline()
        .withContainerFilterPattern(defaultFilters.get(CONTAINER_FILTER_PATTERN));
  }

  private static SearchServiceMetadataPipeline getSearchServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new SearchServiceMetadataPipeline()
        .withSearchIndexFilterPattern(defaultFilters.get(SEARCH_INDEX_FILTER_PATTERN));
  }

  private static ApiServiceMetadataPipeline getApiServiceMetadataPipeline(
      Map<String, FilterPattern> defaultFilters) {
    return new ApiServiceMetadataPipeline()
        .withApiCollectionFilterPattern(defaultFilters.get(API_COLLECTION_FILTER_PATTERN));
  }

  @Getter
  public static class CreateIngestionPipelineResult {
    private final UUID ingestionPipelineId;
    private final boolean successful;

    public CreateIngestionPipelineResult(UUID ingestionPipelineId, boolean wasSuccessful) {
      this.ingestionPipelineId = ingestionPipelineId;
      this.successful = wasSuccessful;
    }
  }
}
