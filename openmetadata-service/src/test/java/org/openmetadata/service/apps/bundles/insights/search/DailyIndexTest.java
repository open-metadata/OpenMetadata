package org.openmetadata.service.apps.bundles.insights.search;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class DailyIndexTest {

  @Test
  void nameWithoutAlias() {
    DailyIndex index = new DailyIndex("", "table", LocalDate.of(2026, 4, 17));
    assertEquals("di-data-assets-table-2026.04.17", index.name());
  }

  @Test
  void nameWithAlias() {
    DailyIndex index = new DailyIndex("prod", "table", LocalDate.of(2026, 4, 17));
    assertEquals("prod-di-data-assets-table-2026.04.17", index.name());
  }

  @Test
  void nameNullAliasTreatedAsBlank() {
    DailyIndex index = new DailyIndex(null, "table", LocalDate.of(2026, 4, 17));
    assertEquals("di-data-assets-table-2026.04.17", index.name());
  }

  @Test
  void nameEntityTypeLowercased() {
    DailyIndex index = new DailyIndex("", "Dashboard", LocalDate.of(2026, 4, 17));
    assertEquals("di-data-assets-dashboard-2026.04.17", index.name());
  }

  @Test
  void previousCrossesMonthBoundary() {
    DailyIndex index = new DailyIndex("", "table", LocalDate.of(2026, 5, 1));
    DailyIndex prev = index.previous();
    assertEquals(LocalDate.of(2026, 4, 30), prev.date());
    assertEquals(index.clusterAlias(), prev.clusterAlias());
    assertEquals(index.entityType(), prev.entityType());
  }

  @Test
  void previousCrossesYearBoundary() {
    DailyIndex index = new DailyIndex("", "table", LocalDate.of(2026, 1, 1));
    assertEquals(LocalDate.of(2025, 12, 31), index.previous().date());
  }

  @Test
  void isExpiredByReturnsTrueBeforeCutoff() {
    DailyIndex index = new DailyIndex("", "table", LocalDate.of(2026, 1, 1));
    assertTrue(index.isExpiredBy(LocalDate.of(2026, 1, 2)));
  }

  @Test
  void isExpiredByReturnsFalseOnCutoff() {
    DailyIndex index = new DailyIndex("", "table", LocalDate.of(2026, 1, 2));
    assertFalse(index.isExpiredBy(LocalDate.of(2026, 1, 2)));
  }

  @Test
  void isExpiredByReturnsFalseAfterCutoff() {
    DailyIndex index = new DailyIndex("", "table", LocalDate.of(2026, 1, 3));
    assertFalse(index.isExpiredBy(LocalDate.of(2026, 1, 2)));
  }

  @Test
  void startOfDayTimestampIsUtcMidnight() {
    DailyIndex index = new DailyIndex("", "table", LocalDate.of(2026, 4, 17));
    long expected = LocalDate.of(2026, 4, 17).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
    assertEquals(expected, index.startOfDayTimestamp());
  }

  @Test
  void parseRoundTripsWithName() {
    DailyIndex original = new DailyIndex("prod", "table", LocalDate.of(2026, 4, 17));
    DailyIndex parsed = DailyIndex.parse("prod", "table", original.name());
    assertEquals(original.date(), parsed.date());
    assertEquals(original.clusterAlias(), parsed.clusterAlias());
    assertEquals(original.entityType(), parsed.entityType());
  }

  @Test
  void parseWorksWithoutAlias() {
    DailyIndex original = new DailyIndex("", "dashboard", LocalDate.of(2026, 12, 31));
    DailyIndex parsed = DailyIndex.parse("", "dashboard", original.name());
    assertEquals(original.date(), parsed.date());
  }
}
