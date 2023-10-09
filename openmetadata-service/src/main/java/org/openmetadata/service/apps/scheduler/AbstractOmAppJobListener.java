package org.openmetadata.service.apps.scheduler;

import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;

import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppRunType;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.JobListener;

public abstract class AbstractOmAppJobListener implements JobListener {
  private CollectionDAO collectionDAO;
  private static final String SCHEDULED_APP_RUN_EXTENSION = "AppScheduleRun";
  private static final String SCHEDULED_APP_RUN_RECORD_SCHEMA = "applicationRunRecord.json";
  static final String JOB_LISTENER_NAME = "OM_JOB_LISTENER";

  protected AbstractOmAppJobListener(CollectionDAO dao) {
    this.collectionDAO = dao;
  }

  @Override
  public String getName() {
    return JOB_LISTENER_NAME;
  }

  @Override
  public void jobToBeExecuted(JobExecutionContext jobExecutionContext) {
    AppRunType runType =
        AppRunType.fromValue((String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType"));
    App jobApp = (App) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_INFO_KEY);
    JobDataMap dataMap = jobExecutionContext.getJobDetail().getJobDataMap();
    long jobStartTime = System.currentTimeMillis();
    AppRunRecord runRecord =
        new AppRunRecord()
            .withAppId(jobApp.getId())
            .withStartTime(jobStartTime)
            .withTimestamp(jobStartTime)
            .withRunType(runType)
            .withStatus(AppRunRecord.Status.RUNNING)
            .withScheduleInfo(jobApp.getAppSchedule());

    // Put the Context in the Job Data Map
    dataMap.put(SCHEDULED_APP_RUN_EXTENSION, runRecord);

    // Run the Scheduled Run Record on the time series
    collectionDAO
        .appExtensionTimeSeriesDao()
        .insert(SCHEDULED_APP_RUN_EXTENSION, SCHEDULED_APP_RUN_RECORD_SCHEMA, JsonUtils.pojoToJson(runRecord));

    this.doJobToBeExecuted(jobExecutionContext);
  }

  @Override
  public void jobExecutionVetoed(JobExecutionContext jobExecutionContext) {}

  @Override
  public void jobWasExecuted(JobExecutionContext jobExecutionContext, JobExecutionException jobException) {
    AppRunRecord runRecord =
        (AppRunRecord) jobExecutionContext.getJobDetail().getJobDataMap().get(SCHEDULED_APP_RUN_EXTENSION);
    long endTime = System.currentTimeMillis();
    runRecord.withEndTime(endTime);

    boolean success = jobException == null;
    if (success) {
      runRecord.withStatus(AppRunRecord.Status.SUCCESS);
      // TODO: Add Failure Context
    } else {
      runRecord.withStatus(AppRunRecord.Status.FAILED);
      FailureContext context = new FailureContext();
      context.withAdditionalProperty("cause", jobException.getCause());
      context.withAdditionalProperty("message", jobException.getMessage());
      context.withAdditionalProperty("stackTrace", jobException.getStackTrace());
      runRecord.setFailureContext(context);
      // TODO: Add More Info here
    }

    collectionDAO
        .appExtensionTimeSeriesDao()
        .update(
            runRecord.getAppId().toString(),
            SCHEDULED_APP_RUN_EXTENSION,
            JsonUtils.pojoToJson(runRecord),
            runRecord.getTimestamp());

    this.doJobWasExecuted(jobExecutionContext, jobException);
  }

  protected void doJobWasExecuted(JobExecutionContext jobExecutionContext, JobExecutionException jobException) {}

  protected void doJobToBeExecuted(JobExecutionContext jobExecutionContext) {}
}
