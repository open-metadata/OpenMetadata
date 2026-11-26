/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.Workflow.SUPERSEDED_BY_NEWER_RUN;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;

class WorkflowRunTerminationTest {
  private static final String WORKFLOW = "DomainLifecycle";
  private static final UUID TASK_ID = UUID.randomUUID();
  private static final UUID INSTANCE_ID = UUID.randomUUID();

  @Test
  void aClosedTasksRunIsTerminated() {
    WorkflowHandler handler =
        terminateWithCommittedTask(new Task().withStatus(TaskEntityStatus.Cancelled));

    verify(handler).terminateWorkflowInstance(INSTANCE_ID, WORKFLOW, SUPERSEDED_BY_NEWER_RUN);
  }

  @Test
  void aStillOpenTasksRunIsLeftRunning() {
    WorkflowHandler handler =
        terminateWithCommittedTask(new Task().withStatus(TaskEntityStatus.Open));

    verify(handler, never()).terminateWorkflowInstance(any(UUID.class), anyString(), anyString());
  }

  @Test
  void aTaskThatIsGoneLeavesTheRunAlone() {
    WorkflowHandler handler = terminateWithCommittedTask(null);

    verify(handler, never()).terminateWorkflowInstance(any(UUID.class), anyString(), anyString());
  }

  @Test
  void onlyRunsOfThePlaybookAreEndedByAnExit() {
    UUID playbook = UUID.randomUUID();
    Task playbookRun =
        new Task().withWorkflowDefinitionId(playbook).withWorkflowInstanceId(INSTANCE_ID);

    assertTrue(LifecycleTransitionRuns.isRunOf(playbookRun, playbook));
    assertFalse(LifecycleTransitionRuns.isRunOf(playbookRun, UUID.randomUUID()));
    assertFalse(
        LifecycleTransitionRuns.isRunOf(new Task().withWorkflowDefinitionId(playbook), playbook));
  }

  private static WorkflowHandler terminateWithCommittedTask(Task committed) {
    TaskRepository tasks = mock(TaskRepository.class);
    when(tasks.findCommittedTask(TASK_ID)).thenReturn(committed);
    WorkflowHandler handler = mock(WorkflowHandler.class);
    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<WorkflowHandler> workflowHandler = Mockito.mockStatic(WorkflowHandler.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(tasks);
      workflowHandler.when(WorkflowHandler::getInstance).thenReturn(handler);
      WorkflowRunTermination.terminateIfTaskClosed(WORKFLOW, TASK_ID, INSTANCE_ID);
    }
    return handler;
  }
}
