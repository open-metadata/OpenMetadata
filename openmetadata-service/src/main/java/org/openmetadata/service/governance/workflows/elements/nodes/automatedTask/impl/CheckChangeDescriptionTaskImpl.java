package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.service.governance.workflows.util.FieldChangeValueExtractor;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class CheckChangeDescriptionTaskImpl implements JavaDelegate {
  private Expression conditionExpr;
  private Expression includeFieldsExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      String entityLinkStr =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);

      boolean result = checkChangeDescription(execution, entityLinkStr);
      varHandler.setNodeVariable(RESULT_VARIABLE, result);
    } catch (Exception exc) {
      log.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private boolean checkChangeDescription(DelegateExecution execution, String entityLinkStr) {
    // Parse entity
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    // No changeDescription means it's a create event - return true
    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription == null) {
      log.debug("No changeDescription found (likely a create event), returning true");
      return true;
    }

    // Parse config
    String condition = "OR"; // default
    if (conditionExpr != null && conditionExpr.getValue(execution) != null) {
      condition = (String) conditionExpr.getValue(execution);
    }

    Map<String, List<String>> includeFields = null;
    if (includeFieldsExpr != null && includeFieldsExpr.getValue(execution) != null) {
      includeFields =
          JsonUtils.readOrConvertValue(includeFieldsExpr.getValue(execution), Map.class);
    }

    // If no include fields specified, return true
    if (includeFields == null || includeFields.isEmpty()) {
      log.debug("No include fields specified, returning true");
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
      // ALL specified fields must match
      result = checkAllFieldsMatch(allChanges, includeFields, entity);
    } else {
      // ANY specified field matches (OR)
      result = checkAnyFieldMatches(allChanges, includeFields, entity);
    }

    log.debug(
        "CheckChangeDescription result: {} for entity: {} with condition: {}",
        result,
        entityLinkStr,
        condition);
    return result;
  }

  private boolean checkAllFieldsMatch(
      List<FieldChange> changes, Map<String, List<String>> includeFields, EntityInterface entity) {
    // For AND: all fields in includeFields must be present in changes and match
    for (Map.Entry<String, List<String>> entry : includeFields.entrySet()) {
      String fieldName = entry.getKey();
      List<String> patterns = entry.getValue();

      boolean fieldMatches =
          changes.stream()
              .filter(change -> change.getName().equals(fieldName))
              .anyMatch(change -> matchesAnyPattern(change, patterns, entity));

      if (!fieldMatches) {
        return false; // One field doesn't match, AND fails
      }
    }
    return true; // All fields matched
  }

  private boolean checkAnyFieldMatches(
      List<FieldChange> changes, Map<String, List<String>> includeFields, EntityInterface entity) {
    // For OR: any field in changes that's in includeFields and matches its pattern
    return changes.stream()
        .anyMatch(
            change -> {
              String fieldName = change.getName();
              List<String> patterns = includeFields.get(fieldName);
              if (patterns == null || patterns.isEmpty()) {
                return false; // Field not in include list
              }
              return matchesAnyPattern(change, patterns, entity);
            });
  }

  private boolean matchesAnyPattern(
      FieldChange change, List<String> patterns, EntityInterface entity) {
    String fieldValue = extractFieldValue(change, entity);
    if (fieldValue == null) {
      return false;
    }

    // Check if fieldValue contains any of the patterns
    return patterns.stream().anyMatch(pattern -> fieldValue.contains(pattern));
  }

  private String extractFieldValue(FieldChange change, EntityInterface entity) {
    return FieldChangeValueExtractor.extractFieldValueForMatching(change, entity);
  }
}
