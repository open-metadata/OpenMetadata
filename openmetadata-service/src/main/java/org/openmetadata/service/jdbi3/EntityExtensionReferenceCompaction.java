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

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.jdbi3.EntityExtensionReferences.CUSTOM_FIELD_SCHEMA;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.google.common.collect.Lists;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.PendingKey;

/**
 * Rewrites custom-property values whose referenced entity was hard-deleted, then drops the marks.
 * Entity-level values are compacted one per transaction; column-level values are grouped by holder
 * so the holder's inline copy is rewritten once per group rather than once per column.
 */
@Slf4j
public final class EntityExtensionReferenceCompaction {
  private static final int COLUMN_KEYS_PER_TRANSACTION = 50;

  private final CollectionDAO daoCollection;
  private final ColumnExtensionReferences columns;

  public EntityExtensionReferenceCompaction(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
    this.columns = new ColumnExtensionReferences(daoCollection);
  }

  /** What one compaction pass over up to {@code limit} pending rows did. */
  public record CompactionPage(int fetched, int processed, int rewritten) {}

  enum Outcome {
    SKIPPED,
    CLEANED,
    REWRITTEN
  }

  private record Tally(int processed, int rewritten) {
    Tally add(Outcome outcome) {
      return new Tally(
          processed + (outcome == Outcome.SKIPPED ? 0 : 1),
          rewritten + (outcome == Outcome.REWRITTEN ? 1 : 0));
    }
  }

  private record Holder(UUID id, String type) {}

  /** Compacts the holders behind up to {@code limit} pending rows. */
  public CompactionPage compactPending(int limit) {
    List<PendingKey> rows = daoCollection.entityExtensionReferenceDAO().listPendingKeys(limit);
    Tally tally = compactKeys(rows);
    return new CompactionPage(rows.size(), tally.processed(), tally.rewritten());
  }

  /** Compacts every pending value of one holder; used by tests and the ops command. */
  public int compactPendingFor(UUID holderId) {
    return compactKeys(daoCollection.entityExtensionReferenceDAO().listPendingKeysFor(holderId))
        .rewritten();
  }

  private Tally compactKeys(List<PendingKey> rows) {
    Tally tally = new Tally(0, 0);
    Map<Holder, List<String>> columnKeys = new LinkedHashMap<>();
    for (PendingKey key : new LinkedHashSet<>(rows)) {
      if (EntityExtensionReferences.isEntityLevelKey(key.extension())) {
        tally = tally.add(compactValue(key));
      } else {
        columnKeys
            .computeIfAbsent(new Holder(key.id(), key.fromEntity()), ignored -> new ArrayList<>())
            .add(key.extension());
      }
    }
    for (Map.Entry<Holder, List<String>> entry : columnKeys.entrySet()) {
      for (List<String> chunk : Lists.partition(entry.getValue(), COLUMN_KEYS_PER_TRANSACTION)) {
        tally = tally.add(compactColumns(entry.getKey(), chunk));
      }
    }
    return tally;
  }

  private Outcome compactColumns(Holder holder, List<String> columnKeys) {
    if (!Entity.hasEntityRepository(holder.type())) {
      return Outcome.SKIPPED;
    }
    Outcome outcome =
        DeadlockRetry.execute(
            () ->
                daoCollection.inTransaction(
                    dao ->
                        columns.compactInTransaction(dao, holder.id(), holder.type(), columnKeys)));
    if (outcome == Outcome.REWRITTEN) {
      refreshHolder(holder.id(), holder.type());
    }
    return outcome;
  }

  /**
   * One short transaction per entity-level value: the value row, then its ledger rows, both SKIP
   * LOCKED, so the sweep never waits on a writer. A row another transaction holds is left for a
   * later run.
   */
  private Outcome compactValue(PendingKey key) {
    Outcome outcome =
        DeadlockRetry.execute(
            () -> daoCollection.inTransaction(dao -> compactValueInTransaction(dao, key)));
    if (outcome == Outcome.REWRITTEN) {
      refreshHolder(key.id(), key.fromEntity());
    }
    return outcome;
  }

  private static Outcome compactValueInTransaction(CollectionDAO dao, PendingKey key) {
    String json =
        dao.entityExtensionDAO().getExtensionForUpdateSkipLocked(key.id(), key.extension());
    if (json == null) {
      return dropOrphanRows(dao, key);
    }
    List<String> dead =
        dao.entityExtensionReferenceDAO().findPendingForUpdate(key.id(), key.extension());
    if (dead.isEmpty()) {
      return Outcome.SKIPPED;
    }
    boolean changed = rewriteValue(dao, key, JsonUtils.readTree(json), new HashSet<>(dead));
    dao.entityExtensionReferenceDAO().deleteMany(key.id(), key.extension(), dead);
    return changed ? Outcome.REWRITTEN : Outcome.CLEANED;
  }

  /** Null from the locking read means locked elsewhere, or gone; only the latter leaves orphans. */
  private static Outcome dropOrphanRows(CollectionDAO dao, PendingKey key) {
    if (dao.entityExtensionDAO().getExtension(key.id(), key.extension()) != null) {
      return Outcome.SKIPPED;
    }
    dao.entityExtensionReferenceDAO().delete(key.id(), key.extension());
    return Outcome.CLEANED;
  }

  /** An edit may already have rewritten the value; a no-op rewrite is skipped, not replayed. */
  private static boolean rewriteValue(
      CollectionDAO dao, PendingKey key, JsonNode value, Set<String> dead) {
    boolean changed;
    if (value.isArray()) {
      changed = EntityExtensionReferences.removeDeadElements((ArrayNode) value, dead);
      if (changed && value.isEmpty()) {
        dao.entityExtensionDAO().delete(key.id(), key.extension());
      } else if (changed) {
        dao.entityExtensionDAO()
            .insert(key.id(), key.extension(), CUSTOM_FIELD_SCHEMA, value.toString());
      }
    } else {
      changed = dead.contains(EntityExtensionReferences.idOf(value));
      if (changed) {
        dao.entityExtensionDAO().delete(key.id(), key.extension());
      }
    }
    return changed;
  }

  static void refreshHolder(UUID holderId, String holderType) {
    if (!Entity.hasEntityRepository(holderType)) {
      return;
    }
    try {
      EntityReference holder = Entity.getEntityReferenceById(holderType, holderId, ALL);
      EntityRepository.invalidateCacheForEntity(
          holderType, holderId, holder.getFullyQualifiedName());
      Entity.getSearchRepository().updateEntity(holder);
    } catch (EntityNotFoundException e) {
      LOG.debug(
          "Holder {} {} was deleted before its value could be reindexed", holderType, holderId);
    }
  }
}
