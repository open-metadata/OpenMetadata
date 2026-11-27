package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.type.Task;

/**
 * Guards the task-name lookup behind pipeline status writes. Checking every taskStatus entry with
 * a scan over the pipeline's tasks cost tasks × entries comparisons per request
 * (ANT-2026-1MWGXLC2), so the pipeline's names must be collected into a set once per call.
 */
class PipelineStatusTaskValidationTest {

  private static final long TS = 1785063454240L;

  /** A task that counts how often its name is read, to prove the lookup is set-based. */
  private static class CountingTask extends Task {
    private int nameReads;

    CountingTask(String name) {
      withName(name);
    }

    @Override
    public String getName() {
      nameReads++;
      return super.getName();
    }
  }

  private static Status taskStatus(String name) {
    return new Status().withName(name).withExecutionStatus(StatusType.Successful);
  }

  private static PipelineStatus status(List<Status> taskStatuses) {
    return new PipelineStatus()
        .withTimestamp(TS)
        .withExecutionStatus(StatusType.Successful)
        .withTaskStatus(taskStatuses);
  }

  private static List<Status> repeatedTaskStatus(String name, int count) {
    List<Status> taskStatuses = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      taskStatuses.add(taskStatus(name));
    }
    return taskStatuses;
  }

  private static Pipeline pipelineWithCountingTasks(int taskCount, List<CountingTask> tasks) {
    for (int i = 0; i < taskCount; i++) {
      tasks.add(new CountingTask("t" + i));
    }
    return new Pipeline().withTasks(new ArrayList<Task>(tasks));
  }

  private static void assertEachNameReadOnce(List<CountingTask> tasks) {
    for (CountingTask task : tasks) {
      assertEquals(1, task.nameReads);
    }
  }

  @Test
  @DisplayName("10000 entries naming the last task read each of 14000 task names exactly once")
  void repeatedEntriesAgainstLastTaskReadEachNameOnce() {
    int taskCount = 14_000;
    List<CountingTask> tasks = new ArrayList<>(taskCount);
    Pipeline pipeline = pipelineWithCountingTasks(taskCount, tasks);

    PipelineRepository.validateTasks(
        pipeline, List.of(status(repeatedTaskStatus("t" + (taskCount - 1), 10_000))));

    assertEachNameReadOnce(tasks);
  }

  @Test
  @DisplayName("a status naming every task once still reads each task name exactly once")
  void entriesAgainstEveryTaskReadEachNameOnce() {
    int taskCount = 14_000;
    List<CountingTask> tasks = new ArrayList<>(taskCount);
    List<Status> taskStatuses = new ArrayList<>(taskCount);
    for (int i = 0; i < taskCount; i++) {
      String name = "t" + i;
      tasks.add(new CountingTask(name));
      taskStatuses.add(taskStatus(name));
    }
    Pipeline pipeline = new Pipeline().withTasks(new ArrayList<Task>(tasks));

    PipelineRepository.validateTasks(pipeline, List.of(status(taskStatuses)));

    assertEachNameReadOnce(tasks);
  }

  @Test
  @DisplayName("an unknown task name is still refused")
  void unknownTaskNameIsRefused() {
    Pipeline pipeline =
        new Pipeline().withTasks(List.of(new Task().withName("a"), new Task().withName("b")));
    PipelineStatus incoming = status(List.of(taskStatus("a"), taskStatus("no_such_task")));

    IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class,
            () -> PipelineRepository.validateTasks(pipeline, List.of(incoming)));

    assertEquals("Invalid task name no_such_task", thrown.getMessage());
  }

  @Test
  @DisplayName("a status without entries passes on a pipeline without tasks")
  void emptyStatusPassesOnTasklessPipeline() {
    assertDoesNotThrow(
        () -> PipelineRepository.validateTasks(new Pipeline(), List.of(status(List.of()))));
  }

  @Test
  @DisplayName("task entries on a pipeline without tasks are refused with the same 400")
  void entriesOnTasklessPipelineAreRefused() {
    PipelineStatus incoming = status(List.of(taskStatus("a")));

    IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class,
            () -> PipelineRepository.validateTasks(new Pipeline(), List.of(incoming)));

    assertEquals("Invalid task name a", thrown.getMessage());
  }
}
