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

package org.openmetadata.service.tasks;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public final class TaskAssigneeCleanup {
  private static final String TASK_CLEANUP_FIELDS = "assignees,about,createdBy,reviewers,watchers";
  private static final Set<String> ASSIGNEE_PATCH_FIELDS = Set.of(TaskRepository.FIELD_ASSIGNEES);

  private TaskAssigneeCleanup() {}

  public static void removeAssignee(final UUID entityId, final String entityType) {
    final TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    removeAssignee(repository, entityId, entityType);
  }

  static void removeAssignee(
      final TaskRepository repository, final UUID entityId, final String entityType) {
    final List<EntityReference> taskReferences =
        repository.findTo(entityId, entityType, Relationship.ASSIGNED_TO, Entity.TASK, Include.ALL);
    final Fields fields = repository.getFields(TASK_CLEANUP_FIELDS);
    for (final EntityReference taskReference : taskReferences) {
      // A soft-deleted task stays deleted. Its ASSIGNED_TO edge goes with the rest of the deleted
      // entity's relationships once the hard delete finishes.
      if (!Boolean.TRUE.equals(taskReference.getDeleted())) {
        removeFromLiveTask(repository, taskReference.getId(), fields, entityId, entityType);
      }
    }
  }

  private static void removeFromLiveTask(
      final TaskRepository repository,
      final UUID taskId,
      final Fields fields,
      final UUID entityId,
      final String entityType) {
    final boolean live =
        repository.executeInTransaction(
            () -> removeFromLockedTask(repository, taskId, fields, entityId, entityType));
    if (!live) {
      LOG.debug(
          "Task {} was deleted before assignee cleanup of {} {}", taskId, entityType, entityId);
    }
  }

  /**
   * Reads, changes and writes the task under its row lock. The task is built from the locked row,
   * not from an earlier read, so a concurrent edit that committed in between is kept instead of
   * overwritten. A soft delete that commits first leaves no live row to lock, and one that comes
   * later waits for this write, so the task never goes back from deleted to live.
   */
  private static boolean removeFromLockedTask(
      final TaskRepository repository,
      final UUID taskId,
      final Fields fields,
      final UUID entityId,
      final String entityType) {
    final String lockedJson =
        repository.getDao().findJsonByIdForUpdate(taskId, Include.NON_DELETED);
    if (lockedJson == null) {
      return false;
    }
    final Task original = repository.getDao().jsonToEntity(lockedJson, taskId);
    repository.setFieldsInternal(original, fields);
    final List<EntityReference> remaining = withoutAssignee(original, entityId, entityType);
    if (remaining.size() != listOrEmpty(original.getAssignees()).size()) {
      final Task updated = JsonUtils.deepCopy(original, Task.class);
      updated.setAssignees(remaining);
      repository.update(
          null, original, updated, Entity.ADMIN_USER_NAME, null, ASSIGNEE_PATCH_FIELDS);
    }
    return true;
  }

  private static List<EntityReference> withoutAssignee(
      final Task task, final UUID entityId, final String entityType) {
    final List<EntityReference> remaining = new ArrayList<>(listOrEmpty(task.getAssignees()));
    remaining.removeIf(ref -> entityId.equals(ref.getId()) && entityType.equals(ref.getType()));
    remaining.sort(EntityUtil.compareEntityReference);
    return remaining;
  }
}
