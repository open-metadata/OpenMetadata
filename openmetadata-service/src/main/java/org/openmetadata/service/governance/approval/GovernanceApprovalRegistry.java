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
 * contributes a rule only when it uses an {@code eventBasedEntity} trigger in Enforce approval mode
 * and targets the entity type. Each rule mirrors the trigger's own field selection: the
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
  private static final String APPROVAL_MODE = "approvalMode";
  private static final String ENFORCE_MODE = "Enforce";

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
      String filterLogic) {}

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
  /**
   * False only when the cached rules show no workflow gates the entity type. Without a snapshot,
   * for example right after a workflow changed, it cannot tell, so it answers true.
   */
  public static boolean mayHaveRules(String entityType) {
    Snapshot snapshot = SNAPSHOT.get();
    return snapshot == null || snapshot.rulesByEntityType().containsKey(entityType);
  }

  public static void invalidate() {
    SNAPSHOT.set(null);
  }

  /**
   * Whether the workflow holds edits for approval: an {@code eventBasedEntity} trigger in Enforce
   * approval mode. Any other workflow runs after the edit is published - auto-tag, notify, run
   * pipelines - and never gates it.
   */
  public static boolean holdsChanges(WorkflowDefinition definition) {
    JsonNode trigger = JsonUtils.valueToTree(definition.getTrigger());
    return trigger != null
        && EVENT_BASED_ENTITY.equals(trigger.path("type").asText(null))
        && ENFORCE_MODE.equals(trigger.path("config").path(APPROVAL_MODE).asText(null));
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
    JsonNode config = JsonUtils.valueToTree(definition.getTrigger()).path("config");
    // A suspended workflow reviews nothing, so it holds nothing back.
    boolean active = !Boolean.TRUE.equals(definition.getSuspended());
    if (active && holdsChanges(definition)) {
      for (String entityType : targetEntityTypes(config)) {
        rules
            .computeIfAbsent(entityType, ignored -> new ArrayList<>())
            .add(
                new GatingRule(
                    definition.getId(),
                    definition.getName(),
                    stringList(config.path("include")),
                    stringList(config.path("exclude")),
                    resolveFilter(config, entityType)));
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
