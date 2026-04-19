package org.openmetadata.service.apps.bundles.insights.config;

import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;

public record ProcessingPeriod(long startTimestamp, long endTimestamp, int retentionDays) {

  public boolean isBeforeRetentionLimit(long currentTimestamp) {
    long oldestAllowed =
        TimestampUtils.getStartOfDayTimestamp(
            TimestampUtils.subtractDays(currentTimestamp, retentionDays));
    return oldestAllowed >= TimestampUtils.getStartOfDayTimestamp(endTimestamp);
  }
}
