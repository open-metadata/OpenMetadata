package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.Team;
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

      // Get the entity
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      Set<String> assignees = new LinkedHashSet<>();

      // Process addReviewers flag
      Boolean addReviewers = (Boolean) assigneesConfig.getOrDefault("addReviewers", true);
      if (addReviewers) {
        boolean entitySupportsReviewers =
            Entity.getEntityRepository(entityLink.getEntityType()).isSupportsReviewers();

        if (entitySupportsReviewers
            && entity.getReviewers() != null
            && !entity.getReviewers().isEmpty()) {
          List<String> reviewerAssignees =
              getEntityLinkStringFromEntityReferenceWithTeamExpansion(entity.getReviewers());
          assignees.addAll(reviewerAssignees);
        } else if (!entitySupportsReviewers
            && entity.getOwners() != null
            && !entity.getOwners().isEmpty()) {
          // Fallback to owners if entity doesn't support reviewers
          List<String> ownerAssignees =
              getEntityLinkStringFromEntityReferenceWithTeamExpansion(entity.getOwners());
          assignees.addAll(ownerAssignees);
        } else if (addReviewers && entity.getOwners() != null && !entity.getOwners().isEmpty()) {
          // Final fallback to owners if no reviewers exist and addReviewers is true
          List<String> ownerAssignees =
              getEntityLinkStringFromEntityReferenceWithTeamExpansion(entity.getOwners());
          assignees.addAll(ownerAssignees);
        }
      }

      // Process addOwners flag
      Boolean addOwners = (Boolean) assigneesConfig.getOrDefault("addOwners", false);
      if (addOwners && entity.getOwners() != null) {
        List<String> ownerAssignees =
            getEntityLinkStringFromEntityReferenceWithTeamExpansion(entity.getOwners());
        assignees.addAll(ownerAssignees);
      }

      // Process users array
      List<String> userFqns = (List<String>) assigneesConfig.get("users");
      if (userFqns != null) {
        for (String userFqn : userFqns) {
          if (userFqn != null && !userFqn.trim().isEmpty()) {
            assignees.add(new MessageParser.EntityLink("user", userFqn).getLinkString());
          }
        }
      }

      // Process teams array and expand to individual users
      List<String> teamFqns = (List<String>) assigneesConfig.get("teams");
      if (teamFqns != null) {
        for (String teamFqn : teamFqns) {
          if (teamFqn != null && !teamFqn.trim().isEmpty()) {
            try {
              MessageParser.EntityLink teamLink = new MessageParser.EntityLink("team", teamFqn);
              Team team = (Team) Entity.getEntity(teamLink, "users", Include.ALL);
              if (team.getUsers() != null) {
                assignees.addAll(getEntityLinkStringFromEntityReference(team.getUsers()));
              }
            } catch (Exception e) {
              LOG.warn("Failed to expand team {}: {}", teamFqn, e.getMessage());
            }
          }
        }
      }

      List<String> assigneeList = new ArrayList<>(assignees);

      // Persist the list as JSON array so TaskListener can read it.
      // Using setVariable instead of setVariableLocal to ensure visibility across subprocess.
      execution.setVariable(
          assigneesVarNameExpr.getValue(execution).toString(), JsonUtils.pojoToJson(assigneeList));

      boolean hasAssignees = !assigneeList.isEmpty();
      execution.setVariable("hasAssignees", hasAssignees);

      LOG.debug(
          "[Process: {}] ✓ Set hasAssignees={}, assignees count: {}, flow will {}",
          execution.getProcessInstanceId(),
          hasAssignees,
          assigneeList.size(),
          hasAssignees ? "create USER TASK" : "AUTO-APPROVE");
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  /**
   * Resolves the list of sources from the assignees config, handling all three generations of the
   * configuration format (assigneeSources → assigneeSource → addReviewers).
   */
  @SuppressWarnings("unchecked")
  private List<String> resolveSources(Map<String, Object> assigneesConfig) {
    List<String> assigneeSources = (List<String>) assigneesConfig.get("assigneeSources");
    if (assigneeSources != null) {
      return assigneeSources;
    }

    // Legacy: single-value assigneeSource
    String assigneeSource = (String) assigneesConfig.get("assigneeSource");
    if (assigneeSource != null) {
      return List.of(assigneeSource);
    }

    // Oldest legacy: addReviewers boolean
    boolean addReviewers = (boolean) assigneesConfig.getOrDefault("addReviewers", false);
    if (addReviewers) {
      return List.of("reviewers");
    }

    // No recognised source found: return empty list, which causes the task to be auto-approved.
    return List.of();
  }

  private List<String> getEntityLinkStringFromEntityReference(List<EntityReference> assignees) {
    return assignees.stream()
        .map(
            reviewer ->
                new MessageParser.EntityLink(reviewer.getType(), reviewer.getFullyQualifiedName())
                    .getLinkString())
        .toList();
  }

  private List<String> getEntityLinkStringFromEntityReferenceWithTeamExpansion(
      List<EntityReference> assignees) {
    List<String> result = new ArrayList<>();

    for (EntityReference assignee : assignees) {
      if ("team".equals(assignee.getType())) {
        try {
          MessageParser.EntityLink teamLink =
              new MessageParser.EntityLink("team", assignee.getFullyQualifiedName());
          Team team = Entity.getEntity(teamLink, "users", Include.ALL);
          if (team.getUsers() != null && !team.getUsers().isEmpty()) {
            List<String> teamMembers = getEntityLinkStringFromEntityReference(team.getUsers());
            result.addAll(teamMembers);
          } else {
            LOG.warn(
                "Team {} has no users or users list is null", assignee.getFullyQualifiedName());
          }
        } catch (Exception e) {
          LOG.error(
              "Failed to expand team {}: {}", assignee.getFullyQualifiedName(), e.getMessage());
        }
      } else {
        String userLink =
            new MessageParser.EntityLink(assignee.getType(), assignee.getFullyQualifiedName())
                .getLinkString();
        result.add(userLink);
      }
    }

    return result;
  }
}
