package org.openmetadata.service.events.consumer.ledger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

class AlertProgressTest {

  private static final long STOPPED_AT = 10L;
  private static final long LATEST = 78_388L;

  private final ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
  private final EventSubscriptionDAO subscriptions = mock(EventSubscriptionDAO.class);

  @Test
  void switchedOffAlertHasNothingToReadAndReportsWhereItStopped() {
    EventSubscription alert = alert(false);

    AlertProgress progress = withRows(alert, AlertProgress::of);

    assertEquals(STOPPED_AT, progress.currentOffset());
    assertEquals(LATEST, progress.latestOffset());
    assertEquals(STOPPED_AT, progress.startingOffset());
    assertEquals(0L, progress.unread());
    assertTrue(progress.caughtUp());
    assertEquals(PendingCount.NONE, progress.relevantUnreadCount((a, since) -> event -> true));
    assertTrue(progress.unreadPage(50, 0, (a, since) -> event -> true).all().isEmpty());
    verify(changeEvents, never()).listWithOffset(anyLong(), anyLong());
    verify(changeEvents, never()).listUnprocessedEvents(anyLong(), anyInt(), anyInt());
  }

  @Test
  void switchedOffAlertKeepsWhatItHandledBeforeItWasOff() {
    EventSubscription alert = alert(false);
    when(subscriptions.getSuccessfulRecordCount(alert.getId().toString())).thenReturn(5L);
    when(changeEvents.countFailedEvents(alert.getId().toString())).thenReturn(2L);
    when(subscriptions.countEventsBothDeliveredAndFailed(alert.getId().toString())).thenReturn(1L);

    AlertProgress.Counts counts = withRows(alert, a -> AlertProgress.of(a).counts());

    assertEquals(new AlertProgress.Counts(6L, 5L, 2L), counts);
  }

  @Test
  void enabledAlertReadsFromItsPosition() {
    AlertProgress progress = withRows(alert(true), AlertProgress::of);

    assertEquals(STOPPED_AT, progress.currentOffset());
    assertEquals(LATEST - STOPPED_AT, progress.unread());
    assertFalse(progress.caughtUp());
  }

  // Read between the commit that creates the alert and the write of its first position.
  @Test
  void enabledAlertWithNoPositionRowReadsAsAtTheLatestOffset() {
    AlertProgress progress = withNoRow(alert(true), AlertProgress::of);

    assertEquals(LATEST, progress.currentOffset());
    assertEquals(LATEST, progress.startingOffset());
    assertEquals(0L, progress.unread());
    assertTrue(progress.caughtUp());
  }

  private <T> T withRows(EventSubscription alert, Function<EventSubscription, T> read) {
    EventSubscriptionOffset position =
        new EventSubscriptionOffset()
            .withCurrentOffset(STOPPED_AT)
            .withStartingOffset(STOPPED_AT)
            .withStartingTimestamp(1L)
            .withTimestamp(1L);
    when(subscriptions.getSubscriberExtension(alert.getId().toString(), LedgerKeys.POSITION))
        .thenReturn(JsonUtils.pojoToJson(position));
    return withNoRow(alert, read);
  }

  private <T> T withNoRow(EventSubscription alert, Function<EventSubscription, T> read) {
    when(changeEvents.getLatestOffset()).thenReturn(LATEST);
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.changeEventDAO()).thenReturn(changeEvents);
    when(dao.eventSubscriptionDAO()).thenReturn(subscriptions);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      return read.apply(alert);
    }
  }

  private static EventSubscription alert(boolean enabled) {
    return new EventSubscription().withId(UUID.randomUUID()).withEnabled(enabled);
  }
}
