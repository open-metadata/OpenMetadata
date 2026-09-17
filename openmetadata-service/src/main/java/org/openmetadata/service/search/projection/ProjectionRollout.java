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
package org.openmetadata.service.search.projection;

import io.micrometer.core.instrument.Metrics;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeDescription;

/**
 * The gate in front of the projector, and the measurement that has to come before it opens.
 *
 * <p>Phase 4 replaces the live path's seven-field allowlist with the declared lineage. That changes
 * the hottest write path in the product, so the design asks for a flag, a per-entity-type rollout and
 * a canary metric. This is that flag — <b>off by default</b>, and the only thing it currently enables
 * is <em>shadow</em> comparison: the planner's decision is computed and counted alongside the existing
 * one, and the existing one still executes. Nothing about the write changes.
 *
 * <p>The point is that "partial coverage goes from 7 fields to all declared fields" is an assertion
 * until someone measures it on real traffic. These counters are how it gets measured before it is
 * believed:
 *
 * <ul>
 *   <li>{@code narrowed_where_full} — the win. The planner would write a subset where the current code
 *       falls back to a whole document.
 *   <li>{@code widened_where_partial} — the planner is more conservative than today's code. Safe, but
 *       a surprise worth seeing, and usually means a lineage is missing.
 *   <li>{@code agreed} — both reach the same shape.
 *   <li>{@code reprojection_required} — the mask reaches a path no script can maintain, so a cascade
 *       here would have to rebuild rather than script.
 * </ul>
 *
 * <p>Read once at class initialisation: this sits on the hottest write path, and a per-write property
 * lookup to support flipping it at runtime would cost more than the feature saves. Restart to change
 * it.
 */
@Slf4j
public final class ProjectionRollout {

  public static final String SHADOW_PROPERTY = "openmetadata.search.projection.shadow";

  /** Drift detection (§11.4). Separate from the shadow flag: it samples reads, not writes. */
  public static final String DRIFT_PROPERTY = "openmetadata.search.projection.drift";

  private static final boolean SHADOW_ENABLED =
      Boolean.parseBoolean(System.getProperty(SHADOW_PROPERTY, "false"));

  private static final boolean DRIFT_ENABLED =
      Boolean.parseBoolean(System.getProperty(DRIFT_PROPERTY, "false"));

  private static final String METRIC = "search.index.projection.shadow";

  private ProjectionRollout() {}

  public static boolean shadowEnabled() {
    return SHADOW_ENABLED;
  }

  /**
   * Off by default in production until the cost of detection is measured — it re-projects sampled
   * documents, which is real work on a live node.
   */
  public static boolean driftDetectionEnabled() {
    return DRIFT_ENABLED;
  }

  /**
   * Counts how the planner's decision compares with the live path's, without altering either.
   *
   * @param currentWouldScript what {@code canUseScriptedPartialUpdate} decided — the behaviour that
   *     actually runs
   */
  public static void recordShadowComparison(
      MutationPlanner planner, ChangeDescription changeDescription, boolean currentWouldScript) {
    if (!SHADOW_ENABLED) {
      return;
    }
    try {
      MutationPlanner.Mutation mutation = planner.plan(changeDescription);
      boolean plannerWouldScript = !mutation.isFullUpsert();
      String outcome =
          plannerWouldScript == currentWouldScript
              ? "agreed"
              : plannerWouldScript ? "narrowed_where_full" : "widened_where_partial";
      Metrics.counter(METRIC, "outcome", outcome, "reason", mutation.reason().name()).increment();
      if (plannerWouldScript && planner.requiresReprojection(mutation.mask())) {
        Metrics.counter(METRIC, "outcome", "reprojection_required").increment();
      }
    } catch (Exception e) {
      // Shadow accounting must never be able to break a write it is only observing.
      LOG.debug("Projection shadow comparison failed", e);
    }
  }
}
