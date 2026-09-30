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

import static org.openmetadata.service.jdbi3.EntityExtensionReferences.CUSTOM_FIELD_SCHEMA;
import static org.openmetadata.service.jdbi3.EntityExtensionReferences.ENTITY_REFERENCE;
import static org.openmetadata.service.jdbi3.EntityExtensionReferences.ENTITY_REFERENCE_LIST;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ColumnExtensionReferences;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecordWithId;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceKey;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityExtensionReferences;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Builds {@code entity_extension_reference} from the custom-property values, entity-level and
 * column-level, that exist before the ledger did. Name-only references get their id filled in place, references whose
 * target is already gone are marked for the compaction sweep, and everything else is indexed live.
 * Idempotent and restart-from-zero: rows upsert, marks are re-applied. Reads property definitions
 * from {@code field_relationship} because {@code TypeRegistry} is not loaded in the migrate job.
 */
@Slf4j
public final class CustomPropertyReferenceBackfill {
  private static final int PAGE_SIZE = 1_000;
  private static final int COLUMN_PAGE_SIZE = 500;
  private static final String COLUMN_EXTENSION_SCHEMA =
      TableRepository.COLUMN_EXTENSION_JSON_SCHEMA;

  private CustomPropertyReferenceBackfill() {}

  public static void backfillCustomPropertyReferences(CollectionDAO dao) {
    Set<String> deadTargets = new HashSet<>();
    List<String> keys = referencePropertyKeys(dao);
    int values = 0;
    for (String key : keys) {
      if (columnHolderType(key) == null) {
        values += backfillProperty(dao, key, deadTargets);
      }
    }
    Map<String, Set<String>> columnProperties = columnPropertiesByHolderType(keys);
    if (!columnProperties.isEmpty()) {
      values += backfillColumnValues(dao, columnProperties, deadTargets);
    }
    int marked = dao.entityExtensionReferenceDAO().markPending(new ArrayList<>(deadTargets));
    LOG.info(
        "Custom-property reference backfill indexed {} values and marked {} references whose "
            + "target no longer exists",
        values,
        marked);
  }

  static List<String> referencePropertyKeys(CollectionDAO dao) {
    List<String> keys = new ArrayList<>();
    for (String propertyType : List.of(ENTITY_REFERENCE, ENTITY_REFERENCE_LIST)) {
      dao.fieldRelationshipDAO()
          .findFrom(propertyType, Entity.TYPE, Relationship.HAS.ordinal())
          .forEach(row -> keys.add(row.getLeft()));
    }
    return keys;
  }

  /** The holder type for a column-level property key, or null for an entity-level one. */
  private static String columnHolderType(String key) {
    return ColumnExtensionReferences.holderTypeOfColumnType(FullyQualifiedName.split(key)[0]);
  }

  private static Map<String, Set<String>> columnPropertiesByHolderType(List<String> keys) {
    Map<String, Set<String>> byHolderType = new HashMap<>();
    for (String key : keys) {
      String holderType = columnHolderType(key);
      if (holderType != null) {
        byHolderType
            .computeIfAbsent(holderType, ignored -> new HashSet<>())
            .add(FullyQualifiedName.unquoteName(FullyQualifiedName.split(key)[2]));
      }
    }
    return byHolderType;
  }

  private static int backfillProperty(CollectionDAO dao, String key, Set<String> deadTargets) {
    String holderType = FullyQualifiedName.split(key)[0];
    int values = 0;
    List<ExtensionRecordWithId> page =
        dao.entityExtensionDAO().listByExtensionAfterId(key, "", PAGE_SIZE);
    while (!page.isEmpty()) {
      for (ExtensionRecordWithId row : page) {
        indexValue(dao, row, holderType, deadTargets);
        values++;
      }
      String afterId = page.getLast().id().toString();
      page =
          page.size() < PAGE_SIZE
              ? List.of()
              : dao.entityExtensionDAO().listByExtensionAfterId(key, afterId, PAGE_SIZE);
    }
    return values;
  }

  private static void indexValue(
      CollectionDAO dao, ExtensionRecordWithId row, String holderType, Set<String> deadTargets) {
    JsonNode value = JsonUtils.readTree(row.extensionJson());
    String before = value.toString();
    EntityUtil.fillCustomPropertyReferenceIds(value);
    if (!before.equals(value.toString())) {
      dao.entityExtensionDAO()
          .insert(row.id(), row.extensionName(), CUSTOM_FIELD_SCHEMA, value.toString());
    }
    insertRows(
        dao,
        new ValueKey(row.id(), row.extensionName(), holderType),
        EntityExtensionReferences.referencedIdsByType(value),
        deadTargets);
  }

  /**
   * Column values have no index by property, so this walks every column-extension row once, keys
   * only, reading one value at a time. It only runs when a column-level reference property exists.
   */
  private static int backfillColumnValues(
      CollectionDAO dao, Map<String, Set<String>> propertiesByHolderType, Set<String> deadTargets) {
    int values = 0;
    List<ReferenceKey> page =
        dao.entityExtensionDAO().listColumnExtensionKeysAfter("", "", COLUMN_PAGE_SIZE);
    while (!page.isEmpty()) {
      Map<UUID, String> holderTypes = holderTypesOf(page, propertiesByHolderType.keySet());
      Set<UUID> filledHolders = new HashSet<>();
      for (ReferenceKey key : page) {
        String holderType = holderTypes.get(key.id());
        ColumnValue indexed =
            holderType == null
                ? ColumnValue.ABSENT
                : indexColumnValue(
                    dao, key, holderType, propertiesByHolderType.get(holderType), deadTargets);
        values += indexed == ColumnValue.ABSENT ? 0 : 1;
        if (indexed == ColumnValue.FILLED) {
          filledHolders.add(key.id());
        }
      }
      filledHolders.forEach(
          id -> {
            String holderType = holderTypes.get(id);
            fillInlineIds(id, holderType, propertiesByHolderType.get(holderType));
          });
      ReferenceKey last = page.getLast();
      page =
          page.size() < COLUMN_PAGE_SIZE
              ? List.of()
              : dao.entityExtensionDAO()
                  .listColumnExtensionKeysAfter(
                      last.id().toString(), last.extension(), COLUMN_PAGE_SIZE);
    }
    return values;
  }

  /** A column value does not record what kind of entity holds it; the holder tables do. */
  private static Map<UUID, String> holderTypesOf(List<ReferenceKey> page, Set<String> holderTypes) {
    List<String> ids = page.stream().map(key -> key.id().toString()).distinct().toList();
    Map<UUID, String> types = new HashMap<>();
    for (String holderType : holderTypes) {
      EntityDAO<?> holderDao = Entity.getEntityRepository(holderType).getDao();
      EntityDAO.queryInChunks(
              ids, chunk -> holderDao.findExistingIds(holderDao.getTableName(), chunk))
          .forEach(id -> types.put(UUID.fromString(id), holderType));
    }
    return types;
  }

  private enum ColumnValue {
    ABSENT,
    INDEXED,
    FILLED
  }

  private static ColumnValue indexColumnValue(
      CollectionDAO dao,
      ReferenceKey key,
      String holderType,
      Set<String> referenceProperties,
      Set<String> deadTargets) {
    String json = dao.entityExtensionDAO().getExtension(key.id(), key.extension());
    if (json == null) {
      return ColumnValue.ABSENT;
    }
    JsonNode value = JsonUtils.readTree(json);
    String before = value.toString();
    ColumnExtensionReferences.fillIds(value, referenceProperties::contains);
    boolean filled = !before.equals(value.toString());
    if (filled) {
      dao.entityExtensionDAO()
          .insert(key.id(), key.extension(), COLUMN_EXTENSION_SCHEMA, value.toString());
    }
    insertRows(
        dao,
        new ValueKey(key.id(), key.extension(), holderType),
        ColumnExtensionReferences.referencedIdsByType(value, referenceProperties::contains),
        deadTargets);
    return filled ? ColumnValue.FILLED : ColumnValue.INDEXED;
  }

  /**
   * The sweep matches dead references in the holder's inline column copy by id, so ids completed
   * in a side row are completed in the inline copy too; otherwise that copy would keep them.
   */
  private static void fillInlineIds(UUID holderId, String holderType, Set<String> properties) {
    EntityDAO<?> holderDao = Entity.getEntityRepository(holderType).getDao();
    String json = holderDao.findById(holderDao.getTableName(), holderId, "");
    JsonNode root = json == null ? null : JsonUtils.readTree(json);
    if (root != null
        && root.hasNonNull("fullyQualifiedName")
        && ColumnExtensionReferences.fillInlineIds(root.get("columns"), properties::contains)) {
      holderDao.update(holderId, root.get("fullyQualifiedName").asText(), root.toString());
    }
  }

  private record ValueKey(UUID holderId, String extension, String holderType) {}

  private static void insertRows(
      CollectionDAO dao,
      ValueKey valueKey,
      Map<String, List<String>> byType,
      Set<String> deadTargets) {
    byType.forEach(
        (type, ids) -> {
          dao.entityExtensionReferenceDAO()
              .insertManyKeepingMarks(
                  valueKey.holderId(),
                  valueKey.extension(),
                  valueKey.holderType(),
                  ids,
                  Collections.nCopies(ids.size(), type));
          deadTargets.addAll(missingTargets(type, ids));
        });
  }

  /**
   * Only a known table with no row is dead. A type this server does not know may be registered
   * elsewhere in the distribution; marking its references would make the sweep delete them.
   */
  private static List<String> missingTargets(String type, List<String> ids) {
    if (!Entity.hasEntityRepository(type)) {
      LOG.warn(
          "Skipping {} custom-property references of unknown entity type '{}'", ids.size(), type);
      return List.of();
    }
    EntityDAO<?> entityDao = Entity.getEntityRepository(type).getDao();
    Set<String> existing =
        new HashSet<>(
            EntityDAO.queryInChunks(
                ids, chunk -> entityDao.findExistingIds(entityDao.getTableName(), chunk)));
    return ids.stream().filter(id -> !existing.contains(id)).toList();
  }
}
