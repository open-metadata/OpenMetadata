/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;

class CreateTaskTest {

  @Test
  void testResolveExistingTaskAssigneesDefersToCurrentDatabaseAssignmentsDuringPendingStart() {
    EntityReference existingAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user2")
            .withFullyQualifiedName("shared_user2");
    EntityReference workflowAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user1")
            .withFullyQualifiedName("shared_user1");

    Task existingTask =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowStageId(CreateTask.PENDING_WORKFLOW_START_STAGE_ID)
            .withAssignees(List.of(existingAssignee));

    List<EntityReference> resolved =
        CreateTask.resolveExistingTaskAssignees(
            existingTask, List.of(workflowAssignee), List.of(workflowAssignee));

    assertNull(resolved);
  }

  @Test
  void testResolveExistingTaskAssigneesPreservesDatabaseAssignmentsAfterMaterialization() {
    EntityReference existingAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user2")
            .withFullyQualifiedName("shared_user2");
    EntityReference workflowAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user1")
            .withFullyQualifiedName("shared_user1");

    Task existingTask =
        new Task()
            .withId(UUID.randomUUID())
            .withWorkflowStageId("review")
            .withAssignees(List.of(existingAssignee));

    List<EntityReference> resolved =
        CreateTask.resolveExistingTaskAssignees(
            existingTask, List.of(workflowAssignee), List.of(workflowAssignee));

    assertNull(resolved);
  }

  @Test
  void testResolveExistingTaskAssigneesUsesWorkflowAssigneesForWorkflowNativeTasks() {
    EntityReference workflowAssignee =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("shared_user1")
            .withFullyQualifiedName("shared_user1");

    Task existingTask =
        new Task().withId(UUID.randomUUID()).withWorkflowStageId("review").withAssignees(null);

    List<EntityReference> resolved =
        CreateTask.resolveExistingTaskAssignees(existingTask, List.of(workflowAssignee), null);

    assertEquals(List.of(workflowAssignee), resolved);
  }

  @Test
  void testShouldSkipDeletedWorkflowManagedDraftTaskWhenPendingDraftWasRemoved() {
    assertTrue(CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(UUID.randomUUID(), true, null));
  }

  @Test
  void testShouldNotSkipTaskMaterializationForWorkflowNativeOrExistingTasks() {
    Task existingTask = new Task().withId(UUID.randomUUID());

    assertFalse(
        CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(UUID.randomUUID(), false, null));
    assertFalse(CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(null, true, null));
    assertFalse(
        CreateTask.shouldSkipDeletedWorkflowManagedDraftTask(
            UUID.randomUUID(), true, existingTask));
  }

  @Test
  void testFindExistingTaskWithRetryBridgesTransientDraftVisibilityGap() {
    UUID taskId = UUID.randomUUID();
    TaskRepository taskRepository = Mockito.mock(TaskRepository.class);
    Task existingTask = new Task().withId(taskId);

    when(taskRepository.find(taskId, Include.ALL))
        .thenThrow(EntityNotFoundException.byId(taskId.toString()))
        .thenReturn(existingTask);

    Task resolvedTask = CreateTask.findExistingTaskWithRetry(taskRepository, taskId, true);

    assertEquals(existingTask, resolvedTask);
    verify(taskRepository, times(2)).find(taskId, Include.ALL);
  }

  @Test
  void testFindExistingTaskWithRetryDoesSingleLookupForNonWorkflowManagedTasks() {
    UUID taskId = UUID.randomUUID();
    TaskRepository taskRepository = Mockito.mock(TaskRepository.class);
    Task existingTask = new Task().withId(taskId);

    when(taskRepository.find(taskId, Include.ALL)).thenReturn(existingTask);

    Task resolvedTask = CreateTask.findExistingTaskWithRetry(taskRepository, taskId, false);

    assertEquals(existingTask, resolvedTask);
    verify(taskRepository).find(taskId, Include.ALL);
  }

  @Test
  void testFindExistingTaskWithRetryReturnsNullAfterExhaustingWorkflowManagedLookup() {
    UUID taskId = UUID.randomUUID();
    TaskRepository taskRepository = Mockito.mock(TaskRepository.class);

    when(taskRepository.find(taskId, Include.ALL))
        .thenThrow(EntityNotFoundException.byId(taskId.toString()));

    Task resolvedTask = CreateTask.findExistingTaskWithRetry(taskRepository, taskId, true);

    assertNull(resolvedTask);
    verify(taskRepository, times(6)).find(taskId, Include.ALL);
  }

  @Test
  void testIsTerminalTaskStatusReturnsTrueForResolvedStates() {
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Approved));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Rejected));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Completed));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Cancelled));
    assertTrue(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Failed));
  }

  @Test
  void testIsTerminalTaskStatusReturnsFalseForOpenStates() {
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Open));
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.InProgress));
    assertFalse(CreateTask.isTerminalTaskStatus(TaskEntityStatus.Pending));
    assertFalse(CreateTask.isTerminalTaskStatus(null));
  }
}
