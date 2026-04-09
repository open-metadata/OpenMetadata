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

package org.openmetadata.service.migration.utils.v1141;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

@Slf4j
public final class MigrationUtil {

  private static final int BATCH_SIZE = 1000;

  private MigrationUtil() {}

  // Top-level entities (services, users, teams, etc.) use "nameHash".
  // For them FQN == name, so nameHash == buildHash(fqn) — the same value we need.
  // Hierarchical entities (databases, schemas, tables) use "fqnHash".
  // Both must be backfilled into entity_relationship so prefix deletion works for all levels.
  private static final String FQNHASH_COL = "fqnHash";
  private static final String NAMEHASH_COL = "nameHash";

  /**
   * Backfills fromFQNHash and toFQNHash in entity_relationship for all existing rows where those
   * columns are NULL. Covers every registered entity type — both hierarchical entities (fqnHash
   * column) and top-level entities (nameHash column, e.g. services, users, teams).
   */
  public static void backfillRelationshipFqnHashes(Handle handle) {
    for (String entityType : Entity.getEntityList()) {
      try {
        backfillForEntityType(handle, entityType);
      } catch (Exception e) {
        LOG.warn(
            "Failed to backfill FQN hashes for entity type {}: {}", entityType, e.getMessage());
      }
    }
  }

  private static void backfillForEntityType(Handle handle, String entityType) {
    EntityRepository<?> repo = Entity.getEntityRepository(entityType);
    String hashCol = repo.getDao().getNameHashColumn();
    if (!FQNHASH_COL.equals(hashCol) && !NAMEHASH_COL.equals(hashCol)) {
      return;
    }
    String tableName = repo.getDao().getTableName();
    int offset = 0;
    int processed;
    do {
      processed = processEntityBatch(handle, tableName, hashCol, offset);
      offset += processed;
    } while (processed == BATCH_SIZE);
    LOG.info("Backfilled FQN hashes for entity type {}: {} rows", entityType, offset);
  }

  private static int processEntityBatch(
      Handle handle, String tableName, String hashCol, int offset) {
    String sql =
        "SELECT id, "
            + hashCol
            + " FROM "
            + tableName
            + " WHERE "
            + hashCol
            + " IS NOT NULL LIMIT :limit OFFSET :offset";
    List<Map<String, Object>> rows =
        handle.createQuery(sql).bind("limit", BATCH_SIZE).bind("offset", offset).mapToMap().list();
    for (Map<String, Object> row : rows) {
      backfillRow(handle, row, hashCol);
    }
    return rows.size();
  }

  private static void backfillRow(Handle handle, Map<String, Object> row, String hashCol) {
    Map<String, Object> normalized = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    normalized.putAll(row);
    String id = String.valueOf(normalized.get("id"));
    String fqnHash = String.valueOf(normalized.get(hashCol));
    handle
        .createUpdate(
            "UPDATE entity_relationship SET fromFQNHash = :fqnHash WHERE fromId = :id AND fromFQNHash IS NULL")
        .bind("fqnHash", fqnHash)
        .bind("id", id)
        .execute();
    handle
        .createUpdate(
            "UPDATE entity_relationship SET toFQNHash = :fqnHash WHERE toId = :id AND toFQNHash IS NULL")
        .bind("fqnHash", fqnHash)
        .bind("id", id)
        .execute();
  }
}
