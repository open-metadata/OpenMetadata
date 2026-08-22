/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.WorkflowTriggerInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry.GatingRule;

/**
 * Unit tests for how {@link GovernanceApprovalRegistry} turns a workflow's trigger config into a
 * {@link GatingRule}. The field-selection logic itself (include/exclude/trigger-field/filter) lives
 * in {@code WorkflowTriggerFilters} and is tested there; here we assert the rule carries the right
 * include, exclude, and resolved filter, and that only hook-bearing eventBasedEntity workflows
 * targeting the entity type produce a rule at all.
 */
class GovernanceApprovalRegistryTest {
  private static final String HOOK =
      "{\"subType\":\"resolvePendingChangeTask\",\"name\":\"resolve\",\"config\":{\"action\":\"commit\"}}";
  private static final String STATUS_NODE =
      "{\"subType\":\"setEntityAttributeTask\",\"name\":\"setStatus\",\"config\":{\"fieldName\":\"status\",\"fieldValue\":\"Approved\"}}";

  private static WorkflowDefinition workflow(String triggerJson, String... nodeJson) {
    WorkflowTriggerInterface trigger = null;
    if (triggerJson != null) {
      trigger = JsonUtils.readValue(triggerJson, WorkflowTriggerInterface.class);
    }
    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>();
    for (String node : nodeJson) {
      nodes.add(JsonUtils.readValue(node, WorkflowNodeDefinitionInterface.class));
    }
    return new WorkflowDefinition().withName("wf").withTrigger(trigger).withNodes(nodes);
  }

  private static List<GatingRule> rulesFor(String entityType, WorkflowDefinition wd) {
    List<GatingRule> rules = new ArrayList<>();
    GovernanceApprovalRegistry.addRule(entityType, wd, rules);
    return rules;
  }

  private static GatingRule onlyRule(String entityType, WorkflowDefinition wd) {
    List<GatingRule> rules = rulesFor(entityType, wd);
    assertEquals(1, rules.size());
    return rules.get(0);
  }

  private static String trigger(String entityTypes, String include, String exclude, String filter) {
    return ("{\"type\":\"eventBasedEntity\",\"config\":{\"entityTypes\":[%s],"
            + "\"include\":[%s],\"exclude\":[%s],\"filter\":%s}}")
        .formatted(entityTypes, include, exclude, filter);
  }

  @Test
  void gatesWhenHookPresentAndFieldIncluded() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "", "{}"), HOOK);
    assertEquals(List.of("description"), onlyRule("table", wd).includedFields());
  }

  @Test
  void doesNotGateWithoutHook() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "", "{}"));
    assertTrue(rulesFor("table", wd).isEmpty());
  }

  @Test
  void doesNotGateForOtherEntityType() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "", "{}"), HOOK);
    assertTrue(rulesFor("dashboard", wd).isEmpty());
  }

  @Test
  void gatesAnyListedField_notJustCovered() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"displayName\"", "", "{}"), HOOK);
    assertEquals(List.of("displayName"), onlyRule("table", wd).includedFields());
  }

  @Test
  void unionsAllIncludedFields() {
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\",\"tags\",\"displayName\"", "", "{}"), HOOK);
    assertEquals(
        List.of("description", "tags", "displayName"), onlyRule("table", wd).includedFields());
  }

  @Test
  void emptyIncludeStillGatesAsCatchAll() {
    // Empty include is the most permissive config: it holds every changed trigger field. The rule
    // must be produced (previously it was dropped), carrying an empty include and empty exclude.
    WorkflowDefinition wd = workflow(trigger("\"table\"", "", "", "{}"), HOOK);
    GatingRule rule = onlyRule("table", wd);
    assertTrue(rule.includedFields().isEmpty());
    assertTrue(rule.excludedFields().isEmpty());
  }

  @Test
  void carriesExcludeOntoRuleWhenIncludeEmpty() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "", "\"tags\",\"owners\"", "{}"), HOOK);
    GatingRule rule = onlyRule("table", wd);
    assertTrue(rule.includedFields().isEmpty());
    assertEquals(List.of("tags", "owners"), rule.excludedFields());
  }

  @Test
  void carriesBothIncludeAndExclude() {
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\"", "\"tags\"", "{}"), HOOK);
    GatingRule rule = onlyRule("table", wd);
    assertEquals(List.of("description"), rule.includedFields());
    assertEquals(List.of("tags"), rule.excludedFields());
  }

  @Test
  void doesNotGateForNonEventBasedTrigger() {
    String periodic = "{\"type\":\"periodicBatchEntity\",\"config\":{\"entityTypes\":[\"table\"]}}";
    WorkflowDefinition wd = workflow(periodic, HOOK);
    assertTrue(rulesFor("table", wd).isEmpty());
  }

  @Test
  void gatesViaDeprecatedSingleEntityTypeField() {
    String t =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"entityType\":\"table\",\"include\":[\"description\"],\"filter\":{}}}";
    WorkflowDefinition wd = workflow(t, HOOK);
    assertEquals(List.of("description"), onlyRule("table", wd).includedFields());
  }

  @Test
  void gatesWhenOneOfMultipleEntityTypesMatches() {
    WorkflowDefinition wd =
        workflow(trigger("\"dashboard\",\"table\"", "\"description\"", "", "{}"), HOOK);
    assertEquals(1, rulesFor("table", wd).size());
    assertEquals(1, rulesFor("dashboard", wd).size());
    assertTrue(rulesFor("topic", wd).isEmpty());
  }

  @Test
  void plainStringFilterIsUnsupportedAndYieldsNull() {
    // FilterEntityImpl rejects plain (non-object) string filters; the gate must resolve the same.
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\"", "", "\"{\\\"==\\\":[1,1]}\""), HOOK);
    assertNull(onlyRule("table", wd).filterLogic());
  }

  @Test
  void resolvesPerEntityTypeFilterObject() {
    String t =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"entityTypes\":[\"table\"],\"include\":[\"description\"],\"filter\":{\"table\":\"T_LOGIC\",\"default\":\"D_LOGIC\"}}}";
    WorkflowDefinition wd = workflow(t, HOOK);
    assertEquals("T_LOGIC", onlyRule("table", wd).filterLogic());
  }

  @Test
  void resolvesDefaultFilterWhenEntityTypeAbsent() {
    String t =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"entityTypes\":[\"table\"],\"include\":[\"description\"],\"filter\":{\"default\":\"D_LOGIC\"}}}";
    WorkflowDefinition wd = workflow(t, HOOK);
    assertEquals("D_LOGIC", onlyRule("table", wd).filterLogic());
  }

  @Test
  void resolvesObjectEncodedAsStringFilter() {
    // A per-entity filter object serialized as a JSON-object STRING is still honored.
    WorkflowDefinition wd =
        workflow(
            trigger("\"table\"", "\"description\"", "", "\"{\\\"table\\\":\\\"T_LOGIC\\\"}\""),
            HOOK);
    assertEquals("T_LOGIC", onlyRule("table", wd).filterLogic());
  }

  @Test
  void emptyFilterObjectYieldsNullFilterLogic() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "", "{}"), HOOK);
    assertNull(onlyRule("table", wd).filterLogic());
  }

  @Test
  void hookAlongsideStatusNodeStillGates() {
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\"", "", "{}"), STATUS_NODE, HOOK);
    assertEquals(1, rulesFor("table", wd).size());
  }
}
