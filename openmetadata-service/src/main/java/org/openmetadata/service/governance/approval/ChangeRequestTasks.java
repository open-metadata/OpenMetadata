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

package org.openmetadata.service.governance.approval;

import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.TaskRepository;

/** Post-commit updates to the review task of a change request: closing it, or explaining a hold. */
@Slf4j
final class ChangeRequestTasks {
  private ChangeRequestTasks() {}

  /** Adds a governance-bot comment to the review task, so its reviewers and requester see it. */
  static void comment(UUID taskId, String message) {
    if (taskId != null) {
      try {
        TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
        Task task = tasks.findCommittedTask(taskId);
        if (task != null) {
          tasks.addComment(
              task,
              new TaskComment()
                  .withId(UUID.randomUUID())
                  .withMessage(message)
                  .withAuthor(
                      Entity.getEntityReferenceByName(
                          Entity.USER, GOVERNANCE_BOT, Include.NON_DELETED))
                  .withCreatedAt(System.currentTimeMillis()));
        }
      } catch (Exception e) {
        LOG.warn("[ChangeRequest] Could not comment on review task {}: {}", taskId, e.getMessage());
      }
    }
  }

  static void closeTask(UUID taskId, String reason) {
    if (taskId != null) {
      try {
        TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
        Task task = tasks.findCommittedTask(taskId);
        if (task != null) {
          tasks.closeTask(task, GOVERNANCE_BOT, reason);
        }
        WorkflowHandler.getInstance().terminateTaskProcessInstance(taskId, reason);
      } catch (Exception e) {
        LOG.warn("[ChangeRequest] Could not close review task {}: {}", taskId, e.getMessage());
      }
    }
  }
}
