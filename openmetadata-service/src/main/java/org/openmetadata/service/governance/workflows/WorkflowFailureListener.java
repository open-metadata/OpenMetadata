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
import org.flowable.engine.HistoryService;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngines;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.delegate.event.FlowableCancelledEvent;
import org.flowable.engine.impl.persistence.entity.ExecutionEntity;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.variable.api.history.HistoricVariableInstance;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class WorkflowFailureListener implements FlowableEventListener {

  public static final String WORKFLOW_FAILURE_LISTENER_STAGE = "workflowFailureListener";

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
        LOG.error("[WorkflowFailure] JOB_EXECUTION_FAILURE: {}", event);
        storeFailureInDatabase(event, "JOB_EXECUTION_FAILURE");
        break;
      case PROCESS_COMPLETED_WITH_ERROR_END_EVENT:
        handleProcessCompletedWithErrorEndEvent(event);
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

  private void handleProcessCompletedWithErrorEndEvent(FlowableEvent event) {
    // Terminate end event fired by a supersede caller carries the terminationReason variable on
    // the still-alive ExecutionEntity; WorkflowInstanceListener stamps SUPERSEDED separately.
    if (isIntentionalTerminationEvent(event)) {
      LOG.debug(
          "[WorkflowFailure] Ignoring intentional termination for processInstanceId={}",
          getProcessInstanceId(event));
    } else {
      LOG.error("[WorkflowFailure] PROCESS_COMPLETED_WITH_ERROR: {}", event);
      storeFailureInDatabase(event, "PROCESS_ERROR");
    }
  }

  private void handleProcessCancelled(FlowableEvent event) {
    String intentionalCause = extractIntentionalCancellationCause(event);
    if (intentionalCause != null) {
      LOG.debug("[WorkflowFailure] Ignoring expected PROCESS_CANCELLED: {}", intentionalCause);
    } else {
      LOG.error("[WorkflowFailure] PROCESS_CANCELLED: {}", event);
      storeFailureInDatabase(event, "PROCESS_CANCELLED");
    }
  }

  private boolean isIntentionalTerminationEvent(FlowableEvent event) {
    // Two-source read for reliability: the event's ExecutionEntity carries variables in-memory
    // (fast path, works while the entity is still cached), and HistoricVariableInstance survives
    // the teardown (fallback for child-execution events where the process-scoped variable isn't
    // resolved locally). Either source proves the terminate was intentional.
    return isReasonSetOnEventEntity(event)
        || isReasonSetOnHistoricInstance(getProcessInstanceId(event));
  }

  private boolean isReasonSetOnEventEntity(FlowableEvent event) {
    boolean set = false;
    // Flowable delivers event bodies as raw types via FlowableEngineEntityEvent#getEntity(); the
    // entity for a terminate end event is the ExecutionEntity that owns the variables map.
    if (event instanceof FlowableEngineEntityEvent entityEvent
        && entityEvent.getEntity() instanceof ExecutionEntity executionEntity) {
      Object reason = executionEntity.getVariable(Workflow.TERMINATION_REASON_VARIABLE);
      // Variable comes back as untyped Object from Flowable's variable map.
      if (reason instanceof String reasonStr && !reasonStr.isBlank()) {
        set = true;
      }
    }
    return set;
  }

  private boolean isReasonSetOnHistoricInstance(String processInstanceId) {
    boolean set = false;
    if (processInstanceId != null) {
      try {
        HistoryService historyService =
            ProcessEngines.getDefaultProcessEngine().getHistoryService();
        HistoricVariableInstance historic =
            historyService
                .createHistoricVariableInstanceQuery()
                .processInstanceId(processInstanceId)
                .variableName(Workflow.TERMINATION_REASON_VARIABLE)
                .singleResult();
        if (historic != null
            && historic.getValue() instanceof String reasonStr
            && !reasonStr.isBlank()) {
          set = true;
        }
      } catch (Exception e) {
        LOG.debug(
            "[WorkflowFailure] Historic terminationReason lookup failed for processInstanceId={}: {}",
            processInstanceId,
            e.getMessage());
      }
    }
    return set;
  }

  private String extractIntentionalCancellationCause(FlowableEvent event) {
    String intentionalCause = null;
    // Flowable dispatches FlowableEvent for every event type; only cancellations carry a cause,
    // so pattern-match to reach the FlowableCancelledEvent.getCause() reason string.
    if (event instanceof FlowableCancelledEvent cancelledEvent) {
      String candidate = causeToString(cancelledEvent.getCause());
      if (isIntentionalCancellationCause(candidate)) {
        intentionalCause = candidate;
      }
    }
    return intentionalCause;
  }

  private boolean isIntentionalCancellationCause(String cause) {
    boolean intentional = false;
    if (cause != null) {
      intentional =
          INTENTIONAL_CANCELLATION_CAUSES.contains(cause)
              || cause.startsWith(DRAFT_TASK_CANCEL_CAUSE_PREFIX);
    }
    return intentional;
  }

  private String causeToString(Object cause) {
    return cause == null ? null : cause.toString();
  }

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
        LOG.warn(
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

      LOG.warn(
          "[WorkflowFailure] FAILURE_STORED: workflowInstanceId={}, processInstanceId={}, failureType={}",
          workflowInstanceId,
          processInstanceId,
          failureType);

    } catch (Exception e) {
      LOG.error(
          "[WorkflowFailure] Failed to store workflow failure in database: error={}",
          e.getMessage(),
          e);
    }
  }

  private String getProcessInstanceId(FlowableEvent event) {
    if (event instanceof FlowableEngineEntityEvent entityEvent) {
      return entityEvent.getProcessInstanceId();
    }
    return null;
  }

  private String getErrorMessage(FlowableEvent event) {
    if (event instanceof FlowableExceptionEvent exceptionEvent) {
      return exceptionEvent.getCause() != null
          ? exceptionEvent.getCause().getMessage()
          : "Unknown Flowable exception";
    }
    return "Workflow failure: " + event.getType().name();
  }

  private void markWorkflowInstanceAsFailed(
      UUID workflowInstanceId, String processInstanceId, String failureType, String errorMessage) {
    try {
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      Map<String, Object> failureVariables = new HashMap<>();
      failureVariables.put("status", "EXCEPTION");
      failureVariables.put("failureType", failureType);
      failureVariables.put("error", errorMessage);
      failureVariables.put("processInstanceId", processInstanceId);
      failureVariables.put(GLOBAL_NAMESPACE + "_" + EXCEPTION_VARIABLE, errorMessage);

      workflowInstanceRepository.updateWorkflowInstance(
          workflowInstanceId, System.currentTimeMillis(), failureVariables);

      LOG.info(
          "[WorkflowFailure] INSTANCE_MARKED_FAILED: workflowInstanceId={}, status=EXCEPTION",
          workflowInstanceId);

    } catch (Exception e) {
      LOG.error(
          "[WorkflowFailure] Failed to mark workflow instance as failed: workflowInstanceId={}, error={}",
          workflowInstanceId,
          e.getMessage(),
          e);
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
      stageData.put("status", "FAILED");
      stageData.put("failureType", failureType);
      stageData.put("processInstanceId", processInstanceId);
      stageData.put("exception", errorMessage);

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

  private boolean isStageStatusEnabled(String workflowDefinitionKey) {
    try {
      WorkflowDefinitionRepository workflowDefRepository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

      WorkflowDefinition workflowDef =
          workflowDefRepository.getByName(
              null, workflowDefinitionKey, EntityUtil.Fields.EMPTY_FIELDS);

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

  private void terminateStuckProcess(String processInstanceId, String errorMessage) {
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

  @Override
  public boolean isFailOnException() {
    // Return true if the listener should fail the operation on an exception
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
