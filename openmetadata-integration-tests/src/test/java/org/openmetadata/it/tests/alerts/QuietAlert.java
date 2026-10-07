package org.openmetadata.it.tests.alerts;

import java.time.Duration;
import org.awaitility.Awaitility;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.scheduled.AlertJobs;
import org.quartz.JobExecutionContext;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerKey;

/**
 * Brings a freshly created alert to rest, so the only tick that reads a test's events is the one
 * the test drives itself.
 */
final class QuietAlert {

  private QuietAlert() {}

  static void settle(EventSubscription alert) {
    awaitFirstScheduledTick(alert);
    drainWhatSetupProduced(alert);
  }

  // A new alert's trigger fires at once. Waiting for that tick to finish leaves the next one a
  // day away, so only the tick this test drives reads the fixture events.
  /**
   * After an edit the alert's job is scheduled again and fires at once, on whichever server takes
   * it. A tick driven directly must not run beside it, so this waits until that tick is over.
   * The trigger's state comes from the job store, so it is true for the whole cluster.
   */
  static void awaitScheduledTickIsOver(EventSubscription alert) {
    Scheduler scheduler = AlertFixtures.scheduler();
    TriggerKey key = new TriggerKey(alert.getId().toString(), AlertJobs.TRIGGER_GROUP);
    Awaitility.await("the scheduled tick of " + alert.getName() + " to be over")
        .pollDelay(Duration.ofSeconds(1))
        .atMost(Duration.ofSeconds(90))
        .until(
            () ->
                hasFired(scheduler, alert.getId().toString())
                    && scheduler.getTriggerState(key) == Trigger.TriggerState.NORMAL);
  }

  private static void awaitFirstScheduledTick(EventSubscription alert) {
    Scheduler scheduler = AlertFixtures.scheduler();
    String jobName = alert.getId().toString();
    Awaitility.await("first scheduled tick of " + alert.getName())
        .atMost(Duration.ofSeconds(60))
        .until(() -> hasFired(scheduler, jobName) && !isRunning(scheduler, jobName));
  }

  // Creating the alert writes change events of its own, some of them after the request returns.
  // They match nothing here, but an alert counts every event it reads, so they are read first.
  private static void drainWhatSetupProduced(EventSubscription alert) {
    long[] lastSeen = {-1L, 0L};
    Awaitility.await("change events of the setup to settle")
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(60))
        .until(() -> unchangedForFourReads(lastSeen));
    DirectTick.run(alert);
  }

  private static boolean unchangedForFourReads(long[] lastSeen) {
    long latest = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    lastSeen[1] = latest == lastSeen[0] ? lastSeen[1] + 1 : 0;
    lastSeen[0] = latest;
    return lastSeen[1] >= 4;
  }

  private static boolean hasFired(Scheduler scheduler, String jobName) throws SchedulerException {
    Trigger trigger = scheduler.getTrigger(new TriggerKey(jobName, AlertJobs.TRIGGER_GROUP));
    return trigger != null && trigger.getPreviousFireTime() != null;
  }

  private static boolean isRunning(Scheduler scheduler, String jobName) throws SchedulerException {
    boolean running = false;
    for (JobExecutionContext context : scheduler.getCurrentlyExecutingJobs()) {
      running = running || jobName.equals(context.getJobDetail().getKey().getName());
    }
    return running;
  }
}
