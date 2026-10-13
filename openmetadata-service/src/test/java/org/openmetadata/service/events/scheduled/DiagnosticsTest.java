package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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
  void unprocessedEventsAreReadInPages() {
    ChangeEventDAO changeEvents = mock(ChangeEventDAO.class);
    when(changeEvents.listWithOffset(UnprocessedEvents.PAGE_SIZE, 10L))
        .thenReturn(rows(11, UnprocessedEvents.PAGE_SIZE));
    when(changeEvents.listWithOffset(UnprocessedEvents.PAGE_SIZE, 510L)).thenReturn(rows(511, 3));
    when(changeEvents.listWithOffset(UnprocessedEvents.PAGE_SIZE, 513L)).thenReturn(List.of());
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.changeEventDAO()).thenReturn(changeEvents);

    long counted;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      counted = UnprocessedEvents.countMatching(10L, event -> true);
    }

    assertEquals(UnprocessedEvents.PAGE_SIZE + 3, counted, "the count stays exact across pages");
    verify(changeEvents, times(3)).listWithOffset(anyInt(), anyLong());
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
