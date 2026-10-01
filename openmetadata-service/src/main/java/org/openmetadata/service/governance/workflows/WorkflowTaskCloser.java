package org.openmetadata.service.governance.workflows;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.TaskService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Cancels the OpenMetadata tasks still open for the user tasks of a workflow process, through the
 * same {@link TaskRepository#closeTask} used when a newer run supersedes an approval task.
 *
 * <p>Each open Flowable user task carries the id of its OpenMetadata task in the {@code
 * customTaskId} variable. Closing is best effort: a task that cannot be closed is logged and left as
 * it is, so it never stops the caller.
 */
@Slf4j
public class WorkflowTaskCloser {
  static final String CUSTOM_TASK_ID_VARIABLE = "customTaskId";

  private final TaskService taskService;
  private final TaskRepository taskRepository;

  public WorkflowTaskCloser(TaskService taskService, TaskRepository taskRepository) {
    this.taskService = taskService;
    this.taskRepository = taskRepository;
  }

  public void closeOpenTasks(String processInstanceId, String closedBy, String comment) {
    try {
      findTaskIds(processInstanceId).forEach(taskId -> closeOpenTask(taskId, closedBy, comment));
    } catch (RuntimeException e) {
      // Best effort by contract: any failure to look the tasks up must not block the caller.
      LOG.warn(
          "[WorkflowTerminate] Could not look up the open tasks of process instance {}",
          processInstanceId,
          e);
    }
  }

  private List<UUID> findTaskIds(String processInstanceId) {
    return taskService.createTaskQuery().processInstanceId(processInstanceId).list().stream()
        .map(userTask -> taskService.getVariable(userTask.getId(), CUSTOM_TASK_ID_VARIABLE))
        .filter(Objects::nonNull)
        .map(Object::toString)
        .distinct()
        .map(UUID::fromString)
        .toList();
  }

  private void closeOpenTask(UUID taskId, String closedBy, String comment) {
    try {
      Task task = taskRepository.findCommittedTask(taskId);
      if (task != null && !TaskRepository.isTerminalStatus(task.getStatus())) {
        taskRepository.closeTask(task, closedBy, comment);
      }
    } catch (RuntimeException e) {
      // Best effort by contract: one task that cannot be closed must not block the others.
      LOG.warn("[WorkflowTerminate] Could not close task {}", taskId, e);
    }
  }
}
