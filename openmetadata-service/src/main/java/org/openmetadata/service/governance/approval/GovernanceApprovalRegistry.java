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

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ServiceUnavailableException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.elements.triggers.WorkflowTriggerFilters;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Resolves the field-gating rules for an entity type from deployed governance workflows. A workflow
 * contributes a rule only when it uses an {@code eventBasedEntity} trigger, targets the entity type,
 * and carries a resolvePendingChange hook. Each rule mirrors the trigger's own field selection: the
 * {@code include} fields (opt-in), the {@code exclude} fields (used when {@code include} is empty),
 * and the workflow's entity {@code filter}.
 *
 * <p>Rules are held in one snapshot validated against the workflow-definition epoch (row count and
 * latest update) on every call, so a workflow created or changed on another node gates here on the
 * next write. Resolution failures refuse the write rather than letting it publish ungated.
 */
@Slf4j
public final class GovernanceApprovalRegistry {
  private static final String EVENT_BASED_ENTITY = "eventBasedEntity";
  private static final String RESOLVE_PENDING_CHANGE_SUBTYPE = "resolvePendingChangeTask";
  private static final String SHADOW_MODE = "Shadow";

  private record Snapshot(String epoch, Map<String, List<GatingRule>> rulesByEntityType) {}

  private static final AtomicReference<Snapshot> SNAPSHOT = new AtomicReference<>();

  private GovernanceApprovalRegistry() {}

  /**
   * A workflow's field-gating rule for one entity type, mirroring the {@code eventBasedEntity}
   * trigger's own field logic (see {@link WorkflowTriggerFilters}). {@code filterLogic} is the
   * entity-specific JsonLogic resolved for this entity type; when it matches, the entity is excluded.
   */
  public record GatingRule(
      UUID workflowDefinitionId,
      String workflowName,
      List<String> includedFields,
      List<String> excludedFields,
      String filterLogic,
      boolean shadow) {
    /** An enforcing rule: gated edits are held for review. */
    public GatingRule(
        UUID workflowDefinitionId,
        String workflowName,
        List<String> includedFields,
        List<String> excludedFields,
        String filterLogic) {
      this(workflowDefinitionId, workflowName, includedFields, excludedFields, filterLogic, false);
    }
  }

  /** Hook workflows gating this entity type, ordered by workflow name. */
  public static List<GatingRule> gatingRules(String entityType) {
    // Before the server wires its DAOs (and in DAO-less unit tests) no workflow can exist yet; a
    // failure to resolve rules once running still refuses the write below.
    if (Entity.getCollectionDAO() == null) {
      return List.of();
    }
    try {
      return currentSnapshot().rulesByEntityType().getOrDefault(entityType, List.of());
    } catch (RuntimeException e) {
      LOG.error("[ApprovalGate] Could not resolve approval rules for {}", entityType, e);
      throw new ServiceUnavailableException(
          "Approval rules are unavailable; the change was not saved. Retry shortly.");
    }
  }

  /**
   * Whether the most recently resolved rules gate {@code entityType}, without querying workflow
   * definitions. Used on hot write paths; admission and review always resolve rules afresh.
   */
  public static boolean hasCachedRules(String entityType) {
    Snapshot snapshot = SNAPSHOT.get();
    return snapshot != null && snapshot.rulesByEntityType().containsKey(entityType);
  }

  public static void invalidate() {
    SNAPSHOT.set(null);
  }

  /**
   * True when the workflow carries a resolvePendingChangeTask hook. Lets per-requester behavior such
   * as task supersede apply only to hook workflows, leaving reactive workflows unchanged.
   */
  public static boolean isPendingChangeWorkflow(UUID workflowDefinitionId) {
    boolean result = false;
    if (workflowDefinitionId != null) {
      try {
        WorkflowDefinition definition =
            Entity.getEntity(
                Entity.WORKFLOW_DEFINITION, workflowDefinitionId, "", Include.NON_DELETED);
        result = hasPendingChangeHook(definition);
      } catch (Exception e) {
        LOG.debug(
            "Could not resolve workflow definition {} for pending-change check: {}",
            workflowDefinitionId,
            e.getMessage());
      }
    }
    return result;
  }

  /** Name overload of {@link #isPendingChangeWorkflow(UUID)}; false for an unknown name. */
  public static boolean isPendingChangeWorkflow(String workflowName) {
    boolean result = false;
    if (workflowName != null && !workflowName.isBlank()) {
      WorkflowDefinition definition =
          Entity.findByNameOrNull(Entity.WORKFLOW_DEFINITION, workflowName, Include.NON_DELETED);
      result = definition != null && hasPendingChangeHook(definition);
    }
    return result;
  }

  // A workflow only gates a change if it opts in by placing a resolvePendingChange hook node.
  // Reactive workflows - auto-tag, notify, run pipelines - never gate.
  public static boolean hasPendingChangeHook(WorkflowDefinition definition) {
    boolean hasHook = false;
    for (JsonNode node : JsonUtils.valueToTree(definition.getNodes())) {
      hasHook = hasHook || RESOLVE_PENDING_CHANGE_SUBTYPE.equals(node.path("subType").asText(null));
    }
    return hasHook;
  }

  public static List<String> targetEntityTypes(JsonNode config) {
    List<String> types = new ArrayList<>(stringList(config.path("entityTypes")));
    String single = config.path("entityType").asText(null);
    if (single != null && !types.contains(single)) {
      types.add(single);
    }
    return types;
  }

  private static Snapshot currentSnapshot() {
    String epoch = Entity.getCollectionDAO().changeRequestDAO().workflowDefinitionEpoch();
    Snapshot snapshot = SNAPSHOT.get();
    if (snapshot == null || !snapshot.epoch().equals(epoch)) {
      snapshot = new Snapshot(epoch, compute());
      SNAPSHOT.set(snapshot);
    }
    return snapshot;
  }

  private static Map<String, List<GatingRule>> compute() {
    Map<String, List<GatingRule>> rules = new HashMap<>();
    listWorkflowDefinitions().stream()
        .sorted(Comparator.comparing(WorkflowDefinition::getName))
        .forEach(definition -> addRules(definition, rules));
    Map<String, List<GatingRule>> frozen = new HashMap<>();
    rules.forEach((entityType, list) -> frozen.put(entityType, List.copyOf(list)));
    return Map.copyOf(frozen);
  }

  @SuppressWarnings("unchecked")
  private static List<WorkflowDefinition> listWorkflowDefinitions() {
    EntityRepository<WorkflowDefinition> repository =
        (EntityRepository<WorkflowDefinition>)
            Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    return repository.listAll(Fields.EMPTY_FIELDS, new ListFilter(Include.NON_DELETED));
  }

  static void addRules(WorkflowDefinition definition, Map<String, List<GatingRule>> rules) {
    JsonNode trigger = JsonUtils.valueToTree(definition.getTrigger());
    JsonNode config = trigger.path("config");
    boolean eventBased = EVENT_BASED_ENTITY.equals(trigger.path("type").asText(null));
    if (eventBased && hasPendingChangeHook(definition)) {
      for (String entityType : targetEntityTypes(config)) {
        rules
            .computeIfAbsent(entityType, ignored -> new ArrayList<>())
            .add(
                new GatingRule(
                    definition.getId(),
                    definition.getName(),
                    stringList(config.path("include")),
                    stringList(config.path("exclude")),
                    resolveFilter(config, entityType),
                    SHADOW_MODE.equals(config.path("approvalMode").asText(null))));
      }
    }
  }

  private static List<String> stringList(JsonNode array) {
    List<String> values = new ArrayList<>();
    for (JsonNode field : array) {
      values.add(field.asText());
    }
    return values;
  }

  // Resolve the entity-specific JsonLogic through the same extractor the trigger uses, so the gate
  // and the trigger agree on which entities the filter excludes.
  private static String resolveFilter(JsonNode config, String entityType) {
    JsonNode filter = config.path("filter");
    Object value =
        filter.isMissingNode() || filter.isNull()
            ? null
            : JsonUtils.treeToValue(filter, Object.class);
    return WorkflowTriggerFilters.extractEntitySpecificFilter(value, entityType);
  }
}
