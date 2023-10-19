package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.COLLECTION_DAO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.SEARCH_CLIENT_KEY;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_APP_TYPE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.LIVE_APP_SCHEDULE_ERR;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ExternalAppIngestionConfig;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@Slf4j
public class AbstractNativeApplication implements NativeApplication {
  protected CollectionDAO collectionDAO;
  private App app;
  protected SearchRepository searchRepository;

  @Override
  public void init(App app, CollectionDAO dao, SearchRepository searchRepository) {
    this.collectionDAO = dao;
    this.searchRepository = searchRepository;
    this.app = app;
  }

  @Override
  public void triggerOnDemand() {
    // Validate Native Application
    if (app.getScheduleType().equals(ScheduleType.Scheduled)) {
      AppRuntime runtime = getAppRuntime(app);
      validateServerExecutableApp(runtime);
      // Trigger the application
      AppScheduler.getInstance().triggerOnDemandApplication(app);
    } else {
      throw new IllegalArgumentException(LIVE_APP_SCHEDULE_ERR);
    }
  }

  @Override
  public void scheduleInternal() {
    // Validate Native Application
    if (app.getAppType() == AppType.Internal && app.getScheduleType().equals(ScheduleType.Scheduled)) {
      AppRuntime runtime = JsonUtils.convertValue(app.getRuntime(), ScheduledExecutionContext.class);
      validateServerExecutableApp(runtime);
      // Schedule New Application Run
      AppScheduler.getInstance().addApplicationSchedule(app);
      return;
    }
    throw new IllegalArgumentException(INVALID_APP_TYPE);
  }

  @Override
  public void initializeExternalApp() {
    if (app.getAppType() == AppType.External && app.getScheduleType().equals(ScheduleType.Scheduled)) {
      // Init Application Code for Some Initialization
      List<CollectionDAO.EntityRelationshipRecord> records =
          collectionDAO
              .relationshipDAO()
              .findTo(app.getId(), Entity.APPLICATION, Relationship.CONTAINS.ordinal(), Entity.INGESTION_PIPELINE);
      if (!records.isEmpty()) {
        return;
      }

      try {
        ExternalAppIngestionConfig ingestionConfig =
            JsonUtils.convertValue(app.getAppConfiguration(), ExternalAppIngestionConfig.class);

        IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
        EntityRepository<?> serviceRepository =
            Entity.getServiceEntityRepository(ServiceType.fromValue(ingestionConfig.getService().getType()));
        EntityReference service =
            serviceRepository
                .getByName(null, ingestionConfig.getService().getName(), serviceRepository.getFields("id"))
                .getEntityReference();

        CreateIngestionPipeline createPipelineRequest =
            new CreateIngestionPipeline()
                .withName(ingestionConfig.getName())
                .withDisplayName(ingestionConfig.getDisplayName())
                .withDescription(ingestionConfig.getDescription())
                .withPipelineType(ingestionConfig.getPipelineType())
                .withSourceConfig(ingestionConfig.getSourceConfig())
                .withAirflowConfig(ingestionConfig.getAirflowConfig())
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
                Relationship.CONTAINS.ordinal());

      } catch (Exception ex) {
        LOG.error("[IngestionPipelineResource] Failed in Creating Reindex and Insight Pipeline", ex);
        LOG.error("Failed to initialize DataInsightApp", ex);
        throw new RuntimeException(ex);
      }

      return;
    }
    throw new IllegalArgumentException(INVALID_APP_TYPE);
  }

  protected void validateServerExecutableApp(AppRuntime context) {
    // Server apps are native
    if (!app.getAppType().equals(AppType.Internal)) {
      throw new IllegalArgumentException(
          "Application cannot be executed internally in Server. Please check if the App supports internal Server Execution.");
    }

    // Check OnDemand Execution is supported
    if (!(context != null && Boolean.TRUE.equals(context.getEnabled()))) {
      throw new IllegalArgumentException(
          "Applications does not support on demand execution or the context is not Internal.");
    }
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
    // This is the part of the code that is executed by the scheduler
    App jobApp = (App) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_INFO_KEY);
    CollectionDAO dao = (CollectionDAO) jobExecutionContext.getJobDetail().getJobDataMap().get(COLLECTION_DAO_KEY);
    SearchRepository searchRepositoryForJob =
        (SearchRepository) jobExecutionContext.getJobDetail().getJobDataMap().get(SEARCH_CLIENT_KEY);
    // Initialise the Application
    this.init(jobApp, dao, searchRepositoryForJob);

    // Trigger
    this.startApp(jobExecutionContext);
  }

  public static AppRuntime getAppRuntime(App app) {
    return JsonUtils.convertValue(app.getRuntime(), ScheduledExecutionContext.class);
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
}
