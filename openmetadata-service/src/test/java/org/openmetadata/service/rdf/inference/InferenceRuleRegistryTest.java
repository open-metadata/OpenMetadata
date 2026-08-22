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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;

/**
 * Unit coverage for {@link InferenceRuleRegistry}. The registry is a process-wide singleton that
 * loads a classpath starter pack; each test resets it via the package-private {@code
 * resetForTests()} seam so cases stay isolated from one another and from sibling test classes.
 */
class InferenceRuleRegistryTest {

  private static final String STARTER_RULE_NAME = "transitive-lineage-closure";

  private static final String VALID_BODY =
      "PREFIX om: <https://open-metadata.org/ontology/>\n"
          + "CONSTRUCT { ?x om:transitivelyDerivedFrom ?y }\n"
          + "WHERE { ?x <http://www.w3.org/ns/prov#wasDerivedFrom>+ ?y . FILTER(?x != ?y) }";

  private InferenceRuleRegistry registry;

  @BeforeEach
  void setUp() {
    registry = InferenceRuleRegistry.getInstance();
    registry.resetForTests();
  }

  @AfterEach
  void tearDown() {
    registry.resetForTests();
  }

  private static InferenceRule rule(String name, Integer priority) {
    return new InferenceRule()
        .withName(name)
        .withRuleType(InferenceRule.RuleType.CONSTRUCT)
        .withRuleBody(VALID_BODY)
        .withEnabled(true)
        .withPriority(priority);
  }

  private List<String> namesWithPrefix(String prefix) {
    return registry.list().stream()
        .map(InferenceRule::getName)
        .filter(name -> name.startsWith(prefix))
        .toList();
  }

  @Test
  @DisplayName("list() sorts by priority then name, treating null priority as 100")
  void listSortsByPriorityThenNameWithNullPriorityAsHundred() {
    registry.upsert(rule("ut-priority-aaa-null", null));
    registry.upsert(rule("ut-priority-bbb-hundred", 100));
    registry.upsert(rule("ut-priority-zzz-low", 5));

    List<String> ordered = namesWithPrefix("ut-priority-");

    assertEquals(
        List.of("ut-priority-zzz-low", "ut-priority-aaa-null", "ut-priority-bbb-hundred"),
        ordered,
        "priority 5 must sort ahead of the two effective-100 rules despite its later name, and the"
            + " null-priority rule (treated as 100) must tie-break by name against the explicit-100"
            + " rule");
  }

  @Test
  @DisplayName("list() auto-loads the starter pack on first read")
  void listAutoLoadsStarterPack() {
    List<InferenceRule> rules = registry.list();

    assertTrue(rules.size() >= 4, "starter pack must be loaded lazily by list(): " + rules.size());
    assertTrue(
        rules.stream().anyMatch(rule -> STARTER_RULE_NAME.equals(rule.getName())),
        "starter rule '" + STARTER_RULE_NAME + "' must be present after list()");
  }

  @Test
  @DisplayName("upsert(null) throws IllegalArgumentException and does not mutate the registry")
  void upsertNullThrowsAndDoesNotMutate() {
    int sizeBefore = registry.list().size();

    assertThrows(IllegalArgumentException.class, () -> registry.upsert(null));

    assertEquals(sizeBefore, registry.list().size(), "a rejected upsert must not change the map");
  }

  @Test
  @DisplayName("upsert of an invalid rule throws and leaves the rule out of the registry")
  void upsertInvalidRuleThrowsAndDoesNotMutate() {
    InferenceRule invalid =
        rule("ut-invalid-rule", 100).withRuleBody("SELECT ?s WHERE { ?s ?p ?o }");
    int sizeBefore = registry.list().size();

    assertThrows(IllegalArgumentException.class, () -> registry.upsert(invalid));

    assertEquals(sizeBefore, registry.list().size(), "invalid upsert must not grow the map");
    assertTrue(
        registry.get("ut-invalid-rule").isEmpty(),
        "rejected rule must not be retrievable via get()");
  }

  @Test
  @DisplayName("upsert of a valid rule stores it so get() and list() observe it")
  void upsertValidRuleStoresRule() {
    InferenceRule valid = rule("ut-happy-path", 42);

    registry.upsert(valid);

    Optional<InferenceRule> fetched = registry.get("ut-happy-path");
    assertTrue(fetched.isPresent(), "valid upsert must be retrievable");
    assertSame(valid, fetched.get(), "get() must return the exact stored instance");
    assertTrue(
        registry.list().stream().anyMatch(rule -> "ut-happy-path".equals(rule.getName())),
        "valid upsert must appear in list()");
  }

  @Test
  @DisplayName("upsert replaces an existing rule of the same name rather than duplicating it")
  void upsertReplacesExistingRule() {
    registry.upsert(rule("ut-replaceable", 10));
    registry.upsert(rule("ut-replaceable", 20));

    List<InferenceRule> matches =
        registry.list().stream().filter(rule -> "ut-replaceable".equals(rule.getName())).toList();
    assertEquals(1, matches.size(), "same-name upsert must replace, not duplicate");
    assertEquals(20, matches.getFirst().getPriority(), "the latest upsert value must win");
  }

  @Test
  @DisplayName("delete returns true when the rule existed and false otherwise")
  void deleteReturnsTrueWhenPresentFalseOtherwise() {
    registry.upsert(rule("ut-deletable", 100));

    assertTrue(registry.delete("ut-deletable"), "delete of an existing rule must return true");
    assertFalse(
        registry.delete("ut-deletable"), "second delete of the same name must return false");
    assertFalse(registry.delete("ut-never-existed"), "delete of an unknown name must return false");
    assertTrue(registry.get("ut-deletable").isEmpty(), "deleted rule must no longer be present");
  }

  @Test
  @DisplayName("loadStarterPackIfNeeded is idempotent and does not duplicate rules")
  void loadStarterPackIfNeededIsIdempotent() {
    registry.loadStarterPackIfNeeded();
    int sizeAfterFirstLoad = registry.list().size();

    registry.loadStarterPackIfNeeded();

    assertEquals(
        sizeAfterFirstLoad,
        registry.list().size(),
        "a second load must not re-add or duplicate starter rules");
  }

  @Test
  @DisplayName("loadStarterPackIfNeeded does not resurrect a deleted starter rule")
  void loadStarterPackIfNeededDoesNotResurrectDeletedRule() {
    registry.loadStarterPackIfNeeded();
    assertTrue(
        registry.delete(STARTER_RULE_NAME),
        "precondition: the starter rule must exist before deletion");

    registry.loadStarterPackIfNeeded();

    assertTrue(
        registry.get(STARTER_RULE_NAME).isEmpty(),
        "the idempotent guard must keep a deleted starter rule from being reloaded");
  }
}
