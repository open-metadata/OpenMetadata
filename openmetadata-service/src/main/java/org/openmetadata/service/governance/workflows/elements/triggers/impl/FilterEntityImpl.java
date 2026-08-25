package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.PENDING_HELD_CHANGE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TRIGGERING_OBJECT_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger.PASSES_FILTER_VARIABLE;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.governance.workflows.elements.triggers.WorkflowTriggerFilters;
import org.openmetadata.service.jdbi3.RecognizerFeedbackRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FilterEntityImpl implements JavaDelegate {
  private static final Logger log = LoggerFactory.getLogger(FilterEntityImpl.class);
  private Expression excludedFieldsExpr;
  private Expression includeFieldsExpr;
  private Expression filterExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    List<String> excludedFilter = null;
    if (excludedFieldsExpr != null && excludedFieldsExpr.getValue(execution) != null) {
      excludedFilter =
          JsonUtils.readOrConvertValue(excludedFieldsExpr.getValue(execution), List.class);
    }

    List<String> includeFields = null;
    if (includeFieldsExpr != null && includeFieldsExpr.getValue(execution) != null) {
      includeFields =
          JsonUtils.readOrConvertValue(includeFieldsExpr.getValue(execution), List.class);
    }

    String entityLinkStr =
        (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);

    // eventBasedEntity triggers get relatedEntity from the change event that started them; a
    // null value here means the trigger was invoked without one (e.g. the manual trigger REST
    // endpoint for a workflow type that expects an event context). Short-circuit with
    // passesFilter=false so the workflow does not advance, instead of NPE'ing in the parser.
    if (entityLinkStr == null || entityLinkStr.isBlank()) {
      log.debug(
          "Trigger {} - no relatedEntity in variables; skipping",
          WorkflowHandler.getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()));
      execution.setVariable(PASSES_FILTER_VARIABLE, false);
      return;
    }

    // Parse entity type from entity link to determine which filter to use
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    String entityType = entityLink.getEntityType();

    // Extract entity-specific filter
    String filterLogic =
        WorkflowTriggerFilters.extractEntitySpecificFilter(
            filterExpr != null ? filterExpr.getValue(execution) : null, entityType);

    boolean passesFilter;
    if (isTagFeedbackCreation(varHandler)) {
      // We skip the entity filtering for this special case
      passesFilter = true;
    } else {
      // Present only on the signal the gate raises when it holds a change: exactly the fields this
      // one edit held off the entity. Absent for a normal entity change event, where the persisted
      // change description is the change to evaluate. Either way, the accumulated hold (prior edits
      // still pending for this requester) is never folded into the trigger decision.
      ChangeDescription heldChange = readHeldChange(varHandler);
      if (heldChange == null && isPendingChangeWorkflow(execution)) {
        // A pending-change (hook) workflow reviews held changes only. With no held change on this
        // signal there is nothing to review, so a plain persisted-change event must not start it -
        // that would raise an approval task for a change that was never held (an excluded-field
        // edit, or the workflow's own entityStatus write folded into a later edit's change
        // description). Only the gate's held-change signal drives a hook workflow.
        passesFilter = false;
      } else {
        passesFilter =
            passesExcludedFilter(
                entityLinkStr, excludedFilter, includeFields, filterLogic, heldChange);
      }
    }

    // Duplicate-instance supersede is intentionally NOT done here. Deciding "the new event
    // supersedes the old" at trigger time is too early: this filter runs before the workflow
    // evaluates checkChangeDescription/checkEntityAttributes, so a no-op event that passes the
    // entity filter but creates no task would still kill a valid pending approval. The supersede
    // now happens at task-creation time in CreateTask, where the run has genuinely produced a new
    // approval task. See CreateTask#supersedePriorApprovalTask.
    String workflowKey =
        WorkflowHandler.getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    log.debug("Trigger {} - Entity {} passes filter: {}", workflowKey, entityLinkStr, passesFilter);
    execution.setVariable(PASSES_FILTER_VARIABLE, passesFilter);
  }

  private boolean isTagFeedbackCreation(WorkflowVariableHandler varHandler) {
    // If the triggering object is a recognizer and points to the workflow's related entity
    // then this is a feedback creation workflow, and we should let it through

    String entityLinkStr =
        (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);
    // Parse entity type from entity link to determine which filter to use
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);

    if (!Entity.TAG.equals(entityLink.getEntityType())) return false;

    Optional<String> feedbackId =
        Optional.ofNullable(
            (String)
                varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, TRIGGERING_OBJECT_ID_VARIABLE));

    if (feedbackId.isEmpty()) return false;

    RecognizerFeedbackRepository repository =
        new RecognizerFeedbackRepository(Entity.getCollectionDAO());

    RecognizerFeedback feedback;
    try {
      feedback = repository.get(UUID.fromString(feedbackId.get()));
    } catch (EntityNotFoundException ignored) {
      log.info(
          "Triggering object with id {} not found. Related entity link: {}",
          feedbackId.get(),
          entityLinkStr);
      return false;
    }

    return feedback.getTagFQN().equals(entityLink.getEntityFQN());
  }

  // True when the workflow whose trigger is running holds approval-gated changes (has the
  // resolvePendingChange hook). Resolved from the running process definition key: the trigger
  // process is named "<Workflow>Trigger". An unresolved name yields false, so non-hook workflows
  // and any resolution miss keep their normal event-driven behavior.
  private boolean isPendingChangeWorkflow(DelegateExecution execution) {
    String key =
        WorkflowHandler.getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String workflowName =
        key != null && key.endsWith("Trigger")
            ? TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(key)
            : key;
    return GovernanceApprovalRegistry.isPendingChangeWorkflow(workflowName);
  }

  // Flowable process variables are untyped Object; the gate serializes the held change as a JSON
  // String. Absent (a normal change event) or unparseable means "no held change" and the persisted
  // change description is used instead.
  private ChangeDescription readHeldChange(WorkflowVariableHandler varHandler) {
    ChangeDescription heldChange = null;
    Object raw = varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, PENDING_HELD_CHANGE_VARIABLE);
    if (raw instanceof String json && !json.isBlank()) {
      try {
        heldChange = JsonUtils.readValue(json, ChangeDescription.class);
      } catch (Exception e) {
        log.warn("Could not parse held change from trigger signal; using persisted change", e);
      }
    }
    return heldChange;
  }

  private boolean passesExcludedFilter(
      String entityLinkStr,
      List<String> excludedFilter,
      List<String> includeFields,
      String filterLogic,
      ChangeDescription heldChange) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    // Gate path: the held change is exactly this edit's change. Event path: the entity's persisted
    // change description. A null change description means a Create event.
    ChangeDescription change =
        heldChange != null ? heldChange : entity.getChangeDescription();

    boolean fieldBasedFilter;
    if (change == null) {
      fieldBasedFilter = true;
    } else {
      List<FieldChange> changedFields = getAllChangedFields(change);
      fieldBasedFilter =
          changedFields.isEmpty()
              || passesFieldBasedFilter(changedFields, includeFields, excludedFilter);
    }

    // Evaluate the exclusion filter against the proposed entity (this edit's held change applied),
    // so the trigger and the gate judge the same state - the gate ran the filter before reverting.
    Map<String, Object> proposedEntity = proposedEntityMap(entity, heldChange);
    boolean exclusionFilterMatches =
        WorkflowTriggerFilters.matchesExclusionFilter(filterLogic, proposedEntity);
    return fieldBasedFilter && !exclusionFilterMatches;
  }

  // The entity map with this edit's held change applied (updated/added field values overlaid,
  // deleted fields removed), so the exclusion JsonLogic sees the proposed state rather than the
  // reverted persisted one. Returns the persisted map unchanged when there is no held change.
  private Map<String, Object> proposedEntityMap(
      EntityInterface entity, ChangeDescription heldChange) {
    Map<String, Object> entityMap = JsonUtils.getMap(entity);
    if (heldChange != null) {
      for (FieldChange field : getAppliedFields(heldChange)) {
        entityMap.put(field.getName(), field.getNewValue());
      }
      for (FieldChange field : listOrEmpty(heldChange.getFieldsDeleted())) {
        entityMap.remove(field.getName());
      }
    }
    return entityMap;
  }

  private List<FieldChange> getAllChangedFields(ChangeDescription changeDescription) {
    List<FieldChange> allChanges = new ArrayList<>(listOrEmpty(changeDescription.getFieldsAdded()));
    allChanges.addAll(listOrEmpty(changeDescription.getFieldsDeleted()));
    allChanges.addAll(listOrEmpty(changeDescription.getFieldsUpdated()));
    return allChanges;
  }

  private List<FieldChange> getAppliedFields(ChangeDescription changeDescription) {
    List<FieldChange> applied = new ArrayList<>(listOrEmpty(changeDescription.getFieldsAdded()));
    applied.addAll(listOrEmpty(changeDescription.getFieldsUpdated()));
    return applied;
  }

  private boolean passesFieldBasedFilter(
      List<FieldChange> changedFields, List<String> includeFields, List<String> excludedFilter) {
    return changedFields.stream()
        .anyMatch(
            field ->
                WorkflowTriggerFilters.fieldTriggers(
                    field.getName(), includeFields, excludedFilter));
  }
}
