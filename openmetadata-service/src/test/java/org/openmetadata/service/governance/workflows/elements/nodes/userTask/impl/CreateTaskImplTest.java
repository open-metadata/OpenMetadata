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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskEntityStatus;

class CreateTaskImplTest {

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
            .withWorkflowStageId(CreateTaskImpl.PENDING_WORKFLOW_START_STAGE_ID)
            .withAssignees(List.of(existingAssignee));

    List<EntityReference> resolved =
        CreateTaskImpl.resolveExistingTaskAssignees(
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
        CreateTaskImpl.resolveExistingTaskAssignees(
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
        CreateTaskImpl.resolveExistingTaskAssignees(existingTask, List.of(workflowAssignee), null);

    assertEquals(List.of(workflowAssignee), resolved);
  }

  @Test
  void testShouldSkipDeletedWorkflowManagedDraftTaskWhenPendingDraftWasRemoved() {
    assertTrue(
        CreateTaskImpl.shouldSkipDeletedWorkflowManagedDraftTask(UUID.randomUUID(), true, null));
  }

  @Test
  void testShouldNotSkipTaskMaterializationForWorkflowNativeOrExistingTasks() {
    Task existingTask = new Task().withId(UUID.randomUUID());

    assertFalse(
        CreateTaskImpl.shouldSkipDeletedWorkflowManagedDraftTask(UUID.randomUUID(), false, null));
    assertFalse(CreateTaskImpl.shouldSkipDeletedWorkflowManagedDraftTask(null, true, null));
    assertFalse(
        CreateTaskImpl.shouldSkipDeletedWorkflowManagedDraftTask(
            UUID.randomUUID(), true, existingTask));
  }

  @Test
  void testIsTerminalTaskStatusReturnsTrueForResolvedStates() {
    assertTrue(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.Approved));
    assertTrue(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.Rejected));
    assertTrue(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.Completed));
    assertTrue(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.Cancelled));
    assertTrue(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.Failed));
  }

  @Test
  void testIsTerminalTaskStatusReturnsFalseForOpenStates() {
    assertFalse(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.Open));
    assertFalse(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.InProgress));
    assertFalse(CreateTaskImpl.isTerminalTaskStatus(TaskEntityStatus.Pending));
    assertFalse(CreateTaskImpl.isTerminalTaskStatus(null));
  }
}
