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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The task field path format as 2.1.0 writes it: {@code <container>.<name>[.<child
 * name>...].<description|tags>}, or {@code description} / {@code tags} alone for the entity itself,
 * a name that contains a dot or a quote written quoted as in an FQN ({@code "a.b"}, a quote in it
 * doubled).
 *
 * <p>A frozen copy of the server's {@code EntityFieldPath}, {@code FullyQualifiedName} quoting and
 * {@code ChildFieldResolver} containers, as of 2.1.0. A migration runs on the code of whatever
 * release an upgrade lands on, so this step must not read or write through classes that later
 * releases are free to change.
 */
final class FieldPathFormat {
  static final String DESCRIPTION = "description";
  static final String TAGS = "tags";

  private static final Set<String> PROPERTIES = Set.of(DESCRIPTION, TAGS);
  private static final char SEPARATOR = '.';
  private static final char QUOTE = '"';
  private static final String QUOTE_TEXT = "\"";
  private static final String ESCAPED_QUOTE = "\"\"";

  /** The field containers of each entity type that has fields, as 2.1.0 stores them. */
  private static final Map<String, List<String>> CONTAINERS =
      Map.of(
          "table", List.of("columns"),
          "dashboardDataModel", List.of("columns"),
          "worksheet", List.of("columns"),
          "topic", List.of("messageSchema.schemaFields"),
          "container", List.of("dataModel.columns"),
          "mlmodel", List.of("mlFeatures"),
          "pipeline", List.of("tasks"),
          "searchIndex", List.of("fields"),
          "apiEndpoint", List.of("requestSchema.schemaFields", "responseSchema.schemaFields"));

  /** A field path; the container is empty, and there are no names, for the entity itself. */
  record FieldPath(String container, List<String> names, String property) {
    FieldPath {
      names = List.copyOf(names);
    }

    static FieldPath entityLevel(String property) {
      return new FieldPath("", List.of(), property);
    }

    boolean isEntityLevel() {
      return container.isEmpty();
    }

    String format() {
      List<String> segments = new ArrayList<>();
      if (!isEntityLevel()) {
        segments.add(container);
        names.stream().map(FieldPathFormat::quote).forEach(segments::add);
      }
      segments.add(property);
      return String.join(".", segments);
    }
  }

  private FieldPathFormat() {}

  static boolean isProperty(String segment) {
    return PROPERTIES.contains(segment);
  }

  /** The field containers of an entity type; empty for a type without fields. */
  static List<String> containers(String entityType) {
    return entityType == null ? List.of() : CONTAINERS.getOrDefault(entityType, List.of());
  }

  /** Reads a path written in the format, with a container of the entity type; empty otherwise. */
  static Optional<FieldPath> parse(String path, String entityType) {
    List<String> segments = split(path).orElse(List.of());
    boolean endsInProperty = !segments.isEmpty() && isProperty(segments.getLast());
    List<String> field = endsInProperty ? segments.subList(0, segments.size() - 1) : List.of();
    Optional<FieldPath> parsed = Optional.empty();
    if (endsInProperty && field.isEmpty()) {
      parsed = Optional.of(FieldPath.entityLevel(segments.getLast()));
    } else if (endsInProperty) {
      parsed =
          longestContainer(field, entityType)
              .map(container -> fieldPath(container, field, segments.getLast()));
    }
    return parsed;
  }

  /**
   * Splits a path at the dots outside quotes, keeping each quoted name whole and quoted. Empty when
   * the path is not a sequence of non-empty names, each one either unquoted and free of quotes or
   * quoted with its own quotes doubled.
   */
  static Optional<List<String>> split(String path) {
    if (path == null || path.isEmpty()) {
      return Optional.empty();
    }
    List<String> segments = new ArrayList<>();
    boolean inQuotes = false;
    int start = 0;
    for (int i = 0; i < path.length(); i++) {
      char c = path.charAt(i);
      inQuotes = c == QUOTE ? !inQuotes : inQuotes;
      if (c == SEPARATOR && !inQuotes) {
        segments.add(path.substring(start, i));
        start = i + 1;
      }
    }
    segments.add(path.substring(start));
    boolean valid = !inQuotes && segments.stream().allMatch(FieldPathFormat::isName);
    return valid ? Optional.of(segments) : Optional.empty();
  }

  /** The raw name a segment stands for: a quoted segment loses its quotes and its doubling. */
  static String unquote(String segment) {
    return isQuoted(segment)
        ? segment.substring(1, segment.length() - 1).replace(ESCAPED_QUOTE, QUOTE_TEXT)
        : segment;
  }

  /** The segment a raw name is written as: quoted when it contains a dot or a quote. */
  static String quote(String name) {
    boolean needsQuotes = name.indexOf(SEPARATOR) >= 0 || name.indexOf(QUOTE) >= 0;
    return needsQuotes ? QUOTE + name.replace(QUOTE_TEXT, ESCAPED_QUOTE) + QUOTE : name;
  }

  private static FieldPath fieldPath(String container, List<String> field, String property) {
    List<String> names =
        field.subList(depth(container), field.size()).stream()
            .map(FieldPathFormat::unquote)
            .toList();
    return new FieldPath(container, names, property);
  }

  // A container is followed by at least one name; the longest container of the type wins.
  private static Optional<String> longestContainer(List<String> field, String entityType) {
    return containers(entityType).stream()
        .filter(container -> startsWith(field, container))
        .max(Comparator.comparingInt(String::length));
  }

  static boolean startsWith(List<String> segments, String container) {
    List<String> prefix = List.of(container.split("\\."));
    return segments.size() > prefix.size() && segments.subList(0, prefix.size()).equals(prefix);
  }

  static int depth(String container) {
    return container.split("\\.").length;
  }

  private static boolean isName(String segment) {
    return !segment.isEmpty() && (segment.indexOf(QUOTE) < 0 || isQuoted(segment));
  }

  private static boolean isQuoted(String segment) {
    boolean wrapped =
        segment.length() > 2
            && segment.charAt(0) == QUOTE
            && segment.charAt(segment.length() - 1) == QUOTE;
    return wrapped
        && !segment
            .substring(1, segment.length() - 1)
            .replace(ESCAPED_QUOTE, "")
            .contains(QUOTE_TEXT);
  }
}
