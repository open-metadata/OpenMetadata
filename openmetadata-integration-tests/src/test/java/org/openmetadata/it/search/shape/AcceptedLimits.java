/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

import java.util.List;
import java.util.Optional;

/**
 * Opt-in list of search-index shapes whose non-OK outcome is consciously accepted. A case listed
 * here is tolerated (the canary stays green and logs the reason); ANY case NOT listed must index
 * and be queryable (Outcome.OK) or {@link org.openmetadata.it.tests.EntityShapeIT} fails red.
 *
 * <p>Add an entry to accept a limit (e.g. "1M columns may fail"); remove it (or fix the root cause)
 * to make the case red again. Granularity is per (entityType, dimension, rung). Use {@link
 * #ALL_ENTITIES} as the entityType for a limit that is inherent to the engine (not one entity's
 * mapping) and therefore universal across every indexed type.
 */
public final class AcceptedLimits {

  /**
   * Wildcard entityType. An {@link Accepted} declared with this matches the given dimension+rung for
   * every entity type — use it for inherent ES/OS limits rather than repeating the same entry once
   * per entity.
   */
  public static final String ALL_ENTITIES = "*";

  public record Accepted(
      String entityType, String dimension, String rung, Outcome outcome, String reason) {}

  private static final List<Accepted> ACCEPTED =
      List.of(
          new Accepted(
              ALL_ENTITIES,
              "owners.count",
              "12k",
              Outcome.REJECTED,
              "owners is a nested field; 12k owners exceeds the inherent ES/OS "
                  + "index.mapping.nested_objects.limit (10000). No real entity has thousands of "
                  + "owners — raising the limit to admit pathological docs is worse than rejecting."),
          new Accepted(
              ALL_ENTITIES,
              "keyword.overIgnoreAbove",
              "300chars",
              Outcome.DEGRADED_UNSEARCHABLE,
              "displayName.keyword uses ignore_above:256 (intentional immense-term guard). A "
                  + "300-char value is kept in _source and stays full-text searchable, but is "
                  + "dropped from the keyword term index so exact-match on displayName.keyword misses."));

  private AcceptedLimits() {}

  public static Optional<Accepted> find(
      final String entityType, final String dimension, final String rung) {
    return ACCEPTED.stream()
        .filter(
            a ->
                (a.entityType().equals(ALL_ENTITIES) || a.entityType().equals(entityType))
                    && a.dimension().equals(dimension)
                    && a.rung().equals(rung))
        .findFirst();
  }
}
