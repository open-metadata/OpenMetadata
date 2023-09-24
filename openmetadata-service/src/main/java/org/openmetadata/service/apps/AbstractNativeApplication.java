package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO;
import static org.openmetadata.service.apps.scheduler.AppScheduler.COLLECTION_DAO_KEY;

import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.schema.entity.app.RuntimeContext;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@Slf4j
public class AbstractNativeApplication implements NativeApplication {
  static String APP_EXTENSION = "appExtension";
  private CollectionDAO collectionDAO;
  private Application app;

  @Override
  public void init(Application app, CollectionDAO dao) {
    this.collectionDAO = dao;
    this.app = app;
  }

  @Override
  public void triggerOnDemand(Object requestObj) {
    // Validate App is not in Execution State
    // validateAppNotRunning(AppUtil.RunType.ON_DEMAND_RUN);

    // Mark application start in the database
    // registerAppStatusWithRun(AppUtil.AppRunStatus.STARTED, AppUtil.RunType.ON_DEMAND_RUN);

    // Validate Native Application
    validateServerOnDemandExecutableApp(app.getExecutionContext().getOnDemand());

    // Trigger the application
    AppScheduler.getInstance().triggerOnDemandApplication(app);
  }

  @Override
  public void schedule(AppSchedule schedule) {
    // TODO: Clear Existing Job Schedules if any

    // Schedule New Application Run
    AppScheduler.getInstance().addApplicationSchedule(app, schedule);
  }

  private void validateAppNotRunning(AppUtil.RunType appRunType) {
    String state =
        collectionDAO
            .appExtensionTimeSeriesDao()
            .getLatestExtension(app.getId().toString(), APP_EXTENSION, appRunType.value());
    if (!CommonUtil.nullOrEmpty(state)) {
      AppUtil.AppRunStatus currentStatus = AppUtil.AppRunStatus.fromValue(state);
      if (currentStatus.equals(AppUtil.AppRunStatus.RUNNING) || currentStatus.equals(AppUtil.AppRunStatus.STARTED)) {
        throw new RuntimeException("Cannot Trigger as the application is already in progress.");
      }
    }
  }

  protected void registerAppStatusWithRun(AppUtil.AppRunStatus status, AppUtil.RunType appRunType) {
    AppUtil.AppRunHistory newRun = new AppUtil.AppRunHistory();
    newRun.setAppId(app.getId().toString());
    newRun.setAppName(app.getName());
    newRun.setRunId(UUID.randomUUID().toString());
    newRun.setTimestamp(System.currentTimeMillis());
    newRun.setStatus(status);
    newRun.setRunType(appRunType.value());

    // Register the run in the database
    collectionDAO.appExtensionTimeSeriesDao().insert(APP_EXTENSION, "appRuns.json", JsonUtils.pojoToJson(newRun));
  }

  protected void validateServerOnDemandExecutableApp(RuntimeContext context) {
    // Server apps are native
    if (!app.getAppType().equals(AppType.Native)) {
      throw new IllegalArgumentException("Application Type is not Native.");
    }

    // Check OnDemand Execution is supported
    if (!(context != null
        && Boolean.TRUE.equals(context.getEnabled())
        && context.getExecutionType().equals(RuntimeContext.ExecutionType.Internal))) {
      throw new IllegalArgumentException(
          "Applications does not support on demand execution or the context is not Internal.");
    }

    // Check Language execution
    if (!Objects.equals(context.getLanguage(), "java")) {
      throw new IllegalArgumentException("Configured Language is not supported for Native Application.");
    }
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
    // This is the part of the code that is executed by the scheduler
    Application jobApp = (Application) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_INFO);
    CollectionDAO dao = (CollectionDAO) jobExecutionContext.getJobDetail().getJobDataMap().get(COLLECTION_DAO_KEY);
    //    SearchClient searchClient =
    //        (SearchClient) jobExecutionContext.getJobDetail().getJobDataMap().get(SEARCH_CLIENT_KEY);

    // Initialise the Application
    this.init(jobApp, dao);

    // Trigger
    this.doExecute(jobExecutionContext);
    triggerOnDemand(jobApp.getConfiguration());
  }
}
