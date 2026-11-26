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
import java.util.OptionalDouble;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.secrets.masker.McpServerMasker;

/**
 * Builds and merges structured change-preview data stored under the {@code proposedChanges} key in
 * a task payload. The change map is a {@code Map<String, FieldDiff>} of field name to {@code
 * {added, removed}} arrays of human-readable identifiers (tagFQN, fullyQualifiedName, displayName,
 * or name).
 */
@Slf4j
public final class ChangePreviewUtils {

  public static final String PROPOSED_CHANGES_KEY = "proposedChanges";
  public static final String CHANGE_REQUEST_ID_KEY = "changeRequestId";
  public static final String CHANGE_REQUEST_REVISION_KEY = "changeRequestRevision";
  public static final String PROPOSED_CHANGES_BASE_VERSION_KEY = "proposedChangesBaseVersion";

  private static final List<String> PREVIEW_STATE_KEYS =
      List.of(PROPOSED_CHANGES_KEY, PROPOSED_CHANGES_BASE_VERSION_KEY);

  private static final List<String> ID_KEYS =
      List.of("tagFQN", "fullyQualifiedName", "displayName", "name");

  private static final TypeReference<Map<String, FieldDiff>> CHANGE_MAP_TYPE =
      new TypeReference<>() {};

  private ChangePreviewUtils() {}

  /** The changes an approval cycle made since the version it began from, oldest first. */
  public record CyclePreview(double baseVersion, List<ChangeDescription> changes) {
    public CyclePreview {
      changes = List.copyOf(changes);
    }
  }

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
      accumulate(
          result, fieldChange.getName(), extractIdentifiers(fieldChange.getNewValue()), List.of());
    }
    for (FieldChange fieldChange : listOrEmpty(changeDescription.getFieldsDeleted())) {
      accumulate(
          result, fieldChange.getName(), List.of(), extractIdentifiers(fieldChange.getOldValue()));
    }
    for (FieldChange fieldChange : listOrEmpty(changeDescription.getFieldsUpdated())) {
      accumulate(
          result,
          fieldChange.getName(),
          extractIdentifiers(fieldChange.getNewValue()),
          extractIdentifiers(fieldChange.getOldValue()));
    }
    return result;
  }

  private static void accumulate(
      Map<String, FieldDiff> result, String field, List<String> added, List<String> removed) {
    FieldDiff incoming = new FieldDiff(added, removed);
    FieldDiff prior = result.get(field);
    result.put(field, prior == null ? incoming : prior.merge(incoming));
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

  public static Map<String, FieldDiff> extractProposedChanges(Object payload) {
    if (!(payload instanceof Map<?, ?> payloadMap)) return new LinkedHashMap<>();
    Object existing = payloadMap.get(PROPOSED_CHANGES_KEY);
    if (!(existing instanceof Map<?, ?> existingMap)) return new LinkedHashMap<>();
    Map<String, FieldDiff> result = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : existingMap.entrySet()) {
      String field = String.valueOf(entry.getKey());
      FieldDiff diff = coerceFieldDiff(entry.getValue());
      if (diff != null) {
        result.put(field, diff);
      }
    }
    return result;
  }

  /**
   * Accepts either an in-memory {@link FieldDiff} record (freshly built and not yet round-tripped
   * through JSON) or a raw {@code Map<String, List<String>>} read back from the persisted task
   * payload, and returns a {@link FieldDiff}. Returns {@code null} when the value is neither
   * shape.
   */
  private static FieldDiff coerceFieldDiff(Object value) {
    if (value instanceof FieldDiff fd) return fd;
    if (value instanceof Map<?, ?> diffMap) {
      return new FieldDiff(
          coerceStringList(diffMap.get("added")), coerceStringList(diffMap.get("removed")));
    }
    return null;
  }

  private static List<String> coerceStringList(Object value) {
    if (!(value instanceof Collection<?> collection)) return List.of();
    return collection.stream().filter(java.util.Objects::nonNull).map(String::valueOf).toList();
  }

  /**
   * The payload of a task that reviews a change request. The request's pending revision is what
   * the reviewer approves and is already cumulative, so it replaces any preview carried from an
   * earlier revision's task. The payload is returned unchanged when the revision has no changes.
   */
  public static Object buildProposedChangesPayload(
      EntityInterface<?> entity, Object existingPayload, ChangeDescription pending) {
    Object payload = existingPayload;
    if (entity != null && !hasNoChanges(pending)) {
      payload =
          previewOrUnchanged(
              entity,
              existingPayload,
              () ->
                  withPreview(entity, existingPayload, buildChangeMap(maskedFor(entity, pending))));
    }
    return payload;
  }

  /**
   * The payload of a task in an approval cycle: its preview is the fold of every change since the
   * cycle began, replacing whatever preview the payload carried, and the payload records where the
   * cycle began so the task that supersedes it continues from there. The cycle is read here, inside
   * the guard, so a history that cannot be read leaves the payload as it was.
   */
  public static Object withCyclePreview(
      EntityInterface<?> entity, Object existingPayload, Supplier<CyclePreview> cycle) {
    return previewOrUnchanged(
        entity, existingPayload, () -> withCycle(entity, existingPayload, cycle.get()));
  }

  private static Map<String, Object> withCycle(
      EntityInterface<?> entity, Object existingPayload, CyclePreview cycle) {
    Map<String, Object> updated =
        withPreview(entity, existingPayload, foldChanges(entity, cycle.changes()));
    updated.put(PROPOSED_CHANGES_BASE_VERSION_KEY, cycle.baseVersion());
    return updated;
  }

  /**
   * The net change of {@code oldestFirst}, each change folded into the ones before it so an edit
   * taken back cancels out. The status is left out: an approval workflow moves it itself, for
   * example to In Review right before it opens the task.
   */
  public static Map<String, FieldDiff> foldChanges(
      EntityInterface<?> entity, List<ChangeDescription> oldestFirst) {
    Map<String, FieldDiff> folded = new LinkedHashMap<>();
    for (ChangeDescription change : oldestFirst) {
      folded = mergeChangeMaps(folded, buildChangeMap(maskedFor(entity, change)));
    }
    folded.remove(Entity.FIELD_ENTITY_STATUS);
    return folded;
  }

  /** The version the approval cycle of a task's payload began from, when it records one. */
  public static OptionalDouble cycleBaseOf(Object payload) {
    Object base =
        payload instanceof Map<?, ?> payloadMap
            ? payloadMap.get(PROPOSED_CHANGES_BASE_VERSION_KEY)
            : null;
    return base instanceof Number version && isVersion(version.doubleValue())
        ? OptionalDouble.of(version.doubleValue())
        : OptionalDouble.empty();
  }

  private static boolean isVersion(double value) {
    return Double.isFinite(value) && value >= 0;
  }

  private static ChangeDescription maskedFor(EntityInterface<?> entity, ChangeDescription change) {
    ChangeDescription masked = change;
    if (entity instanceof McpServer) {
      masked = JsonUtils.deepCopy(change, ChangeDescription.class);
      McpServerMasker.maskChangeDescription(masked);
    }
    return masked;
  }

  // A preview the task cannot show must not keep the approval task from being created. Reading the
  // history behind it can fail on an entity deleted meanwhile, an entity type the status adapter
  // cannot read, an unreadable stored version, or the database itself.
  private static Object previewOrUnchanged(
      EntityInterface<?> entity, Object existingPayload, Supplier<Object> build) {
    Object payload = existingPayload;
    try {
      payload = build.get();
    } catch (JsonParsingException
        | EntityNotFoundException
        | IllegalArgumentException
        | JdbiException unreadable) {
      LOG.warn(
          "Failed to build proposed-changes payload for approval task on {}; the task keeps its"
              + " existing payload",
          entity.getFullyQualifiedName(),
          unreadable);
    }
    return payload;
  }

  private static Map<String, Object> withPreview(
      EntityInterface<?> entity, Object existingPayload, Map<String, FieldDiff> preview) {
    Map<String, Object> updated = cloneAsMutableMap(existingPayload);
    if (preview.isEmpty()) {
      updated.remove(PROPOSED_CHANGES_KEY);
    } else {
      updated.put(PROPOSED_CHANGES_KEY, preview);
    }
    LOG.debug(
        "[ChangePreview] entity='{}' v={} preview={}",
        entity.getFullyQualifiedName(),
        entity.getVersion(),
        preview);
    return updated;
  }

  /**
   * Stamps the change request and the exact revision a review task decides, so the resolver echoes
   * the revision back and a decision can never be recorded against a different one.
   */
  public static Object withChangeRequestLink(Object payload, UUID changeRequestId, int revision) {
    Map<String, Object> linked = cloneAsMutableMap(payload);
    linked.put(CHANGE_REQUEST_ID_KEY, changeRequestId.toString());
    linked.put(CHANGE_REQUEST_REVISION_KEY, revision);
    return linked;
  }

  /**
   * When a workflow replaces the whole task payload through a {@code requestedPayload} variable,
   * the preview state of the prior payload would be lost. Each preview key the replacement does not
   * carry is copied over from the prior payload.
   */
  public static Object preservePreviewState(Object requestedPayload, Object priorPayload) {
    Object preserved = requestedPayload;
    if (requestedPayload instanceof Map<?, ?> requested
        && priorPayload instanceof Map<?, ?> prior) {
      Map<String, Object> merged = cloneAsMutableMap(requested);
      PREVIEW_STATE_KEYS.stream()
          .filter(key -> requested.get(key) == null && prior.get(key) != null)
          .forEach(key -> merged.put(key, prior.get(key)));
      preserved = merged;
    }
    return preserved;
  }

  private static Map<String, Object> cloneAsMutableMap(Object payload) {
    if (!(payload instanceof Map<?, ?> source)) return new LinkedHashMap<>();
    Map<String, Object> copy = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : source.entrySet()) {
      copy.put(String.valueOf(entry.getKey()), entry.getValue());
    }
    return copy;
  }
}
