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

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * A stored GlossaryTermApprovalWorkflow from before the automation-proposal branch gains it exactly
 * as the seed ships it, once, and a customized first step stays where the branch hands terms back.
 */
class GlossaryAutomationProposalMigrationTest {
  private static final String START = "GlossaryTermCreated";
  private static final String ENTRY = "CheckIfGlossaryTermIsAutomationProposal";
  private static final String FIRST_STEP_BEFORE_BRANCH = "CheckGlossaryTermHasReviewers";
  // Named here, not taken from the migration, so the fixture is the workflow 2.0 shipped.
  private static final Set<String> BRANCH =
      Set.of(
          ENTRY,
          "CheckIfAutomationProposalHasOpenApprovalTask",
          "AutomationProposalUnderReviewEnd",
          "SetAutomationProposalStatusToInReview",
          "ApproveAutomationProposal",
          "SetAutomationProposalStatusToApproved",
          "SetAutomationProposalStatusToRejected",
          "AutomationProposalApprovedEnd",
          "AutomationProposalRejectedEnd");

  private final WorkflowDefinition seed = GlossaryAutomationProposalMigration.seed();

  @Test
  void aStoredWorkflowWithoutTheBranchEndsUpAsTheSeed() {
    WorkflowDefinition stored = storedBeforeBranch(FIRST_STEP_BEFORE_BRANCH);

    assertTrue(GlossaryAutomationProposalMigration.addBranch(stored, seed));

    assertEquals(nodeNames(seed), nodeNames(stored));
    assertEquals(Set.copyOf(seed.getEdges()), Set.copyOf(stored.getEdges()));
  }

  @Test
  void aWorkflowThatHasTheBranchIsLeftAlone() {
    WorkflowDefinition stored = storedBeforeBranch(FIRST_STEP_BEFORE_BRANCH);
    GlossaryAutomationProposalMigration.addBranch(stored, seed);
    List<EdgeDefinition> migrated = List.copyOf(stored.getEdges());

    assertFalse(GlossaryAutomationProposalMigration.addBranch(stored, seed));
    assertEquals(migrated, stored.getEdges());
  }

  @Test
  void theBranchHandsTermsBackToACustomizedFirstStep() {
    String customStep = "CheckIfGlossaryTermUpdatedByIsReviewer";
    WorkflowDefinition stored = storedBeforeBranch(customStep);

    GlossaryAutomationProposalMigration.addBranch(stored, seed);

    assertTrue(stored.getEdges().contains(edge(START, ENTRY, null)));
    assertTrue(stored.getEdges().contains(edge(ENTRY, customStep, "false")));
    assertFalse(stored.getEdges().contains(edge(ENTRY, FIRST_STEP_BEFORE_BRANCH, "false")));
  }

  @Test
  void theBranchIsEveryNodeTheEntryCheckReachesBeforeHandingTermsBack() {
    assertEquals(BRANCH, GlossaryAutomationProposalMigration.branchNodes(seed));
  }

  private WorkflowDefinition storedBeforeBranch(String firstStep) {
    WorkflowDefinition stored =
        JsonUtils.readValue(JsonUtils.pojoToJson(seed), WorkflowDefinition.class);
    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>(stored.getNodes());
    nodes.removeIf(node -> BRANCH.contains(node.getName()));
    List<EdgeDefinition> edges = new ArrayList<>(stored.getEdges());
    edges.removeIf(edge -> START.equals(edge.getFrom()) || BRANCH.contains(edge.getFrom()));
    edges.add(edge(START, firstStep, null));
    stored.setNodes(nodes);
    stored.setEdges(edges);
    return stored;
  }

  private static EdgeDefinition edge(String from, String to, String condition) {
    return new EdgeDefinition().withFrom(from).withTo(to).withCondition(condition);
  }

  private static Set<String> nodeNames(WorkflowDefinition workflow) {
    return workflow.getNodes().stream()
        .map(WorkflowNodeDefinitionInterface::getName)
        .collect(Collectors.toSet());
  }
}
