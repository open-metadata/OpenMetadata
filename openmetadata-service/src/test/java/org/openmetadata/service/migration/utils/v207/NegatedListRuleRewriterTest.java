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

package org.openmetadata.service.migration.utils.v207;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

/** The case table here matches utils/queryBuilder/jsonLogicNegation.test.ts in the UI. */
class NegatedListRuleRewriterTest {
  private static final String TAGS = "{\"var\":\"tags\"}";
  private static final String TAG_FQN = "{\"var\":\"tagFQN\"}";

  private static String tagIs(String fqn) {
    return "{\"some\":[%s,{\"==\":[%s,\"%s\"]}]}".formatted(TAGS, TAG_FQN, fqn);
  }

  private static String tagIsNot(String fqn) {
    return "{\"some\":[%s,{\"!=\":[%s,\"%s\"]}]}".formatted(TAGS, TAG_FQN, fqn);
  }

  private static String tagNotIn(String fqn) {
    return "{\"some\":[%s,{\"!\":{\"in\":[%s,[\"%s\"]]}}]}".formatted(TAGS, TAG_FQN, fqn);
  }

  private static String tagIn(String fqn) {
    return "{\"some\":[%s,{\"in\":[%s,[\"%s\"]]}]}".formatted(TAGS, TAG_FQN, fqn);
  }

  private static final String TAG_NOT_SET =
      "{\"some\":[%s,{\"==\":[%s,null]}]}".formatted(TAGS, TAG_FQN);
  private static final String TAG_SET =
      "{\"some\":[%s,{\"!=\":[%s,null]}]}".formatted(TAGS, TAG_FQN);

  private static String not(String rule) {
    return "{\"!\":%s}".formatted(rule);
  }

  private static String and(String rule) {
    return "{\"and\":[%s]}".formatted(rule);
  }

  static Stream<Arguments> negatedListConditions() {
    return Stream.of(
        Arguments.of("Is Not", tagIsNot("A"), not(tagIs("A"))),
        Arguments.of("Not In", tagNotIn("A"), not(tagIn("A"))),
        Arguments.of("Is Not Set", TAG_NOT_SET, not(TAG_SET)));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("negatedListConditions")
  void negatesTheWholeList(String operator, String stored, String expected) {
    assertEquals(and(expected), NegatedListRuleRewriter.rewrite(and(stored)));
  }

  static Stream<Arguments> conditionsLeftAlone() {
    return Stream.of(
        Arguments.of("Is", and(tagIs("A"))),
        Arguments.of("Is Set", and(TAG_SET)),
        Arguments.of("a scalar field", "{\"!=\":[{\"var\":\"description\"},\"x\"]}"),
        Arguments.of(
            "a multi-rule element match",
            "{\"some\":[%s,{\"and\":[%s]}]}".formatted(TAGS, tagIs("A"))),
        Arguments.of(
            "a negation the editor cannot load back as a row",
            "{\"some\":[{\"var\":\"relatedTerms\"},{\"!\":{\"some\":[{\"var\":\"x\"},{\"==\":[{\"var\":\"y\"},\"A\"]}]}}]}"),
        Arguments.of("a custom operator", "{\"and\":[{\"isReviewer\":{\"var\":\"updatedBy\"}}]}"));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("conditionsLeftAlone")
  void leavesOtherConditionsAsStored(String description, String stored) {
    assertSame(stored, NegatedListRuleRewriter.rewrite(stored));
  }

  @Test
  void rewritesInsideNegationsAndDisjunctions() {
    assertEquals(
        "{\"or\":[%s,%s]}".formatted(not(not(tagIs("A"))), tagIs("B")),
        NegatedListRuleRewriter.rewrite(
            "{\"or\":[%s,%s]}".formatted(not(tagIsNot("A")), tagIs("B"))));
  }

  @Test
  void isIdempotent() {
    String once = NegatedListRuleRewriter.rewrite(and(tagIsNot("A")));

    assertSame(once, NegatedListRuleRewriter.rewrite(once));
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "not json", "{\"and\":["})
  void leavesWhatIsNotJsonLogicAsStored(String stored) {
    assertSame(stored, NegatedListRuleRewriter.rewrite(stored));
  }

  @Test
  void leavesAMissingRuleMissing() {
    assertNull(NegatedListRuleRewriter.rewrite(null));
  }

  @Test
  void recognisesARuleThatAlreadyNegatesAWholeList() {
    assertTrue(NegatedListRuleRewriter.hasNegatedList(and(not(tagIs("A")))));
    assertFalse(NegatedListRuleRewriter.hasNegatedList(and(tagIsNot("A"))));
  }

  /** The rule engine's own library decides each case, so the rewrite is checked against runtime. */
  @Test
  void rewrittenRulesMatchWhatTheirRowSays() throws JsonLogicException {
    JsonLogic engine = new JsonLogic();
    List<Map<String, Object>> untaggedOnlyAAndAPlusB =
        List.of(
            Map.of("tags", List.of()),
            Map.of("tags", List.of(Map.of("tagFQN", "A"))),
            Map.of("tags", List.of(Map.of("tagFQN", "A"), Map.of("tagFQN", "B"))));
    String isNotA = NegatedListRuleRewriter.rewrite(and(tagIsNot("A")));
    String isNotSet = NegatedListRuleRewriter.rewrite(and(TAG_NOT_SET));

    assertEquals(List.of(true, false, false), evaluate(engine, isNotA, untaggedOnlyAAndAPlusB));
    assertEquals(List.of(true, false, false), evaluate(engine, isNotSet, untaggedOnlyAAndAPlusB));
  }

  private static List<Boolean> evaluate(
      JsonLogic engine, String rule, List<Map<String, Object>> entities) throws JsonLogicException {
    List<Boolean> results = new ArrayList<>();
    for (Map<String, Object> entity : entities) {
      results.add(JsonLogic.truthy(engine.apply(rule, entity)));
    }
    return results;
  }
}
