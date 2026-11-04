package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

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
import org.openmetadata.service.governance.workflows.EntityStatusWorkflows;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService;
import org.openmetadata.service.jdbi3.TaskRepository;
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
      BatchEntities.applyAction(
          new BatchEntities.NodeExecution(
              batchExecutionExpr, execution, varHandler, inputNamespaces),
          entityLink -> setEntityField(entityOf(entityLink), entityLink, update),
          () -> setRelatedEntityField(varHandler, inputNamespaces, update));
    } catch (BpmnError batchFailure) {
      // Raised by a batch the action failed on entirely, after it recorded the per-entity summary
      // and the first cause in global_exception.
      throw batchFailure;
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
    if (actualUser == null || actualUser.isEmpty()) {
      // The configured namespace had no acting user (e.g. an auto-approved user task was bypassed
      // and set no updatedBy). Use the global editor (the requester) so the write is attributed to
      // a real user with governance-bot as impersonator.
      actualUser = (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE);
    }
    return new FieldUpdate(fieldName, fieldValue, actualUser);
  }

  private static EntityInterface<?> entityOf(String entityLink) {
    return Entity.getEntity(MessageParser.EntityLink.parse(entityLink), "*", Include.ALL);
  }

  private static void setEntityField(
      EntityInterface<?> entity, String entityLinkValue, FieldUpdate update) {
    String entityType = MessageParser.EntityLink.parse(entityLinkValue).getEntityType();
    // fieldValue==null clears the field. With an acting user, attribute the write to that user and
    // mark governance-bot as impersonator; only when no user resolves at all does the write fall to
    // governance-bot directly.
    if (update.actualUser() != null && !update.actualUser().isEmpty()) {
      EntityFieldUtils.setEntityField(
          entity,
          entityType,
          update.actualUser(),
          update.fieldName(),
          update.fieldValue(),
          true,
          GOVERNANCE_BOT);
    } else {
      EntityFieldUtils.setEntityField(
          entity, entityType, GOVERNANCE_BOT, update.fieldName(), update.fieldValue(), true, null);
    }
    if (EntityStatusWorkflows.isStageField(update.fieldName()) && update.fieldValue() != null) {
      // The stage is saved as its EntityStatus, whatever the case and spacing of the value.
      closeRevisionsOutsideStage(
          entity, EntityFieldUtils.parseEntityStatus(update.fieldValue()).value());
    }
  }

  // A Revise and resubmit task asks for changes within one stage; once the workflow moves the
  // asset to another stage it can no longer be resubmitted there.
  private static void closeRevisionsOutsideStage(EntityInterface<?> entity, String stage) {
    new MetadataCollectionService(
            (TaskRepository) Entity.getEntityRepository(Entity.TASK),
            Entity.getEntityReferenceByName(Entity.USER, GOVERNANCE_BOT, Include.NON_DELETED))
        .closeRevisionsOutside(entity, stage);
  }

  /** The field a node sets, the value it sets it to, and the user it acts for, if any. */
  private record FieldUpdate(String fieldName, String fieldValue, String actualUser) {}
}
