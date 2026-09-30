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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecordWithId;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityExtensionReferences;
import org.openmetadata.service.util.EntityUtil;

/**
 * Builds {@code entity_extension_reference} from the entity-level custom-property values that
 * exist before the ledger did. Name-only references get their id filled in place, references whose
 * target is already gone are marked for the compaction sweep, and everything else is indexed live.
 * Idempotent and restart-from-zero: rows upsert, marks are re-applied. Reads property definitions
 * from {@code field_relationship} because {@code TypeRegistry} is not loaded in the migrate job.
 */
@Slf4j
public final class CustomPropertyReferenceBackfill {
  private static final int PAGE_SIZE = 1_000;

  private CustomPropertyReferenceBackfill() {}

  public static void backfillCustomPropertyReferences(CollectionDAO dao) {
    Set<String> deadTargets = new HashSet<>();
    int values = 0;
    for (String key : referencePropertyKeys(dao)) {
      values += backfillProperty(dao, key, deadTargets);
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

  private static int backfillProperty(CollectionDAO dao, String key, Set<String> deadTargets) {
    int values = 0;
    List<ExtensionRecordWithId> page =
        dao.entityExtensionDAO().listByExtensionAfterId(key, "", PAGE_SIZE);
    while (!page.isEmpty()) {
      for (ExtensionRecordWithId row : page) {
        indexValue(dao, row, deadTargets);
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
      CollectionDAO dao, ExtensionRecordWithId row, Set<String> deadTargets) {
    JsonNode value = JsonUtils.readTree(row.extensionJson());
    String before = value.toString();
    EntityUtil.fillCustomPropertyReferenceIds(value);
    if (!before.equals(value.toString())) {
      dao.entityExtensionDAO()
          .insert(row.id(), row.extensionName(), CUSTOM_FIELD_SCHEMA, value.toString());
    }
    Map<String, List<String>> byType = EntityExtensionReferences.referencedIdsByType(value);
    byType.forEach(
        (type, ids) -> {
          dao.entityExtensionReferenceDAO()
              .insertMany(
                  row.id(), row.extensionName(), ids, Collections.nCopies(ids.size(), type));
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
