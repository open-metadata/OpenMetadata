/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.StepStats;

/**
 * Runs an ordered list of {@link EnrichmentStep}s against an {@link EnrichmentTarget} with
 * per-step failure isolation. A step throwing only affects that step's contribution to the
 * snapshot: sibling steps still run, the entity is still emitted, and the failure is reflected in
 * per-step {@link StepStats} counters.
 *
 * <p>Thread-safe — the same pipeline instance is invoked concurrently from per-entity virtual
 * threads in {@link
 * org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow}.
 */
@Slf4j
public class EnrichmentPipeline {

  /**
   * Cap on per-step {@code LOG.warn} samples per pipeline lifetime (i.e. per workflow run, since a
   * new pipeline is built when the processor is constructed). Prevents log floods when a single
   * recurring failure mode hits every entity.
   */
  static final int MAX_WARN_SAMPLES_PER_STEP = 10;

  private final List<EnrichmentStep> steps;
  private final Map<String, AtomicLong> successCounts;
  private final Map<String, AtomicLong> failureCounts;
  private final Map<String, AtomicInteger> warnSamples;

  public EnrichmentPipeline(List<EnrichmentStep> steps) {
    Set<String> seen = new HashSet<>();
    for (EnrichmentStep step : steps) {
      if (!seen.add(step.name())) {
        throw new IllegalArgumentException(
            "Duplicate enrichment step name in pipeline: " + step.name());
      }
    }
    this.steps = List.copyOf(steps);
    this.successCounts = new ConcurrentHashMap<>();
    this.failureCounts = new ConcurrentHashMap<>();
    this.warnSamples = new ConcurrentHashMap<>();
    for (EnrichmentStep step : steps) {
      successCounts.put(step.name(), new AtomicLong(0));
      failureCounts.put(step.name(), new AtomicLong(0));
      warnSamples.put(step.name(), new AtomicInteger(0));
    }
  }

  /**
   * Run every step against {@code target}. Step failures are caught individually — the returned
   * list contains one {@link StepFailure} per step that threw. The target's entity map reflects
   * the contributions of all steps that succeeded.
   */
  public List<StepFailure> run(EnrichmentTarget target) {
    List<StepFailure> failures = new ArrayList<>();
    for (EnrichmentStep step : steps) {
      try {
        step.apply(target);
        successCounts.get(step.name()).incrementAndGet();
      } catch (Exception e) {
        failureCounts.get(step.name()).incrementAndGet();
        StepFailure failure = new StepFailure(step.name(), entityFqnOf(target), e);
        failures.add(failure);
        logRateLimited(failure);
      }
    }
    return failures;
  }

  /**
   * Returns a per-step {@link StepStats} snapshot keyed by step name. Safe to call concurrently
   * with {@link #run(EnrichmentTarget)}; values reflect the moment the snapshot was taken.
   */
  public Map<String, StepStats> snapshotStats() {
    Map<String, StepStats> snapshot = new LinkedHashMap<>();
    for (EnrichmentStep step : steps) {
      long succ = successCounts.get(step.name()).get();
      long fail = failureCounts.get(step.name()).get();
      snapshot.put(
          step.name(),
          new StepStats()
              .withTotalRecords((int) (succ + fail))
              .withSuccessRecords((int) succ)
              .withFailedRecords((int) fail));
    }
    return snapshot;
  }

  private static String entityFqnOf(EnrichmentTarget target) {
    return target.entity() != null && target.entity().getFullyQualifiedName() != null
        ? target.entity().getFullyQualifiedName()
        : "<unknown>";
  }

  private void logRateLimited(StepFailure failure) {
    int n = warnSamples.get(failure.stepName()).incrementAndGet();
    if (n > MAX_WARN_SAMPLES_PER_STEP) {
      return;
    }
    String suppressedNote =
        n == MAX_WARN_SAMPLES_PER_STEP ? " (further samples suppressed this run)" : "";
    LOG.warn(
        "[DataInsights enricher] step='{}' entity='{}' failed: {}{}",
        failure.stepName(),
        failure.entityFqn(),
        failure.cause().toString(),
        suppressedNote);
  }
}
