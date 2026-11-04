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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;

class InferenceRuleServiceTest {
  private static final Clock CLOCK =
      Clock.fixed(Instant.ofEpochMilli(1_750_000_000_000L), ZoneOffset.UTC);
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String COPY_A_TO_B = "copy-a-to-b";
  private static final String COPY_B_TO_C = "copy-b-to-c";
  private static final String SYSTEM_RULE = "schema-tag-inheritance";

  private final UnionDefaultGraphStore store = new UnionDefaultGraphStore();
  private final InMemoryInferenceRuleDAO ruleDAO = new InMemoryInferenceRuleDAO();
  private final InMemoryInferenceRunLock runLock = new InMemoryInferenceRunLock();
  private final InferenceRuleRepository rules =
      new InferenceRuleRepository(ruleDAO, CLOCK, BASE_URI);
  private final InferenceRuleService service =
      new InferenceRuleService(rules, new InferenceMaterializer(store, rules, runLock, CLOCK));

  @BeforeEach
  void derivePremisesForAChainOfRules() {
    service.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "b"));
    service.upsert(COPY_B_TO_C, copyRule(COPY_B_TO_C, "b", "c"));
    store.assertFact("urn:x", "urn:a", "urn:y");
    service.materialize(false, null);
  }

  @Test
  void deletingARuleRemovesItsConclusionsAndQueuesTheRulesThatReadThem() {
    service.delete(COPY_A_TO_B);

    assertEquals(0, store.tripleCount(graph(COPY_A_TO_B)));
    assertTrue(service.get(COPY_B_TO_C).getDirty());
    assertThrows(NotFoundException.class, () -> service.get(COPY_A_TO_B));
  }

  @Test
  void theNextRunRetractsWhatOnlyTheDeletedRuleSupported() {
    service.delete(COPY_A_TO_B);

    service.materialize(false, null);

    assertEquals(0, store.tripleCount(graph(COPY_B_TO_C)));
  }

  @Test
  void aRuleDeletedDuringARunHasItsGraphEmptiedByTheNextRun() {
    store.afterNextUpdate(() -> service.delete(COPY_A_TO_B));
    service.materialize(true, null);
    assertTrue(store.tripleCount(graph(COPY_A_TO_B)) > 0);

    service.materialize(false, null);

    assertEquals(0, store.tripleCount(graph(COPY_A_TO_B)));
    assertEquals(0, store.tripleCount(graph(COPY_B_TO_C)));
  }

  @Test
  void systemRulesCannotBeDeleted() {
    assertThrows(BadRequestException.class, () -> service.delete(SYSTEM_RULE));

    assertEquals(SYSTEM_RULE, service.get(SYSTEM_RULE).getRule().getName());
  }

  @Test
  void deletingAnUnknownRuleIsReportedAsMissing() {
    assertThrows(NotFoundException.class, () -> service.delete("missing-rule"));
  }

  @Test
  void savingARuleMarksEveryRuleDirty() {
    assertFalse(service.get(COPY_B_TO_C).getDirty());

    service.upsert(COPY_A_TO_B, copyRule(COPY_A_TO_B, "a", "d"));

    assertTrue(service.get(COPY_B_TO_C).getDirty());
  }

  private static String graph(final String ruleName) {
    return BASE_URI + "graph/inferred/" + ruleName;
  }

  private static InferenceRule copyRule(final String name, final String from, final String to) {
    return new InferenceRule()
        .withName(name)
        .withRuleType(InferenceRule.RuleType.CONSTRUCT)
        .withRuleBody("CONSTRUCT { ?s <urn:%s> ?o } WHERE { ?s <urn:%s> ?o }".formatted(to, from))
        .withEnabled(true);
  }
}
