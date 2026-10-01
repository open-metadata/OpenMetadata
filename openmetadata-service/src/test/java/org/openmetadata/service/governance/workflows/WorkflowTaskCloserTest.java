package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flowable.engine.TaskService;
import org.flowable.task.api.TaskQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.service.jdbi3.TaskRepository;

class WorkflowTaskCloserTest {

  private static final String PROCESS_ID = "main-child";
  private static final String CLOSED_BY = "admin";
  private static final String COMMENT = "Terminated by admin";

  private final TaskService taskService = mock(TaskService.class);
  private final TaskQuery taskQuery = mock(TaskQuery.class, RETURNS_SELF);
  private final TaskRepository taskRepository = mock(TaskRepository.class);
  private final WorkflowTaskCloser closer = new WorkflowTaskCloser(taskService, taskRepository);

  @BeforeEach
  void setUp() {
    when(taskService.createTaskQuery()).thenReturn(taskQuery);
  }

  @Test
  void eachOpenTaskOfTheProcessIsClosedOnce() {
    Task open = storedTask(TaskEntityStatus.Open);
    Task inProgress = storedTask(TaskEntityStatus.InProgress);
    givenUserTasks(
        Map.of("approve-1", open.getId(), "approve-2", inProgress.getId(), "review", open.getId()));

    closer.closeOpenTasks(PROCESS_ID, CLOSED_BY, COMMENT);

    verify(taskQuery).processInstanceId(PROCESS_ID);
    verify(taskRepository, times(1)).closeTask(open, CLOSED_BY, COMMENT);
    verify(taskRepository, times(1)).closeTask(inProgress, CLOSED_BY, COMMENT);
  }

  @Test
  void aTaskAlreadyResolvedOrGoneIsLeftAlone() {
    Task completed = storedTask(TaskEntityStatus.Completed);
    UUID missingTaskId = UUID.randomUUID();
    givenUserTasks(Map.of("approve", completed.getId(), "review", missingTaskId));

    closer.closeOpenTasks(PROCESS_ID, CLOSED_BY, COMMENT);

    verify(taskRepository, never()).closeTask(any(), anyString(), anyString());
  }

  @Test
  void aTaskThatCannotBeClosedDoesNotStopTheOthers() {
    Task broken = storedTask(TaskEntityStatus.Open);
    Task healthy = storedTask(TaskEntityStatus.Open);
    givenUserTasks(Map.of("approve-1", broken.getId(), "approve-2", healthy.getId()));
    when(taskRepository.closeTask(broken, CLOSED_BY, COMMENT))
        .thenThrow(new IllegalStateException("user not found"));

    assertDoesNotThrow(() -> closer.closeOpenTasks(PROCESS_ID, CLOSED_BY, COMMENT));

    verify(taskRepository).closeTask(healthy, CLOSED_BY, COMMENT);
  }

  @Test
  void aFailedLookupDoesNotBlockTheCaller() {
    when(taskQuery.list()).thenThrow(new IllegalStateException("engine is closed"));

    assertDoesNotThrow(() -> closer.closeOpenTasks(PROCESS_ID, CLOSED_BY, COMMENT));

    verify(taskRepository, never()).closeTask(any(), anyString(), anyString());
  }

  private Task storedTask(TaskEntityStatus status) {
    Task task = new Task().withId(UUID.randomUUID()).withStatus(status);
    when(taskRepository.findCommittedTask(task.getId())).thenReturn(task);
    return task;
  }

  private void givenUserTasks(Map<String, UUID> taskIdByFlowableTaskId) {
    List<org.flowable.task.api.Task> userTasks =
        taskIdByFlowableTaskId.keySet().stream().map(this::userTask).toList();
    when(taskQuery.list()).thenReturn(userTasks);
    taskIdByFlowableTaskId.forEach(
        (flowableTaskId, taskId) ->
            when(taskService.getVariable(
                    flowableTaskId, WorkflowTaskCloser.CUSTOM_TASK_ID_VARIABLE))
                .thenReturn(taskId.toString()));
  }

  private org.flowable.task.api.Task userTask(String flowableTaskId) {
    org.flowable.task.api.Task userTask = mock(org.flowable.task.api.Task.class);
    when(userTask.getId()).thenReturn(flowableTaskId);
    return userTask;
  }
}
