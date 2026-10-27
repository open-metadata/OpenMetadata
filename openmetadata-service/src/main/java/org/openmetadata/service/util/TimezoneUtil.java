/*
 *  Copyright 2026 Collate.
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

import java.time.ZoneId;
import java.util.Optional;
import org.openmetadata.service.exception.BadRequestException;

/**
 * Schedule timezones are IANA zone ids only. Kubernetes CronJobs resolve {@code spec.timeZone}
 * against tzdata and reject offsets such as {@code +02:00}, which {@link ZoneId#of} would accept.
 * ADR:2026-10-27-schedules-carry-an-iana-timezone
 */
public final class TimezoneUtil {
  private TimezoneUtil() {}

  /** The zone for a schedule timezone, or empty when none is set. */
  public static Optional<ZoneId> zoneOf(String timezone) {
    if (timezone == null || timezone.isBlank()) {
      return Optional.empty();
    }
    String id = timezone.trim();
    if (!ZoneId.getAvailableZoneIds().contains(id)) {
      throw new BadRequestException(
          String.format(
              "Invalid timezone '%s'. Use an IANA zone id such as Europe/Berlin or UTC.",
              timezone));
    }
    return Optional.of(ZoneId.of(id));
  }

  public static void validate(String timezone) {
    zoneOf(timezone);
  }
}
