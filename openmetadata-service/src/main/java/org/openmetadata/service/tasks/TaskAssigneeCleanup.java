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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public final class TaskAssigneeCleanup {
  private static final String TASK_CLEANUP_FIELDS =
      "assignees,about,createdBy,reviewers,watchers,domains";
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
      cleanupTaskReference(repository, taskReference, fields, entityId, entityType);
    }
  }

  private static void cleanupTaskReference(
      final TaskRepository repository,
      final EntityReference taskReference,
      final Fields fields,
      final UUID entityId,
      final String entityType) {
    // Soft-deleted tasks stay deleted: drop the ASSIGNED_TO edge directly instead of running a
    // repository update, so a later restore will not resurrect the deleted assignee.
    if (Boolean.TRUE.equals(taskReference.getDeleted())) {
      deleteAssigneeEdge(repository, entityId, entityType, taskReference.getId());
      return;
    }
    try {
      final Task task =
          repository.get(null, taskReference.getId(), fields, Include.NON_DELETED, false);
      removeAssigneeFromLiveTask(repository, task, entityId, entityType);
    } catch (final EntityNotFoundException ex) {
      LOG.debug(
          "Task {} was deleted before assignee cleanup for {} {}",
          taskReference.getId(),
          entityType,
          entityId);
      deleteAssigneeEdge(repository, entityId, entityType, taskReference.getId());
    }
  }

  private static void deleteAssigneeEdge(
      final TaskRepository repository,
      final UUID entityId,
      final String entityType,
      final UUID taskId) {
    repository.deleteRelationship(
        entityId, entityType, taskId, Entity.TASK, Relationship.ASSIGNED_TO);
  }

  private static void removeAssigneeFromLiveTask(
      final TaskRepository repository,
      final Task task,
      final UUID entityId,
      final String entityType) {
    final List<EntityReference> assignees = task.getAssignees();
    if (nullOrEmpty(assignees)) {
      return;
    }
    final boolean changed =
        assignees.removeIf(ref -> entityId.equals(ref.getId()) && entityType.equals(ref.getType()));
    if (changed) {
      assignees.sort(EntityUtil.compareEntityReference);
      task.setAssignees(assignees);
      final boolean saved = repository.executeInTransaction(() -> saveIfLive(repository, task));
      if (!saved) {
        LOG.debug("Task {} was deleted during assignee cleanup", task.getId());
        deleteAssigneeEdge(repository, entityId, entityType, task.getId());
      }
    }
  }

  /**
   * The row lock makes the live check and the write one step. A soft delete that commits first
   * leaves no live row to lock, and one that comes later waits for this write, so the stored task
   * never goes back from deleted to live.
   */
  private static boolean saveIfLive(final TaskRepository repository, final Task task) {
    if (repository.getDao().findJsonByIdForUpdate(task.getId(), Include.NON_DELETED) == null) {
      return false;
    }
    final Task original = repository.find(task.getId(), Include.NON_DELETED, false);
    repository.update(null, original, task, Entity.ADMIN_USER_NAME, null, ASSIGNEE_PATCH_FIELDS);
    return true;
  }
}
