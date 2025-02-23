package org.openmetadata.service.util;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.tuple.Pair;

public class Utilities {
  private Utilities() {}

  public static List<String> getLastSevenDays(long currentEpochTimestampInMilli) {
    List<String> lastSevenDays = new ArrayList<>();

    // Create a formatter for the date
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("d");

    // Calculate and add the dates for the last seven days
    for (int i = 6; i >= 0; i--) {
      long dayEpochTimestamp =
          currentEpochTimestampInMilli
              - ((long) i * 24 * 60 * 60 * 1000); // Subtracting seconds for each day
      LocalDateTime dateTime =
          LocalDateTime.ofInstant(
              Instant.ofEpochMilli(dayEpochTimestamp), java.time.ZoneId.systemDefault());
      lastSevenDays.add(dateTime.format(formatter));
    }

    return lastSevenDays;
  }

  // Adjust endTime to Monday (previousOrSame) and define "previous" week as that Monday minus 1
  // week.
  public static Pair<Long, Long> getPreviousWeekRange(long endTimeMillis) {
    // Define the previous week's time range (Monday to Sunday)
    ZonedDateTime endZdt =
        ZonedDateTime.ofInstant(Instant.ofEpochMilli(endTimeMillis), ZoneOffset.UTC);

    // Current week's Monday
    ZonedDateTime currentWeekMonday =
        endZdt.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    // Previous week's Monday
    ZonedDateTime previousWeekMonday = currentWeekMonday.minusWeeks(1);

    // Sunday = Monday + 6
    ZonedDateTime previousWeekSunday = previousWeekMonday.plusDays(6);

    long start = previousWeekMonday.toInstant().toEpochMilli();
    long end = previousWeekSunday.toInstant().toEpochMilli();

    return Pair.of(start, end);
  }

  public static String getMonthAndDateFromEpoch(long epochTimestamp) {
    return getFormattedDateFromEpoch(epochTimestamp, "MMM d");
  }

  public static String getDateFromEpoch(long epochTimestampInMilli) {
    return getFormattedDateFromEpoch(epochTimestampInMilli, "d");
  }

  public static String cleanUpDoubleQuotes(String input) {
    return input.replaceAll("\"", "");
  }

  public static String doubleQuoteRegexEscape(String input) {
    return String.format("%s(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", input);
  }

  private static String getFormattedDateFromEpoch(long epochTimestamp, String format) {
    Instant instant = Instant.ofEpochMilli(epochTimestamp);
    LocalDateTime dateTime = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());

    // Define a custom date formatter
    DateTimeFormatter dateFormat = DateTimeFormatter.ofPattern(format);

    return dateTime.format(dateFormat);
  }
}
