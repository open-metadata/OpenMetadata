package org.openmetadata.mcp.server.auth.jobs;

import lombok.extern.slf4j.Slf4j;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.impl.StdSchedulerFactory;

@Slf4j
public class OAuthTokenCleanupScheduler {
  private static final String JOB_NAME = "oauthTokenCleanupJob";
  private static final String JOB_GROUP = "oauthMaintenance";
  private static final String TRIGGER_NAME = "oauthTokenCleanupTrigger";
  private static final int CLEANUP_INTERVAL_HOURS = 1;

  private static OAuthTokenCleanupScheduler instance;
  private final Scheduler scheduler;

  private OAuthTokenCleanupScheduler() throws SchedulerException {
    this.scheduler = new StdSchedulerFactory().getScheduler();
    this.scheduler.start();
    LOG.info("OAuth Token Cleanup Scheduler started");
  }

  public static synchronized void initialize() {
    if (instance == null) {
      try {
        instance = new OAuthTokenCleanupScheduler();
        instance.scheduleCleanupJob();
        LOG.info(
            "OAuth token cleanup job scheduled to run every {} hour(s)", CLEANUP_INTERVAL_HOURS);
      } catch (SchedulerException e) {
        LOG.error("Failed to initialize OAuth Token Cleanup Scheduler", e);
        throw new RuntimeException("Failed to initialize OAuth Token Cleanup Scheduler", e);
      }
    } else {
      LOG.debug("OAuth Token Cleanup Scheduler already initialized");
    }
  }

  private void scheduleCleanupJob() throws SchedulerException {
    JobDetail jobDetail =
        JobBuilder.newJob(OAuthTokenCleanupJob.class).withIdentity(JOB_NAME, JOB_GROUP).build();

    Trigger trigger =
        TriggerBuilder.newTrigger()
            .withIdentity(TRIGGER_NAME, JOB_GROUP)
            .withSchedule(
                SimpleScheduleBuilder.simpleSchedule()
                    .withIntervalInHours(CLEANUP_INTERVAL_HOURS)
                    .repeatForever())
            .startNow()
            .build();

    scheduler.scheduleJob(jobDetail, trigger);
  }

  public static void shutdown() {
    if (instance != null && instance.scheduler != null) {
      try {
        instance.scheduler.shutdown(true);
        LOG.info("OAuth Token Cleanup Scheduler shut down");
      } catch (SchedulerException e) {
        LOG.error("Failed to shutdown OAuth Token Cleanup Scheduler", e);
      }
    }
  }
}
