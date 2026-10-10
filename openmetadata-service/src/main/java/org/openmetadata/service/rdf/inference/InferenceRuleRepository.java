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

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.net.URI;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfInferenceRuleDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfInferenceRuleDAO.RdfInferenceRuleRow;

/** Durable inference-rule definitions and materialization state. */
@Slf4j
public final class InferenceRuleRepository implements InferenceDirtyMarker {
  private static final int DEFAULT_PRIORITY = 100;
  private static final String INFERRED_GRAPH_PATH = "graph/inferred/";
  private static final String NON_CONFORMING_REASON =
      "Disabled because the rule no longer passes validation: %s. Fix the rule body and enable it"
          + " again.";
  private static final Comparator<InferenceRuleStatus> EXECUTION_ORDER =
      Comparator.comparingInt(InferenceRuleRepository::priority)
          .thenComparing(status -> status.getRule().getName());

  private final RdfInferenceRuleDAO ruleDAO;
  private final Clock clock;
  private final String inferredGraphBaseUri;
  private volatile boolean initialized;

  public InferenceRuleRepository(
      final RdfInferenceRuleDAO ruleDAO, final Clock clock, final String rdfBaseUri) {
    this.ruleDAO = Objects.requireNonNull(ruleDAO);
    this.clock = Objects.requireNonNull(clock);
    this.inferredGraphBaseUri = normalizeBaseUri(rdfBaseUri) + INFERRED_GRAPH_PATH;
  }

  /** A rule as a materialization run read it, with the version it must still have to end clean. */
  public record RuleSnapshot(InferenceRuleStatus status, long dirtyVersion) {
    public String name() {
      return status.getRule().getName();
    }

    public boolean isEnabled() {
      return !Boolean.FALSE.equals(status.getRule().getEnabled());
    }
  }

  public List<InferenceRuleStatus> list() {
    return listForRun().stream().map(RuleSnapshot::status).toList();
  }

  public InferenceRuleStatus get(final String name) {
    initialize();
    return toStatus(requireRow(name));
  }

  public InferenceRuleStatus upsert(final String pathName, final InferenceRule rule) {
    requireMatchingName(pathName, rule);
    InferenceRuleValidator.requireValid(rule, pathName);
    initialize();
    ruleDAO.upsert(pathName, JsonUtils.pojoToJson(rule), clock.millis());
    return get(pathName);
  }

  public void delete(final String name) {
    initialize();
    final RdfInferenceRuleRow row = requireRow(name);
    if (row.systemRule()) {
      throw new BadRequestException(
          "System inference rule '" + name + "' can be disabled but not deleted");
    }
    ruleDAO.softDelete(name, clock.millis());
  }

  /** Every active rule, enabled or not, in execution order. */
  public List<RuleSnapshot> listForRun() {
    initialize();
    return ruleDAO.listActive().stream()
        .map(row -> new RuleSnapshot(toStatus(row), row.dirtyVersion()))
        .sorted(Comparator.comparing(RuleSnapshot::status, EXECUTION_ORDER))
        .toList();
  }

  /**
   * The graph of every rule ever stored. A rule deleted while a run was writing its graph keeps
   * those conclusions until a later run empties this whole set.
   */
  public List<String> graphUrisOfAllRules() {
    return ruleDAO.listNames().stream().map(this::graphUri).toList();
  }

  /** The rule's refreshed status, or empty when it was deleted during the run. */
  public Optional<InferenceRuleStatus> recordMaterialized(
      final RuleSnapshot snapshot, final long completedAt, final long tripleCount) {
    ruleDAO.markMaterialized(snapshot.name(), completedAt, tripleCount, snapshot.dirtyVersion());
    return findActive(snapshot.name());
  }

  /** Records a disabled rule's emptied graph; its last error, such as why it was disabled, stays. */
  public Optional<InferenceRuleStatus> recordCleared(
      final RuleSnapshot snapshot, final long completedAt) {
    ruleDAO.markCleared(snapshot.name(), completedAt, snapshot.dirtyVersion());
    return findActive(snapshot.name());
  }

  public Optional<InferenceRuleStatus> recordFailure(
      final RuleSnapshot snapshot, final String error) {
    ruleDAO.markFailed(snapshot.name(), error);
    return findActive(snapshot.name());
  }

  @Override
  public void markAllDirty() {
    ruleDAO.markAllDirty();
  }

  private void initialize() {
    if (initialized) {
      return;
    }
    synchronized (this) {
      if (!initialized) {
        insertStarterPack();
        ruleDAO.listActive().forEach(this::disableIfNonConforming);
        initialized = true;
      }
    }
  }

  private void insertStarterPack() {
    final long updatedAt = clock.millis();
    InferenceRuleStarterPack.load()
        .forEach(
            rule ->
                ruleDAO.insertIfAbsent(
                    rule.getName(), JsonUtils.pojoToJson(rule), true, updatedAt));
  }

  /**
   * Validation grows stricter across releases. A stored rule that no longer passes would fail
   * every run, so it is disabled with the reason recorded instead of being rewritten or dropped.
   */
  private void disableIfNonConforming(final RdfInferenceRuleRow row) {
    final InferenceRule rule = readRule(row);
    final List<String> errors =
        Boolean.FALSE.equals(rule.getEnabled()) ? List.of() : InferenceRuleValidator.validate(rule);
    if (!errors.isEmpty()) {
      final String reason = NON_CONFORMING_REASON.formatted(String.join("; ", errors));
      LOG.warn("Inference rule '{}': {}", row.name(), reason);
      ruleDAO.disable(
          row.name(), JsonUtils.pojoToJson(rule.withEnabled(false)), reason, clock.millis());
    }
  }

  private Optional<InferenceRuleStatus> findActive(final String name) {
    return Optional.ofNullable(ruleDAO.findActive(name)).map(this::toStatus);
  }

  private RdfInferenceRuleRow requireRow(final String name) {
    return Optional.ofNullable(ruleDAO.findActive(name))
        .orElseThrow(() -> new NotFoundException("Inference rule '" + name + "' was not found"));
  }

  private InferenceRuleStatus toStatus(final RdfInferenceRuleRow row) {
    final InferenceRuleStatus status =
        new InferenceRuleStatus()
            .withRule(readRule(row))
            .withGraphUri(URI.create(graphUri(row.name())))
            .withSystemRule(row.systemRule())
            .withDirty(row.dirty())
            .withTripleCount(Math.toIntExact(row.lastTripleCount()));
    Optional.ofNullable(row.lastMaterializedAt()).ifPresent(status::setLastMaterializedAt);
    Optional.ofNullable(row.lastError()).ifPresent(status::setLastError);
    return status;
  }

  private String graphUri(final String ruleName) {
    return inferredGraphBaseUri + ruleName;
  }

  private static InferenceRule readRule(final RdfInferenceRuleRow row) {
    return JsonUtils.readValue(row.json(), InferenceRule.class);
  }

  private static int priority(final InferenceRuleStatus status) {
    final Integer configuredPriority = status.getRule().getPriority();
    return configuredPriority == null ? DEFAULT_PRIORITY : configuredPriority;
  }

  private static void requireMatchingName(final String pathName, final InferenceRule rule) {
    if (rule == null || !Objects.equals(pathName, rule.getName())) {
      throw new BadRequestException("Inference rule path name must match the request body name");
    }
  }

  private static String normalizeBaseUri(final String rdfBaseUri) {
    final String requiredBaseUri = Objects.requireNonNull(rdfBaseUri, "rdfBaseUri");
    return requiredBaseUri.endsWith("/") ? requiredBaseUri : requiredBaseUri + "/";
  }
}
