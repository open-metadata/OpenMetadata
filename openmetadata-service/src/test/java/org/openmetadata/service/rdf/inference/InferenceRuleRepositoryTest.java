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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.inference.InferenceRuleRepository.RuleSnapshot;

class InferenceRuleRepositoryTest {
  private static final long NOW = 1_750_000_000_000L;
  private static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
  private static final String BASE_URI = "https://metadata.example";
  private static final String RULE = "custom-rule";
  private static final String LEGACY_RULE = "legacy-rule";
  private static final String OPTIONAL_BODY =
      "CONSTRUCT { ?s <urn:copy> ?o } WHERE { ?s <urn:source> ?o OPTIONAL { ?o <urn:label> ?l } }";

  private final InMemoryInferenceRuleDAO ruleDAO = new InMemoryInferenceRuleDAO();
  private final InferenceRuleRepository repository =
      new InferenceRuleRepository(ruleDAO, CLOCK, BASE_URI);

  @Test
  void seedsTheStarterPackAsSystemRulesInPriorityOrder() {
    final List<InferenceRuleStatus> rules = repository.list();

    assertEquals(
        List.of(
            "transitive-lineage-closure",
            "pii-propagation-via-lineage",
            "schema-tag-inheritance",
            "domain-membership-inheritance"),
        names(rules));
    assertTrue(rules.stream().allMatch(InferenceRuleStatus::getSystemRule));
  }

  @Test
  void ordersRulesByPriorityThenName() {
    repository.upsert("z-rule", rule("z-rule", 10));
    repository.upsert("a-rule", rule("a-rule", 10));
    repository.upsert("late-rule", rule("late-rule", 500));

    final List<String> names = names(repository.list());

    assertEquals(List.of("a-rule", "z-rule"), names.subList(0, 2));
    assertEquals("late-rule", names.getLast());
  }

  @Test
  void retriesSeedingAfterAFailedInsert() {
    ruleDAO.failNextInsert();

    assertThrows(IllegalStateException.class, repository::list);
    assertEquals(InferenceRuleStarterPack.load().size(), repository.list().size());
  }

  @Test
  void runSnapshotsIncludeDisabledRules() {
    repository.upsert(RULE, rule(RULE, 10).withEnabled(false));

    final RuleSnapshot snapshot = snapshot(RULE);

    assertFalse(snapshot.isEnabled());
    assertTrue(snapshot.status().getDirty());
  }

  @Test
  void recordingAMaterializationClearsTheDirtyFlag() {
    repository.upsert(RULE, rule(RULE, 10));

    final InferenceRuleStatus status =
        repository.recordMaterialized(snapshot(RULE), NOW + 5_000L, 7).orElseThrow();

    assertFalse(status.getDirty());
    assertEquals(7, status.getTripleCount());
    assertEquals(NOW + 5_000L, status.getLastMaterializedAt());
    assertNull(status.getLastError());
  }

  @Test
  void anInvalidationAfterTheSnapshotKeepsTheRuleDirty() {
    repository.upsert(RULE, rule(RULE, 10));
    final RuleSnapshot snapshot = snapshot(RULE);
    repository.markAllDirty();

    assertTrue(repository.recordMaterialized(snapshot, NOW, 7).orElseThrow().getDirty());
  }

  @Test
  void anEditAfterTheSnapshotKeepsTheRuleDirty() {
    repository.upsert(RULE, rule(RULE, 10));
    final RuleSnapshot snapshot = snapshot(RULE);
    repository.upsert(RULE, rule(RULE, 20));

    assertTrue(repository.recordMaterialized(snapshot, NOW, 7).orElseThrow().getDirty());
  }

  @Test
  void recordingAFailureKeepsTheRuleDirtyWithTheError() {
    repository.upsert(RULE, rule(RULE, 10));
    repository.recordMaterialized(snapshot(RULE), NOW, 1);

    final InferenceRuleStatus status =
        repository.recordFailure(snapshot(RULE), "SPARQL execution timed out").orElseThrow();

    assertTrue(status.getDirty());
    assertEquals("SPARQL execution timed out", status.getLastError());
  }

  @Test
  void recordingARuleDeletedDuringTheRunReturnsNothing() {
    repository.upsert(RULE, rule(RULE, 10));
    final RuleSnapshot snapshot = snapshot(RULE);
    repository.delete(RULE);

    assertTrue(repository.recordMaterialized(snapshot, NOW, 1).isEmpty());
  }

  @Test
  void graphsOfDeletedRulesAreStillListedForClearing() {
    repository.upsert(RULE, rule(RULE, 10));
    repository.delete(RULE);

    assertTrue(repository.graphUrisOfAllRules().contains(BASE_URI + "/graph/inferred/" + RULE));
  }

  @Test
  void storedRulesThatNoLongerValidateAreDisabledWithTheReason() {
    storeRule(rule(LEGACY_RULE, 10).withRuleBody(OPTIONAL_BODY));

    final InferenceRuleStatus status = repository.get(LEGACY_RULE);

    assertFalse(status.getRule().getEnabled());
    assertTrue(status.getDirty());
    assertTrue(status.getLastError().contains("no longer passes validation"));
    assertTrue(status.getLastError().contains("OPTIONAL is not allowed"), status.getLastError());
    assertEquals(OPTIONAL_BODY, status.getRule().getRuleBody());
  }

  @Test
  void clearingADisabledRuleKeepsTheReasonItWasDisabled() {
    storeRule(rule(LEGACY_RULE, 10).withRuleBody(OPTIONAL_BODY));
    final String reason = repository.get(LEGACY_RULE).getLastError();

    final InferenceRuleStatus status =
        repository.recordCleared(snapshot(LEGACY_RULE), NOW).orElseThrow();

    assertEquals(reason, status.getLastError());
    assertEquals(0, status.getTripleCount());
    assertFalse(status.getDirty());
  }

  @Test
  void rulesDisabledByTheirAuthorAreNotRevalidated() {
    storeRule(rule(LEGACY_RULE, 10).withRuleBody(OPTIONAL_BODY).withEnabled(false));

    assertNull(repository.get(LEGACY_RULE).getLastError());
  }

  @Test
  void rejectsMismatchedNamesBeforeWriting() {
    final InferenceRule rule = rule("body-name", 10);

    assertThrows(BadRequestException.class, () -> repository.upsert("path-name", rule));
    assertThrows(NotFoundException.class, () -> repository.get("path-name"));
  }

  @Test
  void preventsSystemRuleDeletion() {
    final String systemRule = repository.list().getFirst().getRule().getName();

    assertThrows(BadRequestException.class, () -> repository.delete(systemRule));
    assertEquals(systemRule, repository.get(systemRule).getRule().getName());
  }

  @Test
  void reportsMissingRulesWithTheirName() {
    final NotFoundException exception =
        assertThrows(NotFoundException.class, () -> repository.get("missing-rule"));

    assertTrue(exception.getMessage().contains("missing-rule"));
  }

  @Test
  void leavesMaterializationFieldsUnsetUntilTheRuleIsMaterialized() {
    repository.upsert(RULE, rule(RULE, 10));

    final InferenceRuleStatus status = repository.get(RULE);

    assertNull(status.getLastMaterializedAt());
    assertNull(status.getLastError());
    assertEquals(0, status.getTripleCount());
  }

  @Test
  void appendsTrailingSlashWhenBaseUriLacksOne() {
    repository.upsert(RULE, rule(RULE, 10));

    assertEquals(
        "https://metadata.example/graph/inferred/" + RULE,
        repository.get(RULE).getGraphUri().toString());
  }

  @Test
  void doesNotDoubleTrailingSlashWhenBaseUriAlreadyHasOne() {
    final InferenceRuleRepository withSlash =
        new InferenceRuleRepository(ruleDAO, CLOCK, "https://with-slash.example/");
    withSlash.upsert(RULE, rule(RULE, 10));

    assertEquals(
        "https://with-slash.example/graph/inferred/" + RULE,
        withSlash.get(RULE).getGraphUri().toString());
  }

  @Test
  void rejectsNullBaseUriAtConstruction() {
    assertThrows(
        NullPointerException.class, () -> new InferenceRuleRepository(ruleDAO, CLOCK, null));
  }

  private void storeRule(final InferenceRule rule) {
    ruleDAO.insertIfAbsent(rule.getName(), JsonUtils.pojoToJson(rule), false, NOW);
  }

  private RuleSnapshot snapshot(final String name) {
    return repository.listForRun().stream()
        .filter(snapshot -> name.equals(snapshot.name()))
        .findFirst()
        .orElseThrow();
  }

  private static List<String> names(final List<InferenceRuleStatus> statuses) {
    return statuses.stream().map(status -> status.getRule().getName()).toList();
  }

  private static InferenceRule rule(final String name, final int priority) {
    return new InferenceRule()
        .withName(name)
        .withRuleType(InferenceRule.RuleType.CONSTRUCT)
        .withPriority(priority)
        .withEnabled(true)
        .withRuleBody("CONSTRUCT { ?s <urn:inferred> ?o } WHERE { ?s <urn:source> ?o }");
  }
}
