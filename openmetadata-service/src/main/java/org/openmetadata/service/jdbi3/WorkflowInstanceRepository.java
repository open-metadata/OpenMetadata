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
import org.openmetadata.service.jdbi3.WorkflowDocStoreDAOs.WorkflowInstanceTimeSeriesDAO;
import org.openmetadata.service.resources.governance.WorkflowInstanceResource;

public class WorkflowInstanceRepository extends EntityTimeSeriesRepository<WorkflowInstance> {
  private final WorkflowInstanceTimeSeriesDAO instanceDao;

  public WorkflowInstanceRepository() {
    this(Entity.getCollectionDAO().workflowInstanceTimeSeriesDAO());
  }

  private WorkflowInstanceRepository(WorkflowInstanceTimeSeriesDAO instanceDao) {
    super(
        WorkflowInstanceResource.COLLECTION_PATH,
        instanceDao,
        WorkflowInstance.class,
        Entity.WORKFLOW_INSTANCE);
    this.instanceDao = instanceDao;
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

  /**
   * Records the end of an instance's process. Only status, endedAt and exception are written, so a
   * stop request is never overwritten by the document read here. A stop request recorded between
   * that read and the end write still matched a stoppable status; once a FINISHED, FAILURE or
   * SUPERSEDED end is written no request can land, so the row read back afterwards holds every stop
   * request the instance gets while its process runs.
   */
  public void updateWorkflowInstance(
      UUID workflowInstanceId, Long endedAt, Map<String, Object> variables) {
    WorkflowInstance beforeEnd = readInstance(workflowInstanceId);
    recordEnd(workflowInstanceId, endStateOf(beforeEnd, variables), endedAt);
    Optional<StopRequest> missedStopRequest =
        stopRequestOf(readInstance(workflowInstanceId))
            .filter(stopRequest -> isStopRequestMissed(beforeEnd));
    missedStopRequest.ifPresent(
        stopRequest ->
            recordEnd(
                workflowInstanceId, stoppedEndState(workflowInstanceId, stopRequest), endedAt));
  }

  private static boolean isStopRequestMissed(WorkflowInstance beforeEnd) {
    return beforeEnd.getStatus() != WorkflowInstance.WorkflowStatus.SUPERSEDED
        && stopRequestOf(beforeEnd).isEmpty();
  }

  private WorkflowInstance readInstance(UUID workflowInstanceId) {
    return JsonUtils.readValue(timeSeriesDao.getById(workflowInstanceId), WorkflowInstance.class);
  }

  /** How an instance ended; a {@code null} exception leaves the stored one as it is. */
  record EndState(WorkflowInstance.WorkflowStatus status, String exception) {}

  /**
   * Preserves a terminal SUPERSEDED status set upstream by the supersede path, and the FAILURE an
   * administrator's stop request stands for: the process-end execution listener also lands here and
   * would otherwise recompute the status to FINISHED.
   */
  private EndState endStateOf(WorkflowInstance workflowInstance, Map<String, Object> variables) {
    EndState endState = new EndState(WorkflowInstance.WorkflowStatus.SUPERSEDED, null);
    if (workflowInstance.getStatus() != WorkflowInstance.WorkflowStatus.SUPERSEDED) {
      endState =
          stopRequestOf(workflowInstance)
              .map(stopRequest -> stoppedEndState(workflowInstance.getId(), stopRequest))
              .orElseGet(() -> finalEndState(workflowInstance.getId(), variables));
    }
    return endState;
  }

  private EndState stoppedEndState(UUID workflowInstanceId, StopRequest stopRequest) {
    workflowInstanceStateRepository()
        .markRunningStatesAsFailed(workflowInstanceId, stopRequest.reason());
    return new EndState(WorkflowInstance.WorkflowStatus.FAILURE, stopRequest.reason());
  }

  private EndState finalEndState(UUID workflowInstanceId, Map<String, Object> variables) {
    List<WorkflowInstanceState> states =
        workflowInstanceStateRepository().listAllStatesForInstance(workflowInstanceId);

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

    String exception =
        (String)
            variables.getOrDefault(
                getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE), null);
    return exception == null
        ? new EndState(workflowStatus, null)
        : new EndState(WorkflowInstance.WorkflowStatus.EXCEPTION, exception);
  }

  private void recordEnd(UUID workflowInstanceId, EndState endState, long endedAt) {
    String id = workflowInstanceId.toString();
    String status = endState.status().value();
    if (endState.exception() == null) {
      instanceDao.recordEnd(id, status, endedAt);
    } else {
      instanceDao.recordEndWithException(id, status, endedAt, endState.exception());
    }
  }

  private static WorkflowInstanceStateRepository workflowInstanceStateRepository() {
    return (WorkflowInstanceStateRepository)
        Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);
  }

  /**
   * Records that an administrator asked a running workflow instance to stop. The instance keeps its
   * status; a batch sink and the periodic-batch fetch loop read the request between batches, and
   * the process-end update then records the instance as FAILURE with the request's reason. Only the
   * stop request is written, and only while the instance is RUNNING or EXCEPTION, so a FINISHED,
   * FAILURE or SUPERSEDED end recorded concurrently is neither overwritten nor reverted. EXCEPTION
   * is accepted because a failed job attempt records it while Flowable retries the job and the
   * process goes on running.
   *
   * @return {@code false} when the instance is neither RUNNING nor EXCEPTION, so nothing was
   *     recorded
   */
  public boolean requestStop(UUID workflowInstanceId, StopRequest stopRequest) {
    return instanceDao.requestStop(
            workflowInstanceId.toString(),
            JsonUtils.pojoToJson(stopRequest),
            WorkflowInstance.WorkflowStatus.RUNNING.value(),
            WorkflowInstance.WorkflowStatus.EXCEPTION.value())
        > 0;
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

  /** Marks a workflow instance as FAILED with the given reason, keeping its audit trail. */
  public void markInstanceAsFailed(UUID workflowInstanceId, String reason) {
    recordEnd(
        workflowInstanceId,
        new EndState(WorkflowInstance.WorkflowStatus.FAILURE, reason),
        System.currentTimeMillis());
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
