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

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

public final class TaskAssigneeCleanup {
  private TaskAssigneeCleanup() {}

  public static void removeAssignee(UUID entityId, String entityType) {
    TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    List<EntityReference> taskReferences =
        repository.findTo(entityId, entityType, Relationship.ASSIGNED_TO, Entity.TASK, Include.ALL);
    Fields fields = repository.getFields("assignees,about,createdBy,reviewers,watchers");
    for (EntityReference taskReference : taskReferences) {
      removeAssignee(
          repository, repository.get(null, taskReference.getId(), fields), entityId, entityType);
    }
  }

  private static void removeAssignee(
      TaskRepository repository, Task task, UUID entityId, String entityType) {
    List<EntityReference> assignees = task.getAssignees();
    boolean changed =
        assignees != null
            && assignees.removeIf(
                reference ->
                    reference.getId().equals(entityId) && reference.getType().equals(entityType));
    if (changed) {
      assignees.sort(EntityUtil.compareEntityReference);
      task.setAssignees(assignees);
      repository.createOrUpdate(null, task, Entity.ADMIN_USER_NAME);
    }
  }
}
