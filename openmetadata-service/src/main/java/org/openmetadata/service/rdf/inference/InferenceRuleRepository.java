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
import java.util.concurrent.atomic.AtomicBoolean;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfInferenceRuleDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfInferenceRuleDAO.RdfInferenceRuleRow;

/** Durable inference-rule definitions and materialization state. */
public final class InferenceRuleRepository implements InferenceDirtyMarker {
  private static final int DEFAULT_PRIORITY = 100;
  private static final String INFERRED_GRAPH_PATH = "graph/inferred/";

  private final RdfInferenceRuleDAO ruleDAO;
  private final Clock clock;
  private final String inferredGraphBaseUri;
  private final AtomicBoolean starterPackInitialized = new AtomicBoolean();

  public InferenceRuleRepository(
      final RdfInferenceRuleDAO ruleDAO, final Clock clock, final String rdfBaseUri) {
    this.ruleDAO = Objects.requireNonNull(ruleDAO);
    this.clock = Objects.requireNonNull(clock);
    this.inferredGraphBaseUri = normalizeBaseUri(rdfBaseUri) + INFERRED_GRAPH_PATH;
  }

  public List<InferenceRuleStatus> list() {
    initializeStarterPack();
    return ruleDAO.listActive().stream()
        .map(this::toStatus)
        .sorted(
            Comparator.comparingInt(InferenceRuleRepository::priority)
                .thenComparing(status -> status.getRule().getName()))
        .toList();
  }

  public InferenceRuleStatus get(final String name) {
    initializeStarterPack();
    return toStatus(requireRow(name));
  }

  public InferenceRuleStatus upsert(final String pathName, final InferenceRule rule) {
    requireMatchingName(pathName, rule);
    InferenceRuleValidator.requireValid(rule, pathName);
    initializeStarterPack();
    ruleDAO.upsert(pathName, JsonUtils.pojoToJson(rule), clock.millis());
    return get(pathName);
  }

  public void delete(final String name) {
    initializeStarterPack();
    final RdfInferenceRuleRow row = requireRow(name);
    if (row.systemRule()) {
      throw new BadRequestException(
          "System inference rule '" + name + "' can be disabled but not deleted");
    }
    ruleDAO.softDelete(name, clock.millis());
  }

  public List<InferenceRuleStatus> listForMaterialization(
      final boolean force, final String requestedRule) {
    return list().stream()
        .filter(status -> isRequested(status, requestedRule))
        .filter(status -> force || Boolean.TRUE.equals(status.getDirty()))
        .toList();
  }

  public InferenceRuleStatus recordMaterialized(
      final String name, final long completedAt, final long tripleCount) {
    ruleDAO.markMaterialized(name, completedAt, tripleCount);
    return get(name);
  }

  public InferenceRuleStatus recordFailure(final String name, final String error) {
    ruleDAO.markFailed(name, error);
    return get(name);
  }

  @Override
  public void markAllDirty() {
    ruleDAO.markAllDirty();
  }

  private void initializeStarterPack() {
    if (starterPackInitialized.compareAndSet(false, true)) {
      final long updatedAt = clock.millis();
      InferenceRuleStarterPack.load()
          .forEach(
              rule ->
                  ruleDAO.insertIfAbsent(
                      rule.getName(), JsonUtils.pojoToJson(rule), true, updatedAt));
    }
  }

  private RdfInferenceRuleRow requireRow(final String name) {
    return Optional.ofNullable(ruleDAO.findActive(name))
        .orElseThrow(() -> new NotFoundException("Inference rule '" + name + "' was not found"));
  }

  private InferenceRuleStatus toStatus(final RdfInferenceRuleRow row) {
    final InferenceRule rule = JsonUtils.readValue(row.json(), InferenceRule.class);
    final InferenceRuleStatus status =
        new InferenceRuleStatus()
            .withRule(rule)
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

  private static int priority(final InferenceRuleStatus status) {
    final Integer configuredPriority = status.getRule().getPriority();
    return configuredPriority == null ? DEFAULT_PRIORITY : configuredPriority;
  }

  private static boolean isRequested(final InferenceRuleStatus status, final String requestedRule) {
    return requestedRule == null || requestedRule.equals(status.getRule().getName());
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
