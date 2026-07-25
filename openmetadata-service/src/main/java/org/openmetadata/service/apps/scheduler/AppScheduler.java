package org.openmetadata.service.apps.scheduler;

import static com.cronutils.model.CronType.UNIX;
import static org.openmetadata.service.apps.AbstractNativeApplication.getAppRuntime;
import static org.quartz.impl.matchers.GroupMatcher.jobGroupEquals;

import com.cronutils.mapper.CronMapper;
import com.cronutils.model.Cron;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.parser.CronParser;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.NativeApplication;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.CronScheduleBuilder;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.ObjectAlreadyExistsException;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.quartz.impl.StdSchedulerFactory;
import org.quartz.impl.matchers.GroupMatcher;

@Slf4j
public class AppScheduler {
  private static final Map<String, String> defaultAppScheduleConfig = new HashMap<>();
  public static final String ON_DEMAND_JOB = "OnDemandJob";

  static {
    defaultAppScheduleConfig.put("org.quartz.scheduler.instanceName", "AppScheduler");
    defaultAppScheduleConfig.put("org.quartz.scheduler.instanceId", "AUTO");
    defaultAppScheduleConfig.put("org.quartz.scheduler.skipUpdateCheck", "true");
    defaultAppScheduleConfig.put(
        "org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
    defaultAppScheduleConfig.put("org.quartz.threadPool.threadCount", "10");
    defaultAppScheduleConfig.put("org.quartz.threadPool.threadPriority", "5");
    defaultAppScheduleConfig.put("org.quartz.jobStore.misfireThreshold", "60000");
    defaultAppScheduleConfig.put(
        "org.quartz.jobStore.class", "org.quartz.impl.jdbcjobstore.JobStoreTX");
    defaultAppScheduleConfig.put("org.quartz.jobStore.useProperties", "false");
    defaultAppScheduleConfig.put("org.quartz.jobStore.tablePrefix", "QRTZ_");
    defaultAppScheduleConfig.put("org.quartz.jobStore.isClustered", "true");
    defaultAppScheduleConfig.put("org.quartz.jobStore.dataSource", "myDS");
    defaultAppScheduleConfig.put("org.quartz.dataSource.myDS.maxConnections", "5");
    defaultAppScheduleConfig.put("org.quartz.dataSource.myDS.validationQuery", "select 1");
  }

  public static final String APPS_JOB_GROUP = "OMAppsJobGroup";
  public static final String APPS_TRIGGER_GROUP = "OMAppsJobGroup";
  public static final String APP_INFO_KEY = "applicationInfoKey";
  public static final String APP_NAME = "appName";
  public static String APP_CONFIG_KEY = "configOverride";

  private static AppScheduler instance;
  private static volatile boolean initialized = false;
  @Getter private final Scheduler scheduler;
  private final ScheduledExecutorService errorTriggerResetScheduler;
  private static final @Getter CronMapper cronMapper = CronMapper.fromUnixToQuartz();
  private static final @Getter CronParser cronParser =
      new CronParser(CronDefinitionBuilder.instanceDefinitionFor(UNIX));

  private AppScheduler(
      OpenMetadataApplicationConfig config, CollectionDAO dao, SearchRepository searchClient)
      throws SchedulerException {
    // Override default config
    overrideDefaultConfig(config);
    // Init Clustered Scheduler
    Properties properties = new Properties();
    properties.putAll(defaultAppScheduleConfig);
    StdSchedulerFactory factory = new StdSchedulerFactory();
    factory.initialize(properties);
    this.scheduler = factory.getScheduler();

    this.scheduler.setJobFactory(new CustomJobFactory(dao, searchClient));

    // Add OMJob Listener
    this.scheduler
        .getListenerManager()
        .addJobListener(new OmAppJobListener(), jobGroupEquals(APPS_JOB_GROUP));

    // Daemon thread + retained reference so shutDown() can stop it. Previously this pool was a
    // local with a non-daemon thread that was never shut down, so it survived shutDown() and
    // blocked JVM exit (and leaked another pool on each re-initialize in embedded/test contexts).
    this.errorTriggerResetScheduler =
        Executors.newScheduledThreadPool(
            1, Thread.ofPlatform().daemon().name("om-app-error-trigger-reset").factory());
    this.errorTriggerResetScheduler.scheduleAtFixedRate(
        this::resetErrorTriggers, 0, 24, TimeUnit.HOURS);
  }

  public void start() throws SchedulerException {
    this.scheduler.start();
  }

  /* Quartz triggers can go into an "ERROR" state in some cases. Most notably when the jobs
  constructor throws an error. I do not know why this happens and the issues seem to be transient.
  This method resets all triggers in the ERROR state to the normal state.
   */
  private void resetErrorTriggers() {
    try {
      scheduler
          .getTriggerKeys(GroupMatcher.anyGroup())
          .forEach(
              triggerKey -> {
                try {
                  if (scheduler.getTriggerState(triggerKey) == Trigger.TriggerState.ERROR) {
                    LOG.info("Resetting trigger {} from error state", triggerKey);
                    scheduler.resetTriggerFromErrorState(triggerKey);
                  }
                } catch (SchedulerException e) {
                  throw new RuntimeException(e);
                }
              });
    } catch (SchedulerException ex) {
      LOG.error("Failed to reset failed triggers", ex);
    }
  }

  public static void initialize(
      OpenMetadataApplicationConfig config, CollectionDAO dao, SearchRepository searchClient)
      throws SchedulerException {
    if (!initialized) {
      instance = new AppScheduler(config, dao, searchClient);
      initialized = true;
    } else {
      LOG.info("Reindexing Handler is already initialized");
    }
  }

  private void overrideDefaultConfig(OpenMetadataApplicationConfig config) {
    defaultAppScheduleConfig.put(
        "org.quartz.dataSource.myDS.driver", config.getDataSourceFactory().getDriverClass());
    defaultAppScheduleConfig.put(
        "org.quartz.dataSource.myDS.URL", config.getDataSourceFactory().getUrl());
    defaultAppScheduleConfig.put(
        "org.quartz.dataSource.myDS.user", config.getDataSourceFactory().getUser());
    defaultAppScheduleConfig.put(
        "org.quartz.dataSource.myDS.password", config.getDataSourceFactory().getPassword());
    if (ConnectionType.MYSQL.label.equals(config.getDataSourceFactory().getDriverClass())) {
      defaultAppScheduleConfig.put(
          "org.quartz.jobStore.driverDelegateClass",
          "org.quartz.impl.jdbcjobstore.StdJDBCDelegate");
    } else {
      defaultAppScheduleConfig.put(
          "org.quartz.jobStore.driverDelegateClass",
          "org.quartz.impl.jdbcjobstore.PostgreSQLDelegate");
    }
  }

  public static AppScheduler getInstance() {
    if (initialized) return instance;
    throw new UnhandledServerException("App Scheduler is not Initialized");
  }

  public void scheduleApplication(App application) {
    try {
      if (scheduler.getJobDetail(new JobKey(application.getName(), APPS_JOB_GROUP)) != null) {
        LOG.info(
            "Job already exists for the application {}, rescheduling it", application.getName());
        scheduler.rescheduleJob(
            new TriggerKey(application.getName(), APPS_TRIGGER_GROUP), trigger(application));
        return;
      }
      AppRuntime context = getAppRuntime(application);
      if (Boolean.TRUE.equals(context.getEnabled())) {
        JobDetail jobDetail = jobBuilder(application, application.getName());
        if (!application.getAppSchedule().getScheduleTimeline().equals(ScheduleTimeline.NONE)) {
          Trigger trigger = trigger(application);
          scheduler.scheduleJob(jobDetail, trigger);
        }
      } else {
        LOG.info("[Applications] App cannot be scheduled since it is disabled");
      }
    } catch (Exception ex) {
      LOG.error("Failed in setting up job Scheduler for Data Reporting", ex);
      throw new UnhandledServerException("Failed in scheduling Job for the Application", ex);
    }
  }

  public void deleteScheduledApplication(App app) throws SchedulerException {
    // Scheduled Jobs
    scheduler.deleteJob(new JobKey(app.getName(), APPS_JOB_GROUP));
    scheduler.unscheduleJob(new TriggerKey(app.getName(), APPS_TRIGGER_GROUP));

    // OnDemand Jobs
    scheduler.deleteJob(
        new JobKey(String.format("%s-%s", app.getName(), ON_DEMAND_JOB), APPS_JOB_GROUP));
    scheduler.unscheduleJob(
        new TriggerKey(String.format("%s-%s", app.getName(), ON_DEMAND_JOB), APPS_TRIGGER_GROUP));
  }

  private JobDetail jobBuilder(App app, String jobIdentity) throws ClassNotFoundException {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(APP_NAME, app.getName());
    dataMap.put(
        "triggerType",
        Optional.ofNullable(app.getAppSchedule())
            .map(v -> v.getScheduleTimeline().value())
            .orElse(null));
    Class<? extends NativeApplication> clz =
        (Class<? extends NativeApplication>) Class.forName(app.getClassName());
    JobBuilder jobBuilder =
        JobBuilder.newJob(clz)
            .withIdentity(jobIdentity, APPS_JOB_GROUP)
            .usingJobData(dataMap)
            .requestRecovery(false);
    return jobBuilder.build();
  }

  private Trigger trigger(App app) {
    return TriggerBuilder.newTrigger()
        .withIdentity(app.getName(), APPS_TRIGGER_GROUP)
        .withSchedule(getCronSchedule(app.getAppSchedule()))
        .build();
  }

  public static void shutDown() throws SchedulerException {
    if (instance != null) {
      instance.scheduler.shutdown();
      instance.errorTriggerResetScheduler.shutdownNow();
    }
  }

  public static CronScheduleBuilder getCronSchedule(AppSchedule scheduleInfo) {
    switch (scheduleInfo.getScheduleTimeline()) {
      case HOURLY:
        return CronScheduleBuilder.cronSchedule("0 0 * ? * *");
      case DAILY:
        return CronScheduleBuilder.dailyAtHourAndMinute(0, 0);
      case WEEKLY:
        return CronScheduleBuilder.weeklyOnDayAndHourAndMinute(7, 0, 0);
      case MONTHLY:
        return CronScheduleBuilder.monthlyOnDayAndHourAndMinute(1, 0, 0);
      case CUSTOM:
        if (!CommonUtil.nullOrEmpty(scheduleInfo.getCronExpression())) {
          Cron unixCron = getCronParser().parse(scheduleInfo.getCronExpression());
          return CronScheduleBuilder.cronSchedule(getCronMapper().map(unixCron).asString());
        } else {
          throw new IllegalArgumentException("Missing Cron Expression for Custom Schedule.");
        }
    }
    throw new IllegalArgumentException("Invalid Trigger Info for the scheduled application.");
  }

  public void triggerOnDemandApplication(App application, Map<String, Object> config) {
    if (application.getFullyQualifiedName() == null) {
      throw new IllegalArgumentException("Application's fullyQualifiedName is null.");
    }
    try {
      // Check if app allows concurrent execution
      boolean allowConcurrent =
          application.getAllowConcurrentExecution() != null
              && application.getAllowConcurrentExecution();

      String jobIdentity;
      String triggerIdentity;

      String uniqueId = getUniqueJobIdentifier(config);
      boolean concurrentJob = allowConcurrent && uniqueId != null;
      if (concurrentJob) {
        // For apps that allow concurrent execution, use a unique identifier per job
        jobIdentity = String.format("%s-%s-%s", application.getName(), ON_DEMAND_JOB, uniqueId);
        triggerIdentity = String.format("%s-%s-%s", application.getName(), ON_DEMAND_JOB, uniqueId);
        LOG.info(
            "Triggering app {} with concurrent execution support. Unique identity: {}",
            application.getName(),
            jobIdentity);
      } else {
        // For apps that don't allow concurrent execution, use standard identity and apply blocking
        // logic
        jobIdentity = String.format("%s-%s", application.getName(), ON_DEMAND_JOB);
        triggerIdentity = String.format("%s-%s", application.getName(), ON_DEMAND_JOB);

        JobDetail jobDetailScheduled =
            scheduler.getJobDetail(new JobKey(application.getName(), APPS_JOB_GROUP));
        JobDetail jobDetailOnDemand =
            scheduler.getJobDetail(new JobKey(jobIdentity, APPS_JOB_GROUP));

        // Check if the job is already running
        List<JobExecutionContext> currentJobs = scheduler.getCurrentlyExecutingJobs();
        for (JobExecutionContext context : currentJobs) {
          if ((jobDetailScheduled != null
                  && context.getJobDetail().getKey().equals(jobDetailScheduled.getKey()))
              || (jobDetailOnDemand != null
                  && context.getJobDetail().getKey().equals(jobDetailOnDemand.getKey()))) {
            throw new UnhandledServerException(
                "Job is already running, please wait for it to complete.");
          }
        }
      }

      AppRuntime context = getAppRuntime(application);
      if (Boolean.FALSE.equals(context.getEnabled())) {
        LOG.info("[Applications] App cannot be scheduled since it is disabled");
        return;
      }

      JobDetail newJobDetail = jobBuilder(application, jobIdentity);
      newJobDetail.getJobDataMap().put("triggerType", ON_DEMAND_JOB);
      // Use the application name for lookup consistency in OmAppJobListener
      newJobDetail.getJobDataMap().put(APP_NAME, application.getName());
      newJobDetail.getJobDataMap().put(APP_CONFIG_KEY, config);

      Trigger trigger =
          TriggerBuilder.newTrigger()
              .withIdentity(triggerIdentity, APPS_TRIGGER_GROUP)
              .startNow()
              .build();
      scheduleOnDemandJob(application, newJobDetail, trigger, triggerIdentity, concurrentJob);
    } catch (ObjectAlreadyExistsException ex) {
      throw new UnhandledServerException("Job is already running, please wait for it to complete.");
    } catch (SchedulerException | ClassNotFoundException ex) {
      LOG.error("Failed in running job", ex);
    }
  }

  /**
   * Schedule the on-demand job, recovering from a stale Quartz entry left by a crashed pod.
   *
   * <p>The on-demand job is non-durable, so a clean run auto-deletes its {@code JobDetail}. But a
   * pod that crashed (or was wedged) mid-execution leaves the persisted {@code QRTZ_*} job/trigger
   * behind. Because the store is clustered, a retrigger from <em>any</em> pod then hits
   * {@link ObjectAlreadyExistsException} and is rejected with "Job is already running" even though
   * nothing is actually running. We distinguish the two cases using the DB-backed {@link
   * AppRunRecord} (cross-pod truth): if the latest run is genuinely active we rethrow; otherwise the
   * entry is stale, so we clear it and reschedule once.
   *
   * <p>Recovery is applied only to non-concurrent jobs. Concurrent jobs use a unique identity per
   * run, so a collision there is not a stale entry and the app-wide latest run record is not a
   * reliable signal for a specific run.
   *
   * <p>The check-then-act (read run record → delete → reschedule) is not atomic across a clustered
   * deployment. If two pods race, the recovery {@code scheduleJob} may itself collide; we treat that
   * second collision as "another pod won" and rethrow so the caller reports the standard message
   * rather than deleting a job the other pod just scheduled.
   *
   * <p>"Active" is defined by {@link #TERMINAL_RUN_STATUSES}: any non-terminal status (including
   * {@code ACTIVE_ERROR}, which is in-flight — set by apps that are still progressing and only
   * normalized to {@code FAILED} when the run actually finishes) is treated as a live run we must
   * not clear. Erring toward "active" is deliberate: leaving a stale entry is recoverable, while
   * deleting a job another pod is genuinely running risks a duplicate/disrupted execution.
   */
  private void scheduleOnDemandJob(
      App application,
      JobDetail jobDetail,
      Trigger trigger,
      String triggerIdentity,
      boolean concurrent)
      throws SchedulerException {
    try {
      scheduler.scheduleJob(jobDetail, trigger);
    } catch (ObjectAlreadyExistsException ex) {
      if (concurrent || hasActiveAppRun(application)) {
        throw ex;
      }
      LOG.warn(
          "Stale Quartz job/trigger for app {} with no active run record; clearing and rescheduling",
          application.getName());
      scheduler.deleteJob(jobDetail.getKey());
      scheduler.unscheduleJob(new TriggerKey(triggerIdentity, APPS_TRIGGER_GROUP));
      scheduler.scheduleJob(jobDetail, trigger);
    }
  }

  /** Statuses that mean a run has finished; anything else (incl. ACTIVE_ERROR) is in-flight. */
  private static final Set<AppRunRecord.Status> TERMINAL_RUN_STATUSES =
      Set.of(
          AppRunRecord.Status.SUCCESS,
          AppRunRecord.Status.FAILED,
          AppRunRecord.Status.STOPPED,
          AppRunRecord.Status.COMPLETED);

  private boolean hasActiveAppRun(App application) {
    boolean active;
    try {
      active =
          new AppRepository()
              .getLatestAppRunsOptional(application)
              .map(
                  run ->
                      run.getStatus() != null && !TERMINAL_RUN_STATUSES.contains(run.getStatus()))
              .orElse(false);
    } catch (Exception e) {
      LOG.warn(
          "Could not read latest run for app {}; treating as active to avoid clearing a live job",
          application.getName(),
          e);
      active = true;
    }
    return active;
  }

  /**
   * Clears a persisted on-demand job/trigger for the given app from the Quartz store so a fresh
   * on-demand trigger can be scheduled without hitting "Job is already running". Used by the CLI
   * reindex commands to remove a leftover from a previous run that died before completing. A job
   * that is currently executing is left untouched, so a genuinely running run is never cleared.
   */
  public void deleteOnDemandJob(App app) {
    JobKey onDemandJobKey =
        new JobKey(String.format("%s-%s", app.getName(), ON_DEMAND_JOB), APPS_JOB_GROUP);
    try {
      for (JobExecutionContext context : scheduler.getCurrentlyExecutingJobs()) {
        if (context.getJobDetail().getKey().equals(onDemandJobKey)) {
          LOG.info(
              "On-demand job for app {} is currently executing; leaving it in place.",
              app.getName());
          return;
        }
      }
      scheduler.deleteJob(onDemandJobKey);
      scheduler.unscheduleJob(
          new TriggerKey(String.format("%s-%s", app.getName(), ON_DEMAND_JOB), APPS_TRIGGER_GROUP));
    } catch (SchedulerException ex) {
      LOG.warn("Could not clear existing on-demand job for app {}", app.getName(), ex);
    }
  }

  public void stopApplicationRun(App application) {
    try {
      JobDetail jobDetailScheduled =
          scheduler.getJobDetail(new JobKey(application.getName(), APPS_JOB_GROUP));
      JobDetail jobDetailOnDemand =
          scheduler.getJobDetail(
              new JobKey(
                  String.format("%s-%s", application.getName(), ON_DEMAND_JOB), APPS_JOB_GROUP));
      boolean isJobRunning = false;
      JobExecutionContext runningJobContext = null;
      // Check if the job is already running
      List<JobExecutionContext> currentJobs = scheduler.getCurrentlyExecutingJobs();
      LOG.info("Currently executing jobs count: {}", currentJobs.size());
      for (JobExecutionContext context : currentJobs) {
        LOG.info("Running job: {}", context.getJobDetail().getKey());
        if ((jobDetailScheduled != null
                && context.getJobDetail().getKey().equals(jobDetailScheduled.getKey()))
            || (jobDetailOnDemand != null
                && context.getJobDetail().getKey().equals(jobDetailOnDemand.getKey()))) {
          isJobRunning = true;
          runningJobContext = context;
          LOG.info("Found matching job for application: {}", application.getName());
        }
      }
      if (!isJobRunning) {
        // Quartz doesn't see the job, but a distributed indexing job may still be
        // running independently. Try to stop it via the coordinator directly.
        if (tryStopViaApp(application)) {
          LOG.info(
              "No Quartz job found for {}, but stopped running distributed job via coordinator",
              application.getName());
          return;
        }
        LOG.error(
            "No running job found for application: {}. Scheduled key: {}, OnDemand key: {}",
            application.getName(),
            jobDetailScheduled != null ? jobDetailScheduled.getKey() : "null",
            jobDetailOnDemand != null ? jobDetailOnDemand.getKey() : "null");
        throw new UnhandledServerException("There is no job running for the application.");
      }

      // Update status to STOPPED and broadcast before interrupting
      if (runningJobContext != null) {
        updateAndBroadcastStoppedStatus(runningJobContext);
      }

      // Try to interrupt the running job
      boolean interruptSuccessful = false;

      // Check which job is actually running and interrupt it
      for (JobExecutionContext context : currentJobs) {
        JobKey runningJobKey = context.getJobDetail().getKey();
        if ((jobDetailScheduled != null && runningJobKey.equals(jobDetailScheduled.getKey()))
            || (jobDetailOnDemand != null && runningJobKey.equals(jobDetailOnDemand.getKey()))) {
          LOG.info("Attempting to interrupt running job: {}", runningJobKey);
          try {
            interruptSuccessful = scheduler.interrupt(runningJobKey);
            LOG.info("Interrupt result for {}: {}", runningJobKey, interruptSuccessful);

            if (!interruptSuccessful) {
              LOG.warn(
                  "Interrupt returned false for job: {}. Job might not support interruption or already stopped.",
                  runningJobKey);
            }
          } catch (Exception e) {
            LOG.error("Failed to interrupt job: {}", runningJobKey, e);
          }
        }
      }

      // Wait briefly for the interrupt to propagate and cleanup to start before deleting
      // the job. Deleting immediately can kill the Quartz thread before the application's
      // stop/cleanup logic (e.g., flushing sinks, transitioning job status) can complete.
      try {
        Thread.sleep(2000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }

      // Delete the job after interrupt has had time to propagate
      JobKey scheduledJobKey = new JobKey(application.getName(), APPS_JOB_GROUP);
      if (jobDetailScheduled != null) {
        LOG.info("Deleting Scheduled Job for App: {}", application.getName());
        try {
          scheduler.deleteJob(scheduledJobKey);
        } catch (SchedulerException ex) {
          LOG.error("Failed to delete scheduled job: {}", scheduledJobKey, ex);
        }
      }

      JobKey onDemandJobKey =
          new JobKey(String.format("%s-%s", application.getName(), ON_DEMAND_JOB), APPS_JOB_GROUP);
      if (jobDetailOnDemand != null) {
        LOG.info("Deleting On Demand Job for App: {}", application.getName());
        try {
          scheduler.deleteJob(onDemandJobKey);
        } catch (SchedulerException ex) {
          LOG.error("Failed to delete on-demand job: {}", onDemandJobKey, ex);
        }
      }
    } catch (SchedulerException ex) {
      LOG.error("Failed to stop job execution for app: {}", application.getName(), ex);
    }
  }

  private boolean tryStopViaApp(App application) {
    try {
      AbstractNativeApplication appInstance =
          ApplicationHandler.getInstance()
              .runAppInit(
                  application, Entity.getCollectionDAO(), Entity.getSearchRepository(), true);
      return appInstance.tryStopOutsideQuartz();
    } catch (Exception e) {
      LOG.error("Failed to stop app via fallback: {}", application.getName(), e);
      return false;
    }
  }

  private void updateAndBroadcastStoppedStatus(JobExecutionContext context) {
    try {
      JobDataMap dataMap = context.getJobDetail().getJobDataMap();
      OmAppJobListener listener = getJobListener(context);

      // Get the current run record
      AppRunRecord runRecord = listener.getAppRunRecordForJob(context);

      if (runRecord != null) {
        // Update status to STOPPED
        runRecord.withStatus(AppRunRecord.Status.STOPPED);
        OmAppJobListener.fillTerminalTimings(runRecord);

        // Get WebSocket channel name
        String webSocketChannelName =
            (String) dataMap.get(OmAppJobListener.WEBSOCKET_STATUS_CHANNEL);

        // Broadcast via WebSocket
        if (!CommonUtil.nullOrEmpty(webSocketChannelName)
            && WebSocketManager.getInstance() != null) {
          LOG.info(
              "Broadcasting STOPPED status for job via WebSocket channel: {}",
              webSocketChannelName);
          WebSocketManager.getInstance()
              .broadCastMessageToAll(webSocketChannelName, JsonUtils.pojoToJson(runRecord));
        }

        // Update database
        listener.pushApplicationStatusUpdates(context, runRecord, true);
        LOG.info("Updated job status to STOPPED and broadcasted via WebSocket");
      }
    } catch (Exception e) {
      LOG.error("Failed to update and broadcast stopped status", e);
    }
  }

  private OmAppJobListener getJobListener(JobExecutionContext context) throws SchedulerException {
    return (OmAppJobListener)
        context
            .getScheduler()
            .getListenerManager()
            .getJobListener(OmAppJobListener.JOB_LISTENER_NAME);
  }

  // Package-private for testing
  String getUniqueJobIdentifier(Map<String, Object> config) {
    if (config != null) {
      if (config.containsKey("ingestionRunner")) {
        return (String) config.get("ingestionRunner");
      }
      if (config.containsKey("workflowName")) {
        return (String) config.get("workflowName");
      }
    }
    return null;
  }
}
