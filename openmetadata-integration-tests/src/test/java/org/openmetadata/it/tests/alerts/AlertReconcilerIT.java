package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.quartz.Trigger;

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

  @Test
  void reconcilerKeepsTheClassTheAlertNames(TestNamespace ns) throws Exception {
    EventSubscription alert = alert(ns, "named_class", LatchedConsumer.class.getName());
    AlertFixtures.scheduler().deleteJob(AlertFixtures.jobKey(alert.getId()));

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertEquals(
        LatchedConsumer.class,
        AlertFixtures.scheduler().getJobDetail(AlertFixtures.jobKey(alert.getId())).getJobClass());
  }

  // While its own tick runs, a trigger is BLOCKED and its fire time can look arbitrarily old.
  @Test
  void reconcilerLeavesARunningTickAlone(TestNamespace ns) throws Exception {
    EventSubscription alert = alert(ns, "running_tick", LatchedConsumer.class.getName());
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

  @Test
  void reconcilerRewritesJobDataAnOlderServerLeftBehind(TestNamespace ns) throws Exception {
    EventSubscription alert = alert(ns, "stale_job_data", null);
    QuietAlert.settle(alert);
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "UPDATE QRTZ_JOB_DETAILS SET JOB_DATA = NULL WHERE JOB_NAME = ?",
                    alert.getId().toString()));
    assertNotEquals(
        1,
        AlertFixtures.scheduler()
            .getJobDetail(AlertFixtures.jobKey(alert.getId()))
            .getJobDataMap()
            .size());

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertEquals(
        1,
        AlertFixtures.scheduler()
            .getJobDetail(AlertFixtures.jobKey(alert.getId()))
            .getJobDataMap()
            .size());
  }

  private static EventSubscription alert(TestNamespace ns, String name, String className) {
    return AlertFixtures.tableAlert(
        ns, name, className, List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused")));
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
