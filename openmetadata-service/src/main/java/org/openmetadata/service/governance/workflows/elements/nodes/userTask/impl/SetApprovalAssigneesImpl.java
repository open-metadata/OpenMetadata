package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
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
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FullyQualifiedName;

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
      EntityRepository<?> entityRepository = Entity.getEntityRepository(entityLink.getEntityType());
      boolean entitySupportsReviewers = entityRepository.isSupportsReviewers();
      String relationshipFields =
          getRelationshipFieldsForAssigneeResolution(
              entityLink.getEntityType(), entitySupportsReviewers);
      EntityInterface entity = Entity.getEntity(entityLink, relationshipFields, Include.ALL);

      Set<String> assignees = new LinkedHashSet<>();

      List<String> taskReviewers = resolveTaskProvidedAssignees(execution, "taskReviewers");
      List<String> taskAssignees = resolveTaskProvidedAssignees(execution, "taskAssignees");
      if (taskAssignees.isEmpty()) {
        taskAssignees = resolveCurrentTaskAssignees(execution);
      }
      boolean hasExplicitTaskAssignees = !taskAssignees.isEmpty();
      LOG.info(
          "[SetApprovalAssigneesImpl] process='{}' taskReviewers={} taskAssignees={}",
          execution.getProcessInstanceId(),
          taskReviewers,
          taskAssignees);
      assignees.addAll(taskReviewers);
      assignees.addAll(taskAssignees);

      if (!hasExplicitTaskAssignees) {
        // Process addReviewers flag
        Boolean addReviewers = (Boolean) assigneesConfig.getOrDefault("addReviewers", true);
        if (addReviewers) {
          List<EntityReference> effectiveReviewers =
              entitySupportsReviewers
                  ? resolveEffectiveReviewers(entityLink.getEntityType(), entity)
                  : List.of();
          if (!effectiveReviewers.isEmpty()) {
            List<String> reviewerAssignees =
                getEntityLinkStringFromEntityReferenceWithTeamExpansion(effectiveReviewers);
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
                Team team = Entity.getEntity(teamLink, "users", Include.ALL);
                if (team.getUsers() != null) {
                  assignees.addAll(getEntityLinkStringFromEntityReference(team.getUsers()));
                }
              } catch (Exception e) {
                LOG.warn("Failed to expand team {}: {}", teamFqn, e.getMessage());
              }
            }
          }
        }
      }

      boolean workflowManagedTask =
          Boolean.TRUE.equals(execution.getVariable("taskWorkflowManaged"))
              || execution.getVariable("taskEntityId") != null;
      List<String> assigneeList = new ArrayList<>(assignees);

      // Prevent self-approval: Remove updatedBy user from assignees list
      try {
        String updatedBy =
            (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE);
        if (updatedBy != null && !updatedBy.trim().isEmpty()) {
          String updatedByEntityLink =
              new MessageParser.EntityLink("user", FullyQualifiedName.quoteName(updatedBy))
                  .getLinkString();
          boolean removed = assigneeList.remove(updatedByEntityLink);
          if (removed) {
            LOG.debug(
                "[Process: {}] Prevented self-approval: Removed updatedBy user '{}' from assignees",
                execution.getProcessInstanceId(),
                updatedBy);
          }
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to retrieve updatedBy variable for self-approval prevention: {}",
            e.getMessage());
      }

      // Persist the list as JSON array so TaskListener can read it.
      // Using setVariable instead of setVariableLocal to ensure visibility across subprocess.
      execution.setVariable(
          assigneesVarNameExpr.getValue(execution).toString(), JsonUtils.pojoToJson(assigneeList));

      boolean hasAssignees = workflowManagedTask || !assigneeList.isEmpty();
      execution.setVariable("hasAssignees", hasAssignees);

      LOG.debug(
          "[Process: {}] ✓ Set hasAssignees={}, assignees count: {}, flow will {}",
          execution.getProcessInstanceId(),
          hasAssignees,
          assigneeList.size(),
          hasAssignees
              ? (assigneeList.isEmpty() ? "create UNASSIGNED USER TASK" : "create USER TASK")
              : "AUTO-APPROVE");
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
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

  private List<String> resolveTaskProvidedAssignees(
      DelegateExecution execution, String variableName) {
    Object rawValue = execution.getVariable(variableName);
    if (rawValue == null) {
      return List.of();
    }

    try {
      List<EntityReference> references =
          rawValue instanceof String
              ? JsonUtils.readValue(
                  (String) rawValue,
                  new com.fasterxml.jackson.core.type.TypeReference<List<EntityReference>>() {})
              : JsonUtils.convertValue(
                  rawValue,
                  new com.fasterxml.jackson.core.type.TypeReference<List<EntityReference>>() {});

      if (references == null || references.isEmpty()) {
        return List.of();
      }

      return getEntityLinkStringFromEntityReferenceWithTeamExpansion(references);
    } catch (Exception exc) {
      LOG.warn(
          "Failed to resolve workflow-provided assignees from '{}': {}",
          variableName,
          exc.getMessage());
      return List.of();
    }
  }

  private List<String> resolveCurrentTaskAssignees(DelegateExecution execution) {
    Object taskEntityId = execution.getVariable("taskEntityId");
    if (taskEntityId == null) {
      return List.of();
    }

    try {
      TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      Task task =
          taskRepository.get(
              null,
              java.util.UUID.fromString(taskEntityId.toString()),
              taskRepository.getFields(TaskRepository.FIELD_ASSIGNEES));
      if (task.getAssignees() == null || task.getAssignees().isEmpty()) {
        return List.of();
      }
      return getEntityLinkStringFromEntityReferenceWithTeamExpansion(task.getAssignees());
    } catch (Exception exc) {
      LOG.warn("Failed to resolve current task assignees from taskEntityId: {}", exc.getMessage());
      return List.of();
    }
  }

  private String getRelationshipFieldsForAssigneeResolution(
      String entityType, boolean entitySupportsReviewers) {
    if (!entitySupportsReviewers) {
      return "owners";
    }

    return switch (entityType) {
      case Entity.TAG -> "reviewers,owners,classification";
      case Entity.GLOSSARY_TERM -> "reviewers,owners,parent,glossary";
      default -> "reviewers,owners";
    };
  }

  private List<EntityReference> resolveEffectiveReviewers(
      String entityType, EntityInterface entity) {
    if (entity.getReviewers() != null && !entity.getReviewers().isEmpty()) {
      return entity.getReviewers();
    }

    return switch (entityType) {
      case Entity.GLOSSARY_TERM -> resolveGlossaryTermReviewers((GlossaryTerm) entity);
      case Entity.TAG -> resolveTagReviewers((Tag) entity);
      default -> List.of();
    };
  }

  private List<EntityReference> resolveGlossaryTermReviewers(GlossaryTerm term) {
    if (term.getParent() != null) {
      GlossaryTerm parentTerm =
          Entity.getEntity(
              term.getParent().withType(Entity.GLOSSARY_TERM), "reviewers", Include.NON_DELETED);
      if (parentTerm.getReviewers() != null && !parentTerm.getReviewers().isEmpty()) {
        return parentTerm.getReviewers();
      }
    }

    if (term.getGlossary() != null) {
      Glossary glossary = Entity.getEntity(term.getGlossary(), "reviewers", Include.NON_DELETED);
      if (glossary.getReviewers() != null && !glossary.getReviewers().isEmpty()) {
        return glossary.getReviewers();
      }
    }

    return List.of();
  }

  private List<EntityReference> resolveTagReviewers(Tag tag) {
    if (tag.getClassification() == null) {
      return List.of();
    }

    Classification classification =
        Entity.getEntity(tag.getClassification(), "reviewers", Include.NON_DELETED);
    if (classification.getReviewers() != null && !classification.getReviewers().isEmpty()) {
      return classification.getReviewers();
    }

    return List.of();
  }
}
