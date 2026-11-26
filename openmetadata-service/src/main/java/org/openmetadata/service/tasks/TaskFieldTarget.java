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
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.Objects;
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
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.EntityFieldPath;
import org.openmetadata.service.util.FieldPathUtils;
import org.openmetadata.service.util.FieldProperty;

/**
 * A description or tag task changes one property of the entity it is about, or of one of that
 * entity's fields, named by the field path in its payload. The path must be an {@link
 * EntityFieldPath} that ends in the property the task changes and names a field the entity has;
 * anything else is refused when the task is filed, when its path is edited, and when it is approved.
 */
public final class TaskFieldTarget {
  public static final String FIELD_PATH = "fieldPath";
  private static final String SUGGESTION_TYPE = "suggestionType";
  private static final Map<String, FieldProperty> SUGGESTION_PROPERTIES =
      Map.of("Description", FieldProperty.DESCRIPTION, "Tag", FieldProperty.TAGS);
  private static final Set<TaskResolutionType> NEGATIVE_RESOLUTIONS =
      Set.of(
          TaskResolutionType.Rejected,
          TaskResolutionType.Cancelled,
          TaskResolutionType.Revoked,
          TaskResolutionType.TimedOut,
          TaskResolutionType.Expired);

  /** Where a task keeps its field path, and the property that path must end in. */
  public record Target(String payloadKey, FieldProperty property) {}

  private record Declared(Target target, String fieldPath) {}

  private TaskFieldTarget() {}

  /**
   * Writes the entity-level path into a task that names none: an omitted field path means the
   * entity itself, and it is stored written out so every stored task carries one.
   */
  public static void fillDefault(Task task) {
    JsonNode payload = payloadNode(task.getPayload());
    targetOf(task, payload)
        .filter(target -> nullOrEmpty(payload.path(target.payloadKey()).asText(null)))
        .ifPresent(
            target -> {
              ((ObjectNode) payload).put(target.payloadKey(), target.property().value());
              task.setPayload(JsonUtils.convertValue(payload, Map.class));
            });
  }

  /** Refuses filing a task whose field path names no field of its entity with the property. */
  public static void require(Task task) {
    requireIn(task, payloadNode(task.getPayload()));
  }

  /** Refuses an edit that changes a task's field path, or its property, to an invalid one. */
  public static void requireChanged(Task original, Task updated) {
    if (!Objects.equals(declaredTarget(original), declaredTarget(updated))) {
      require(updated);
    }
  }

  /**
   * Refuses resolving a task, other than by declining it, when its field path, with the request's
   * payload laid over the task's, names no such field.
   */
  public static void requireToApply(
      Task task, TaskResolutionType resolution, Object requestPayload) {
    if (resolution == null || !NEGATIVE_RESOLUTIONS.contains(resolution)) {
      ObjectNode merged = JsonUtils.getObjectNode();
      merged.setAll((ObjectNode) payloadNode(task.getPayload()));
      merged.setAll((ObjectNode) payloadNode(requestPayload));
      requireIn(task, merged);
    }
  }

  /** The field path property of this task, or empty for a task that changes no entity field. */
  public static Optional<Target> targetOf(Task task, JsonNode payload) {
    TaskEntityType type = task.getType();
    if (type == TaskEntityType.DescriptionUpdate) {
      return Optional.of(new Target(fieldPathKey(task), FieldProperty.DESCRIPTION));
    }
    if (type == TaskEntityType.TagUpdate) {
      return Optional.of(new Target(fieldPathKey(task), FieldProperty.TAGS));
    }
    return type == TaskEntityType.Suggestion
        ? Optional.ofNullable(SUGGESTION_PROPERTIES.get(payload.path(SUGGESTION_TYPE).asText("")))
            .map(property -> new Target(FIELD_PATH, property))
        : Optional.empty();
  }

  /**
   * Reads a task's field path, refusing one that is not an {@link EntityFieldPath} of the task's
   * entity or that ends in another property than the one the task changes.
   */
  public static EntityFieldPath parse(String fieldPath, String entityType, FieldProperty property) {
    EntityFieldPath path;
    try {
      path = EntityFieldPath.parse(fieldPath, entityType);
    } catch (IllegalArgumentException e) {
      throw BadRequestException.of(e.getMessage());
    }
    if (path.property() != property) {
      throw BadRequestException.of(
          "Field path '%s' must end in '%s' for this task".formatted(fieldPath, property.value()));
    }
    return path;
  }

  private static void requireIn(Task task, JsonNode payload) {
    Optional<Target> target = targetOf(task, payload);
    if (target.isPresent() && task.getAbout() != null) {
      requireField(task, payload.path(target.get().payloadKey()).asText(null), target.get());
    }
  }

  private static void requireField(Task task, String fieldPath, Target target) {
    String entityType = task.getAbout().getType();
    EntityFieldPath path = parse(fieldPath, entityType, target.property());
    if (!path.isEntityLevel()) {
      EntityInterface<?> entity =
          Entity.getEntity(
              task.getAbout(), ChildFieldResolver.containerFields(entityType), Include.ALL);
      boolean found =
          FieldPathUtils.locate(entity, path)
              .filter(field -> FieldPathUtils.supports(field, path.property()))
              .isPresent();
      if (!found) {
        throw BadRequestException.of(
            "Field path '%s' names no field of %s '%s' with %s"
                .formatted(
                    fieldPath,
                    entityType,
                    entity.getFullyQualifiedName(),
                    path.property().value()));
      }
    }
  }

  private static Optional<Declared> declaredTarget(Task task) {
    JsonNode payload = payloadNode(task.getPayload());
    return targetOf(task, payload)
        .map(target -> new Declared(target, payload.path(target.payloadKey()).asText(null)));
  }

  private static String fieldPathKey(Task task) {
    String key = TaskFormExecutionResolver.resolve(task).fieldPathField();
    return key == null ? FIELD_PATH : key;
  }

  private static JsonNode payloadNode(Object payload) {
    JsonNode node = payload == null ? null : JsonUtils.valueToTree(payload);
    return node instanceof ObjectNode ? node : JsonUtils.getObjectNode();
  }
}
