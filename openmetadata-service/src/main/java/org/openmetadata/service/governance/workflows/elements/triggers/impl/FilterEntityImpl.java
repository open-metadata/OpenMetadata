package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger.PASSES_FILTER_VARIABLE;

import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.rules.RuleEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FilterEntityImpl implements JavaDelegate {
  private static final Logger log = LoggerFactory.getLogger(FilterEntityImpl.class);
  private Expression filterExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);

    boolean passesFilter;

    if (filterExpr != null) {
      String filterLogic = (String) filterExpr.getValue(execution);
      if (filterLogic != null && !filterLogic.trim().isEmpty()) {
        MessageParser.EntityLink entityLink =
            MessageParser.EntityLink.parse(
                (String)
                    varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE));
        EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
        passesFilter =
            !(Boolean.TRUE.equals(
                RuleEngine.getInstance().apply(filterLogic, JsonUtils.getMap(entity))));
      } else {
        passesFilter = true; // No filter means pass
      }
    } else {
      passesFilter = true; // No filter means pass
    }
    log.debug("Trigger Glossary Term Approval Workflow: {}", passesFilter);
    execution.setVariable(PASSES_FILTER_VARIABLE, passesFilter);
  }
}
