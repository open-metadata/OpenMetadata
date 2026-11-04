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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.util.FieldPathUtils;

/**
 * A tag task writes tags onto the entity it is about, or onto one of that entity's fields. Its field
 * path therefore has to name the entity itself or a field of it that carries tags; any other path is
 * refused when the task is filed and when it is approved.
 */
public final class TaskTagTarget {
  private static final String FIELD_PATH = "fieldPath";
  private static final String GET_TAGS = "getTags";
  private static final String SUGGESTION_TYPE = "suggestionType";
  private static final String TAG_SUGGESTION = "Tag";
  private static final Set<String> ENTITY_LEVEL_PATHS = Set.of("tags", "entity");
  private static final String TAGS_SUFFIX = ".tags";
  private static final List<String> NESTED_FIELD_LISTS =
      List.of(
          "requestSchema.schemaFields.",
          "responseSchema.schemaFields.",
          "messageSchema.schemaFields.",
          "dataModel.columns.");
  private static final Set<TaskResolutionType> NEGATIVE_RESOLUTIONS =
      Set.of(
          TaskResolutionType.Rejected,
          TaskResolutionType.Cancelled,
          TaskResolutionType.Revoked,
          TaskResolutionType.TimedOut,
          TaskResolutionType.Expired);

  private TaskTagTarget() {}

  /**
   * The field path in a form {@link FieldPathUtils#findField} resolves. A path through a nested
   * field list, such as {@code requestSchema.schemaFields.default.name.last_name}, names its field
   * by the rest of the path; it becomes {@code requestSchema::"default.name.last_name"::tags}.
   */
  public static String locatablePath(String fieldPath) {
    String path = fieldPath;
    for (String prefix : NESTED_FIELD_LISTS) {
      if (path != null && path.startsWith(prefix)) {
        String field = path.substring(prefix.length()).replace("\"", "");
        if (field.endsWith(TAGS_SUFFIX)) {
          field = field.substring(0, field.length() - TAGS_SUFFIX.length());
        }
        path = "%s::\"%s\"::tags".formatted(prefix.substring(0, prefix.indexOf('.')), field);
      }
    }
    return path;
  }

  /** Whether a tag field path names the entity itself rather than one of its fields. */
  public static boolean isEntityLevel(String fieldPath) {
    return nullOrEmpty(fieldPath) || ENTITY_LEVEL_PATHS.contains(fieldPath);
  }

  /** Refuses filing a tag task whose field path names no tagged field of its entity. */
  public static void requireTagField(Task task) {
    requireTagField(task, null);
  }

  /**
   * Refuses resolving a tag task, other than by declining it, when its field path, with the
   * request's payload laid over the task's, names no tagged field of its entity.
   */
  public static void requireTagFieldToApply(
      Task task, TaskResolutionType resolution, Object requestPayload) {
    if (resolution == null || !NEGATIVE_RESOLUTIONS.contains(resolution)) {
      requireTagField(task, requestPayload);
    }
  }

  private static void requireTagField(Task task, Object requestPayload) {
    String fieldPath = tagFieldPath(task, requestPayload);
    if (task.getAbout() != null && !isEntityLevel(fieldPath)) {
      EntityInterface<?> entity = Entity.getEntity(task.getAbout(), "*", Include.ALL);
      if (!hasTags(FieldPathUtils.findField(entity, locatablePath(fieldPath)))) {
        throw BadRequestException.of(
            "Field '%s' is not a tagged field of %s '%s'"
                .formatted(fieldPath, task.getAbout().getType(), entity.getFullyQualifiedName()));
      }
    }
  }

  private static String tagFieldPath(Task task, Object requestPayload) {
    JsonNode taskPayload = payloadNode(task.getPayload());
    JsonNode request = payloadNode(requestPayload);
    String fieldPath = null;
    if (task.getType() == TaskEntityType.TagUpdate) {
      String key = TaskFormExecutionResolver.resolve(task).fieldPathField();
      fieldPath = firstText(request, taskPayload, key, FIELD_PATH);
    } else if (task.getType() == TaskEntityType.Suggestion
        && TAG_SUGGESTION.equals(firstText(request, taskPayload, SUGGESTION_TYPE, null))) {
      fieldPath = firstText(request, taskPayload, FIELD_PATH, null);
    }
    return fieldPath;
  }

  // The request's payload overrides the task's key by key, and the configured key wins over the
  // default one, as when the resolution reads them.
  private static String firstText(
      JsonNode request, JsonNode taskPayload, String preferredKey, String fallbackKey) {
    String value = null;
    for (String key : new String[] {preferredKey, fallbackKey}) {
      if (value == null && key != null) {
        value = text(request, key);
        value = value != null ? value : text(taskPayload, key);
      }
    }
    return value;
  }

  private static String text(JsonNode node, String key) {
    String value = node.path(key).asText(null);
    return nullOrEmpty(value) ? null : value;
  }

  private static JsonNode payloadNode(Object payload) {
    return payload == null ? JsonUtils.getObjectNode() : JsonUtils.valueToTree(payload);
  }

  // Field POJOs share no tagged interface; a field carries tags when it has the accessor.
  private static boolean hasTags(Optional<Object> field) {
    return field
        .map(
            found ->
                Arrays.stream(found.getClass().getMethods())
                    .anyMatch(method -> GET_TAGS.equals(method.getName())))
        .orElse(false);
  }
}
