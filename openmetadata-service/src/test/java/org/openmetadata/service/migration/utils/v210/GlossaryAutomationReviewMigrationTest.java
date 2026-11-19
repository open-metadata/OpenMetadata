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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.Workflow;

class GlossaryAutomationReviewMigrationTest {
  private static final String SHIPPED_BEFORE_210 =
      "/migration/v210/GlossaryApprovalWorkflow-2.0.json";
  private static final String START = "GlossaryTermCreated";
  private static final String REVIEWERS_CHECK = "CheckGlossaryTermHasReviewers";
  private static final String READY_CHECK = "CheckGlossaryTermIsReadyToBeReviewed";
  private static final String PROPOSAL_CHECK = GlossaryAutomationReviewMigration.PROPOSAL_CHECK;

  private final WorkflowDefinition seed = GlossaryAutomationReviewMigration.seed();

  @Test
  void aStoredTwoZeroWorkflowBecomesTheSeed() {
    WorkflowDefinition migrated = migrate(shippedBefore210());

    JsonNode migratedTree = JsonUtils.valueToTree(migrated);
    JsonNode seedTree = JsonUtils.valueToTree(seed);
    assertEquals(nodesOf(seedTree), nodesOf(migratedTree));
    assertEquals(edgesOf(seedTree), edgesOf(migratedTree));
  }

  @Test
  void aWorkflowAnAdminReshapedKeepsItsStepsAndGetsTheProposalBranch() {
    ObjectNode stored = shippedBefore210();
    removeNode(stored, REVIEWERS_CHECK);
    addEdge(stored, START, READY_CHECK);

    JsonNode migrated = JsonUtils.valueToTree(migrate(stored));

    assertTrue(edgesOf(migrated).contains(edge(START, PROPOSAL_CHECK, "")));
    assertTrue(edgesOf(migrated).contains(edge(PROPOSAL_CHECK, READY_CHECK, "false")));
    assertFalse(nodesOf(migrated).contains(REVIEWERS_CHECK));
    assertTrue(nodesOf(migrated).containsAll(nodesOf(stored)));
    assertTrue(
        nodesOf(migrated)
            .containsAll(
                GlossaryAutomationReviewMigration.proposalBranch(JsonUtils.valueToTree(seed))));
  }

  @Test
  void aStartWithSeveralEdgesIsLeftForAnAdminToWire() {
    ObjectNode stored = shippedBefore210();
    addEdge(stored, START, READY_CHECK);

    assertTrue(
        GlossaryAutomationReviewMigration.withAutomationReview(
                JsonUtils.treeToValue(stored, WorkflowDefinition.class), seed)
            .isEmpty());
  }

  @Test
  void aPersonsTermIsApprovedAsBeforeBecauseTheOtherStepsAreUntouched() {
    ObjectNode stored = shippedBefore210();

    JsonNode migrated = JsonUtils.valueToTree(migrate(stored));

    for (String step : List.of("ApproveGlossaryTerm", "ApprovalForUpdates")) {
      assertEquals(
          "none", assignees(migrated, step).path("emptyAssigneeStrategy").asText("none"), step);
      assertEquals(
          assignees(stored, step).path("candidates"), assignees(migrated, step).path("candidates"));
    }
  }

  @Test
  void aMigratedWorkflowNeedsNothingTheSecondTime() {
    WorkflowDefinition once = migrate(shippedBefore210());

    assertTrue(GlossaryAutomationReviewMigration.withAutomationReview(once, seed).isEmpty());
  }

  @Test
  void anUpToDateWorkflowNeedsNothing() {
    assertTrue(GlossaryAutomationReviewMigration.withAutomationReview(seed, seed).isEmpty());
  }

  @Test
  void aMigratedWorkflowBuildsItsProcesses() {
    new Workflow(migrate(shippedBefore210()));
  }

  private WorkflowDefinition migrate(JsonNode stored) {
    return GlossaryAutomationReviewMigration.withAutomationReview(
            JsonUtils.treeToValue(stored, WorkflowDefinition.class), seed)
        .orElseThrow();
  }

  private WorkflowDefinition migrate(WorkflowDefinition stored) {
    return GlossaryAutomationReviewMigration.withAutomationReview(stored, seed).orElseThrow();
  }

  private static ObjectNode shippedBefore210() {
    try (InputStream json =
        GlossaryAutomationReviewMigrationTest.class.getResourceAsStream(SHIPPED_BEFORE_210)) {
      return (ObjectNode)
          JsonUtils.readTree(new String(json.readAllBytes(), StandardCharsets.UTF_8));
    } catch (IOException e) {
      throw new IllegalStateException("Cannot read " + SHIPPED_BEFORE_210, e);
    }
  }

  private static void removeNode(ObjectNode workflow, String name) {
    removeWhere(workflow.path("nodes"), node -> name.equals(node.path("name").asText()));
    removeWhere(
        workflow.path("edges"),
        edge -> name.equals(edge.path("from").asText()) || name.equals(edge.path("to").asText()));
  }

  private static void removeWhere(JsonNode array, Predicate<JsonNode> matches) {
    Iterator<JsonNode> elements = array.elements();
    while (elements.hasNext()) {
      if (matches.test(elements.next())) {
        elements.remove();
      }
    }
  }

  private static void addEdge(ObjectNode workflow, String from, String to) {
    ((ArrayNode) workflow.path("edges")).addObject().put("from", from).put("to", to);
  }

  private static Set<String> nodesOf(JsonNode workflow) {
    return StreamSupport.stream(workflow.path("nodes").spliterator(), false)
        .map(node -> node.path("name").asText())
        .collect(Collectors.toSet());
  }

  private static Set<List<String>> edgesOf(JsonNode workflow) {
    return StreamSupport.stream(workflow.path("edges").spliterator(), false)
        .map(
            edge ->
                edge(
                    edge.path("from").asText(),
                    edge.path("to").asText(),
                    edge.path("condition").asText("")))
        .collect(Collectors.toSet());
  }

  private static List<String> edge(String from, String to, String condition) {
    return List.of(from, to, condition);
  }

  private static JsonNode assignees(JsonNode workflow, String name) {
    return StreamSupport.stream(workflow.path("nodes").spliterator(), false)
        .filter(node -> name.equals(node.path("name").asText()))
        .findFirst()
        .orElseThrow()
        .path("config")
        .path("assignees");
  }
}
