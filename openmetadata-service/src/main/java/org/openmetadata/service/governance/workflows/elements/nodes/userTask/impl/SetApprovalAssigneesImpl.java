package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
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

      // 1.3 Explicit USERS array -------------------------------------------------------------
      Optional.ofNullable((List<String>) assigneesConfig.get("users"))
          .ifPresent(
              users ->
                  users.forEach(
                      userName ->
                          assignees.add(
                              new MessageParser.EntityLink(Entity.USER, userName)
                                  .getLinkString())));

      // 1.4 Explicit TEAMS array -------------------------------------------------------------
      Optional.ofNullable((List<String>) assigneesConfig.get("teams"))
          .ifPresent(
              teams ->
                  teams.forEach(
                      teamName ->
                          assignees.add(
                              new MessageParser.EntityLink(Entity.TEAM, teamName)
                                  .getLinkString())));

      // 1.5 extraAssignees (object with optional users/teams arrays) ------------------------
      Object extraAssigneesObj = assigneesConfig.get("extraAssignees");
      if (extraAssigneesObj instanceof Map) {
        Map<String, Object> extraAssignees = (Map<String, Object>) extraAssigneesObj;

        // Extra users
        Optional.ofNullable((List<String>) extraAssignees.get("users"))
            .ifPresent(
                users ->
                    users.forEach(
                        userName ->
                            assignees.add(
                                new MessageParser.EntityLink(Entity.USER, userName)
                                    .getLinkString())));

        // Extra teams
        Optional.ofNullable((List<String>) extraAssignees.get("teams"))
            .ifPresent(
                teams ->
                    teams.forEach(
                        teamName ->
                            assignees.add(
                                new MessageParser.EntityLink(Entity.TEAM, teamName)
                                    .getLinkString())));
      }

      /*
       * ---------------------------------------------------------------------
       * 2️⃣  Persist the list as JSON array so TaskListener can read it
       * ---------------------------------------------------------------------
       */
      execution.setVariableLocal(
          assigneesVarNameExpr.getValue(execution).toString(), JsonUtils.pojoToJson(assignees));
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
