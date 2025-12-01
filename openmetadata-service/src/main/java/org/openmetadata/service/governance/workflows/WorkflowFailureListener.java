package org.openmetadata.service.governance.workflows;

import static org.flowable.common.engine.api.delegate.event.FlowableEngineEventType.JOB_EXECUTION_FAILURE;
import static org.flowable.common.engine.api.delegate.event.FlowableEngineEventType.PROCESS_CANCELLED;
import static org.flowable.common.engine.api.delegate.event.FlowableEngineEventType.PROCESS_COMPLETED_WITH_ERROR_END_EVENT;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.event.FlowableEngineEntityEvent;
import org.flowable.common.engine.api.delegate.event.FlowableEvent;
import org.flowable.common.engine.api.delegate.event.FlowableEventListener;
import org.flowable.common.engine.api.delegate.event.FlowableExceptionEvent;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.ProcessInstance;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

@Slf4j
public class WorkflowFailureListener implements FlowableEventListener {

  @Override
  public void onEvent(FlowableEvent event) {
    switch (event.getType()) {
      case JOB_EXECUTION_FAILURE:
        LOG.error("[WorkflowFailure] JOB_EXECUTION_FAILURE: {}", event);
        handleFailure(event, "JOB_EXECUTION_FAILURE");
        break;
      case PROCESS_COMPLETED_WITH_ERROR_END_EVENT:
        LOG.error("[WorkflowFailure] PROCESS_COMPLETED_WITH_ERROR: {}", event);
        handleFailure(event, "PROCESS_ERROR");
        break;
      case PROCESS_CANCELLED:
        LOG.error("[WorkflowFailure] PROCESS_CANCELLED: {}", event);
        handleFailure(event, "PROCESS_CANCELLED");
        break;
      default:
        if (event instanceof FlowableExceptionEvent) {
          handleFlowableException((FlowableExceptionEvent) event);
        }
        break;
    }
  }

  /**
   * Handles FlowableException events that cause workflows to get stuck
   */
  private void handleFlowableException(FlowableExceptionEvent exceptionEvent) {
    Throwable cause = exceptionEvent.getCause();
    String errorMessage = cause != null ? cause.getMessage() : "Unknown Flowable exception";

    String processInstanceId = null;
    if (exceptionEvent instanceof FlowableEngineEntityEvent entityEvent) {
      processInstanceId = entityEvent.getProcessInstanceId();
    }

    LOG.error(
        "[WorkflowFailure] FLOWABLE_EXCEPTION: processInstanceId={}, error={}",
        processInstanceId,
        errorMessage,
        cause);

    if (errorMessage.contains("No outgoing sequence flow")) {
      LOG.error("[WorkflowFailure] DESIGN_ERROR: Missing conditional sequence flows detected");
      handleFailureWithProcessId(processInstanceId, "DESIGN_ERROR", errorMessage);
      terminateStuckProcessWithId(processInstanceId, errorMessage);
    } else {
      handleFailureWithProcessId(processInstanceId, "FLOWABLE_EXCEPTION", errorMessage);
    }
  }

  /**
   * Main failure handling logic that reuses existing repository patterns
   * This ensures consistency with WorkflowInstanceListener failure handling
   */
  private void handleFailure(FlowableEvent event, String failureType) {
    String processInstanceId = null;
    if (event instanceof FlowableEngineEntityEvent entityEvent) {
      processInstanceId = entityEvent.getProcessInstanceId();
    }

    String errorMessage = getErrorMessage(event);
    handleFailureWithProcessId(processInstanceId, failureType, errorMessage);
  }

  /**
   * Main failure handling logic that reuses existing repository patterns
   * This ensures consistency with WorkflowInstanceListener failure handling
   */
  private void handleFailureWithProcessId(
      String processInstanceId, String failureType, String errorMessage) {
    try {
      if (processInstanceId == null) {
        LOG.warn(
            "[WorkflowFailure] Cannot handle failure - missing processInstanceId for failureType: {}",
            failureType);
        return;
      }

      ProcessEngine processEngine = ProcessEngines.getDefaultProcessEngine();
      RuntimeService runtimeService = processEngine.getRuntimeService();

      ProcessInstance processInstance =
          runtimeService
              .createProcessInstanceQuery()
              .processInstanceId(processInstanceId)
              .singleResult();

      if (processInstance == null) {
        LOG.error(
            "[WorkflowFailure] ProcessInstance not found: processInstanceId={}", processInstanceId);
        return;
      }

      String businessKey = processInstance.getBusinessKey();
      if (businessKey == null || businessKey.isEmpty()) {
        LOG.error(
            "[WorkflowFailure] Missing businessKey for processInstance: {}", processInstanceId);
        return;
      }

      UUID workflowInstanceId = UUID.fromString(businessKey);
      String workflowName =
          WorkflowHandler.getProcessDefinitionKeyFromId(processInstance.getProcessDefinitionId());

      markWorkflowInstanceAsFailed(
          workflowInstanceId, processInstanceId, failureType, errorMessage);

      if (isStageStatusEnabled(workflowName)) {
        addFailureStage(workflowInstanceId, processInstanceId, workflowName, failureType);
      }

      LOG.warn(
          "[WorkflowFailure] MARKED_AS_FAILED: workflowInstanceId={}, processInstanceId={}, failureType={}",
          workflowInstanceId,
          processInstanceId,
          failureType);

    } catch (Exception e) {
      LOG.error(
          "[WorkflowFailure] Failed to handle workflow failure: processInstanceId={}, error={}",
          processInstanceId,
          e.getMessage(),
          e);
    }
  }

  /**
   * Marks workflow instance as FAILED using existing WorkflowInstanceRepository
   */
  private void markWorkflowInstanceAsFailed(
      UUID workflowInstanceId, String processInstanceId, String failureType, String errorMessage) {
    try {
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      java.util.Map<String, Object> failureVariables = new java.util.HashMap<>();
      failureVariables.put("status", "FAILURE");
      failureVariables.put("failureType", failureType);
      failureVariables.put("error", errorMessage);
      failureVariables.put("processInstanceId", processInstanceId);

      workflowInstanceRepository.updateWorkflowInstance(
          workflowInstanceId, System.currentTimeMillis(), failureVariables);

      LOG.info(
          "[WorkflowFailure] INSTANCE_MARKED_FAILED: workflowInstanceId={}, status=FAILURE",
          workflowInstanceId);

    } catch (Exception e) {
      LOG.error(
          "[WorkflowFailure] Failed to mark workflow instance as failed: workflowInstanceId={}, error={}",
          workflowInstanceId,
          e.getMessage(),
          e);
    }
  }

  /**
   * Adds failure stage using WorkflowInstanceStageListener patterns
   */
  private void addFailureStage(
      UUID workflowInstanceId, String processInstanceId, String workflowName, String failureType) {
    try {
      WorkflowInstanceStateRepository stateRepository =
          (WorkflowInstanceStateRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

      UUID executionId = UUID.nameUUIDFromBytes(processInstanceId.getBytes());

      LOG.warn(
          "[WorkflowFailure] Creating fallback execution ID for failure stage: workflowInstanceId={}, executionId={}",
          workflowInstanceId,
          executionId);

      UUID stageId =
          stateRepository.addNewStageToInstance(
              "WORKFLOW_FAILURE",
              executionId,
              workflowInstanceId,
              workflowName,
              System.currentTimeMillis());

      java.util.Map<String, Object> stageData = new java.util.HashMap<>();
      stageData.put("status", "FAILED");
      stageData.put("failureType", failureType);
      stageData.put("processInstanceId", processInstanceId);

      stateRepository.updateStage(stageId, System.currentTimeMillis(), stageData);

      LOG.info(
          "[WorkflowFailure] FAILURE_STAGE_ADDED: workflowInstanceId={}, stageId={}",
          workflowInstanceId,
          stageId);

    } catch (Exception e) {
      LOG.error(
          "[WorkflowFailure] Failed to add failure stage: workflowInstanceId={}, error={}",
          workflowInstanceId,
          e.getMessage(),
          e);
    }
  }

  /**
   * Terminates stuck processes that cannot continue due to design errors
   * This prevents processes from staying in RUNNING state forever
   */
  private void terminateStuckProcessWithId(String processInstanceId, String errorMessage) {
    try {
      if (processInstanceId == null) {
        LOG.warn("[WorkflowFailure] Cannot terminate process - missing processInstanceId");
        return;
      }

      ProcessEngine processEngine = ProcessEngines.getDefaultProcessEngine();
      RuntimeService runtimeService = processEngine.getRuntimeService();

      ProcessInstance processInstance =
          runtimeService
              .createProcessInstanceQuery()
              .processInstanceId(processInstanceId)
              .singleResult();

      if (processInstance != null && !processInstance.isEnded()) {
        LOG.warn(
            "[WorkflowFailure] TERMINATING_STUCK_PROCESS: processInstanceId={}, reason=design_error",
            processInstanceId);

        runtimeService.deleteProcessInstance(
            processInstanceId, "Terminated due to workflow design error: " + errorMessage);

        LOG.info("[WorkflowFailure] PROCESS_TERMINATED: processInstanceId={}", processInstanceId);
      }
    } catch (Exception e) {
      LOG.error(
          "[WorkflowFailure] TERMINATION_FAILED: processInstanceId={}, error={}",
          processInstanceId,
          e.getMessage(),
          e);
    }
  }

  /**
   * Look up the original WorkflowDefinition configuration to check if storeStageStatus was enabled
   */
  private boolean isStageStatusEnabled(String workflowDefinitionKey) {
    try {
      WorkflowDefinitionRepository workflowDefRepository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      WorkflowDefinition workflowDef =
          workflowDefRepository.getByName(null, workflowDefinitionKey, null);

      if (workflowDef != null && workflowDef.getConfig() != null) {
        boolean storeStageStatus = workflowDef.getConfig().getStoreStageStatus();
        LOG.debug(
            "[WorkflowFailure] Retrieved config for '{}': storeStageStatus={}",
            workflowDefinitionKey,
            storeStageStatus);
        return storeStageStatus;
      } else {
        LOG.warn(
            "[WorkflowFailure] WorkflowDefinition '{}' not found or has no config, defaulting to false",
            workflowDefinitionKey);
        return false;
      }

    } catch (Exception e) {
      LOG.error(
          "[WorkflowFailure] Failed to retrieve WorkflowDefinition '{}', defaulting to false: {}",
          workflowDefinitionKey,
          e.getMessage());
      return false;
    }
  }

  private String getErrorMessage(FlowableEvent event) {
    if (event instanceof FlowableExceptionEvent exceptionEvent) {
      return exceptionEvent.getCause() != null
          ? exceptionEvent.getCause().getMessage()
          : "Unknown Flowable exception";
    }
    return "Workflow failure: " + event.getType().name();
  }

  @Override
  public boolean isFailOnException() {
    return false;
  }

  @Override
  public boolean isFireOnTransactionLifecycleEvent() {
    return false;
  }

  @Override
  public String getOnTransaction() {
    return null;
  }
}
