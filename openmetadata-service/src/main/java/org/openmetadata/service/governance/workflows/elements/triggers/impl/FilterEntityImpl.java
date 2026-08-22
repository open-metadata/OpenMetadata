package org.openmetadata.service.governance.workflows.elements.triggers.impl;

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
import org.openmetadata.service.governance.approval.PendingApprovalChangeStore;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
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
      passesFilter =
          passesExcludedFilter(entityLinkStr, excludedFilter, includeFields, filterLogic);
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

  private boolean passesExcludedFilter(
      String entityLinkStr,
      List<String> excludedFilter,
      List<String> includeFields,
      String filterLogic) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    boolean fieldBasedFilter;
    Optional<ChangeDescription> oChangeDescription =
        Optional.ofNullable(PendingApprovalChangeStore.effective(entity));

    // ChangeDescription is empty means it is a Create event.
    if (oChangeDescription.isEmpty()) {
      fieldBasedFilter = true;
    } else {
      ChangeDescription changeDescription = oChangeDescription.get();
      List<FieldChange> changedFields = getAllChangedFields(changeDescription);

      fieldBasedFilter =
          changedFields.isEmpty()
              || passesFieldBasedFilter(changedFields, includeFields, excludedFilter);
    }

    return fieldBasedFilter && !WorkflowTriggerFilters.matchesExclusionFilter(filterLogic, entity);
  }

  private List<FieldChange> getAllChangedFields(ChangeDescription changeDescription) {
    List<FieldChange> allChanges = new ArrayList<>(changeDescription.getFieldsAdded());
    allChanges.addAll(changeDescription.getFieldsDeleted());
    allChanges.addAll(changeDescription.getFieldsUpdated());
    return allChanges;
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
