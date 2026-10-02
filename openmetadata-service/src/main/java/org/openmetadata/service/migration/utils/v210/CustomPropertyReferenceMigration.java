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

import static org.openmetadata.service.jdbi3.CustomPropertyReferences.ENTITY_LEVEL;
import static org.openmetadata.service.jdbi3.CustomPropertyReferences.REFERENCE_TYPES;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceRow;
import org.openmetadata.service.jdbi3.CustomPropertyReferences;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Moves {@code entityReference} / {@code entityReferenceList} custom-property values into {@code
 * custom_property_reference}, their only home from 2.1 on. Entity-level values leave {@code
 * entity_extension}; column-level values leave both the column's {@code entity_extension} row and
 * the holder's inline column copy (on main, bulk-created tables have only the inline copy).
 *
 * <p>Each page runs in one transaction: rows are inserted, counted back, and only then are the
 * source copies stripped, so a failed page leaves its sources untouched and a re-run finds only
 * what is still left to move. Name-only references get their id; references whose target no longer
 * exists are dropped. A value naming a type this server does not know is left where it is.
 * Definitions come from {@code field_relationship} because the migrate job does not load {@code
 * TypeRegistry}.
 */
@Slf4j
public final class CustomPropertyReferenceMigration {
  // Small pages: one value can hold 10k references and one table thousands of columns, and each
  // page is held in memory and written in one transaction.
  private static final int ENTITY_PAGE_SIZE = 100;
  private static final int HOLDER_PAGE_SIZE = 20;
  private static final String COLUMN_EXTENSION = "columnExtension";

  private final Handle handle;
  private final CollectionDAO dao;
  private final ConnectionType connectionType;
  private int moved;
  private int dropped;
  private int leftInPlace;

  private CustomPropertyReferenceMigration(
      Handle handle, CollectionDAO dao, ConnectionType connectionType) {
    this.handle = handle;
    this.dao = dao;
    this.connectionType = connectionType;
  }

  public static void migrate(Handle handle, CollectionDAO dao, ConnectionType connectionType) {
    new CustomPropertyReferenceMigration(handle, dao, connectionType).run();
  }

  private void run() {
    Map<String, Set<String>> propertiesByType = referencePropertiesByType();
    propertiesByType.forEach(
        (typeName, properties) -> {
          String holderType = CustomPropertyReferences.holderTypeOfColumnType(typeName);
          if (holderType == null) {
            properties.forEach(property -> migrateEntityLevel(typeName, property));
          } else {
            migrateColumnLevel(holderType, properties::contains);
          }
        });
    LOG.info(
        "Custom-property references: moved {}, dropped {} whose target no longer exists, left {} "
            + "values in place",
        moved,
        dropped,
        leftInPlace);
  }

  /** Reference property names by the type that defines them (an entity or a column type). */
  private Map<String, Set<String>> referencePropertiesByType() {
    Map<String, Set<String>> byType = new LinkedHashMap<>();
    for (String propertyType : REFERENCE_TYPES) {
      dao.fieldRelationshipDAO()
          .findFrom(propertyType, Entity.TYPE, Relationship.HAS.ordinal())
          .forEach(
              row -> {
                String[] parts = FullyQualifiedName.split(row.getLeft());
                byType
                    .computeIfAbsent(parts[0], ignored -> new HashSet<>())
                    .add(FullyQualifiedName.unquoteName(parts[2]));
              });
    }
    return byType;
  }

  // ---------------------------------------------------------------- entity level

  private record SourceRow(String id, String extension, String json) {}

  private void migrateEntityLevel(String holderType, String property) {
    String key = TypeRegistry.getCustomPropertyFQN(holderType, property);
    String afterId = "";
    List<SourceRow> page = entityLevelPage(key, afterId);
    while (!page.isEmpty()) {
      List<SourceRow> current = page;
      handle.useTransaction(ignored -> migrateEntityLevelPage(holderType, property, current));
      afterId = page.getLast().id();
      page = page.size() < ENTITY_PAGE_SIZE ? List.of() : entityLevelPage(key, afterId);
    }
  }

  private List<SourceRow> entityLevelPage(String key, String afterId) {
    return handle
        .createQuery(
            "SELECT id, extension, json FROM entity_extension WHERE extension = :extension "
                + "AND id > :afterId ORDER BY id LIMIT :limit")
        .bind("extension", key)
        .bind("afterId", afterId)
        .bind("limit", ENTITY_PAGE_SIZE)
        .map((rs, ctx) -> new SourceRow(rs.getString("id"), rs.getString(2), rs.getString(3)))
        .list();
  }

  private void migrateEntityLevelPage(String holderType, String property, List<SourceRow> page) {
    List<ReferenceRow> rows = new ArrayList<>();
    List<SourceRow> moveable = new ArrayList<>();
    for (SourceRow source : page) {
      List<ReferenceRow> sourceRows =
          toRows(holderType, source.id(), ENTITY_LEVEL, property, readValue(source.json()));
      if (sourceRows != null) {
        rows.addAll(sourceRows);
        moveable.add(source);
      }
    }
    List<ReferenceRow> kept = insertExisting(rows);
    long stored =
        moveable.isEmpty()
            ? 0
            : dao.customPropertyReferenceDAO()
                .countEntityLevel(moveable.stream().map(SourceRow::id).toList(), property);
    verify(stored, kept.size(), holderType + "." + property);
    moveable.forEach(
        source ->
            dao.entityExtensionDAO().delete(UUID.fromString(source.id()), source.extension()));
  }

  // ---------------------------------------------------------------- column level

  private record Holder(String id, String json) {}

  private void migrateColumnLevel(String holderType, Predicate<String> isReference) {
    String table = Entity.getEntityRepository(holderType).getDao().getTableName();
    String afterId = "";
    List<Holder> page = holderPage(table, afterId);
    while (!page.isEmpty()) {
      List<Holder> current = page;
      handle.useTransaction(
          ignored -> migrateColumnLevelPage(holderType, table, isReference, current));
      afterId = page.getLast().id();
      page = page.size() < HOLDER_PAGE_SIZE ? List.of() : holderPage(table, afterId);
    }
  }

  private List<Holder> holderPage(String table, String afterId) {
    return handle
        .createQuery(
            "SELECT id, json FROM " + table + " WHERE id > :afterId ORDER BY id LIMIT :limit")
        .bind("afterId", afterId)
        .bind("limit", HOLDER_PAGE_SIZE)
        .map((rs, ctx) -> new Holder(rs.getString("id"), rs.getString("json")))
        .list();
  }

  private void migrateColumnLevelPage(
      String holderType, String table, Predicate<String> isReference, List<Holder> page) {
    Map<String, Map<String, SourceRow>> sideRows = sideRows(page);
    List<ReferenceRow> rows = new ArrayList<>();
    List<Runnable> strips = new ArrayList<>();
    List<String> movedHolders = new ArrayList<>();
    for (Holder holder : page) {
      ColumnMove move = planColumnMove(holderType, holder, sideRows, isReference);
      if (move != null) {
        rows.addAll(move.rows());
        strips.add(() -> applyColumnMove(table, holder, move));
        movedHolders.add(holder.id());
      }
    }
    List<ReferenceRow> kept = insertExisting(rows);
    long stored =
        movedHolders.isEmpty()
            ? 0
            : dao.customPropertyReferenceDAO().countColumnLevel(movedHolders);
    verify(stored, kept.size(), holderType + " columns");
    strips.forEach(Runnable::run);
  }

  /** What one holder's columns hold: reference rows, its stripped JSON, its stripped side rows. */
  private record ColumnMove(
      List<ReferenceRow> rows, String strippedJson, Map<String, ObjectNode> strippedSideRows) {}

  /**
   * Null when the holder has no reference values. A property that cannot be converted (unknown
   * target type, unparseable) stays in its sources; every other one moves.
   */
  private ColumnMove planColumnMove(
      String holderType,
      Holder holder,
      Map<String, Map<String, SourceRow>> sideRows,
      Predicate<String> isReference) {
    ObjectNode root = (ObjectNode) JsonUtils.readTree(holder.json());
    Map<String, ObjectNode> sideValues = new HashMap<>();
    sideRows
        .getOrDefault(holder.id(), Map.of())
        .forEach(
            (key, source) -> {
              if (readValue(source.json()) instanceof ObjectNode value) {
                sideValues.put(key, value);
              }
            });
    Map<String, ObjectNode> referencesByKey = new LinkedHashMap<>();
    collectInline(root.get("columns"), isReference, referencesByKey);
    sideValues.forEach(
        (key, value) -> {
          ObjectNode references =
              CustomPropertyReferences.extractReferences(value.deepCopy(), isReference);
          if (!references.isEmpty()) {
            referencesByKey.computeIfAbsent(key, k -> JsonUtils.getObjectNode()).setAll(references);
          }
        });
    if (referencesByKey.isEmpty()) {
      return null;
    }
    Set<String> leftInPlaceKeys = new HashSet<>();
    List<ReferenceRow> rows = columnRows(holderType, holder.id(), referencesByKey, leftInPlaceKeys);
    BiPredicate<String, String> moves =
        (key, name) -> isReference.test(name) && !leftInPlaceKeys.contains(key + '\u0000' + name);
    boolean inlineChanged = stripInline(root.get("columns"), moves);
    Map<String, ObjectNode> strippedSideRows = new HashMap<>();
    sideValues.forEach(
        (key, value) -> {
          if (!CustomPropertyReferences.extractReferences(value, name -> moves.test(key, name))
              .isEmpty()) {
            strippedSideRows.put(key, value);
          }
        });
    return new ColumnMove(rows, inlineChanged ? root.toString() : null, strippedSideRows);
  }

  /** Copies every column's reference values by column key, nested columns included. */
  private static void collectInline(
      JsonNode columns, Predicate<String> isReference, Map<String, ObjectNode> byKey) {
    for (ObjectNode column : columnNodes(columns)) {
      if (column.get("extension") instanceof ObjectNode extension) {
        ObjectNode references =
            CustomPropertyReferences.extractReferences(extension.deepCopy(), isReference);
        if (!references.isEmpty()) {
          byKey
              .computeIfAbsent(columnKey(column), k -> JsonUtils.getObjectNode())
              .setAll(references);
        }
      }
    }
  }

  /** Removes the moved reference values from the inline copy; returns whether anything changed. */
  private static boolean stripInline(JsonNode columns, BiPredicate<String, String> moves) {
    boolean changed = false;
    for (ObjectNode column : columnNodes(columns)) {
      if (column.get("extension") instanceof ObjectNode extension) {
        String key = columnKey(column);
        changed |=
            !CustomPropertyReferences.extractReferences(extension, name -> moves.test(key, name))
                .isEmpty();
        if (extension.isEmpty()) {
          column.remove("extension");
        }
      }
    }
    return changed;
  }

  /** Every column with a FQN, nested children included. */
  private static List<ObjectNode> columnNodes(JsonNode columns) {
    List<ObjectNode> nodes = new ArrayList<>();
    if (columns instanceof ArrayNode columnArray) {
      for (JsonNode column : columnArray) {
        if (column instanceof ObjectNode node) {
          if (node.hasNonNull("fullyQualifiedName")) {
            nodes.add(node);
          }
          nodes.addAll(columnNodes(node.get("children")));
        }
      }
    }
    return nodes;
  }

  private static String columnKey(ObjectNode column) {
    return FullyQualifiedName.buildHash(column.get("fullyQualifiedName").asText());
  }

  /** Rows of every convertible property; the keys of the others go to {@code leftInPlaceKeys}. */
  private List<ReferenceRow> columnRows(
      String holderType,
      String holderId,
      Map<String, ObjectNode> referencesByKey,
      Set<String> leftInPlaceKeys) {
    List<ReferenceRow> rows = new ArrayList<>();
    for (Map.Entry<String, ObjectNode> entry : referencesByKey.entrySet()) {
      Iterator<Map.Entry<String, JsonNode>> properties = entry.getValue().fields();
      while (properties.hasNext()) {
        Map.Entry<String, JsonNode> property = properties.next();
        List<ReferenceRow> propertyRows =
            toRows(holderType, holderId, entry.getKey(), property.getKey(), property.getValue());
        if (propertyRows == null) {
          leftInPlaceKeys.add(entry.getKey() + '\u0000' + property.getKey());
        } else {
          rows.addAll(propertyRows);
        }
      }
    }
    return rows;
  }

  private void applyColumnMove(String table, Holder holder, ColumnMove move) {
    if (move.strippedJson() != null) {
      String sql =
          connectionType == ConnectionType.POSTGRES
              ? "UPDATE " + table + " SET json = (:json :: jsonb) WHERE id = :id"
              : "UPDATE " + table + " SET json = :json WHERE id = :id";
      handle.createUpdate(sql).bind("json", move.strippedJson()).bind("id", holder.id()).execute();
    }
    UUID holderId = UUID.fromString(holder.id());
    move.strippedSideRows()
        .forEach(
            (key, value) -> {
              if (value.isEmpty()) {
                dao.entityExtensionDAO().delete(holderId, key);
              } else {
                dao.entityExtensionDAO().insert(holderId, key, COLUMN_EXTENSION, value.toString());
              }
            });
  }

  private Map<String, Map<String, SourceRow>> sideRows(List<Holder> page) {
    Map<String, Map<String, SourceRow>> byHolder = new HashMap<>();
    handle
        .createQuery(
            "SELECT id, extension, json FROM entity_extension WHERE id IN (<ids>) "
                + "AND jsonSchema = '"
                + COLUMN_EXTENSION
                + "'")
        .bindList("ids", page.stream().map(Holder::id).toList())
        .map((rs, ctx) -> new SourceRow(rs.getString("id"), rs.getString(2), rs.getString(3)))
        .forEach(
            row ->
                byHolder
                    .computeIfAbsent(row.id(), ignored -> new HashMap<>())
                    .put(row.extension(), row));
    return byHolder;
  }

  // ---------------------------------------------------------------- shared

  private static JsonNode readValue(String json) {
    try {
      return JsonUtils.readTree(json);
    } catch (RuntimeException e) {
      return null;
    }
  }

  /**
   * One row per referenced entity, ids completed for name-only references. Null when the value
   * cannot be moved (it does not parse, or names a type this server does not know): the caller
   * then leaves the whole value where it is.
   */
  private List<ReferenceRow> toRows(
      String holderType, String holderId, String columnKey, String property, JsonNode value) {
    if (value == null) {
      leftInPlace++;
      return null;
    }
    EntityUtil.fillCustomPropertyReferenceIds(value);
    List<ReferenceRow> rows = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    List<JsonNode> elements = new ArrayList<>();
    if (value.isArray()) {
      value.forEach(elements::add);
    } else if (value.isObject()) {
      elements.add(value);
    }
    for (JsonNode ref : elements) {
      String type = ref.path("type").asText(null);
      String id = ref.path("id").asText(null);
      if (type == null || !Entity.hasEntityRepository(type)) {
        LOG.warn("Leaving custom property {} of {} in place: {}", property, holderId, ref);
        leftInPlace++;
        return null;
      }
      if (id == null) {
        // A name that resolves to nothing names an entity that no longer exists.
        dropped++;
        continue;
      }
      String canonical = CustomPropertyReferences.canonicalId(id);
      if (canonical == null) {
        dropped++;
        continue;
      }
      if (seen.add(canonical)) {
        String snapshot = ((ObjectNode) ref).deepCopy().put("id", canonical).toString();
        rows.add(
            new ReferenceRow(
                holderId, columnKey, property, canonical, holderType, type, rows.size(), snapshot));
      }
    }
    return rows;
  }

  /** Inserts the rows whose target still exists, and returns them. */
  private List<ReferenceRow> insertExisting(List<ReferenceRow> rows) {
    Map<String, List<ReferenceRow>> byType = new LinkedHashMap<>();
    rows.forEach(row -> byType.computeIfAbsent(row.targetType(), t -> new ArrayList<>()).add(row));
    List<ReferenceRow> kept = new ArrayList<>();
    byType.forEach(
        (type, typeRows) -> {
          if (!CustomPropertyReferences.hasEntityTable(type)) {
            // Time-series targets have no entity table to check; keep their references as stored.
            kept.addAll(typeRows);
            return;
          }
          EntityDAO<?> targetDao = Entity.getEntityRepository(type).getDao();
          List<String> ids = typeRows.stream().map(ReferenceRow::targetId).distinct().toList();
          Set<String> present =
              new HashSet<>(
                  EntityDAO.queryInChunks(
                      ids, chunk -> targetDao.findExistingIds(targetDao.getTableName(), chunk)));
          typeRows.stream().filter(row -> present.contains(row.targetId())).forEach(kept::add);
        });
    dao.customPropertyReferenceDAO().insertMany(kept);
    moved += kept.size();
    dropped += rows.size() - kept.size();
    return kept;
  }

  /** Fails the page, and so leaves its sources untouched, if the rows did not all land. */
  private static void verify(long stored, int expected, String what) {
    if (stored < expected) {
      throw new IllegalStateException(
          String.format(
              "Custom-property reference migration stored %d of %d rows for %s",
              stored, expected, what));
    }
  }
}
