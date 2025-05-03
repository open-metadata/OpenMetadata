package org.openmetadata.service.util;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

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
