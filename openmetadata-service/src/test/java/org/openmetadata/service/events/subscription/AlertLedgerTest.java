package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

class AlertLedgerTest {

  private static final String OPENED_AT =
      "{\"currentOffset\":7,\"startingOffset\":7,\"timestamp\":1}";

  // The messages already went out. Sending them again is worse than losing a diagnostic row.
  @Test
  void deliveredRowFailureStillMovesPosition() {
    EventSubscriptionDAO subscriptionDao = mock(EventSubscriptionDAO.class);
    when(subscriptionDao.compareAndSetSubscriberExtension(
            anyString(), eq(LedgerKeys.POSITION), anyString(), anyString()))
        .thenReturn(1);
    when(subscriptionDao.insertSubscriberExtensionIfAbsent(
            anyString(), eq(LedgerKeys.COUNTERS), anyString(), anyString()))
        .thenReturn(1);
    doThrow(new IllegalStateException("the delivered table is locked"))
        .when(subscriptionDao)
        .batchUpsertSuccessfulChangeEvents(any(), any(), any(), any());
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.eventSubscriptionDAO()).thenReturn(subscriptionDao);
    AlertLedger ledger =
        new AlertLedger(
            new EventSubscription().withId(UUID.randomUUID()),
            Map.of(LedgerKeys.POSITION, OPENED_AT));
    ledger.readUpTo(9L, 0L);
    ledger.eventsRead(2);
    ledger.delivered(new ChangeEvent().withId(UUID.randomUUID()));

    AlertLedger.Commit result;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      result = ledger.commit();
    }

    assertEquals(AlertLedger.Commit.WRITTEN, result);
    assertEquals(9L, ledger.position());
  }
}
