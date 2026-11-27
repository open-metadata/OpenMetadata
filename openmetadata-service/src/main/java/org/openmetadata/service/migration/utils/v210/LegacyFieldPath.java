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

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Reads the field path formats tasks were stored with before 2.1.0: {@code
 * columns::"a.b"::description}, {@code columns."a.b"}, {@code columns.a.b}, {@code
 * columns.a.b.description}, the short containers {@code messageSchema} / {@code dataModel} / {@code
 * requestSchema} / {@code responseSchema}, and {@code columns} standing for any entity's fields. A
 * legacy path can mean more than one field, so it is read into every candidate, most likely first;
 * {@link TaskFieldPathMigration} lets the entity decide between them.
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
    List<String> segments = segments(path);
    boolean trailingProperty =
        segments.size() > 2 && FieldPathFormat.isProperty(segments.getLast());
    List<Candidate> candidates = new ArrayList<>();
    if (trailingProperty) {
      candidates.addAll(dottedReadings(segments.subList(0, segments.size() - 1), entityType));
    }
    candidates.addAll(dottedReadings(segments, entityType));
    return candidates;
  }

  private static List<Candidate> dottedReadings(List<String> segments, String entityType) {
    String declared = declaredPrefix(segments, entityType);
    int containerSegments = declared == null ? 1 : FieldPathFormat.depth(declared);
    List<String> names =
        segments.subList(Math.min(containerSegments, segments.size()), segments.size()).stream()
            .map(FieldPathFormat::unquote)
            .toList();
    List<String> containers =
        declared == null ? containers(segments.getFirst(), entityType) : List.of(declared);
    return containers.stream().map(container -> new Candidate(container, names)).toList();
  }

  private static String declaredPrefix(List<String> segments, String entityType) {
    return FieldPathFormat.containers(entityType).stream()
        .filter(container -> FieldPathFormat.startsWith(segments, container))
        .findFirst()
        .orElse(null);
  }

  /**
   * The containers a legacy container segment stands for: itself, the container it shortens
   * ({@code messageSchema} for {@code messageSchema.schemaFields}), or every container of the
   * entity type for the {@code columns} alias. An unknown segment is kept as written.
   */
  static List<String> containers(String segment, String entityType) {
    List<String> declared = FieldPathFormat.containers(entityType);
    List<String> matching =
        declared.stream()
            .filter(path -> path.equals(segment) || path.startsWith(segment + "."))
            .toList();
    if (!matching.isEmpty()) {
      return matching;
    }
    return COLUMNS_ALIAS.equals(segment) && !declared.isEmpty() ? declared : List.of(segment);
  }

  // A quoted name is one name; an unquoted dotted name reaches a nested field, as in an entity
  // link.
  private static List<String> nameSegments(String name) {
    return name.isEmpty()
        ? List.of()
        : segments(name).stream().map(FieldPathFormat::unquote).toList();
  }

  private static List<String> segments(String path) {
    return FieldPathFormat.split(path).orElseGet(() -> List.of(path.split("\\.")));
  }
}
