package org.openmetadata.service.apps.bundles.pii;

import com.cronutils.model.Cron;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.ExternalApplicationConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.MetadataServiceRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class AutoPIIApplication extends AbstractNativeApplication {

  private static final String INGESTION_PIPELINE_NAME = "autoPIIPipeline";
  private static final String SERVICE_NAME = "OpenMetadata";

  @Override
  public void init(App app, CollectionDAO dao, SearchRepository searchRepository) {
    super.init(app, dao, searchRepository);
    this.app = app;
    LOG.info("Data Insights App is initialized");
  }

  /**
   * MetaPilot is an external App that accepts one ApiKey parameter and runs a workflow based on it.
   *
   * <p>The App will register an IngestionPipeline against the OpenMetadata service with default daily scheduled
   * configurations.
   */
  @Override
  public void initializeExternalApp() {

    ExternalApplicationConfig config =
        JsonUtils.convertValue(app.getAppConfiguration(), ExternalApplicationConfig.class);
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    // Check if the Ingestion Pipeline has already been created
    try {
      String fqn = FullyQualifiedName.add(SERVICE_NAME, INGESTION_PIPELINE_NAME);
      IngestionPipeline storedPipeline =
          ingestionPipelineRepository.getByName(null, fqn, ingestionPipelineRepository.getFields("id"));

      // Init Application Code for Some Initialization
      List<CollectionDAO.EntityRelationshipRecord> records =
          collectionDAO
              .relationshipDAO()
              .findTo(app.getId(), Entity.APPLICATION, Relationship.HAS.ordinal(), Entity.INGESTION_PIPELINE);

      if (records.isEmpty()) {
        // Add Ingestion Pipeline to Application
        collectionDAO
            .relationshipDAO()
            .insert(
                app.getId(),
                storedPipeline.getId(),
                Entity.APPLICATION,
                Entity.INGESTION_PIPELINE,
                Relationship.HAS.ordinal());
      }

      // Otherwise, create it
    } catch (EntityNotFoundException ex) {
      MetadataServiceRepository serviceEntityRepository =
          (MetadataServiceRepository) Entity.getEntityRepository(Entity.METADATA_SERVICE);
      EntityReference service =
          serviceEntityRepository
              .getByName(null, SERVICE_NAME, serviceEntityRepository.getFields("id"))
              .getEntityReference();

      Cron quartzCron = cronParser.parse(app.getAppSchedule().getCronExpression());

      CreateIngestionPipeline createPipelineRequest =
          new CreateIngestionPipeline()
              .withName(INGESTION_PIPELINE_NAME)
              .withDisplayName(app.getDisplayName())
              .withDescription(app.getDescription())
              .withPipelineType(PipelineType.APPLICATION)
              .withSourceConfig(
                  new SourceConfig()
                      .withConfig(
                          new ApplicationPipeline()
                              .withSourcePythonClass(config.getSourcePythonClass())
                              .withAppConfig(config.getConfig())))
              .withAirflowConfig(new AirflowConfig().withScheduleInterval(cronMapper.map(quartzCron).asString()))
              .withService(service);

      // Get Pipeline
      IngestionPipeline dataInsightPipeline =
          getIngestionPipeline(createPipelineRequest, String.format("%sBot", app.getName()), "admin")
              .withProvider(ProviderType.USER);
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
              Relationship.HAS.ordinal());
    }
  }
}
