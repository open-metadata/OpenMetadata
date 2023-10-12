package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.service.resources.services.metadata.MetadataServiceResource.OPENMETADATA_SERVICE;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.MetadataToElasticSearchPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.MetadataServiceRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class DataInsightsApp extends AbstractNativeApplication {
  private static final String DEFAULT_INSIGHT_PIPELINE = "OpenMetadata_dataInsight";

  @Override
  public void init(App app, CollectionDAO dao, SearchRepository searchRepository) {
    super.init(app, dao, searchRepository);

    List<CollectionDAO.EntityRelationshipRecord> records =
        collectionDAO
            .relationshipDAO()
            .findTo(app.getId(), Entity.APPLICATION, Relationship.CONTAINS.ordinal(), Entity.INGESTION_PIPELINE);
    if (!records.isEmpty()) {
      return;
    }

    try {
      MetadataServiceRepository metadataServiceRepository =
          (MetadataServiceRepository) Entity.getServiceEntityRepository(ServiceType.METADATA);
      IngestionPipelineRepository ingestionPipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

      MetadataService omService =
          metadataServiceRepository.getByName(null, OPENMETADATA_SERVICE, metadataServiceRepository.getFields("id"));
      // Create Data Insights Pipeline
      CreateIngestionPipeline createPipelineRequest =
          new CreateIngestionPipeline()
              .withName(DEFAULT_INSIGHT_PIPELINE)
              .withDisplayName(DEFAULT_INSIGHT_PIPELINE)
              .withDescription("Data Insights Pipeline")
              .withPipelineType(PipelineType.DATA_INSIGHT)
              .withSourceConfig(
                  new SourceConfig()
                      .withConfig(
                          new MetadataToElasticSearchPipeline()
                              .withType(
                                  MetadataToElasticSearchPipeline.MetadataToESConfigType.METADATA_TO_ELASTIC_SEARCH)))
              .withAirflowConfig(getDefaultAirflowConfig())
              .withService(omService.getEntityReference());
      // Get Pipeline
      IngestionPipeline dataInsightPipeline =
          getIngestionPipeline(createPipelineRequest, String.format("%sBot", app.getName()), "admin")
              .withProvider(ProviderType.SYSTEM);
      ingestionPipelineRepository.setFullyQualifiedName(dataInsightPipeline);
      ingestionPipelineRepository.initializeEntity(dataInsightPipeline);

      // Add Ingestion Pipeline to Application
      collectionDAO
          .relationshipDAO()
          .insert(
              app.getId(),
              dataInsightPipeline.getId(),
              Entity.APPLICATION,
              Entity.INGESTION_PIPELINE,
              Relationship.CONTAINS.ordinal());
    } catch (Exception ex) {
      LOG.error("[IngestionPipelineResource] Failed in Creating Reindex and Insight Pipeline", ex);
      LOG.error("Failed to initialize DataInsightApp", ex);
      throw new RuntimeException(ex);
    }
  }

  private IngestionPipeline getIngestionPipeline(CreateIngestionPipeline create, String botname, String user) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(ingestionPipelineRepository.getOpenMetadataApplicationConfig(), botname)
            .build();
    return ingestionPipelineRepository
        .copy(new IngestionPipeline(), create, user)
        .withPipelineType(create.getPipelineType())
        .withAirflowConfig(create.getAirflowConfig())
        .withOpenMetadataServerConnection(openMetadataServerConnection)
        .withSourceConfig(create.getSourceConfig())
        .withLoggerLevel(create.getLoggerLevel())
        .withService(create.getService());
  }

  public static AirflowConfig getDefaultAirflowConfig() {
    return new AirflowConfig()
        .withPausePipeline(false)
        .withConcurrency(1)
        .withPipelineTimezone("UTC")
        .withRetries(3)
        .withRetryDelay(300)
        .withPipelineCatchup(false)
        .withScheduleInterval("0 0 * * *")
        .withMaxActiveRuns(1)
        .withWorkflowDefaultView("tree")
        .withWorkflowDefaultViewOrientation("LR");
  }
}
