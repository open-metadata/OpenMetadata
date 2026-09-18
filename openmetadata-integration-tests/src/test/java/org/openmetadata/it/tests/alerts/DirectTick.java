package org.openmetadata.it.tests.alerts;

import java.util.Date;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.TriggerBuilder;
import org.quartz.impl.JobExecutionContextImpl;
import org.quartz.spi.OperableTrigger;
import org.quartz.spi.TriggerFiredBundle;

/**
 * Runs one tick of an alert's own job on the calling thread, against the real database and job
 * store, without Quartz deciding when. That keeps a test's output independent of scheduling, and
 * it is how a second node is simulated.
 */
final class DirectTick {

  private DirectTick() {}

  static void run(EventSubscription alert) {
    Scheduler scheduler = EventSubscriptionScheduler.getInstance().getAlertsScheduler();
    run(alert, jobOf(scheduler, alert));
  }

  /** With a job read earlier, for a tick that fires after its alert was disabled or deleted. */
  static void run(EventSubscription alert, JobDetail jobDetail) {
    Scheduler scheduler = EventSubscriptionScheduler.getInstance().getAlertsScheduler();
    AlertPublisher job = new AlertPublisher(new DIContainer());
    job.execute(new JobExecutionContextImpl(scheduler, firedNow(jobDetail), job));
  }

  private static JobDetail jobOf(Scheduler scheduler, EventSubscription alert) {
    JobKey jobKey =
        new JobKey(alert.getId().toString(), EventSubscriptionScheduler.ALERT_JOB_GROUP);
    try {
      return scheduler.getJobDetail(jobKey);
    } catch (SchedulerException e) {
      throw new IllegalStateException("No job for alert " + alert.getName(), e);
    }
  }

  private static TriggerFiredBundle firedNow(JobDetail jobDetail) {
    OperableTrigger trigger =
        (OperableTrigger)
            TriggerBuilder.newTrigger()
                .withIdentity("direct-" + jobDetail.getKey().getName())
                .forJob(jobDetail)
                .startNow()
                .build();
    Date now = new Date();
    return new TriggerFiredBundle(jobDetail, trigger, null, false, now, now, null, null);
  }
}
