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
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.rules.RuleEngine;

/**
 * The shipped GlossaryTermApprovalWorkflow reviews a term an automation proposed even in a glossary
 * without reviewers, and its approval steps fall back to the admins rather than approving a term
 * nobody was assigned. The checks are read from the seed itself, so they pin what ships.
 */
class GlossaryApprovalWorkflowReviewTest {
  private static final String SEED_PATH =
      ".*json/data/governance/workflows/GlossaryApprovalWorkflow\\.json$";
  private static final String ADMIN_FALLBACK = "assignAdmins";

  private static WorkflowDefinition seed;

  @BeforeAll
  static void loadSeed() throws IOException {
    seed =
        EntityRepository.getEntitiesFromSeedData(
                Entity.WORKFLOW_DEFINITION, SEED_PATH, WorkflowDefinition.class)
            .getFirst();
  }

  @Test
  void anAutomationTermTakesTheReviewPathEvenWithoutReviewers() {
    String check = rulesOf("CheckGlossaryTermHasReviewers");

    assertTrue(passes(check, term(ProviderType.AUTOMATION, List.of())));
    assertTrue(passes(check, term(ProviderType.USER, List.of(reviewer()))));
    assertFalse(passes(check, term(ProviderType.USER, List.of())));
  }

  @Test
  void approvalStepsFallBackToTheAdminsWhenNobodyIsAssigned() {
    assertEquals(ADMIN_FALLBACK, assigneesOf("ApproveGlossaryTerm").get("emptyAssigneeStrategy"));
    assertEquals(ADMIN_FALLBACK, assigneesOf("ApprovalForUpdates").get("emptyAssigneeStrategy"));
  }

  private static boolean passes(String rule, GlossaryTerm term) {
    return Boolean.TRUE.equals(RuleEngine.getInstance().apply(rule, JsonUtils.getMap(term)));
  }

  private static GlossaryTerm term(ProviderType provider, List<EntityReference> reviewers) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("GDPR")
        .withFullyQualifiedName("Compliance.GDPR")
        .withProvider(provider)
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
