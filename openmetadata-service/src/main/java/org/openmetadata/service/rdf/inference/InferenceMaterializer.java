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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.ServiceUnavailableException;
import java.time.Clock;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.rdf.RdfRepository;

/** Executes inference rules entirely inside Fuseki and records durable run state. */
@Slf4j
public final class InferenceMaterializer {
  private final RdfRepository rdfRepository;
  private final InferenceRuleRepository ruleRepository;
  private final Clock clock;

  public InferenceMaterializer(
      final RdfRepository rdfRepository,
      final InferenceRuleRepository ruleRepository,
      final Clock clock) {
    this.rdfRepository = rdfRepository;
    this.ruleRepository = ruleRepository;
    this.clock = clock;
  }

  public InferenceMaterializationResult materialize(
      final boolean force, final String requestedRule) {
    requireAvailable();
    requireRequestedRule(requestedRule);
    final long startedAt = clock.millis();
    final List<InferenceRuleStatus> targets =
        ruleRepository.listForMaterialization(force, requestedRule);
    clearTargets(targets);
    final List<RuleOutcome> outcomes = targets.stream().map(this::materializeRule).toList();
    final InferenceMaterializationResult result = toResult(startedAt, outcomes);
    OntologyMetrics.recordInferenceRun(result.getFailedRules() == 0);
    return result;
  }

  public void clear(final String graphUri) {
    requireAvailable();
    rdfRepository.executeInferenceMaterializationUpdate(
        InferenceMaterializationQueryBuilder.clear(graphUri));
  }

  private void clearTargets(final List<InferenceRuleStatus> targets) {
    if (!nullOrEmpty(targets)) {
      rdfRepository.executeInferenceMaterializationUpdate(
          InferenceMaterializationQueryBuilder.clear(targets));
    }
  }

  private RuleOutcome materializeRule(final InferenceRuleStatus target) {
    RuleOutcome outcome;
    try {
      final InferenceRuleStatus status =
          Boolean.FALSE.equals(target.getRule().getEnabled())
              ? ruleRepository.recordMaterialized(target.getRule().getName(), clock.millis(), 0)
              : materializeSuccessfully(target);
      outcome = new RuleOutcome(status, true);
    } catch (RuntimeException exception) {
      LOG.error(
          "Inference rule '{}' materialization failed", target.getRule().getName(), exception);
      outcome = new RuleOutcome(recordFailure(target, exception), false);
    }
    return outcome;
  }

  private InferenceRuleStatus materializeSuccessfully(final InferenceRuleStatus target) {
    rdfRepository.executeInferenceMaterializationUpdate(
        InferenceMaterializationQueryBuilder.build(target));
    final long tripleCount = rdfRepository.getGraphTripleCount(target.getGraphUri().toString());
    return ruleRepository.recordMaterialized(
        target.getRule().getName(), clock.millis(), tripleCount);
  }

  private InferenceRuleStatus recordFailure(
      final InferenceRuleStatus target, final RuntimeException exception) {
    final String message =
        "Rule '%s' failed: %s".formatted(target.getRule().getName(), exception.getMessage());
    return ruleRepository.recordFailure(target.getRule().getName(), message);
  }

  private InferenceMaterializationResult toResult(
      final long startedAt, final List<RuleOutcome> outcomes) {
    final int successfulRules = (int) outcomes.stream().filter(RuleOutcome::successful).count();
    return new InferenceMaterializationResult()
        .withStartedAt(startedAt)
        .withCompletedAt(clock.millis())
        .withSuccessfulRules(successfulRules)
        .withFailedRules(outcomes.size() - successfulRules)
        .withProcessedRules(outcomes.stream().map(RuleOutcome::status).toList());
  }

  private void requireAvailable() {
    final RdfConfiguration config = rdfRepository.getConfig();
    final boolean isFuseki = config.getStorageType() == RdfConfiguration.StorageType.FUSEKI;
    if (!rdfRepository.isEnabled()
        || !Boolean.TRUE.equals(config.getMaterializedInferenceEnabled())
        || !isFuseki) {
      throw new ServiceUnavailableException(
          "Fuseki materialized inference is not enabled for this server");
    }
  }

  private void requireRequestedRule(final String requestedRule) {
    if (requestedRule != null) {
      ruleRepository.get(requestedRule);
    }
  }

  private record RuleOutcome(InferenceRuleStatus status, boolean successful) {}
}
