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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.FieldProperty;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Reads the field path formats tasks were stored with before {@code EntityFieldPath} became the
 * only one: {@code columns::"a.b"::description}, {@code columns."a.b"}, {@code columns.a.b}, {@code
 * columns.a.b.description}, the short containers {@code messageSchema} / {@code dataModel} / {@code
 * requestSchema} / {@code responseSchema}, and {@code columns} standing for any entity's fields.
 * A legacy path can mean more than one field, so it is read into every candidate, most likely
 * first; {@link TaskFieldPathMigration} lets the entity decide between them.
 */
final class LegacyFieldPath {
  private static final String SEPARATOR = "::";
  private static final String COLUMNS_ALIAS = "columns";
  private static final Set<String> ENTITY_LEVEL = Set.of("", "entity", "description", "tags");

  /** One reading: a container and the names after it; {@code text} is the names joined by dots. */
  record Candidate(String container, List<String> names) {
    String text() {
      return String.join(".", names);
    }
  }

  private LegacyFieldPath() {}

  static boolean isEntityLevel(String path) {
    return path == null || ENTITY_LEVEL.contains(path);
  }

  /** Every reading of a legacy field path, most likely first. */
  static List<Candidate> candidates(String path, String entityType) {
    return path.contains(SEPARATOR)
        ? separatorCandidates(path, entityType)
        : dottedCandidates(path, entityType);
  }

  // container::name[::property]: the name may be quoted, or dotted to reach a nested field.
  private static List<Candidate> separatorCandidates(String path, String entityType) {
    String[] parts = path.split(SEPARATOR);
    List<String> names = nameSegments(parts.length > 1 ? parts[1] : "");
    return containers(parts[0], entityType).stream()
        .map(container -> new Candidate(container, names))
        .toList();
  }

  // A trailing description or tags is the property; without one, the whole path names the field.
  private static List<Candidate> dottedCandidates(String path, String entityType) {
    String[] segments = segments(path);
    boolean trailingProperty =
        segments.length > 2 && FieldProperty.fromValue(segments[segments.length - 1]).isPresent();
    List<Candidate> candidates = new ArrayList<>();
    if (trailingProperty) {
      candidates.addAll(dottedReadings(Arrays.copyOf(segments, segments.length - 1), entityType));
    }
    candidates.addAll(dottedReadings(segments, entityType));
    return candidates;
  }

  private static List<Candidate> dottedReadings(String[] segments, String entityType) {
    String declared = declaredPrefix(segments, entityType);
    int containerSegments = declared == null ? 1 : declared.split("\\.").length;
    List<String> names =
        Arrays.stream(segments, Math.min(containerSegments, segments.length), segments.length)
            .map(FullyQualifiedName::unquoteName)
            .toList();
    List<String> containers =
        declared == null ? containers(segments[0], entityType) : List.of(declared);
    return containers.stream().map(container -> new Candidate(container, names)).toList();
  }

  private static String declaredPrefix(String[] segments, String entityType) {
    return declaredContainers(entityType).stream()
        .filter(container -> startsWith(segments, container.split("\\.")))
        .findFirst()
        .orElse(null);
  }

  /**
   * The declared containers a legacy container segment stands for: itself, the declared path it
   * shortens ({@code messageSchema} for {@code messageSchema.schemaFields}), or every declared
   * container for the {@code columns} alias. An unknown segment is kept as written.
   */
  static List<String> containers(String segment, String entityType) {
    List<String> declared = declaredContainers(entityType);
    List<String> matching =
        declared.stream()
            .filter(path -> path.equals(segment) || path.startsWith(segment + "."))
            .toList();
    if (!matching.isEmpty()) {
      return matching;
    }
    return COLUMNS_ALIAS.equals(segment) && !declared.isEmpty() ? declared : List.of(segment);
  }

  private static List<String> declaredContainers(String entityType) {
    return ChildFieldResolver.supports(entityType)
        ? ChildFieldResolver.specFor(entityType).containerPaths()
        : List.of();
  }

  // A quoted name is one name; an unquoted dotted name reaches a nested field, as in an entity
  // link.
  private static List<String> nameSegments(String name) {
    return nullOrEmpty(name)
        ? List.of()
        : Arrays.stream(segments(name)).map(FullyQualifiedName::unquoteName).toList();
  }

  private static String[] segments(String path) {
    try {
      return FullyQualifiedName.split(path);
    } catch (IllegalArgumentException e) {
      return path.split("\\.");
    }
  }

  private static boolean startsWith(String[] segments, String[] prefix) {
    return segments.length > prefix.length
        && Arrays.equals(Arrays.copyOf(segments, prefix.length), prefix);
  }
}
