package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class SetApprovalAssigneesImpl implements JavaDelegate {
  private Expression assigneesExpr;
  private Expression assigneesVarNameExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      Map<String, Object> assigneesConfig =
          JsonUtils.readOrConvertValue(assigneesExpr.getValue(execution), Map.class);
      Boolean addReviewers = (Boolean) assigneesConfig.getOrDefault("addReviewers", false);

      List<String> assignees = new ArrayList<>();

      // Add reviewers from the related entity if requested
      if (addReviewers != null && addReviewers) {
        MessageParser.EntityLink entityLink =
            MessageParser.EntityLink.parse(
                (String)
                    varHandler.getNamespacedVariable(
                        inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));
        EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
        assignees.addAll(getEntityLinkStringFromEntityReference(entity.getReviewers()));
      }

      // Persist the list as JSON array so TaskListener can read it
      // Using setVariable instead of setVariableLocal to ensure visibility across subprocess
      execution.setVariable(
          assigneesVarNameExpr.getValue(execution).toString(), JsonUtils.pojoToJson(assignees));

      // Set the hasAssignees variable for the ExclusiveGateway to route correctly
      // This MUST be explicitly true or false, never null
      boolean hasAssignees = !assignees.isEmpty();
      execution.setVariable("hasAssignees", hasAssignees);

      LOG.debug(
          "Set hasAssignees={} for process instance {}",
          hasAssignees,
          execution.getProcessInstanceId());
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private List<String> getEntityLinkStringFromEntityReference(List<EntityReference> assignees) {
    return assignees.stream()
        .map(
            reviewer ->
                new MessageParser.EntityLink(reviewer.getType(), reviewer.getFullyQualifiedName())
                    .getLinkString())
        .toList();
  }
}
