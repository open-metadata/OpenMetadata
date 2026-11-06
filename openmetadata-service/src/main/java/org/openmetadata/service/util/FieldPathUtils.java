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

package org.openmetadata.service.util;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;

/**
 * Finds the entity, or the nested field, that an {@link EntityFieldPath} names and reads or writes
 * its description. Changes are made in memory; saving the entity is the caller's job.
 */
@Slf4j
public final class FieldPathUtils {

  private FieldPathUtils() {}

  /** The entity itself for an entity-level path, else the nested field POJO the path names. */
  public static Optional<Object> locate(EntityInterface<?> entity, EntityFieldPath path) {
    if (path.isEntityLevel()) {
      return Optional.of(entity);
    }
    List<?> fields = ChildFieldResolver.containerListFor(entity, path.container());
    Optional<Object> field = Optional.empty();
    for (String name : path.names()) {
      field = fields == null ? Optional.empty() : findByName(fields, name);
      fields = field.map(FieldPathUtils::childrenOf).orElse(null);
    }
    return field;
  }

  public static Optional<String> getDescription(EntityInterface<?> entity, EntityFieldPath path) {
    return locate(entity, path)
        .map(field -> (String) ChildFieldResolver.invokeGetter(field, "getDescription"));
  }

  /** @return false when the path names no field of the entity */
  public static boolean setDescription(
      EntityInterface<?> entity, EntityFieldPath path, String description) {
    return locate(entity, path).map(field -> writeDescription(field, description)).orElse(false);
  }

  /** Whether the located entity or field carries the property, so a task can change it. */
  public static boolean supports(Object field, FieldProperty property) {
    return switch (property) {
      case DESCRIPTION -> hasMethod(field, "setDescription");
      case TAGS -> hasMethod(field, "getTags") && hasMethod(field, "setTags");
    };
  }

  // Two siblings with the same name cannot be told apart, so neither is chosen.
  private static Optional<Object> findByName(List<?> fields, String name) {
    List<?> matches =
        fields.stream()
            .filter(field -> name.equals(ChildFieldResolver.invokeGetter(field, "getName")))
            .toList();
    if (matches.size() > 1) {
      LOG.warn(
          "[FieldPathUtils] {} fields are named '{}'; refusing to guess", matches.size(), name);
    }
    return matches.size() == 1 ? Optional.of(matches.getFirst()) : Optional.empty();
  }

  private static List<?> childrenOf(Object field) {
    return ChildFieldResolver.invokeGetter(field, "getChildren") instanceof List<?> children
        ? children
        : null;
  }

  private static boolean writeDescription(Object field, String description) {
    try {
      Method setter = field.getClass().getMethod("setDescription", String.class);
      setter.invoke(field, description);
      return true;
    } catch (ReflectiveOperationException e) {
      LOG.warn("[FieldPathUtils] Could not set description: {}", e.getMessage());
      return false;
    }
  }

  private static boolean hasMethod(Object target, String name) {
    return Arrays.stream(target.getClass().getMethods())
        .anyMatch(method -> method.getName().equals(name));
  }
}
