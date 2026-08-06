package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.rules.RuleEngine;

@Slf4j
public class CheckEntityAttributesImpl implements JavaDelegate {
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

    boolean result;
    try {
      result =
          (boolean)
              RuleEngine.getInstance()
                  .apply(rules, buildRuleData(entityLink.getEntityType(), entity));
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    return result;
  }

  /**
   * Approval gates ask "does this entity have reviewers?" and route to a terminal status when the
   * answer is no. An entity that inherits its reviewers — a glossary term under a reviewed glossary —
   * must answer yes, otherwise no approval task is ever created and the term settles in Draft. The
   * raw {@code reviewers} field carries inherited entries only when the read that produced the entity
   * applied inheritance, so resolve them explicitly here, the same way the approval-task assignee node
   * does. The entity is left untouched because it may be request-cached; only the rule input changes.
   */
  private Map<String, Object> buildRuleData(String entityType, EntityInterface entity) {
    Map<String, Object> ruleData = JsonUtils.getMap(entity);
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    if (repository.isSupportsReviewers() && nullOrEmpty(entity.getReviewers())) {
      List<EntityReference> effectiveReviewers = repository.getEffectiveReviewersUntyped(entity);
      if (!nullOrEmpty(effectiveReviewers)) {
        ruleData.put(FIELD_REVIEWERS, JsonUtils.convertValue(effectiveReviewers, List.class));
      }
    }
    return ruleData;
  }
}
