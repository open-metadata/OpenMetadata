package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.FALSE_ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_FALSE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_TRUE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TRUE_ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import io.github.resilience4j.retry.Retry;
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
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.util.FieldChangeValueExtractor;

@Slf4j
public class CheckChangeDescriptionTaskImpl implements JavaDelegate {
  private Expression conditionExpr;
  private Expression rulesExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      List<String> entityList =
          WorkflowVariableHandler.getEntityList(inputNamespaceMap, varHandler);
      List<String> trueEntityList = new ArrayList<>();
      List<String> falseEntityList = new ArrayList<>();

      Map<String, EntityInterface> entityMap =
          Entity.getEntitiesByLinks(entityList, "*", Include.ALL);

      Retry retry = Retry.of("check-change-description", Workflow.TASK_RETRY_CONFIG);

      for (String entityLinkStr : entityList) {
        EntityInterface entity = entityMap.get(entityLinkStr);
        if (entity == null) {
          falseEntityList.add(entityLinkStr);
          continue;
        }
        try {
          boolean passes =
              Retry.decorateSupplier(
                      retry, () -> checkChangeDescription(execution, entity, entityLinkStr))
                  .get();
          if (passes) {
            trueEntityList.add(entityLinkStr);
          } else {
            falseEntityList.add(entityLinkStr);
          }
        } catch (Exception e) {
          falseEntityList.add(entityLinkStr);
          LOG.error(
              "[{}] Failed entity '{}' after retries: {}",
              getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
              entityLinkStr,
              e.getMessage(),
              e);
        }
      }

      varHandler.setNodeVariable(TRUE_ENTITY_LIST_VARIABLE, trueEntityList);
      varHandler.setNodeVariable(FALSE_ENTITY_LIST_VARIABLE, falseEntityList);
      varHandler.setNodeVariable(HAS_TRUE_ENTITIES_VARIABLE, !trueEntityList.isEmpty());
      varHandler.setNodeVariable(
          HAS_FALSE_ENTITIES_VARIABLE, !falseEntityList.isEmpty() || entityList.isEmpty());
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private boolean checkChangeDescription(
      DelegateExecution execution, EntityInterface entity, String entityLinkStr) {
    // No changeDescription means it's a create event - return true
    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription == null) {
      LOG.debug("No changeDescription found (likely a create event), returning true");
      return true;
    }

    // Parse config
    String condition = "OR"; // default
    if (conditionExpr != null && conditionExpr.getValue(execution) != null) {
      condition = (String) conditionExpr.getValue(execution);
    }

    Map<String, List<String>> rules = null;
    if (rulesExpr != null && rulesExpr.getValue(execution) != null) {
      rules = JsonUtils.readOrConvertValue(rulesExpr.getValue(execution), Map.class);
    }

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
