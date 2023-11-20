package org.openmetadata.service.apps;

import static com.cronutils.model.CronType.QUARTZ;
import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.JOB_LISTENER_NAME;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.COLLECTION_DAO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.SEARCH_CLIENT_KEY;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_APP_TYPE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.LIVE_APP_SCHEDULE_ERR;

import com.cronutils.mapper.CronMapper;
import com.cronutils.model.Cron;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.parser.CronParser;
import java.util.List;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
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
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.JobExecutionContext;
import org.quartz.SchedulerException;

@Slf4j
public class AbstractNativeApplication implements NativeApplication {
  protected CollectionDAO collectionDAO;
  private @Getter App app;
  protected SearchRepository searchRepository;
  private final @Getter CronMapper cronMapper = CronMapper.fromQuartzToUnix();
  private final @Getter CronParser cronParser = new CronParser(CronDefinitionBuilder.instanceDefinitionFor(QUARTZ));

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
      IngestionPipelineRepository ingestionPipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      ExternalAppIngestionConfig ingestionConfig =
          JsonUtils.convertValue(app.getAppConfiguration(), ExternalAppIngestionConfig.class);

      try {
        // Check if the Pipeline Already Exists
        String fqn = FullyQualifiedName.add(ingestionConfig.getService().getName(), ingestionConfig.getName());
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
      } catch (EntityNotFoundException ex) {
        // Pipeline needs to be created
        EntityRepository<?> serviceRepository =
            Entity.getServiceEntityRepository(ServiceType.fromValue(ingestionConfig.getService().getType()));
        EntityReference service =
            serviceRepository
                .getByName(null, ingestionConfig.getService().getName(), serviceRepository.getFields("id"))
                .getEntityReference();

        Cron quartzCron = cronParser.parse(app.getAppSchedule().getCronExpression());

        CreateIngestionPipeline createPipelineRequest =
            new CreateIngestionPipeline()
                .withName(ingestionConfig.getName())
                .withDisplayName(ingestionConfig.getDisplayName())
                .withDescription(ingestionConfig.getDescription())
                .withPipelineType(ingestionConfig.getPipelineType())
                .withSourceConfig(ingestionConfig.getSourceConfig())
                .withAirflowConfig(
                    ingestionConfig.getAirflowConfig().withScheduleInterval(cronMapper.map(quartzCron).asString()))
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
    } else {
      throw new IllegalArgumentException(INVALID_APP_TYPE);
    }
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
    App jobApp = (App) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_INFO_KEY);
    CollectionDAO dao = (CollectionDAO) jobExecutionContext.getJobDetail().getJobDataMap().get(COLLECTION_DAO_KEY);
    SearchRepository searchRepositoryForJob =
        (SearchRepository) jobExecutionContext.getJobDetail().getJobDataMap().get(SEARCH_CLIENT_KEY);
    // Initialise the Application
    this.init(jobApp, dao, searchRepositoryForJob);

    // Trigger
    this.startApp(jobExecutionContext);
  }

  @Override
  public void configure() {
    /* Not needed by default */
  }

  public static AppRuntime getAppRuntime(App app) {
    return JsonUtils.convertValue(app.getRuntime(), ScheduledExecutionContext.class);
  }

  protected IngestionPipeline getIngestionPipeline(CreateIngestionPipeline create, String botName, String user) {
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(ingestionPipelineRepository.getOpenMetadataApplicationConfig(), botName)
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

  private OmAppJobListener getJobListener(JobExecutionContext jobExecutionContext) throws SchedulerException {
    return (OmAppJobListener) jobExecutionContext.getScheduler().getListenerManager().getJobListener(JOB_LISTENER_NAME);
  }

  @SneakyThrows
  protected AppRunRecord getJobRecord(JobExecutionContext jobExecutionContext) {
    OmAppJobListener listener = getJobListener(jobExecutionContext);
    return listener.getAppRunRecordForJob(jobExecutionContext);
  }

  @SneakyThrows
  protected void pushAppStatusUpdates(JobExecutionContext jobExecutionContext, AppRunRecord appRecord, boolean update) {
    OmAppJobListener listener = getJobListener(jobExecutionContext);
    listener.pushApplicationStatusUpdates(jobExecutionContext, appRecord, update);
  }
}
