package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;

/**
 * A tick that has used its time budget ends after the event in progress and runs again at once.
 * The budget of these tests has always passed, so every tick processes exactly one event. The
 * fixture holds three events; the alert's webhook receives the two about its table.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertTimeBudgetIT {

  private static final AlertingSettings ALWAYS_PASSED =
      new AlertingSettings(Duration.ofNanos(1), false);
  private static final AlertingSettings DEFAULTS =
      new AlertingSettings(Duration.ofSeconds(60), false);

  @AfterEach
  void restore() throws Exception {
    AlertingSettings.use(DEFAULTS);
    AlertFixtures.scheduler().start();
  }

  @Test
  void budgetStopsBetweenEvents(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = settledAlert(ns, "stops_between_events", receiver);
      long openedAt = AlertFixtures.offsetOf(alert.getId());

      tickOnceWithTheRerunHeldBack(alert);

      assertEquals(1, receiver.received().size(), "the event in progress is finished, no more");
      assertEquals(openedAt + 1, AlertFixtures.offsetOf(alert.getId()));
    }
  }

  @Test
  void stoppedTickCountsOnlyProcessedEvents(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = settledAlert(ns, "counts_processed", receiver);
      int countedBefore = totalEvents(alert);

      tickOnceWithTheRerunHeldBack(alert);

      assertEquals(1, totalEvents(alert) - countedBefore);
    }
  }

  // The alert polls once a day, so only the run at once can finish the batch within seconds.
  @Test
  void stoppedTickRunsAgainWithoutWaitingForThePollInterval(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = settledAlert(ns, "runs_again", receiver);
      long openedAt = AlertFixtures.offsetOf(alert.getId());
      int countedBefore = totalEvents(alert);
      FixtureEvents.insert(FixtureEvents.tableEvents());

      DirectTick.run(alert);

      Awaitility.await("the rest of the batch")
          .atMost(Duration.ofSeconds(60))
          .until(() -> AlertFixtures.offsetOf(alert.getId()) == openedAt + 3);
      QuietAlert.awaitScheduledTickIsOver(alert);
      assertEquals(2, receiver.received().size(), "every event once, over three ticks");
      assertEquals(3, totalEvents(alert) - countedBefore, "and counted once");
    }
  }

  // In standby the scheduler fires nothing, so what the first tick did can be looked at alone.
  private static void tickOnceWithTheRerunHeldBack(EventSubscription alert) throws Exception {
    FixtureEvents.insert(FixtureEvents.tableEvents());
    AlertFixtures.scheduler().standby();
    DirectTick.run(alert);
  }

  private static EventSubscription settledAlert(
      TestNamespace ns, String name, RecordingReceiver receiver) {
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns,
            name,
            AlertPublisher.class.getName(),
            List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
    QuietAlert.settle(alert);
    AlertingSettings.use(ALWAYS_PASSED);
    return alert;
  }

  private static int totalEvents(EventSubscription alert) {
    String stored =
        AlertFixtures.dao().getSubscriberExtension(alert.getId().toString(), LedgerKeys.COUNTERS);
    return stored == null ? 0 : JsonUtils.readValue(stored, AlertMetrics.class).getTotalEvents();
  }
}
