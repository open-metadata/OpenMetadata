package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;
import static org.openmetadata.service.apps.scheduler.AppScheduler.SERVICE_ID;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.JOB_LISTENER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.NO_MANUAL_TRIGGER_ERR;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
import org.quartz.JobExecutionContext;
import org.quartz.SchedulerException;

@Getter
@Slf4j
public abstract class AbstractNativeApplicationBase implements NativeApplication {
  protected CollectionDAO collectionDAO;
  protected App app;
  protected SearchRepository searchRepository;

  protected AbstractNativeApplicationBase(
      CollectionDAO collectionDAO, SearchRepository searchRepository) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  public void init(App app) {
    this.app = app;
    // ApplicationContext registration temporarily disabled for compatibility
    // TODO: Update ApplicationContext to work with AbstractNativeApplicationBase
  }

  @Override
  public void uninstall() {
    // ApplicationContext unregistration temporarily disabled for compatibility
    // TODO: Update ApplicationContext to work with AbstractNativeApplicationBase
  }

  @Override
  public void triggerOnDemand() {
    triggerOnDemand(null);
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

  protected Map<String, Object> decryptConfiguration(Map<String, Object> appConfig) {
    return appConfig;
  }

  protected Map<String, Object> encryptConfiguration(Map<String, Object> appConfig) {
    return appConfig;
  }

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
    String serviceIdStr =
        (String) jobExecutionContext.getJobDetail().getJobDataMap().get(SERVICE_ID);
    UUID serviceId = serviceIdStr != null ? UUID.fromString(serviceIdStr) : null;

    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    App jobApp =
        appRepository.getByName(
            null, appName, appRepository.getFields("bot"), Include.NON_DELETED, true);
    ApplicationHandler.getInstance().setAppRuntimeProperties(jobApp);

    Object appConfigMap =
        JsonUtils.getMapFromJson(
            (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG));
    if (appConfigMap != null) {
      if (serviceId != null) {
        AppBoundConfigurationUtil.setAppConfiguration(jobApp, serviceId, appConfigMap);
      } else {
        AppBoundConfigurationUtil.setAppConfiguration(jobApp, appConfigMap);
      }
    }

    this.init(jobApp);
    this.startApp(jobExecutionContext);
  }

  @Override
  public void configure() {
    // Not needed by default
  }

  public void raisePreviewMessage(App app) {
    throw AppException.byMessage(
        app.getName(),
        "Preview",
        "App is in Preview Mode. Enable it from the server configuration.");
  }

  @Override
  public void raiseNotEnabledMessage(App app) {
    throw AppException.byMessage(
        app.getName(),
        "NotEnabled",
        "App is not enabled. Enable it from the server configuration.");
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
