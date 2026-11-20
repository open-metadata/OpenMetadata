package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EventSubscriptionDAO;

class AlertOffsetReadTest {

  private static final long LATEST = 78_388L;

  private final UUID alertId = UUID.randomUUID();
  private final ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
  private final EventSubscriptionDAO subscriptions = mock(EventSubscriptionDAO.class);

  // A read of an alert created disabled must not freeze where it starts once it is enabled.
  @Test
  void readingAnAlertWithNoStoredOffsetSavesNothingAndReadsAsTheLatestOffset() {
    EventSubscriptionOffset read = withDao(AlertUtil::storedOffsetOrLatest);

    assertEquals(LATEST, read.getCurrentOffset());
    assertEquals(LATEST, read.getStartingOffset());
    verify(subscriptions, never())
        .upsertSubscriberExtension(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void readingAnAlertWithAStoredOffsetReturnsIt() {
    EventSubscriptionOffset stored =
        new EventSubscriptionOffset().withCurrentOffset(10L).withStartingOffset(5L);
    when(subscriptions.getSubscriberExtension(
            alertId.toString(), AbstractEventConsumer.OFFSET_EXTENSION))
        .thenReturn(JsonUtils.pojoToJson(stored));

    EventSubscriptionOffset read = withDao(AlertUtil::storedOffsetOrLatest);

    assertEquals(10L, read.getCurrentOffset());
    assertEquals(5L, read.getStartingOffset());
  }

  // Scheduling or running an enabled alert still saves its start, so restarts and edits do not
  // move its watermark.
  @Test
  void startingAnAlertWithNoStoredOffsetSavesItAtTheLatestOffset() {
    EventSubscriptionOffset started = withDao(AlertUtil::getStartingOffset);

    assertEquals(LATEST, started.getCurrentOffset());
    verify(subscriptions)
        .upsertSubscriberExtension(
            alertId.toString(),
            AbstractEventConsumer.OFFSET_EXTENSION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(started));
  }

  private <T> T withDao(Function<UUID, T> read) {
    when(changeEvents.getLatestOffset()).thenReturn(LATEST);
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.changeEventDAO()).thenReturn(changeEvents);
    when(dao.eventSubscriptionDAO()).thenReturn(subscriptions);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      return read.apply(alertId);
    }
  }
}
