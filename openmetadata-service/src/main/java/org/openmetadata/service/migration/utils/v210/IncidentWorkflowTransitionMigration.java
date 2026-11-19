/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.migration.utils.v210;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.FlowableException;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.migration.ProcessInstanceMigrationValidationResult;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.migration.utils.IdBatches;
import org.openmetadata.service.tasks.IncidentWorkflowStages;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;

/**
 * Adds the Assigned-to-New and Assigned-to-Acknowledged transitions and edges to the persisted incident workflow, then moves the
 * running instances of the workflow onto its latest deployed version. Seed data is only inserted
 * for workflows that do not exist yet, so an upgraded install would otherwise keep the graph it
 * was seeded with. Only missing pieces are added, so a customised graph keeps its other transitions
 * and edges.
 *
 * <p>Redeploying alone does not change an instance that is already running: an incident in the
 * assigned stage keeps the process version it started on, which lacks the new outgoing edges. An
 * instance that cannot be migrated is logged and left on its version; an unsupported transition request on it is then
 * refused with a clear error.
 */
@Slf4j
public final class IncidentWorkflowTransitionMigration {
  public static final String STEP_NAME = "incidentAssignedStatusTransitions";
  private static final String INCIDENT_WORKFLOW_NAME = "TestCaseResolutionTaskWorkflow";
  private static final String ASSIGNED_NODE_NAME = "AssignedStage";
  private static final List<AssignedTransition> RETURN_TRANSITIONS =
      List.of(
          new AssignedTransition(
              IncidentWorkflowStages.NEW_TRANSITION_ID,
              "New",
              "NewStage",
              IncidentWorkflowStages.NEW_STAGE_ID,
              TaskEntityStatus.Open),
          new AssignedTransition(
              IncidentWorkflowStages.ACK_TRANSITION_ID,
              "Acknowledge",
              "AckStage",
              IncidentWorkflowStages.ACK_STAGE_ID,
              TaskEntityStatus.InProgress));

  private record AssignedTransition(
      String id,
      String label,
      String targetNode,
      String targetStage,
      TaskEntityStatus taskStatus) {}

  private static final String NODES = "nodes";
  private static final String EDGES = "edges";
  private static final String CONFIG = "config";
  private static final String TRANSITION_METADATA = "transitionMetadata";
  private static final String FROM = "from";
  private static final String TO = "to";
  private static final String CONDITION = "condition";
  private static final String ID = "id";

  private IncidentWorkflowTransitionMigration() {}

  public static void addAssignedStatusTransitions() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition persisted =
        repository.findByNameOrNull(INCIDENT_WORKFLOW_NAME, Include.NON_DELETED);
    if (persisted == null) {
      return;
    }

    ObjectNode definition = (ObjectNode) JsonUtils.readTree(JsonUtils.pojoToJson(persisted));
    if (!hasSupportedStages(definition)) {
      LOG.info("Leaving customized incident workflow '{}' unchanged", INCIDENT_WORKFLOW_NAME);
      return;
    }
    if (addMissingAssignedTransitions(definition)) {
      WorkflowDefinition upgraded =
          JsonUtils.readValue(JsonUtils.pojoToJson(definition), WorkflowDefinition.class);
      repository.createOrUpdate(null, upgraded, Entity.ADMIN_USER_NAME);
      LOG.info("Added the Assigned return transitions to workflow '{}'", INCIDENT_WORKFLOW_NAME);
    } else {
      // A retry after storing the graph but before deployment must repair the deployed version.
      WorkflowHandler.getInstance().deploy(new Workflow(persisted));
    }
    migrateRunningIncidents(persisted.getId());
  }

  private static void migrateRunningIncidents(UUID workflowDefinitionId) {
    WorkflowHandler handler = WorkflowHandler.getInstance();
    ProcessDefinition latest = latestProcessDefinition(handler.getRepositoryService());
    if (latest != null) {
      Entity.getJdbi()
          .useHandle(
              handle ->
                  IdBatches.fold(
                      handle,
                      "task_entity",
                      0,
                      (count, ids) ->
                          count + migrateBatch(handle, ids, workflowDefinitionId, latest.getId())));
    }
  }

  private static int migrateBatch(
      Handle handle, List<String> ids, UUID workflowDefinitionId, String targetId) {
    List<Task> tasks =
        handle
            .createQuery(
                "SELECT json FROM task_entity WHERE id IN (<ids>) AND type = :type "
                    + "AND status IN ('Open', 'InProgress', 'Pending') AND deleted = false")
            .bindList("ids", ids)
            .bind("type", TaskEntityType.TestCaseResolution.value())
            .mapTo(String.class)
            .list()
            .stream()
            .map(json -> JsonUtils.readValue(json, Task.class))
            .toList();
    for (Task task : tasks) {
      if (task.getWorkflowInstanceId() != null
          && workflowDefinitionId.equals(task.getWorkflowDefinitionId())
          && migrateIncident(task, targetId)) {
        refreshAssignedIncidentTransitions(task, workflowDefinitionId);
      }
    }
    return tasks.size();
  }

  // Confirm the individual process version, including on retries after partial migration failure.
  // Publishing the new edge for a process still on the old version would bypass the API guard.
  private static boolean migrateIncident(Task task, String targetId) {
    WorkflowHandler handler = WorkflowHandler.getInstance();
    ProcessInstance instance = incidentProcess(handler, task);
    if (instance != null && !targetId.equals(instance.getProcessDefinitionId())) {
      migrateInstance(handler, instance.getId(), targetId);
      instance = incidentProcess(handler, task);
    }
    return instance != null && targetId.equals(instance.getProcessDefinitionId());
  }

  private static ProcessInstance incidentProcess(WorkflowHandler handler, Task task) {
    return handler
        .getRuntimeService()
        .createProcessInstanceQuery()
        .processInstanceBusinessKey(task.getWorkflowInstanceId().toString())
        .processDefinitionKey(INCIDENT_WORKFLOW_NAME)
        .singleResult();
  }

  private static void refreshAssignedIncidentTransitions(Task task, UUID workflowDefinitionId) {
    if (!IncidentWorkflowStages.ASSIGNED_STAGE_ID.equals(task.getWorkflowStageId())) {
      return;
    }
    List<TaskAvailableTransition> transitions =
        TaskWorkflowLifecycleResolver.resolveTransitionsForStage(
            workflowDefinitionId, IncidentWorkflowStages.ASSIGNED_STAGE_ID);
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task current = taskRepository.get(null, task.getId(), taskRepository.getFields("*"));
    if (Objects.equals(current.getAvailableTransitions(), transitions)) {
      return;
    }
    Task desired = JsonUtils.deepCopy(current, Task.class);
    desired.setAvailableTransitions(transitions);
    taskRepository.updateWorkflowStage(current, desired, Entity.ADMIN_USER_NAME);
  }

  private static ProcessDefinition latestProcessDefinition(RepositoryService repositoryService) {
    return repositoryService
        .createProcessDefinitionQuery()
        .processDefinitionKey(INCIDENT_WORKFLOW_NAME)
        .latestVersion()
        .singleResult();
  }

  private static void migrateInstance(WorkflowHandler handler, String instanceId, String targetId) {
    try {
      ProcessInstanceMigrationValidationResult validation =
          handler
              .getProcessMigrationService()
              .createProcessInstanceMigrationBuilder()
              .migrateToProcessDefinition(targetId)
              .validateMigration(instanceId);
      if (validation.isMigrationValid()) {
        handler
            .getProcessMigrationService()
            .createProcessInstanceMigrationBuilder()
            .migrateToProcessDefinition(targetId)
            .migrate(instanceId);
      } else {
        LOG.warn(
            "Incident process {} cannot move to {}: {}",
            instanceId,
            targetId,
            validation.getValidationMessages());
      }
    } catch (FlowableException e) {
      LOG.warn(
          "Could not move incident process {} to {}: {}", instanceId, targetId, e.getMessage());
    }
  }

  private static boolean hasSupportedStages(ObjectNode definition) {
    JsonNode assigned = findNodeByName(definition.path(NODES), ASSIGNED_NODE_NAME);
    return assigned != null
        && IncidentWorkflowStages.ASSIGNED_STAGE_ID.equals(
            assigned.path(CONFIG).path("stageId").asText())
        && assigned.path(CONFIG).path(TRANSITION_METADATA) instanceof ArrayNode
        && definition.path(EDGES) instanceof ArrayNode
        && RETURN_TRANSITIONS.stream()
            .allMatch(transition -> supportsTransition(definition, assigned, transition));
  }

  private static boolean supportsTransition(
      ObjectNode definition, JsonNode assigned, AssignedTransition expected) {
    JsonNode target = findNodeByName(definition.path(NODES), expected.targetNode());
    return target != null
        && expected.targetStage().equals(target.path(CONFIG).path("stageId").asText())
        && !hasConflictingTransition(assigned.path(CONFIG).path(TRANSITION_METADATA), expected)
        && !hasConflictingEdge(definition.path(EDGES), expected);
  }

  private static boolean hasConflictingTransition(
      JsonNode transitions, AssignedTransition expected) {
    for (JsonNode transition : transitions) {
      if (expected.id().equals(transition.path(ID).asText())
          && (!expected.targetStage().equals(transition.path("targetStageId").asText())
              || !expected
                  .taskStatus()
                  .value()
                  .equals(transition.path("targetTaskStatus").asText()))) {
        return true;
      }
    }
    return false;
  }

  private static boolean hasConflictingEdge(JsonNode edges, AssignedTransition expected) {
    for (JsonNode edge : edges) {
      if (ASSIGNED_NODE_NAME.equals(edge.path(FROM).asText())
          && expected.id().equals(edge.path(CONDITION).asText())
          && !expected.targetNode().equals(edge.path(TO).asText())) {
        return true;
      }
    }
    return false;
  }

  static boolean addMissingAssignedTransitions(ObjectNode definition) {
    if (!hasSupportedStages(definition)) {
      return false;
    }
    boolean updated = false;
    for (AssignedTransition transition : RETURN_TRANSITIONS) {
      updated |= addTransitionToAssignedStage(definition.path(NODES), transition);
      updated |= addEdgeFromAssignedStage(definition.path(EDGES), transition);
    }
    return updated;
  }

  private static boolean addTransitionToAssignedStage(
      JsonNode nodes, AssignedTransition transition) {
    JsonNode assignedNode = findNodeByName(nodes, ASSIGNED_NODE_NAME);
    ArrayNode transitions = (ArrayNode) assignedNode.path(CONFIG).path(TRANSITION_METADATA);
    if (hasTransitionWithId(transitions, transition.id())) {
      return false;
    }
    transitions
        .addObject()
        .put(ID, transition.id())
        .put("label", transition.label())
        .put("targetStageId", transition.targetStage())
        .put("targetTaskStatus", transition.taskStatus().value());
    return true;
  }

  private static JsonNode findNodeByName(JsonNode nodes, String name) {
    if (!(nodes instanceof ArrayNode nodeArray)) {
      return null;
    }
    for (JsonNode node : nodeArray) {
      if (name.equals(node.path("name").asText())) {
        return node;
      }
    }
    return null;
  }

  private static boolean hasTransitionWithId(ArrayNode transitions, String transitionId) {
    for (JsonNode transition : transitions) {
      if (transitionId.equals(transition.path(ID).asText())) {
        return true;
      }
    }
    return false;
  }

  private static boolean addEdgeFromAssignedStage(JsonNode edges, AssignedTransition transition) {
    ArrayNode edgeArray = (ArrayNode) edges;
    for (JsonNode edge : edgeArray) {
      if (ASSIGNED_NODE_NAME.equals(edge.path(FROM).asText())
          && transition.id().equals(edge.path(CONDITION).asText())) {
        return false;
      }
    }
    edgeArray
        .addObject()
        .put(FROM, ASSIGNED_NODE_NAME)
        .put(TO, transition.targetNode())
        .put(CONDITION, transition.id());
    return true;
  }
}
