package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.scheduled.AlertJobs;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.JobKey;
import org.quartz.SchedulerException;

/**
 * The start of every tick. The stored alert is the authority: the tick reads its row first. For an
 * alert that is gone or switched off it sends nothing and brings the job in step with the row,
 * which removes it; otherwise it opens the ledger and runs the consumer the row names. Scheduling
 * can therefore be early or late, but never wrong.
 *
 * <p>A job that names no alert is refused: its trigger stops, and the job itself is left alone.
 */
@Slf4j
final class AlertTick {

  private AlertTick() {}

  static void run(AbstractEventConsumer loadedByQuartz, JobExecutionContext context)
      throws JobExecutionException {
    UUID alertId = alertOf(context).orElseThrow(() -> refusal(context.getJobDetail().getKey()));
    EventSubscription alert = AlertRows.readOrNull(alertId);
    if (alert != null && !Boolean.FALSE.equals(alert.getEnabled())) {
      runEnabled(loadedByQuartz, alert, context);
    } else {
      AlertJobs.converge(alertId);
    }
  }

  // A job store that cannot answer is not a refusal, so this trigger keeps firing.
  private static Optional<UUID> alertOf(JobExecutionContext context) throws JobExecutionException {
    try {
      return AlertJobs.alertOf(context);
    } catch (SchedulerException undecided) {
      throw new JobExecutionException(undecided);
    }
  }

  private static JobExecutionException refusal(JobKey key) {
    String shown = AlertJobs.printable(key.toString());
    LOG.warn("Job {} names no alert, so its trigger stops", shown);
    AlertTelemetry.absorbed(AlertTelemetry.FOREIGN_JOB_REFUSED);
    JobExecutionException refusal = new JobExecutionException("Job names no alert: " + shown);
    refusal.setUnscheduleFiringTrigger(true);
    return refusal;
  }

  private static void runEnabled(
      AbstractEventConsumer loadedByQuartz, EventSubscription alert, JobExecutionContext context) {
    Optional<AlertLedger> ledger = AlertRecord.open(alert);
    if (ledger.isPresent()) {
      runMeasured(ConsumerLoader.named(alert, loadedByQuartz), alert, ledger.get(), context);
    }
  }

  private static void runMeasured(
      AbstractEventConsumer consumer,
      EventSubscription alert,
      AlertLedger ledger,
      JobExecutionContext context) {
    long startedAt = System.currentTimeMillis();
    if (context.getScheduledFireTime() != null) {
      AlertTelemetry.triggerWasLate(startedAt - context.getScheduledFireTime().getTime());
    }
    try {
      consumer.tick(alert, ledger, context);
    } finally {
      AlertTelemetry.tickTook(System.currentTimeMillis() - startedAt);
    }
  }
}
