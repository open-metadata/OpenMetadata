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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.rules.RuleEngine;

/**
 * The shipped GlossaryTermApprovalWorkflow sends a term an automation proposed, until a person
 * approves it, down a branch of its own right after the start, whatever the glossary's reviewers,
 * whose approval steps fall back to the admins rather than approving a proposal nobody was assigned.
 * A person's term takes the steps it always took, unchanged. The checks are read from the seed
 * itself, so they pin what ships.
 */
class GlossaryApprovalWorkflowReviewTest {
  private static final String SEED_PATH =
      ".*json/data/governance/workflows/GlossaryApprovalWorkflow\\.json$";
  private static final String ADMIN_FALLBACK = "assignAdmins";
  private static final String NO_FALLBACK = "none";
  private static final String PROPOSAL_CHECK = "CheckIfGlossaryTermIsAutomationProposal";

  private static WorkflowDefinition seed;

  @BeforeAll
  static void loadSeed() throws IOException {
    seed =
        EntityRepository.getEntitiesFromSeedData(
                Entity.WORKFLOW_DEFINITION, SEED_PATH, WorkflowDefinition.class)
            .getFirst();
  }

  @Test
  void aProposalNobodyApprovedYetTakesTheProposalBranch() {
    String check = rulesOf(PROPOSAL_CHECK);

    assertTrue(passes(check, term(ProviderType.AUTOMATION, EntityStatus.DRAFT, List.of())));
    assertTrue(passes(check, term(ProviderType.AUTOMATION, EntityStatus.IN_REVIEW, List.of())));
    assertTrue(
        passes(check, term(ProviderType.AUTOMATION, EntityStatus.REJECTED, List.of(reviewer()))));
    assertFalse(passes(check, term(ProviderType.AUTOMATION, EntityStatus.APPROVED, List.of())));
    assertFalse(passes(check, term(ProviderType.USER, EntityStatus.DRAFT, List.of(reviewer()))));
  }

  @Test
  void theProposalBranchComesFirstAndHandsEveryOtherTermToTheReviewersCheck() {
    assertTrue(hasEdge("GlossaryTermCreated", PROPOSAL_CHECK, null));
    assertTrue(hasEdge(PROPOSAL_CHECK, "CheckGlossaryTermHasReviewers", "false"));
    assertTrue(hasEdge(PROPOSAL_CHECK, "CheckIfAutomationProposalUpdatedByIsReviewer", "true"));
    assertTrue(
        hasEdge(
            "CheckIfAutomationProposalUpdatedByIsReviewer",
            "SetAutomationProposalStatusToApprovedByReviewer",
            "true"));
    assertTrue(
        hasEdge(
            "CheckIfAutomationProposalUpdatedByIsReviewer",
            "CheckIfAutomationProposalIsNew",
            "false"));
  }

  @Test
  void aPersonsTermWithoutReviewersIsStillApprovedAsBefore() {
    String check = rulesOf("CheckGlossaryTermHasReviewers");

    assertFalse(passes(check, term(ProviderType.USER, EntityStatus.DRAFT, List.of())));
    assertTrue(passes(check, term(ProviderType.USER, EntityStatus.DRAFT, List.of(reviewer()))));
  }

  @Test
  void aRejectedProposalIsRejectedAndARejectedChangeToItIsRolledBack() {
    assertTrue(
        hasEdge("ApproveAutomationProposal", "SetAutomationProposalStatusToRejected", "reject"));
    assertTrue(
        hasEdge("ApproveAutomationProposalUpdate", "RollbackAutomationProposalChanges", "reject"));
  }

  @Test
  void aProposalsApprovalStepsFallBackToTheAdminsWhenNobodyIsAssigned() {
    List.of("ApproveAutomationProposal", "ApproveAutomationProposalUpdate")
        .forEach(
            step ->
                assertEquals(ADMIN_FALLBACK, assigneesOf(step).get("emptyAssigneeStrategy"), step));
  }

  @Test
  void aPersonsTermIsApprovedWhenNobodyIsAssignedAsBefore() {
    List.of("ApproveGlossaryTerm", "ApprovalForUpdates")
        .forEach(
            step ->
                assertEquals(
                    NO_FALLBACK,
                    String.valueOf(
                        assigneesOf(step).getOrDefault("emptyAssigneeStrategy", NO_FALLBACK)),
                    step));
  }

  private static boolean hasEdge(String from, String to, String condition) {
    return seed.getEdges().stream()
        .anyMatch(
            edge ->
                from.equals(edge.getFrom())
                    && to.equals(edge.getTo())
                    && Objects.equals(condition, edge.getCondition()));
  }

  private static boolean passes(String rule, GlossaryTerm term) {
    return Boolean.TRUE.equals(RuleEngine.getInstance().apply(rule, JsonUtils.getMap(term)));
  }

  private static GlossaryTerm term(
      ProviderType provider, EntityStatus status, List<EntityReference> reviewers) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("GDPR")
        .withFullyQualifiedName("Compliance.GDPR")
        .withProvider(provider)
        .withEntityStatus(status)
        .withReviewers(reviewers);
  }

  private static EntityReference reviewer() {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.USER)
        .withName("karan")
        .withFullyQualifiedName("karan");
  }

  private static String rulesOf(String name) {
    return (String) JsonUtils.getMap(node(name).getConfig()).get("rules");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> assigneesOf(String name) {
    return (Map<String, Object>) JsonUtils.getMap(node(name).getConfig()).get("assignees");
  }

  private static WorkflowNodeDefinitionInterface node(String name) {
    return seed.getNodes().stream()
        .filter(node -> name.equals(node.getName()))
        .findFirst()
        .orElseThrow();
  }
}
