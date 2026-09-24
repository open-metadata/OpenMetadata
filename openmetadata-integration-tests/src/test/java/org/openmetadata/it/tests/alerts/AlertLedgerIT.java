package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.AlertGapWait;
import org.openmetadata.schema.entity.events.AlertHealth;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

/** The ledger against a real database, because its guarantees are the database's. */
class AlertLedgerIT {

  @Test
  void newRowsInsertOnMySqlAndPostgres() {
    EventSubscription alert = alertWithOneDestination(true);

    AlertRecord.start(alert);

    EventSubscriptionOffset position =
        stored(alert, LedgerKeys.POSITION, EventSubscriptionOffset.class);
    AlertHealth health = stored(alert, LedgerKeys.HEALTH, AlertHealth.class);
    assertNotNull(position.getStartingTimestamp(), "the watermark is written with the position");
    assertEquals(position.getStartingOffset(), position.getCurrentOffset());
    String destinationId = alert.getDestinations().getFirst().getId().toString();
    assertEquals(
        SubscriptionStatus.Status.ACTIVE,
        health.getDestinations().get(destinationId).getStatus().getStatus());
  }

  @Test
  void firstScheduleWritesTheWatermark() {
    EventSubscription alert = alertWithOneDestination(true);
    long before = System.currentTimeMillis();
    long latestOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();

    AlertRecord.start(alert);

    AlertLedger ledger = AlertRecord.open(alert).orElseThrow();
    assertTrue(ledger.watermark() >= before, "events older than the alert are never its business");
    assertTrue(ledger.position() >= latestOffset, "and it starts after what was already there");
  }

  @Test
  void startNeverOverwritesAnExistingPosition() {
    EventSubscription alert = alertWithOneDestination(true);
    AlertRecord.start(alert);
    AlertLedger ledger = AlertRecord.open(alert).orElseThrow();
    ledger.readUpTo(ledger.position() + 5, 0L);
    ledger.commit();

    AlertRecord.start(alert);

    assertEquals(
        ledger.position(),
        stored(alert, LedgerKeys.POSITION, EventSubscriptionOffset.class).getCurrentOffset());
  }

  @Test
  void positionMovedBySomeoneElseIsKeptAndTheRestIsStillWritten() {
    EventSubscription alert = alertWithOneDestination(true);
    AlertRecord.start(alert);
    AlertLedger slow = AlertRecord.open(alert).orElseThrow();
    AlertLedger fast = AlertRecord.open(alert).orElseThrow();
    fast.readUpTo(fast.position() + 10, 0L);
    assertEquals(AlertLedger.Commit.WRITTEN, fast.commit());

    slow.readUpTo(slow.position() + 3, 0L);
    slow.eventsRead(3);
    slow.channelOutcomes(3, 0);

    assertEquals(AlertLedger.Commit.POSITION_MOVED_BY_SOMEONE_ELSE, slow.commit());
    assertEquals(
        fast.position(),
        stored(alert, LedgerKeys.POSITION, EventSubscriptionOffset.class).getCurrentOffset());
    assertEquals(3, stored(alert, LedgerKeys.COUNTERS, AlertMetrics.class).getSuccessEvents());
  }

  @Test
  void deletedAlertDuringTickLeavesNoRows() {
    EventSubscription alert = alertWithOneDestination(true);
    AlertRecord.start(alert);
    AlertLedger ledger = AlertRecord.open(alert).orElseThrow();
    ledger.readUpTo(ledger.position() + 1, 0L);
    ledger.eventsRead(1);

    AlertRecord.forget(alert.getId());

    assertEquals(AlertLedger.Commit.ALERT_DELETED, ledger.commit());
    assertTrue(AlertRecord.open(alert).isEmpty());
    assertNull(dao().getSubscriberExtension(alert.getId().toString(), LedgerKeys.COUNTERS));
  }

  @Test
  void gapWaitFromAnotherPositionIsIgnored() {
    EventSubscription alert = alertWithOneDestination(true);
    AlertRecord.start(alert);
    AlertLedger first = AlertRecord.open(alert).orElseThrow();
    first.readUpTo(first.position(), 1_000L);
    first.commit();
    assertEquals(1_000L, AlertRecord.open(alert).orElseThrow().gapWaitSince());

    AlertGapWait staleWait =
        stored(alert, LedgerKeys.GAP_WAIT, AlertGapWait.class).withAtOffset(first.position() - 1);
    dao()
        .upsertSubscriberExtension(
            alert.getId().toString(),
            LedgerKeys.GAP_WAIT,
            "alertGapWait",
            JsonUtils.pojoToJson(staleWait));

    assertEquals(0L, AlertRecord.open(alert).orElseThrow().gapWaitSince());
  }

  @Test
  void positionCompareAndSetHoldsForARowWithNoStartingTimestamp() {
    EventSubscription alert = alertWithOneDestination(true);
    EventSubscriptionOffset written =
        new EventSubscriptionOffset()
            .withCurrentOffset(40L)
            .withStartingOffset(40L)
            .withTimestamp(System.currentTimeMillis());
    dao()
        .upsertSubscriberExtension(
            alert.getId().toString(),
            LedgerKeys.POSITION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(written));
    AlertLedger ledger = AlertRecord.open(alert).orElseThrow();

    ledger.readUpTo(45L, 0L);

    assertEquals(AlertLedger.Commit.WRITTEN, ledger.commit());
    assertEquals(
        45L, stored(alert, LedgerKeys.POSITION, EventSubscriptionOffset.class).getCurrentOffset());
  }

  private static EventSubscription alertWithOneDestination(boolean enabled) {
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withEnabled(enabled);
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("ledger-" + UUID.randomUUID())
        .withDestinations(List.of(destination));
  }

  private static <T> T stored(EventSubscription alert, String key, Class<T> type) {
    String json = dao().getSubscriberExtension(alert.getId().toString(), key);
    assertNotNull(json, key);
    return JsonUtils.readValue(json, type);
  }

  private static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }
}
