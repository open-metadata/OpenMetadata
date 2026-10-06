package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.governance.workflows.util.FieldChangeValueExtractor;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class CheckChangeDescriptionTaskImpl implements JavaDelegate {
  private Expression conditionExpr;
  private Expression rulesExpr;
  private Expression inputNamespaceMapExpr;
  private Expression batchExecutionExpr;
  private Expression batchContinuingOutcomeExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      InputNamespaces inputNamespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
      Optional<List<String>> batch =
          BatchEntities.read(batchExecutionExpr, execution, varHandler, inputNamespaces);
      if (batch.isPresent()) {
        checkBatch(execution, varHandler, inputNamespaces, batch.get());
      } else {
        checkRelatedEntity(execution, varHandler, inputNamespaces);
      }
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private void checkRelatedEntity(
      DelegateExecution execution,
      WorkflowVariableHandler varHandler,
      InputNamespaces inputNamespaces) {
    String entityLinkStr =
        (String)
            varHandler.getNamespacedVariable(
                inputNamespaces.namespaceFor(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);

    boolean result = checkChangeDescription(changeRules(execution), entityLinkStr);
    varHandler.setNodeVariable(RESULT_VARIABLE, result);
  }

  private void checkBatch(
      DelegateExecution execution,
      WorkflowVariableHandler varHandler,
      InputNamespaces inputNamespaces,
      List<String> entityLinks) {
    ChangeRules changeRules = changeRules(execution);
    BatchEntities.ConditionOutcome outcome =
        BatchEntities.evaluate(
            execution.getCurrentActivityId(),
            entityLinks,
            BatchEntities.continuingOutcome(batchContinuingOutcomeExpr, execution),
            entityLink -> checkChangeDescription(changeRules, entityLink));
    outcome.record(varHandler, inputNamespaces, entityLinks);
    varHandler.setNodeVariable(RESULT_VARIABLE, outcome.result());
  }

  /** The node's condition and rules, read from the execution on the job thread. */
  private record ChangeRules(String condition, Map<String, List<String>> rules) {}

  private ChangeRules changeRules(DelegateExecution execution) {
    String condition = "OR"; // default
    if (conditionExpr != null && conditionExpr.getValue(execution) != null) {
      condition = (String) conditionExpr.getValue(execution);
    }
    Map<String, List<String>> rules = null;
    if (rulesExpr != null && rulesExpr.getValue(execution) != null) {
      rules = JsonUtils.readOrConvertValue(rulesExpr.getValue(execution), Map.class);
    }
    return new ChangeRules(condition, rules);
  }

  private boolean checkChangeDescription(ChangeRules changeRules, String entityLinkStr) {
    // Parse entity
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    EntityInterface entity = Entity.getEntity(entityLink, "", Include.ALL);

    // No changeDescription means it's a create event - return true
    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription == null) {
      LOG.debug("No changeDescription found (likely a create event), returning true");
      return true;
    }

    String condition = changeRules.condition();
    Map<String, List<String>> rules = changeRules.rules();

    // If no rules specified, return true
    if (rules == null || rules.isEmpty()) {
      LOG.debug("No rules specified, returning true");
      return true;
    }

    // Collect all changed fields
    List<FieldChange> allChanges = new ArrayList<>();
    allChanges.addAll(changeDescription.getFieldsAdded());
    allChanges.addAll(changeDescription.getFieldsUpdated());
    allChanges.addAll(changeDescription.getFieldsDeleted());

    // Check fields based on condition (AND/OR)
    boolean result;
    if ("AND".equals(condition)) {
      result = checkAllFieldsMatch(allChanges, rules);
    } else {
      result = checkAnyFieldMatches(allChanges, rules);
    }

    LOG.debug(
        "CheckChangeDescription result: {} for entity: {} with condition: {}",
        result,
        entityLinkStr,
        condition);
    return result;
  }

  private boolean checkAllFieldsMatch(List<FieldChange> changes, Map<String, List<String>> rules) {
    for (Map.Entry<String, List<String>> entry : rules.entrySet()) {
      String fieldName = entry.getKey();
      List<String> patterns = entry.getValue();

      boolean fieldMatches =
          changes.stream()
              .filter(change -> change.getName().equals(fieldName))
              .anyMatch(change -> matchesAnyPattern(change, patterns));

      if (!fieldMatches) {
        return false;
      }
    }
    return true;
  }

  private boolean checkAnyFieldMatches(List<FieldChange> changes, Map<String, List<String>> rules) {
    return changes.stream()
        .anyMatch(
            change -> {
              String fieldName = change.getName();
              List<String> patterns = rules.get(fieldName);
              if (patterns == null || patterns.isEmpty()) {
                return false;
              }
              return matchesAnyPattern(change, patterns);
            });
  }

  private boolean matchesAnyPattern(FieldChange change, List<String> patterns) {
    String fieldValue = extractFieldValue(change);
    if (fieldValue == null) {
      LOG.debug("Could not extract value for field '{}', skipping pattern match", change.getName());
      return false;
    }

    return patterns.stream()
        .filter(pattern -> pattern != null && !pattern.isEmpty())
        .anyMatch(fieldValue::contains);
  }

  private String extractFieldValue(FieldChange change) {
    return FieldChangeValueExtractor.extractFieldValueForMatching(change);
  }
}
