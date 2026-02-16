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

package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.service.Entity;

public class TaskIndex implements SearchIndex {
  final Task task;
  final Set<String> excludeFields = Set.of("comments");

  public TaskIndex(Task task) {
    this.task = task;
  }

  @Override
  public Object getEntity() {
    return task;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(task, Entity.TASK);
    doc.putAll(commonAttributes);
    doc.put("taskId", task.getTaskId());
    doc.put("category", task.getCategory() != null ? task.getCategory().value() : null);
    doc.put("type", task.getType() != null ? task.getType().value() : null);
    doc.put("status", task.getStatus() != null ? task.getStatus().value() : null);
    doc.put("priority", task.getPriority() != null ? task.getPriority().value() : null);
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
