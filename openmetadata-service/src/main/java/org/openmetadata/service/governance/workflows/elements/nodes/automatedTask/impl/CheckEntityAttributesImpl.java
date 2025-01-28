package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class CheckEntityAttributesImpl implements JavaDelegate {
  private Expression rulesExpr;

  @Override
  public void execute(DelegateExecution execution) {
    try {
      String rules = (String) rulesExpr.getValue(execution);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse((String) execution.getVariable(RELATED_ENTITY_VARIABLE));
      execution.setVariable(RESULT_VARIABLE, checkAttributes(entityLink, rules));
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      execution.setVariable(EXCEPTION_VARIABLE, exc.toString());
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private Boolean checkAttributes(MessageParser.EntityLink entityLink, String rules) {
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    JsonLogic jsonLogic = new JsonLogic();
    boolean result = false;

    try {
      result = (boolean) jsonLogic.apply(rules, JsonUtils.getMap(entity));
    } catch (JsonLogicException e) {
      throw new RuntimeException(e);
    }

    return result;
  }
}
