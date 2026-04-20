package org.openmetadata.service.apps.bundles.insights.config;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;

class ProcessingPeriodTest {

  private static final int RETENTION_DAYS = 30;

  @Test
  void steadyStateStartIsStartOfYesterday() {
    long now = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    ProcessingPeriod period = ProcessingPeriod.forSteadyState(now, RETENTION_DAYS);
    long expectedStart = TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(now, 1));
    assertEquals(expectedStart, period.startTimestamp());
  }

  @Test
  void steadyStateEndIsEndOfToday() {
    long now = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    ProcessingPeriod period = ProcessingPeriod.forSteadyState(now, RETENTION_DAYS);
    long expectedEnd = TimestampUtils.getEndOfDayTimestamp(now);
    assertEquals(expectedEnd, period.endTimestamp());
  }

  @Test
  void backfillStartClampedToRetentionLimit() {
    long now = System.currentTimeMillis();
    long oldestAllowed =
        TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(now, RETENTION_DAYS));
    ProcessingPeriod period =
        ProcessingPeriod.forBackfill("2000-01-01", "2026-04-17", now, RETENTION_DAYS);
    assertEquals(oldestAllowed, period.startTimestamp());
  }

  @Test
  void backfillStartNotClampedWhenWithinRetention() {
    long now = System.currentTimeMillis();
    long fiveDaysAgoMs = TimestampUtils.subtractDays(now, 5);
    String fiveDaysAgo = TimestampUtils.timestampToString(fiveDaysAgoMs, "yyyy-MM-dd");
    String tomorrow =
        TimestampUtils.timestampToString(TimestampUtils.addDays(now, 1), "yyyy-MM-dd");
    ProcessingPeriod period =
        ProcessingPeriod.forBackfill(fiveDaysAgo, tomorrow, now, RETENTION_DAYS);
    long expectedStart =
        TimestampUtils.getStartOfDayTimestamp(
            TimestampUtils.getTimestampFromDateString(fiveDaysAgo));
    assertEquals(expectedStart, period.startTimestamp());
  }
}
