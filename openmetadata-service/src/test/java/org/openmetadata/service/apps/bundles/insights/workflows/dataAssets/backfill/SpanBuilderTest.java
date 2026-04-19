package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;

class SpanBuilderTest {

  private static final LocalDate WINDOW_START = LocalDate.of(2026, 1, 1);
  private static final LocalDate WINDOW_END = LocalDate.of(2026, 3, 31);

  private EntityInterface entity;

  @BeforeEach
  void setUp() {
    entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());
  }

  private static long toMs(LocalDate date) {
    return date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
  }

  @Test
  void noChanges_singleSpanCoveringFullWindow() {
    List<Span> spans =
        new SpanBuilder(entity, List.of(), WINDOW_START, WINDOW_START, WINDOW_END).build();
    assertEquals(1, spans.size());
    assertEquals(WINDOW_START, spans.get(0).startDay());
    assertEquals(WINDOW_END, spans.get(0).endDay());
    assertSame(entity, spans.get(0).currentEntity());
  }

  @Test
  void oneChange_twoSpansWithCorrectBoundaries() {
    LocalDate changeDay = LocalDate.of(2026, 2, 15);
    UUID id = UUID.randomUUID();
    VersionRecord ver = new VersionRecord(id, "table.version.0.2", toMs(changeDay));

    List<Span> spans =
        new SpanBuilder(entity, List.of(ver), WINDOW_START, WINDOW_START, WINDOW_END).build();

    assertEquals(2, spans.size());
    assertEquals(changeDay, spans.get(0).startDay());
    assertEquals(WINDOW_END, spans.get(0).endDay());
    assertSame(entity, spans.get(0).currentEntity());
    assertEquals(WINDOW_START, spans.get(1).startDay());
    assertEquals(changeDay.minusDays(1), spans.get(1).endDay());
    assertEquals("table.version.0.2", spans.get(1).extensionKey());
  }

  @Test
  void entityCreatedMidWindow_spansStartAtCreationDate() {
    LocalDate createdAt = LocalDate.of(2026, 2, 1);
    List<Span> spans =
        new SpanBuilder(entity, List.of(), createdAt, WINDOW_START, WINDOW_END).build();
    assertEquals(1, spans.size());
    assertEquals(createdAt, spans.get(0).startDay());
    assertEquals(WINDOW_END, spans.get(0).endDay());
  }

  @Test
  void entityCreatedAfterWindowEnd_noSpans() {
    LocalDate createdAt = LocalDate.of(2027, 1, 1);
    List<Span> spans =
        new SpanBuilder(entity, List.of(), createdAt, WINDOW_START, WINDOW_END).build();
    assertTrue(spans.isEmpty());
  }

  @Test
  void changeBeforeWindowStart_ignored() {
    LocalDate changeDay = LocalDate.of(2025, 12, 31);
    UUID id = UUID.randomUUID();
    VersionRecord ver = new VersionRecord(id, "table.version.0.1", toMs(changeDay));

    List<Span> spans =
        new SpanBuilder(entity, List.of(ver), WINDOW_START, WINDOW_START, WINDOW_END).build();

    assertEquals(1, spans.size());
    assertSame(entity, spans.get(0).currentEntity());
  }

  @Test
  void twoChanges_threeSpans() {
    LocalDate change1 = LocalDate.of(2026, 2, 1);
    LocalDate change2 = LocalDate.of(2026, 3, 1);
    UUID id = UUID.randomUUID();
    List<VersionRecord> versions = List.of(
        new VersionRecord(id, "table.version.0.3", toMs(change2)),
        new VersionRecord(id, "table.version.0.2", toMs(change1)));

    List<Span> spans =
        new SpanBuilder(entity, versions, WINDOW_START, WINDOW_START, WINDOW_END).build();

    assertEquals(3, spans.size());
    assertEquals(change2, spans.get(0).startDay());
    assertEquals(WINDOW_END, spans.get(0).endDay());
    assertEquals(change1, spans.get(1).startDay());
    assertEquals(change2.minusDays(1), spans.get(1).endDay());
    assertEquals(WINDOW_START, spans.get(2).startDay());
    assertEquals(change1.minusDays(1), spans.get(2).endDay());
  }
}
