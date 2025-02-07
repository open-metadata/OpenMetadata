package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.Entity.API_SERVICE;
import static org.openmetadata.service.Entity.DASHBOARD_SERVICE;
import static org.openmetadata.service.Entity.DATABASE_SERVICE;
import static org.openmetadata.service.Entity.MESSAGING_SERVICE;
import static org.openmetadata.service.Entity.METADATA_SERVICE;
import static org.openmetadata.service.Entity.MLMODEL_SERVICE;
import static org.openmetadata.service.Entity.PIPELINE_SERVICE;
import static org.openmetadata.service.Entity.SEARCH_SERVICE;
import static org.openmetadata.service.Entity.STORAGE_SERVICE;
import static org.openmetadata.service.governance.workflows.Workflow.INGESTION_PIPELINE_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.util.JsonUtils;

public class CreateIngestionPipelineImpl implements JavaDelegate {
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

  private Expression pipelineTypeExpr;
  private Expression deployExpr;
  private Expression inputNamespaceMapExpr;
  private Expression ingestionPipelineMapperExpr;
  private Expression pipelineServiceClientExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    Map<String, String> inputNamespaceMap =
        JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
    PipelineType pipelineType =
        PipelineType.fromValue((String) pipelineTypeExpr.getValue(execution));
    boolean deploy = (boolean) deployExpr.getValue(execution);
    IngestionPipelineMapper mapper =
        (IngestionPipelineMapper) ingestionPipelineMapperExpr.getValue(execution);
    PipelineServiceClientInterface pipelineServiceClient =
        (PipelineServiceClientInterface) pipelineServiceClientExpr.getValue(execution);

    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(
            (String)
                varHandler.getNamespacedVariable(
                    inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

    ServiceEntityInterface service = Entity.getEntity(entityLink, "owners", Include.NON_DELETED);

    if (supportsPipelineType(pipelineType, JsonUtils.getMap(service.getConnection().getConfig()))) {
      IngestionPipeline ingestionPipeline = createIngestionPipeline(mapper, pipelineType, service);
      varHandler.setNodeVariable(INGESTION_PIPELINE_ID_VARIABLE, ingestionPipeline.getId());

      if (deploy) {
        deployPipeline(pipelineServiceClient, ingestionPipeline, service);
      }
    }
  }

  private boolean supportsPipelineType(
      PipelineType pipelineType, Map<String, Object> connectionConfig) {
    return Optional.ofNullable(connectionConfig.get(SUPPORT_FEATURE_MAP.get(pipelineType)))
        .map(supports -> (boolean) supports)
        .orElse(false);
  }

  private void deployPipeline(
      PipelineServiceClientInterface pipelineServiceClient,
      IngestionPipeline ingestionPipeline,
      ServiceEntityInterface service) {
    pipelineServiceClient.deployPipeline(ingestionPipeline, service);
  }

  private IngestionPipeline createIngestionPipeline(
      IngestionPipelineMapper mapper, PipelineType pipelineType, ServiceEntityInterface service) {
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline create =
        new org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline()
            .withAirflowConfig(new AirflowConfig().withStartDate(getYesterdayDate()))
            .withLoggerLevel(LogLevels.INFO)
            .withName(UUID.randomUUID().toString())
            .withDisplayName(String.format("%s-metadata", service.getName()))
            .withOwners(service.getOwners())
            .withPipelineType(pipelineType)
            .withService(service.getEntityReference())
            .withSourceConfig(
                new SourceConfig().withConfig(getSourceConfig(pipelineType, service)));
    IngestionPipeline ingestionPipeline = mapper.createToEntity(create, "governance-bot");

    return repository.create(null, ingestionPipeline);
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
}
