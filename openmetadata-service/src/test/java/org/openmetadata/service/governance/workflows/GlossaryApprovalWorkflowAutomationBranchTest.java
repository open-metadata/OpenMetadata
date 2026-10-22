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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.rules.RuleEngine;

/**
 * The shipped GlossaryTermApprovalWorkflow sends a term an automation proposed to an approval task
 * before any other step can approve it, and an edit while that task is open leaves the task
 * deciding. These tests read the rules and routing from the seed itself, so they pin what ships.
 */
class GlossaryApprovalWorkflowAutomationBranchTest {
  private static final String SEED_PATH =
      ".*json/data/governance/workflows/GlossaryApprovalWorkflow\\.json$";
  private static final String TERM_FQN = "Compliance.GDPR";
  private static final UUID TERM_ID = UUID.randomUUID();

  private static WorkflowDefinition seed;

  @BeforeAll
  static void loadSeed() throws IOException {
    seed =
        EntityRepository.getEntitiesFromSeedData(
                Entity.WORKFLOW_DEFINITION, SEED_PATH, WorkflowDefinition.class)
            .getFirst();
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void everyTermIsCheckedForAnAutomationProposalBeforeAnyAutoApproval() {
    assertEquals(
        Set.of("CheckIfGlossaryTermIsAutomationProposal"), targetsOf("GlossaryTermCreated"));
    assertEquals(
        "CheckGlossaryTermHasReviewers",
        targetOf("CheckIfGlossaryTermIsAutomationProposal", "false"));
  }

  @Test
  void anAutomationTermAwaitingItsFirstDecisionTakesTheProposalBranch() {
    String rule = rulesOf("CheckIfGlossaryTermIsAutomationProposal");
    givenHistory(EntityStatus.DRAFT, EntityStatus.IN_REVIEW);

    assertTrue(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.DRAFT)));
    assertTrue(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.IN_REVIEW)));
    assertFalse(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.APPROVED)));
    assertFalse(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.REJECTED)));
    assertFalse(matches(rule, term(ProviderType.USER, EntityStatus.DRAFT)));
  }

  @Test
  void aPublishedAutomationTermUnderReviewFollowsTheRegularReview() {
    String rule = rulesOf("CheckIfGlossaryTermIsAutomationProposal");
    givenHistory(EntityStatus.DRAFT, EntityStatus.APPROVED, EntityStatus.IN_REVIEW);

    assertFalse(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.IN_REVIEW)));
    assertFalse(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.DRAFT)));
  }

  @Test
  void aProposalWithAnOpenApprovalTaskKeepsThatTaskDeciding() {
    String rule = rulesOf("CheckIfAutomationProposalHasOpenApprovalTask");
    TaskRepository tasks = mock(TaskRepository.class);
    Entity.registerEntity(Task.class, Entity.TASK, tasks);

    when(tasks.listNonTerminalTasksByEntityAndCategory(TERM_FQN, TaskCategory.Approval))
        .thenReturn(List.of(approvalTaskAbout(TERM_ID)));
    assertTrue(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.IN_REVIEW)));
    assertEquals(
        "AutomationProposalUnderReviewEnd",
        targetOf("CheckIfAutomationProposalHasOpenApprovalTask", "true"));

    when(tasks.listNonTerminalTasksByEntityAndCategory(TERM_FQN, TaskCategory.Approval))
        .thenReturn(List.of());
    assertFalse(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.IN_REVIEW)));
  }

  @Test
  void anOpenTaskAboutAnotherEntityWithTheSameNameIsNotTheProposals() {
    String rule = rulesOf("CheckIfAutomationProposalHasOpenApprovalTask");
    TaskRepository tasks = mock(TaskRepository.class);
    Entity.registerEntity(Task.class, Entity.TASK, tasks);

    when(tasks.listNonTerminalTasksByEntityAndCategory(TERM_FQN, TaskCategory.Approval))
        .thenReturn(List.of(approvalTaskAbout(UUID.randomUUID())));

    assertFalse(matches(rule, term(ProviderType.AUTOMATION, EntityStatus.IN_REVIEW)));
  }

  @Test
  void aProposalWithoutATaskGoesToItsReviewersThenOwnersThenAdmins() {
    assertEquals(
        "SetAutomationProposalStatusToInReview",
        targetOf("CheckIfAutomationProposalHasOpenApprovalTask", "false"));
    assertEquals(
        Set.of("ApproveAutomationProposal"), targetsOf("SetAutomationProposalStatusToInReview"));
    Map<String, Object> assignees = assigneesOf("ApproveAutomationProposal");

    assertEquals(Boolean.TRUE, assignees.get("addReviewers"));
    assertEquals("assignAdmins", assignees.get("emptyAssigneeStrategy"));
    assertEquals(
        "SetAutomationProposalStatusToApproved", targetOf("ApproveAutomationProposal", "approve"));
    assertEquals(
        "SetAutomationProposalStatusToRejected", targetOf("ApproveAutomationProposal", "reject"));
  }

  private static boolean matches(String rule, GlossaryTerm term) {
    return Boolean.TRUE.equals(RuleEngine.getInstance().apply(rule, JsonUtils.getMap(term)));
  }

  @SuppressWarnings("unchecked")
  private static void givenHistory(EntityStatus... statuses) {
    EntityRepository<GlossaryTerm> terms = mock(EntityRepository.class);
    List<Object> versions =
        Arrays.stream(statuses)
            .map(status -> (Object) JsonUtils.pojoToJson(term(ProviderType.AUTOMATION, status)))
            .toList();
    when(terms.listVersions(TERM_ID)).thenReturn(new EntityHistory().withVersions(versions));
    Entity.registerEntity(GlossaryTerm.class, Entity.GLOSSARY_TERM, terms);
  }

  private static Task approvalTaskAbout(UUID entityId) {
    return new Task()
        .withAbout(new EntityReference().withId(entityId).withType(Entity.GLOSSARY_TERM));
  }

  private static GlossaryTerm term(ProviderType provider, EntityStatus status) {
    return new GlossaryTerm()
        .withId(TERM_ID)
        .withName("GDPR")
        .withFullyQualifiedName(TERM_FQN)
        .withDescription("The EU data protection regulation")
        .withProvider(provider)
        .withEntityStatus(status);
  }

  private static WorkflowNodeDefinitionInterface node(String name) {
    return seed.getNodes().stream()
        .filter(node -> name.equals(node.getName()))
        .findFirst()
        .orElseThrow();
  }

  private static String rulesOf(String name) {
    return (String) JsonUtils.getMap(node(name).getConfig()).get("rules");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> assigneesOf(String name) {
    return (Map<String, Object>) JsonUtils.getMap(node(name).getConfig()).get("assignees");
  }

  private static Set<String> targetsOf(String from) {
    return seed.getEdges().stream()
        .filter(edge -> from.equals(edge.getFrom()))
        .map(EdgeDefinition::getTo)
        .collect(Collectors.toSet());
  }

  private static String targetOf(String from, String condition) {
    return seed.getEdges().stream()
        .filter(edge -> from.equals(edge.getFrom()) && condition.equals(edge.getCondition()))
        .map(EdgeDefinition::getTo)
        .findFirst()
        .orElseThrow();
  }
}
