/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.tasks;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.util.JsonPatchUtils;

/**
 * The operations resolving a task needs on the entity the task is about. They match what a PATCH
 * making the same change to that entity needs, so resolving a task is never a weaker route to the
 * same write.
 */
@Slf4j
public final class TaskTargetOperations {
  private static final Set<TaskEntityType> LABEL_TASK_TYPES =
      Set.of(TaskEntityType.TagUpdate, TaskEntityType.TierUpdate);
  private static final List<String> LABEL_FIELDS =
      List.of("newTier", "tagsToAdd", "tagsToRemove", "suggestedValue");
  private static final TypeReference<List<TagLabel>> TAG_LABELS = new TypeReference<>() {};

  private TaskTargetOperations() {}

  /**
   * The operation for the task type, raised to what the entity's own PATCH requires for that field:
   * EditAll for another user's profile, or the entity type's override for the field.
   */
  public static MetadataOperation forTarget(
      EntityReference about, MetadataOperation taskOperation, String userName) {
    MetadataOperation operation = taskOperation;
    if (taskOperation != null && taskOperation != MetadataOperation.EDIT_ALL) {
      operation =
          isAnotherUser(about, userName)
              ? MetadataOperation.EDIT_ALL
              : fieldOperation(about.getType(), taskOperation);
    }
    return operation;
  }

  /**
   * The operation each tag label the resolution adds or removes needs, by the label's
   * classification: a tier, a certification, a classification tag or a glossary term.
   */
  public static Set<MetadataOperation> forTagLabels(
      Task task, Object requestPayload, String newValue) {
    Set<MetadataOperation> operations = new LinkedHashSet<>();
    if (task.getType() != null && LABEL_TASK_TYPES.contains(task.getType())) {
      labelsOf(task, requestPayload, newValue).stream()
          .map(JsonPatchUtils::mapTagToOperation)
          .filter(Objects::nonNull)
          .forEach(operations::add);
    }
    return operations;
  }

  private static boolean isAnotherUser(EntityReference about, String userName) {
    return Entity.USER.equals(about.getType())
        && !userName.equals(about.getName())
        && !userName.equals(about.getFullyQualifiedName());
  }

  private static MetadataOperation fieldOperation(
      String entityType, MetadataOperation taskOperation) {
    String field = ResourceRegistry.getField(taskOperation);
    MetadataOperation override =
        field == null ? null : ResourceRegistry.getEntityEditOperation(entityType, field);
    return override != null ? override : taskOperation;
  }

  // The resolution applies the task's payload overlaid with the request's, and a resolver's new
  // value can stand in for either, so every label any of them names is counted.
  private static List<TagLabel> labelsOf(Task task, Object requestPayload, String newValue) {
    List<TagLabel> labels = new ArrayList<>();
    labels.addAll(payloadLabels(task.getPayload()));
    labels.addAll(payloadLabels(requestPayload));
    labels.addAll(readEncodedLabels(newValue));
    return labels;
  }

  private static List<TagLabel> payloadLabels(Object payload) {
    List<TagLabel> labels = new ArrayList<>();
    if (payload != null) {
      JsonNode node = JsonUtils.valueToTree(payload);
      LABEL_FIELDS.forEach(field -> labels.addAll(readLabels(node.path(field))));
    }
    return labels;
  }

  // A value that is not a tag label, or a list of them, names no label, and the resolution cannot
  // apply it either.
  private static List<TagLabel> readLabels(JsonNode node) {
    List<TagLabel> labels = new ArrayList<>();
    try {
      if (node.isArray()) {
        labels.addAll(JsonUtils.convertValue(node, TAG_LABELS));
      } else if (node.isObject()) {
        labels.add(JsonUtils.convertValue(node, TagLabel.class));
      } else if (node.isTextual()) {
        labels.addAll(readEncodedLabels(node.asText()));
      }
    } catch (IllegalArgumentException e) {
      LOG.debug("Resolution value is not a tag label list: {}", e.getMessage());
    }
    return labels;
  }

  // A suggested value and a resolver's new value carry the labels as JSON text.
  private static List<TagLabel> readEncodedLabels(String json) {
    List<TagLabel> labels = new ArrayList<>();
    if (json != null && !json.isBlank()) {
      try {
        labels.addAll(readLabels(JsonUtils.readTree(json)));
      } catch (JsonParsingException e) {
        LOG.debug("Resolution value is not JSON: {}", e.getMessage());
      }
    }
    return labels;
  }
}
