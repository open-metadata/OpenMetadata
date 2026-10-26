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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;

class NegatedListRuleMigrationTest {
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

    assertTrue(NegatedListRuleMigration.rewriteWorkflow(definition));
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

    assertFalse(NegatedListRuleMigration.rewriteWorkflow(definition));
  }

  @Test
  void aFilterPerEntityTypeIsRewrittenPerEntityType() {
    ObjectNode definition =
        workflow(
            IS,
            JsonUtils.readTree(
                "{\"table\": %s, \"default\": %s}"
                    .formatted(JsonUtils.pojoToJson(LEGACY_IS_NOT), JsonUtils.pojoToJson(IS))));

    assertTrue(NegatedListRuleMigration.rewriteWorkflow(definition));
    assertEquals(IS_NOT, definition.at("/trigger/config/filter/table").asText());
    assertEquals(IS, definition.at("/trigger/config/filter/default").asText());
  }

  @Test
  void aWorkflowWithNothingToRewriteIsLeftAlone() {
    ObjectNode definition = workflow(IS, IS);

    assertFalse(NegatedListRuleMigration.rewriteWorkflow(definition));
    assertFalse(NegatedListRuleMigration.hasNegatedList(definition));
  }

  @Test
  void aWorkflowAlreadyRewrittenIsRecognisedForRedeploy() {
    ObjectNode definition = workflow(IS_NOT, IS);

    assertFalse(NegatedListRuleMigration.rewriteWorkflow(definition));
    assertTrue(NegatedListRuleMigration.hasNegatedList(definition));
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

    assertEquals(1, NegatedListRuleMigration.rewriteDataContractRules(contractDAO));
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

    assertTrue(NegatedListRuleMigration.rewriteEntityRules(rules));
    assertEquals(IS_NOT, rules.getEntitySemantics().get(0).getRule());
    assertEquals(
        "{\"<=\":[{\"length\":{\"var\":\"domains\"}},1]}",
        rules.getEntitySemantics().get(1).getRule());
    assertFalse(NegatedListRuleMigration.rewriteEntityRules(rules));
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
