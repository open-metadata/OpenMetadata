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

import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
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

  private ChangePreviewUtils() {}

  public static List<String> extractIdentifiers(Object fieldValue) {
    if (nullOrEmpty(fieldValue)) return List.of();
    try {
      JsonValue json = JsonUtils.readJson(fieldValue.toString());
      if (json.getValueType() == JsonValue.ValueType.ARRAY) {
        return extractFromArray(json.asJsonArray());
      }
      if (json.getValueType() == JsonValue.ValueType.OBJECT) {
        return extractFromObject(json.asJsonObject());
      }
    } catch (Exception e) {
      // not JSON — treat as a plain string
    }
    return List.of(fieldValue.toString().strip());
  }

  private static List<String> extractFromArray(JsonArray array) {
    List<String> result = new ArrayList<>();
    for (JsonValue item : array) {
      if (item.getValueType() == JsonValue.ValueType.OBJECT) {
        result.addAll(extractFromObject(item.asJsonObject()));
      } else if (item.getValueType() == JsonValue.ValueType.STRING) {
        result.add(((JsonString) item).getString().strip());
      }
    }
    return result;
  }

  private static List<String> extractFromObject(JsonObject obj) {
    Set<String> keys = obj.keySet();
    if (keys.contains("tagFQN")) return List.of(obj.getString("tagFQN"));
    if (keys.contains("fullyQualifiedName")) return List.of(obj.getString("fullyQualifiedName"));
    if (keys.contains("displayName")) return List.of(obj.getString("displayName"));
    if (keys.contains("name")) return List.of(obj.getString("name"));
    return List.of();
  }

  private static Map<String, List<String>> fieldEntry(List<String> added, List<String> removed) {
    Map<String, List<String>> entry = new LinkedHashMap<>();
    entry.put("added", new ArrayList<>(added));
    entry.put("removed", new ArrayList<>(removed));
    return entry;
  }

  public static Map<String, Map<String, List<String>>> buildChangeMap(ChangeDescription cd) {
    Map<String, Map<String, List<String>>> result = new LinkedHashMap<>();
    for (FieldChange fc : listOrEmpty(cd.getFieldsAdded())) {
      result.put(fc.getName(), fieldEntry(extractIdentifiers(fc.getNewValue()), List.of()));
    }
    for (FieldChange fc : listOrEmpty(cd.getFieldsDeleted())) {
      result.put(fc.getName(), fieldEntry(List.of(), extractIdentifiers(fc.getOldValue())));
    }
    for (FieldChange fc : listOrEmpty(cd.getFieldsUpdated())) {
      result.put(
          fc.getName(),
          fieldEntry(extractIdentifiers(fc.getNewValue()), extractIdentifiers(fc.getOldValue())));
    }
    return result;
  }

  private static List<String> setMinus(List<String> a, List<String> b) {
    Set<String> bSet = new LinkedHashSet<>(b);
    return a.stream().filter(v -> !bSet.contains(v)).collect(Collectors.toList());
  }

  private static List<String> setUnion(List<String> a, List<String> b) {
    Set<String> aSet = new LinkedHashSet<>(a);
    List<String> result = new ArrayList<>(a);
    b.stream().filter(v -> !aSet.contains(v)).forEach(result::add);
    return result;
  }

  private static Map<String, List<String>> mergeFieldEntries(
      Map<String, List<String>> old, Map<String, List<String>> next) {
    List<String> oldAdded = old.get("added");
    List<String> oldRemoved = old.get("removed");
    List<String> nextAdded = next.get("added");
    List<String> nextRemoved = next.get("removed");
    return fieldEntry(
        setUnion(setMinus(oldAdded, nextRemoved), setMinus(nextAdded, oldRemoved)),
        setUnion(setMinus(oldRemoved, nextAdded), setMinus(nextRemoved, oldAdded)));
  }

  public static Map<String, Map<String, List<String>>> mergeChangeMaps(
      Map<String, Map<String, List<String>>> oldMap,
      Map<String, Map<String, List<String>>> newMap) {
    Map<String, Map<String, List<String>>> merged = new LinkedHashMap<>(oldMap);
    for (Map.Entry<String, Map<String, List<String>>> entry : newMap.entrySet()) {
      String field = entry.getKey();
      merged.put(
          field,
          merged.containsKey(field)
              ? mergeFieldEntries(merged.get(field), entry.getValue())
              : new LinkedHashMap<>(entry.getValue()));
    }
    merged
        .entrySet()
        .removeIf(
            e -> e.getValue().get("added").isEmpty() && e.getValue().get("removed").isEmpty());
    return merged;
  }

  public static boolean hasNoChanges(ChangeDescription cd) {
    return cd == null
        || (nullOrEmpty(cd.getFieldsAdded())
            && nullOrEmpty(cd.getFieldsUpdated())
            && nullOrEmpty(cd.getFieldsDeleted()));
  }

  @SuppressWarnings("unchecked")
  public static Map<String, Map<String, List<String>>> parseChangeMap(String message) {
    if (nullOrEmpty(message) || !message.strip().startsWith("{")) return new LinkedHashMap<>();
    try {
      Map<String, Object> raw = JsonUtils.readValue(message, Map.class);
      Map<String, Map<String, List<String>>> result = new LinkedHashMap<>();
      for (Map.Entry<String, Object> e : raw.entrySet()) {
        if (e.getValue() instanceof Map<?, ?> fm) {
          result.put(e.getKey(), toTypedFieldEntry((Map<String, Object>) fm));
        }
      }
      return result;
    } catch (Exception e) {
      return new LinkedHashMap<>();
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, List<String>> toTypedFieldEntry(Map<String, Object> fieldMap) {
    return fieldEntry(
        toStringList(fieldMap.getOrDefault("added", List.of())),
        toStringList(fieldMap.getOrDefault("removed", List.of())));
  }

  private static List<String> toStringList(Object value) {
    if (value instanceof List<?> list) {
      return list.stream().map(Object::toString).collect(Collectors.toList());
    }
    return new ArrayList<>();
  }

  public static void applyChangePreview(
      Thread taskThread, EntityInterface entity, String oldMessage) {
    taskThread.withCardStyle(null).withFieldOperation(null).withFeedInfo(null);
    final ChangeDescription cd = entity.getChangeDescription();
    if (hasNoChanges(cd)) {
      taskThread.withMessage(oldMessage != null ? oldMessage : "{}");
      return;
    }
    try {
      Map<String, Map<String, List<String>>> merged =
          mergeChangeMaps(parseChangeMap(oldMessage), buildChangeMap(cd));
      taskThread.withMessage(merged.isEmpty() ? "{}" : JsonUtils.pojoToJson(merged));
    } catch (Exception e) {
      LOG.warn(
          "Failed to build change preview for approval task on {}",
          entity.getFullyQualifiedName(),
          e);
      taskThread.withMessage(oldMessage);
    }
  }
}
