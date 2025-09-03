package org.openmetadata.service.apps.managers;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.MetadataServiceRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class InstallManager {

  private static final String SERVICE_NAME = "OpenMetadata";
  private final CollectionDAO collectionDAO;
  private final AppRepository appRepository;
  private final AppMarketPlaceRepository appMarketPlaceRepository;
  private final EventSubscriptionRepository eventSubscriptionRepository;

  public InstallManager(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
    this.appRepository = new AppRepository();
    this.appMarketPlaceRepository = new AppMarketPlaceRepository();
    this.eventSubscriptionRepository = new EventSubscriptionRepository();
  }

  public void installEventSubscriptions(App app, String installedBy) {
    List<EntityReference> eventSubscriptionsReferences =
        AppBoundConfigurationUtil.getEventSubscriptions(app);

    // Link existing event subscriptions to the app
    for (EntityReference eventSubRef : eventSubscriptionsReferences) {
      EventSubscription existingEventSub =
          eventSubscriptionRepository.findByNameOrNull(eventSubRef.getName(), Include.ALL);

      if (existingEventSub != null) {
        // Link the existing event subscription to the app
        appRepository.addEventSubscription(app, existingEventSub);

        try {
          EventSubscriptionScheduler.getInstance().addSubscriptionPublisher(existingEventSub, true);
        } catch (Exception e) {
          LOG.error(
              "Failed to add subscription publisher for event subscription: {}",
              existingEventSub.getName(),
              e);
        }
      } else {
        LOG.warn(
            "Event subscription '{}' referenced by app '{}' not found",
            eventSubRef.getName(),
            app.getName());
      }
    }
  }

  public IngestionPipeline createAndBindIngestionPipeline(App app, Map<String, Object> config) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    MetadataServiceRepository serviceEntityRepository =
        (MetadataServiceRepository) Entity.getEntityRepository(Entity.METADATA_SERVICE);
    EntityReference service =
        serviceEntityRepository
            .getByName(null, SERVICE_NAME, serviceEntityRepository.getFields("id"))
            .getEntityReference();

    CreateIngestionPipeline createPipelineRequest =
        new CreateIngestionPipeline()
            .withName(app.getName())
            .withDisplayName(app.getDisplayName())
            .withDescription(app.getDescription())
            .withPipelineType(PipelineType.APPLICATION)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new ApplicationPipeline()
                            .withSourcePythonClass(app.getSourcePythonClass())
                            .withAppConfig(config)
                            .withAppPrivateConfig(
                                AppBoundConfigurationUtil.getPrivateConfiguration(app))))
            .withAirflowConfig(
                new AirflowConfig()
                    .withScheduleInterval(
                        AppBoundConfigurationUtil.getAppSchedule(app).getCronExpression()))
            .withService(service);

    IngestionPipeline ingestionPipeline =
        getIngestionPipeline(createPipelineRequest, String.format("%sBot", app.getName()), "admin")
            .withProvider(ProviderType.USER);

    ingestionPipelineRepository.setFullyQualifiedName(ingestionPipeline);
    ingestionPipelineRepository.initializeEntity(ingestionPipeline);

    bindIngestionPipelineToApplication(app, ingestionPipeline);
    return ingestionPipeline;
  }

  public IngestionPipeline createAndBindServiceIngestionPipeline(
      App app,
      org.openmetadata.schema.entity.app.ServiceAppConfiguration serviceConfig,
      Map<String, Object> config) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    // Use the actual service reference from serviceConfig instead of hardcoded METADATA service
    EntityReference serviceReference = serviceConfig.getServiceRef();
    if (serviceReference == null) {
      // Fallback to OpenMetadata service if no service reference is provided
      MetadataServiceRepository serviceEntityRepository =
          (MetadataServiceRepository) Entity.getEntityRepository(Entity.METADATA_SERVICE);
      serviceReference =
          serviceEntityRepository
              .getByName(null, SERVICE_NAME, serviceEntityRepository.getFields("id"))
              .getEntityReference();
    }

    String serviceId = serviceConfig.getServiceRef().getId().toString();
    String pipelineName = String.format("%s_%s", app.getName(), serviceId);

    CreateIngestionPipeline createPipelineRequest =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withDisplayName(
                String.format(
                    "%s for Service %s",
                    app.getDisplayName(), serviceConfig.getServiceRef().getName()))
            .withDescription(
                String.format(
                    "%s bound to service %s",
                    app.getDescription(), serviceConfig.getServiceRef().getName()))
            .withPipelineType(PipelineType.APPLICATION)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new ApplicationPipeline()
                            .withSourcePythonClass(app.getSourcePythonClass())
                            .withAppConfig(config)
                            .withAppPrivateConfig(serviceConfig.getPrivateConfig())))
            .withAirflowConfig(
                new AirflowConfig()
                    .withScheduleInterval(serviceConfig.getSchedule().getCronExpression()))
            .withService(serviceReference);

    IngestionPipeline ingestionPipeline =
        getIngestionPipeline(createPipelineRequest, String.format("%sBot", app.getName()), "admin")
            .withProvider(ProviderType.USER);

    ingestionPipelineRepository.setFullyQualifiedName(ingestionPipeline);
    ingestionPipelineRepository.initializeEntity(ingestionPipeline);

    bindIngestionPipelineToApplication(app, ingestionPipeline);
    return ingestionPipeline;
  }

  public void bindExistingIngestionToApplication(App app) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    String fqn = FullyQualifiedName.add(SERVICE_NAME, app.getName());
    IngestionPipeline storedPipeline =
        ingestionPipelineRepository.getByName(
            null, fqn, ingestionPipelineRepository.getFields("id"));

    List<CollectionDAO.EntityRelationshipRecord> records =
        collectionDAO
            .relationshipDAO()
            .findTo(
                app.getId(),
                Entity.APPLICATION,
                Relationship.HAS.ordinal(),
                Entity.INGESTION_PIPELINE);

    if (records.isEmpty()) {
      bindIngestionPipelineToApplication(app, storedPipeline);
    }
  }

  public void bindExistingServiceIngestionToApplication(App app, String pipelineName) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    String fqn = FullyQualifiedName.add(SERVICE_NAME, pipelineName);
    IngestionPipeline storedPipeline =
        ingestionPipelineRepository.getByName(
            null, fqn, ingestionPipelineRepository.getFields("id"));

    List<CollectionDAO.EntityRelationshipRecord> records =
        collectionDAO
            .relationshipDAO()
            .findTo(
                app.getId(),
                Entity.APPLICATION,
                Relationship.HAS.ordinal(),
                Entity.INGESTION_PIPELINE);

    boolean relationshipExists =
        records.stream().anyMatch(record -> record.getId().equals(storedPipeline.getId()));

    if (!relationshipExists) {
      bindIngestionPipelineToApplication(app, storedPipeline);
    }
  }

  private void bindIngestionPipelineToApplication(App app, IngestionPipeline pipeline) {
    collectionDAO
        .relationshipDAO()
        .insert(
            app.getId(),
            pipeline.getId(),
            Entity.APPLICATION,
            Entity.INGESTION_PIPELINE,
            Relationship.HAS.ordinal());

    // Also set the pipeline reference in the appropriate app configuration
    EntityReference pipelineRef = pipeline.getEntityReference();

    if (AppBoundConfigurationUtil.isGlobalApp(app)) {
      AppBoundConfigurationUtil.setPipeline(app, pipelineRef);
    } else if (AppBoundConfigurationUtil.isServiceBoundApp(app)) {
      // Extract service ID from pipeline name for service-bound apps
      String pipelineName = pipeline.getName();
      if (pipelineName.contains("_")) {
        String[] parts = pipelineName.split("_");
        if (parts.length >= 2) {
          try {
            String serviceId = parts[parts.length - 1];
            UUID serviceUuid = UUID.fromString(serviceId);
            AppBoundConfigurationUtil.setPipeline(app, serviceUuid, pipelineRef);
          } catch (IllegalArgumentException e) {
            LOG.warn("Could not extract service ID from pipeline name: {}", pipelineName, e);
          }
        }
      }
    }
  }

  private IngestionPipeline getIngestionPipeline(
      CreateIngestionPipeline create, String botName, String user) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(
                ingestionPipelineRepository.getOpenMetadataApplicationConfig(), botName)
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
}
