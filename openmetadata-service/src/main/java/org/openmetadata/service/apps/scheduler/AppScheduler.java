package org.openmetadata.service.apps.scheduler;

import static org.openmetadata.service.apps.AbstractNativeApplication.getAppRuntime;
import static org.quartz.impl.matchers.GroupMatcher.jobGroupEquals;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.AppRuntime;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunType;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.service.apps.NativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.CronScheduleBuilder;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.impl.StdSchedulerFactory;

@Slf4j
public class AppScheduler {
  public static final String APPS_JOB_GROUP = "OMAppsJobGroup";
  public static final String APPS_TRIGGER_GROUP = "OMAppsJobGroup";
  public static final String APP_CRON_TRIGGER = "appCronTrigger";
  public static final String APP_INFO_KEY = "applicationInfoKey";
  public static final String COLLECTION_DAO_KEY = "daoKey";
  public static final String SEARCH_CLIENT_KEY = "searchClientKey";
  private static AppScheduler instance;
  private static volatile boolean initialized = false;
  private final Scheduler appScheduler;
  private static final ConcurrentHashMap<UUID, JobDetail> appJobsKeyMap = new ConcurrentHashMap<>();
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchClient;

  private AppScheduler(CollectionDAO dao, SearchRepository searchClient) throws SchedulerException {
    this.collectionDAO = dao;
    this.searchClient = searchClient;
    this.appScheduler = new StdSchedulerFactory().getScheduler();
    // Add OMJob Listener
    this.appScheduler
        .getListenerManager()
        .addJobListener(new OmAppJobListener(dao), jobGroupEquals(APPS_JOB_GROUP));
    this.appScheduler.start();
  }

  public static void initialize(CollectionDAO dao, SearchRepository searchClient)
      throws SchedulerException {
    if (!initialized) {
      instance = new AppScheduler(dao, searchClient);
      initialized = true;
    } else {
      LOG.info("Reindexing Handler is already initialized");
    }
  }

  public static AppScheduler getInstance() {
    if (initialized) return instance;
    throw new RuntimeException("App Scheduler is not Initialized");
  }

  public ConcurrentMap<UUID, JobDetail> getReportMap() {
    return appJobsKeyMap;
  }

  public void addApplicationSchedule(App application) {
    try {
      AppRuntime context = getAppRuntime(application);
      if (Boolean.TRUE.equals(context.getEnabled())) {
        JobDetail jobDetail =
            jobBuilder(application, String.format("%s", application.getId().toString()));
        Trigger trigger = trigger(application);
        appScheduler.scheduleJob(jobDetail, trigger);
        appJobsKeyMap.put(application.getId(), jobDetail);
      } else {
        LOG.info("[Applications] App cannot be scheduled since it is disabled");
      }
    } catch (Exception ex) {
      LOG.error("Failed in setting up job Scheduler for Data Reporting", ex);
      throw new RuntimeException("Failed in scheduling Job for the Application", ex);
    }
  }

  public void deleteScheduledApplication(App app) throws SchedulerException {
    JobDetail jobDetail = getJobKey(app.getId());
    if (jobDetail != null) {
      appScheduler.deleteJob(jobDetail.getKey());
      appJobsKeyMap.remove(app.getId());
    }
  }

  private JobDetail jobBuilder(App app, String jobIdentity) throws ClassNotFoundException {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(APP_INFO_KEY, app);
    dataMap.put(COLLECTION_DAO_KEY, collectionDAO);
    dataMap.put(SEARCH_CLIENT_KEY, searchClient);
    dataMap.put("triggerType", AppRunType.Scheduled.value());
    Class<? extends NativeApplication> clz =
        (Class<? extends NativeApplication>) Class.forName(app.getClassName());
    JobBuilder jobBuilder =
        JobBuilder.newJob(clz).withIdentity(jobIdentity, APPS_JOB_GROUP).usingJobData(dataMap);
    return jobBuilder.build();
  }

  private Trigger trigger(App app) {
    return TriggerBuilder.newTrigger()
        .withIdentity(app.getId().toString(), APPS_TRIGGER_GROUP)
        .withSchedule(getCronSchedule(app.getAppSchedule()))
        .build();
  }

  private JobDetail getJobKey(UUID id) {
    return appJobsKeyMap.get(id);
  }

  public static void shutDown() throws SchedulerException {
    if (instance != null) {
      instance.appScheduler.shutdown();
    }
  }

  public static CronScheduleBuilder getCronSchedule(AppSchedule scheduleInfo) {
    switch (scheduleInfo.getScheduleType()) {
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
          return CronScheduleBuilder.cronSchedule(scheduleInfo.getCronExpression());
        } else {
          throw new IllegalArgumentException("Missing Cron Expression for Custom Schedule.");
        }
    }
    throw new IllegalArgumentException("Invalid Trigger Info for the scheduled application.");
  }

  public void triggerOnDemandApplication(App application) {
    try {
      AppRuntime context = getAppRuntime(application);
      if (Boolean.TRUE.equals(context.getEnabled())) {
        JobDetail jobDetail =
            jobBuilder(
                application,
                String.format("%s.onDemand.%s", application.getId().toString(), UUID.randomUUID()));
        jobDetail.getJobDataMap().put("triggerType", AppRunType.OnDemand.value());
        Trigger trigger =
            TriggerBuilder.newTrigger()
                .withIdentity(application.toString(), APPS_TRIGGER_GROUP)
                .startNow()
                .build();
        appScheduler.scheduleJob(jobDetail, trigger);
        appJobsKeyMap.put(application.getId(), jobDetail);
      } else {
        LOG.info("[Applications] App cannot be scheduled since it is disabled");
      }
    } catch (Exception ex) {
      LOG.error("Failed in running job", ex);
    }
  }
}
