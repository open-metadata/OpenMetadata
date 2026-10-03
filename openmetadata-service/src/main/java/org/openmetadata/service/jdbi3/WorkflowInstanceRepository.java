package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceResource;

public class WorkflowInstanceRepository extends EntityTimeSeriesRepository<WorkflowInstance> {
  // Statuses set by whoever ended the run from outside it; the process-end listener keeps them.
  private static final Set<WorkflowInstance.WorkflowStatus> ENDED_FROM_OUTSIDE =
      Set.of(WorkflowInstance.WorkflowStatus.SUPERSEDED, WorkflowInstance.WorkflowStatus.CANCELLED);

  public WorkflowInstanceRepository() {
    super(
        WorkflowInstanceResource.COLLECTION_PATH,
        Entity.getCollectionDAO().workflowInstanceTimeSeriesDAO(),
        WorkflowInstance.class,
        Entity.WORKFLOW_INSTANCE);
  }

  public WorkflowInstance createNewRecord(WorkflowInstance recordEntity, String recordFQN) {
    storeInternal(recordEntity, recordFQN);
    storeRelationshipInternal(recordEntity);
    return recordEntity;
  }

  public void addNewWorkflowInstance(
      String workflowDefinitionName,
      UUID workflowInstanceId,
      Long startedAt,
      Map<String, Object> variables) {
    WorkflowDefinitionRepository workflowDefinitionRepository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    UUID workflowDefinitionId = workflowDefinitionRepository.getIdFromName(workflowDefinitionName);

    createNewRecord(
        new WorkflowInstance()
            .withId(workflowInstanceId)
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withStartedAt(startedAt)
            .withStatus(WorkflowInstance.WorkflowStatus.RUNNING)
            .withVariables(variables)
            .withTimestamp(System.currentTimeMillis()),
        workflowDefinitionName);
  }

  public void updateWorkflowInstance(
      UUID workflowInstanceId, Long endedAt, Map<String, Object> variables) {
    WorkflowInstance workflowInstance =
        JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);

    // Preserve a terminal status set by the path that ended the run — the process-end execution
    // listener also lands here and would otherwise recompute the status to FINISHED.
    if (ENDED_FROM_OUTSIDE.contains(workflowInstance.getStatus())) {
      workflowInstance.setEndedAt(endedAt);
      getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstance), workflowInstanceId);
      return;
    }

    workflowInstance.setEndedAt(endedAt);

    WorkflowInstanceStateRepository workflowInstanceStateRepository =
        (WorkflowInstanceStateRepository)
            Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

    List<WorkflowInstanceState> states =
        workflowInstanceStateRepository.listAllStatesForInstance(workflowInstanceId);

    WorkflowInstance.WorkflowStatus workflowStatus = WorkflowInstance.WorkflowStatus.FINISHED;
    if (states.stream()
        .anyMatch(s -> s.getStatus().equals(WorkflowInstance.WorkflowStatus.FAILURE))) {
      workflowStatus = WorkflowInstance.WorkflowStatus.FAILURE;
    }

    workflowInstance.setStatus(workflowStatus);

    Optional<String> oException =
        Optional.ofNullable(
            (String)
                variables.getOrDefault(
                    getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE), null));
    if (oException.isPresent()) {
      workflowInstance.setException(oException.get());
      workflowInstance.setStatus(WorkflowInstance.WorkflowStatus.EXCEPTION);
    }

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstance), workflowInstanceId);
  }

  /**
   * Marks a workflow instance as FAILED with the given reason.
   * Preserves audit trail instead of deleting the instance.
   */
  public void markInstanceAsFailed(UUID workflowInstanceId, String reason) {
    WorkflowInstance workflowInstance =
        JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);

    WorkflowInstance updatedInstance =
        workflowInstance
            .withStatus(WorkflowInstance.WorkflowStatus.FAILURE)
            .withException(reason)
            .withEndedAt(System.currentTimeMillis());

    getTimeSeriesDao().update(JsonUtils.pojoToJson(updatedInstance), workflowInstanceId);
  }

  /** Marks a workflow instance as SUPERSEDED when a newer run replaces it. */
  public void markInstanceAsSuperseded(UUID workflowInstanceId, String reason) {
    WorkflowInstance workflowInstance =
        JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);
    markEnded(
        workflowInstanceId, workflowInstance, WorkflowInstance.WorkflowStatus.SUPERSEDED, reason);
  }

  /**
   * Records {@code status} and {@code reason} on a run that is ended from outside it (superseded or
   * cancelled). Returns false, changing nothing, when the run has already ended or does not exist.
   */
  public boolean endRunningInstance(
      UUID workflowInstanceId, WorkflowInstance.WorkflowStatus status, String reason) {
    String json = timeSeriesDao.getById(workflowInstanceId);
    WorkflowInstance workflowInstance =
        json == null ? null : JsonUtils.readValue(json, WorkflowInstance.class);
    boolean running =
        workflowInstance != null
            && workflowInstance.getStatus() == WorkflowInstance.WorkflowStatus.RUNNING;
    if (running) {
      markEnded(workflowInstanceId, workflowInstance, status, reason);
    }
    return running;
  }

  private void markEnded(
      UUID workflowInstanceId,
      WorkflowInstance workflowInstance,
      WorkflowInstance.WorkflowStatus status,
      String reason) {

    Map<String, Object> variables = workflowInstance.getVariables();
    if (variables == null) {
      variables = new HashMap<>();
    }
    variables.put(TERMINATION_REASON_VARIABLE_KEY, reason);

    WorkflowInstance updatedInstance =
        workflowInstance
            .withStatus(status)
            .withVariables(variables)
            .withEndedAt(System.currentTimeMillis());

    getTimeSeriesDao().update(JsonUtils.pojoToJson(updatedInstance), workflowInstanceId);
  }

  private static final String TERMINATION_REASON_VARIABLE_KEY = "terminationReason";
}
