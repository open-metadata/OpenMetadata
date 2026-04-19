package org.openmetadata.service.apps.bundles.insights.config;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;

class ProcessingPeriodFactoryTest {

  private static final int RETENTION_DAYS = 30;

  @Test
  void steadyStateStartIsStartOfYesterday() {
    long now = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    ProcessingPeriod period = ProcessingPeriodFactory.forSteadyState(now, RETENTION_DAYS);
    long expectedStart = TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(now, 1));
    assertEquals(expectedStart, period.startTimestamp());
  }

  @Test
  void steadyStateEndIsEndOfToday() {
    long now = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    ProcessingPeriod period = ProcessingPeriodFactory.forSteadyState(now, RETENTION_DAYS);
    long expectedEnd = TimestampUtils.getEndOfDayTimestamp(now);
    assertEquals(expectedEnd, period.endTimestamp());
  }

  @Test
  void steadyStateRetentionDaysPreserved() {
    long now = System.currentTimeMillis();
    ProcessingPeriod period = ProcessingPeriodFactory.forSteadyState(now, RETENTION_DAYS);
    assertEquals(RETENTION_DAYS, period.retentionDays());
  }

  @Test
  void backfillStartClampedToRetentionLimit() {
    long now = System.currentTimeMillis();
    long oldestAllowed =
        TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(now, RETENTION_DAYS));
    // Request a start date that is before the retention limit
    String tooOldStart = "2000-01-01";
    String validEnd = "2026-04-17";
    ProcessingPeriod period =
        ProcessingPeriodFactory.forBackfill(tooOldStart, validEnd, now, RETENTION_DAYS);
    assertEquals(oldestAllowed, period.startTimestamp());
  }

  @Test
  void backfillStartNotClampedWhenWithinRetention() {
    long now = System.currentTimeMillis();
    long fiveDaysAgoMs = TimestampUtils.subtractDays(now, 5);
    String fiveDaysAgo = TimestampUtils.timestampToString(fiveDaysAgoMs, "yyyy-MM-dd");
    String tomorrow = TimestampUtils.timestampToString(TimestampUtils.addDays(now, 1), "yyyy-MM-dd");
    ProcessingPeriod period =
        ProcessingPeriodFactory.forBackfill(fiveDaysAgo, tomorrow, now, RETENTION_DAYS);
    long expectedStart =
        TimestampUtils.getStartOfDayTimestamp(
            TimestampUtils.getTimestampFromDateString(fiveDaysAgo));
    assertEquals(expectedStart, period.startTimestamp());
  }

  @Test
  void backfillRetentionDaysPreserved() {
    long now = System.currentTimeMillis();
    ProcessingPeriod period =
        ProcessingPeriodFactory.forBackfill("2026-04-01", "2026-04-17", now, RETENTION_DAYS);
    assertEquals(RETENTION_DAYS, period.retentionDays());
  }
}
