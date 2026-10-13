package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

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
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.rules.RuleEngine;

@Slf4j
public class CheckEntityAttributesImpl implements JavaDelegate {
  private Expression rulesExpr;
  private Expression inputNamespaceMapExpr;
  private Expression batchExecutionExpr;
  private Expression batchContinuingOutcomeExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      InputNamespaces inputNamespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
      String rules = (String) rulesExpr.getValue(execution);
      BatchEntities.evaluateCondition(
          new BatchEntities.NodeExecution(
              batchExecutionExpr, execution, varHandler, inputNamespaces),
          batchContinuingOutcomeExpr,
          entityLink -> checkEntity(entityLink, rules),
          () -> checkRelatedEntity(varHandler, inputNamespaces, rules));
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private boolean checkRelatedEntity(
      WorkflowVariableHandler varHandler, InputNamespaces inputNamespaces, String rules) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(
            (String)
                varHandler.getNamespacedVariable(
                    inputNamespaces.namespaceFor(RELATED_ENTITY_VARIABLE),
                    RELATED_ENTITY_VARIABLE));
    EntityInterface entity = varHandler.getRelatedEntity(entityLink, "*", Include.ALL);
    return checkAttributes(entity, rules);
  }

  private boolean checkEntity(String entityLinkValue, String rules) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkValue);
    return checkAttributes(Entity.getEntity(entityLink, "*", Include.ALL), rules);
  }

  private Boolean checkAttributes(EntityInterface entity, String rules) {
    boolean result;
    try {
      result = (boolean) RuleEngine.getInstance().apply(rules, JsonUtils.getMap(entity));
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    return result;
  }
}
