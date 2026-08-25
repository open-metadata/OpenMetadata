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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.ResolvePendingChangeAction;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.WorkflowTriggerFields;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ApprovalGate;
import org.openmetadata.service.governance.approval.PendingApprovalChangeStore;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.tags.TagLabelUtil;

/**
 * Workflow hook node that resolves the approval-gated change held for the related entity. {@code
 * apply} rebuilds the proposed entity from the held diff and persists it as the governance bot (the
 * one point a real ChangeEvent is emitted; the write is not re-gated). {@code discard} leaves the
 * approved values in place. Both clear the hold. Place it where the workflow decides the outcome.
 */
@Slf4j
public class ResolvePendingChangeImpl implements JavaDelegate {
  private Expression actionExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      InputNamespaces inputNamespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
      String relatedEntityNamespace = inputNamespaces.namespaceFor(RELATED_ENTITY_VARIABLE);
      String relatedEntityValue =
          (String)
              varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);
      EntityInterface entity = varHandler.getRelatedEntity(entityLink, "*", Include.ALL);

      ResolvePendingChangeAction action =
          ResolvePendingChangeAction.fromValue((String) actionExpr.getValue(execution));
      resolveHold(entityLink.getEntityType(), entity, action, resolveRequester(varHandler));
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private void resolveHold(
      String entityType,
      EntityInterface entity,
      ResolvePendingChangeAction action,
      String requester) {
    // The hold is keyed by the requester (the editor who made it). Without that key we cannot
    // locate the correct hold, so we must not read/commit/delete under a wrong key - that would
    // drop the user's held edit. Surface loudly and leave the hold untouched instead.
    if (requester == null || requester.isBlank()) {
      LOG.error(
          "[ResolvePendingChange] no requester (global updatedBy) on the workflow; cannot resolve "
              + "the held change for {} (action={})",
          entity.getId(),
          action);
      return;
    }
    // Snapshot the hold with the version token it was read at. commit and discard delete only this
    // snapshot, so an edit the requester accumulated after this read survives for its own review.
    PendingApprovalChangeStore.HeldRecord record =
        PendingApprovalChangeStore.getRecord(entity.getId(), requester);
    ChangeDescription held = record == null ? null : record.change();
    long seenUpdatedAt = record == null ? 0L : record.updatedAt();
    LOG.debug(
        "[ResolvePendingChange] action={} entity={} requester={} hasHold={}",
        action,
        entity.getId(),
        requester,
        record != null);
    switch (action) {
      case COMMIT -> commitHeldChange(entityType, entity, held, requester, seenUpdatedAt);
      case DISCARD -> PendingApprovalChangeStore.deleteIfUnchanged(
          entity.getId(), requester, seenUpdatedAt);
      case HOLD -> {
        // Leave the change on hold; the workflow is parking it (e.g. after 'In Review').
      }
    }
  }

  private void commitHeldChange(
      String entityType,
      EntityInterface entity,
      ChangeDescription held,
      String requester,
      long seenUpdatedAt) {
    if (held != null) {
      applyHeldChange(entityType, entity, held, requester);
    }
    PendingApprovalChangeStore.deleteIfUnchanged(entity.getId(), requester, seenUpdatedAt);
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private void applyHeldChange(
      String entityType, EntityInterface original, ChangeDescription held, String author) {
    ObjectNode node = (ObjectNode) JsonUtils.valueToTree(original);
    for (FieldChange fieldChange : CommonUtil.listOrEmpty(held.getFieldsUpdated())) {
      if (WorkflowTriggerFields.TAGS.value().equals(fieldChange.getName())) {
        node.set(
            WorkflowTriggerFields.TAGS.value(),
            JsonUtils.valueToTree(resolveTags(original, fieldChange)));
      } else {
        node.set(fieldChange.getName(), JsonUtils.valueToTree(fieldChange.getNewValue()));
      }
    }
    EntityInterface proposed = JsonUtils.readValue(JsonUtils.pojoToJson(node), original.getClass());
    JsonPatch patch = JsonUtils.getJsonPatch(original, proposed);
    EntityRepository repository = Entity.getEntityRepository(entityType);
    // Apply as the change's author (a real user, not the bot) so the field-level bot-deny guards do
    // not silently strip held fields the governance bot may not edit; record the governance bot as
    // the actor via impersonatedBy. Exempt from the gate so this commit is never re-held.
    ApprovalGate.applyExemptFromGate(
        () -> repository.patch(null, original.getId(), author, patch, null, GOVERNANCE_BOT));
  }

  // Merge the held tags into the entity's current tags with the held change taking precedence, so a
  // tag another approved change has added since the hold (mutually exclusive with a held tag) is
  // dropped rather than throwing at persist and failing this workflow node. Non-conflicting current
  // tags are preserved. The held tags are already internally consistent - the gate rejects a
  // mutually-exclusive pair at edit time before holding.
  private List<TagLabel> resolveTags(EntityInterface original, FieldChange heldTagsChange) {
    List<TagLabel> heldTags =
        JsonUtils.convertValue(
            heldTagsChange.getNewValue(), new TypeReference<List<TagLabel>>() {});
    return TagLabelUtil.mergeTagsWithIncomingPrecedence(original.getTags(), heldTags);
  }

  // Flowable stores process variables as untyped Object; the pending-change trigger sets updatedBy
  // (the editor who made the held change) as a String in the global namespace. That editor is the
  // key the hold was stored under, so it is required to resolve the hold; returns null when absent.
  private String resolveRequester(WorkflowVariableHandler varHandler) {
    Object updatedBy = varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE);
    String requester = null;
    if (updatedBy instanceof String editor && !editor.isBlank()) {
      requester = editor;
    }
    return requester;
  }
}
