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
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver.WorkflowStartVariables;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class SetApprovalAssigneesImpl implements JavaDelegate {
  private static final int ADMIN_PAGE_SIZE = 50;
  private Expression assigneesExpr;
  private Expression assigneesVarNameExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      InputNamespaces inputNamespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
      Map<String, Object> assigneesConfig =
          JsonUtils.readOrConvertValue(assigneesExpr.getValue(execution), Map.class);

      // Get the entity
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaces.namespaceFor(RELATED_ENTITY_VARIABLE),
                      RELATED_ENTITY_VARIABLE));
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

      // Prevent self-approval: the requester is NEVER a task assignee. Task-managed workflows
      // (DAR, GlossaryApproval, RequestApproval) publish the requester as `taskUpdatedBy`; entity
      // workflows (glossary term / tag approval, certification changes, …) publish it as the
      // global `updatedBy`. Both are checked because each variable is authoritative for its own
      // workflow family — reading only one silently leaves the other's requester on the list.
      // Removing the requester may leave the list empty, and that is intentional: an empty list
      // lets the userApprovalTask auto-approve (event-driven) or fall through to the admin fallback
      // below (workflow-managed). Re-adding the requester "to keep the task actionable" would
      // silently reintroduce self-approval, so it is deliberately not done.
      Set<String> requesterEntityLinks = resolveRequesterEntityLinks(varHandler, execution);
      assigneeList.removeAll(requesterEntityLinks);

      // Empty-assignee strategy: when nothing resolved (no reviewers/owners, or the only
      // assignee was the requester and was stripped above), apply the node's configured
      // fallback. ASSIGN_ADMINS routes to all platform admins, excluding the requester so
      // self-approval can never happen. NONE keeps the default behavior.
      String emptyAssigneeStrategy =
          String.valueOf(assigneesConfig.getOrDefault("emptyAssigneeStrategy", "none"));
      if (assigneeList.isEmpty() && "assignAdmins".equals(emptyAssigneeStrategy)) {
        List<String> admins = resolveAdminAssignees();
        admins.removeAll(requesterEntityLinks);
        assigneeList.addAll(admins);
        if (assigneeList.isEmpty()) {
          LOG.warn(
              "[Process: {}] Admin fallback resolved no assignees — the only platform admin is the requester; task left unassigned",
              execution.getProcessInstanceId());
        }
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

  /**
   * Collects every possible requester entity-link surfaced by this execution. Task-managed
   * workflows (DataAccessRequest, GlossaryApproval, RequestApproval) publish the requester as
   * {@code taskUpdatedBy} via {@link
   * org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver.WorkflowStartVariables}; entity
   * workflows (glossary-term / tag approval, certification changes, …) publish it as the global
   * {@code updatedBy} variable set by the workflow trigger. Both are read every time — no
   * fallback — so a workflow family that populates only one variable does not silently leak the
   * requester onto its own approval task's assignees list.
   */
  private Set<String> resolveRequesterEntityLinks(
      final WorkflowVariableHandler varHandler, final DelegateExecution execution) {
    Set<String> requesterEntityLinks = new LinkedHashSet<>();
    try {
      // Flowable stores process variables as untyped Object; instanceof pattern-matches on String
      // instead of a blind cast so a non-string / null variable does not throw and reintroduce the
      // self-approval leak via the catch-all below (Copilot review, 2026-08-04).
      Object taskUpdatedBy = execution.getVariable(WorkflowStartVariables.TASK_UPDATED_BY);
      if (taskUpdatedBy instanceof String taskUpdatedByStr) {
        addRequesterEntityLink(requesterEntityLinks, taskUpdatedByStr);
      }
      Object globalUpdatedBy =
          varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE);
      if (globalUpdatedBy instanceof String globalUpdatedByStr) {
        addRequesterEntityLink(requesterEntityLinks, globalUpdatedByStr);
      }
    } catch (Exception exc) {
      LOG.warn(
          "Failed to retrieve updatedBy variables for self-approval prevention: {}",
          exc.getMessage());
    }
    return requesterEntityLinks;
  }

  private void addRequesterEntityLink(
      final Set<String> requesterEntityLinks, final String updatedBy) {
    if (updatedBy != null && !updatedBy.trim().isEmpty()) {
      requesterEntityLinks.add(
          new MessageParser.EntityLink("user", FullyQualifiedName.quoteName(updatedBy))
              .getLinkString());
    }
  }

  private List<String> resolveAdminAssignees() {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    ListFilter listFilter = new ListFilter(Include.NON_DELETED);
    listFilter.addQueryParam("isAdmin", "true");
    List<String> admins = new ArrayList<>();
    String after = null;
    try {
      do {
        ResultList<User> page =
            userRepository.listAfter(
                null, EntityUtil.Fields.EMPTY_FIELDS, listFilter, ADMIN_PAGE_SIZE, after);
        page.getData()
            .forEach(
                user ->
                    admins.add(
                        new MessageParser.EntityLink(Entity.USER, user.getFullyQualifiedName())
                            .getLinkString()));
        after = page.getPaging().getAfter();
      } while (after != null);
    } catch (Exception e) {
      // Degrade gracefully: a transient admin-lookup failure must not fail the whole
      // approval workflow. Return whatever was collected so the task is created (possibly
      // unassigned) rather than raising a BpmnError.
      LOG.warn("Failed to resolve admin assignees for empty-assignee fallback: {}", e.getMessage());
    }
    return admins;
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
