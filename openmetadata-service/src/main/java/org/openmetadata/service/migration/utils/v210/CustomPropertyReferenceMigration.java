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
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
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
  private static final int ENTITY_PAGE_SIZE = 500;
  private static final int HOLDER_PAGE_SIZE = 50;
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
    String key = TypeRegistryKeys.customPropertyFqn(holderType, property);
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
    verify(moveable.stream().map(SourceRow::id).toList(), true, kept.size());
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
      if (move != null && move.rows() != null) {
        rows.addAll(move.rows());
        strips.add(() -> applyColumnMove(table, holder, move));
        movedHolders.add(holder.id());
      }
    }
    List<ReferenceRow> kept = insertExisting(rows);
    verify(movedHolders, false, kept.size());
    strips.forEach(Runnable::run);
  }

  /** What one holder's columns hold: reference rows, its stripped JSON, its stripped side rows. */
  private record ColumnMove(
      List<ReferenceRow> rows, String strippedJson, Map<String, ObjectNode> strippedSideRows) {}

  /** Null when the holder has no reference values; rows are null when they cannot be moved. */
  private ColumnMove planColumnMove(
      String holderType,
      Holder holder,
      Map<String, Map<String, SourceRow>> sideRows,
      Predicate<String> isReference) {
    ObjectNode root = (ObjectNode) JsonUtils.readTree(holder.json());
    Map<String, ObjectNode> referencesByKey = new LinkedHashMap<>();
    boolean inlineChanged = collectInline(root.get("columns"), isReference, referencesByKey);
    Map<String, ObjectNode> strippedSideRows = new HashMap<>();
    sideRows
        .getOrDefault(holder.id(), Map.of())
        .forEach(
            (key, source) -> {
              if (!(readValue(source.json()) instanceof ObjectNode value)) {
                return;
              }
              ObjectNode references =
                  CustomPropertyReferences.extractReferences(value, isReference);
              if (!references.isEmpty()) {
                referencesByKey
                    .computeIfAbsent(key, k -> JsonUtils.getObjectNode())
                    .setAll(references);
                strippedSideRows.put(key, value);
              }
            });
    if (referencesByKey.isEmpty()) {
      return null;
    }
    List<ReferenceRow> rows = columnRows(holderType, holder.id(), referencesByKey);
    return new ColumnMove(rows, inlineChanged ? root.toString() : null, strippedSideRows);
  }

  private static boolean collectInline(
      JsonNode columns, Predicate<String> isReference, Map<String, ObjectNode> byKey) {
    boolean changed = false;
    if (columns instanceof ArrayNode columnArray) {
      for (JsonNode column : columnArray) {
        if (column instanceof ObjectNode node) {
          changed |= collectInlineColumn(node, isReference, byKey);
          changed |= collectInline(node.get("children"), isReference, byKey);
        }
      }
    }
    return changed;
  }

  private static boolean collectInlineColumn(
      ObjectNode column, Predicate<String> isReference, Map<String, ObjectNode> byKey) {
    if (!(column.get("extension") instanceof ObjectNode extension)
        || !column.hasNonNull("fullyQualifiedName")) {
      return false;
    }
    ObjectNode references = CustomPropertyReferences.extractReferences(extension, isReference);
    if (references.isEmpty()) {
      return false;
    }
    if (extension.isEmpty()) {
      column.remove("extension");
    }
    String key = FullyQualifiedName.buildHash(column.get("fullyQualifiedName").asText());
    byKey.computeIfAbsent(key, k -> JsonUtils.getObjectNode()).setAll(references);
    return true;
  }

  private List<ReferenceRow> columnRows(
      String holderType, String holderId, Map<String, ObjectNode> referencesByKey) {
    List<ReferenceRow> rows = new ArrayList<>();
    for (Map.Entry<String, ObjectNode> entry : referencesByKey.entrySet()) {
      Iterator<Map.Entry<String, JsonNode>> properties = entry.getValue().fields();
      while (properties.hasNext()) {
        Map.Entry<String, JsonNode> property = properties.next();
        List<ReferenceRow> propertyRows =
            toRows(holderType, holderId, entry.getKey(), property.getKey(), property.getValue());
        if (propertyRows == null) {
          return null;
        }
        rows.addAll(propertyRows);
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
      if (type == null || id == null || !Entity.hasEntityRepository(type)) {
        LOG.warn("Leaving custom property {} of {} in place: {}", property, holderId, ref);
        leftInPlace++;
        return null;
      }
      if (seen.add(id)) {
        rows.add(
            new ReferenceRow(
                holderId, columnKey, property, id, holderType, type, rows.size(), ref.toString()));
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
  private void verify(List<String> holderIds, boolean entityLevel, int expected) {
    if (holderIds.isEmpty() || expected == 0) {
      return;
    }
    List<ReferenceRow> stored =
        entityLevel
            ? dao.customPropertyReferenceDAO().findEntityLevel(holderIds)
            : dao.customPropertyReferenceDAO().findColumnLevel(holderIds);
    if (stored.size() < expected) {
      throw new IllegalStateException(
          String.format(
              "Custom-property reference migration stored %d of %d rows for %s",
              stored.size(), expected, holderIds));
    }
  }

  /** Property keys as entity_extension stores them; mirrors TypeRegistry without loading it. */
  private static final class TypeRegistryKeys {
    static String customPropertyFqn(String entityType, String propertyName) {
      return FullyQualifiedName.build(entityType, "customProperties", propertyName);
    }
  }
}
