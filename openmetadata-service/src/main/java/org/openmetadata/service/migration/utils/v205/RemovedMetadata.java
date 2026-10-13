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

package org.openmetadata.service.migration.utils.v205;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.IntFunction;
import java.util.function.Predicate;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Finds, in an entity's version history, what an ingestion bot removed, and writes it back onto
 * {@code target} (a copy of the current entity).
 *
 * <p>A value comes back only when the change that removed it was made by an ingestion bot inside
 * the window, and nothing replaced it since. A field a user cleared, or one that has a value
 * again, is left alone, which also makes a re-run a no-op. Owners are not restored: an override
 * run still reassigns them.
 *
 * <p>A version's updatedBy is not always its author: see {@link #author}. When the author cannot
 * be told, nothing is restored - a value a user removed must never come back.
 */
final class RemovedMetadata {

  static final Set<String> INGESTION_BOTS = Set.of("ingestion-bot", "usage-bot");

  private static final String DESCRIPTION = "description";
  private static final String DISPLAY_NAME = "displayName";
  private static final String RETENTION_PERIOD = "retentionPeriod";
  private static final String TABLE_CONSTRAINTS = "tableConstraints";
  private static final String TAGS = "tags";
  private static final String COLUMNS = "columns";
  private static final String CHILDREN = "children";
  private static final String NAME = "name";
  private static final String TAG_FQN = "tagFQN";
  private static final String LABEL_TYPE = "labelType";
  private static final String DERIVED = TagLabel.LabelType.DERIVED.value();
  private static final List<String> TAG_LABEL_KEYS =
      List.of(TAG_FQN, "source", LABEL_TYPE, "state");
  private static final String FIELDS_ADDED = "fieldsAdded";
  private static final String FIELDS_UPDATED = "fieldsUpdated";
  private static final String FIELDS_DELETED = "fieldsDeleted";
  private static final List<String> CHANGE_KINDS =
      List.of(FIELDS_ADDED, FIELDS_UPDATED, FIELDS_DELETED);
  private static final Set<String> EMPTY_SERIALIZED = Set.of("", "[]", "{}");

  private final List<JsonNode> history;
  private final ObjectNode target;
  private final long since;

  /**
   * @param history the entity's versions, newest first, starting with the current one
   * @param target copy of the current entity that restored values are written onto
   * @param since start of the window, epoch millis
   */
  RemovedMetadata(final List<JsonNode> history, final ObjectNode target, final long since) {
    this.history = history;
    this.target = target;
    this.since = since;
  }

  /** description, displayName, retentionPeriod and column descriptions. */
  int restoreFields() {
    int restored = 0;
    for (final String field : List.of(DESCRIPTION, DISPLAY_NAME)) {
      restored += restoreBlanked(target, field, field, index -> text(history.get(index), field));
    }
    final String retention = removedValue(RETENTION_PERIOD);
    if (retention != null) {
      target.put(RETENTION_PERIOD, retention);
      restored++;
    }
    return restored + restoreColumnDescriptions();
  }

  private int restoreColumnDescriptions() {
    final List<Map<List<String>, ObjectNode>> columnsByVersion =
        history.stream().map(RemovedMetadata::columnsByPath).toList();
    int restored = 0;
    for (final Map.Entry<List<String>, ObjectNode> column : columnsByPath(target).entrySet()) {
      restored +=
          restoreBlanked(
              column.getValue(),
              DESCRIPTION,
              FullyQualifiedName.build(COLUMNS, column.getKey().getLast(), DESCRIPTION),
              index -> {
                final ObjectNode then = columnsByVersion.get(index).get(column.getKey());
                return then == null ? null : text(then, DESCRIPTION);
              });
    }
    return restored;
  }

  private int restoreBlanked(
      final ObjectNode holder,
      final String field,
      final String changeName,
      final IntFunction<String> valueAt) {
    int restored = 0;
    if (isBlank(holder.get(field))) {
      final String value = blankedValue(changeName, valueAt);
      if (value != null) {
        holder.put(field, value);
        restored = 1;
      }
    }
    return restored;
  }

  /**
   * The value a field had before an ingestion bot blanked it inside the window, walking versions
   * newest first. {@code valueAt} returns, for a history index, "" for a blank value and null when
   * the holder (a column) did not exist in that version, which ends the walk: a dropped column
   * took its description with it, and that was the source's call. {@code changeName} is the
   * field's name in changeDescription.
   */
  private String blankedValue(final String changeName, final IntFunction<String> valueAt) {
    String value = null;
    for (int index = 0; index + 1 < history.size(); index++) {
      final JsonNode newer = history.get(index);
      final String older = valueAt.apply(index + 1);
      if (updatedAt(newer) < since || older == null || !older.isEmpty()) {
        final boolean blankedByBot =
            older != null
                && !older.isEmpty()
                && isIngestionBotChange(newer, changeName, updatedAt(history.get(index + 1)));
        value = blankedByBot ? older : null;
        break;
      }
    }
    return value;
  }

  /**
   * The old value of a field no source sends (retentionPeriod), when its newest change was an
   * ingestion bot deleting it inside the window. Read from changeDescription rather than the
   * snapshot: the current entity carries its parent's retentionPeriod once its own is gone.
   */
  private String removedValue(final String field) {
    for (final JsonNode version : history) {
      final List<FieldChange> changes = changes(version, field::equals);
      if (!changes.isEmpty()) {
        final FieldChange newest = changes.getLast();
        final boolean restorable =
            newest.deleted()
                && isIngestionBotChange(version, null, 0)
                && !isBlank(newest.oldValue());
        return restorable ? newest.oldValue().asText() : null;
      }
      if (updatedAt(version) < since) {
        break;
      }
    }
    return null;
  }

  /**
   * Tags an ingestion bot removed inside the window, on the entity and its columns. A tag comes
   * back only when nothing of its classification or glossary is on the holder now - otherwise the
   * source legitimately replaced it, which the fixed server still does - and only one per
   * classification, since Tier and other mutually exclusive classifications allow just one.
   */
  int restoreTags() {
    int restored = 0;
    for (final Map.Entry<String, List<JsonNode>> removed : removedTags().entrySet()) {
      final ObjectNode holder = tagHolder(removed.getKey());
      if (holder != null) {
        restored += addMissingTags(arrayField(holder, TAGS), removed.getValue());
      }
    }
    return restored;
  }

  private static int addMissingTags(final ArrayNode tags, final List<JsonNode> removed) {
    final Set<String> roots = new HashSet<>();
    tags.forEach(
        tag -> {
          if (!DERIVED.equals(tag.path(LABEL_TYPE).asText())) {
            roots.add(tagRoot(tag));
          }
        });
    int restored = 0;
    for (final JsonNode tag : removed) {
      if (roots.add(tagRoot(tag))) {
        final ObjectNode label = JsonNodeFactory.instance.objectNode();
        TAG_LABEL_KEYS.stream().filter(tag::has).forEach(key -> label.set(key, tag.get(key)));
        tags.add(label);
        restored++;
      }
    }
    return restored;
  }

  /** {tag field name: tags}, for tags whose newest removal was an ingestion bot in the window. */
  private Map<String, List<JsonNode>> removedTags() {
    final Set<String> seen = new HashSet<>();
    final Map<String, List<JsonNode>> removed = new LinkedHashMap<>();
    for (final JsonNode version : versionsInWindow()) {
      final List<FieldChange> deletions =
          changes(version, RemovedMetadata::isTagField).stream()
              .filter(FieldChange::deleted)
              .toList();
      for (final FieldChange change : deletions) {
        for (final JsonNode tag : asArray(change.oldValue())) {
          final boolean newestRemoval = seen.add(change.name() + '\0' + tag.path(TAG_FQN).asText());
          if (newestRemoval
              && isIngestionBotChange(version, null, 0)
              && !DERIVED.equals(tag.path(LABEL_TYPE).asText())) {
            removed.computeIfAbsent(change.name(), name -> new ArrayList<>()).add(tag);
          }
        }
      }
    }
    return removed;
  }

  /**
   * Constraints an ingestion bot removed inside the window that are missing now. One whose columns
   * the table no longer has stays gone: the fixed server drops those too.
   */
  int restoreConstraints() {
    int restored = 0;
    if (target.has(COLUMNS)) {
      final Set<String> columns = new HashSet<>();
      target.get(COLUMNS).forEach(column -> columns.add(column.path(NAME).asText()));
      final ArrayNode constraints = arrayField(target, TABLE_CONSTRAINTS);
      final Set<List<Object>> present = new HashSet<>();
      constraints.forEach(constraint -> present.add(constraintKey(constraint)));
      for (final JsonNode constraint : removedConstraints()) {
        if (columns.containsAll(texts(constraint.path(COLUMNS)))
            && present.add(constraintKey(constraint))) {
          constraints.add(constraint);
          restored++;
        }
      }
    }
    return restored;
  }

  /** Constraints whose newest removal was an ingestion bot in the window. */
  private List<JsonNode> removedConstraints() {
    final Set<List<Object>> seen = new HashSet<>();
    final List<JsonNode> removed = new ArrayList<>();
    for (final JsonNode version : versionsInWindow()) {
      final boolean byBot = isIngestionBotChange(version, null, 0);
      for (final FieldChange change : changes(version, TABLE_CONSTRAINTS::equals)) {
        if (change.deleted()) {
          for (final JsonNode constraint : asArray(change.oldValue())) {
            if (seen.add(constraintKey(constraint)) && byBot) {
              removed.add(constraint);
            }
          }
        }
      }
    }
    return removed;
  }

  private List<JsonNode> versionsInWindow() {
    return history.stream().takeWhile(version -> updatedAt(version) >= since).toList();
  }

  private static List<Object> constraintKey(final JsonNode constraint) {
    return List.of(
        constraint.path("constraintType").asText(),
        texts(constraint.path(COLUMNS)).stream().sorted().toList(),
        texts(constraint.path("referredColumns")).stream().sorted().toList());
  }

  private static List<String> texts(final JsonNode array) {
    final List<String> texts = new ArrayList<>();
    array.forEach(node -> texts.add(node.asText()));
    return texts;
  }

  private static boolean isTagField(final String name) {
    return TAGS.equals(name) || (name.startsWith(COLUMNS + ".") && name.endsWith("." + TAGS));
  }

  /**
   * The entity for "tags", or the column a "columns.<name>.tags" change names. The change carries
   * only the column's local name, so a name shared by nested columns is ambiguous and skipped.
   */
  private ObjectNode tagHolder(final String field) {
    if (TAGS.equals(field)) {
      return target;
    }
    final List<ObjectNode> matches =
        columnsByPath(target).values().stream()
            .filter(
                column ->
                    FullyQualifiedName.build(COLUMNS, column.path(NAME).asText(), TAGS)
                        .equals(field))
            .toList();
    return matches.size() == 1 ? matches.getFirst() : null;
  }

  /** Every column, nested ones included, keyed by the names from the top-level column down. */
  private static Map<List<String>, ObjectNode> columnsByPath(final JsonNode entity) {
    final Map<List<String>, ObjectNode> columns = new LinkedHashMap<>();
    addColumns(entity.path(COLUMNS), List.of(), columns);
    return columns;
  }

  private static void addColumns(
      final JsonNode columns, final List<String> parent, final Map<List<String>, ObjectNode> out) {
    for (final JsonNode column : columns) {
      if (column instanceof ObjectNode node) {
        final List<String> path = new ArrayList<>(parent);
        path.add(node.path(NAME).asText());
        out.put(List.copyOf(path), node);
        addColumns(node.path(CHILDREN), path, out);
      }
    }
  }

  private static String tagRoot(final JsonNode tag) {
    return FullyQualifiedName.unquoteName(FullyQualifiedName.split(tag.path(TAG_FQN).asText())[0]);
  }

  record FieldChange(String name, JsonNode oldValue, boolean deleted) {}

  /** A version's changes to matching fields, added first; an update to empty counts as delete. */
  private static List<FieldChange> changes(final JsonNode version, final Predicate<String> names) {
    final List<FieldChange> changes = new ArrayList<>();
    for (final String kind : CHANGE_KINDS) {
      for (final JsonNode change : version.path("changeDescription").path(kind)) {
        final String name = change.path(NAME).asText();
        if (names.test(name)) {
          final boolean deleted =
              FIELDS_DELETED.equals(kind)
                  || (FIELDS_UPDATED.equals(kind) && isBlank(change.get("newValue")));
          changes.add(new FieldChange(name, change.get("oldValue"), deleted));
        }
      }
    }
    return changes;
  }

  /** List-valued changes store their value as a JSON string. */
  private static JsonNode asArray(final JsonNode value) {
    JsonNode array = JsonNodeFactory.instance.arrayNode();
    if (value != null && value.isArray()) {
      array = value;
    } else if (value != null && value.isTextual() && value.asText().startsWith("[")) {
      array = JsonUtils.readTree(value.asText());
    }
    return array;
  }

  private boolean isIngestionBotChange(
      final JsonNode version, final String changeName, final long notBefore) {
    final Author author = author(version, changeName, notBefore);
    return author != null && author.at() >= since && INGESTION_BOTS.contains(author.name());
  }

  record Author(String name, long at) {}

  /**
   * Who made a version's changes, or null when that cannot be told.
   *
   * <p>A write that changes only a field kept out of version history - lifeCycle, which usage-bot
   * patches daily - does not bump the version, yet stamps its own updatedBy/updatedAt on the
   * current one and keeps the changeDescription it found. That version then names usage-bot for
   * changes someone else made. Its incremental change, the restamping write's own, is empty, which
   * is how it is recognised; its author is then read from changeSummary, which records who last
   * changed each description, and is unknown for anything else.
   */
  private static Author author(
      final JsonNode version, final String changeName, final long notBefore) {
    Author author = new Author(version.path("updatedBy").asText(), updatedAt(version));
    if (isRestamped(version)) {
      final JsonNode summary =
          changeName == null
              ? JsonNodeFactory.instance.missingNode()
              : version.path("changeDescription").path("changeSummary").path(changeName);
      final long changedAt = summary.path("changedAt").asLong();
      author =
          summary.has("changedBy") && changedAt >= notBefore
              ? new Author(summary.get("changedBy").asText(), changedAt)
              : null;
    }
    return author;
  }

  private static boolean isRestamped(final JsonNode version) {
    final JsonNode incremental = version.path("incrementalChangeDescription");
    return incremental.isObject()
        && CHANGE_KINDS.stream().allMatch(kind -> incremental.path(kind).isEmpty());
  }

  private static long updatedAt(final JsonNode version) {
    return version.path("updatedAt").asLong();
  }

  private static String text(final JsonNode node, final String field) {
    final JsonNode value = node.get(field);
    return isBlank(value) ? "" : value.asText();
  }

  private static boolean isBlank(final JsonNode value) {
    final boolean missing = value == null || value.isNull();
    return missing
        || (value.isContainerNode() ? value.isEmpty() : EMPTY_SERIALIZED.contains(value.asText()));
  }

  private static ArrayNode arrayField(final ObjectNode node, final String field) {
    if (!(node.get(field) instanceof ArrayNode)) {
      node.set(field, JsonNodeFactory.instance.arrayNode());
    }
    return (ArrayNode) node.get(field);
  }
}
