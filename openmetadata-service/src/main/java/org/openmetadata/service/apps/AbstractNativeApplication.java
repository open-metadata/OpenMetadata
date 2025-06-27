package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.JOB_LISTENER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.NO_MANUAL_TRIGGER_ERR;
import static org.openmetadata.service.resources.apps.AppResource.SCHEDULED_TYPES;

import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.MetadataServiceRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.JobExecutionContext;
import org.quartz.SchedulerException;
import org.quartz.UnableToInterruptJobException;

@Getter
@Slf4j
public class AbstractNativeApplication implements NativeApplication {
  protected CollectionDAO collectionDAO;
  private App app;
  protected SearchRepository searchRepository;

  // Default service that contains external apps' Ingestion Pipelines
  private static final String SERVICE_NAME = "OpenMetadata";

  public AbstractNativeApplication(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  public void init(App app) {
    this.app = app;
    ApplicationContext.getInstance().registerApp(this);
  }

  @Override
  public void install(String installedBy) {
    // If the app does not have any Schedule Return without scheduling
    if (Boolean.TRUE.equals(app.getDeleted())
        || (app.getAppSchedule() == null)
        || Set.of(ScheduleType.NoSchedule, ScheduleType.OnlyManual)
            .contains(app.getScheduleType())) {
      LOG.debug("App {} does not support scheduling.", app.getName());
    } else if (app.getAppType().equals(AppType.Internal)
        && (SCHEDULED_TYPES.contains(app.getScheduleType()))) {
      try {
        ApplicationHandler.getInstance().removeOldJobs(app);
        ApplicationHandler.getInstance().migrateQuartzConfig(app);
        ApplicationHandler.getInstance().fixCorruptedInstallation(app);
      } catch (SchedulerException e) {
        throw AppException.byMessage(
            "ApplicationHandler",
            "SchedulerError",
            "Error while migrating application configuration: " + app.getName());
      }
      scheduleInternal();
    } else if (app.getAppType() == AppType.External
        && (SCHEDULED_TYPES.contains(app.getScheduleType()))) {
      scheduleExternal(installedBy);
    }
  }

  @Override
  public void uninstall() {
    ApplicationContext.getInstance().unregisterApp(this);
  }

  @Override
  public void triggerOnDemand() {
    triggerOnDemand(null);
  }

  @Override
  public void triggerOnDemand(Map<String, Object> config) {
    // Validate Native Application
    if (Set.of(ScheduleType.ScheduledOrManual, ScheduleType.OnlyManual)
        .contains(app.getScheduleType())) {
      AppRuntime runtime = getAppRuntime(app);
      validateServerExecutableApp(runtime);
      // Trigger the application with the provided configuration payload
      Map<String, Object> appConfig = JsonUtils.getMap(app.getAppConfiguration());
      if (config != null) {
        appConfig.putAll(config);
      }
      validateConfig(appConfig);
      AppScheduler.getInstance().triggerOnDemandApplication(app, config);
    } else {
      throw new IllegalArgumentException(NO_MANUAL_TRIGGER_ERR);
    }
  }

  /**
   * Validate the configuration of the application. This method is called before the application is
   * triggered.
   * @param config
   */
  protected void validateConfig(Map<String, Object> config) {
    LOG.warn("validateConfig is not implemented for this application. Skipping validation.");
  }

  public void scheduleInternal() {
    // Validate Native Application
    AppRuntime runtime = JsonUtils.convertValue(app.getRuntime(), ScheduledExecutionContext.class);
    validateServerExecutableApp(runtime);
    // Schedule New Application Run
    AppScheduler.getInstance().scheduleApplication(app);
  }

  public void scheduleExternal(String updatedBy) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    try {
      bindExistingIngestionToApplication(ingestionPipelineRepository);
      updateAppConfig(
          ingestionPipelineRepository,
          JsonUtils.getMap(this.getApp().getAppConfiguration()),
          updatedBy);
    } catch (EntityNotFoundException ex) {
      Map<String, Object> config = JsonUtils.getMap(this.getApp().getAppConfiguration());
      createAndBindIngestionPipeline(ingestionPipelineRepository, config);
    }
  }

  private void bindExistingIngestionToApplication(
      IngestionPipelineRepository ingestionPipelineRepository) {
    String fqn = FullyQualifiedName.add(SERVICE_NAME, this.getApp().getName());
    IngestionPipeline storedPipeline =
        ingestionPipelineRepository.getByName(
            null, fqn, ingestionPipelineRepository.getFields("id"));

    // Init Application Code for Some Initialization
    List<CollectionDAO.EntityRelationshipRecord> records =
        collectionDAO
            .relationshipDAO()
            .findTo(
                this.getApp().getId(),
                Entity.APPLICATION,
                Relationship.HAS.ordinal(),
                Entity.INGESTION_PIPELINE);

    if (records.isEmpty()) {
      // Add Ingestion Pipeline to Application
      collectionDAO
          .relationshipDAO()
          .insert(
              this.getApp().getId(),
              storedPipeline.getId(),
              Entity.APPLICATION,
              Entity.INGESTION_PIPELINE,
              Relationship.HAS.ordinal());
    }
  }

  private void updateAppConfig(
      IngestionPipelineRepository repository,
      Map<String, Object> appConfiguration,
      String updatedBy) {
    String fqn = FullyQualifiedName.add(SERVICE_NAME, this.getApp().getName());
    IngestionPipeline updated = repository.findByName(fqn, Include.NON_DELETED);
    ApplicationPipeline appPipeline =
        JsonUtils.convertValue(updated.getSourceConfig().getConfig(), ApplicationPipeline.class);
    IngestionPipeline original = JsonUtils.deepCopy(updated, IngestionPipeline.class);
    updated.setSourceConfig(
        updated.getSourceConfig().withConfig(appPipeline.withAppConfig(appConfiguration)));
    repository.update(null, original, updated, updatedBy);
  }

  private void createAndBindIngestionPipeline(
      IngestionPipelineRepository ingestionPipelineRepository, Map<String, Object> config) {
    MetadataServiceRepository serviceEntityRepository =
        (MetadataServiceRepository) Entity.getEntityRepository(Entity.METADATA_SERVICE);
    EntityReference service =
        serviceEntityRepository
            .getByName(null, SERVICE_NAME, serviceEntityRepository.getFields("id"))
            .getEntityReference();

    CreateIngestionPipeline createPipelineRequest =
        new CreateIngestionPipeline()
            .withName(this.getApp().getName())
            .withDisplayName(this.getApp().getDisplayName())
            .withDescription(this.getApp().getDescription())
            .withPipelineType(PipelineType.APPLICATION)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new ApplicationPipeline()
                            .withSourcePythonClass(this.getApp().getSourcePythonClass())
                            .withAppConfig(config)
                            .withAppPrivateConfig(this.getApp().getPrivateConfiguration())))
            .withAirflowConfig(
                new AirflowConfig()
                    .withScheduleInterval(this.getApp().getAppSchedule().getCronExpression()))
            .withService(service);

    // Get Pipeline
    IngestionPipeline ingestionPipeline =
        getIngestionPipeline(
                createPipelineRequest, String.format("%sBot", this.getApp().getName()), "admin")
            .withProvider(ProviderType.USER);
    ingestionPipelineRepository.setFullyQualifiedName(ingestionPipeline);
    ingestionPipelineRepository.initializeEntity(ingestionPipeline);

    // Add Ingestion Pipeline to Application
    collectionDAO
        .relationshipDAO()
        .insert(
            this.getApp().getId(),
            ingestionPipeline.getId(),
            Entity.APPLICATION,
            Entity.INGESTION_PIPELINE,
            Relationship.HAS.ordinal());
  }

  @Override
  public void cleanup() {
    /* Not needed by default*/
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
  public void execute(JobExecutionContext jobExecutionContext) {
    // This is the part of the code that is executed by the scheduler
    String appName = (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_NAME);
    App jobApp = collectionDAO.applicationDAO().findEntityByName(appName);
    ApplicationHandler.getInstance().setAppRuntimeProperties(jobApp);
    jobApp.setAppConfiguration(
        JsonUtils.getMapFromJson(
            (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG)));
    // Initialise the Application
    this.init(jobApp);

    // Trigger
    this.startApp(jobExecutionContext);
  }

  @Override
  public void configure() {
    /* Not needed by default */
  }

  @Override
  public void raisePreviewMessage(App app) {
    throw AppException.byMessage(
        app.getName(),
        "Preview",
        "App is in Preview Mode. Enable it from the server configuration.");
  }

  public static AppRuntime getAppRuntime(App app) {
    return JsonUtils.convertValue(app.getRuntime(), ScheduledExecutionContext.class);
  }

  protected IngestionPipeline getIngestionPipeline(
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

  private OmAppJobListener getJobListener(JobExecutionContext jobExecutionContext)
      throws SchedulerException {
    return (OmAppJobListener)
        jobExecutionContext.getScheduler().getListenerManager().getJobListener(JOB_LISTENER_NAME);
  }

  @SneakyThrows
  protected AppRunRecord getJobRecord(JobExecutionContext jobExecutionContext) {
    OmAppJobListener listener = getJobListener(jobExecutionContext);
    return listener.getAppRunRecordForJob(jobExecutionContext);
  }

  @SneakyThrows
  protected void pushAppStatusUpdates(
      JobExecutionContext jobExecutionContext, AppRunRecord appRecord, boolean update) {
    OmAppJobListener listener = getJobListener(jobExecutionContext);
    listener.pushApplicationStatusUpdates(jobExecutionContext, appRecord, update);
  }

  @Override
  public void interrupt() throws UnableToInterruptJobException {
    LOG.info("Interrupting the job for app: {}", this.app.getName());
    stop();
  }

  protected void stop() {
    LOG.info("Default stop behavior for app: {}", this.app.getName());
    // Default implementation: no-op or generic cleanup logic
  }
}
