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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;

/** The case table here matches utils/queryBuilder/jsonLogicNegation.test.ts in the UI. */
class MigrationUtilTest {
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
    assertEquals(and(expected), MigrationUtil.rewriteNegatedListRule(and(stored)));
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
        Arguments.of("a custom operator", "{\"and\":[{\"isReviewer\":{\"var\":\"updatedBy\"}}]}"),
        // Written through the API under an explicit NOT, which the editor cannot produce.
        Arguments.of("every tag is A", not(tagIsNot("A"))),
        Arguments.of("every tag is in [A]", not(tagNotIn("A"))),
        Arguments.of("no tag is unset", not(TAG_NOT_SET)),
        Arguments.of("a NOT around a per-element row", not(and(tagIsNot("A")))));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("conditionsLeftAlone")
  void leavesOtherConditionsAsStored(String description, String stored) {
    assertSame(stored, MigrationUtil.rewriteNegatedListRule(stored));
  }

  @Test
  void rewritesInsideDisjunctionsButNotUnderAnExplicitNegation() {
    assertEquals(
        "{\"or\":[%s,%s]}".formatted(not(tagIsNot("A")), not(tagIs("B"))),
        MigrationUtil.rewriteNegatedListRule(
            "{\"or\":[%s,%s]}".formatted(not(tagIsNot("A")), tagIsNot("B"))));
  }

  @Test
  void isIdempotent() {
    String once = MigrationUtil.rewriteNegatedListRule(and(tagIsNot("A")));

    assertSame(once, MigrationUtil.rewriteNegatedListRule(once));
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "not json", "{\"and\":["})
  void leavesWhatIsNotJsonLogicAsStored(String stored) {
    assertSame(stored, MigrationUtil.rewriteNegatedListRule(stored));
  }

  @Test
  void leavesAMissingRuleMissing() {
    assertNull(MigrationUtil.rewriteNegatedListRule(null));
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
    String isNotA = MigrationUtil.rewriteNegatedListRule(and(tagIsNot("A")));
    String isNotSet = MigrationUtil.rewriteNegatedListRule(and(TAG_NOT_SET));

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

  private static final String LEGACY_IS_NOT =
      "{\"and\":[{\"some\":[{\"var\":\"tags\"},{\"!=\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}]}";
  private static final String IS_NOT =
      "{\"and\":[{\"!\":{\"some\":[{\"var\":\"tags\"},{\"==\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}}]}";
  private static final String IS =
      "{\"and\":[{\"some\":[{\"var\":\"tags\"},{\"==\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}]}";

  private static ObjectNode workflow(String checkRules, Object triggerFilter) {
    return (ObjectNode)
        JsonUtils.readTree(
            """
                {"name": "wf",
                 "trigger": {"type": "eventBasedEntity", "config": {"filter": %s}},
                 "nodes": [
                   {"name": "check", "subType": "checkEntityAttributesTask",
                    "config": {"rules": %s}},
                   {"name": "description", "subType": "checkChangeDescriptionTask",
                    "config": {"rules": {"description": ["some"]}}}
                 ]}
                """
                .formatted(JsonUtils.pojoToJson(triggerFilter), JsonUtils.pojoToJson(checkRules)));
  }

  private static String encodedFilter(String tableRule) {
    return "{\"table\":%s}".formatted(JsonUtils.pojoToJson(tableRule));
  }

  @Test
  void checkConditionRulesAndAStringEncodedFilterMapAreRewritten() {
    ObjectNode definition = workflow(LEGACY_IS_NOT, encodedFilter(LEGACY_IS_NOT));

    assertTrue(MigrationUtil.rewriteWorkflow(definition));
    assertEquals(IS_NOT, definition.at("/nodes/0/config/rules").asText());
    assertTrue(definition.at("/trigger/config/filter").isTextual(), "the filter stays a string");
    assertEquals(
        IS_NOT,
        JsonUtils.readTree(definition.at("/trigger/config/filter").asText())
            .path("table")
            .asText());
  }

  @Test
  void aPlainRuleStringTheTriggerIgnoresIsLeftAsStored() {
    ObjectNode definition = workflow(IS, LEGACY_IS_NOT);

    assertFalse(MigrationUtil.rewriteWorkflow(definition));
  }

  @Test
  void aFilterPerEntityTypeIsRewrittenPerEntityType() {
    ObjectNode definition =
        workflow(
            IS,
            JsonUtils.readTree(
                "{\"table\": %s, \"default\": %s}"
                    .formatted(JsonUtils.pojoToJson(LEGACY_IS_NOT), JsonUtils.pojoToJson(IS))));

    assertTrue(MigrationUtil.rewriteWorkflow(definition));
    assertEquals(IS_NOT, definition.at("/trigger/config/filter/table").asText());
    assertEquals(IS, definition.at("/trigger/config/filter/default").asText());
  }

  @Test
  void aWorkflowWithNothingToRewriteIsLeftAlone() {
    ObjectNode definition = workflow(IS, IS);

    assertFalse(MigrationUtil.rewriteWorkflow(definition));
  }

  @Test
  void aWorkflowAlreadyInTheNewShapeIsLeftAlone() {
    ObjectNode definition = workflow(IS_NOT, encodedFilter(IS_NOT));

    assertFalse(MigrationUtil.rewriteWorkflow(definition));
  }

  @Test
  void onlyContractsWithANegatedListRuleAreStored() {
    UUID legacyId = UUID.randomUUID();
    String legacy = contract(legacyId, "legacy", LEGACY_IS_NOT);
    String current = contract(UUID.randomUUID(), "current", IS);
    String plain = "{\"id\":\"%s\",\"name\":\"plain\"}".formatted(UUID.randomUUID());
    EntityDAO<?> contractDAO = mock(EntityDAO.class);
    when(contractDAO.listAfter(any(ListFilter.class), anyInt(), eq(""), eq("")))
        .thenReturn(List.of(legacy, current, plain));
    when(contractDAO.listAfter(any(ListFilter.class), anyInt(), eq("plain"), anyString()))
        .thenReturn(List.of());

    assertEquals(1, MigrationUtil.rewriteDataContractRules(contractDAO));
    verify(contractDAO)
        .update(eq(legacyId), eq("legacy"), eq(contract(legacyId, "legacy", IS_NOT)));
    verify(contractDAO, never()).update(any(UUID.class), eq("current"), anyString());
  }

  @Test
  void entityRulesAreRewrittenAndOthersKept() {
    EntityRulesSettings rules =
        new EntityRulesSettings()
            .withEntitySemantics(
                List.of(
                    new SemanticsRule().withName("legacy").withRule(LEGACY_IS_NOT),
                    new SemanticsRule()
                        .withName("custom")
                        .withRule("{\"<=\":[{\"length\":{\"var\":\"domains\"}},1]}")));

    assertTrue(MigrationUtil.rewriteEntityRules(rules));
    assertEquals(IS_NOT, rules.getEntitySemantics().get(0).getRule());
    assertEquals(
        "{\"<=\":[{\"length\":{\"var\":\"domains\"}},1]}",
        rules.getEntitySemantics().get(1).getRule());
    assertFalse(MigrationUtil.rewriteEntityRules(rules));
  }

  private static String contract(UUID id, String name, String rule) {
    ObjectNode contract =
        (ObjectNode)
            JsonUtils.readTree(
                "{\"id\":\"%s\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\",\"semantics\":[{\"name\":\"r\",\"rule\":%s}]}"
                    .formatted(id, name, name, JsonUtils.pojoToJson(rule)));
    return contract.toString();
  }
}
