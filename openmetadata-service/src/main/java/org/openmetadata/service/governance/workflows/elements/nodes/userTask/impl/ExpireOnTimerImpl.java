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
 * resolutionType (and the matching status derived by {@link TaskRepository#resolveTask}, e.g.
 * {@code TimedOut → Expired}). Skip the close when downstream nodes own the task lifecycle (the
 * GrantedAccess auto-revoke path lets RevokeAccess close the task as {@code Revoked}).
 */
@Slf4j
public class ExpireOnTimerImpl implements JavaDelegate {

  private Expression transitionIdExpr;
  private Expression
      resolutionTypeExpr; // optional — null when the workflow leaves closeAsResolution unset

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
    UUID taskId = UUID.fromString(taskIdStr);
    String actingUser = resolveActingUser(execution);
    try {
      resolveTaskExpired(taskId, actingUser, resolutionTypeValue);
    } catch (Exception e) {
      LOG.error(
          "[ExpireOnTimer] Expiry timer fired but closing task '{}' with resolutionType={} failed; workflow continues but task remains open",
          taskId,
          resolutionTypeValue,
          e);
    }
  }

  private void resolveTaskExpired(UUID taskId, String actingUser, String resolutionTypeValue) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task task =
        taskRepository.get(
            null,
            taskId,
            taskRepository.getFields("assignees,reviewers,about,createdBy,payload,resolution"));
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
