package org.openmetadata.service.apps;

import static com.cronutils.model.CronType.QUARTZ;
import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.JOB_LISTENER_NAME;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.COLLECTION_DAO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.SEARCH_CLIENT_KEY;
import static org.openmetadata.service.exception.CatalogExceptionMessage.INVALID_APP_TYPE;
import static org.openmetadata.service.exception.CatalogExceptionMessage.LIVE_APP_SCHEDULE_ERR;

import com.cronutils.mapper.CronMapper;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.parser.CronParser;
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
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.search.SearchRepository;
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
    // External apps should either use or extend `ExternalApplicationHandler`
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
