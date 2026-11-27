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

package org.openmetadata.service.migration.utils.v211;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;

class SuggestionTaskOwnerFallbackMigrationTest {

  @ParameterizedTest
  @NullSource
  @ValueSource(strings = "none")
  void aStoredWorkflowGainsTheCascadeAndTheAdminFallback(String strategy) {
    JsonNode assignees =
        reviewAssignees(
            SuggestionTaskOwnerFallbackMigration.withOwnerFallback(
                stored("TaskReview", strategy, false)));
    assertTrue(assignees.path("cascadeOwners").asBoolean());
    assertEquals("assignAdmins", assignees.path("emptyAssigneeStrategy").asText());
  }

  @Test
  void anAdminsWaitIsKept() {
    JsonNode assignees =
        reviewAssignees(
            SuggestionTaskOwnerFallbackMigration.withOwnerFallback(
                stored("TaskReview", "wait", false)));
    assertTrue(assignees.path("cascadeOwners").asBoolean());
    assertEquals("wait", assignees.path("emptyAssigneeStrategy").asText());
  }

  @Test
  void anUpToDateWorkflowIsLeftAsItIs() {
    ObjectNode stored = stored("TaskReview", "assignAdmins", true);
    assertEquals(stored, SuggestionTaskOwnerFallbackMigration.withOwnerFallback(stored));
  }

  @Test
  void aWorkflowWithoutTheReviewNodeFailsTheMigration() {
    ObjectNode stored = stored("ReviewByStewards", null, false);
    assertThrows(
        IllegalStateException.class,
        () -> SuggestionTaskOwnerFallbackMigration.withOwnerFallback(stored));
  }

  private static ObjectNode stored(String reviewNode, String strategy, boolean cascadeOwners) {
    ObjectNode assignees =
        (ObjectNode)
            JsonUtils.readTree("{\"addReviewers\":true,\"addOwners\":false,\"candidates\":[]}");
    if (strategy != null) {
      assignees.put("emptyAssigneeStrategy", strategy);
    }
    if (cascadeOwners) {
      assignees.put("cascadeOwners", true);
    }
    ObjectNode workflow =
        (ObjectNode)
            JsonUtils.readTree(
                """
                {"name": "SuggestionTaskWorkflow", "nodes": [
                  {"type": "startEvent", "subType": "startEvent", "name": "TaskStart"},
                  {"type": "userTask", "subType": "userApprovalTask", "name": "%s",
                   "config": {"approvalThreshold": 1}}]}
                """
                    .formatted(reviewNode));
    ((ObjectNode) workflow.path("nodes").get(1).path("config")).set("assignees", assignees);
    return workflow;
  }

  private static JsonNode reviewAssignees(JsonNode workflow) {
    return workflow.path("nodes").get(1).path("config").path("assignees");
  }
}
