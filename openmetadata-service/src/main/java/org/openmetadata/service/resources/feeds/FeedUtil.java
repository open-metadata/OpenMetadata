/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.feeds;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

public final class FeedUtil {

  private FeedUtil() {}

  public static void addPost(Thread thread, Post post) {
    // Add new post to the thread
    thread.getPosts().add(post);
    thread.withPostsCount(thread.getPosts().size());
  }

  public static void cleanUpTaskForAssignees(UUID entityId, String entityType) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    List<EntityReference> taskRefs =
        taskRepository.findTo(
            entityId, entityType, Relationship.ASSIGNED_TO, Entity.TASK, Include.ALL);

    Fields taskFields = taskRepository.getFields("assignees,about,createdBy,reviewers,watchers");
    for (EntityReference taskRef : taskRefs) {
      Task task = taskRepository.get(null, taskRef.getId(), taskFields);
      List<EntityReference> assignees = task.getAssignees();
      if (assignees == null || assignees.isEmpty()) {
        continue;
      }

      boolean changed =
          assignees.removeIf(
              entityReference ->
                  entityReference.getId().equals(entityId)
                      && entityReference.getType().equals(entityType));

      if (!changed) {
        continue;
      }

      assignees.sort(EntityUtil.compareEntityReference);
      task.setAssignees(assignees);
      taskRepository.createOrUpdate(null, task, Entity.ADMIN_USER_NAME);
    }
  }
}
