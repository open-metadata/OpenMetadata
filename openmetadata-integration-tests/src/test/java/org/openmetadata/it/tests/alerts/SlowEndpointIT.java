package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.events.subscription.AlertingSettings;

/**
 * Ten alerts on slow endpoints hold every thread of the alert scheduler, and each of them asks to
 * run again the moment it stops. An alert that came due meanwhile must still get the first thread
 * that frees up, however late it is by then. Quartz cannot even see a trigger that is later than
 * the misfire threshold, which is why that threshold is far above any time a tick can take.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class SlowEndpointIT {

  private static final int SCHEDULER_THREADS = 10;
  private static final int SLOW_TARGETS_PER_EVENT = 9;
  private static final Duration ONE_SLOW_TARGET = Duration.ofSeconds(8);
  private static final Duration ONE_SLOW_EVENT =
      ONE_SLOW_TARGET.multipliedBy(SLOW_TARGETS_PER_EVENT);
  private static final Duration OLD_MISFIRE_THRESHOLD = Duration.ofSeconds(60);
  private static final Duration BUDGET = Duration.ofSeconds(1);

  @Test
  void tenSlowAlertsStillLetAnotherAlertRun(TestNamespace ns) throws Exception {
    List<EventSubscription> slowAlerts = new ArrayList<>();
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription waiting = alert(ns, "waiting", List.of(to(receiver, "/fast")));
      for (int number = 0; number < SCHEDULER_THREADS; number++) {
        slowAlerts.add(alert(ns, "slow_" + number, slowTargets(receiver)));
      }
      slowAlerts.forEach(QuietAlert::settle);
      QuietAlert.settle(waiting);
      AlertingSettings.use(new AlertingSettings(BUDGET, false));

      FixtureEvents.insert(FixtureEvents.tableEvents());
      for (EventSubscription slow : slowAlerts) {
        AlertFixtures.scheduler().triggerJob(AlertFixtures.jobKey(slow.getId()));
      }
      Awaitility.await("every scheduler thread to be held by a slow alert")
          .atMost(Duration.ofSeconds(60))
          .until(() -> receiver.inFlight() == SCHEDULER_THREADS);
      long dueAt = System.currentTimeMillis();
      AlertFixtures.updateTrigger("NEXT_FIRE_TIME = " + dueAt, waiting.getId());

      Awaitility.await("the waiting alert to deliver")
          .atMost(BUDGET.plus(ONE_SLOW_EVENT).plusSeconds(25))
          .until(() -> deliveredTo(receiver, "/fast") == 2);

      Duration waited = Duration.ofMillis(System.currentTimeMillis() - dueAt);
      assertTrue(
          waited.compareTo(OLD_MISFIRE_THRESHOLD) > 0,
          "the alert was not late enough for this test to prove anything: " + waited);
    } finally {
      AlertingSettings.use(new AlertingSettings(Duration.ofSeconds(60), false));
      for (EventSubscription slow : slowAlerts) {
        AlertFixtures.repository().deleteInternal("admin", slow.getId(), true, true);
      }
    }
  }

  private static long deliveredTo(RecordingReceiver receiver, String path) {
    return receiver.received().stream().filter(request -> path.equals(request.path())).count();
  }

  private static List<SubscriptionDestination> slowTargets(RecordingReceiver receiver) {
    List<SubscriptionDestination> targets = new ArrayList<>();
    for (int number = 0; number < SLOW_TARGETS_PER_EVENT; number++) {
      String path = "/slow-" + number;
      receiver.delay(path, ONE_SLOW_TARGET);
      targets.add(to(receiver, path));
    }
    return targets;
  }

  private static SubscriptionDestination to(RecordingReceiver receiver, String path) {
    return AlertFixtures.external(WEBHOOK, receiver.url(path));
  }

  private static EventSubscription alert(
      TestNamespace ns, String name, List<SubscriptionDestination> destinations) {
    return AlertFixtures.tableAlert(ns, name, AlertPublisher.class.getName(), destinations);
  }
}
