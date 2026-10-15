package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.quartz.SimpleTrigger;
import org.quartz.TriggerKey;

/**
 * Quartz counts a repeating trigger's next slot from the slot before it. A tick that ends past its
 * alert's next slot restarts the timetable from its own end, so the trigger never stays behind.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertTimetableIT {

  @Test
  void aTickThatEndsPastItsNextSlotRestartsTheTimetable(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "timetable",
              AlertPublisher.class.getName(),
              List.of(AlertFixtures.external(WEBHOOK, receiver.url("/hook"))));
      QuietAlert.settle(alert);
      TriggerKey key = AlertFixtures.triggerKey(alert.getId());
      // Paused, so the scheduler cannot fire the trigger this test puts behind its slot.
      AlertFixtures.scheduler().pauseTrigger(key);
      long anHourAgo = System.currentTimeMillis() - Duration.ofHours(1).toMillis();
      AlertFixtures.updateTrigger("NEXT_FIRE_TIME = " + anHourAgo, alert.getId());
      long oneInterval = Duration.ofSeconds(alert.getPollInterval()).toMillis();

      long before = System.currentTimeMillis();
      DirectTick.run(alert);
      long after = System.currentTimeMillis();

      SimpleTrigger restarted = (SimpleTrigger) AlertFixtures.scheduler().getTrigger(key);
      long nextFire = restarted.getNextFireTime().getTime();
      assertTrue(
          nextFire >= before + oneInterval && nextFire <= after + oneInterval,
          "one poll interval after the tick ended, not the slot it missed: " + nextFire);
      assertEquals(oneInterval, restarted.getRepeatInterval(), "the alert's own interval");
    }
  }
}
