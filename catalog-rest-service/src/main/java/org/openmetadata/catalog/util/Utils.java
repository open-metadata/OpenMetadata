package org.openmetadata.catalog.util;

import org.joda.time.Period;
import org.joda.time.format.ISOPeriodFormat;
import org.openmetadata.catalog.type.Schedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Utils {
  private static final Logger LOG = LoggerFactory.getLogger(Utils.class);

  private Utils() {}

  public static void validateIngestionSchedule(Schedule ingestion) {
    if (ingestion == null) {
      return;
    }
    String duration = ingestion.getRepeatFrequency();

    // ISO8601 duration format is P{y}Y{m}M{d}DT{h}H{m}M{s}S.
    String[] splits = duration.split("T");
    if (splits[0].contains("Y") || splits[0].contains("M") ||
            (splits.length == 2 && splits[1].contains("S"))) {
      throw new IllegalArgumentException("Ingestion repeatFrequency can only contain Days, Hours, and Minutes - " +
              "example P{d}DT{h}H{m}M");
    }

    Period period;
    try {
      period = ISOPeriodFormat.standard().parsePeriod(duration);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("Invalid ingestion repeatFrequency " + duration, e);
    }
    if (period.toStandardMinutes().getMinutes() < 60) {
      throw new IllegalArgumentException("Ingestion repeatFrequency is too short and must be more than 60 minutes");
    }
  }

}
