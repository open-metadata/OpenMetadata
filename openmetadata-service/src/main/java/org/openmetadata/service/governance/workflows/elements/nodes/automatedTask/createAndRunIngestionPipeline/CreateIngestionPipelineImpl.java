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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.MessagingServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.MlmodelServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.PipelineServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SearchServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class CreateIngestionPipelineImpl {
  private static final Map<PipelineType, String> SUPPORT_FEATURE_MAP = new HashMap<>();

  static {
    SUPPORT_FEATURE_MAP.put(PipelineType.METADATA, "supportsMetadataExtraction");
    SUPPORT_FEATURE_MAP.put(PipelineType.USAGE, "supportsUsageExtraction");
    SUPPORT_FEATURE_MAP.put(PipelineType.LINEAGE, "supportsLineageExtraction");
    SUPPORT_FEATURE_MAP.put(PipelineType.PROFILER, "supportsProfiler");
    SUPPORT_FEATURE_MAP.put(PipelineType.AUTO_CLASSIFICATION, "supportsProfiler");
  }

  private static final Map<PipelineType, Object> DATABASE_PIPELINE_MAP = new HashMap<>();

  static {
    DATABASE_PIPELINE_MAP.put(PipelineType.METADATA, new DatabaseServiceMetadataPipeline());
    DATABASE_PIPELINE_MAP.put(PipelineType.USAGE, new DatabaseServiceQueryUsagePipeline());
    DATABASE_PIPELINE_MAP.put(PipelineType.LINEAGE, new DatabaseServiceQueryLineagePipeline());
    DATABASE_PIPELINE_MAP.put(PipelineType.PROFILER, new DatabaseServiceProfilerPipeline());
    DATABASE_PIPELINE_MAP.put(
        PipelineType.AUTO_CLASSIFICATION, new DatabaseServiceAutoClassificationPipeline());
  }

  private static final Map<String, Object> SERVICE_TO_PIPELINE_MAP = new HashMap<>();

  static {
    SERVICE_TO_PIPELINE_MAP.put(MESSAGING_SERVICE, new MessagingServiceMetadataPipeline());
    SERVICE_TO_PIPELINE_MAP.put(DASHBOARD_SERVICE, new DashboardServiceMetadataPipeline());
    SERVICE_TO_PIPELINE_MAP.put(PIPELINE_SERVICE, new PipelineServiceMetadataPipeline());
    SERVICE_TO_PIPELINE_MAP.put(MLMODEL_SERVICE, new MlmodelServiceMetadataPipeline());
    SERVICE_TO_PIPELINE_MAP.put(METADATA_SERVICE, new DatabaseServiceMetadataPipeline());
    SERVICE_TO_PIPELINE_MAP.put(STORAGE_SERVICE, new StorageServiceMetadataPipeline());
    SERVICE_TO_PIPELINE_MAP.put(SEARCH_SERVICE, new SearchServiceMetadataPipeline());
    SERVICE_TO_PIPELINE_MAP.put(API_SERVICE, new ApiServiceMetadataPipeline());
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
              "Service '%s' does not support Ingestion Pipeline of type '%s'",
              service.getDisplayName(), pipelineType));
      return new CreateIngestionPipelineResult(null, true);
    }

    boolean wasSuccessful = true;

    IngestionPipeline ingestionPipeline = getOrCreateIngestionPipeline(pipelineType, service);

    if (deploy) {
      wasSuccessful = deployPipeline(pipelineServiceClient, ingestionPipeline, service);
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

  private IngestionPipeline getOrCreateIngestionPipeline(
      PipelineType pipelineType, ServiceEntityInterface service) {
    String displayName = String.format("[%s] %s", service.getName(), pipelineType);
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
            .withAirflowConfig(new AirflowConfig().withStartDate(getYesterdayDate()))
            .withLoggerLevel(LogLevels.INFO)
            .withName(UUID.randomUUID().toString())
            .withDisplayName(displayName)
            .withOwners(service.getOwners())
            .withPipelineType(pipelineType)
            .withService(service.getEntityReference())
            .withSourceConfig(
                new SourceConfig().withConfig(getSourceConfig(pipelineType, service)));
    IngestionPipeline ingestionPipeline = mapper.createToEntity(create, "governance-bot");

    return repository.create(null, ingestionPipeline);
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
        return ingestionPipeline.withService(service.getEntityReference());
      }
    }
    return null;
  }

  private Object getSourceConfig(PipelineType pipelineType, ServiceEntityInterface service) {
    String entityType = Entity.getEntityTypeFromObject(service);
    if (entityType.equals(DATABASE_SERVICE)) {
      return DATABASE_PIPELINE_MAP.get(pipelineType);
    } else if (pipelineType.equals(PipelineType.METADATA)) {
      return SERVICE_TO_PIPELINE_MAP.get(entityType);
    } else {
      return null;
    }
  }

  private Date getYesterdayDate() {
    return Date.from(
        LocalDate.now(ZoneOffset.UTC).minusDays(1).atStartOfDay(ZoneId.of("UTC")).toInstant());
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
