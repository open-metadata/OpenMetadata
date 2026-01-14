package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityFieldUtils;

@Slf4j
public class SetEntityAttributeImpl implements JavaDelegate {
  private Expression fieldNameExpr;
  private Expression fieldValueExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      // Extract entity from workflow context
      Map<String, Object> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      String relatedEntityNamespace = (String) inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
      String relatedEntityValue =
          (String)
              varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);
      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);

      String entityType = entityLink.getEntityType();
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      String fieldName = fieldNameExpr != null ? (String) fieldNameExpr.getValue(execution) : "";

      // Simple null check - if fieldValueExpr is null, treat as empty/null value
      String fieldValue = null;
      if (fieldValueExpr != null) {
        Object value = fieldValueExpr.getValue(execution);
        if (value != null && !value.toString().isEmpty()) {
          fieldValue = value.toString();
        }
      }

      String updatedByNamespace = (String) inputNamespaceMap.get(UPDATED_BY_VARIABLE);
      String actualUser =
          Optional.ofNullable(updatedByNamespace)
              .map(ns -> (String) varHandler.getNamespacedVariable(ns, UPDATED_BY_VARIABLE))
              .orElse(null);

      // Apply the field change using shared utility with bot impersonation
      // Note: fieldValue can be null to clear/remove a field value
      // When actualUser is available, use it as the user and mark 'governance-bot' as impersonator
      // Otherwise, use 'governance-bot' directly (for system-initiated workflows)
      if (actualUser != null && !actualUser.isEmpty()) {
        // User-initiated workflow: preserve actual user, mark bot as impersonator
        EntityFieldUtils.setEntityField(
            entity, entityType, actualUser, fieldName, fieldValue, true, "governance-bot");
      } else {
        // System-initiated workflow: use governance-bot directly
        EntityFieldUtils.setEntityField(
            entity, entityType, "governance-bot", fieldName, fieldValue, true, null);
      }

    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }
}
