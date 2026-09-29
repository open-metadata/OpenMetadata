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

package org.openmetadata.service.datacontract.odcs;

import static java.util.Map.entry;

import java.util.Locale;
import java.util.Map;

/** ODCS writes time units freely ({@code d}, {@code days}, {@code hrs}); OpenMetadata uses singulars. */
public final class ODCSTimeUnits {
  private static final Map<String, String> ALIASES =
      Map.ofEntries(
          entry("hours", "hour"),
          entry("hrs", "hour"),
          entry("h", "hour"),
          entry("days", "day"),
          entry("d", "day"),
          entry("weeks", "week"),
          entry("wks", "week"),
          entry("w", "week"),
          entry("months", "month"),
          entry("mos", "month"),
          entry("years", "year"),
          entry("yrs", "year"),
          entry("y", "year"),
          entry("minutes", "minute"),
          entry("mins", "minute"),
          entry("m", "minute"),
          entry("seconds", "second"),
          entry("secs", "second"),
          entry("s", "second"));

  private ODCSTimeUnits() {}

  public static String normalize(String unit) {
    String lower = unit == null ? null : unit.toLowerCase(Locale.ROOT).trim();
    return lower == null ? null : ALIASES.getOrDefault(lower, lower);
  }
}
