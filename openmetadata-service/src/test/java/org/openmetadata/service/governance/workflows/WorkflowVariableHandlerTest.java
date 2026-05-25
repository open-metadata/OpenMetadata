/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WorkflowVariableHandlerTest {

  @Test
  void getEntityListFromVariables_plainEntityList_returnsCorrectList() {
    Map<String, String> inputNamespaceMap = Map.of("entityList", "global");
    Map<String, Object> variables =
        Map.of("global_entityList", List.of("entity1", "entity2", "entity3"));

    List<String> result =
        WorkflowVariableHandler.getEntityListFromVariables(inputNamespaceMap, variables);

    assertEquals(List.of("entity1", "entity2", "entity3"), result);
  }

  @Test
  void getEntityListFromVariables_bandedEntityList_returnsCorrectList() {
    Map<String, String> inputNamespaceMap = Map.of("gold_entityList", "dataCompleteness1");
    Map<String, Object> variables =
        Map.of(
            "global_entityList", List.of("entity1", "entity2", "entity3"),
            "dataCompleteness1_gold_entityList", List.of("entity1", "entity3"));

    List<String> result =
        WorkflowVariableHandler.getEntityListFromVariables(inputNamespaceMap, variables);

    assertEquals(
        List.of("entity1", "entity3"), result, "Should return gold band subset, not global");
  }

  @Test
  void getEntityListFromVariables_checkNodeTrueList_returnsPassedEntities() {
    Map<String, String> inputNamespaceMap = Map.of("true_entityList", "checkNode1");
    Map<String, Object> variables =
        Map.of(
            "global_entityList", List.of("entity1", "entity2"),
            "checkNode1_true_entityList", List.of("entity1"),
            "checkNode1_false_entityList", List.of("entity2"));

    List<String> result =
        WorkflowVariableHandler.getEntityListFromVariables(inputNamespaceMap, variables);

    assertEquals(List.of("entity1"), result);
  }

  @Test
  void getEntityListFromVariables_variableNotFound_returnsEmptyList() {
    Map<String, String> inputNamespaceMap = Map.of("entityList", "global");
    Map<String, Object> variables = Map.of("someOtherVar", "value");

    List<String> result =
        WorkflowVariableHandler.getEntityListFromVariables(inputNamespaceMap, variables);

    assertTrue(result.isEmpty());
  }

  @Test
  void getEntityListFromVariables_emptyInputNamespaceMap_returnsEmptyList() {
    Map<String, String> inputNamespaceMap = Map.of();
    Map<String, Object> variables = Map.of("global_entityList", List.of("entity1"));

    List<String> result =
        WorkflowVariableHandler.getEntityListFromVariables(inputNamespaceMap, variables);

    assertTrue(result.isEmpty());
  }

  @Test
  void getEntityListFromVariables_bandedKeyTakesPriorityOverPlain() {
    Map<String, String> inputNamespaceMap = Map.of("silver_entityList", "dataCompleteness1");
    Map<String, Object> variables =
        Map.of(
            "global_entityList", List.of("e1", "e2", "e3"),
            "dataCompleteness1_silver_entityList", List.of("e2"));

    List<String> result =
        WorkflowVariableHandler.getEntityListFromVariables(inputNamespaceMap, variables);

    assertEquals(List.of("e2"), result);
  }

  @Test
  void getUpdatedByFromVariables_resolvesFromNamespace() {
    Map<String, String> inputNamespaceMap = Map.of("updatedBy", "userApproval");
    Map<String, Object> variables =
        Map.of("userApproval_updatedBy", "alice", "global_updatedBy", "bob");

    assertEquals(
        "alice", WorkflowVariableHandler.getUpdatedByFromVariables(inputNamespaceMap, variables));
  }

  @Test
  void getUpdatedByFromVariables_ignoresOtherNamespacesWhenMapPointsElsewhere() {
    Map<String, String> inputNamespaceMap = Map.of("updatedBy", "userApproval");
    Map<String, Object> variables =
        Map.of(
            "global_updatedBy", "trigger-user",
            "userApproval_updatedBy", "approver",
            "otherNode_updatedBy", "bot");

    assertEquals(
        "approver",
        WorkflowVariableHandler.getUpdatedByFromVariables(inputNamespaceMap, variables));
  }

  @Test
  void getUpdatedByFromVariables_namespaceMissingFromMap_returnsNull() {
    Map<String, String> inputNamespaceMap = Map.of("entityList", "global");
    Map<String, Object> variables = Map.of("global_updatedBy", "alice");

    assertNull(WorkflowVariableHandler.getUpdatedByFromVariables(inputNamespaceMap, variables));
  }

  @Test
  void getUpdatedByFromVariables_variableNotSet_returnsNull() {
    Map<String, String> inputNamespaceMap = Map.of("updatedBy", "userApproval");
    Map<String, Object> variables = Map.of("global_entityList", List.of("e1"));

    assertNull(WorkflowVariableHandler.getUpdatedByFromVariables(inputNamespaceMap, variables));
  }

  @Test
  void getUpdatedByFromVariables_globalNamespace_resolvesGlobalKey() {
    Map<String, String> inputNamespaceMap = Map.of("updatedBy", "global");
    Map<String, Object> variables = Map.of("global_updatedBy", "trigger-user");

    assertEquals(
        "trigger-user",
        WorkflowVariableHandler.getUpdatedByFromVariables(inputNamespaceMap, variables));
  }
}
