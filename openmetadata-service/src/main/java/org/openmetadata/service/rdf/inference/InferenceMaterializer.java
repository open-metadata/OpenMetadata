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

package org.openmetadata.service.rdf.inference;

import jakarta.ws.rs.ServiceUnavailableException;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.rdf.inference.InferenceRuleRepository.RuleSnapshot;
import org.openmetadata.service.rdf.storage.RdfWriteOutcomeUnknownException;

/**
 * Materializes the rule bundle inside Fuseki as one fixed point per run. A run empties every rule
 * graph, then applies the enabled rules in passes until a pass derives nothing new. Rules may
 * therefore read each other's conclusions in any order, and nothing derived from a fact that has
 * since been removed survives the run. A run that does not converge within its pass budget fails
 * rather than reporting a partial result as complete.
 */
@Slf4j
public final class InferenceMaterializer {
  /**
   * Each pass extends derivations by one rule application, so this bounds the longest chain the
   * bundle can follow, such as the number of column-lineage hops a PII tag propagates across.
   */
  static final int MAX_FIXED_POINT_PASSES = 64;

  private static final String UNAVAILABLE =
      "Fuseki materialized inference is not enabled for this server";
  private static final String RULE_FAILED = "Rule '%s' failed: %s";
  private static final String NO_FIXED_POINT =
      "The rules did not reach a fixed point within %d passes; the last pass derived %d new"
          + " triples";
  private static final String RUN_FAILED = "Inference run failed: %s";
  private static final String LEASE_LOST =
      "Another inference run took over the materialization lock, so this run stopped";
  private static final String LEASE_KEPT =
      "Keeping the inference materialization lock of run {} until it expires: Fuseki may still be"
          + " applying an update whose outcome is unknown, and the next run must not clear the rule"
          + " graphs underneath it";

  private final InferenceGraphStore store;
  private final InferenceRuleRepository rules;
  private final InferenceRunLock runLock;
  private final Clock clock;
  private final int maxPasses;

  public InferenceMaterializer(
      final InferenceGraphStore store,
      final InferenceRuleRepository rules,
      final InferenceRunLock runLock,
      final Clock clock) {
    this(store, rules, runLock, clock, MAX_FIXED_POINT_PASSES);
  }

  InferenceMaterializer(
      final InferenceGraphStore store,
      final InferenceRuleRepository rules,
      final InferenceRunLock runLock,
      final Clock clock,
      final int maxPasses) {
    this.store = store;
    this.rules = rules;
    this.runLock = runLock;
    this.clock = clock;
    this.maxPasses = maxPasses;
  }

  /**
   * Recomputes every rule when any rule is dirty, or when forced. A requested rule must exist, but
   * the whole bundle still runs because rules read each other's conclusions.
   */
  public InferenceMaterializationResult materialize(
      final boolean force, final String requestedRule) {
    requireAvailable();
    requireRequestedRule(requestedRule);
    final long startedAt = clock.millis();
    final RunOutcome outcome;
    try (Lease lease = acquireLease()) {
      outcome = run(force, lease);
    }
    OntologyMetrics.recordInferenceRun(outcome.failedRules() == 0);
    return outcome.toResult(startedAt, clock.millis());
  }

  /**
   * Deletes a rule and marks the others dirty, since they may have read its conclusions. Its graph
   * is emptied now, unless a run in progress may still be writing it; the next run empties it then.
   */
  public void deleteRule(final InferenceRuleStatus status) {
    requireAvailable();
    rules.delete(status.getRule().getName());
    rules.markAllDirty();
    clearUnlessRunning(graphUri(status));
  }

  private RunOutcome run(final boolean force, final Lease lease) {
    final List<RuleSnapshot> snapshots = rules.listForRun();
    final boolean hasPendingChanges =
        snapshots.stream().anyMatch(snapshot -> Boolean.TRUE.equals(snapshot.status().getDirty()));
    return force || hasPendingChanges ? recompute(snapshots, lease) : RunOutcome.NOTHING_TO_DO;
  }

  private RunOutcome recompute(final List<RuleSnapshot> snapshots, final Lease lease) {
    RunOutcome outcome;
    try {
      store.update(InferenceMaterializationQueryBuilder.clear(rules.graphUrisOfAllRules()));
      computeFixedPoint(snapshots.stream().filter(RuleSnapshot::isEnabled).toList(), lease);
      outcome = new RunOutcome(recordSuccess(snapshots), 0);
    } catch (RuntimeException exception) {
      LOG.error("Inference materialization run failed", exception);
      if (RdfWriteOutcomeUnknownException.isPresent(exception)) {
        lease.keepUntilExpiry();
      }
      final List<InferenceRuleStatus> failed = recordFailure(snapshots, exception);
      outcome = new RunOutcome(failed, failed.size());
    }
    return outcome;
  }

  private void computeFixedPoint(final List<RuleSnapshot> enabledRules, final Lease lease) {
    long derivedTriples = 0;
    long derivedByLastPass = -1;
    int passes = 0;
    while (derivedByLastPass != 0 && passes < maxPasses) {
      final long derivedAfterPass = applyPass(enabledRules, lease);
      derivedByLastPass = derivedAfterPass - derivedTriples;
      derivedTriples = derivedAfterPass;
      passes++;
    }
    if (derivedByLastPass != 0) {
      throw new IllegalStateException(NO_FIXED_POINT.formatted(maxPasses, derivedByLastPass));
    }
  }

  /**
   * Rule graphs only grow during a run, so an unchanged total means no rule derived anything new
   * from the state every other rule left behind.
   */
  private long applyPass(final List<RuleSnapshot> enabledRules, final Lease lease) {
    enabledRules.forEach(rule -> applyRule(rule, lease));
    lease.renew();
    return enabledRules.stream()
        .mapToLong(rule -> store.tripleCount(graphUri(rule.status())))
        .sum();
  }

  private void applyRule(final RuleSnapshot rule, final Lease lease) {
    lease.renew();
    try {
      store.update(InferenceMaterializationQueryBuilder.insert(rule.status()));
    } catch (RuntimeException exception) {
      throw new IllegalStateException(
          RULE_FAILED.formatted(rule.name(), exception.getMessage()), exception);
    }
  }

  private List<InferenceRuleStatus> recordSuccess(final List<RuleSnapshot> snapshots) {
    final long completedAt = clock.millis();
    return snapshots.stream()
        .map(
            snapshot ->
                snapshot.isEnabled()
                    ? rules.recordMaterialized(
                        snapshot, completedAt, store.tripleCount(graphUri(snapshot.status())))
                    : rules.recordCleared(snapshot, completedAt))
        .flatMap(Optional::stream)
        .toList();
  }

  /**
   * Every enabled rule fails with the run, since each may have read an incomplete closure.
   * Disabled rules are left as they were: their graphs stay empty either way.
   */
  private List<InferenceRuleStatus> recordFailure(
      final List<RuleSnapshot> snapshots, final RuntimeException exception) {
    final String error = RUN_FAILED.formatted(exception.getMessage());
    return snapshots.stream()
        .filter(RuleSnapshot::isEnabled)
        .map(snapshot -> rules.recordFailure(snapshot, error))
        .flatMap(Optional::stream)
        .toList();
  }

  private void clearUnlessRunning(final String graphUri) {
    final String runId = UUID.randomUUID().toString();
    if (runLock.tryAcquire(runId)) {
      try {
        store.update(InferenceMaterializationQueryBuilder.clear(List.of(graphUri)));
      } finally {
        runLock.release(runId);
      }
    }
  }

  private Lease acquireLease() {
    final String runId = UUID.randomUUID().toString();
    if (!runLock.tryAcquire(runId)) {
      throw new InferenceRunInProgressException();
    }
    return new Lease(runId);
  }

  private void requireAvailable() {
    if (!store.isAvailable()) {
      throw new ServiceUnavailableException(UNAVAILABLE);
    }
  }

  private void requireRequestedRule(final String requestedRule) {
    if (requestedRule != null) {
      rules.get(requestedRule);
    }
  }

  private static String graphUri(final InferenceRuleStatus status) {
    return status.getGraphUri().toString();
  }

  /**
   * Renewed in the background while held, and also before each update so a run stops as soon as
   * another one has taken it over.
   */
  private final class Lease implements AutoCloseable {
    private final String runId;
    private final Runnable stopHeartbeat;
    private boolean keepUntilExpiry;

    private Lease(final String runId) {
      this.runId = runId;
      this.stopHeartbeat = runLock.keepAlive(runId);
    }

    /**
     * OM stops waiting for an update at its request timeout, but Fuseki keeps applying it until its
     * own update timeout, which is shorter than the lease.
     */
    private void keepUntilExpiry() {
      keepUntilExpiry = true;
    }

    private void renew() {
      if (!runLock.renew(runId)) {
        throw new IllegalStateException(LEASE_LOST);
      }
    }

    @Override
    public void close() {
      stopHeartbeat.run();
      if (keepUntilExpiry) {
        LOG.warn(LEASE_KEPT, runId);
      } else {
        runLock.release(runId);
      }
    }
  }

  private record RunOutcome(List<InferenceRuleStatus> processedRules, int failedRules) {
    private static final RunOutcome NOTHING_TO_DO = new RunOutcome(List.of(), 0);

    private InferenceMaterializationResult toResult(final long startedAt, final long completedAt) {
      return new InferenceMaterializationResult()
          .withStartedAt(startedAt)
          .withCompletedAt(completedAt)
          .withSuccessfulRules(processedRules.size() - failedRules)
          .withFailedRules(failedRules)
          .withProcessedRules(processedRules);
    }
  }
}
