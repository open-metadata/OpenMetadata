package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowInstanceResource;

public class WorkflowInstanceRepository extends EntityTimeSeriesRepository<WorkflowInstance> {
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
    workflowInstance.setEndedAt(endedAt);

    // Preserve a terminal SUPERSEDED status set upstream by the supersede path, and the FAILURE an
    // administrator's stop request stands for: the process-end execution listener also lands here
    // and would otherwise recompute the status to FINISHED.
    if (workflowInstance.getStatus() != WorkflowInstance.WorkflowStatus.SUPERSEDED) {
      stopRequestOf(workflowInstance)
          .ifPresentOrElse(
              stopRequest -> applyStopRequest(workflowInstance, stopRequest),
              () -> applyFinalStatus(workflowInstance, variables));
    }

    getTimeSeriesDao().update(JsonUtils.pojoToJson(workflowInstance), workflowInstanceId);
  }

  private void applyStopRequest(WorkflowInstance workflowInstance, StopRequest stopRequest) {
    workflowInstanceStateRepository()
        .markRunningStatesAsFailed(workflowInstance.getId(), stopRequest.reason());
    workflowInstance
        .withStatus(WorkflowInstance.WorkflowStatus.FAILURE)
        .withException(stopRequest.reason());
  }

  private void applyFinalStatus(WorkflowInstance workflowInstance, Map<String, Object> variables) {
    List<WorkflowInstanceState> states =
        workflowInstanceStateRepository().listAllStatesForInstance(workflowInstance.getId());

    boolean hasFailedStage =
        states.stream()
            .anyMatch(s -> s.getStatus().equals(WorkflowInstance.WorkflowStatus.FAILURE));
    // Stage rows exist only when storeStageStatus is enabled. The un-namespaced failure variable
    // is set without them: on a trigger process by SubWorkflowFailureListener, when a sink node of
    // the main workflow failed with no failure edge routing it, and on a main workflow by
    // WorkflowInstanceExecutionIdSetterListener, when the run started without its related entity.
    boolean isFailureFlagged = Boolean.TRUE.equals(variables.get(FAILURE_VARIABLE));
    WorkflowInstance.WorkflowStatus workflowStatus =
        hasFailedStage || isFailureFlagged
            ? WorkflowInstance.WorkflowStatus.FAILURE
            : WorkflowInstance.WorkflowStatus.FINISHED;

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
  }

  private static WorkflowInstanceStateRepository workflowInstanceStateRepository() {
    return (WorkflowInstanceStateRepository)
        Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);
  }

  /**
   * Records that an administrator asked a running workflow instance to stop. The instance stays
   * RUNNING; a batch sink and the periodic-batch fetch loop read the request between batches, and
   * the process-end update then records the instance as FAILURE with the request's reason.
   */
  public void requestStop(UUID workflowInstanceId, StopRequest stopRequest) {
    WorkflowInstance workflowInstance =
        JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);

    Map<String, Object> variables = workflowInstance.getVariables();
    if (variables == null) {
      variables = new HashMap<>();
    }
    variables.put(STOP_REQUEST_VARIABLE_KEY, stopRequest);

    getTimeSeriesDao()
        .update(
            JsonUtils.pojoToJson(workflowInstance.withVariables(variables)), workflowInstanceId);
  }

  /** The stop request recorded on the workflow instance, read from the database. */
  public Optional<StopRequest> findStopRequest(UUID workflowInstanceId) {
    return Optional.ofNullable(getById(workflowInstanceId))
        .flatMap(WorkflowInstanceRepository::stopRequestOf);
  }

  private static Optional<StopRequest> stopRequestOf(WorkflowInstance workflowInstance) {
    return Optional.ofNullable(workflowInstance.getVariables())
        .map(variables -> variables.get(STOP_REQUEST_VARIABLE_KEY))
        .map(stopRequest -> JsonUtils.convertValue(stopRequest, StopRequest.class))
        .filter(StopRequest::requested);
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

    Map<String, Object> variables = workflowInstance.getVariables();
    if (variables == null) {
      variables = new HashMap<>();
    }
    variables.put(TERMINATION_REASON_VARIABLE_KEY, reason);

    WorkflowInstance updatedInstance =
        workflowInstance
            .withStatus(WorkflowInstance.WorkflowStatus.SUPERSEDED)
            .withVariables(variables)
            .withEndedAt(System.currentTimeMillis());

    getTimeSeriesDao().update(JsonUtils.pojoToJson(updatedInstance), workflowInstanceId);
  }

  private static final String TERMINATION_REASON_VARIABLE_KEY = "terminationReason";

  /** Key, in a workflow instance's variables, of the {@link StopRequest} an administrator made. */
  public static final String STOP_REQUEST_VARIABLE_KEY = "stopRequest";

  /**
   * An administrator's request that a running workflow instance stop at its next batch boundary.
   *
   * @param reason the audit message recorded as the instance's exception once it stops
   */
  public record StopRequest(
      boolean requested, String reason, String requestedBy, long requestedAt) {}
}
