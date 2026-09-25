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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.datacontract.SlaValidation;
import org.openmetadata.schema.entity.datacontract.SlaValidation.RefreshedAtSource;
import org.openmetadata.service.datacontract.sla.RefreshHistory.Observation;

/**
 * One evaluation of a contract's SLA at a point in time. Each requirement is met, missed, or left
 * unset when nothing recorded can decide it; the message says which were missed and why the others
 * were not evaluated.
 */
final class SlaCheck {
  private static final Pattern TIME_OF_DAY = Pattern.compile("^(\\d{1,2}):(\\d{2})");

  private final ContractSLA sla;
  private final ZoneId zone;
  private final ZonedDateTime now;
  private final SlaValidation validation = new SlaValidation();
  private final List<String> notes = new ArrayList<>();

  SlaCheck(ContractSLA sla, Instant now) {
    this.sla = sla;
    this.zone = SlaTimeZone.of(sla);
    this.now = now.atZone(zone);
  }

  ZoneId zone() {
    return zone;
  }

  /** How far back refresh observations are needed: the day before the latest deadline. */
  Instant since() {
    return latestDeadline()
        .map(deadline -> deadline.toLocalDate().minusDays(1).atStartOfDay(zone).toInstant())
        .orElse(now.toInstant());
  }

  SlaValidation evaluate(RefreshHistory history) {
    validation
        .withLastRefreshedAt(history.newest().refreshedAt().toEpochMilli())
        .withRefreshedAtSource(history.source());
    checkRefreshFrequency(history.newest());
    checkLatency(history);
    checkAvailability(history);
    if (sla.getRetention() != null) {
      notes.add("Retention is not checked.");
    }
    return validation.withMessage(notes.isEmpty() ? null : String.join(" ", notes));
  }

  private void checkRefreshFrequency(Observation newest) {
    RefreshFrequency frequency = sla.getRefreshFrequency();
    if (frequency != null) {
      String unit = frequency.getUnit().value();
      Instant cutoff = now.minus(frequency.getInterval(), RefreshTimes.unit(unit)).toInstant();
      boolean met = !newest.refreshedAt().isBefore(cutoff);
      validation.setRefreshFrequencyMet(met);
      if (!met) {
        notes.add(
            String.format(
                "Refresh frequency missed: the data was last refreshed at %s, more than %s ago.",
                newest.refreshedAt(), RefreshTimes.describe(frequency.getInterval(), unit)));
      }
    }
  }

  private void checkLatency(RefreshHistory history) {
    MaxLatency maxLatency = sla.getMaxLatency();
    if (maxLatency != null && history.source() == RefreshedAtSource.SLA_COLUMN_PROFILE) {
      checkLatency(history.newest(), maxLatency);
    } else if (maxLatency != null) {
      notes.add("Latency is not evaluated: it needs a profile of the SLA column.");
    }
  }

  /** Latency is how old the newest data already was when the profiler looked at it. */
  private void checkLatency(Observation newest, MaxLatency maxLatency) {
    String unit = maxLatency.getUnit().value();
    Duration allowed = Duration.of(maxLatency.getValue(), RefreshTimes.unit(unit));
    Duration latency = Duration.between(newest.refreshedAt(), newest.observedAt());
    long latencyMillis = Math.max(0, latency.toMillis());
    boolean met = latencyMillis <= allowed.toMillis();
    validation
        .withLatencyMet(met)
        .withActualLatency((int) Math.min(Integer.MAX_VALUE, latencyMillis));
    if (!met) {
      notes.add(
          String.format(
              "Latency missed: the newest data was %d minutes old when profiled, over the %s allowed.",
              latency.toMinutes(), RefreshTimes.describe(maxLatency.getValue(), unit)));
    }
  }

  private void checkAvailability(RefreshHistory history) {
    if (!nullOrEmpty(sla.getAvailabilityTime())) {
      latestDeadline()
          .ifPresentOrElse(
              deadline -> checkAvailableBy(deadline, history),
              () ->
                  notes.add(
                      String.format(
                          "Availability is not evaluated: '%s' is not a time of day (HH:mm).",
                          sla.getAvailabilityTime())));
    }
  }

  /** Available means the newest refresh recorded by the deadline is from the deadline's day. */
  private void checkAvailableBy(ZonedDateTime deadline, RefreshHistory history) {
    Instant dayStart = deadline.toLocalDate().atStartOfDay(zone).toInstant();
    history
        .newestObservedBy(deadline.toInstant())
        .ifPresentOrElse(
            observation ->
                recordAvailability(!observation.refreshedAt().isBefore(dayStart), deadline),
            () ->
                notes.add(
                    String.format(
                        "Availability is not evaluated: nothing recorded a refresh by %s.",
                        describe(deadline))));
  }

  private void recordAvailability(boolean met, ZonedDateTime deadline) {
    validation.setAvailabilityMet(met);
    if (!met) {
      notes.add(
          String.format(
              "Availability missed: no data from %s had arrived by %s.",
              deadline.toLocalDate(), describe(deadline)));
    }
  }

  /** The most recent availability deadline that has passed. */
  private Optional<ZonedDateTime> latestDeadline() {
    return Optional.ofNullable(sla.getAvailabilityTime())
        .flatMap(SlaCheck::timeOfDay)
        .map(time -> now.toLocalDate().atTime(time).atZone(zone))
        .map(today -> today.isAfter(now) ? today.minusDays(1) : today);
  }

  private static Optional<LocalTime> timeOfDay(String availabilityTime) {
    Matcher matcher = TIME_OF_DAY.matcher(availabilityTime.trim());
    Optional<LocalTime> time = Optional.empty();
    try {
      if (matcher.find()) {
        time =
            Optional.of(
                LocalTime.of(
                    Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2))));
      }
    } catch (DateTimeException e) {
      time = Optional.empty();
    }
    return time;
  }

  private String describe(ZonedDateTime deadline) {
    return String.format("%s %s", deadline.toLocalDateTime(), zone);
  }
}
