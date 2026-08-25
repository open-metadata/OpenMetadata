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
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
 * contributes a rule only when it (1) uses an {@code eventBasedEntity} trigger (edit-driven; periodic
 * and no-op triggers cannot gate an interactive edit), (2) targets the entity type, and (3) actually
 * holds the change behind a human approval task. Reactive workflows that merely set tags, notify, or
 * run a pipeline have no approval node and never hold a field. Each rule mirrors the trigger's own
 * field selection: the {@code include} fields (opt-in), the {@code exclude} fields (used when
 * {@code include} is empty, so an empty {@code include} holds every changed trigger field except
 * those excluded), and the workflow's entity {@code filter}, honored at hold time so a field is not
 * held for an entity the workflow would skip.
 *
 * <p>Results are cached with a short TTL so the hot write path does not list workflow definitions on
 * every update; the cache is bounded. Any resolution failure yields no rules, so the gate stays a
 * no-op and never blocks a write.
 */
@Slf4j
public final class GovernanceApprovalRegistry {
  private static final String EVENT_BASED_ENTITY = "eventBasedEntity";
  private static final String RESOLVE_PENDING_CHANGE_SUBTYPE = "resolvePendingChangeTask";

  private static final Cache<String, List<GatingRule>> RULES_BY_ENTITY_TYPE =
      Caffeine.newBuilder().maximumSize(1000).expireAfterWrite(Duration.ofSeconds(60)).build();

  private GovernanceApprovalRegistry() {}

  /**
   * A workflow's field-gating rule for one entity type, mirroring the {@code eventBasedEntity}
   * trigger's own field logic (see {@link WorkflowTriggerFilters}). {@code includedFields} (if
   * non-empty) are the exact trigger fields gated; otherwise every changed trigger field except
   * {@code excludedFields} is gated. {@code filterLogic} is the entity-specific JsonLogic resolved
   * for this entity type - if it matches at hold time, the entity is excluded and nothing is held.
   */
  public record GatingRule(
      List<String> includedFields, List<String> excludedFields, String filterLogic) {}

  public static List<GatingRule> gatingRules(String entityType) {
    return RULES_BY_ENTITY_TYPE.get(entityType, GovernanceApprovalRegistry::compute);
  }

  public static void invalidate() {
    RULES_BY_ENTITY_TYPE.invalidateAll();
  }

  /**
   * True when the workflow carries a resolvePendingChangeTask hook (i.e. it holds approval-gated
   * changes). Lets per-requester behavior such as task supersede apply only to hook workflows,
   * leaving reactive workflows on their existing entity-level behavior.
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

  /**
   * Name overload of {@link #isPendingChangeWorkflow(UUID)} for callers that hold the workflow's
   * name (e.g. resolved from a running process definition key) rather than its id. Returns false for
   * an unknown name so a resolution miss leaves behavior unchanged.
   */
  public static boolean isPendingChangeWorkflow(String workflowName) {
    boolean result = false;
    if (workflowName != null && !workflowName.isBlank()) {
      WorkflowDefinition definition =
          Entity.findByNameOrNull(Entity.WORKFLOW_DEFINITION, workflowName, Include.NON_DELETED);
      result = definition != null && hasPendingChangeHook(definition);
    }
    return result;
  }

  private static List<GatingRule> compute(String entityType) {
    List<GatingRule> rules = new ArrayList<>();
    try {
      for (WorkflowDefinition definition : listWorkflowDefinitions()) {
        addRule(entityType, definition, rules);
      }
    } catch (Exception e) {
      LOG.debug("Could not resolve gating rules for '{}'; treating as ungated: {}", entityType, e);
      rules.clear();
    }
    return List.copyOf(rules);
  }

  @SuppressWarnings("unchecked")
  private static List<WorkflowDefinition> listWorkflowDefinitions() {
    EntityRepository<WorkflowDefinition> repository =
        (EntityRepository<WorkflowDefinition>)
            Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    return repository.listAll(Fields.EMPTY_FIELDS, new ListFilter(Include.NON_DELETED));
  }

  static void addRule(String entityType, WorkflowDefinition definition, List<GatingRule> rules) {
    JsonNode trigger = JsonUtils.valueToTree(definition.getTrigger());
    boolean eventBased = EVENT_BASED_ENTITY.equals(trigger.path("type").asText(null));
    JsonNode config = trigger.path("config");
    if (eventBased && targetsEntityType(config, entityType) && hasPendingChangeHook(definition)) {
      List<String> includedFields = stringList(config.path("include"));
      List<String> excludedFields = stringList(config.path("exclude"));
      String filterLogic = resolveFilter(config, entityType);
      rules.add(new GatingRule(includedFields, excludedFields, filterLogic));
    }
  }

  // A workflow only holds a change if it opts in by placing a resolvePendingChange hook node (which
  // applies the change on approval or discards it). Workflows without the hook - reactive ones that
  // auto-tag, notify, or run pipelines - never hold; the edit persists normally and they react as
  // usual. The hook's presence is the opt-in signal.
  private static boolean hasPendingChangeHook(WorkflowDefinition definition) {
    boolean hasHook = false;
    for (JsonNode node : JsonUtils.valueToTree(definition.getNodes())) {
      if (RESOLVE_PENDING_CHANGE_SUBTYPE.equals(node.path("subType").asText(null))) {
        hasHook = true;
        break;
      }
    }
    return hasHook;
  }

  private static boolean targetsEntityType(JsonNode config, String entityType) {
    boolean targets = entityType.equals(config.path("entityType").asText(null));
    for (JsonNode node : config.path("entityTypes")) {
      if (targets) {
        break;
      }
      targets = entityType.equals(node.asText(null));
    }
    return targets;
  }

  private static List<String> stringList(JsonNode array) {
    List<String> values = new ArrayList<>();
    for (JsonNode field : array) {
      values.add(field.asText());
    }
    return values;
  }

  // Resolve the entity-specific JsonLogic through the SAME extractor the trigger uses, so the gate
  // and the trigger agree on which entities the filter excludes. config.filter is a JsonNode here;
  // decode it once to the raw value (String or Map) the shared extractor expects.
  private static String resolveFilter(JsonNode config, String entityType) {
    JsonNode filter = config.path("filter");
    Object value =
        filter.isMissingNode() || filter.isNull()
            ? null
            : JsonUtils.treeToValue(filter, Object.class);
    return WorkflowTriggerFilters.extractEntitySpecificFilter(value, entityType);
  }
}
