package org.openmetadata.service.apps.scheduler;

import static com.cronutils.model.CronType.UNIX;
import static org.openmetadata.service.apps.AbstractNativeApplication.getAppRuntime;
import static org.quartz.impl.matchers.GroupMatcher.jobGroupEquals;

import com.cronutils.mapper.CronMapper;
import com.cronutils.model.Cron;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.parser.CronParser;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.AppException;
import org.openmetadata.service.apps.NativeApplication;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.CronScheduleBuilder;
import org.quartz.CronTrigger;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.ObjectAlreadyExistsException;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.SimpleTrigger;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.impl.StdSchedulerFactory;
import org.quartz.impl.matchers.GroupMatcher;

@Slf4j
public class AppScheduler {
  private static final Map<String, String> defaultAppScheduleConfig = new HashMap<>();
  public static final String ON_DEMAND_JOB = "OnDemandJob";
  private static final String GLOBAL = "global";

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
  public static final String SERVICE_FIELD = "service";
  public static final String TRIGGER_TYPE_FIELD = "triggerType";
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
      dedupeGlobalTriggers();
    } else {
      LOG.info("Reindexing Handler is already initialized");
    }
  }

  private static void dedupeGlobalTriggers() throws SchedulerException {
    // TODO we dont need this if we support properly multiple instances of the same app
    getInstance().getScheduler().getTriggerKeys(GroupMatcher.groupContains(APPS_JOB_GROUP)).stream()
        .filter(triggerKey -> triggerKey.getName().contains(GLOBAL))
        .collect(
            Collectors.groupingBy(
                triggerKey -> triggerKey.getName().split("-")[0],
                Collectors.mapping(triggerKey -> triggerKey, Collectors.toSet())))
        .values()
        .stream()
        .map(ArrayList::new)
        .peek(a -> a.remove(0))
        .flatMap(Collection::stream)
        .forEach(
            triggerKey -> {
              try {
                getInstance().getScheduler().unscheduleJob(triggerKey);
              } catch (SchedulerException e) {
                LOG.error("Failed to unschedule global trigger {}", triggerKey, e);
              }
            });
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

  public JobDetail getOrCreateQuartzJob(App application) {
    try {
      AppRuntime context = getAppRuntime(application);
      if (Boolean.TRUE.equals(context.getEnabled())) {
        JobDetail jobDetail = jobBuilder(application);
        scheduler.addJob(jobDetail, true);
        return scheduler.getJobDetail(jobDetail.getKey());
      } else {
        throw BadRequestException.of(
            String.format(
                "App %s cannot be scheduled since it is disabled", application.getName()));
      }
    } catch (Exception ex) {
      LOG.error("Failed in setting up job Scheduler for Data Reporting", ex);
      throw new UnhandledServerException("Failed in scheduling Job for the Application", ex);
    }
  }

  private static List<Pair<Optional<AppSchedule>, Optional<CronTrigger>>> fullOuterJoinSchedules(
      List<AppSchedule> appSchedules, List<CronTrigger> triggers) {
    Map<String, AppSchedule> scheduleMap =
        appSchedules.stream().collect(Collectors.toMap(s -> s.getId().toString(), s -> s));
    Map<String, CronTrigger> triggerMap =
        triggers.stream().collect(Collectors.toMap(t -> t.getKey().getName(), t -> t));
    return Stream.concat(scheduleMap.keySet().stream(), triggerMap.keySet().stream())
        .distinct()
        .map(
            key -> {
              Optional<AppSchedule> schedule = Optional.ofNullable(scheduleMap.get(key));
              Optional<CronTrigger> trigger = Optional.ofNullable(triggerMap.get(key));
              return Pair.of(schedule, trigger);
            })
        .collect(Collectors.toList());
  }

  public void scheduleApplication(App application) {
    try {
      AppRuntime context = getAppRuntime(application);
      if (Boolean.FALSE.equals(context.getEnabled())) {
        throw BadRequestException.of(
            String.format(
                "App %s cannot be scheduled since it is disabled", application.getName()));
      }
      JobDetail job = getOrCreateQuartzJob(application);
      fullOuterJoinSchedules(
              application.getAppSchedules(),
              scheduler.getTriggersOfJob(job.getKey()).stream()
                  .filter(trigger -> trigger instanceof CronTrigger)
                  .map(trigger -> (CronTrigger) trigger)
                  .toList())
          .forEach(
              pair -> {
                if (pair.getLeft().isEmpty() && pair.getRight().isPresent()) {
                  // cron trigger exists but schedule does not
                  try {
                    scheduler.unscheduleJob(pair.getRight().get().getKey());
                  } catch (SchedulerException e) {
                    throw new RuntimeException(e);
                  }
                } else if (pair.getLeft().isPresent() && pair.getRight().isEmpty()) {
                  // schedule exists but cron trigger does not
                  try {
                    scheduler.scheduleJob(newCronTrigger(job, pair.getLeft().get()));
                  } catch (SchedulerException e) {
                    throw new RuntimeException(e);
                  }
                } else if (pair.getLeft().isPresent()
                    && pair.getRight().isPresent()
                    && !getCronSchedule(pair.getLeft().get())
                        .equals(pair.getRight().get().getCronExpression())) {
                  // both exist but have different cron expressions
                  try {
                    scheduler.unscheduleJob(pair.getRight().get().getKey());
                    scheduler.scheduleJob(newCronTrigger(job, pair.getLeft().get()));
                  } catch (SchedulerException e) {
                    throw new RuntimeException(e);
                  }
                }
              });

    } catch (Exception ex) {
      LOG.error("Failed in setting up schedule for {}", application.getName(), ex);
      throw AppException.byMessage(
          application.getName(), "Failed in scheduling Job for the Application", ex.getMessage());
    }
  }

  public void deleteQuartzJob(App app) throws SchedulerException {
    scheduler.deleteJob(getJobKey(app));
  }

  public void updateJob(JobKey jobKey) throws SchedulerException {
    if (!scheduler.checkExists(jobKey)) {
      throw new UnhandledServerException("Job does not exist: " + jobKey);
    }

    // Retrieve the existing job details
    JobDetail oldJobDetail = scheduler.getJobDetail(jobKey);
    List<? extends Trigger> oldTriggers = scheduler.getTriggersOfJob(jobKey);

    // Delete the job before recreating it
    scheduler.deleteJob(jobKey);

    // Create a new JobDetail with updated JobDataMap
    JobDetail newJobDetail =
        JobBuilder.newJob(oldJobDetail.getJobClass())
            .withIdentity(jobKey)
            .storeDurably(oldJobDetail.isDurable())
            .build();

    // Reschedule job with existing triggers
    scheduler.scheduleJob(newJobDetail, Set.copyOf(oldTriggers), true);

    LOG.info("Job {} updated with new JobDataMap", jobKey);
  }

  private JobDetail jobBuilder(App app) throws ClassNotFoundException {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(APP_NAME, app.getName());
    Class<? extends NativeApplication> clz =
        (Class<? extends NativeApplication>) Class.forName(app.getClassName());
    JobBuilder jobBuilder =
        JobBuilder.newJob(clz)
            .withIdentity(newJobKey(app))
            .usingJobData(dataMap)
            .requestRecovery(false)
            .storeDurably();
    return jobBuilder.build();
  }

  private JobKey newJobKey(App app) {
    return new JobKey(app.getName(), APPS_JOB_GROUP);
  }

  private Trigger newCronTrigger(JobDetail job, AppSchedule schedule) {
    return TriggerBuilder.newTrigger()
        .forJob(job)
        .withIdentity(schedule.getId().toString(), APPS_TRIGGER_GROUP)
        .withSchedule(getCronSchedule(schedule))
        .usingJobData(
            new JobDataMap(
                Optional.ofNullable(schedule.getService())
                    .map(r -> Map.of(SERVICE_FIELD, JsonUtils.pojoToJson(r)))
                    .orElse(Map.of())))
        .build();
  }

  private Trigger newManualRunTrigger(
      JobDetail job, AppSchedule schedule, Map<String, Object> jobData) {
    Optional<Trigger> cronTrigger =
        Optional.ofNullable(schedule)
            .flatMap(
                appSchedule -> {
                  try {
                    return scheduler.getTriggersOfJob(job.getKey()).stream()
                        .filter(trigger -> trigger instanceof CronTrigger)
                        .map(trigger -> (CronTrigger) trigger)
                        .filter(
                            trigger ->
                                Objects.equals(
                                    trigger.getKey().getName(), appSchedule.getId().toString()))
                        .findAny();
                  } catch (SchedulerException e) {
                    throw AppException.byMessage(
                        job.getJobDataMap().getString(APP_NAME),
                        "Failed to get triggers",
                        e.getMessage());
                  }
                });

    return TriggerBuilder.newTrigger()
        .withIdentity(job.getKey().getName() + "-manual", APPS_TRIGGER_GROUP)
        .startNow()
        .withSchedule(SimpleScheduleBuilder.simpleSchedule().withRepeatCount(0))
        .forJob(job)
        .usingJobData(cronTrigger.map(Trigger::getJobDataMap).orElse(new JobDataMap()))
        .usingJobData(new JobDataMap(jobData))
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

  public void triggerOnDemandApplication(
      App app, AppSchedule schedule, Map<String, Object> config) {
    try {
      AppRuntime context = getAppRuntime(app);
      if (Boolean.FALSE.equals(context.getEnabled())) {
        throw BadRequestException.of(
            String.format("App %s cannot be scheduled since it is disabled", app.getName()));
      }
      JobDetail jobDetail = getOrCreateQuartzJob(app);
      Trigger trigger = newManualRunTrigger(jobDetail, schedule, config);
      Optional<JobExecutionContext> currentJobs =
          scheduler.getCurrentlyExecutingJobs().stream()
              .filter(
                  jobExecutionContext ->
                      jobExecutionContext.getJobDetail().getKey().getGroup().equals(APPS_JOB_GROUP)
                          && jobExecutionContext
                              .getJobDetail()
                              .getJobDataMap()
                              .get(APP_NAME)
                              .equals(app.getName())
                          && jobExecutionContext
                              .getTrigger()
                              .getKey()
                              .getName()
                              .equals(trigger.getKey().getName()))
              .findAny();
      scheduler.scheduleJob(trigger);
      if (currentJobs.isPresent()) {
        throw BadRequestException.of("Job is already running, please wait for it to complete.");
      }
    } catch (ObjectAlreadyExistsException ex) {
      throw new UnhandledServerException("Job is already running, please wait for it to complete.");
    } catch (SchedulerException ex) {
      throw new UnhandledServerException("Failed in running job for application {}", ex);
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
      for (JobExecutionContext context : currentJobs) {
        if ((jobDetailScheduled != null
                && context.getJobDetail().getKey().equals(jobDetailScheduled.getKey()))
            || (jobDetailOnDemand != null
                && context.getJobDetail().getKey().equals(jobDetailOnDemand.getKey()))) {
          isJobRunning = true;
        }
      }
      if (!isJobRunning) {
        throw new UnhandledServerException("There is no job running for the application.");
      }
      JobKey scheduledJobKey = new JobKey(application.getName(), APPS_JOB_GROUP);
      if (jobDetailScheduled != null) {
        LOG.debug("Stopping Scheduled Execution for App: {}", application.getName());
        scheduler.interrupt(scheduledJobKey);
        try {
          scheduler.deleteJob(scheduledJobKey);
        } catch (SchedulerException ex) {
          LOG.error("Failed to delete scheduled job: {}", scheduledJobKey, ex);
        }
      } else {
        JobKey onDemandJobKey =
            new JobKey(
                String.format("%s-%s", application.getName(), ON_DEMAND_JOB), APPS_JOB_GROUP);
        if (jobDetailOnDemand != null) {
          LOG.debug("Stopping On Demand Execution for App: {}", application.getName());
          scheduler.interrupt(onDemandJobKey);
          try {
            scheduler.deleteJob(onDemandJobKey);
          } catch (SchedulerException ex) {
            LOG.error("Failed to delete on-demand job: {}", onDemandJobKey, ex);
          }
        }
      }
    } catch (SchedulerException ex) {
      LOG.error("Failed to stop job execution for app: {}", application.getName(), ex);
    }
  }

  private static <T> T tryCast(Object o) {
    try {
      return (T) o;
    } catch (ClassCastException e) {
      return null;
    }
  }

  public List<AppSchedule> listAppSchedules(App app) {
    try {
      Map<Boolean, List<Trigger>> partitioned =
          scheduler.getTriggersOfJob(getJobKey(app)).stream()
              .collect(Collectors.partitioningBy(t -> t instanceof CronTrigger));
      List<AppSchedule> result = new ArrayList<>();
      partitioned.get(true).stream()
          .map(t -> (CronTrigger) tryCast(t))
          .filter(Objects::nonNull)
          .map(
              trigger ->
                  new AppSchedule()
                      .withCronExpression(trigger.getCronExpression())
                      .withScheduleTimeline(ScheduleTimeline.CUSTOM)
                      .withId(UUID.fromString(trigger.getKey().getName()))
                      .withService(
                          JsonUtils.readValue(
                              (String) trigger.getJobDataMap().get(SERVICE_FIELD),
                              EntityReference.class)))
          .forEach(result::add);
      partitioned.get(false).stream()
          .map(t -> (SimpleTrigger) tryCast(t))
          .filter(Objects::nonNull)
          .map(
              trigger ->
                  new AppSchedule()
                      .withScheduleTimeline(convertToScheduleTimeline(trigger.getRepeatInterval()))
                      .withId(UUID.fromString(trigger.getKey().getName()))
                      .withService(
                          JsonUtils.readValue(
                              (String) trigger.getJobDataMap().get(SERVICE_FIELD),
                              EntityReference.class)))
          .forEach(result::add);
      return result;
    } catch (SchedulerException ex) {
      throw new UnhandledServerException("Failed to list schedules for the application", ex);
    }
  }

  private ScheduleTimeline convertToScheduleTimeline(long repeatInterval) {
    if (repeatInterval == 3600000) {
      return ScheduleTimeline.HOURLY;
    } else if (repeatInterval == 86400000) {
      return ScheduleTimeline.DAILY;
    } else if (repeatInterval == 604800000) {
      return ScheduleTimeline.WEEKLY;
    } else if (repeatInterval == 2592000000L) {
      return ScheduleTimeline.MONTHLY;
    } else {
      LOG.error("Invalid repeat interval: {}", repeatInterval);
      return ScheduleTimeline.NONE;
    }
  }

  public void deleteSchedule(App app, UUID scheduleId) {
    try {
      JobDetail jobDetail = scheduler.getJobDetail(new JobKey(app.getName(), APPS_JOB_GROUP));
      scheduler.getTriggersOfJob(jobDetail.getKey()).stream()
          .filter(
              trigger ->
                  trigger.getKey().getName().equals(scheduleId.toString())
                      && trigger instanceof CronTrigger)
          .map(t -> (CronTrigger) t)
          .findFirst()
          .ifPresentOrElse(
              trigger -> {
                try {
                  scheduler.unscheduleJob(trigger.getKey());
                } catch (SchedulerException ex) {
                  throw new UnhandledServerException(
                      "Failed to unschedule the schedule for the application", ex);
                }
              },
              () -> {
                throw EntityNotFoundException.byMessage(
                    String.format(
                        "Schedule with key %s not found for application %s",
                        scheduleId, app.getName()));
              });
    } catch (SchedulerException ex) {
      throw new UnhandledServerException("Failed to delete schedule for the application", ex);
    }
  }

  public static JobKey getJobKey(App app) {
    return new JobKey(app.getName(), APPS_JOB_GROUP);
  }

  public void deleteApplication(App app) {
    JobDetail job = getOrCreateQuartzJob(app);
    try {
      scheduler
          .getTriggersOfJob(job.getKey())
          .forEach(
              trigger -> {
                try {
                  scheduler.unscheduleJob(trigger.getKey());
                } catch (SchedulerException e) {
                  throw AppException.byMessage(
                      app.getName(), "Failed to unschedule the schedule", e.getMessage());
                }
              });
      scheduler.deleteJob(job.getKey());
    } catch (SchedulerException e) {
      throw AppException.byMessage(app.getName(), "Failed to delete job", e.getMessage());
    }
  }
}
