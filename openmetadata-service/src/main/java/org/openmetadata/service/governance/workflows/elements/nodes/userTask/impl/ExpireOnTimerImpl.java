package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Fires when a user-task expiry boundary timer elapses. Writes the configured transitionId into
 * the node {@code result} variable so the outer workflow edge with that condition routes the
 * process downstream. If the workflow author also configured {@code expiryTimer.closeAsResolution}
 * — pushed in here as {@code resolutionTypeExpr} — the OM Task entity is closed with that
 * resolutionType (status derived by {@link TaskRepository#resolveTask}; e.g.
 * {@code Expired → Expired}). Skip the close when downstream nodes own the task lifecycle (the
 * GrantedAccess auto-revoke path lets RevokeAccess close the task as {@code Revoked}).
 *
 * <p>The close path is guarded against two failure modes that would otherwise corrupt task state:
 * (a) a malformed {@code taskEntityId} variable that would throw on UUID parse and dead-letter the
 * job, and (b) the rare race where a user resolves the task via the API in the same window the
 * timer-job acquisition loop picks up the boundary timer — without the guard the delegate would
 * overwrite a Completed/Approved/Revoked task with Expired and fire {@code postUpdate} hooks a
 * second time. Both are handled by early returns that log + continue the BPMN flow.
 */
@Slf4j
public class ExpireOnTimerImpl implements JavaDelegate {

  private Expression transitionIdExpr;
  // Optional — null when the workflow leaves closeAsResolution unset.
  private Expression resolutionTypeExpr;

  @Override
  public void execute(DelegateExecution execution) {
    String transitionId = (String) transitionIdExpr.getValue(execution);
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    varHandler.setNodeVariable(RESULT_VARIABLE, transitionId);

    String resolutionTypeValue =
        resolutionTypeExpr != null ? (String) resolutionTypeExpr.getValue(execution) : null;
    if (resolutionTypeValue != null && !resolutionTypeValue.isBlank()) {
      closeTaskWithResolution(execution, resolutionTypeValue);
    }

    LOG.info(
        "[ExpireOnTimer] User-task expiry timer fired in process instance {}; result='{}', closeAsResolution='{}'",
        execution.getProcessInstanceId(),
        transitionId,
        resolutionTypeValue);
  }

  @SuppressWarnings("IllegalCatch")
  private void closeTaskWithResolution(DelegateExecution execution, String resolutionTypeValue) {
    Object taskEntityId = execution.getVariable("taskEntityId");
    if (!(taskEntityId instanceof String taskIdStr) || taskIdStr.isBlank()) {
      LOG.warn(
          "[ExpireOnTimer] No taskEntityId variable in process instance {}; cannot close task on expiry",
          execution.getProcessInstanceId());
      return;
    }
    String actingUser = resolveActingUser(execution);
    try {
      UUID taskId = UUID.fromString(taskIdStr);
      resolveTaskExpired(taskId, actingUser, resolutionTypeValue);
    } catch (IllegalArgumentException badUuid) {
      LOG.error(
          "[ExpireOnTimer] taskEntityId '{}' is not a valid UUID; cannot close task on expiry",
          taskIdStr,
          badUuid);
    } catch (Exception e) {
      LOG.error(
          "[ExpireOnTimer] Expiry timer fired but closing task '{}' with resolutionType={} failed; workflow continues but task remains open",
          taskIdStr,
          resolutionTypeValue,
          e);
    }
  }

  private void resolveTaskExpired(UUID taskId, String actingUser, String resolutionTypeValue) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    // getFields("*") not the narrow set: TaskRepository.clearFields nulls comments when the field
    // is not requested, and resolveTask -> storeEntity serializes the task back via pojoToJson —
    // a narrow fetch silently erases all task comments on auto-close. Every other resolveTask
    // call site already loads the full field set for this reason.
    Task task = taskRepository.get(null, taskId, taskRepository.getFields("*"));
    if (!TaskRepository.NON_TERMINAL_STATUSES.contains(task.getStatus())) {
      LOG.info(
          "[ExpireOnTimer] Task '{}' already terminal (status={}); skipping expiry close to avoid double-resolve",
          taskId,
          task.getStatus());
      return;
    }
    EntityReference resolvedBy =
        Entity.getEntityReferenceByName(Entity.USER, actingUser, Include.NON_DELETED);
    TaskResolution resolution =
        new TaskResolution()
            .withType(TaskResolutionType.fromValue(resolutionTypeValue))
            .withResolvedBy(resolvedBy)
            .withResolvedAt(System.currentTimeMillis());
    taskRepository.resolveTask(task, resolution, actingUser);
    LOG.info(
        "[ExpireOnTimer] Task '{}' closed with resolutionType={} (acting user: {})",
        taskId,
        resolutionTypeValue,
        actingUser);
  }

  private String resolveActingUser(DelegateExecution execution) {
    Object updatedBy = execution.getVariable("taskUpdatedBy");
    return updatedBy instanceof String user && !user.isBlank() ? user : Entity.INGESTION_BOT_NAME;
  }
}
