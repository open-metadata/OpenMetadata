package org.openmetadata.service.governance.workflows;

import static org.flowable.common.engine.api.delegate.event.FlowableEngineEventType.JOB_EXECUTION_FAILURE;
import static org.flowable.common.engine.api.delegate.event.FlowableEngineEventType.PROCESS_CANCELLED;
import static org.flowable.common.engine.api.delegate.event.FlowableEngineEventType.PROCESS_COMPLETED_WITH_ERROR_END_EVENT;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.event.FlowableEngineEntityEvent;
import org.flowable.common.engine.api.delegate.event.FlowableEvent;
import org.flowable.common.engine.api.delegate.event.FlowableEventListener;
import org.flowable.common.engine.api.delegate.event.FlowableExceptionEvent;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.delegate.event.FlowableCancelledEvent;
import org.flowable.engine.runtime.ProcessInstance;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Records workflow failures in the WorkflowInstance / WorkflowInstanceState time-series tables.
 * Workflow failures are business events (task threw, cancelled by supersede), not code bugs, so
 * this listener logs at WARN/DEBUG and never at ERROR. Real code bugs still surface as exceptions
 * from callers into their own error paths.
 */
@Slf4j
public class WorkflowFailureListener implements FlowableEventListener {

  public static final String WORKFLOW_FAILURE_LISTENER_STAGE = "workflowFailureListener";
  private static final String STATUS_VARIABLE_KEY = "status";

  private static final Set<String> INTENTIONAL_CANCELLATION_CAUSES =
      Set.of(
          "Cleanup before redeployment",
          "Cleanup old workflow version",
          "Terminated due to conflicting workflow instance",
          Workflow.SUPERSEDED_BY_NEWER_RUN);

  private static final String DRAFT_TASK_CANCEL_CAUSE_PREFIX = "Workflow-managed draft task ";

  @Override
  public void onEvent(FlowableEvent event) {
    switch (event.getType()) {
      case JOB_EXECUTION_FAILURE:
        LOG.warn("[WorkflowFailure] JOB_EXECUTION_FAILURE: {}", event);
        storeFailureInDatabase(event, "JOB_EXECUTION_FAILURE");
        break;
      case PROCESS_COMPLETED_WITH_ERROR_END_EVENT:
        LOG.warn("[WorkflowFailure] PROCESS_COMPLETED_WITH_ERROR: {}", event);
        storeFailureInDatabase(event, "PROCESS_ERROR");
        break;
      case PROCESS_CANCELLED:
        handleProcessCancelled(event);
        break;
      default:
        if (event instanceof FlowableExceptionEvent exceptionEvent) {
          handleFlowableException(exceptionEvent);
        }
        break;
    }
  }

  private void handleProcessCancelled(FlowableEvent event) {
    // FlowableCancelledEvent carries the reason string passed to deleteProcessInstance. A
    // whitelisted cause means the cancel was intentional (supersede / redeployment cleanup).
    String cause =
        event instanceof FlowableCancelledEvent cancelled && cancelled.getCause() != null
            ? cancelled.getCause().toString()
            : null;
    if (cause != null
        && (INTENTIONAL_CANCELLATION_CAUSES.contains(cause)
            || cause.startsWith(DRAFT_TASK_CANCEL_CAUSE_PREFIX))) {
      LOG.debug("[WorkflowFailure] Ignoring expected PROCESS_CANCELLED: {}", cause);
    } else {
      LOG.warn("[WorkflowFailure] PROCESS_CANCELLED: {}", event);
      storeFailureInDatabase(event, "PROCESS_CANCELLED");
    }
  }

  private void handleFlowableException(FlowableExceptionEvent exceptionEvent) {
    Throwable cause = exceptionEvent.getCause();
    String errorMessage = cause != null ? cause.getMessage() : "Unknown Flowable exception";

    String processInstanceId = null;
    // FlowableExceptionEvent may or may not carry entity context; pattern-match to reach it.
    if (exceptionEvent instanceof FlowableEngineEntityEvent entityEvent) {
      processInstanceId = entityEvent.getProcessInstanceId();
    }

    LOG.warn(
        "[WorkflowFailure] FLOWABLE_EXCEPTION: processInstanceId={}, error={}",
        processInstanceId,
        errorMessage);

    if (errorMessage.contains("No outgoing sequence flow")) {
      LOG.warn("[WorkflowFailure] DESIGN_ERROR: Missing conditional sequence flows detected");
      storeFailureInDatabase((FlowableEvent) exceptionEvent, "DESIGN_ERROR");
      terminateStuckProcess(processInstanceId, errorMessage);
    } else {
      storeFailureInDatabase((FlowableEvent) exceptionEvent, "FLOWABLE_EXCEPTION");
    }
  }

  private void storeFailureInDatabase(FlowableEvent event, String failureType) {
    try {
      String processInstanceId = getProcessInstanceId(event);
      if (processInstanceId == null) {
        LOG.debug(
            "[WorkflowFailure] Cannot store failure - missing processInstanceId for failureType: {}",
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
        LOG.debug(
            "[WorkflowFailure] ProcessInstance not found: processInstanceId={}", processInstanceId);
        return;
      }

      String businessKey = processInstance.getBusinessKey();
      if (businessKey == null || businessKey.isEmpty()) {
        LOG.debug(
            "[WorkflowFailure] Missing businessKey for processInstance: {}", processInstanceId);
        return;
      }

      UUID workflowInstanceId = UUID.fromString(businessKey);
      String workflowTriggerName =
          WorkflowHandler.getProcessDefinitionKeyFromId(processInstance.getProcessDefinitionId())
              .split("-")[0];
      String workflowName =
          TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(workflowTriggerName);
      String errorMessage = getErrorMessage(event);

      runtimeService.setVariable(processInstanceId, EXCEPTION_VARIABLE, errorMessage);

      markWorkflowInstanceAsFailed(
          workflowInstanceId, processInstanceId, failureType, errorMessage);

      if (isStageStatusEnabled(workflowName)) {
        addFailureStage(
            workflowInstanceId, processInstanceId, workflowName, failureType, errorMessage);
      }

      LOG.debug(
          "[WorkflowFailure] FAILURE_STORED: workflowInstanceId={}, failureType={}",
          workflowInstanceId,
          failureType);

    } catch (Exception e) {
      LOG.warn(
          "[WorkflowFailure] Failed to store workflow failure in database: {}", e.getMessage());
    }
  }

  private String getProcessInstanceId(FlowableEvent event) {
    String processInstanceId = null;
    // Flowable delivers event bodies via the FlowableEngineEntityEvent interface.
    if (event instanceof FlowableEngineEntityEvent entityEvent) {
      processInstanceId = entityEvent.getProcessInstanceId();
    }
    return processInstanceId;
  }

  private String getErrorMessage(FlowableEvent event) {
    String message = "Workflow failure: " + event.getType().name();
    // Exception events carry the underlying Throwable; extract its message when present.
    if (event instanceof FlowableExceptionEvent exceptionEvent) {
      message =
          exceptionEvent.getCause() != null
              ? exceptionEvent.getCause().getMessage()
              : "Unknown Flowable exception";
    }
    return message;
  }

  private void markWorkflowInstanceAsFailed(
      UUID workflowInstanceId, String processInstanceId, String failureType, String errorMessage) {
    try {
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      Map<String, Object> failureVariables = new HashMap<>();
      failureVariables.put(STATUS_VARIABLE_KEY, WorkflowInstance.WorkflowStatus.EXCEPTION.value());
      failureVariables.put("failureType", failureType);
      failureVariables.put("error", errorMessage);
      failureVariables.put("processInstanceId", processInstanceId);
      failureVariables.put(GLOBAL_NAMESPACE + "_" + EXCEPTION_VARIABLE, errorMessage);

      workflowInstanceRepository.updateWorkflowInstance(
          workflowInstanceId, System.currentTimeMillis(), failureVariables);

      LOG.debug(
          "[WorkflowFailure] INSTANCE_MARKED_FAILED: workflowInstanceId={}", workflowInstanceId);

    } catch (Exception e) {
      LOG.warn(
          "[WorkflowFailure] Failed to mark workflow instance as failed (workflowInstanceId={}): {}",
          workflowInstanceId,
          e.getMessage());
    }
  }

  private void addFailureStage(
      UUID workflowInstanceId,
      String processInstanceId,
      String workflowName,
      String failureType,
      String errorMessage) {
    try {
      WorkflowInstanceStateRepository stateRepository =
          (WorkflowInstanceStateRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

      UUID executionId = UUID.nameUUIDFromBytes(processInstanceId.getBytes());

      UUID stageId =
          stateRepository.addNewStageToInstance(
              WORKFLOW_FAILURE_LISTENER_STAGE,
              executionId,
              workflowInstanceId,
              workflowName,
              System.currentTimeMillis());

      Map<String, Object> stageData = new HashMap<>();
      stageData.put(STATUS_VARIABLE_KEY, "FAILED");
      stageData.put("failureType", failureType);
      stageData.put("processInstanceId", processInstanceId);
      stageData.put("exception", errorMessage);

      stateRepository.updateStage(stageId, System.currentTimeMillis(), stageData);

      LOG.debug(
          "[WorkflowFailure] FAILURE_STAGE_ADDED: workflowInstanceId={}, stageId={}",
          workflowInstanceId,
          stageId);

    } catch (Exception e) {
      LOG.warn(
          "[WorkflowFailure] Failed to add failure stage (workflowInstanceId={}): {}",
          workflowInstanceId,
          e.getMessage());
    }
  }

  private boolean isStageStatusEnabled(String workflowDefinitionKey) {
    boolean enabled = false;
    try {
      WorkflowDefinitionRepository workflowDefRepository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      WorkflowDefinition workflowDef =
          workflowDefRepository.getByName(
              null, workflowDefinitionKey, EntityUtil.Fields.EMPTY_FIELDS);

      if (workflowDef != null && workflowDef.getConfig() != null) {
        enabled = workflowDef.getConfig().getStoreStageStatus();
      } else {
        LOG.debug(
            "[WorkflowFailure] WorkflowDefinition '{}' not found or has no config",
            workflowDefinitionKey);
      }

    } catch (Exception e) {
      LOG.debug(
          "[WorkflowFailure] Failed to retrieve WorkflowDefinition '{}': {}",
          workflowDefinitionKey,
          e.getMessage());
    }
    return enabled;
  }

  private void terminateStuckProcess(String processInstanceId, String errorMessage) {
    try {
      if (processInstanceId == null) {
        LOG.debug("[WorkflowFailure] Cannot terminate process - missing processInstanceId");
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

        LOG.debug("[WorkflowFailure] PROCESS_TERMINATED: processInstanceId={}", processInstanceId);
      }
    } catch (Exception e) {
      LOG.warn(
          "[WorkflowFailure] TERMINATION_FAILED: processInstanceId={}: {}",
          processInstanceId,
          e.getMessage());
    }
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
