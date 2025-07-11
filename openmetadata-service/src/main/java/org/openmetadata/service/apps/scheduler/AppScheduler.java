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
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.NativeApplication;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.search.SearchRepository;
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

    ScheduledExecutorService threadScheduler = Executors.newScheduledThreadPool(1);
    threadScheduler.scheduleAtFixedRate(this::resetErrorTriggers, 0, 24, TimeUnit.HOURS);

    // Start Scheduler
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
      JobDetail jobDetailScheduled =
          scheduler.getJobDetail(new JobKey(application.getName(), APPS_JOB_GROUP));
      JobDetail jobDetailOnDemand =
          scheduler.getJobDetail(
              new JobKey(
                  String.format("%s-%s", application.getName(), ON_DEMAND_JOB), APPS_JOB_GROUP));
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

      AppRuntime context = getAppRuntime(application);
      if (Boolean.FALSE.equals(context.getEnabled())) {
        LOG.info("[Applications] App cannot be scheduled since it is disabled");
        return;
      }
      JobDetail newJobDetail =
          jobBuilder(application, String.format("%s-%s", application.getName(), ON_DEMAND_JOB));
      newJobDetail.getJobDataMap().put("triggerType", ON_DEMAND_JOB);
      newJobDetail.getJobDataMap().put(APP_NAME, application.getFullyQualifiedName());
      newJobDetail.getJobDataMap().put(APP_CONFIG_KEY, config);
      Trigger trigger =
          TriggerBuilder.newTrigger()
              .withIdentity(
                  String.format("%s-%s", application.getName(), ON_DEMAND_JOB), APPS_TRIGGER_GROUP)
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
    try {
      JobDetail jobDetailScheduled =
          scheduler.getJobDetail(new JobKey(application.getName(), APPS_JOB_GROUP));
      JobDetail jobDetailOnDemand =
          scheduler.getJobDetail(
              new JobKey(
                  String.format("%s-%s", application.getName(), ON_DEMAND_JOB), APPS_JOB_GROUP));
      boolean isJobRunning = false;
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
          LOG.info("Found matching job for application: {}", application.getName());
        }
      }
      if (!isJobRunning) {
        LOG.error(
            "No running job found for application: {}. Scheduled key: {}, OnDemand key: {}",
            application.getName(),
            jobDetailScheduled != null ? jobDetailScheduled.getKey() : "null",
            jobDetailOnDemand != null ? jobDetailOnDemand.getKey() : "null");
        throw new UnhandledServerException("There is no job running for the application.");
      }
      // Try to interrupt the running job first
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

      // Delete the job after interrupting
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
}
