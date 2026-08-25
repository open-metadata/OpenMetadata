package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.junit.jupiter.api.Test;

class UtilitiesTest {

  @Test
  void getLastSevenDaysReturnsCalendarDaySequence() {
    LocalDate currentDate = LocalDate.of(2026, 1, 15);
    long epochMillis =
        currentDate.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();

    List<String> days = Utilities.getLastSevenDays(epochMillis);

    assertEquals(List.of("9", "10", "11", "12", "13", "14", "15"), days);
  }

  @Test
  void epochFormattingUsesExpectedPatterns() {
    LocalDate date = LocalDate.of(2026, 2, 3);
    long epochMillis = date.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();

    assertEquals(
        date.format(DateTimeFormatter.ofPattern("MMM d")),
        Utilities.getMonthAndDateFromEpoch(epochMillis));
    assertEquals("3", Utilities.getDateFromEpoch(epochMillis));
  }

  @Test
  void cleanUpDoubleQuotesHandlesQuotedAndUnquotedInputs() {
    assertEquals("hello\"world", Utilities.cleanUpDoubleQuotes("\"hello\\\"world\""));
    assertEquals("alphabeta", Utilities.cleanUpDoubleQuotes("alpha\"beta"));
  }

  @Test
  void doubleQuoteRegexEscapeBuildsExpectedPattern() {
    assertEquals("foo(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)", Utilities.doubleQuoteRegexEscape("foo"));
  }
}
