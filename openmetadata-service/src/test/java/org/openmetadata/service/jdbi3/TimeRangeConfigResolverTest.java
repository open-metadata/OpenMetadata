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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig.CalendarUnit;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig.CompletedPeriod;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig.FixedWindow;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig.LiveSnapshot;
import org.openmetadata.schema.dataInsight.custom.TimeRangeConfig.RollingWindow;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TimeRangeConfigResolver.Resolved;

class TimeRangeConfigResolverTest {

  private static long epochMillis(String isoInstant) {
    return Instant.parse(isoInstant).toEpochMilli();
  }

  private static Resolved resolve(TimeRangeConfig config, String isoInstant) {
    return TimeRangeConfigResolver.resolve(config, Instant.parse(isoInstant));
  }

  // LiveSnapshot returns (0, 0, live=true).
  @Test
  void liveSnapshot_resolvesToLiveSentinel() {
    Resolved r = resolve(new LiveSnapshot(), "2026-05-16T12:00:00Z");
    assertEquals(0L, r.startMillis());
    assertEquals(0L, r.endMillis());
    assertTrue(r.live());
  }

  // RollingWindow {N, day} returns [runStart - N*86400000, runStart].
  @Test
  void rollingWindow_daysFromRunStart() {
    Instant runStart = Instant.parse("2026-05-16T12:00:00Z");
    Resolved r = TimeRangeConfigResolver.resolve(new RollingWindow(7, CalendarUnit.day), runStart);
    assertEquals(runStart.toEpochMilli() - 7L * 86_400_000L, r.startMillis());
    assertEquals(runStart.toEpochMilli(), r.endMillis());
    assertFalse(r.live());
  }

  // RollingWindow with week / month / year — live flag is always false.
  @Test
  void rollingWindow_otherUnits_liveFlagAlwaysFalse() {
    assertFalse(resolve(new RollingWindow(3, CalendarUnit.week), "2026-05-16T12:00:00Z").live());
    assertFalse(resolve(new RollingWindow(2, CalendarUnit.month), "2026-05-16T12:00:00Z").live());
    assertFalse(resolve(new RollingWindow(1, CalendarUnit.year), "2026-05-16T12:00:00Z").live());
  }

  // Year boundary — CompletedPeriod {1, year} on 2026-01-01T00:00:01Z → [2025-01-01, 2026-01-01].
  @Test
  void completedPeriod_yearBoundary() {
    Resolved r = resolve(new CompletedPeriod(1, CalendarUnit.year), "2026-01-01T00:00:01Z");
    assertEquals(epochMillis("2025-01-01T00:00:00Z"), r.startMillis());
    assertEquals(epochMillis("2026-01-01T00:00:00Z"), r.endMillis());
    assertFalse(r.live());
  }

  // Leap-day boundaries — CompletedPeriod {1, year} from 2024-03-01 and 2024-02-29 both give
  // [2023-01-01, 2024-01-01]. No off-by-one from the leap day.
  @Test
  void completedPeriod_year_leapDayBoundary() {
    Resolved fromMarch1 =
        resolve(new CompletedPeriod(1, CalendarUnit.year), "2024-03-01T00:00:00Z");
    Resolved fromLeapDay =
        resolve(new CompletedPeriod(1, CalendarUnit.year), "2024-02-29T00:00:00Z");

    assertEquals(epochMillis("2023-01-01T00:00:00Z"), fromMarch1.startMillis());
    assertEquals(epochMillis("2024-01-01T00:00:00Z"), fromMarch1.endMillis());
    assertEquals(epochMillis("2023-01-01T00:00:00Z"), fromLeapDay.startMillis());
    assertEquals(epochMillis("2024-01-01T00:00:00Z"), fromLeapDay.endMillis());
  }

  // End-of-month rollover — CompletedPeriod {1, month} on 2026-01-31 → [2025-12-01, 2026-01-01].
  @Test
  void completedPeriod_month_endOfMonthRollover() {
    Resolved r = resolve(new CompletedPeriod(1, CalendarUnit.month), "2026-01-31T15:30:00Z");
    assertEquals(epochMillis("2025-12-01T00:00:00Z"), r.startMillis());
    assertEquals(epochMillis("2026-01-01T00:00:00Z"), r.endMillis());
  }

  // Q1-of-year boundary — CompletedPeriod {1, quarter} on 2026-04-01 → Q1; on 2026-03-31 → Q4
  // prior.
  @Test
  void completedPeriod_quarter_q1Boundary() {
    Resolved fromApril1 =
        resolve(new CompletedPeriod(1, CalendarUnit.quarter), "2026-04-01T00:00:00Z");
    assertEquals(epochMillis("2026-01-01T00:00:00Z"), fromApril1.startMillis());
    assertEquals(epochMillis("2026-04-01T00:00:00Z"), fromApril1.endMillis());

    Resolved fromMarch31 =
        resolve(new CompletedPeriod(1, CalendarUnit.quarter), "2026-03-31T23:59:59Z");
    assertEquals(epochMillis("2025-10-01T00:00:00Z"), fromMarch31.startMillis());
    assertEquals(epochMillis("2026-01-01T00:00:00Z"), fromMarch31.endMillis());
  }

  // CompletedPeriod {2, quarter} — two completed quarters back from mid-Q3.
  @Test
  void completedPeriod_quarter_multipleQuartersBack() {
    Resolved r = resolve(new CompletedPeriod(2, CalendarUnit.quarter), "2026-07-15T10:00:00Z");
    assertEquals(epochMillis("2026-01-01T00:00:00Z"), r.startMillis());
    assertEquals(epochMillis("2026-07-01T00:00:00Z"), r.endMillis());
  }

  // CompletedPeriod {1, week} — ISO week starts Monday. 2026-05-16 (Sat) → [2026-05-04,
  // 2026-05-11].
  @Test
  void completedPeriod_week_isoMondayStart() {
    Resolved r = resolve(new CompletedPeriod(1, CalendarUnit.week), "2026-05-16T12:00:00Z");
    assertEquals(epochMillis("2026-05-04T00:00:00Z"), r.startMillis());
    assertEquals(epochMillis("2026-05-11T00:00:00Z"), r.endMillis());
  }

  // FixedWindow returns its input verbatim regardless of runStart.
  @Test
  void fixedWindow_identity() {
    long start = epochMillis("2026-01-01T00:00:00Z");
    long end = epochMillis("2026-04-01T00:00:00Z");
    FixedWindow fw = new FixedWindow(start, end);

    Resolved r1 = TimeRangeConfigResolver.resolve(fw, Instant.parse("2026-05-16T12:00:00Z"));
    Resolved r2 = TimeRangeConfigResolver.resolve(fw, Instant.parse("2030-12-31T23:59:59Z"));

    assertEquals(start, r1.startMillis());
    assertEquals(end, r1.endMillis());
    assertFalse(r1.live());
    assertEquals(start, r2.startMillis());
    assertEquals(end, r2.endMillis());
    assertFalse(r2.live());
  }

  // --- Jackson polymorphic binding: the existingJavaType directive binds the schema reference
  // directly to this sealed interface, so JsonUtils.convertValue is what Jackson invokes when the
  // parent entity is read off the wire. These assert the production deserialization contract.

  @Test
  void deserializes_liveSnapshot() {
    TimeRangeConfig parsed =
        JsonUtils.convertValue(Map.of("type", "LiveSnapshot"), TimeRangeConfig.class);
    assertInstanceOf(LiveSnapshot.class, parsed);
  }

  @Test
  void deserializes_rollingWindow_withNumericValueAndStringUnit() {
    TimeRangeConfig parsed =
        JsonUtils.convertValue(
            Map.of("type", "RollingWindow", "value", 7, "unit", "day"), TimeRangeConfig.class);
    assertInstanceOf(RollingWindow.class, parsed);
    assertEquals(7, ((RollingWindow) parsed).value());
    assertEquals(CalendarUnit.day, ((RollingWindow) parsed).unit());
  }

  @Test
  void deserializes_completedPeriod_quarter() {
    TimeRangeConfig parsed =
        JsonUtils.convertValue(
            Map.of("type", "CompletedPeriod", "value", 2, "unit", "quarter"),
            TimeRangeConfig.class);
    assertInstanceOf(CompletedPeriod.class, parsed);
    assertEquals(CalendarUnit.quarter, ((CompletedPeriod) parsed).unit());
  }

  @Test
  void deserializes_fixedWindow() {
    TimeRangeConfig parsed =
        JsonUtils.convertValue(
            Map.of("type", "FixedWindow", "startTimestamp", 1_000L, "endTimestamp", 2_000L),
            TimeRangeConfig.class);
    assertInstanceOf(FixedWindow.class, parsed);
    assertEquals(1_000L, ((FixedWindow) parsed).startTimestamp());
    assertEquals(2_000L, ((FixedWindow) parsed).endTimestamp());
  }

  @Test
  void deserializes_nonMapInput_throws() {
    assertThrows(
        IllegalArgumentException.class,
        () -> JsonUtils.convertValue("LiveSnapshot", TimeRangeConfig.class));
  }

  @Test
  void deserializes_missingTypeDiscriminator_throws() {
    HashMap<String, Object> map = new HashMap<>();
    map.put("value", 7);
    map.put("unit", "day");
    assertThrows(
        IllegalArgumentException.class, () -> JsonUtils.convertValue(map, TimeRangeConfig.class));
  }

  @Test
  void deserializes_unknownTypeDiscriminator_throws() {
    assertThrows(
        IllegalArgumentException.class,
        () -> JsonUtils.convertValue(Map.of("type", "BogusWindow"), TimeRangeConfig.class));
  }

  @Test
  void deserializes_rollingWindow_missingValueCaughtByCompactConstructor() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JsonUtils.convertValue(
                Map.of("type", "RollingWindow", "unit", "day"), TimeRangeConfig.class));
  }

  @Test
  void deserializes_rollingWindow_unknownUnitThrows() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JsonUtils.convertValue(
                Map.of("type", "RollingWindow", "value", 1, "unit", "fortnight"),
                TimeRangeConfig.class));
  }

  @Test
  void deserializes_rollingWindow_zeroValueRejectedByCompactConstructor() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JsonUtils.convertValue(
                Map.of("type", "RollingWindow", "value", 0, "unit", "day"), TimeRangeConfig.class));
  }

  @Test
  void deserializes_completedPeriod_negativeValueRejectedByCompactConstructor() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JsonUtils.convertValue(
                Map.of("type", "CompletedPeriod", "value", -1, "unit", "month"),
                TimeRangeConfig.class));
  }

  @Test
  void deserializes_fixedWindow_endNotAfterStartRejectedByCompactConstructor() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JsonUtils.convertValue(
                Map.of("type", "FixedWindow", "startTimestamp", 2_000L, "endTimestamp", 1_000L),
                TimeRangeConfig.class));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JsonUtils.convertValue(
                Map.of("type", "FixedWindow", "startTimestamp", 5_000L, "endTimestamp", 5_000L),
                TimeRangeConfig.class));
  }
}
