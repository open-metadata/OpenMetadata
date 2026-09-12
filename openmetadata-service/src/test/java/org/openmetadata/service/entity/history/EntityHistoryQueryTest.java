package org.openmetadata.service.entity.history;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.history.EntityHistoryQuery.Window;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.RestUtil;

class EntityHistoryQueryTest {
  private final EntityExtensionDAO extensions = mock(EntityExtensionDAO.class);
  private final EntityHistoryQuery<Table> query =
      new EntityHistoryQuery<>(
          new EntityHistoryType<>("table", Table.class, UUID.randomUUID().toString()),
          () -> extensions,
          entities -> entities.forEach(entity -> entity.setDescription("Hydrated snapshot")));
  private final Table first = row(300);
  private final Table middle = row(200);
  private final Table last = row(100);

  @Test
  void forwardPageTrimsLookaheadAndExposesOnlyOlderCursor() {
    rows(List.of(first, middle, last));

    final var result = query.list(new Window(0, 1000, null, null, 2));

    assertEquals(
        List.of(first.getId(), middle.getId()),
        result.getData().stream().map(Table::getId).toList());
    assertNull(result.getPaging().getBefore());
    assertEquals(cursor(middle), RestUtil.decodeCursor(result.getPaging().getAfter()));
    assertEquals(3, result.getPaging().getTotal());
    assertEquals("Hydrated snapshot", result.getData().getFirst().getDescription());
  }

  @Test
  void backwardPageTrimsBeforeReversingAndHasBothCursors() {
    rows(List.of(last, middle, first));

    final var result =
        query.list(new Window(0, 1000, null, RestUtil.encodeCursor(cursor(last)), 2));

    assertEquals(
        List.of(middle.getId(), last.getId()),
        result.getData().stream().map(Table::getId).toList());
    assertEquals(cursor(middle), RestUtil.decodeCursor(result.getPaging().getBefore()));
    assertEquals(cursor(last), RestUtil.decodeCursor(result.getPaging().getAfter()));
  }

  @Test
  void terminalForwardPageHasOnlyNewerCursor() {
    rows(List.of(last));

    final var result =
        query.list(new Window(0, 1000, RestUtil.encodeCursor(cursor(middle)), null, 2));

    assertEquals(cursor(last), RestUtil.decodeCursor(result.getPaging().getBefore()));
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void emptyPageHasNoCursors() {
    rows(List.of());
    final var result = query.list(new Window(0, 1000, null, null, 2));
    assertEquals(List.of(), result.getData());
    assertNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void invalidCursorRetainsValidationErrors() {
    assertThrows(
        RuntimeException.class, () -> HistoryCursor.of(RestUtil.encodeCursor("invalid"), null));
    assertThrows(
        IllegalArgumentException.class,
        () -> HistoryCursor.of(RestUtil.encodeCursor("bad:" + first.getId()), null));
    assertThrows(
        IllegalArgumentException.class,
        () -> HistoryCursor.of(RestUtil.encodeCursor("10:bad"), null));
  }

  private void rows(final List<Table> rows) {
    when(extensions.getEntityHistoryByTimestampRange(
            anyString(),
            anyLong(),
            anyLong(),
            anyString(),
            anyString(),
            anyString(),
            nullable(Long.class),
            nullable(String.class),
            anyInt()))
        .thenReturn(rows.stream().map(JsonUtils::pojoToJson).toList());
    when(extensions.getEntityHistoryByTimestampRangeCount(
            anyString(), anyLong(), anyLong(), anyString()))
        .thenReturn(3);
  }

  private Table row(final long timestamp) {
    return new Table().withId(UUID.randomUUID()).withUpdatedAt(timestamp);
  }

  private String cursor(final Table table) {
    return table.getUpdatedAt() + ":" + table.getId();
  }
}
