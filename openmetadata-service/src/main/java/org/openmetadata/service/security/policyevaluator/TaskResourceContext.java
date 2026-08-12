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

package org.openmetadata.service.security.policyevaluator;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/**
 * Task-specific resource context.
 *
 * <p>{@code getOwners()} returns the owners of the entity the task is <em>about</em>, so the
 * standard {@code isOwner()} SpEL condition retains its conventional meaning ("user owns the
 * target entity"). The filer / assignee / reviewer roles are exposed via dedicated SpEL
 * conditions ({@code isTaskFiler()}, {@code isTaskAssignee()}, {@code isTaskReviewer()}) which
 * read the Task entity directly through this context's {@link #getEntity()}.
 */
@Slf4j
public class TaskResourceContext implements ResourceContextInterface {
  private final Task task;

  public TaskResourceContext(Task task) {
    this.task = task;
  }

  @Override
  public String getResource() {
    return Entity.TASK;
  }

  @Override
  public List<EntityReference> getOwners() {
    EntityReference about = task.getAbout();
    if (about == null) {
      return List.of();
    }
    try {
      return Entity.getOwners(about);
    } catch (Exception e) {
      // The target entity may have been hard-deleted while the task still exists. Degrade to no
      // owners rather than surfacing a 500 from a policy evaluation path.
      LOG.debug(
          "TaskResourceContext.getOwners: failed to resolve owners for task {} about {} ({})",
          task.getId(),
          about.getFullyQualifiedName(),
          e.getMessage());
      return List.of();
    }
  }

  @Override
  public List<TagLabel> getTags() {
    return task.getTags();
  }

  @Override
  public EntityInterface getEntity() {
    return task;
  }

  @Override
  public List<EntityReference> getDomains() {
    return task.getDomains() != null ? task.getDomains() : List.of();
  }
}
