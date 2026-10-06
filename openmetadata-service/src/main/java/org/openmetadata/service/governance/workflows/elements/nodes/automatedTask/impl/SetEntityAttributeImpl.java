package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityFieldUtils;

@Slf4j
public class SetEntityAttributeImpl implements JavaDelegate {
  private Expression fieldNameExpr;
  private Expression fieldValueExpr;
  private Expression inputNamespaceMapExpr;
  private Expression batchExecutionExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      InputNamespaces inputNamespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
      FieldUpdate update = fieldUpdate(execution, varHandler, inputNamespaces);
      Optional<List<String>> batch =
          BatchEntities.read(batchExecutionExpr, execution, varHandler, inputNamespaces);
      if (batch.isPresent()) {
        BatchEntities.apply(
                execution.getCurrentActivityId(),
                batch.get(),
                entityLink -> setEntityField(entityOf(entityLink), entityLink, update))
            .record(varHandler, inputNamespaces, batch.get());
      } else {
        setRelatedEntityField(varHandler, inputNamespaces, update);
      }
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private static void setRelatedEntityField(
      WorkflowVariableHandler varHandler, InputNamespaces inputNamespaces, FieldUpdate update) {
    String relatedEntityValue =
        (String)
            varHandler.getNamespacedVariable(
                inputNamespaces.namespaceFor(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);
    setEntityField(
        varHandler.getRelatedEntity(entityLink, "*", Include.ALL), relatedEntityValue, update);
  }

  private FieldUpdate fieldUpdate(
      DelegateExecution execution,
      WorkflowVariableHandler varHandler,
      InputNamespaces inputNamespaces) {
    String fieldName = fieldNameExpr != null ? (String) fieldNameExpr.getValue(execution) : "";

    String fieldValue = null;
    if (fieldValueExpr != null) {
      Object value = fieldValueExpr.getValue(execution);
      if (value != null && !value.toString().isEmpty()) {
        fieldValue = value.toString();
      }
    }

    String updatedByNamespace = inputNamespaces.namespaceFor(UPDATED_BY_VARIABLE);
    String actualUser =
        Optional.ofNullable(updatedByNamespace)
            .map(ns -> (String) varHandler.getNamespacedVariable(ns, UPDATED_BY_VARIABLE))
            .orElse(null);
    return new FieldUpdate(fieldName, fieldValue, actualUser);
  }

  private static EntityInterface entityOf(String entityLink) {
    return Entity.getEntity(MessageParser.EntityLink.parse(entityLink), "*", Include.ALL);
  }

  private static void setEntityField(
      EntityInterface entity, String entityLinkValue, FieldUpdate update) {
    String entityType = MessageParser.EntityLink.parse(entityLinkValue).getEntityType();
    // fieldValue==null clears the field. When we have an acting user, preserve it and mark
    // governance-bot as impersonator; otherwise attribute the write to governance-bot directly.
    if (update.actualUser() != null && !update.actualUser().isEmpty()) {
      EntityFieldUtils.setEntityField(
          entity,
          entityType,
          update.actualUser(),
          update.fieldName(),
          update.fieldValue(),
          true,
          "governance-bot");
    } else {
      EntityFieldUtils.setEntityField(
          entity,
          entityType,
          "governance-bot",
          update.fieldName(),
          update.fieldValue(),
          true,
          null);
    }
  }

  /** The field a node sets, the value it sets it to, and the user it acts for, if any. */
  private record FieldUpdate(String fieldName, String fieldValue, String actualUser) {}
}
