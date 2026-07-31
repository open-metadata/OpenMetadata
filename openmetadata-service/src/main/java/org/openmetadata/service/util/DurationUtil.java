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

import java.time.Duration;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAmount;

/**
 * Single home for ISO 8601 duration handling. ISO 8601 splits into two shapes that no single JDK
 * parser accepts together — time-based ({@code PT1H30M}, and day components) parsed by {@link
 * Duration}, and calendar-based ({@code P3M}, {@code P1Y6M}) parsed by {@link Period}. Callers that
 * need to validate or apply a duration go through here instead of re-encoding that split.
 */
public final class DurationUtil {

  private DurationUtil() {}

  /**
   * Parse an ISO 8601 duration as a time-based {@link Duration} or, failing that, a calendar {@link
   * Period}. Both are {@link TemporalAmount}s and can be applied to a temporal with {@code plus(...)}.
   *
   * @throws DateTimeParseException if the value is neither form.
   */
  public static TemporalAmount parseIso8601(String value) {
    TemporalAmount amount;
    try {
      amount = Duration.parse(value);
    } catch (DateTimeParseException notATimeDuration) {
      amount = Period.parse(value);
    }
    return amount;
  }

  /** True when {@code value} is a parseable ISO 8601 duration in either form. */
  public static boolean isValidIso8601(String value) {
    boolean valid = true;
    try {
      parseIso8601(value);
    } catch (DateTimeParseException notADuration) {
      valid = false;
    }
    return valid;
  }
}
