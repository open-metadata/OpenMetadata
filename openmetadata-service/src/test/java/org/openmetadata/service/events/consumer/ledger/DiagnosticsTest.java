package org.openmetadata.service.events.consumer.ledger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.PerRequestContextCleaner;

class DiagnosticsTest {

  @Test
  void aSmallBacklogIsCountedExactly() {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.listWithOffset(UnprocessedEvents.MAX_EVALUATED, 10L)).thenReturn(rows(11, 3));

    PendingCount counted = countWith(changeEvents, 10L, 13L);

    assertEquals(new PendingCount(3, false), counted);
  }

  // Each unread event is evaluated against the alert's rules, so a request evaluates a bounded
  // number of them and says the count is a lower bound when more are unread.
  @Test
  void aLargeBacklogIsCountedUpToTheCapInOneRead() {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.listWithOffset(UnprocessedEvents.MAX_EVALUATED, 10L))
        .thenReturn(rows(11, UnprocessedEvents.MAX_EVALUATED));

    PendingCount counted = countWith(changeEvents, 10L, 100_000L);

    assertEquals(new PendingCount(UnprocessedEvents.MAX_EVALUATED, true), counted);
    verify(changeEvents, times(1)).listWithOffset(UnprocessedEvents.MAX_EVALUATED, 10L);
    verifyNoMoreInteractions(changeEvents);
  }

  // The page read the latest offset with the alert's position; events written after it are left
  // for the next count, so a read they fill cannot pass for an exact count of the older ones.
  @Test
  void eventsWrittenAfterTheLatestOffsetAreNotCounted() {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.listWithOffset(UnprocessedEvents.MAX_EVALUATED, 10L))
        .thenReturn(rows(11, UnprocessedEvents.MAX_EVALUATED));

    PendingCount counted = countWith(changeEvents, 10L, 12L);

    assertEquals(new PendingCount(2, false), counted);
  }

  @Test
  void onlyEventsTheRulesLetThroughAreCounted() {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.listWithOffset(UnprocessedEvents.MAX_EVALUATED, 10L)).thenReturn(rows(11, 4));

    CollectionDAO dao = daoWith(changeEvents);
    PendingCount counted;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      counted = UnprocessedEvents.countMatching(10L, 14L, event -> false);
    }

    assertEquals(new PendingCount(0, false), counted);
  }

  private static PendingCount countWith(ChangeEventDAO changeEvents, long after, long latest) {
    CollectionDAO dao = daoWith(changeEvents);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      return UnprocessedEvents.countMatching(after, latest, event -> true);
    }
  }

  private static CollectionDAO daoWith(ChangeEventDAO changeEvents) {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.changeEventDAO()).thenReturn(changeEvents);
    return dao;
  }

  // One row, so the evaluation stays on this thread, where the static mock can see it.
  @Test
  void pooledEvaluationClearsCaches() {
    List<String> oneRow = List.of(rows(1, 1).getFirst().json());

    try (MockedStatic<PerRequestContextCleaner> cleaner =
        mockStatic(PerRequestContextCleaner.class)) {
      UnprocessedEvents.matching(oneRow, event -> true);

      cleaner.verify(PerRequestContextCleaner::clear, times(2));
    }
  }

  private static List<ChangeEventRecord> rows(long firstOffset, int count) {
    List<ChangeEventRecord> rows = new ArrayList<>();
    for (int index = 0; index < count; index++) {
      ChangeEvent event = new ChangeEvent().withId(UUID.randomUUID()).withEntityType("table");
      rows.add(new ChangeEventRecord(firstOffset + index, JsonUtils.pojoToJson(event)));
    }
    return rows;
  }
}
