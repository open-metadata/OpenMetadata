package org.openmetadata.service.apps.scheduler;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_CONFIG_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.entity.applications.configuration.ApplicationConfig;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.JobListener;

@Slf4j
public class OmAppJobListener implements JobListener {
  public static final String APP_CONFIG = "appConfig";
  private final AppRepository repository;
  private static final String SCHEDULED_APP_RUN_EXTENSION = "AppScheduleRun";
  public static final String WEBSOCKET_STATUS_CHANNEL = "WebsocketStatusUpdateExtension";

  public static final String APP_RUN_STATS = "AppRunStats";
  public static final String JOB_LISTENER_NAME = "OM_JOB_LISTENER";
  public static final String SERVICES_FIELD = "services";

  protected OmAppJobListener() {
    this.repository = new AppRepository();
  }

  @Override
  public String getName() {
    return JOB_LISTENER_NAME;
  }

  @Override
  public void jobToBeExecuted(JobExecutionContext jobExecutionContext) {
    try {
      String runType =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType");
      String appName = (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_NAME);
      App jobApp = repository.findByName(appName, Include.NON_DELETED);

      ApplicationConfig appConfig =
          JsonUtils.convertValue(jobApp.getAppConfiguration(), ApplicationConfig.class);
      ApplicationConfig overrideConfig =
          JsonUtils.convertValue(
              jobExecutionContext.getMergedJobDataMap().getWrappedMap().get(APP_CONFIG_KEY),
              ApplicationConfig.class);
      if (overrideConfig != null) {
        appConfig.getAdditionalProperties().putAll(overrideConfig.getAdditionalProperties());
      }

      ApplicationHandler.getInstance().setAppRuntimeProperties(jobApp);
      JobDataMap dataMap = jobExecutionContext.getJobDetail().getJobDataMap();
      long jobStartTime = System.currentTimeMillis();
      AppRunRecord runRecord =
          new AppRunRecord()
              .withAppId(jobApp.getId())
              .withAppName(jobApp.getName())
              .withStartTime(jobStartTime)
              .withTimestamp(jobStartTime)
              .withRunType(runType)
              .withStatus(AppRunRecord.Status.RUNNING)
              .withScheduleInfo(jobApp.getAppSchedule())
              .withConfig(JsonUtils.getMap(appConfig));

      boolean update = false;
      if (jobExecutionContext.isRecovering()) {
        AppRunRecord latestRunRecord =
            repository.getLatestExtensionById(
                jobApp, AppRunRecord.class, AppExtension.ExtensionType.STATUS);
        if (latestRunRecord != null) {
          runRecord = latestRunRecord;
        }
        update = true;
      }
      // Put the Context in the Job Data Map
      dataMap.put(SCHEDULED_APP_RUN_EXTENSION, JsonUtils.pojoToJson(runRecord));
      dataMap.put(APP_CONFIG, JsonUtils.pojoToJson(appConfig));

      // Insert new Record Run
      pushApplicationStatusUpdates(jobExecutionContext, runRecord, update);
    } catch (Exception e) {
      LOG.error("OmAppJobListener.jobToBeExecuted failed unexpectedly", e);
    }
  }

  @Override
  public void jobExecutionVetoed(JobExecutionContext jobExecutionContext) {}

  @Override
  public void jobWasExecuted(
      JobExecutionContext jobExecutionContext, JobExecutionException jobException) {
    try {
      AppRunRecord runRecord =
          JsonUtils.readOrConvertValue(
              jobExecutionContext.getJobDetail().getJobDataMap().get(SCHEDULED_APP_RUN_EXTENSION),
              AppRunRecord.class);
      Stats jobStats =
          JsonUtils.convertValue(
              jobExecutionContext.getJobDetail().getJobDataMap().get(APP_RUN_STATS), Stats.class);
      long endTime = System.currentTimeMillis();
      runRecord.withEndTime(endTime);
      runRecord.setExecutionTime(endTime - runRecord.getStartTime());

      if (jobExecutionContext.getJobDetail().getJobDataMap().get(SERVICES_FIELD) != null) {
        runRecord.setServices(
            JsonUtils.convertObjects(
                jobExecutionContext.getJobDetail().getJobDataMap().get(SERVICES_FIELD),
                EntityReference.class));
      }

      // Check if the job was stopped/interrupted
      if (runRecord.getStatus() == AppRunRecord.Status.STOPPED
          || runRecord.getStatus() == AppRunRecord.Status.STOP_IN_PROGRESS) {
        runRecord.withStatus(AppRunRecord.Status.STOPPED);
        SuccessContext context = new SuccessContext();
        if (runRecord.getSuccessContext() != null) {
          context = runRecord.getSuccessContext();
        }
        context.setStats(jobStats);
        runRecord.setSuccessContext(context);
      } else if (jobException == null
          && !(runRecord.getStatus() == AppRunRecord.Status.FAILED
              || runRecord.getStatus() == AppRunRecord.Status.ACTIVE_ERROR)) {
        runRecord.withStatus(AppRunRecord.Status.SUCCESS);
        SuccessContext context = new SuccessContext();
        if (runRecord.getSuccessContext() != null) {
          context = runRecord.getSuccessContext();
        }
        context.setStats(jobStats);
        runRecord.setSuccessContext(context);
      } else {
        runRecord.withStatus(AppRunRecord.Status.FAILED);
        FailureContext context = new FailureContext();
        if (runRecord.getFailureContext() != null) {
          context = runRecord.getFailureContext();
        }
        if (jobException != null) {
          Map<String, Object> failure = new HashMap<>();
          failure.put("message", jobException.getMessage());
          failure.put("jobStackTrace", ExceptionUtils.getStackTrace(jobException));
          context.withAdditionalProperty("failure", failure);
        }

        runRecord.setFailureContext(context);
      }
      // Push Update on WebSocket
      String webSocketChannelName =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get(WEBSOCKET_STATUS_CHANNEL);
      if (!nullOrEmpty(webSocketChannelName) && WebSocketManager.getInstance() != null) {
        WebSocketManager.getInstance()
            .broadCastMessageToAll(webSocketChannelName, JsonUtils.pojoToJson(runRecord));
      }

      // Update App Run Record
      pushApplicationStatusUpdates(jobExecutionContext, runRecord, true);
    } catch (Exception e) {
      LOG.error("OmAppJobListener.jobWasExecuted failed unexpectedly", e);
    }
  }

  public AppRunRecord getAppRunRecordForJob(JobExecutionContext context) {
    JobDataMap dataMap = context.getJobDetail().getJobDataMap();
    return JsonUtils.readOrConvertValue(
        dataMap.get(SCHEDULED_APP_RUN_EXTENSION), AppRunRecord.class);
  }

  public void pushApplicationStatusUpdates(
      JobExecutionContext context, AppRunRecord runRecord, boolean update) {
    JobDataMap dataMap = context.getJobDetail().getJobDataMap();
    if (dataMap.containsKey(SCHEDULED_APP_RUN_EXTENSION)) {
      // Update the Run Record in Data Map
      dataMap.put(SCHEDULED_APP_RUN_EXTENSION, JsonUtils.pojoToJson(runRecord));

      // Push Updates to the Database
      String appName = (String) context.getJobDetail().getJobDataMap().get(APP_NAME);
      UUID appId = repository.findByName(appName, Include.NON_DELETED).getId();
      if (update) {
        repository.updateAppStatus(appId, runRecord);
      } else {
        repository.addAppStatus(runRecord);
      }
    }
  }
}
