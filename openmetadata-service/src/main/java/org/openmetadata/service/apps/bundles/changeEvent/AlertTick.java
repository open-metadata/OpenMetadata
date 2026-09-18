package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.quartz.JobExecutionContext;
import org.quartz.SchedulerException;

/**
 * The start of every tick. The stored alert is the authority: the tick reads its row first, does
 * nothing for an alert that is gone or switched off, and only then opens the ledger and runs the
 * consumer the row names. Scheduling can therefore be early or late, but never wrong.
 */
@Slf4j
final class AlertTick {

  private AlertTick() {}

  static void run(AbstractEventConsumer loadedByQuartz, JobExecutionContext context) {
    UUID alertId = UUID.fromString(context.getJobDetail().getKey().getName());
    EventSubscription alert = AlertRows.readOrNull(alertId);
    if (alert == null) {
      removeOwnJob(context, alertId);
    } else if (!Boolean.FALSE.equals(alert.getEnabled())) {
      runEnabled(loadedByQuartz, alert, context);
    }
  }

  private static void runEnabled(
      AbstractEventConsumer loadedByQuartz, EventSubscription alert, JobExecutionContext context) {
    Optional<AlertLedger> ledger = AlertRecord.open(alert);
    if (ledger.isPresent()) {
      if (CopyForOlderServers.ensure(context.getScheduler(), alert, ledger.get().health())) {
        runMeasured(ConsumerLoader.named(alert, loadedByQuartz), alert, ledger.get(), context);
      } else {
        AlertTelemetry.absorbed(AlertTelemetry.TICK_ENDED_WITHOUT_SENDING);
      }
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

  // Alert ids are never reused, so a job whose alert is gone can never be wanted again.
  private static void removeOwnJob(JobExecutionContext context, UUID alertId) {
    try {
      context.getScheduler().deleteJob(context.getJobDetail().getKey());
    } catch (SchedulerException e) {
      LOG.warn("Could not remove the job of deleted alert {}", alertId, e);
    }
  }
}
