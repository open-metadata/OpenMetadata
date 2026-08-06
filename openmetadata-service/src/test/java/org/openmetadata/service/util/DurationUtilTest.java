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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Period;
import java.time.format.DateTimeParseException;
import org.junit.jupiter.api.Test;

class DurationUtilTest {

  @Test
  void parsesTimeBasedFormAsDuration() {
    assertEquals(Duration.ofMinutes(90), DurationUtil.parseIso8601("PT1H30M"));
  }

  @Test
  void parsesDayFormAsDuration() {
    // Duration accepts day components; P14D is time-based, not a calendar Period.
    assertEquals(Duration.ofDays(14), DurationUtil.parseIso8601("P14D"));
  }

  @Test
  void parsesCalendarMonthFormAsPeriod() {
    // Duration.parse rejects month/year designators; the Period fallback handles them.
    assertEquals(Period.ofMonths(3), DurationUtil.parseIso8601("P3M"));
  }

  @Test
  void parsesCalendarYearAndMonthAsPeriod() {
    assertEquals(Period.of(1, 6, 0), DurationUtil.parseIso8601("P1Y6M"));
  }

  @Test
  void parseThrowsOnNonIsoValue() {
    assertThrows(DateTimeParseException.class, () -> DurationUtil.parseIso8601("14 days"));
  }

  @Test
  void parseThrowsOnEmptyValue() {
    assertThrows(DateTimeParseException.class, () -> DurationUtil.parseIso8601(""));
  }

  @Test
  void timeDurationIsValid() {
    assertTrue(DurationUtil.isValidIso8601("PT30S"));
  }

  @Test
  void dayDurationIsValid() {
    assertTrue(DurationUtil.isValidIso8601("P14D"));
  }

  @Test
  void calendarPeriodIsValid() {
    assertTrue(DurationUtil.isValidIso8601("P1M"));
  }

  @Test
  void nonIsoStringIsInvalid() {
    assertFalse(DurationUtil.isValidIso8601("14 days"));
  }

  @Test
  void emptyStringIsInvalid() {
    assertFalse(DurationUtil.isValidIso8601(""));
  }
}
