package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.time.Duration;
import java.util.List;
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
import org.openmetadata.service.Entity;

/**
 * What happens to an alert while one of its ticks is running. The tick keeps no state of its own
 * in the job, so nothing it writes at the end can undo what a user did in the meantime.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertRunningTickIT {

  @Test
  void editDuringRunningTickIsKept(TestNamespace ns) throws Exception {
    try (HeldTick held = HeldTick.of(ns, "edit_during_tick")) {
      AlertFixtures.repository()
          .createOrUpdate(null, held.stored().withDescription("edited while running"), "admin");

      held.finish();

      assertEquals("edited while running", held.stored().getDescription());
    }
  }

  @Test
  void skipBacklogDuringRunningTickIsKept(TestNamespace ns) throws Exception {
    try (HeldTick held = HeldTick.of(ns, "skip_during_tick")) {
      EventSubscriptionOffset skipped =
          AlertFixtures.repository().syncEventSubscriptionOffset(held.alert.getName());

      held.finish();

      EventSubscriptionOffset afterwards =
          JsonUtils.readValue(
              AlertFixtures.position(held.alert.getId()), EventSubscriptionOffset.class);
      assertEquals(skipped.getCurrentOffset(), afterwards.getCurrentOffset());
      assertEquals(skipped.getStartingTimestamp(), afterwards.getStartingTimestamp());
    }
  }

  @Test
  void reenableDuringTickIsKept(TestNamespace ns) throws Exception {
    try (HeldTick held = HeldTick.of(ns, "reenable_during_tick")) {
      AlertFixtures.repository().createOrUpdate(null, held.stored().withEnabled(false), "admin");
      AlertFixtures.repository().createOrUpdate(null, held.stored().withEnabled(true), "admin");

      held.finish();

      assertTrue(held.stored().getEnabled());
      assertTrue(AlertFixtures.jobExists(held.alert.getId()));
    }
  }

  @Test
  void deletedAlertDuringTickLeavesNoRows(TestNamespace ns) throws Exception {
    try (HeldTick held = HeldTick.of(ns, "delete_during_tick")) {
      UUID alertId = held.alert.getId();
      AlertFixtures.repository().delete("admin", alertId, true, true);

      held.finish();

      Awaitility.await("the job of the deleted alert to be gone")
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(() -> assertFalse(AlertFixtures.jobExists(alertId)));
      assertNull(AlertFixtures.position(alertId));
      assertEquals(0, AlertFixtures.dao().getSuccessfulRecordCount(alertId.toString()));
      assertEquals(
          0, Entity.getCollectionDAO().changeEventDAO().countFailedEvents(alertId.toString()));
    }
  }

  // Quartz loads whatever class the job was stored with. The consumer that runs is the one the
  // alert's row names, which is what lets a later release store every job with AlertPublisher.
  @Test
  void jobStoredWithAlertPublisherRunsTheNamedConsumer(TestNamespace ns) throws Exception {
    try (HeldTick held = HeldTick.of(ns, "named_consumer")) {
      assertTrue(held.reachedTheNamedConsumer, "DirectTick always loads AlertPublisher");
      held.finish();
    }
  }

  /** An alert whose tick is running and held just before it sends. */
  private static final class HeldTick implements AutoCloseable {
    private final EventSubscription alert;
    private final LatchedConsumer.Gate gate;
    private final Thread tick;
    private final boolean reachedTheNamedConsumer;

    private HeldTick(EventSubscription alert) throws InterruptedException {
      this.alert = alert;
      QuietAlert.settle(alert);
      this.gate = LatchedConsumer.arm(alert.getId());
      FixtureEvents.insert(FixtureEvents.tableEvents());
      this.tick = new Thread(() -> DirectTick.run(alert), "held-tick");
      tick.start();
      this.reachedTheNamedConsumer = gate.awaitReached();
      assertTrue(reachedTheNamedConsumer, "the tick never reached the point where it sends");
    }

    static HeldTick of(TestNamespace ns, String name) throws InterruptedException {
      return new HeldTick(
          AlertFixtures.tableAlert(
              ns,
              name,
              LatchedConsumer.class.getName(),
              List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused"))));
    }

    EventSubscription stored() {
      return AlertFixtures.stored(alert.getId());
    }

    void finish() throws InterruptedException {
      gate.open();
      tick.join(Duration.ofSeconds(60).toMillis());
      assertFalse(tick.isAlive(), "the held tick did not finish");
    }

    @Override
    public void close() {
      LatchedConsumer.disarm(alert.getId());
    }
  }
}
