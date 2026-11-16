/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.datacontract.sla;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAccessor;
import java.util.Map;
import java.util.Optional;

/** Reads refresh times and SLA periods. */
final class RefreshTimes {
  private static final Map<String, ChronoUnit> UNITS =
      Map.of(
          "minute", ChronoUnit.MINUTES,
          "hour", ChronoUnit.HOURS,
          "day", ChronoUnit.DAYS,
          "week", ChronoUnit.WEEKS,
          "month", ChronoUnit.MONTHS,
          "year", ChronoUnit.YEARS);

  private RefreshTimes() {}

  /**
   * A column's newest value as a point in time. The profiler stores a date or time column's maximum
   * as ISO text; a number carries no unit, so it is not read as a time. A value without a zone is
   * read in {@code zone}, and a date as the start of that day.
   */
  static Optional<Instant> parse(Object value, ZoneId zone) {
    return value instanceof String text ? parseText(text.trim(), zone) : Optional.empty();
  }

  /** The SLA period unit ("hour", "month", …) as a calendar unit. */
  static ChronoUnit unit(String name) {
    ChronoUnit unit = UNITS.get(name);
    if (unit == null) {
      throw new IllegalArgumentException(String.format("'%s' is not an SLA time unit", name));
    }
    return unit;
  }

  static String describe(int amount, String unit) {
    return String.format("%d %s%s", amount, unit, amount == 1 ? "" : "s");
  }

  private static Optional<Instant> parseText(String text, ZoneId zone) {
    Optional<Instant> instant;
    try {
      instant = Optional.of(text.length() <= 10 ? startOfDay(text, zone) : dateTime(text, zone));
    } catch (DateTimeParseException e) {
      instant = Optional.empty();
    }
    return instant;
  }

  private static Instant startOfDay(String date, ZoneId zone) {
    return LocalDate.parse(date).atStartOfDay(zone).toInstant();
  }

  private static Instant dateTime(String text, ZoneId zone) {
    TemporalAccessor parsed =
        DateTimeFormatter.ISO_DATE_TIME.parseBest(
            text.replaceFirst(" ", "T"), ZonedDateTime::from, LocalDateTime::from);
    return parsed instanceof ZonedDateTime zoned
        ? zoned.toInstant()
        : ((LocalDateTime) parsed).atZone(zone).toInstant();
  }
}
