package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.JOB_LISTENER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.NO_MANUAL_TRIGGER_ERR;

import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.quartz.JobExecutionContext;
import org.quartz.SchedulerException;

@Getter
@Slf4j
public abstract class AbstractNativeApplicationBase implements NativeApplication {
  protected CollectionDAO collectionDAO;
  private App app;
  protected SearchRepository searchRepository;

  protected AbstractNativeApplicationBase(
      CollectionDAO collectionDAO, SearchRepository searchRepository) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  public void init(App app) {
    this.app = app;
    ApplicationContext.getInstance().registerApp(this);
  }

  @Override
  public void uninstall() {
    ApplicationContext.getInstance().unregisterApp(this);
  }

  @Override
  public void triggerOnDemand(Map<String, Object> config) {
    if (Set.of(ScheduleType.ScheduledOrManual, ScheduleType.OnlyManual)
        .contains(app.getScheduleType())) {
      AppRuntime runtime = getAppRuntime(app);
      validateServerExecutableApp(runtime);

      Map<String, Object> appConfig =
          JsonUtils.getMap(AppBoundConfigurationUtil.getAppConfiguration(app));
      if (config != null) {
        appConfig.putAll(config);
      }
      validateConfig(appConfig);
      triggerApplication(config);
    } else {
      throw new IllegalArgumentException(NO_MANUAL_TRIGGER_ERR);
    }
  }

  protected abstract void triggerApplication(Map<String, Object> config);

  protected void validateConfig(Map<String, Object> config) {
    LOG.warn("validateConfig is not implemented for this application. Skipping validation.");
  }

  @Override
  public void cleanup() {
    // Not needed by default
  }

  protected void validateServerExecutableApp(AppRuntime context) {
    if (!app.getAppType().equals(AppType.Internal)) {
      throw new IllegalArgumentException(
          "Application cannot be executed internally in Server. Please check if the App supports internal Server Execution.");
    }

    if (!(context != null && Boolean.TRUE.equals(context.getEnabled()))) {
      throw new IllegalArgumentException(
          "Applications does not support on demand execution or the context is not Internal.");
    }
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    String appName = (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_NAME);
    App jobApp = collectionDAO.applicationDAO().findEntityByName(appName);
    ApplicationHandler.getInstance().setAppRuntimeProperties(jobApp);
    Object appConfigMap =
        JsonUtils.getMapFromJson(
            (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG));
    AppBoundConfigurationUtil.setAppConfiguration(jobApp, appConfigMap);

    this.init(jobApp);
    this.startApp(jobExecutionContext);
  }

  @Override
  public void configure() {
    // Not needed by default
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
  public void interrupt() {
    LOG.info("Interrupting the job for app: {}", this.app.getName());
    stop();
  }

  protected void stop() {
    LOG.info("Default stop behavior for app: {}", this.app.getName());
  }
}
