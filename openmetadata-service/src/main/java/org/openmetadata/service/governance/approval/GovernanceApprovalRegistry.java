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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

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
 * <p>Rules are held in one snapshot. A workflow change made on this server replaces it at once; each
 * server also re-validates it against the workflow-definition epoch (row count and latest update)
 * at most every few seconds, so a workflow created or changed on another server gates here within
 * that interval. Resolution failures refuse the write rather than letting it publish ungated.
 */
@Slf4j
public final class GovernanceApprovalRegistry {
  private static final String EVENT_BASED_ENTITY = "eventBasedEntity";
  private static final String RESOLVE_PENDING_CHANGE_SUBTYPE = "resolvePendingChangeTask";
  private static final String SHADOW_MODE = "Shadow";

  // Each server re-reads the stored workflow definitions at most this often, so an ordinary write
  // does not query them. A workflow change made on this server applies at once (invalidate()).
  private static final long RECHECK_MILLIS = 5_000L;

  private record Snapshot(
      String epoch, long checkedAt, Map<String, List<GatingRule>> rulesByEntityType) {}

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

  // A workflow only gates a change if it opts in by placing a resolvePendingChange hook node.
  // Reactive workflows - auto-tag, notify, run pipelines - never gate.
  public static boolean hasPendingChangeHook(WorkflowDefinition definition) {
    return listOrEmpty(definition.getNodes()).stream()
        .anyMatch(node -> RESOLVE_PENDING_CHANGE_SUBTYPE.equals(node.getSubType()));
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
    Snapshot snapshot = SNAPSHOT.get();
    long now = System.currentTimeMillis();
    if (snapshot == null || now - snapshot.checkedAt() >= RECHECK_MILLIS) {
      String epoch = Entity.getCollectionDAO().changeRequestDAO().workflowDefinitionEpoch();
      snapshot =
          snapshot != null && snapshot.epoch().equals(epoch)
              ? new Snapshot(epoch, now, snapshot.rulesByEntityType())
              : new Snapshot(epoch, now, compute());
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
    // A suspended workflow reviews nothing, so it holds nothing back.
    boolean active = !Boolean.TRUE.equals(definition.getSuspended());
    if (eventBased && active && hasPendingChangeHook(definition)) {
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
