package org.openmetadata.service.apps.managers;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
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
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
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
    Map<String, EntityReference> eventSubscriptionsReferences =
        AppBoundConfigurationUtil.getEventSubscriptions(app).stream()
            .collect(Collectors.toMap(EntityReference::getName, e -> e));

    eventSubscriptionsReferences.values().stream()
        .map(
            request ->
                Optional.ofNullable(eventSubscriptionsReferences.get(request.getName()))
                    .flatMap(
                        sub ->
                            Optional.ofNullable(
                                eventSubscriptionRepository.findByNameOrNull(
                                    sub.getName(), Include.ALL)))
                    .orElseGet(
                        () -> {
                          EventSubscription createdEventSub =
                              eventSubscriptionRepository.create(
                                  null,
                                  new EventSubscriptionMapper()
                                      .createToEntity(request, installedBy));
                          appRepository.addEventSubscription(app, createdEventSub);
                          return createdEventSub;
                        }))
        .forEach(
            eventSub -> {
              try {
                EventSubscriptionScheduler.getInstance().addSubscriptionPublisher(eventSub, true);
              } catch (Exception e) {
                throw new RuntimeException(e);
              }
            });
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

    MetadataServiceRepository serviceEntityRepository =
        (MetadataServiceRepository) Entity.getEntityRepository(Entity.METADATA_SERVICE);
    EntityReference service =
        serviceEntityRepository
            .getByName(null, SERVICE_NAME, serviceEntityRepository.getFields("id"))
            .getEntityReference();

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
                            .withAppPrivateConfig(serviceConfig.getPrivateConfiguration())))
            .withAirflowConfig(
                new AirflowConfig()
                    .withScheduleInterval(serviceConfig.getAppSchedule().getCronExpression()))
            .withService(service);

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
