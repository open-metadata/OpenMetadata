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

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/**
 * Task-specific resource context that maps task assignees as owners for policy evaluation. This
 * allows the existing isOwner() policy condition to work with task assignees, and SubjectContext
 * handles team expansion automatically.
 */
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
    List<EntityReference> owners = new ArrayList<>();
    if (task.getAssignees() != null) {
      owners.addAll(task.getAssignees());
    }
    if (task.getCreatedBy() != null) {
      owners.add(task.getCreatedBy());
    }
    return owners;
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
