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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.EntityExtensionReferences.ENTITY_REFERENCE;
import static org.openmetadata.service.jdbi3.EntityExtensionReferences.ENTITY_REFERENCE_LIST;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.jdbi3.EntityExtensionReferenceCompaction.Outcome;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Column-level counterpart of {@link EntityExtensionReferences}. A column's value is one {@code
 * entity_extension} row keyed by the hash of the column FQN, holding every custom property of the
 * column, and a second copy lives inline in the holder's own JSON; compaction rewrites both, or
 * the inline copy would serve the dead reference again.
 */
public final class ColumnExtensionReferences {
  static final String COLUMN_EXTENSION_SCHEMA = TableRepository.COLUMN_EXTENSION_JSON_SCHEMA;
  private static final Map<String, String> COLUMN_ENTITY_TYPES =
      Map.of(
          Entity.TABLE,
          Entity.TABLE_COLUMN,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.DASHBOARD_DATA_MODEL_COLUMN);
  private static final Set<String> REFERENCE_TYPES =
      Set.of(ENTITY_REFERENCE, ENTITY_REFERENCE_LIST);
  private static final String FIELD_COLUMNS = "columns";
  private static final String FIELD_CHILDREN = "children";
  private static final String FIELD_EXTENSION = "extension";
  private static final String FIELD_FQN = "fullyQualifiedName";

  private final CollectionDAO daoCollection;
  private final EntityExtensionReferences references;

  public ColumnExtensionReferences(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
    this.references = new EntityExtensionReferences(daoCollection);
  }

  /** Whether this server's registry knows a reference-typed column property for the holder type. */
  public static boolean tracksReferences(String holderType) {
    String columnType = COLUMN_ENTITY_TYPES.get(holderType);
    return columnType != null && TypeRegistry.hasCustomPropertyOfType(columnType, REFERENCE_TYPES);
  }

  /** The holder type whose columns a column entity type describes, or null for any other type. */
  public static String holderTypeOfColumnType(String columnType) {
    return COLUMN_ENTITY_TYPES.entrySet().stream()
        .filter(entry -> entry.getValue().equals(columnType))
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse(null);
  }

  /**
   * Write-side gate. Unlike {@link #tracksReferences}, it also asks the registry about each field
   * of the value, which reloads a property this server has not seen; a write that skipped the
   * ledger for a property created on a peer would leave a reference nothing ever cleans.
   */
  public static boolean carriesReferences(String holderType, JsonNode value) {
    if (COLUMN_ENTITY_TYPES.get(holderType) == null || value == null || !value.isObject()) {
      return false;
    }
    if (tracksReferences(holderType)) {
      return true;
    }
    Predicate<String> isReference = referencePropertiesOf(holderType);
    Iterator<String> names = value.fieldNames();
    while (names.hasNext()) {
      if (isReference.test(names.next())) {
        return true;
      }
    }
    return false;
  }

  static Predicate<String> referencePropertiesOf(String holderType) {
    String columnType = COLUMN_ENTITY_TYPES.get(holderType);
    return name ->
        columnType != null && EntityExtensionReferences.isReferenceProperty(columnType, name);
  }

  public static String columnKey(String columnFqn) {
    return FullyQualifiedName.buildHash(columnFqn);
  }

  /** Referenced ids of every reference-typed property in one column's value, by target type. */
  public static Map<String, List<String>> referencedIdsByType(
      JsonNode extension, Predicate<String> isReference) {
    Map<String, Set<String>> merged = new LinkedHashMap<>();
    if (extension != null && extension.isObject()) {
      extension
          .fields()
          .forEachRemaining(
              field -> {
                if (isReference.test(field.getKey())) {
                  EntityExtensionReferences.referencedIdsByType(field.getValue())
                      .forEach(
                          (type, ids) ->
                              merged
                                  .computeIfAbsent(type, ignored -> new LinkedHashSet<>())
                                  .addAll(ids));
                }
              });
    }
    Map<String, List<String>> byType = new LinkedHashMap<>();
    merged.forEach((type, ids) -> byType.put(type, List.copyOf(ids)));
    return byType;
  }

  /** Completes name-only references in place so the stored value can be matched by id. */
  public static void fillIds(JsonNode extension, Predicate<String> isReference) {
    if (extension != null && extension.isObject()) {
      extension
          .fields()
          .forEachRemaining(
              field -> {
                if (isReference.test(field.getKey())) {
                  EntityUtil.fillCustomPropertyReferenceIds(field.getValue());
                }
              });
    }
  }

  /**
   * Diffs one column's value against the ledger rows it already has, so only ids new to the column
   * are locked; an id that is already marked dead stays marked and is filtered on read.
   */
  public void replace(UUID holderId, String holderType, String columnKey, JsonNode extension) {
    Map<String, List<String>> after =
        referencedIdsByType(extension, referencePropertiesOf(holderType));
    Set<String> before =
        new HashSet<>(daoCollection.entityExtensionReferenceDAO().findToIds(holderId, columnKey));
    List<String> removed = new ArrayList<>(before);
    removed.removeAll(EntityExtensionReferences.flatten(after));
    daoCollection.entityExtensionReferenceDAO().deleteMany(holderId, columnKey, removed);
    references.insertLocked(
        holderId, holderType, columnKey, EntityExtensionReferences.withoutIds(after, before));
  }

  public void delete(UUID holderId, String columnKey) {
    daoCollection.entityExtensionReferenceDAO().delete(holderId, columnKey);
  }

  /** Removes dead ids from every reference-typed property; a property it empties is dropped. */
  static boolean removeDead(ObjectNode extension, Set<String> dead, Predicate<String> isReference) {
    List<String> emptied = new ArrayList<>();
    boolean changed = false;
    Iterator<Map.Entry<String, JsonNode>> fields = extension.fields();
    while (fields.hasNext()) {
      Map.Entry<String, JsonNode> field = fields.next();
      if (isReference.test(field.getKey())) {
        changed |= removeDeadFrom(field, dead, emptied);
      }
    }
    emptied.forEach(extension::remove);
    return changed;
  }

  private static boolean removeDeadFrom(
      Map.Entry<String, JsonNode> field, Set<String> dead, List<String> emptied) {
    JsonNode value = field.getValue();
    boolean changed;
    if (value.isArray()) {
      changed = EntityExtensionReferences.removeDeadElements((ArrayNode) value, dead);
      if (changed && value.isEmpty()) {
        emptied.add(field.getKey());
      }
    } else {
      changed = dead.contains(EntityExtensionReferences.idOf(value));
      if (changed) {
        emptied.add(field.getKey());
      }
    }
    return changed;
  }

  /**
   * Compacts some column values of one holder in one transaction. Every lock is SKIP LOCKED, so the
   * sweep never waits on a writer and can never be part of a lock cycle: the holder row first, then
   * each value row, then its ledger rows. The holder's inline copy is rewritten once per call.
   */
  Outcome compactInTransaction(
      CollectionDAO dao, UUID holderId, String holderType, List<String> columnKeys) {
    EntityDAO<?> holderDao = Entity.getEntityRepository(holderType).getDao();
    String holderJson = holderDao.findByIdForUpdateSkipLocked(holderDao.getTableName(), holderId);
    if (holderJson == null) {
      return isGone(holderDao, holderId) ? dropOrphans(dao, holderId, columnKeys) : Outcome.SKIPPED;
    }
    Predicate<String> isReference = referencePropertiesOf(holderType);
    Map<String, Set<String>> compacted = new HashMap<>();
    boolean changed = false;
    for (String key : columnKeys) {
      RowResult row = compactRow(dao, holderId, key, isReference);
      changed |= row.changed();
      if (row.processed()) {
        compacted.put(key, row.dead());
      }
    }
    changed |= rewriteInline(holderDao, holderId, holderJson, compacted, isReference);
    return outcomeOf(compacted.isEmpty(), changed);
  }

  private static Outcome outcomeOf(boolean nothingProcessed, boolean changed) {
    if (changed) {
      return Outcome.REWRITTEN;
    }
    return nothingProcessed ? Outcome.SKIPPED : Outcome.CLEANED;
  }

  private static boolean isGone(EntityDAO<?> holderDao, UUID holderId) {
    return holderDao
        .findExistingIds(holderDao.getTableName(), List.of(holderId.toString()))
        .isEmpty();
  }

  private static Outcome dropOrphans(CollectionDAO dao, UUID holderId, List<String> columnKeys) {
    columnKeys.forEach(key -> dao.entityExtensionReferenceDAO().delete(holderId, key));
    return Outcome.CLEANED;
  }

  private record RowResult(boolean processed, boolean changed, Set<String> dead) {
    static final RowResult SKIPPED = new RowResult(false, false, Set.of());
  }

  private static RowResult compactRow(
      CollectionDAO dao, UUID holderId, String key, Predicate<String> isReference) {
    String json = dao.entityExtensionDAO().getExtensionForUpdateSkipLocked(holderId, key);
    if (json == null) {
      return dropIfValueGone(dao, holderId, key);
    }
    Set<String> dead =
        Set.copyOf(dao.entityExtensionReferenceDAO().findPendingForUpdate(holderId, key));
    if (dead.isEmpty()) {
      // SKIP LOCKED: another transaction holds these marks; a later run takes them.
      return RowResult.SKIPPED;
    }
    JsonNode value = JsonUtils.readTree(json);
    boolean changed = value.isObject() && removeDead((ObjectNode) value, dead, isReference);
    if (changed) {
      storeValue(dao, holderId, key, value);
    }
    dao.entityExtensionReferenceDAO().deleteMany(holderId, key, List.copyOf(dead));
    return new RowResult(true, changed, dead);
  }

  private static RowResult dropIfValueGone(CollectionDAO dao, UUID holderId, String key) {
    if (dao.entityExtensionDAO().getExtension(holderId, key) != null) {
      return RowResult.SKIPPED;
    }
    dao.entityExtensionReferenceDAO().delete(holderId, key);
    return new RowResult(true, false, Set.of());
  }

  private static void storeValue(CollectionDAO dao, UUID holderId, String key, JsonNode value) {
    if (value.isEmpty()) {
      dao.entityExtensionDAO().delete(holderId, key);
    } else {
      dao.entityExtensionDAO().insert(holderId, key, COLUMN_EXTENSION_SCHEMA, value.toString());
    }
  }

  private static boolean rewriteInline(
      EntityDAO<?> holderDao,
      UUID holderId,
      String holderJson,
      Map<String, Set<String>> deadByKey,
      Predicate<String> isReference) {
    if (deadByKey.values().stream().allMatch(Set::isEmpty)) {
      return false;
    }
    JsonNode root = JsonUtils.readTree(holderJson);
    if (!root.hasNonNull(FIELD_FQN)) {
      return false;
    }
    boolean changed = removeDeadFromColumns(root.get(FIELD_COLUMNS), deadByKey, isReference);
    if (changed) {
      holderDao.update(holderId, root.path(FIELD_FQN).asText(), root.toString());
    }
    return changed;
  }

  private static boolean removeDeadFromColumns(
      JsonNode columns, Map<String, Set<String>> deadByKey, Predicate<String> isReference) {
    boolean changed = false;
    if (columns != null && columns.isArray()) {
      for (JsonNode column : columns) {
        changed |= removeDeadFromColumn(column, deadByKey, isReference);
        changed |= removeDeadFromColumns(column.get(FIELD_CHILDREN), deadByKey, isReference);
      }
    }
    return changed;
  }

  private static boolean removeDeadFromColumn(
      JsonNode column, Map<String, Set<String>> deadByKey, Predicate<String> isReference) {
    Set<String> dead =
        column.hasNonNull(FIELD_FQN)
            ? deadByKey.get(columnKey(column.get(FIELD_FQN).asText()))
            : null;
    boolean changed =
        dead != null
            && column.get(FIELD_EXTENSION) instanceof ObjectNode extension
            && removeDead(extension, dead, isReference);
    if (changed && column.get(FIELD_EXTENSION).isEmpty()) {
      ((ObjectNode) column).remove(FIELD_EXTENSION);
    }
    return changed;
  }
}
