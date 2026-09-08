package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

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
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.rules.RuleEngine;

@Slf4j
public class CheckEntityAttributesImpl implements JavaDelegate {
  static final String OUTPUT_PORTS_COUNT = "outputPortsCount";
  static final String ASSETS_COUNT = "assetsCount";

  private Expression rulesExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      InputNamespaces inputNamespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
      String rules = (String) rulesExpr.getValue(execution);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaces.namespaceFor(RELATED_ENTITY_VARIABLE),
                      RELATED_ENTITY_VARIABLE));
      varHandler.setNodeVariable(RESULT_VARIABLE, checkAttributes(varHandler, entityLink, rules));
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private Boolean checkAttributes(
      WorkflowVariableHandler varHandler, MessageParser.EntityLink entityLink, String rules) {
    EntityInterface entity = varHandler.getRelatedEntity(entityLink, "*", Include.ALL);
    Map<String, Object> entityMap = JsonUtils.getMap(entity);
    enrichTransientCounts(entityLink.getEntityType(), entity, entityMap);

    boolean result;
    try {
      result = (boolean) RuleEngine.getInstance().apply(rules, entityMap);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    return result;
  }

  private void enrichTransientCounts(
      String entityType, EntityInterface entity, Map<String, Object> entityMap) {
    if (!DATA_PRODUCT.equals(entityType)) {
      return;
    }
    var relationshipDAO = Entity.getCollectionDAO().relationshipDAO();
    int outputPortsCount =
        relationshipDAO.countFindTo(
            entity.getId(), DATA_PRODUCT, List.of(Relationship.OUTPUT_PORT.ordinal()));
    int assetsCount =
        relationshipDAO.countFindTo(
            entity.getId(), DATA_PRODUCT, List.of(Relationship.HAS.ordinal()));
    entityMap.put(OUTPUT_PORTS_COUNT, outputPortsCount);
    entityMap.put(ASSETS_COUNT, assetsCount);
  }
}
