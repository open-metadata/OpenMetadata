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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.CustomPropertyReferenceDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceRow;

/**
 * The only home of {@code entityReference} and {@code entityReferenceList} custom-property values:
 * one row per referenced entity in {@code custom_property_reference}. Every other property type
 * stays in {@code entity_extension}. A hard delete removes the rows pointing at the deleted
 * entity, so a stored reference can never outlive its target.
 */
@Slf4j
public final class CustomPropertyReferences {
  public static final String ENTITY_REFERENCE = "entityReference";
  public static final String ENTITY_REFERENCE_LIST = "entityReferenceList";
  public static final Set<String> REFERENCE_TYPES = Set.of(ENTITY_REFERENCE, ENTITY_REFERENCE_LIST);
  public static final String ENTITY_LEVEL = "";
  private static final String FIELD_ID = "id";
  private static final String FIELD_TYPE = "type";

  /** Holder types whose columns carry custom properties, and the column entity type of each. */
  public static final Map<String, String> COLUMN_TYPES =
      Map.of(
          Entity.TABLE, Entity.TABLE_COLUMN,
          Entity.DASHBOARD_DATA_MODEL, Entity.DASHBOARD_DATA_MODEL_COLUMN);

  private final CollectionDAO daoCollection;

  public CustomPropertyReferences(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  /** Where one value lives: a holder, and the column it belongs to ({@link #ENTITY_LEVEL} if none). */
  public record Scope(String holderType, UUID holderId, String columnKey) {}

  public static boolean isReferenceProperty(String typeName, String propertyName) {
    try {
      return REFERENCE_TYPES.contains(TypeRegistry.getCustomPropertyType(typeName, propertyName));
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  public static Predicate<String> referencePropertiesOf(String typeName) {
    return typeName == null ? name -> false : name -> isReferenceProperty(typeName, name);
  }

  /**
   * Moves the reference-typed properties out of {@code extension} into the returned node; the rest
   * stays behind. Either node may end up empty.
   */
  public static ObjectNode extractReferences(ObjectNode extension, Predicate<String> isReference) {
    ObjectNode references = JsonUtils.getObjectNode();
    Iterator<Map.Entry<String, JsonNode>> fields = extension.fields();
    while (fields.hasNext()) {
      Map.Entry<String, JsonNode> field = fields.next();
      if (isReference.test(field.getKey())) {
        references.set(field.getKey(), field.getValue());
        fields.remove();
      }
    }
    return references;
  }

  /**
   * Returns {@code extension} with its reference properties taken from {@code references} only, so
   * a stale copy (for example a cached row written before the migration) never shows through.
   */
  public static Object withReferences(
      Object extension, ObjectNode references, Predicate<String> isReference) {
    JsonNode node = extension == null ? null : JsonUtils.valueToTree(extension);
    ObjectNode merged =
        node instanceof ObjectNode objectNode ? objectNode.deepCopy() : JsonUtils.getObjectNode();
    extractReferences(merged, isReference);
    if (references != null) {
      merged.setAll(references);
    }
    return merged.isEmpty() ? null : JsonUtils.treeToValue(merged, Object.class);
  }

  /** The column entity type of a holder type, or null when its columns carry no properties. */
  public static String columnTypeOf(String holderType) {
    return holderType == null ? null : COLUMN_TYPES.get(holderType);
  }

  /** Reference properties of a holder's columns; matches nothing for other holder types. */
  public static Predicate<String> columnReferencePropertiesOf(String holderType) {
    String columnType = columnTypeOf(holderType);
    return columnType == null ? name -> false : referencePropertiesOf(columnType);
  }

  /** Entity-level reference values by holder, each as a node of property name to value. */
  public Map<UUID, ObjectNode> read(String typeName, List<UUID> holderIds) {
    List<ReferenceRow> rows = dao().findEntityLevel(toStrings(holderIds));
    Map<UUID, ObjectNode> byHolder = new HashMap<>();
    groupByScope(rows)
        .forEach(
            (scope, scopeRows) ->
                byHolder.put(UUID.fromString(scope.id()), assemble(typeName, scopeRows)));
    return byHolder;
  }

  /** Column-level reference values of one holder, by column key, for the given keys only. */
  public Map<String, ObjectNode> readColumns(
      String columnTypeName, UUID holderId, Collection<String> columnKeys) {
    Map<String, ObjectNode> byColumn = new HashMap<>();
    if (columnKeys.isEmpty()) {
      return byColumn;
    }
    List<ReferenceRow> rows = dao().findColumns(holderId, new ArrayList<>(columnKeys));
    groupByScope(rows)
        .forEach(
            (scope, scopeRows) -> byColumn.put(scope.key(), assemble(columnTypeName, scopeRows)));
    return byColumn;
  }

  /** Column-level reference values of many holders: holder, then column key. */
  public Map<UUID, Map<String, ObjectNode>> readColumns(
      String columnTypeName, List<UUID> holderIds) {
    Map<UUID, Map<String, ObjectNode>> byHolder = new HashMap<>();
    groupByScope(dao().findColumnLevel(toStrings(holderIds)))
        .forEach(
            (scope, scopeRows) ->
                byHolder
                    .computeIfAbsent(UUID.fromString(scope.id()), ignored -> new HashMap<>())
                    .put(scope.key(), assemble(columnTypeName, scopeRows)));
    return byHolder;
  }

  /** Brings one scope's rows in line with {@code references}; a property absent there is removed. */
  public void write(Scope scope, ObjectNode references) {
    writeMany(Map.of(scope, references));
  }

  /**
   * Diffs every scope's incoming values against its persisted rows. Removed targets are deleted and
   * retained ones updated by primary key, so a row a concurrent delete already removed is never
   * written back. Added targets are inserted only once their entity is proven to exist under a
   * shared lock; a target that is gone is dropped.
   */
  public void writeMany(Map<Scope, ObjectNode> referencesByScope) {
    if (referencesByScope.isEmpty()) {
      return;
    }
    Map<RowScope, Map<String, ReferenceRow>> persisted = persistedRows(referencesByScope.keySet());
    Delta delta = new Delta();
    referencesByScope.forEach(
        (scope, references) ->
            delta.diff(
                persisted.getOrDefault(RowScope.of(scope), Map.of()), toRows(scope, references)));
    dao().deleteMany(delta.removed);
    dao().updateMany(delta.changed);
    dao().insertMany(provenTargets(delta.added));
  }

  public void deleteHolders(List<UUID> holderIds) {
    dao().deleteByHolders(toStrings(holderIds));
  }

  /** Removes every reference to these entities; returns whether any existed. */
  public boolean deleteTargets(List<UUID> targetIds) {
    return dao().deleteByTargets(toStrings(targetIds)) > 0;
  }

  public void deleteColumn(UUID holderId, String columnKey) {
    dao().deleteColumn(holderId, columnKey);
  }

  /**
   * Drops the values of a deleted property definition. A column type's properties are stored
   * against the holder type, at column level.
   */
  public void deleteProperty(String typeName, String propertyName) {
    String holderType = holderTypeOfColumnType(typeName);
    if (holderType != null) {
      dao().deleteColumnLevelProperty(holderType, propertyName);
    } else {
      dao().deleteEntityLevelProperty(typeName, propertyName);
    }
  }

  /** The holder type a column entity type belongs to, or null for any other type. */
  public static String holderTypeOfColumnType(String columnTypeName) {
    return COLUMN_TYPES.entrySet().stream()
        .filter(entry -> entry.getValue().equals(columnTypeName))
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse(null);
  }

  /** Persisted rows of one value scope, keyed by holder and column. */
  private record RowScope(String id, String key) {
    static RowScope of(Scope scope) {
      return new RowScope(scope.holderId().toString(), scope.columnKey());
    }

    static RowScope of(ReferenceRow row) {
      return new RowScope(row.id(), row.columnKey());
    }
  }

  private static final class Delta {
    private final List<ReferenceRow> removed = new ArrayList<>();
    private final List<ReferenceRow> changed = new ArrayList<>();
    private final List<ReferenceRow> added = new ArrayList<>();

    void diff(Map<String, ReferenceRow> persisted, Map<String, ReferenceRow> incoming) {
      persisted.forEach(
          (key, row) -> {
            if (!incoming.containsKey(key)) {
              removed.add(row);
            }
          });
      incoming.forEach(
          (key, row) -> {
            ReferenceRow existing = persisted.get(key);
            if (existing == null) {
              added.add(row);
            } else if (existing.position() != row.position() || !sameJson(existing, row)) {
              changed.add(row);
            }
          });
    }

    private static boolean sameJson(ReferenceRow existing, ReferenceRow row) {
      return JsonUtils.readTree(existing.json()).equals(JsonUtils.readTree(row.json()));
    }
  }

  private Map<RowScope, Map<String, ReferenceRow>> persistedRows(Collection<Scope> scopes) {
    Set<String> holders = new HashSet<>();
    boolean entityLevel = false;
    boolean columnLevel = false;
    for (Scope scope : scopes) {
      holders.add(scope.holderId().toString());
      entityLevel |= ENTITY_LEVEL.equals(scope.columnKey());
      columnLevel |= !ENTITY_LEVEL.equals(scope.columnKey());
    }
    List<String> holderIds = new ArrayList<>(holders);
    List<ReferenceRow> rows = new ArrayList<>();
    if (entityLevel) {
      rows.addAll(dao().findEntityLevel(holderIds));
    }
    if (columnLevel) {
      rows.addAll(dao().findColumnLevel(holderIds));
    }
    Map<RowScope, Map<String, ReferenceRow>> byScope = new HashMap<>();
    rows.forEach(
        row ->
            byScope
                .computeIfAbsent(RowScope.of(row), ignored -> new HashMap<>())
                .put(row.key(), row));
    return byScope;
  }

  /** One row per target and property, in list order; a repeated target keeps its first position. */
  private static Map<String, ReferenceRow> toRows(Scope scope, ObjectNode references) {
    Map<String, ReferenceRow> rows = new LinkedHashMap<>();
    if (references == null) {
      return rows;
    }
    references
        .fields()
        .forEachRemaining(
            field -> {
              int position = 0;
              for (JsonNode ref : elements(field.getValue())) {
                if (isReference(ref)) {
                  ReferenceRow row = toRow(scope, field.getKey(), ref, position++);
                  rows.putIfAbsent(row.key(), row);
                }
              }
            });
    return rows;
  }

  private static List<JsonNode> elements(JsonNode value) {
    List<JsonNode> elements = new ArrayList<>();
    if (value != null && value.isArray()) {
      value.forEach(elements::add);
    } else if (value != null && value.isObject()) {
      elements.add(value);
    }
    return elements;
  }

  private static boolean isReference(JsonNode ref) {
    return ref.isObject() && ref.hasNonNull(FIELD_ID) && ref.hasNonNull(FIELD_TYPE);
  }

  private static ReferenceRow toRow(Scope scope, String propertyName, JsonNode ref, int position) {
    return new ReferenceRow(
        scope.holderId().toString(),
        scope.columnKey(),
        propertyName,
        ref.get(FIELD_ID).asText(),
        scope.holderType(),
        ref.get(FIELD_TYPE).asText(),
        position,
        ref.toString());
  }

  /**
   * Keeps only rows whose target entity exists, read under a shared lock inside the write
   * transaction. A concurrent hard delete of a target therefore either waits for this commit and
   * then removes the new row, or commits first and the target is dropped here.
   */
  private static List<ReferenceRow> provenTargets(List<ReferenceRow> added) {
    Map<String, List<ReferenceRow>> byType = new LinkedHashMap<>();
    added.forEach(row -> byType.computeIfAbsent(row.targetType(), t -> new ArrayList<>()).add(row));
    List<ReferenceRow> proven = new ArrayList<>();
    byType.forEach((type, rows) -> proven.addAll(existing(type, rows)));
    return proven;
  }

  private static List<ReferenceRow> existing(String type, List<ReferenceRow> rows) {
    if (!Entity.hasEntityRepository(type)) {
      LOG.warn("Dropping {} custom-property references of unknown type '{}'", rows.size(), type);
      return List.of();
    }
    EntityDAO<?> entityDao = Entity.getEntityRepository(type).getDao();
    List<String> ids = rows.stream().map(ReferenceRow::targetId).distinct().toList();
    Set<String> present =
        new HashSet<>(
            EntityDAO.queryInChunks(
                ids, chunk -> entityDao.lockExistingIds(entityDao.getTableName(), chunk)));
    return rows.stream().filter(row -> present.contains(row.targetId())).toList();
  }

  /** Rows of one value scope, in the order the query returned them. */
  private record ScopeKey(String id, String key) {}

  private static Map<ScopeKey, List<ReferenceRow>> groupByScope(List<ReferenceRow> rows) {
    Map<ScopeKey, List<ReferenceRow>> byScope = new LinkedHashMap<>();
    rows.forEach(
        row ->
            byScope
                .computeIfAbsent(new ScopeKey(row.id(), row.columnKey()), k -> new ArrayList<>())
                .add(row));
    return byScope;
  }

  /** Rebuilds the API shape: an object for entityReference, an array for entityReferenceList. */
  private static ObjectNode assemble(String typeName, List<ReferenceRow> rows) {
    Map<String, List<JsonNode>> byProperty = new LinkedHashMap<>();
    rows.forEach(
        row ->
            byProperty
                .computeIfAbsent(row.propertyName(), ignored -> new ArrayList<>())
                .add(JsonUtils.readTree(row.json())));
    ObjectNode values = JsonUtils.getObjectNode();
    byProperty.forEach(
        (name, refs) -> {
          if (isSingle(typeName, name)) {
            values.set(name, refs.getFirst());
          } else {
            ArrayNode list = JsonUtils.getObjectMapper().createArrayNode();
            refs.forEach(list::add);
            values.set(name, list);
          }
        });
    return values;
  }

  private static boolean isSingle(String typeName, String propertyName) {
    try {
      return ENTITY_REFERENCE.equals(TypeRegistry.getCustomPropertyType(typeName, propertyName));
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  private static List<String> toStrings(Collection<UUID> ids) {
    return ids.stream().map(UUID::toString).distinct().toList();
  }

  private CustomPropertyReferenceDAO dao() {
    return daoCollection.customPropertyReferenceDAO();
  }
}
