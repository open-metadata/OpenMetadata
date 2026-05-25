package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.FALSE_ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_FALSE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_TRUE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TRUE_ENTITY_LIST_VARIABLE;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.rules.RuleEngine;

@Slf4j
public class CheckEntityAttributesImpl implements JavaDelegate {
  private Expression rulesExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      String rules = (String) rulesExpr.getValue(execution);

      List<String> entityList =
          WorkflowVariableHandler.getEntityList(inputNamespaceMap, varHandler);
      List<String> trueEntityList = new ArrayList<>();
      List<String> falseEntityList = new ArrayList<>();

      Map<String, EntityInterface> entityMap =
          Entity.getEntitiesByLinks(entityList, "*", Include.ALL);

      for (String entityLinkStr : entityList) {
        EntityInterface entity = entityMap.get(entityLinkStr);
        if (entity == null) {
          falseEntityList.add(entityLinkStr);
          continue;
        }
        try {
          boolean passes =
              (boolean) RuleEngine.getInstance().apply(rules, JsonUtils.getMap(entity));
          if (passes) {
            trueEntityList.add(entityLinkStr);
          } else {
            falseEntityList.add(entityLinkStr);
          }
        } catch (Exception e) {
          falseEntityList.add(entityLinkStr);
          LOG.error(
              "[{}] Failed to evaluate rules for entity '{}': {}",
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
}
