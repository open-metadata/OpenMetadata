package org.openmetadata.service.apps.bundles.insights.config;

import java.util.Collections;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;

@Slf4j
public final class ProcessingPeriodFactory {

  private ProcessingPeriodFactory() {}

  public static ProcessingPeriod forSteadyState(long timestamp, int retentionDays) {
    return new ProcessingPeriod(
        TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 1)),
        TimestampUtils.getEndOfDayTimestamp(timestamp),
        retentionDays);
  }

  public static ProcessingPeriod forBackfill(
      String startDate, String endDate, long currentTimestamp, int retentionDays) {
    long oldestAllowed =
        TimestampUtils.getStartOfDayTimestamp(
            TimestampUtils.subtractDays(currentTimestamp, retentionDays));

    long clampedStart =
        TimestampUtils.getStartOfDayTimestamp(
            Collections.max(
                List.of(TimestampUtils.getTimestampFromDateString(startDate), oldestAllowed)));
    long clampedEnd =
        TimestampUtils.getEndOfDayTimestamp(
            Collections.max(List.of(TimestampUtils.getTimestampFromDateString(endDate))));

    if (oldestAllowed == TimestampUtils.getStartOfDayTimestamp(clampedEnd)) {
      LOG.warn(
          "Backfill won't happen because the set date is before the retention limit of {}",
          oldestAllowed);
    }

    return new ProcessingPeriod(clampedStart, clampedEnd, retentionDays);
  }
}
