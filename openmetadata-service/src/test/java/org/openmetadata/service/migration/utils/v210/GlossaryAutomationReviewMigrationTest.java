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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class GlossaryAutomationReviewMigrationTest {
  private static final String CUSTOM_RULE =
      "{\"and\":[{\"some\":[{\"var\":\"reviewers\"},{\"!=\":[{\"var\":\"name\"},null]}]}]}";
  private static final String WAIT = "wait";

  private final WorkflowDefinition seed = GlossaryAutomationReviewMigration.seed();

  @Test
  void aStoredTwoZeroWorkflowBecomesTheSeed() {
    ObjectNode stored = asStoredBefore210();

    WorkflowDefinition migrated =
        GlossaryAutomationReviewMigration.withAutomationReview(definition(stored), seed)
            .orElseThrow();

    assertEquals(JsonUtils.valueToTree(seed), JsonUtils.valueToTree(migrated));
  }

  @Test
  void aCheckOrFallbackAnAdminChangedKeepsTheirs() {
    ObjectNode stored = asStoredBefore210();
    config(stored, GlossaryAutomationReviewMigration.REVIEWERS_CHECK).put("rules", CUSTOM_RULE);
    assignees(stored, "ApprovalForUpdates").put("emptyAssigneeStrategy", WAIT);

    JsonNode migrated =
        JsonUtils.valueToTree(
            GlossaryAutomationReviewMigration.withAutomationReview(definition(stored), seed)
                .orElseThrow());

    assertEquals(
        CUSTOM_RULE,
        config(migrated, GlossaryAutomationReviewMigration.REVIEWERS_CHECK).path("rules").asText());
    assertEquals(
        WAIT, assignees(migrated, "ApprovalForUpdates").path("emptyAssigneeStrategy").asText());
    assertEquals(
        "assignAdmins",
        assignees(migrated, "ApproveGlossaryTerm").path("emptyAssigneeStrategy").asText());
  }

  @Test
  void anUpToDateWorkflowNeedsNothing() {
    assertTrue(GlossaryAutomationReviewMigration.withAutomationReview(seed, seed).isEmpty());
  }

  /** The seed as 2.0 shipped it: the reviewers-only check and no admin fallback. */
  private ObjectNode asStoredBefore210() {
    ObjectNode stored = (ObjectNode) JsonUtils.valueToTree(seed);
    node(stored, GlossaryAutomationReviewMigration.REVIEWERS_CHECK)
        .put("displayName", "Check if Glossary Term has Reviewers");
    config(stored, GlossaryAutomationReviewMigration.REVIEWERS_CHECK)
        .put("rules", GlossaryAutomationReviewMigration.PREVIOUS_REVIEWERS_RULE);
    GlossaryAutomationReviewMigration.APPROVAL_STEPS.forEach(
        step -> assignees(stored, step).remove("emptyAssigneeStrategy"));
    return stored;
  }

  private static WorkflowDefinition definition(JsonNode workflow) {
    return JsonUtils.treeToValue(workflow, WorkflowDefinition.class);
  }

  private static ObjectNode config(JsonNode workflow, String name) {
    return (ObjectNode) node(workflow, name).path("config");
  }

  private static ObjectNode assignees(JsonNode workflow, String name) {
    return (ObjectNode) config(workflow, name).path("assignees");
  }

  private static ObjectNode node(JsonNode workflow, String name) {
    return StreamSupport.stream(workflow.path("nodes").spliterator(), false)
        .filter(node -> name.equals(node.path("name").asText()))
        .map(ObjectNode.class::cast)
        .findFirst()
        .orElseThrow();
  }
}
