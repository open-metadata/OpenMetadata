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

import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.data.ContractSLA;

/**
 * The time zone an SLA's availability time is stated in. The contract stores it as a label such as
 * {@code GMT-05:00 (America/New York)}; the region is used when it names a real zone, so daylight
 * saving applies, and the offset otherwise ({@code Asia/Iran} is a label, not a zone).
 */
final class SlaTimeZone {
  private static final Pattern GMT_LABEL =
      Pattern.compile("^GMT([+-]\\d{2}:\\d{2})(?: \\((.+)\\))?$");

  private SlaTimeZone() {}

  /** The SLA's zone, else one named after its availability time ("09:00 UTC"), else UTC. */
  static ZoneId of(ContractSLA sla) {
    Optional<ZoneId> declared =
        Optional.ofNullable(sla.getTimezone()).flatMap(label -> parse(label.value()));
    return declared
        .or(() -> Optional.ofNullable(sla.getAvailabilityTime()).flatMap(SlaTimeZone::trailingZone))
        .orElse(ZoneOffset.UTC);
  }

  static Optional<ZoneId> parse(String label) {
    Matcher gmt = GMT_LABEL.matcher(label.trim());
    return gmt.matches()
        ? Optional.ofNullable(gmt.group(2))
            .flatMap(region -> zone(region.replace(' ', '_')))
            .or(() -> zone(gmt.group(1)))
        : zone(label.trim());
  }

  private static Optional<ZoneId> trailingZone(String availabilityTime) {
    String[] parts = availabilityTime.trim().split("\\s+", 2);
    return parts.length == 2 ? zone(parts[1]) : Optional.empty();
  }

  private static Optional<ZoneId> zone(String id) {
    Optional<ZoneId> zone;
    try {
      zone = Optional.of(ZoneId.of(id));
    } catch (DateTimeException e) {
      zone = Optional.empty();
    }
    return zone;
  }
}
