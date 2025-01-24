package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.PAYLOAD;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import io.github.jamsesso.jsonlogic.JsonLogic;
import io.github.jamsesso.jsonlogic.JsonLogicException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class JsonLogicFilterImpl implements JavaDelegate {
  private Expression rulesExpr;

  @Override
  public void execute(DelegateExecution execution) {
    try {
      // TODO why is 'rulesExpr' not passed as a variable?
      String rules = (String) rulesExpr.getValue(execution);
      String payload = (String) execution.getVariable("payload");
      List<ChangeEvent> filtered =
          JsonUtils.readObjects(payload, ChangeEvent.class).stream()
              .filter(
                  ce -> {
                    EntityInterface entity =
                        Entity.getEntity(ce.getEntityType(), ce.getEntityId(), "*", Include.ALL);
                    return checkAttributes(rules, entity);
                  })
              .toList();

      execution.setVariable(PAYLOAD, JsonUtils.pojoToJson(filtered));
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      execution.setVariable(EXCEPTION_VARIABLE, exc.toString());
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private Boolean checkAttributes(String rules, EntityInterface entity) {
    JsonLogic jsonLogic = new JsonLogic();
    try {
      return (boolean) jsonLogic.apply(rules, JsonUtils.getMap(entity));
    } catch (JsonLogicException e) {
      throw new RuntimeException(e);
    }
  }
}
