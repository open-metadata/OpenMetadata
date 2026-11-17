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

import static org.openmetadata.service.governance.workflows.Workflow.SUPERSEDED_BY_NEWER_RUN;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.AsyncService.DatabaseOperation;

/** Ends the workflow run that waits on a task, once that task has been closed. */
@Slf4j
public final class WorkflowRunTermination {
  private WorkflowRunTermination() {}

  /**
   * Terminates the run on the shared async executor, in its own transaction, so deleting the
   * Flowable process never poisons the caller's transaction. Flowable runs as a standalone engine
   * with its own JDBC connection, so the caller's closeTask has already committed. The worker reads
   * the task straight from the database to see that committed status, and only terminates the run
   * when the task is terminal, so a still-live task is never orphaned.
   */
  public static void terminateOnceTaskCloses(
      String mainWorkflowName, UUID taskId, UUID workflowInstanceId) {
    AsyncService.getInstance()
        .submitDatabaseTask(
            DatabaseOperation.WORKFLOW_TASK,
            workflowInstanceId.toString(),
            () -> {
              terminateIfTaskClosed(mainWorkflowName, taskId, workflowInstanceId);
              return null;
            })
        .exceptionally(
            ex -> {
              LOG.error(
                  "[Workflow] Failed to terminate workflow instance '{}'", workflowInstanceId, ex);
              return null;
            });
  }

  private static void terminateIfTaskClosed(
      String mainWorkflowName, UUID taskId, UUID workflowInstanceId) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task task = taskRepository.findCommittedTask(taskId);
    if (task != null && TaskRepository.isTerminalStatus(task.getStatus())) {
      WorkflowHandler.getInstance()
          .terminateWorkflowInstance(workflowInstanceId, mainWorkflowName, SUPERSEDED_BY_NEWER_RUN);
    } else {
      LOG.debug(
          "[Workflow] Task '{}' is not terminal (status={}); leaving its workflow run intact",
          taskId,
          task == null ? null : task.getStatus());
    }
  }
}
