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

import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.WebApplicationException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;

class InferenceMaterializerTest {
  private static final Clock CLOCK =
      Clock.fixed(Instant.ofEpochMilli(1_750_000_000_000L), ZoneOffset.UTC);
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String COPY_A_TO_B = "copy-a-to-b";
  private static final String COPY_B_TO_C = "copy-b-to-c";
  private static final String REACHABILITY = "reachability";

  private final UnionDefaultGraphStore store = new UnionDefaultGraphStore();
  private final InMemoryInferenceRuleDAO ruleDAO = new InMemoryInferenceRuleDAO();
  private final InMemoryInferenceRunLock runLock = new InMemoryInferenceRunLock();
  private final InferenceRuleRepository rules =
      new InferenceRuleRepository(ruleDAO, CLOCK, BASE_URI);

  @BeforeEach
  void retireStarterRules() {
    InferenceRuleStarterPack.load().forEach(rule -> rules.get(rule.getName()));
    InferenceRuleStarterPack.load().forEach(rule -> ruleDAO.retire(rule.getName()));
  }

  @Test
  void rulesConvergeEvenWhenADependentRuleRunsFirst() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 200));
    rules.upsert(COPY_B_TO_C, copyRule(COPY_B_TO_C, "b", "c", 100));
    store.assertFact("urn:x", "urn:a", "urn:y");

    final InferenceMaterializationResult result = materializer().materialize(false, null);

    assertEquals(2, result.getSuccessfulRules());
    assertTrue(store.contains(graph(COPY_B_TO_C), "urn:x", "urn:c", "urn:y"));
  }

  @Test
  void recursiveRuleReachesItsFixedPoint() {
    rules.upsert(REACHABILITY, reachabilityRule());
    chain("urn:n1", "urn:n2", "urn:n3", "urn:n4", "urn:n5");

    final InferenceMaterializationResult result = materializer().materialize(false, null);

    assertEquals(10, status(result, REACHABILITY).getTripleCount());
    assertTrue(store.contains(graph(REACHABILITY), "urn:n1", "urn:reach", "urn:n5"));
  }

  @Test
  void deletingAPremiseRetractsEverythingDerivedFromIt() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 200));
    rules.upsert(COPY_B_TO_C, copyRule(COPY_B_TO_C, "b", "c", 100));
    store.assertFact("urn:x", "urn:a", "urn:y");
    materializer().materialize(false, null);

    store.retractFact("urn:x", "urn:a", "urn:y");
    rules.markAllDirty();
    materializer().materialize(false, null);

    assertEquals(0, store.tripleCount(graph(COPY_A_TO_B)));
    assertEquals(0, store.tripleCount(graph(COPY_B_TO_C)));
  }

  @Test
  void runThatDoesNotConvergeFailsAndStaysDirty() {
    rules.upsert(REACHABILITY, reachabilityRule());
    chain("urn:n1", "urn:n2", "urn:n3", "urn:n4", "urn:n5");

    final InferenceMaterializationResult result =
        new InferenceMaterializer(store, rules, runLock, CLOCK, 2).materialize(false, null);

    final InferenceRuleStatus reachability = status(result, REACHABILITY);
    assertEquals(1, result.getFailedRules());
    assertTrue(reachability.getLastError().contains("fixed point"), reachability.getLastError());
    assertTrue(reachability.getDirty());
  }

  @Test
  void changesArrivingDuringARunLeaveRulesDirty() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 100));
    store.assertFact("urn:x", "urn:a", "urn:y");
    store.afterNextUpdate(rules::markAllDirty);

    final InferenceMaterializationResult result = materializer().materialize(false, null);

    final InferenceRuleStatus copy = status(result, COPY_A_TO_B);
    assertEquals(1, result.getSuccessfulRules());
    assertTrue(copy.getDirty());
    assertEquals(CLOCK.millis(), copy.getLastMaterializedAt());
  }

  @Test
  void cleanRulesRunAgainOnlyWhenForced() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 100));
    materializer().materialize(false, null);
    final int updatesAfterFirstRun = store.updateCount();

    final InferenceMaterializationResult skipped = materializer().materialize(false, null);
    final InferenceMaterializationResult forced = materializer().materialize(true, null);

    assertTrue(skipped.getProcessedRules().isEmpty());
    assertEquals(1, forced.getSuccessfulRules());
    assertTrue(store.updateCount() > updatesAfterFirstRun);
  }

  @Test
  void disabledRulesAreClearedWithoutBeingEvaluated() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 100).withEnabled(false));
    store.assertFact("urn:x", "urn:a", "urn:y");
    store.addToGraph(graph(COPY_A_TO_B), "urn:stale", "urn:b", "urn:fact");

    final InferenceMaterializationResult result = materializer().materialize(false, null);

    assertEquals(0, store.tripleCount(graph(COPY_A_TO_B)));
    assertEquals(0, status(result, COPY_A_TO_B).getTripleCount());
    assertFalse(status(result, COPY_A_TO_B).getDirty());
  }

  @Test
  void requestingOneRuleStillComputesTheRulesItDependsOn() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 200));
    rules.upsert(COPY_B_TO_C, copyRule(COPY_B_TO_C, "b", "c", 100));
    store.assertFact("urn:x", "urn:a", "urn:y");

    final InferenceMaterializationResult result = materializer().materialize(false, COPY_B_TO_C);

    assertEquals(2, result.getProcessedRules().size());
    assertTrue(store.contains(graph(COPY_B_TO_C), "urn:x", "urn:c", "urn:y"));
  }

  @Test
  void aFailingRuleFailsTheWholeRunAndNamesTheRule() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 200));
    rules.upsert(COPY_B_TO_C, copyRule(COPY_B_TO_C, "b", "c", 100));
    store.failUpdatesContaining("<urn:c>");

    final InferenceMaterializationResult result = materializer().materialize(false, null);

    assertEquals(2, result.getFailedRules());
    assertTrue(status(result, COPY_B_TO_C).getLastError().contains(COPY_B_TO_C));
    assertTrue(status(result, COPY_B_TO_C).getLastError().contains("Fuseki rejected the update"));
    assertTrue(status(result, COPY_A_TO_B).getDirty());
    assertFalse(runLock.isHeld());
  }

  @Test
  void aRunThatLosesItsLockToAnotherRunFails() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 100));
    store.afterNextUpdate(runLock::holdForAnotherRun);

    final InferenceMaterializationResult result = materializer().materialize(false, null);

    assertEquals(1, result.getFailedRules());
    assertTrue(status(result, COPY_A_TO_B).getLastError().contains("took over"));
    assertTrue(runLock.isHeld(), "The run must not release a lock another run now holds");
  }

  @Test
  void anotherRunInProgressIsRejectedWithoutTouchingTheStore() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 100));
    runLock.holdForAnotherRun();

    final WebApplicationException exception =
        assertThrows(WebApplicationException.class, () -> materializer().materialize(false, null));

    assertEquals(409, exception.getResponse().getStatus());
    assertEquals(0, store.updateCount());
  }

  @Test
  void unavailableStoreIsRejected() {
    store.makeUnavailable();

    assertThrows(ServiceUnavailableException.class, () -> materializer().materialize(true, null));
  }

  @Test
  void unknownRequestedRuleIsReportedAsMissing() {
    assertThrows(NotFoundException.class, () -> materializer().materialize(false, "missing-rule"));
  }

  @Test
  void lockIsReleasedAfterASuccessfulRun() {
    rules.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b", 100));

    materializer().materialize(false, null);

    assertFalse(runLock.isHeld());
    assertNull(status(materializer().materialize(true, null), COPY_A_TO_B).getLastError());
  }

  private InferenceMaterializer materializer() {
    return new InferenceMaterializer(store, rules, runLock, CLOCK);
  }

  private void chain(final String... nodes) {
    for (int index = 1; index < nodes.length; index++) {
      store.assertFact(nodes[index - 1], "urn:edge", nodes[index]);
    }
  }

  private static InferenceRuleStatus status(
      final InferenceMaterializationResult result, final String ruleName) {
    final List<InferenceRuleStatus> matches =
        result.getProcessedRules().stream()
            .filter(status -> ruleName.equals(status.getRule().getName()))
            .toList();
    assertEquals(1, matches.size(), "Expected one processed status for " + ruleName);
    return matches.getFirst();
  }

  private static String graph(final String ruleName) {
    return BASE_URI + "graph/inferred/" + ruleName;
  }

  private static InferenceRule copyRule(
      final String name, final String from, final String to, final int priority) {
    return rule(
        name,
        "CONSTRUCT { ?s <urn:%s> ?o } WHERE { ?s <urn:%s> ?o }".formatted(to, from),
        priority);
  }

  private static InferenceRule reachabilityRule() {
    return rule(
        REACHABILITY,
        "CONSTRUCT { ?x <urn:reach> ?z } WHERE "
            + "{ { ?x <urn:edge> ?z } UNION { ?x <urn:reach> ?y . ?y <urn:edge> ?z } }",
        100);
  }

  private static InferenceRule rule(final String name, final String body, final int priority) {
    return new InferenceRule()
        .withName(name)
        .withRuleType(InferenceRule.RuleType.CONSTRUCT)
        .withRuleBody(body)
        .withPriority(priority)
        .withEnabled(true);
  }
}
