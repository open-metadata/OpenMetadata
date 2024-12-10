package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.app.RetentionJobContext;
import org.openmetadata.schema.entity.applications.configuration.internal.RetentionPolicyConfiguration;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.quartz.impl.StdSchedulerFactory;
import org.quartz.impl.matchers.GroupMatcher;

@Slf4j
public class RetentionPolicyScheduler {
  public static final String RETENTION_JOB_GROUP = "OMRetentionJobGroup";
  public static final String RETENTION_TRIGGER_GROUP = "OMRetentionJobGroup";
  public static final String RETENTION_ENTITY = "retentionEntityConfigurationKey";
  public static final String RETENTION_PERIOD_CONTEXT = "retentionPeriodContextKey";
  private static RetentionPolicyScheduler instance;
  private static volatile boolean initialized = false;

  private final Scheduler scheduler = new StdSchedulerFactory().getScheduler();

  public RetentionPolicyScheduler() throws SchedulerException {
    this.scheduler.start();
  }

  @SneakyThrows
  public static RetentionPolicyScheduler getInstance() {
    if (!initialized) {
      initialize();
    }
    return instance;
  }

  private static synchronized void initialize() throws SchedulerException {
    if (!initialized) {
      instance = new RetentionPolicyScheduler();
      initialized = true;
    } else {
      LOG.info("Retention policy scheduler is already initialized");
    }
  }

  /*
   * TODO: Add support for multiple entities with individual retention periods.
   * Example configuration:
   * {
   *   config1: {
   *     entity: [entity1, entity2, entity3],
   *     retentionPeriod: 1 week
   *   },
   *   config2: {
   *     entity: [entity4, entity5],
   *     retentionPeriod: 2 weeks
   *   },
   *   config3: {
   *    entity: [entity6],
   *    retentionPeriod: 1 month
   * }
   */
  public void scheduleCleanupJob(RetentionPolicyConfiguration retentionPolicyConfiguration) {
    if (initialized) {
      try {
        JobDetail jobDetail = jobBuilder(retentionPolicyConfiguration);
        Trigger cleanupTrigger = trigger(retentionPolicyConfiguration);

        // Replace existing job if it exists
        if (scheduler.checkExists(jobDetail.getKey())) {
          scheduler.deleteJob(jobDetail.getKey());
        }

        scheduler.scheduleJob(jobDetail, cleanupTrigger);
        LOG.info("Scheduled cleanup job for entity: {}", retentionPolicyConfiguration.getEntity());
      } catch (SchedulerException e) {
        LOG.error(
            "Failed to schedule retention cleanup job for configuration: {}",
            retentionPolicyConfiguration,
            e);
      }
    } else {
      LOG.warn("Retention policy scheduler is not initialized.");
    }
  }

  private JobDetail jobBuilder(RetentionPolicyConfiguration configuration) {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(RETENTION_ENTITY, configuration);
    dataMap.put(RETENTION_PERIOD_CONTEXT, createRetentionJobContext(configuration));

    String jobIdentity = configuration.getEntity();

    return JobBuilder.newJob(RetentionPolicyCleanupJob.class)
        .withIdentity(jobIdentity, RETENTION_JOB_GROUP)
        .usingJobData(dataMap)
        .build();
  }

  private Trigger trigger(RetentionPolicyConfiguration configuration) {
    RetentionPolicyConfiguration.RetentionPeriod retentionPeriod =
        configuration.getRetentionPeriod();

    long retentionPeriodInMilliseconds = getRetentionPeriodInMilliseconds(retentionPeriod);

    return TriggerBuilder.newTrigger()
        .withIdentity(configuration.getEntity(), RETENTION_TRIGGER_GROUP)
        .withSchedule(
            SimpleScheduleBuilder.simpleSchedule()
                .withIntervalInMilliseconds(retentionPeriodInMilliseconds)
                .repeatForever())
        .startNow()
        .build();
  }

  private long getRetentionPeriodInMilliseconds(
      RetentionPolicyConfiguration.RetentionPeriod retentionPeriod) {
    return switch (retentionPeriod) {
      case ONE_WEEK -> 7L * 24 * 60 * 60 * 1000;
      case TWO_WEEKS -> 14L * 24 * 60 * 60 * 1000;
      case ONE_MONTH -> 30L * 24 * 60 * 60 * 1000;
      case THREE_MONTHS -> 90L * 24 * 60 * 60 * 1000;
      case SIX_MONTHS -> 180L * 24 * 60 * 60 * 1000;
    };
  }

  public RetentionJobContext createRetentionJobContext(RetentionPolicyConfiguration configuration) {
    String entity = configuration.getEntity();
    RetentionPolicyConfiguration.RetentionPeriod retentionPeriod =
        configuration.getRetentionPeriod();

    Instant now = Instant.now();
    Date startedAt = Date.from(now);

    Instant comingRetentionDate = calculateNextRetentionDate(now, retentionPeriod);
    Date nextRetentionDate = Date.from(comingRetentionDate);

    return new RetentionJobContext()
        .withEntity(entity)
        .withRetentionPeriod(retentionPeriod)
        .withStartedAt(startedAt)
        .withComingRetentionDate(nextRetentionDate);
  }

  private Instant calculateNextRetentionDate(
      Instant start, RetentionPolicyConfiguration.RetentionPeriod retentionPeriod) {
    return switch (retentionPeriod) {
      case ONE_WEEK -> start.plus(7, ChronoUnit.DAYS);
      case TWO_WEEKS -> start.plus(14, ChronoUnit.DAYS);
      case ONE_MONTH -> start.plus(30, ChronoUnit.DAYS);
      case THREE_MONTHS -> start.plus(90, ChronoUnit.DAYS);
      case SIX_MONTHS -> start.plus(180, ChronoUnit.DAYS);
    };
  }

  @Transaction
  public void deleteAllRetentionPolicyJobs() throws SchedulerException {
    LOG.info("Deleting and un-scheduling all retention policy jobs.");

    for (String jobGroup : scheduler.getJobGroupNames()) {
      if (RETENTION_JOB_GROUP.equals(jobGroup)) {
        for (JobKey jobKey : scheduler.getJobKeys(GroupMatcher.jobGroupEquals(jobGroup))) {
          try {
            scheduler.deleteJob(jobKey);
            LOG.info("Deleted job: {}", jobKey);
          } catch (SchedulerException e) {
            LOG.error("Failed to delete job: {}", jobKey, e);
          }
        }
      }
    }

    for (String triggerGroup : scheduler.getTriggerGroupNames()) {
      if (RETENTION_TRIGGER_GROUP.equals(triggerGroup)) {
        for (TriggerKey triggerKey :
            scheduler.getTriggerKeys(GroupMatcher.triggerGroupEquals(triggerGroup))) {
          try {
            scheduler.unscheduleJob(triggerKey);
            LOG.info("Unscheduled trigger: {}", triggerKey);
          } catch (SchedulerException e) {
            LOG.error("Failed to unschedule trigger: {}", triggerKey, e);
          }
        }
      }
    }

    LOG.info("All retention policy jobs and triggers have been deleted and unscheduled.");
  }

  public static void shutDown() throws SchedulerException {
    LOG.info("Shutting Down Retention Policy Scheduler");
    if (instance != null) {
      instance.scheduler.shutdown(true);
    }
  }
}
