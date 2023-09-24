package org.openmetadata.service.apps.scheduler;

import static org.quartz.impl.matchers.GroupMatcher.jobGroupEquals;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.AppRunType;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.Application;
import org.openmetadata.schema.entity.app.RuntimeContext;
import org.openmetadata.service.apps.NativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
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
  public static final String APP_INFO = "applicationInfo";
  public static final String COLLECTION_DAO_KEY = "dao";
  public static final String SEARCH_CLIENT_KEY = "searchClient";
  public static final String APP_SCHEDULE_INFO = "AppScheduleInfo";
  private static AppScheduler instance;
  private static volatile boolean initialized = false;
  private final Scheduler appScheduler;
  private static final ConcurrentHashMap<UUID, JobDetail> appJobsKeyMap = new ConcurrentHashMap<>();
  private final CollectionDAO collectionDAO;
  private final SearchClient searchClient;

  private AppScheduler(CollectionDAO dao, SearchClient searchClient) throws SchedulerException {
    this.collectionDAO = dao;
    this.searchClient = searchClient;
    this.appScheduler = new StdSchedulerFactory().getScheduler();
    // Add OMJob Listener
    this.appScheduler.getListenerManager().addJobListener(new OmAppJobListener(dao), jobGroupEquals(APPS_JOB_GROUP));
    this.appScheduler.start();
  }

  public static void initialize(CollectionDAO dao, SearchClient searchClient) throws SchedulerException {
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

  public void addApplicationSchedule(Application application, AppSchedule schedule) {
    try {
      RuntimeContext context = application.getExecutionContext().getScheduled();
      if (Boolean.TRUE.equals(context.getEnabled())) {
        JobDetail jobDetail =
            jobBuilder(
                application,
                String.format("%s.%s", application.getId().toString(), schedule.getScheduleId().toString()));
        jobDetail.getJobDataMap().put(APP_SCHEDULE_INFO, schedule);
        Trigger trigger = trigger(application.getId(), schedule);
        appScheduler.scheduleJob(jobDetail, trigger);
        appJobsKeyMap.put(application.getId(), jobDetail);
      } else {
        LOG.info("[Applications] App cannot be scheduled since it is disabled");
      }
    } catch (Exception ex) {
      LOG.error("Failed in setting up job Scheduler for Data Reporting", ex);
    }
  }

  // TODO:
  //  public void updateDataReportConfig(Application app) throws SchedulerException {
  //    deleteScheduledApplication(app);
  //    addApplicationSchedule(app);
  //  }

  public void deleteScheduledApplication(Application app) throws SchedulerException {
    JobDetail jobDetail = getJobKey(app.getId());
    if (jobDetail != null) {
      appScheduler.deleteJob(jobDetail.getKey());
      appJobsKeyMap.remove(app.getId());
    }
  }

  private JobDetail jobBuilder(Application app, String jobIdentity) throws ClassNotFoundException {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(APP_INFO, app);
    dataMap.put(COLLECTION_DAO_KEY, collectionDAO);
    dataMap.put(SEARCH_CLIENT_KEY, searchClient);
    dataMap.put("triggerType", AppRunType.Scheduled.value());
    RuntimeContext context = app.getExecutionContext().getScheduled();
    Class<? extends NativeApplication> clz = (Class<? extends NativeApplication>) Class.forName(context.getClassName());
    JobBuilder jobBuilder = JobBuilder.newJob(clz).withIdentity(jobIdentity, APPS_JOB_GROUP).usingJobData(dataMap);
    return jobBuilder.build();
  }

  private Trigger trigger(UUID appId, AppSchedule config) {
    return TriggerBuilder.newTrigger()
        .withIdentity(appId.toString(), APPS_TRIGGER_GROUP)
        .withSchedule(getCronSchedule(config))
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

  public void triggerOnDemandApplication(Application application) {
    try {
      RuntimeContext context = application.getExecutionContext().getScheduled();
      if (Boolean.TRUE.equals(context.getEnabled())) {
        JobDetail jobDetail =
            jobBuilder(application, String.format("%s.onDemand.%s", application.getId().toString(), UUID.randomUUID()));
        jobDetail.getJobDataMap().put("triggerType", AppRunType.OnDemand.value());
        Trigger trigger =
            TriggerBuilder.newTrigger().withIdentity(application.toString(), APPS_TRIGGER_GROUP).startNow().build();
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
