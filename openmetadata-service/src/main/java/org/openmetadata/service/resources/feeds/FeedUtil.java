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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

public final class FeedUtil {

  private FeedUtil() {}

  public static void addPost(Thread thread, Post post) {
    // Add new post to the thread
    thread.getPosts().add(post);
    thread.withPostsCount(thread.getPosts().size());
  }

  public static void cleanUpTaskForAssignees(UUID entityId, String entityType) {
    List<String> userTasks =
        Entity.getCollectionDAO().feedDAO().listThreadsByTaskAssignee(entityId.toString());
    List<Thread> threads = JsonUtils.readObjects(userTasks, Thread.class);
    for (Thread thread : threads) {
      List<EntityReference> assignees = thread.getTask().getAssignees();
      assignees.removeIf(
          entityReference ->
              entityReference.getId().equals(entityId)
                  && entityReference.getType().equals(entityType));
      thread.getTask().setAssignees(assignees);
      Entity.getCollectionDAO().feedDAO().update(thread.getId(), JsonUtils.pojoToJson(thread));
    }
  }
}
