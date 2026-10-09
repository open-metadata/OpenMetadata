package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.consumer.ConsumerJob;
import org.openmetadata.service.events.scheduled.AlertJobs;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.scheduled.ReconcileRound;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.JobPersistenceException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;

/** The repairs the reconciler makes between restarts, and what it must leave alone. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertReconcilerIT {

  // Far older than one poll interval of these alerts, which is a day, plus the misfire threshold.
  private static final String LONG_AGO =
      String.valueOf(System.currentTimeMillis() - Duration.ofDays(3).toMillis());

  @Test
  void reconcilerRearmsStuckTrigger(TestNamespace ns) throws Exception {
    EventSubscription inError = alert(ns, "trigger_in_error", null);
    EventSubscription frozen = alert(ns, "trigger_frozen", null);
    QuietAlert.settle(inError);
    QuietAlert.settle(frozen);
    AlertFixtures.updateTrigger("TRIGGER_STATE = 'ERROR'", inError.getId());
    AlertFixtures.updateTrigger("NEXT_FIRE_TIME = " + LONG_AGO, frozen.getId());

    EventSubscriptionScheduler.getInstance().reconcileNow();

    // A re-armed trigger fires at once, and is BLOCKED for as long as that tick runs.
    QuietAlert.awaitScheduledTickIsOver(inError);
    assertEquals(Trigger.TriggerState.NORMAL, stateOf(inError));
    Date nextFire =
        AlertFixtures.scheduler()
            .getTrigger(AlertFixtures.triggerKey(frozen.getId()))
            .getNextFireTime();
    assertTrue(nextFire.getTime() > System.currentTimeMillis() - 60_000L);
  }

  // A job stored before this release carries the class its alert names.
  @Test
  void reconcilerConvertsJobsStoredWithTheNamedClass(TestNamespace ns) throws Exception {
    EventSubscription alert = alert(ns, "named_class", LatchedConsumer.ID);
    JobKey key = AlertFixtures.jobKey(alert.getId());
    AlertFixtures.scheduler()
        .addJob(JobBuilder.newJob(LatchedConsumer.class).withIdentity(key).build(), true, true);

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertEquals(ConsumerJob.class, AlertFixtures.scheduler().getJobDetail(key).getJobClass());
  }

  // After an upgrade, a job can name a consumer class this release no longer has.
  @Test
  void jobWhoseClassNoLongerLoadsIsReplaced(TestNamespace ns) throws Exception {
    EventSubscription alert = alert(ns, "class_gone", null);
    QuietAlert.settle(alert);
    AlertFixtures.updateJob(
        "JOB_CLASS_NAME = 'org.openmetadata.service.removed.OldConsumer'", alert.getId());

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertEquals(
        ConsumerJob.class,
        AlertFixtures.scheduler().getJobDetail(AlertFixtures.jobKey(alert.getId())).getJobClass());
  }

  // A job naming a class that loads but is not a job cannot even be read, and while its trigger is
  // due the scheduler acquires nothing else: every alert and the audit log stop. The reconciler
  // replaces it, and the others carry on.
  @Test
  void jobWhoseClassIsNotAJobIsReplacedAndTheSchedulerCarriesOn(TestNamespace ns) throws Exception {
    EventSubscription broken = alert(ns, "class_not_a_job", null);
    EventSubscription other = alert(ns, "beside_class_not_a_job", null);
    QuietAlert.settle(broken);
    QuietAlert.settle(other);
    JobKey brokenJob = AlertFixtures.jobKey(broken.getId());
    AlertFixtures.updateJob("JOB_CLASS_NAME = 'java.lang.String'", broken.getId());
    AlertFixtures.updateTrigger("NEXT_FIRE_TIME = " + System.currentTimeMillis(), broken.getId());
    assertThrows(
        JobPersistenceException.class, () -> AlertFixtures.scheduler().getJobDetail(brokenJob));

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertEquals(
        ConsumerJob.class, AlertFixtures.scheduler().getJobDetail(brokenJob).getJobClass());
    long auditLogBefore = auditLogOffset();
    long otherBefore = AlertFixtures.offsetOf(other.getId());
    FixtureEvents.insert(FixtureEvents.tableEvents());
    AlertFixtures.scheduler().triggerJob(AlertFixtures.jobKey(other.getId()));
    Awaitility.await("the other alert and the audit log to read the new events")
        .atMost(Duration.ofSeconds(60))
        .until(
            () ->
                AlertFixtures.offsetOf(other.getId()) > otherBefore
                    && auditLogOffset() > auditLogBefore);
  }

  // While its own tick runs, a trigger is BLOCKED and its fire time can look arbitrarily old.
  @Test
  void reconcilerLeavesARunningTickAlone(TestNamespace ns) throws Exception {
    EventSubscription alert = alert(ns, "running_tick", LatchedConsumer.ID);
    QuietAlert.settle(alert);
    LatchedConsumer.Gate gate = LatchedConsumer.arm(alert.getId());
    try {
      FixtureEvents.insert(FixtureEvents.tableEvents());
      AlertFixtures.scheduler().triggerJob(AlertFixtures.jobKey(alert.getId()));
      assertTrue(gate.awaitReached());
      AlertFixtures.updateTrigger("NEXT_FIRE_TIME = " + LONG_AGO, alert.getId());
      Date armedAt = startTimeOf(alert);

      EventSubscriptionScheduler.getInstance().reconcileNow();

      assertEquals(armedAt, startTimeOf(alert), "a replaced trigger would have a new start time");
    } finally {
      LatchedConsumer.disarm(alert.getId());
    }
    Awaitility.await("the held tick to finish")
        .atMost(Duration.ofSeconds(60))
        .until(() -> stateOf(alert) != Trigger.TriggerState.BLOCKED);
  }

  @Test
  void reconcilerLeavesOtherConsumersRowsAlone() throws Exception {
    String someConsumer = UUID.randomUUID().toString();
    String ownKey = "creditAlert.lastEvaluatedTick";
    AlertFixtures.dao()
        .upsertSubscriberExtension(someConsumer, ownKey, "creditAlertTick", "{\"timestamp\":1}");

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertNotNull(AlertFixtures.dao().getSubscriberExtension(someConsumer, ownKey));
    AlertFixtures.dao().deleteSubscriberExtension(someConsumer, ownKey);
  }

  // Only a hand edit or another program leaves such keys; one of them once stopped every round.
  @Test
  void keysThatNameNoAlertAreReportedAndLeftAlone(TestNamespace ns) throws Exception {
    EventSubscription inError = alert(ns, "beside_foreign_keys", null);
    QuietAlert.settle(inError);
    AlertFixtures.updateTrigger("TRIGGER_STATE = 'ERROR'", inError.getId());
    JobKey foreignJob = new JobKey("not-an-alert-" + suffix(), AlertJobs.JOB_GROUP);
    AlertFixtures.scheduler().addJob(foreignJob(foreignJob), false);
    // Read leniently, this row would name an alert that is gone, and be removed for its age.
    String foreignRow = UUID.randomUUID().toString().toUpperCase(Locale.ROOT);
    AlertFixtures.dao()
        .upsertSubscriberExtension(
            foreignRow, LedgerKeys.POSITION, "eventSubscriptionOffset", positionWrittenLongAgo());
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    Metrics.addRegistry(registry);
    try {
      ReconcileRound round = EventSubscriptionScheduler.getInstance().reconcileNow();

      assertTrue(round.foreignKeys().get(ReconcileRound.JOBS).contains(foreignJob.getName()));
      assertTrue(round.foreignKeys().get(ReconcileRound.LEDGER).contains(foreignRow));
      assertTrue(AlertFixtures.scheduler().checkExists(foreignJob), "the job is left alone");
      assertNotNull(
          AlertFixtures.dao().getSubscriberExtension(foreignRow, LedgerKeys.POSITION),
          "the row is left alone");
      // The server's own schedule may finish a round meanwhile too.
      assertTrue(roundsCounted(registry, round.outcome().tag()) >= 1.0);
      QuietAlert.awaitScheduledTickIsOver(inError);
      assertEquals(Trigger.TriggerState.NORMAL, stateOf(inError), "the others are still repaired");
    } finally {
      Metrics.removeRegistry(registry);
      AlertFixtures.scheduler().deleteJob(foreignJob);
      AlertFixtures.dao().deleteSubscriberExtension(foreignRow, LedgerKeys.POSITION);
    }
  }

  // The job itself stays for whoever made it; only its trigger stops.
  @Test
  void aTickOfAJobThatNamesNoAlertStopsItsTrigger() throws Exception {
    JobKey foreignJob = new JobKey("not-an-alert-" + suffix(), AlertJobs.JOB_GROUP);
    TriggerKey trigger = new TriggerKey(foreignJob.getName(), AlertJobs.TRIGGER_GROUP);
    AlertFixtures.scheduler()
        .scheduleJob(
            foreignJob(foreignJob),
            TriggerBuilder.newTrigger()
                .withIdentity(trigger)
                .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(1))
                .startNow()
                .build());
    try {
      Awaitility.await("the refused trigger to stop")
          .atMost(Duration.ofSeconds(30))
          .until(
              () ->
                  AlertFixtures.scheduler().getTriggerState(trigger)
                      == Trigger.TriggerState.COMPLETE);
      assertTrue(AlertFixtures.scheduler().checkExists(foreignJob));
    } finally {
      AlertFixtures.scheduler().deleteJob(foreignJob);
    }
  }

  private static JobDetail foreignJob(JobKey key) {
    return JobBuilder.newJob(ConsumerJob.class).withIdentity(key).storeDurably().build();
  }

  private static String positionWrittenLongAgo() {
    return JsonUtils.pojoToJson(
        new EventSubscriptionOffset()
            .withCurrentOffset(0L)
            .withStartingOffset(0L)
            .withTimestamp(Long.parseLong(LONG_AGO)));
  }

  private static double roundsCounted(SimpleMeterRegistry registry, String outcome) {
    return registry.get("alert_reconciler_rounds").tag("outcome", outcome).counter().count();
  }

  private static String suffix() {
    return UUID.randomUUID().toString().substring(0, 8);
  }

  private static EventSubscription alert(TestNamespace ns, String name, String className) {
    return AlertFixtures.tableAlert(
        ns, name, className, List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused")));
  }

  private static long auditLogOffset() {
    String stored = AlertFixtures.dao().getSubscriberExtension("AUDIT_LOG_CONSUMER", "offset");
    return stored == null ? 0L : JsonUtils.readTree(stored).get("currentOffset").asLong();
  }

  private static Trigger.TriggerState stateOf(EventSubscription alert) throws Exception {
    return AlertFixtures.scheduler().getTriggerState(AlertFixtures.triggerKey(alert.getId()));
  }

  private static Date startTimeOf(EventSubscription alert) throws Exception {
    return AlertFixtures.scheduler()
        .getTrigger(AlertFixtures.triggerKey(alert.getId()))
        .getStartTime();
  }
}
