/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.governance.workflows.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Builds and merges structured change-preview JSON stored in {@code thread.message} for approval
 * tasks. The message format is a JSON object mapping field names to {@code {added, removed}} arrays
 * of human-readable identifiers (tagFQN, fullyQualifiedName, displayName, or name).
 */
@Slf4j
public final class ChangePreviewUtils {

  private static final List<String> ID_KEYS =
      List.of("tagFQN", "fullyQualifiedName", "displayName", "name");

  private static final TypeReference<Map<String, FieldDiff>> CHANGE_MAP_TYPE =
      new TypeReference<>() {};

  private ChangePreviewUtils() {}

  public record FieldDiff(List<String> added, List<String> removed) {
    public FieldDiff {
      added = added != null ? added : List.of();
      removed = removed != null ? removed : List.of();
    }

    FieldDiff merge(FieldDiff next) {
      return new FieldDiff(
          union(minus(added, next.removed), minus(next.added, removed)),
          union(minus(removed, next.added), minus(next.removed, added)));
    }

    boolean isEmpty() {
      return added.isEmpty() && removed.isEmpty();
    }
  }

  public static List<String> extractIdentifiers(Object value) {
    return collect(normalize(value));
  }

  private static Object normalize(Object value) {
    if (!(value instanceof String raw)) return value;
    String stripped = raw.strip();
    if (stripped.isEmpty()) return null;
    try {
      return JsonUtils.readValue(stripped, Object.class);
    } catch (Exception e) {
      return stripped;
    }
  }

  private static List<String> collect(Object value) {
    if (value == null) return List.of();
    if (value instanceof Collection<?> collection) {
      return collection.stream().flatMap(item -> collect(item).stream()).toList();
    }
    if (value instanceof Map<?, ?> map) {
      for (String key : ID_KEYS) {
        if (map.get(key) instanceof String idValue && !idValue.isBlank())
          return List.of(idValue.strip());
      }
      List<String> nested =
          map.values().stream()
              .filter(item -> item instanceof Map || item instanceof Collection)
              .flatMap(item -> collect(item).stream())
              .toList();
      return nested.isEmpty() ? List.of(JsonUtils.pojoToJson(map)) : nested;
    }
    String str = value.toString().strip();
    return str.isEmpty() ? List.of() : List.of(str);
  }

  private static List<String> union(List<String> left, List<String> right) {
    return Stream.concat(left.stream(), right.stream()).distinct().toList();
  }

  private static List<String> minus(List<String> source, Collection<String> exclusions) {
    Set<String> exclusionSet = new HashSet<>(exclusions);
    return source.stream().filter(item -> !exclusionSet.contains(item)).toList();
  }

  public static Map<String, FieldDiff> buildChangeMap(ChangeDescription changeDescription) {
    Map<String, FieldDiff> result = new LinkedHashMap<>();
    for (FieldChange fieldChange : listOrEmpty(changeDescription.getFieldsAdded())) {
      result.put(
          fieldChange.getName(),
          new FieldDiff(extractIdentifiers(fieldChange.getNewValue()), List.of()));
    }
    for (FieldChange fieldChange : listOrEmpty(changeDescription.getFieldsDeleted())) {
      result.put(
          fieldChange.getName(),
          new FieldDiff(List.of(), extractIdentifiers(fieldChange.getOldValue())));
    }
    for (FieldChange fieldChange : listOrEmpty(changeDescription.getFieldsUpdated())) {
      result.put(
          fieldChange.getName(),
          new FieldDiff(
              extractIdentifiers(fieldChange.getNewValue()),
              extractIdentifiers(fieldChange.getOldValue())));
    }
    return result;
  }

  public static Map<String, FieldDiff> mergeChangeMaps(
      Map<String, FieldDiff> oldMap, Map<String, FieldDiff> newMap) {
    Map<String, FieldDiff> merged = new LinkedHashMap<>(oldMap);
    for (Map.Entry<String, FieldDiff> entry : newMap.entrySet()) {
      String field = entry.getKey();
      merged.put(
          field,
          merged.containsKey(field) ? merged.get(field).merge(entry.getValue()) : entry.getValue());
    }
    merged.entrySet().removeIf(entry -> entry.getValue().isEmpty());
    return merged;
  }

  public static boolean hasNoChanges(ChangeDescription changeDescription) {
    return changeDescription == null
        || (nullOrEmpty(changeDescription.getFieldsAdded())
            && nullOrEmpty(changeDescription.getFieldsUpdated())
            && nullOrEmpty(changeDescription.getFieldsDeleted()));
  }

  public static Map<String, FieldDiff> parseChangeMap(String message) {
    if (nullOrEmpty(message) || !message.strip().startsWith("{")) return new LinkedHashMap<>();
    try {
      return JsonUtils.readValue(message, CHANGE_MAP_TYPE);
    } catch (Exception e) {
      return new LinkedHashMap<>();
    }
  }

  public static void applyChangePreview(
      Thread taskThread, EntityInterface entity, String oldMessage) {
    taskThread.withCardStyle(null).withFieldOperation(null).withFeedInfo(null);
    final ChangeDescription changeDescription = entity.getChangeDescription();
    if (hasNoChanges(changeDescription)) {
      taskThread.withMessage(oldMessage != null ? oldMessage : "{}");
      return;
    }
    try {
      Map<String, FieldDiff> merged =
          mergeChangeMaps(parseChangeMap(oldMessage), buildChangeMap(changeDescription));
      taskThread.withMessage(merged.isEmpty() ? "{}" : JsonUtils.pojoToJson(merged));
    } catch (Exception e) {
      LOG.warn(
          "Failed to build change preview for approval task on {}",
          entity.getFullyQualifiedName(),
          e);
      taskThread.withMessage(oldMessage != null ? oldMessage : "{}");
    }
  }
}
