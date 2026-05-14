/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.tasks;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.service.Entity;

/**
 * Validation helpers for {@link Task} fields. Centralizes assignee/reviewer type checks and
 * payload schema validation so {@link org.openmetadata.service.jdbi3.TaskRepository} stays focused
 * on persistence orchestration.
 */
public final class TaskFieldValidator {

  private TaskFieldValidator() {}

  /**
   * Verify every assignee is a user or team. Throws {@link IllegalArgumentException} otherwise.
   */
  public static void validateAssignees(List<EntityReference> assignees) {
    validateUsersOrTeams(assignees, "Task can only be assigned to users or teams. Found: ");
  }

  /**
   * Verify every reviewer is a user or team. Throws {@link IllegalArgumentException} otherwise.
   */
  public static void validateReviewers(List<EntityReference> reviewers) {
    validateUsersOrTeams(reviewers, "Task reviewers must be users or teams. Found: ");
  }

  private static void validateUsersOrTeams(List<EntityReference> refs, String errorPrefix) {
    for (EntityReference ref : listOrEmpty(refs)) {
      String type = ref.getType();
      if (!Entity.USER.equals(type) && !Entity.TEAM.equals(type)) {
        throw new IllegalArgumentException(errorPrefix + type);
      }
    }
  }

  /**
   * Validate the task's creation-time payload against the form schema bound to its type.
   * No-op when the task has no type or no schema is configured.
   */
  public static void validatePayloadAgainstFormSchema(Task task) {
    if (task.getType() == null) {
      return;
    }
    TaskWorkflowLifecycleResolver.resolveBinding(task)
        .ifPresent(
            binding ->
                TaskFormSchemaValidator.validatePayload(
                    binding.createFormSchema(), task.getPayload()));
  }

  /**
   * Validate the resolution-time payload (or new-value override) against the transition form
   * schema. No-op when the task has no type or no resolution data is provided.
   */
  public static void validateResolutionPayloadAgainstFormSchema(
      Task task, String transitionId, Object resolvedPayload, String newValue) {
    if (task.getType() == null) {
      return;
    }
    if (resolvedPayload == null && newValue == null) {
      return;
    }

    TaskWorkflowLifecycleResolver.resolveSchema(task)
        .ifPresent(
            schema -> {
              TaskAvailableTransition transition =
                  TaskWorkflowLifecycleResolver.findTransition(task, transitionId);
              Object transitionSchema =
                  TaskWorkflowLifecycleResolver.resolveTransitionFormSchema(
                      schema, transitionId, transition);
              TaskFormSchemaValidator.validatePayload(
                  transitionSchema,
                  TaskWorkflowHandler.mergeResolutionPayload(task, resolvedPayload, newValue));
            });
  }
}
