package org.openmetadata.service.apps;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO;
import static org.openmetadata.service.apps.scheduler.AppScheduler.COLLECTION_DAO_KEY;

import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.schema.entity.app.RuntimeContext;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@Slf4j
public class AbstractNativeApplication implements NativeApplication {
  private CollectionDAO collectionDAO;
  private Application app;

  @Override
  public void init(Application app, CollectionDAO dao) {
    this.collectionDAO = dao;
    this.app = app;
  }

  @Override
  public void triggerOnDemand(Object requestObj) {
    // Validate Native Application
    validateServerOnDemandExecutableApp(app.getExecutionContext().getOnDemand());

    // Trigger the application
    AppScheduler.getInstance().triggerOnDemandApplication(app);
  }

  @Override
  public void schedule(AppSchedule schedule) {
    // Schedule New Application Run
    AppScheduler.getInstance().addApplicationSchedule(app, schedule);
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
    // Initialise the Application
    this.init(jobApp, dao);

    // Trigger
    this.doExecute(jobExecutionContext);
    triggerOnDemand(jobApp.getConfiguration());
  }
}
