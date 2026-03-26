package org.openmetadata.service.apps.scheduler;

import static com.cronutils.model.CronType.UNIX;
import static org.openmetadata.service.apps.AbstractNativeApplicationBase.getAppRuntime;
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
import java.util.UUID;
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
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.NativeApplication;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.AppBoundConfigurationUtil;
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
  public static final String SERVICE_ID = "serviceId";

  private static AppScheduler instance;
  private static volatile boolean initialized = false;
  @Getter private final Scheduler scheduler;
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

    ScheduledExecutorService threadScheduler =
        Executors.newScheduledThreadPool(
            1, Thread.ofPlatform().name("om-app-error-trigger-reset").factory());
    threadScheduler.scheduleAtFixedRate(this::resetErrorTriggers, 0, 24, TimeUnit.HOURS);
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
        AppSchedule appSchedule = AppBoundConfigurationUtil.getAppSchedule(application);
        if (appSchedule != null
            && !appSchedule.getScheduleTimeline().equals(ScheduleTimeline.NONE)) {
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

  public void scheduleApplicationForService(App application, UUID serviceId) {
    try {
      String jobIdentity = getServiceJobIdentity(application.getName(), serviceId);
      String triggerIdentity = getServiceTriggerIdentity(application.getName(), serviceId);

      if (scheduler.getJobDetail(new JobKey(jobIdentity, APPS_JOB_GROUP)) != null) {
        LOG.info(
            "Job already exists for application {} and service {}, rescheduling it",
            application.getName(),
            serviceId);
        scheduler.rescheduleJob(
            new TriggerKey(triggerIdentity, APPS_TRIGGER_GROUP),
            triggerForService(application, serviceId));
        return;
      }

      AppRuntime context = getAppRuntime(application);
      if (Boolean.TRUE.equals(context.getEnabled())) {
        JobDetail jobDetail = jobBuilderForService(application, serviceId, jobIdentity);
        AppSchedule appSchedule = AppBoundConfigurationUtil.getAppSchedule(application, serviceId);

        if (appSchedule != null
            && !appSchedule.getScheduleTimeline().equals(ScheduleTimeline.NONE)) {
          Trigger trigger = triggerForService(application, serviceId);
          scheduler.scheduleJob(jobDetail, trigger);
          LOG.info(
              "Scheduled service-bound job {} for app {} and service {}",
              jobIdentity,
              application.getName(),
              serviceId);
        }
      } else {
        LOG.info(
            "[Applications] Service-bound app {} cannot be scheduled since it is disabled",
            application.getName());
      }
    } catch (Exception ex) {
      LOG.error(
          "Failed in setting up job scheduler for service-bound app {} and service {}",
          application.getName(),
          serviceId,
          ex);
      throw new UnhandledServerException(
          "Failed in scheduling job for service-bound application", ex);
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

  public void deleteScheduledApplicationForService(App app, UUID serviceId)
      throws SchedulerException {
    String jobIdentity = getServiceJobIdentity(app.getName(), serviceId);
    String triggerIdentity = getServiceTriggerIdentity(app.getName(), serviceId);
    String onDemandJobIdentity = getServiceOnDemandJobIdentity(app.getName(), serviceId);
    String onDemandTriggerIdentity = getServiceOnDemandTriggerIdentity(app.getName(), serviceId);

    // Scheduled Jobs
    scheduler.deleteJob(new JobKey(jobIdentity, APPS_JOB_GROUP));
    scheduler.unscheduleJob(new TriggerKey(triggerIdentity, APPS_TRIGGER_GROUP));

    // OnDemand Jobs
    scheduler.deleteJob(new JobKey(onDemandJobIdentity, APPS_JOB_GROUP));
    scheduler.unscheduleJob(new TriggerKey(onDemandTriggerIdentity, APPS_TRIGGER_GROUP));

    LOG.info("Deleted jobs for service-bound app {} and service {}", app.getName(), serviceId);
  }

  private JobDetail jobBuilder(App app, String jobIdentity) throws ClassNotFoundException {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(APP_NAME, app.getName());
    dataMap.put(
        "triggerType",
        Optional.ofNullable(AppBoundConfigurationUtil.getAppSchedule(app))
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

  private JobDetail jobBuilderForService(App app, UUID serviceId, String jobIdentity)
      throws ClassNotFoundException {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(APP_NAME, app.getName());
    dataMap.put(SERVICE_ID, serviceId.toString());
    dataMap.put(
        "triggerType",
        Optional.ofNullable(AppBoundConfigurationUtil.getAppSchedule(app, serviceId))
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
        .withSchedule(getCronSchedule(AppBoundConfigurationUtil.getAppSchedule(app)))
        .build();
  }

  private Trigger triggerForService(App app, UUID serviceId) {
    String triggerIdentity = getServiceTriggerIdentity(app.getName(), serviceId);
    AppSchedule appSchedule = AppBoundConfigurationUtil.getAppSchedule(app, serviceId);
    return TriggerBuilder.newTrigger()
        .withIdentity(triggerIdentity, APPS_TRIGGER_GROUP)
        .withSchedule(getCronSchedule(appSchedule))
        .build();
  }

  public static void shutDown() throws SchedulerException {
    if (instance != null) {
      instance.scheduler.shutdown();
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
      if (allowConcurrent && uniqueId != null) {
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
      scheduler.scheduleJob(newJobDetail, trigger);
    } catch (ObjectAlreadyExistsException ex) {
      throw new UnhandledServerException("Job is already running, please wait for it to complete.");
    } catch (SchedulerException | ClassNotFoundException ex) {
      LOG.error("Failed in running job", ex);
    }
  }

  public void stopApplicationRun(App application) {
    stopApplicationRun(application, null);
  }

  /**
   * Stops a running application job. If serviceId is provided, only the service-specific
   * job is stopped. Otherwise, any running job belonging to the app is stopped.
   */
  public void stopApplicationRun(App application, UUID serviceId) {
    try {
      List<JobExecutionContext> currentJobs = scheduler.getCurrentlyExecutingJobs();
      LOG.info("Currently executing jobs count: {}", currentJobs.size());

      JobExecutionContext runningJobContext = null;
      for (JobExecutionContext context : currentJobs) {
        JobKey key = context.getJobDetail().getKey();
        if (!APPS_JOB_GROUP.equals(key.getGroup())) {
          continue;
        }
        if (!isJobForApp(key.getName(), application.getName())) {
          continue;
        }
        if (serviceId != null) {
          String jobSvcId = context.getJobDetail().getJobDataMap().getString(SERVICE_ID);
          if (jobSvcId == null || !serviceId.toString().equals(jobSvcId)) {
            continue;
          }
        }
        LOG.info(
            "Found matching running job for application: {} (key: {})", application.getName(), key);
        runningJobContext = context;
        break;
      }

      if (runningJobContext == null) {
        LOG.error(
            "No running job found for application: {} (serviceId: {})",
            application.getName(),
            serviceId);
        throw new UnhandledServerException("There is no job running for the application.");
      }

      updateAndBroadcastStoppedStatus(runningJobContext);

      JobKey runningJobKey = runningJobContext.getJobDetail().getKey();
      LOG.info("Attempting to interrupt running job: {}", runningJobKey);
      try {
        boolean interruptSuccessful = scheduler.interrupt(runningJobKey);
        LOG.info("Interrupt result for {}: {}", runningJobKey, interruptSuccessful);
        if (!interruptSuccessful) {
          LOG.warn(
              "Interrupt returned false for job: {}. "
                  + "Job might not support interruption or already stopped.",
              runningJobKey);
        }
      } catch (Exception e) {
        LOG.error("Failed to interrupt job: {}", runningJobKey, e);
      }

      // Wait briefly for the interrupt to propagate before deleting
      try {
        Thread.sleep(2000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }

      // Delete jobs matching the scope (service-specific or all for global)
      try {
        java.util.Set<JobKey> allJobKeys = scheduler.getJobKeys(jobGroupEquals(APPS_JOB_GROUP));
        for (JobKey jobKey : allJobKeys) {
          if (serviceId != null) {
            String servicePrefix = application.getName() + "-" + serviceId;
            if (jobKey.getName().equals(servicePrefix)
                || jobKey.getName().startsWith(servicePrefix + "-")) {
              deleteJobSafely(jobKey);
            }
          } else {
            if (isJobForApp(jobKey.getName(), application.getName())) {
              deleteJobSafely(jobKey);
            }
          }
        }
      } catch (SchedulerException ex) {
        LOG.error("Failed to delete jobs after stop for app: {}", application.getName(), ex);
      }
    } catch (SchedulerException ex) {
      LOG.error("Failed to stop job execution for app: {}", application.getName(), ex);
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
        runRecord.withEndTime(System.currentTimeMillis());

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

  public void triggerOnDemandApplicationForService(
      App application, UUID serviceId, Map<String, Object> config) {
    if (application.getFullyQualifiedName() == null) {
      throw new IllegalArgumentException("Application's fullyQualifiedName is null.");
    }
    if (serviceId == null) {
      throw new IllegalArgumentException("serviceId cannot be null for service-bound apps");
    }

    try {
      boolean allowConcurrent =
          application.getAllowConcurrentExecution() != null
              && application.getAllowConcurrentExecution();

      String jobIdentity;
      String triggerIdentity;

      String uniqueId = getUniqueJobIdentifier(config);
      if (allowConcurrent && uniqueId != null) {
        jobIdentity =
            String.format("%s-%s-%s-%s", application.getName(), serviceId, ON_DEMAND_JOB, uniqueId);
        triggerIdentity =
            String.format("%s-%s-%s-%s", application.getName(), serviceId, ON_DEMAND_JOB, uniqueId);
        LOG.info(
            "Triggering service-bound app {} for service {} with concurrent execution support. Unique identity: {}",
            application.getName(),
            serviceId,
            jobIdentity);
      } else {
        jobIdentity = getServiceOnDemandJobIdentity(application.getName(), serviceId);
        triggerIdentity = getServiceOnDemandTriggerIdentity(application.getName(), serviceId);

        String scheduledJobIdentity = getServiceJobIdentity(application.getName(), serviceId);
        JobDetail jobDetailScheduled =
            scheduler.getJobDetail(new JobKey(scheduledJobIdentity, APPS_JOB_GROUP));
        JobDetail jobDetailOnDemand =
            scheduler.getJobDetail(new JobKey(jobIdentity, APPS_JOB_GROUP));

        List<JobExecutionContext> currentJobs = scheduler.getCurrentlyExecutingJobs();
        for (JobExecutionContext context : currentJobs) {
          if ((jobDetailScheduled != null
                  && context.getJobDetail().getKey().equals(jobDetailScheduled.getKey()))
              || (jobDetailOnDemand != null
                  && context.getJobDetail().getKey().equals(jobDetailOnDemand.getKey()))) {
            throw new UnhandledServerException(
                "Job is already running for service "
                    + serviceId
                    + ", please wait for it to complete.");
          }
        }
      }

      AppRuntime context = getAppRuntime(application);
      if (Boolean.FALSE.equals(context.getEnabled())) {
        LOG.info(
            "[Applications] Service-bound app {} cannot be triggered since it is disabled",
            application.getName());
        return;
      }

      JobDetail newJobDetail = jobBuilderForService(application, serviceId, jobIdentity);
      newJobDetail.getJobDataMap().put("triggerType", ON_DEMAND_JOB);
      newJobDetail.getJobDataMap().put(APP_NAME, application.getName());
      newJobDetail.getJobDataMap().put(SERVICE_ID, serviceId.toString());
      newJobDetail.getJobDataMap().put(APP_CONFIG_KEY, config);

      Trigger trigger =
          TriggerBuilder.newTrigger()
              .withIdentity(triggerIdentity, APPS_TRIGGER_GROUP)
              .startNow()
              .build();
      scheduler.scheduleJob(newJobDetail, trigger);
      LOG.info(
          "Triggered on-demand service-bound job {} for app {} and service {}",
          jobIdentity,
          application.getName(),
          serviceId);
    } catch (ObjectAlreadyExistsException ex) {
      throw new UnhandledServerException(
          "Job is already running for service " + serviceId + ", please wait for it to complete.");
    } catch (SchedulerException | ClassNotFoundException ex) {
      LOG.error(
          "Failed in running service-bound job for app {} and service {}",
          application.getName(),
          serviceId,
          ex);
    }
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

  /**
   * Returns true if the given Quartz job key belongs to the given app.
   * Covers global ({appName}), on-demand ({appName}-OnDemandJob), and
   * service-bound ({appName}-{serviceId}, {appName}-{serviceId}-OnDemandJob) patterns.
   */
  public static boolean isJobForApp(String jobKeyName, String appName) {
    return jobKeyName.equals(appName) || jobKeyName.startsWith(appName + "-");
  }

  /**
   * Deletes ALL Quartz jobs (global + service-bound + on-demand variants) for the given app.
   */
  public void deleteAllApplicationJobs(App app) throws SchedulerException {
    java.util.Set<JobKey> allJobKeys = scheduler.getJobKeys(jobGroupEquals(APPS_JOB_GROUP));
    for (JobKey jobKey : allJobKeys) {
      if (isJobForApp(jobKey.getName(), app.getName())) {
        LOG.info("Deleting application job: {}", jobKey);
        scheduler.unscheduleJob(new TriggerKey(jobKey.getName(), APPS_TRIGGER_GROUP));
        scheduler.deleteJob(jobKey);
      }
    }
  }

  private void deleteJobSafely(JobKey key) {
    try {
      if (scheduler.getJobDetail(key) != null) {
        LOG.info("Deleting job: {}", key);
        scheduler.unscheduleJob(new TriggerKey(key.getName(), APPS_TRIGGER_GROUP));
        scheduler.deleteJob(key);
      }
    } catch (SchedulerException ex) {
      LOG.error("Failed to delete job: {}", key, ex);
    }
  }

  private String getServiceJobIdentity(String appName, UUID serviceId) {
    return String.format("%s-%s", appName, serviceId);
  }

  private String getServiceTriggerIdentity(String appName, UUID serviceId) {
    return String.format("%s-%s", appName, serviceId);
  }

  private String getServiceOnDemandJobIdentity(String appName, UUID serviceId) {
    return String.format("%s-%s-%s", appName, serviceId, ON_DEMAND_JOB);
  }

  private String getServiceOnDemandTriggerIdentity(String appName, UUID serviceId) {
    return String.format("%s-%s-%s", appName, serviceId, ON_DEMAND_JOB);
  }
}
