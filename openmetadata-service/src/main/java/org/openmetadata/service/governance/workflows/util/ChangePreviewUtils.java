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
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.WorkflowTriggerFields;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.approval.PendingApprovalChangeStore;
import org.openmetadata.service.resources.tags.TagLabelUtil;

/**
 * Builds and merges structured change-preview data stored under the {@code proposedChanges} key in
 * a task payload. The change map is a {@code Map<String, FieldDiff>} of field name to {@code
 * {added, removed}} arrays of human-readable identifiers (tagFQN, fullyQualifiedName, displayName,
 * or name).
 */
@Slf4j
public final class ChangePreviewUtils {

  public static final String PROPOSED_CHANGES_KEY = "proposedChanges";

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
   * Build a new task payload that carries the merged proposed-changes map under {@link
   * #PROPOSED_CHANGES_KEY}. Returns {@code existingPayload} unchanged when the entity has no
   * change description; returns a payload with the {@code proposedChanges} key removed when the
   * merged map is empty (e.g. all changes cancelled out across re-edits).
   */
  public static Object buildProposedChangesPayload(EntityInterface entity, Object existingPayload) {
    return buildProposedChangesPayload(
        entity, existingPayload, entity == null ? null : entity.getUpdatedBy());
  }

  public static Object buildProposedChangesPayload(
      EntityInterface entity, Object existingPayload, String updatedBy) {
    if (entity == null) return existingPayload;
    ChangeDescription changeDescription =
        resolveMutuallyExclusiveTags(entity, pickIncrementalOrFull(entity, updatedBy));
    if (hasNoChanges(changeDescription)) {
      if (LOG.isDebugEnabled()) {
        LOG.debug(
            "[ChangePreview] entity='{}' v={} changeDescription is empty/null; carrying existing payload",
            entity.getFullyQualifiedName(),
            entity.getVersion());
      }
      return existingPayload;
    }
    try {
      Map<String, FieldDiff> priorMap = extractProposedChanges(existingPayload);
      Map<String, FieldDiff> newMap = buildChangeMap(changeDescription);
      Map<String, FieldDiff> merged = mergeChangeMaps(priorMap, newMap);
      if (LOG.isDebugEnabled()) {
        LOG.debug(
            "[ChangePreview] entity='{}' v={} cdAdded={} cdDeleted={} cdUpdated={} priorPayload={} newDiff={} merged={}",
            entity.getFullyQualifiedName(),
            entity.getVersion(),
            listOrEmpty(changeDescription.getFieldsAdded()),
            listOrEmpty(changeDescription.getFieldsDeleted()),
            listOrEmpty(changeDescription.getFieldsUpdated()),
            priorMap,
            newMap,
            merged);
      }
      Map<String, Object> updated = cloneAsMutableMap(existingPayload);
      if (merged.isEmpty()) {
        updated.remove(PROPOSED_CHANGES_KEY);
      } else {
        updated.put(PROPOSED_CHANGES_KEY, merged);
      }
      return updated;
    } catch (Exception e) {
      LOG.warn(
          "Failed to build proposed-changes payload for approval task on {}",
          entity.getFullyQualifiedName(),
          e);
      return existingPayload;
    }
  }

  // Mirror the commit's tag resolution (ResolvePendingChangeImpl.resolveTags) in the reviewer's
  // preview: a held tag that is mutually exclusive with a currently-approved tag displaces it at
  // commit, so the task must show the resolved set (the conflicting tag removed) rather than an
  // impossible union the reviewer would never actually get on approve.
  private static ChangeDescription resolveMutuallyExclusiveTags(
      EntityInterface entity, ChangeDescription changeDescription) {
    ChangeDescription result = changeDescription;
    if (changeDescription != null && hasTagsChange(changeDescription)) {
      // Copy first: the source may be the entity's live change description, shared with other
      // consumers this request, so the preview must resolve on a copy and never mutate it.
      result =
          JsonUtils.readValue(JsonUtils.pojoToJson(changeDescription), ChangeDescription.class);
      Stream.concat(
              listOrEmpty(result.getFieldsUpdated()).stream(),
              listOrEmpty(result.getFieldsAdded()).stream())
          .filter(
              fieldChange ->
                  WorkflowTriggerFields.TAGS.value().equals(fieldChange.getName())
                      && fieldChange.getNewValue() != null)
          .forEach(
              fieldChange -> {
                List<TagLabel> heldTags =
                    JsonUtils.convertValue(
                        fieldChange.getNewValue(), new TypeReference<List<TagLabel>>() {});
                List<TagLabel> mergedTags =
                    TagLabelUtil.mergeTagsWithIncomingPrecedence(entity.getTags(), heldTags);
                // Store the resolved tags in the same JSON shape as the rest of the change
                // description (a list of objects) so downstream identifier extraction reads
                // tagFQN, instead of leaving raw TagLabel POJOs that get toString-ed.
                fieldChange.withNewValue(
                    JsonUtils.convertValue(
                        mergedTags, new TypeReference<List<Map<String, Object>>>() {}));
              });
    }
    return result;
  }

  private static boolean hasTagsChange(ChangeDescription changeDescription) {
    return Stream.concat(
            listOrEmpty(changeDescription.getFieldsUpdated()).stream(),
            listOrEmpty(changeDescription.getFieldsAdded()).stream())
        .anyMatch(fieldChange -> WorkflowTriggerFields.TAGS.value().equals(fieldChange.getName()));
  }

  /**
   * Precedence for the approval-task preview:
   *
   * <ol>
   *   <li>A held approval-gated change (the pending hold) wins over everything - it is the change
   *       the reviewer must approve and must never be shadowed by an intervening persisted edit
   *       (a status transition to 'In Review', a tag, some other field). The hold lives in a
   *       separate store, not a version diff, so preferring it cannot reintroduce the cumulative
   *       double-count that makes incremental win in the non-held case.
   *   <li>With no hold, prefer {@code incrementalChangeDescription} (per-edit hop diff) over
   *       {@code changeDescription} (cumulative-between-versions diff). The cumulative form
   *       double-counts when the prior task payload has already merged an intermediate state: e.g. a
   *       tag added in v0.3 then removed in v0.4 is already cancelled out in the prior task payload,
   *       but v0.4's cumulative changeDescription still reports the removal, which would re-introduce
   *       it on the {@code removed} side. The incremental form always reflects just the latest patch,
   *       which is the right unit of work to fold into the running merge.
   * </ol>
   */
  private static ChangeDescription pickIncrementalOrFull(EntityInterface entity, String updatedBy) {
    ChangeDescription result;
    // An approval-gated edit is held off the entity (reverted, so it carries no change description
    // of its own) and stashed separately. It IS what the reviewer is approving, so surface it even
    // when an intervening persisted edit produced a newer incremental diff that would otherwise
    // shadow it.
    ChangeDescription pendingHold = pendingHold(entity, updatedBy);
    if (!hasNoChanges(pendingHold)) {
      result = pendingHold;
    } else {
      ChangeDescription incremental = entity.getIncrementalChangeDescription();
      result = !hasNoChanges(incremental) ? incremental : entity.getChangeDescription();
    }
    return result;
  }

  // Reading the hold touches the entity_extension store. Guard it so this shared preview path (used
  // by every approval task, not just held ones) degrades to "no hold" instead of failing task
  // creation if the lookup ever throws (e.g. no CollectionDAO in a pure unit test, or a DB error).
  private static ChangeDescription pendingHold(EntityInterface entity, String updatedBy) {
    ChangeDescription hold = null;
    if (entity.getId() != null) {
      try {
        hold = PendingApprovalChangeStore.get(entity.getId(), updatedBy);
      } catch (Exception e) {
        LOG.debug("Could not read pending approval hold for {}", entity.getId(), e);
      }
    }
    return hold;
  }

  /**
   * When a workflow-driven update replaces the entire task payload via a {@code requestedPayload}
   * variable, any accumulated {@code proposedChanges} on the prior payload would be lost. If the
   * replacement payload does not carry its own {@code proposedChanges}, copy the key over from
   * the prior payload so the running merge base is preserved. Returns {@code requestedPayload}
   * unchanged when there is nothing to preserve.
   */
  public static Object preserveProposedChanges(Object requestedPayload, Object priorPayload) {
    if (!(requestedPayload instanceof Map<?, ?> requestedMap)) return requestedPayload;
    if (requestedMap.get(PROPOSED_CHANGES_KEY) != null) return requestedPayload;
    if (!(priorPayload instanceof Map<?, ?> priorMap)) return requestedPayload;
    Object priorProposed = priorMap.get(PROPOSED_CHANGES_KEY);
    if (priorProposed == null) return requestedPayload;
    Map<String, Object> merged = cloneAsMutableMap(requestedPayload);
    merged.put(PROPOSED_CHANGES_KEY, priorProposed);
    return merged;
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
