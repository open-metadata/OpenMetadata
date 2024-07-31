package org.openmetadata.service.apps.bundles.insights.utils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

public class TimestampUtils {
  public static final String START_TIMESTAMP_KEY = "startTimestamp";
  public static final String END_TIMESTAMP_KEY = "endTimestamp";
  public static final String TIMESTAMP_KEY = "@timestamp";
  private static final Long MILLISECONDS_IN_A_DAY = (long) 1000 * 60 * 60 * 24;

  public static Long getStartOfDayTimestamp(Long timestamp) {
    return (int) (timestamp / MILLISECONDS_IN_A_DAY) * MILLISECONDS_IN_A_DAY;
  }

  public static Long getEndOfDayTimestamp(Long timestamp) {
    return (int) (addDays(timestamp, 1) / MILLISECONDS_IN_A_DAY) * MILLISECONDS_IN_A_DAY - 1;
  }

  public static Long subtractDays(Long timestamp, int days) {
    return addDays(timestamp, (days * -1));
  }

  public static Long addDays(Long timestamp, int days) {
    return timestamp + (MILLISECONDS_IN_A_DAY * days);
  }

  public static String timestampToString(Long timestamp, String pattern) {
    String inputString = Instant.ofEpochMilli(timestamp).toString();
    DateTimeFormatter inputFormatter = DateTimeFormatter.ISO_INSTANT.withZone(ZoneId.of("UTC"));
    ZonedDateTime zonedDateTime = ZonedDateTime.parse(inputString, inputFormatter);
    DateTimeFormatter outputFormatter = DateTimeFormatter.ofPattern(pattern);
    return zonedDateTime.format(outputFormatter);
  }

  public static Long getTimestampFromDateString(String date) {
    DateTimeFormatter formatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.of("UTC"));
    LocalDate localDate = LocalDate.parse(date, formatter);
    ZonedDateTime dateTime = localDate.atStartOfDay(ZoneId.of("UTC"));
    return dateTime.toEpochSecond() * 1000;
  }
}
