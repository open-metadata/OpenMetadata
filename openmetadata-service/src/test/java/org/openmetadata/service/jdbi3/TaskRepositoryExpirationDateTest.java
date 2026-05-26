/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertNull;

import java.lang.reflect.Method;
import java.time.Duration;
import java.time.Instant;
import java.time.Period;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAmount;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for the private expiration-date helper methods in TaskRepository.
 *
 * <p>The helpers (parseIsoDuration, computeExpirationMillis) are private-static, so we exercise
 * them through reflection. This keeps the production API clean while still verifying the ISO-8601
 * parse-and-add logic in isolation.
 */
class TaskRepositoryExpirationDateTest {

  private static Method parseIsoDuration() throws Exception {
    Method m = TaskRepository.class.getDeclaredMethod("parseIsoDuration", String.class);
    m.setAccessible(true);
    return m;
  }

  private static Method computeExpirationMillis() throws Exception {
    Method m =
        TaskRepository.class.getDeclaredMethod("computeExpirationMillis", long.class, String.class);
    m.setAccessible(true);
    return m;
  }

  @Test
  void testParseIsoHourDurationReturnsDuration() throws Exception {
    TemporalAmount result = (TemporalAmount) parseIsoDuration().invoke(null, "PT2H");
    assertEquals(Duration.ofHours(2), result);
  }

  @Test
  void testParseIsoDayDurationReturnsDuration() throws Exception {
    TemporalAmount result = (TemporalAmount) parseIsoDuration().invoke(null, "PT48H");
    assertEquals(Duration.ofHours(48), result);
  }

  @Test
  void testParseDayStringReturnsDuration() throws Exception {
    // Java Duration.parse handles PnD as n*24h, so P14D → PT336H (a Duration, not a Period).
    TemporalAmount result = (TemporalAmount) parseIsoDuration().invoke(null, "P14D");
    assertEquals(Duration.ofDays(14), result);
  }

  @Test
  void testParseIsoYearStringReturnsPeriod() throws Exception {
    // P1Y cannot be parsed by Duration.parse, so it falls through to Period.parse.
    TemporalAmount result = (TemporalAmount) parseIsoDuration().invoke(null, "P1Y");
    assertEquals(Period.ofYears(1), result);
  }

  @Test
  void testParseIsoMonthPeriodReturnsPeriod() throws Exception {
    TemporalAmount result = (TemporalAmount) parseIsoDuration().invoke(null, "P3M");
    assertEquals(Period.ofMonths(3), result);
  }

  @Test
  void testParseInvalidDurationReturnsNull() throws Exception {
    Object result = parseIsoDuration().invoke(null, "invalid");
    assertNull(result);
  }

  @Test
  void testParseBlankStringReturnsNull() throws Exception {
    Object result = parseIsoDuration().invoke(null, "");
    assertNull(result);
  }

  @Test
  void testComputeExpirationMillisWithHourDuration() throws Exception {
    long grantedAt = Instant.now().toEpochMilli();
    Long result = (Long) computeExpirationMillis().invoke(null, grantedAt, "PT2H");
    assertEquals(grantedAt + Duration.ofHours(2).toMillis(), result);
  }

  @Test
  void testComputeExpirationMillisWithDurationDays() throws Exception {
    // P14D → Duration.ofDays(14) via Duration.parse; result = grantedAt + exact millis.
    long grantedAt = Instant.now().toEpochMilli();
    Long result = (Long) computeExpirationMillis().invoke(null, grantedAt, "P14D");
    assertEquals(grantedAt + Duration.ofDays(14).toMillis(), result);
  }

  @Test
  void testComputeExpirationMillisWithPeriodYears() throws Exception {
    // P1Y → Period via Period.parse (Duration.parse fails for year-based strings).
    // The production code truncates grantedAt to seconds: ofEpochSecond(millis/1000).
    long grantedAt = Instant.now().toEpochMilli();
    Long result = (Long) computeExpirationMillis().invoke(null, grantedAt, "P1Y");

    Instant expected =
        Instant.ofEpochSecond(grantedAt / 1000)
            .atZone(ZoneOffset.UTC)
            .toLocalDateTime()
            .plus(Period.ofYears(1))
            .toInstant(ZoneOffset.UTC);
    assertEquals(expected.toEpochMilli(), result);
  }

  @Test
  void testComputeExpirationMillisWithInvalidDurationReturnsNull() throws Exception {
    long grantedAt = Instant.now().toEpochMilli();
    Object result = computeExpirationMillis().invoke(null, grantedAt, "not-a-duration");
    assertNull(result);
  }

  @Test
  void testDayStringAndHourStringProduceSameResult() throws Exception {
    // P1D and PT24H both parse to Duration.ofDays(1) / Duration.ofHours(24) via Duration.parse,
    // so both take the Duration branch and produce identical millisecond-exact results.
    long grantedAt = Instant.parse("2024-03-09T23:00:00Z").toEpochMilli();
    long oneDayMillis = ChronoUnit.DAYS.getDuration().toMillis();

    Long p1dResult = (Long) computeExpirationMillis().invoke(null, grantedAt, "P1D");
    Long pt24hResult = (Long) computeExpirationMillis().invoke(null, grantedAt, "PT24H");

    assertEquals(grantedAt + oneDayMillis, p1dResult);
    assertEquals(grantedAt + oneDayMillis, pt24hResult);
  }
}
