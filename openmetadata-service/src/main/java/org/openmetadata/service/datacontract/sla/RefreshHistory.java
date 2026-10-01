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
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.entity.datacontract.SlaValidation.RefreshedAtSource;

/**
 * What one source records about when a table's data was refreshed.
 *
 * @param observations newest observation first
 */
public record RefreshHistory(RefreshedAtSource source, List<Observation> observations) {

  /**
   * One record of a refresh.
   *
   * @param observedAt when the source recorded it, e.g. when the profiler ran
   * @param refreshedAt when the data was refreshed, e.g. the SLA column's newest value
   */
  public record Observation(Instant observedAt, Instant refreshedAt) {}

  public RefreshHistory {
    if (observations.isEmpty()) {
      throw new IllegalArgumentException("A refresh history needs at least one observation");
    }
    observations =
        observations.stream()
            .distinct()
            .sorted(Comparator.comparing(Observation::observedAt).reversed())
            .toList();
  }

  public Observation newest() {
    return observations.getFirst();
  }

  /** The newest refresh the source had recorded by that time, if it recorded one. */
  public Optional<Observation> newestObservedBy(Instant time) {
    return observations.stream()
        .filter(observation -> !observation.observedAt().isAfter(time))
        .findFirst();
  }
}
