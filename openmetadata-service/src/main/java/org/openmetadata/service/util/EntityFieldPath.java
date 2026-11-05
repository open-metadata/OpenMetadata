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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.openmetadata.service.Entity;

/**
 * The entity property a task changes: the entity's own description or tags, or those of one of its
 * nested fields. Written as {@code <container>.<name>[.<child name>...].<property>}, the same key the
 * entity's change descriptions use, for example {@code columns.address.city.description} or {@code
 * messageSchema.schemaFields."order.id".tags}; the entity itself is {@code description} or {@code
 * tags} (ADR:2026-11-04-task-field-paths-use-the-change-key-format).
 */
public record EntityFieldPath(String container, List<String> names, FieldProperty property) {

  public static final String FORMAT =
      "<container>.<name>[.<child name>...].<description|tags>, or description / tags for the"
          + " entity itself, quoting a name that contains a dot";

  public EntityFieldPath {
    names = List.copyOf(names);
  }

  public static EntityFieldPath entityLevel(FieldProperty property) {
    return new EntityFieldPath("", List.of(), property);
  }

  /**
   * Reads a path written in {@link #FORMAT}. The container must be one the entity type declares.
   *
   * @throws IllegalArgumentException when the path is not in that format
   */
  public static EntityFieldPath parse(String path, String entityType) {
    String[] segments = split(path);
    FieldProperty property =
        FieldProperty.fromValue(segments[segments.length - 1])
            .orElseThrow(() -> invalid(path, "it does not end in description or tags"));
    String[] field = Arrays.copyOf(segments, segments.length - 1);
    return field.length == 0 ? entityLevel(property) : fieldPath(path, entityType, field, property);
  }

  /**
   * The key of the field named {@code name} inside {@code parentKey}, a container or the key of the
   * parent field. It is the one place a field's name enters a key: the entity updaters build their
   * change descriptions with it, so a task's path is the key its approval records.
   */
  public static String childKey(String parentKey, String name) {
    return parentKey + Entity.SEPARATOR + FullyQualifiedName.quoteName(name);
  }

  public boolean isEntityLevel() {
    return container.isEmpty();
  }

  @Override
  public String toString() {
    String key = container;
    for (String name : names) {
      key = childKey(key, name);
    }
    return isEntityLevel() ? property.value() : key + Entity.SEPARATOR + property.value();
  }

  private static EntityFieldPath fieldPath(
      String path, String entityType, String[] segments, FieldProperty property) {
    String container =
        containerOf(segments, entityType)
            .orElseThrow(
                () -> invalid(path, "it does not name a field container of " + entityType));
    int containerSegments = container.split("\\.").length;
    List<String> names =
        Arrays.stream(segments, containerSegments, segments.length)
            .map(FullyQualifiedName::unquoteName)
            .toList();
    return new EntityFieldPath(container, names, property);
  }

  // A container is followed by at least one name; the longest declared container wins.
  private static Optional<String> containerOf(String[] segments, String entityType) {
    List<String> containers =
        ChildFieldResolver.supports(entityType)
            ? ChildFieldResolver.specFor(entityType).containerPaths()
            : List.of();
    return containers.stream()
        .filter(container -> startsWith(segments, container.split("\\.")))
        .max(Comparator.comparingInt(String::length));
  }

  private static boolean startsWith(String[] segments, String[] prefix) {
    return segments.length > prefix.length
        && Arrays.equals(Arrays.copyOf(segments, prefix.length), prefix);
  }

  private static String[] split(String path) {
    if (nullOrEmpty(path)) {
      throw invalid(path, "it is empty");
    }
    try {
      return FullyQualifiedName.split(path);
    } catch (IllegalArgumentException e) {
      throw invalid(path, "it is not a dot-separated path");
    }
  }

  private static IllegalArgumentException invalid(String path, String reason) {
    return new IllegalArgumentException(
        "Invalid field path '%s': %s. Expected %s".formatted(path, reason, FORMAT));
  }
}
