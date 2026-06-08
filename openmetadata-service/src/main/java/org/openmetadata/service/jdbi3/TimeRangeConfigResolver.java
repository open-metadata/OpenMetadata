/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.jdbi3;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig.CalendarUnit;

/**
 * Resolves a Data Insight chart's {@link TimeRangeConfig} into the concrete
 * {@code (startMillis, endMillis, live)} window the DI executor consumes, for both chart preview and
 * scheduled refresh. Boundary math runs in UTC; week boundary is Monday (ISO), quarter is 3 months.
 */
public final class TimeRangeConfigResolver {

  private TimeRangeConfigResolver() {}

  /** Resolved window. When {@code live} is true the executor ignores start/end and reads the live index. */
  public record Resolved(long startMillis, long endMillis, boolean live) {}

  public static Resolved resolve(TimeRangeConfig config, Instant runStart) {
    return switch (config) {
      case TimeRangeConfig.LiveSnapshot ignored -> new Resolved(0L, 0L, true);
      case TimeRangeConfig.RollingWindow window -> new Resolved(
          minus(window.unit(), runStart.atZone(ZoneOffset.UTC), window.value())
              .toInstant()
              .toEpochMilli(),
          runStart.toEpochMilli(),
          false);
      case TimeRangeConfig.CompletedPeriod period -> resolveCompletedPeriod(period, runStart);
      case TimeRangeConfig.FixedWindow window -> new Resolved(
          window.startTimestamp(), window.endTimestamp(), false);
    };
  }

  private static Resolved resolveCompletedPeriod(
      TimeRangeConfig.CompletedPeriod period, Instant runStart) {
    ZonedDateTime startOfCurrent =
        truncateToBoundary(period.unit(), runStart.atZone(ZoneOffset.UTC));
    ZonedDateTime startOfPrior = minus(period.unit(), startOfCurrent, period.value());
    return new Resolved(
        startOfPrior.toInstant().toEpochMilli(), startOfCurrent.toInstant().toEpochMilli(), false);
  }

  private static ZonedDateTime minus(CalendarUnit unit, ZonedDateTime from, int value) {
    return switch (unit) {
      case day -> from.minusDays(value);
      case week -> from.minusWeeks(value);
      case month -> from.minusMonths(value);
      case quarter -> from.minusMonths(value * 3L);
      case year -> from.minusYears(value);
    };
  }

  private static ZonedDateTime truncateToBoundary(CalendarUnit unit, ZonedDateTime zdt) {
    return switch (unit) {
      case day -> zdt.truncatedTo(ChronoUnit.DAYS);
      case week -> zdt.truncatedTo(ChronoUnit.DAYS)
          .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      case month -> zdt.truncatedTo(ChronoUnit.DAYS).withDayOfMonth(1);
      case quarter -> truncateToQuarter(zdt);
      case year -> zdt.truncatedTo(ChronoUnit.DAYS).withDayOfYear(1);
    };
  }

  private static ZonedDateTime truncateToQuarter(ZonedDateTime zdt) {
    int quarterStartMonth = ((zdt.getMonthValue() - 1) / 3) * 3 + 1;
    return zdt.truncatedTo(ChronoUnit.DAYS).withDayOfMonth(1).withMonth(quarterStartMonth);
  }
}
