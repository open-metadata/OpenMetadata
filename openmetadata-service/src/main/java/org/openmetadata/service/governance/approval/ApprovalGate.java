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

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.PENDING_HELD_CHANGE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.WorkflowTriggerFields;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry.GatingRule;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.elements.triggers.WorkflowTriggerFilters;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.tags.TagLabelUtil;

/**
 * Holds approval-gated field edits out of the entity. When a workflow that opts in (has a
 * resolvePendingChange hook) gates a changed field for the entity type and its {@code filter} does
 * not exclude the entity, the gate reverts each gated field to its approved value (so nothing gated
 * persists and no ChangeEvent fires) and records the proposed values as a pending hold. After the
 * write commits, the governing workflow is triggered directly by signal to review the held change;
 * the hook applies it on approval and discards it on rejection.
 *
 * <p>Field selection mirrors the {@code eventBasedEntity} trigger exactly (see {@link
 * org.openmetadata.service.governance.workflows.elements.triggers.WorkflowTriggerFilters}): a changed
 * top-level field is held when it is a trigger field passing the rule's {@code include}/{@code
 * exclude}, so the gate and the trigger never disagree on what a workflow acts on. Identity and
 * lifecycle fields (see {@link #STRUCTURAL_DENYLIST}) are never held, and a field the request only
 * omits (null) is not mistaken for a change. Edits made by the governance bot (the workflow applying
 * an approved change) are never re-gated. Fails open: any error lets the edit persist.
 */
@Slf4j
public final class ApprovalGate {
  private static final ThreadLocal<HeldTrigger> PENDING_TRIGGER = new ThreadLocal<>();
  private static final ThreadLocal<Boolean> APPLYING_APPROVED_CHANGE = new ThreadLocal<>();

  private ApprovalGate() {}

  private record HeldTrigger(
      String entityType,
      String entityFqn,
      String entityId,
      String user,
      ChangeDescription heldChange) {}

  /**
   * Runs {@code apply} - the write that commits an already-approved held change - with the gate
   * suspended on this thread, so re-applying the change cannot be re-held into an infinite loop. The
   * commit runs synchronously on the caller's thread, so the entity write reaches {@link
   * #stageAndHold} on the same thread and observes this flag. Lets the hook apply the change as its
   * original author (not a bot), which the field-level bot-deny guards would otherwise strip.
   */
  public static void applyExemptFromGate(Runnable apply) {
    APPLYING_APPROVED_CHANGE.set(Boolean.TRUE);
    try {
      apply.run();
    } finally {
      APPLYING_APPROVED_CHANGE.remove();
    }
  }

  public static void stageAndHold(EntityInterface original, EntityInterface updated, String user) {
    PENDING_TRIGGER.remove();
    if (isGateApplicable(user, original, updated)) {
      // The gate reverts gated tags before the entity updater validates mutual exclusivity, so a
      // conflicting pair would be held and only surface when the review workflow commits it. Reject
      // it here - at the edit - instead. Runs before the fail-open below so the conflict propagates
      // as a bad request rather than being swallowed and written.
      rejectMutuallyExclusiveGatedTags(updated);
      try {
        holdIfGated(original, updated, user);
      } catch (Exception e) {
        // Fail open: the gate must never break a write. On any error the edit persists normally.
        LOG.error("[ApprovalGate] Failed to hold gated change; writing normally", e);
        PENDING_TRIGGER.remove();
      }
    }
  }

  // When a pending-change rule gates this entity's tags, validate the proposed tags for mutual
  // exclusivity up front - the entity updater's own check runs against the reverted (empty) tags and
  // would miss a held conflict. Resolution errors fall through (the updater still validates a
  // non-held edit); only a genuine conflict throws, rejecting the edit.
  private static void rejectMutuallyExclusiveGatedTags(EntityInterface updated) {
    boolean tagsGated = false;
    try {
      String entityType = Entity.getEntityTypeFromObject(updated);
      for (GatingRule rule : GovernanceApprovalRegistry.gatingRules(entityType)) {
        if (!WorkflowTriggerFilters.matchesExclusionFilter(rule.filterLogic(), updated)
            && WorkflowTriggerFilters.fieldTriggers(
                WorkflowTriggerFields.TAGS.value(),
                rule.includedFields(),
                rule.excludedFields())) {
          tagsGated = true;
        }
      }
    } catch (Exception e) {
      LOG.debug("[ApprovalGate] Could not resolve tag gating for the mutual-exclusivity check", e);
      tagsGated = false;
    }
    if (tagsGated) {
      TagLabelUtil.checkMutuallyExclusive(updated.getTags());
    }
  }

  public static void submitPending(EntityInterface entity, String user) {
    HeldTrigger trigger = PENDING_TRIGGER.get();
    try {
      if (trigger != null) {
        triggerReviewWorkflow(trigger);
      }
    } catch (Exception e) {
      LOG.error("[ApprovalGate] Failed to trigger review workflow for '{}'", entity.getId(), e);
    } finally {
      PENDING_TRIGGER.remove();
    }
  }

  private static boolean isGateApplicable(
      String user, EntityInterface original, EntityInterface updated) {
    return !Boolean.TRUE.equals(APPLYING_APPROVED_CHANGE.get())
        && !GOVERNANCE_BOT.equals(user)
        && original != null
        && updated != null
        && original.getId() != null;
  }

  // Fields that are never held even when a rule would gate them: identity/lifecycle fields whose
  // value the gate must not revert. Holding `name`/`fullyQualifiedName` would leave the entity's
  // identity inconsistent (FQN is recomputed in prepare() before the gate runs); holding `deleted`
  // would silently defeat a restore-via-PUT (see EntityRepository#updateInternal); `entityStatus`
  // is
  // the workflow's own domain and must never be captured as a user edit.
  private static final Set<String> STRUCTURAL_DENYLIST =
      Set.of(
          WorkflowTriggerFields.NAME.value(),
          WorkflowTriggerFields.FULLY_QUALIFIED_NAME.value(),
          WorkflowTriggerFields.DELETED.value(),
          WorkflowTriggerFields.ENTITY_STATUS.value());

  private static void holdIfGated(EntityInterface original, EntityInterface updated, String user) {
    String entityType = Entity.getEntityTypeFromObject(updated);
    List<GatingRule> rules = GovernanceApprovalRegistry.gatingRules(entityType);
    if (!rules.isEmpty()) {
      ObjectNode originalNode = (ObjectNode) JsonUtils.valueToTree(original);
      ObjectNode updatedNode = (ObjectNode) JsonUtils.valueToTree(updated);
      Set<String> gatedFields = selectGatedFields(rules, updated, originalNode, updatedNode);
      List<FieldChange> held = holdGatedFields(originalNode, updatedNode, updated, gatedFields);
      if (!held.isEmpty()) {
        LOG.debug(
            "[ApprovalGate] {} held {} field(s) for {}", entityType, held.size(), original.getId());
        ChangeDescription heldChange = recordHold(original, held, user);
        PENDING_TRIGGER.set(
            new HeldTrigger(
                entityType,
                updated.getFullyQualifiedName(),
                original.getId().toString(),
                user,
                heldChange));
      }
    }
  }

  // Mirror the eventBasedEntity trigger's own field selection (WorkflowTriggerFilters): a field is
  // gated when it actually changed, is holdable, is a trigger field passing the rule's
  // include/exclude, and the rule's entity filter does not exclude this entity.
  private static Set<String> selectGatedFields(
      List<GatingRule> rules,
      EntityInterface entity,
      ObjectNode originalNode,
      ObjectNode updatedNode) {
    Set<String> changed = changedHoldableFields(originalNode, updatedNode);
    Set<String> gated = new HashSet<>();
    for (GatingRule rule : rules) {
      if (!WorkflowTriggerFilters.matchesExclusionFilter(rule.filterLogic(), entity)) {
        addRuleGatedFields(rule, changed, gated);
      }
    }
    return gated;
  }

  private static void addRuleGatedFields(GatingRule rule, Set<String> changed, Set<String> gated) {
    for (String field : changed) {
      if (WorkflowTriggerFilters.fieldTriggers(
          field, rule.includedFields(), rule.excludedFields())) {
        gated.add(field);
      }
    }
  }

  // A top-level field is holdable when the request provides a concrete new value that differs from
  // the approved one. Skipping null/absent new values keeps a PUT that merely omits a field
  // (owners,
  // tags - merged additively later by the updater) from being mistaken for an intentional change.
  private static Set<String> changedHoldableFields(
      ObjectNode originalNode, ObjectNode updatedNode) {
    Set<String> changed = new HashSet<>();
    Iterator<String> fieldNames = updatedNode.fieldNames();
    while (fieldNames.hasNext()) {
      String name = fieldNames.next();
      JsonNode newValue = updatedNode.get(name);
      if (!STRUCTURAL_DENYLIST.contains(name)
          && newValue != null
          && !newValue.isNull()
          && !Objects.equals(originalNode.get(name), newValue)) {
        changed.add(name);
      }
    }
    return changed;
  }

  private static List<FieldChange> holdGatedFields(
      ObjectNode originalNode,
      ObjectNode updatedNode,
      EntityInterface updated,
      Set<String> gatedFields) {
    ObjectNode revert = JsonUtils.getObjectMapper().createObjectNode();
    List<FieldChange> held = new ArrayList<>();
    for (String field : gatedFields) {
      JsonNode oldValue = originalNode.get(field);
      held.add(
          new FieldChange()
              .withName(field)
              .withOldValue(oldValue)
              .withNewValue(updatedNode.get(field)));
      revert.set(field, oldValue == null ? NullNode.getInstance() : oldValue);
    }
    if (!held.isEmpty()) {
      revertInPlace(updated, revert);
    }
    return held;
  }

  private static void revertInPlace(EntityInterface updated, ObjectNode revert) {
    try {
      JsonUtils.getObjectMapper().readerForUpdating(updated).readValue(revert);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to revert held fields on entity", e);
    }
  }

  // Records this edit's held fields into the requester's accumulating store record and returns the
  // single-edit change so the trigger raised below can review exactly this edit, not the accumulation.
  private static ChangeDescription recordHold(
      EntityInterface original, List<FieldChange> held, String user) {
    ChangeDescription pending =
        new ChangeDescription().withPreviousVersion(original.getVersion()).withFieldsUpdated(held);
    PendingApprovalChangeStore.accumulate(original.getId(), user, pending);
    return pending;
  }

  private static void triggerReviewWorkflow(HeldTrigger trigger) {
    String signal = "%s-%s".formatted(trigger.entityType(), EventType.ENTITY_UPDATED.toString());
    MessageParser.EntityLink entityLink =
        new MessageParser.EntityLink(trigger.entityType(), trigger.entityFqn());
    Map<String, Object> variables = new LinkedHashMap<>();
    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
        entityLink.getLinkString());
    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_ID_VARIABLE),
        trigger.entityId());
    variables.put(getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE), trigger.user());
    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, PENDING_HELD_CHANGE_VARIABLE),
        JsonUtils.pojoToJson(trigger.heldChange()));
    WorkflowHandler.getInstance().triggerWithSignal(signal, variables);
  }
}
