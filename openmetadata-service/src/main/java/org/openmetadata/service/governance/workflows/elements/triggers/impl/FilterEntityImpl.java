package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TRIGGERING_OBJECT_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger.PASSES_FILTER_VARIABLE;

import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.service.governance.approval.ChangeRequestRun;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry;
import org.openmetadata.service.governance.approval.ReviewPhase;
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
        TriggerEntityFilter.forEntityType(
            filterExpr != null ? filterExpr.getValue(execution) : null, entityType);

    ChangeRequestRun changeRequest = ChangeRequestRun.from(varHandler).orElse(null);
    boolean passesFilter;
    if (isTagFeedbackCreation(varHandler)) {
      // We skip the entity filtering for this special case
      passesFilter = true;
    } else if (changeRequest != null) {
      // A change-request run was admitted at submission with the reviewing workflow's own
      // include/exclude/filter; only that workflow runs it and every other hook workflow on the
      // entity type ignores it.
      passesFilter = mainWorkflowName(execution).equals(changeRequest.workflowName());
    } else {
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
      passesFilter =
          passesExcludedFilter(entity, entityType, excludedFilter, includeFields, filterLogic)
              && startsReviewRun(execution, entity);
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

  private String mainWorkflowName(DelegateExecution execution) {
    String key = WorkflowHandler.getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    return key != null && key.endsWith("Trigger")
        ? TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(key)
        : String.valueOf(key);
  }

  // A hold workflow reviews an asset from its change events only until the asset's first approval,
  // and keeps one review open for it meanwhile (see ReviewPhase).
  private boolean startsReviewRun(DelegateExecution execution, EntityInterface entity) {
    String workflowName = mainWorkflowName(execution);
    return !GovernanceApprovalRegistry.isPendingChangeWorkflow(workflowName)
        || ReviewPhase.startsReview(workflowName, entity);
  }

  private boolean passesExcludedFilter(
      EntityInterface entity,
      String entityType,
      List<String> excludedFilter,
      List<String> includeFields,
      String filterLogic) {
    // A null change description means a Create event.
    ChangeDescription change = entity.getChangeDescription();

    boolean fieldBasedFilter;
    if (change == null) {
      fieldBasedFilter = true;
    } else {
      List<FieldChange> changedFields = getAllChangedFields(change);
      fieldBasedFilter =
          changedFields.isEmpty()
              || passesFieldBasedFilter(entityType, changedFields, includeFields, excludedFilter);
    }

    return fieldBasedFilter && !TriggerEntityFilter.excludes(filterLogic, entity);
  }

  private List<FieldChange> getAllChangedFields(ChangeDescription changeDescription) {
    List<FieldChange> allChanges = new ArrayList<>(listOrEmpty(changeDescription.getFieldsAdded()));
    allChanges.addAll(listOrEmpty(changeDescription.getFieldsDeleted()));
    allChanges.addAll(listOrEmpty(changeDescription.getFieldsUpdated()));
    return allChanges;
  }

  private boolean passesFieldBasedFilter(
      String entityType,
      List<FieldChange> changedFields,
      List<String> includeFields,
      List<String> excludedFilter) {
    // A change fires the workflow when it touches one of this entity type's trigger fields,
    // subject to include/exclude (see WorkflowTriggerFilters).
    return changedFields.stream()
        .anyMatch(
            field ->
                WorkflowTriggerFilters.fieldTriggers(
                    entityType, field.getName(), includeFields, excludedFilter));
  }
}
