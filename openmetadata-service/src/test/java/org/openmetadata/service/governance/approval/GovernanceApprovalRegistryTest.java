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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.WorkflowTriggerInterface;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.EntityLifecycle;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry.GatingRule;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Unit tests for how {@link GovernanceApprovalRegistry} turns a workflow's trigger config into a
 * {@link GatingRule}. The field-selection logic itself (include/exclude/trigger-field/filter) lives
 * in {@code WorkflowTriggerFilters} and is tested there; here we assert the rule carries the right
 * include, exclude, and resolved filter, and that only Enforce-mode eventBasedEntity workflows
 * targeting the entity type produce a rule at all.
 */
class GovernanceApprovalRegistryTest {
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
    Map<String, List<GatingRule>> rules = new HashMap<>();
    GovernanceApprovalRegistry.addRules(wd, rules);
    return rules.getOrDefault(entityType, List.of());
  }

  private static GatingRule onlyRule(String entityType, WorkflowDefinition wd) {
    List<GatingRule> rules = rulesFor(entityType, wd);
    assertEquals(1, rules.size());
    return rules.get(0);
  }

  private static String trigger(String entityTypes, String include, String exclude, String filter) {
    return ("{\"type\":\"eventBasedEntity\",\"config\":{\"approvalMode\":\"Enforce\","
            + "\"entityTypes\":[%s],\"include\":[%s],\"exclude\":[%s],\"filter\":%s}}")
        .formatted(entityTypes, include, exclude, filter);
  }

  @Test
  void gatesInEnforceModeWhenFieldIncluded() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "", "{}"));
    assertEquals(List.of("description"), onlyRule("table", wd).includedFields());
  }

  @Test
  void doesNotGateWhileSuspended() {
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\"", "", "{}")).withSuspended(true);
    assertTrue(rulesFor("table", wd).isEmpty());
  }

  @Test
  void doesNotGateForOtherEntityType() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "", "{}"));
    assertTrue(rulesFor("dashboard", wd).isEmpty());
  }

  @Test
  void gatesAnyListedField_notJustCovered() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"displayName\"", "", "{}"));
    assertEquals(List.of("displayName"), onlyRule("table", wd).includedFields());
  }

  @Test
  void unionsAllIncludedFields() {
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\",\"tags\",\"displayName\"", "", "{}"));
    assertEquals(
        List.of("description", "tags", "displayName"), onlyRule("table", wd).includedFields());
  }

  @Test
  void emptyIncludeStillGatesAsCatchAll() {
    // Empty include is the most permissive config: it holds every changed trigger field. The rule
    // must be produced (previously it was dropped), carrying an empty include and empty exclude.
    WorkflowDefinition wd = workflow(trigger("\"table\"", "", "", "{}"));
    GatingRule rule = onlyRule("table", wd);
    assertTrue(rule.includedFields().isEmpty());
    assertTrue(rule.excludedFields().isEmpty());
  }

  @Test
  void carriesExcludeOntoRuleWhenIncludeEmpty() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "", "\"tags\",\"owners\"", "{}"));
    GatingRule rule = onlyRule("table", wd);
    assertTrue(rule.includedFields().isEmpty());
    assertEquals(List.of("tags", "owners"), rule.excludedFields());
  }

  @Test
  void carriesBothIncludeAndExclude() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "\"tags\"", "{}"));
    GatingRule rule = onlyRule("table", wd);
    assertEquals(List.of("description"), rule.includedFields());
    assertEquals(List.of("tags"), rule.excludedFields());
  }

  @Test
  void doesNotGateForNonEventBasedTrigger() {
    String periodic = "{\"type\":\"periodicBatchEntity\",\"config\":{\"entityTypes\":[\"table\"]}}";
    WorkflowDefinition wd = workflow(periodic);
    assertTrue(rulesFor("table", wd).isEmpty());
  }

  @Test
  void gatesViaDeprecatedSingleEntityTypeField() {
    String t =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"approvalMode\":\"Enforce\",\"entityType\":\"table\",\"include\":[\"description\"],\"filter\":{}}}";
    WorkflowDefinition wd = workflow(t);
    assertEquals(List.of("description"), onlyRule("table", wd).includedFields());
  }

  @Test
  void gatesWhenOneOfMultipleEntityTypesMatches() {
    WorkflowDefinition wd =
        workflow(trigger("\"dashboard\",\"table\"", "\"description\"", "", "{}"));
    assertEquals(1, rulesFor("table", wd).size());
    assertEquals(1, rulesFor("dashboard", wd).size());
    assertTrue(rulesFor("topic", wd).isEmpty());
  }

  @Test
  void plainStringFilterIsUnsupportedAndYieldsNull() {
    // FilterEntityImpl rejects plain (non-object) string filters; the gate must resolve the same.
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\"", "", "\"{\\\"==\\\":[1,1]}\""));
    assertNull(onlyRule("table", wd).filterLogic());
  }

  @Test
  void resolvesPerEntityTypeFilterObject() {
    String t =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"approvalMode\":\"Enforce\",\"entityTypes\":[\"table\"],\"include\":[\"description\"],\"filter\":{\"table\":\"T_LOGIC\",\"default\":\"D_LOGIC\"}}}";
    WorkflowDefinition wd = workflow(t);
    assertEquals("T_LOGIC", onlyRule("table", wd).filterLogic());
  }

  @Test
  void resolvesDefaultFilterWhenEntityTypeAbsent() {
    String t =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"approvalMode\":\"Enforce\",\"entityTypes\":[\"table\"],\"include\":[\"description\"],\"filter\":{\"default\":\"D_LOGIC\"}}}";
    WorkflowDefinition wd = workflow(t);
    assertEquals("D_LOGIC", onlyRule("table", wd).filterLogic());
  }

  @Test
  void resolvesObjectEncodedAsStringFilter() {
    // A per-entity filter object serialized as a JSON-object STRING is still honored.
    WorkflowDefinition wd =
        workflow(
            trigger("\"table\"", "\"description\"", "", "\"{\\\"table\\\":\\\"T_LOGIC\\\"}\""));
    assertEquals("T_LOGIC", onlyRule("table", wd).filterLogic());
  }

  @Test
  void emptyFilterObjectYieldsNullFilterLogic() {
    WorkflowDefinition wd = workflow(trigger("\"table\"", "\"description\"", "", "{}"));
    assertNull(onlyRule("table", wd).filterLogic());
  }

  @Test
  void defaultModeDoesNotGate() {
    String absent =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"entityTypes\":[\"table\"],\"include\":[\"description\"],\"filter\":{}}}";
    String explicit =
        "{\"type\":\"eventBasedEntity\",\"config\":{\"approvalMode\":\"Default\",\"entityTypes\":[\"table\"],\"include\":[\"description\"],\"filter\":{}}}";
    assertTrue(rulesFor("table", workflow(absent)).isEmpty());
    assertTrue(rulesFor("table", workflow(explicit)).isEmpty());
    assertFalse(GovernanceApprovalRegistry.holdsChanges(workflow(absent)));
    assertFalse(GovernanceApprovalRegistry.holdsChanges(workflow(explicit)));
  }

  @Test
  void enforceModeHoldsChangesOnlyOnAnEntityEventTrigger() {
    String periodic = "{\"type\":\"periodicBatchEntity\",\"config\":{\"entityTypes\":[\"table\"]}}";
    assertTrue(
        GovernanceApprovalRegistry.holdsChanges(
            workflow(trigger("\"table\"", "\"description\"", "", "{}"))));
    assertFalse(GovernanceApprovalRegistry.holdsChanges(workflow(periodic)));
    assertFalse(GovernanceApprovalRegistry.holdsChanges(workflow(null)));
  }

  @Test
  void openRequestsAreRecheckedWhileNoRulesAreCached() {
    // A workflow change clears the cached rules; an asset edited before they are read again must
    // still have its open requests re-checked.
    GovernanceApprovalRegistry.invalidate();
    assertTrue(GovernanceApprovalRegistry.mayHaveRules("glossary"));
  }

  @Test
  void enforceModeGatesWhateverNodesTheWorkflowHas() {
    WorkflowDefinition wd =
        workflow(trigger("\"table\"", "\"description\"", "", "{}"), STATUS_NODE);
    assertEquals(1, rulesFor("table", wd).size());
  }

  /**
   * {@link ApprovalGate#admit} against rules resolved from Enforce-mode workflows: which requests are held,
   * that a held request carries every changed field, and which actors are exempt.
   */
  @Nested
  class ApprovalGateAdmission {
    private static final UUID WORKFLOW_A = UUID.randomUUID();
    private static final UUID WORKFLOW_B = UUID.randomUUID();

    private Glossary published() {
      return new Glossary()
          .withId(UUID.randomUUID())
          .withName("g")
          .withFullyQualifiedName("g")
          .withDisplayName("published name")
          .withDescription("published")
          .withVersion(0.1);
    }

    @SuppressWarnings("rawtypes")
    private final EntityRepository glossaryRepository = mock(EntityRepository.class);

    @Test
    void stageChangeIsHeldLikeAnyField() {
      Glossary original = published().withEntityStatus(EntityStatus.APPROVED);
      Glossary updated = edited(original).withEntityStatus(EntityStatus.DEPRECATED);
      StagedChange change =
          admitAsHuman(List.of(rule(WORKFLOW_A, List.of(), List.of())), original, updated)
              .orElseThrow();
      assertEquals(Set.of("entityStatus"), gatedFields(change));
    }

    @Test
    void stageMoveTheLifecycleCannotMakeIsRefusedBeforeHolding() {
      Glossary original = published().withEntityStatus(EntityStatus.APPROVED);
      Glossary updated = edited(original).withEntityStatus(EntityStatus.DRAFT);
      doThrow(new BadRequestException("no move from Approved to Draft"))
          .when(glossaryRepository)
          .validateEntityStatusMove(
              EntityStatus.APPROVED.toString(), EntityStatus.DRAFT.toString());
      assertThrows(
          BadRequestException.class,
          () -> admitAsHuman(List.of(rule(WORKFLOW_A, List.of(), List.of())), original, updated));
    }

    @Test
    void editWithoutAStageKeepsTheStageItIsIn() {
      Glossary original = published().withEntityStatus(EntityStatus.APPROVED);
      Glossary updated = edited(original).withEntityStatus(null).withDescription("new");
      StagedChange change =
          admitAsHuman(List.of(rule(WORKFLOW_A, List.of(), List.of())), original, updated)
              .orElseThrow();
      assertEquals(Set.of("description"), gatedFields(change));
    }

    private Glossary edited(Glossary original) {
      return JsonUtils.deepCopy(original, Glossary.class);
    }

    private GatingRule rule(UUID workflowId, List<String> include, List<String> exclude) {
      return new GatingRule(workflowId, "wf-" + workflowId, include, exclude, null);
    }

    private Optional<StagedChange> admit(
        List<GatingRule> rules,
        Glossary original,
        Glossary updated,
        String user,
        String impersonatedBy,
        boolean userIsBot) {
      return withRules(
          rules,
          user,
          userIsBot,
          () -> ApprovalGate.admit(original, updated, user, impersonatedBy));
    }

    private Optional<StagedChange> preview(
        List<GatingRule> rules, Glossary original, Glossary updated) {
      return withRules(
          rules, "alice", false, () -> ApprovalGate.preview(original, updated, "alice"));
    }

    private Optional<StagedChange> withRules(
        List<GatingRule> rules,
        String user,
        boolean userIsBot,
        Supplier<Optional<StagedChange>> gate) {
      try (MockedStatic<GovernanceApprovalRegistry> registry =
              mockStatic(GovernanceApprovalRegistry.class);
          MockedStatic<Entity> entity = mockStatic(Entity.class)) {
        registry
            .when(() -> GovernanceApprovalRegistry.gatingRules(Entity.GLOSSARY))
            .thenReturn(rules);
        entity.when(() -> Entity.getEntityTypeFromObject(any())).thenReturn(Entity.GLOSSARY);
        entity
            .when(() -> Entity.getEntityRepository(Entity.GLOSSARY))
            .thenReturn(glossaryRepository);
        when(glossaryRepository.getEntityLifecycle()).thenReturn(EntityLifecycle.GENERAL);
        entity
            .when(() -> Entity.findByNameOrNull(eq(Entity.USER), eq(user), any()))
            .thenReturn(new User().withName(user).withIsBot(userIsBot));
        return gate.get();
      }
    }

    private Optional<StagedChange> admitAsHuman(
        List<GatingRule> rules, Glossary original, Glossary updated) {
      return admit(rules, original, updated, "alice", null, false);
    }

    private static Set<String> fields(StagedChange change) {
      return MutationPlanner.fieldsOf(change.ops());
    }

    private static Set<String> gatedFields(StagedChange change) {
      return change.ops().stream()
          .filter(op -> Boolean.TRUE.equals(op.getGated()))
          .map(MutationOp::getField)
          .collect(Collectors.toSet());
    }

    @Test
    void gatedFieldChangeIsHeld() {
      Glossary original = published();
      Glossary updated = edited(original).withDescription("proposed");
      StagedChange change =
          admitAsHuman(
                  List.of(rule(WORKFLOW_A, List.of("description"), List.of())), original, updated)
              .orElseThrow();
      assertEquals(Set.of("description"), fields(change));
      assertEquals(WORKFLOW_A, change.workflowDefinitionId());
      assertEquals("alice", change.requestedBy());
      assertEquals(original.getId(), change.entityId());
    }

    @Test
    void ungatedOnlyChangePublishes() {
      Glossary original = published();
      Glossary updated = edited(original).withDisplayName("new name");
      assertTrue(
          admitAsHuman(
                  List.of(rule(WORKFLOW_A, List.of("description"), List.of())), original, updated)
              .isEmpty());
    }

    @Test
    void noHookWorkflowMeansNothingIsHeld() {
      Glossary original = published();
      Glossary updated = edited(original).withDescription("proposed");
      assertTrue(admitAsHuman(List.of(), original, updated).isEmpty());
    }

    @Test
    void newEntityIsNeverHeld() {
      Glossary updated = published().withDescription("proposed");
      assertTrue(
          admitAsHuman(List.of(rule(WORKFLOW_A, List.of("description"), List.of())), null, updated)
              .isEmpty());
    }

    @Test
    void heldRequestCarriesEveryChangedFieldIncludingIdentityAndLifecycle() {
      Glossary original = published().withEntityStatus(EntityStatus.APPROVED);
      Glossary updated =
          edited(original)
              .withDescription("proposed")
              .withDisplayName("new name")
              .withName("renamed")
              .withEntityStatus(EntityStatus.DRAFT);
      StagedChange change =
          admitAsHuman(
                  List.of(rule(WORKFLOW_A, List.of("description"), List.of())), original, updated)
              .orElseThrow();
      assertEquals(Set.of("description", "displayName", "entityStatus", "name"), fields(change));
      assertEquals(Set.of("description"), gatedFields(change));
    }

    @Test
    void emptyIncludeGatesEveryFieldNotExcluded() {
      Glossary original = published();
      Glossary updated = edited(original).withDisplayName("new name");
      List<GatingRule> rules = List.of(rule(WORKFLOW_A, List.of(), List.of("description")));
      assertEquals(
          Set.of("displayName"), gatedFields(admitAsHuman(rules, original, updated).orElseThrow()));
      Glossary descriptionOnly = edited(original).withDescription("proposed");
      assertTrue(admitAsHuman(rules, original, descriptionOnly).isEmpty());
    }

    @Test
    void customPropertyIsGatedPerProperty() {
      Glossary original = published().withExtension(Map.of("other", "kept"));
      List<GatingRule> rules = List.of(rule(WORKFLOW_A, List.of("extension.gated"), List.of()));

      Glossary gatedProperty =
          edited(original).withExtension(Map.of("other", "kept", "gated", "x"));
      assertEquals(
          Set.of("extension"),
          gatedFields(admitAsHuman(rules, original, gatedProperty).orElseThrow()));

      Glossary otherProperty = edited(original).withExtension(Map.of("other", "changed"));
      assertTrue(admitAsHuman(rules, original, otherProperty).isEmpty());
    }

    @Test
    void wholeExtensionIncludeGatesAnyCustomProperty() {
      Glossary original = published().withExtension(Map.of("a", "1"));
      Glossary updated = edited(original).withExtension(Map.of("a", "2"));
      assertTrue(
          admitAsHuman(
                  List.of(rule(WORKFLOW_A, List.of("extension"), List.of())), original, updated)
              .isPresent());
    }

    @Test
    void excludedCustomPropertyIsNotGated() {
      Glossary original = published().withExtension(Map.of("free", "1", "held", "1"));
      List<GatingRule> rules = List.of(rule(WORKFLOW_A, List.of(), List.of("extension.free")));
      Glossary freeOnly = edited(original).withExtension(Map.of("free", "2", "held", "1"));
      assertTrue(admitAsHuman(rules, original, freeOnly).isEmpty());
      Glossary heldToo = edited(original).withExtension(Map.of("free", "2", "held", "2"));
      assertTrue(admitAsHuman(rules, original, heldToo).isPresent());
    }

    @Test
    void removingACustomPropertyIsAChange() {
      Glossary original = published().withExtension(Map.of("gated", "x"));
      Glossary updated = edited(original).withExtension(Map.of());
      assertTrue(
          admitAsHuman(
                  List.of(rule(WORKFLOW_A, List.of("extension.gated"), List.of())),
                  original,
                  updated)
              .isPresent());
    }

    @Test
    void changeGatedByTwoWorkflowsIsRejected() {
      Glossary original = published();
      Glossary updated = edited(original).withDescription("proposed").withDisplayName("new name");
      List<GatingRule> rules =
          List.of(
              rule(WORKFLOW_A, List.of("description"), List.of()),
              rule(WORKFLOW_B, List.of("displayName"), List.of()));
      BadRequestException error =
          assertThrows(BadRequestException.class, () -> admitAsHuman(rules, original, updated));
      assertTrue(error.getMessage().contains("different approval workflows"), error.getMessage());
    }

    @Test
    void requestIsReviewedByTheWorkflowGatingItsFields() {
      Glossary original = published();
      Glossary updated = edited(original).withDisplayName("new name");
      List<GatingRule> rules =
          List.of(
              rule(WORKFLOW_A, List.of("description"), List.of()),
              rule(WORKFLOW_B, List.of("displayName"), List.of()));
      assertEquals(
          WORKFLOW_B, admitAsHuman(rules, original, updated).orElseThrow().workflowDefinitionId());
    }

    @Test
    void botChangeIsNotHeld() {
      Glossary original = published();
      Glossary updated = edited(original).withDescription("by bot");
      assertTrue(
          admit(
                  List.of(rule(WORKFLOW_A, List.of("description"), List.of())),
                  original,
                  updated,
                  "ingestion-bot",
                  null,
                  true)
              .isEmpty());
    }

    @Test
    void workflowAutomationIsNotHeld() {
      Glossary original = published();
      Glossary updated = edited(original).withDescription("by workflow");
      assertTrue(
          admit(
                  List.of(rule(WORKFLOW_A, List.of("description"), List.of())),
                  original,
                  updated,
                  "alice",
                  "governance-bot",
                  false)
              .isEmpty());
    }

    @Test
    void botImpersonatingAHumanIsHeldAsThatHuman() {
      Glossary original = published();
      Glossary updated = edited(original).withDescription("by bot for alice");
      StagedChange change =
          admit(
                  List.of(rule(WORKFLOW_A, List.of("description"), List.of())),
                  original,
                  updated,
                  "alice",
                  "mcp-bot",
                  false)
              .orElseThrow();
      assertEquals("alice", change.requestedBy());
      assertEquals("mcp-bot", change.impersonatedBy());
    }

    @Test
    void gateTimesAdmissionButLeavesHeldEditsToSubmission() {
      SimpleMeterRegistry meters = new SimpleMeterRegistry();
      Metrics.addRegistry(meters);
      try {
        Glossary original = published();
        Glossary updated = edited(original).withDescription("proposed");
        List<GatingRule> enforcing = List.of(rule(WORKFLOW_A, List.of("description"), List.of()));

        admitAsHuman(enforcing, original, updated);
        preview(enforcing, original, updated);

        // A held edit is counted when its change request commits (ChangeRequestService.submit).
        assertEquals(0, admissions(meters, "held"));
        assertEquals(
            1,
            meters
                .get("change_request_admission_latency")
                .tags("entityType", Entity.GLOSSARY)
                .timer()
                .count());
      } finally {
        Metrics.removeRegistry(meters);
      }
    }

    @Test
    void ungatedEditIsTimedButNotCountedAsAnAdmission() {
      SimpleMeterRegistry meters = new SimpleMeterRegistry();
      Metrics.addRegistry(meters);
      try {
        Glossary original = published();
        admitAsHuman(
            List.of(rule(WORKFLOW_A, List.of("description"), List.of())),
            original,
            edited(original).withDisplayName("new name"));
        assertEquals(0, admissions(meters, "held"));
      } finally {
        Metrics.removeRegistry(meters);
      }
    }

    private double admissions(SimpleMeterRegistry meters, String outcome) {
      var counter =
          meters
              .find("change_request_admission")
              .tags("entityType", Entity.GLOSSARY, "outcome", outcome)
              .counter();
      return counter == null ? 0 : counter.count();
    }

    @Test
    void previewDecidesExactlyLikeAdmission() {
      Glossary original = published();
      List<GatingRule> rules = List.of(rule(WORKFLOW_A, List.of("description"), List.of()));
      Glossary gated = edited(original).withDescription("proposed");
      StagedChange previewed = preview(rules, original, gated).orElseThrow();
      StagedChange admitted = admitAsHuman(rules, original, gated).orElseThrow();
      assertEquals(admitted.workflowDefinitionId(), previewed.workflowDefinitionId());
      assertEquals(fields(admitted), fields(previewed));
      assertEquals(gatedFields(admitted), gatedFields(previewed));
      Glossary ungated = edited(original).withDisplayName("new name");
      assertTrue(preview(rules, original, ungated).isEmpty());
    }

    @Test
    void unchangedValuesAndBookkeepingAreNotChanges() {
      Glossary original = published();
      Glossary updated =
          edited(original).withVersion(0.2).withUpdatedAt(42L).withUpdatedBy("alice");
      assertTrue(
          admitAsHuman(List.of(rule(WORKFLOW_A, List.of(), List.of())), original, updated)
              .isEmpty());
    }
  }
}
