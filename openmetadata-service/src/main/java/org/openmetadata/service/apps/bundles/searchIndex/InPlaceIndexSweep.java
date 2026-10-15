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

package org.openmetadata.service.apps.bundles.searchIndex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.search.SearchVersionGuard;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

/**
 * Removes what an in-place reindex leaves behind: documents whose row is gone from the database. A
 * new index drops them by never copying them, but rewriting the live index only touches the rows it
 * reads. Rows deleted without a search delete (a restored or edited database, a failed delete) leave
 * such documents. Only documents the run did not rewrite are looked up.
 */
@Slf4j
final class InPlaceIndexSweep {
  private static final int PAGE_SIZE = 1000;

  /** The ids, of a page of document ids, that still have a row behind them. */
  @FunctionalInterface
  interface SourceRows {
    Collection<String> existing(List<String> ids);
  }

  private final RawIndexOperations indexOperations;
  private final Function<String, Optional<SourceRows>> sourceRowsByType;
  private final VectorIndexService vectorIndexService;

  InPlaceIndexSweep(
      final RawIndexOperations indexOperations,
      final Function<String, Optional<SourceRows>> sourceRowsByType,
      final VectorIndexService vectorIndexService) {
    this.indexOperations = indexOperations;
    this.sourceRowsByType = sourceRowsByType;
    this.vectorIndexService = vectorIndexService;
  }

  /**
   * Where each entity type's rows live. Report data has no id column to look documents up by, so
   * its index is not swept.
   */
  static Optional<SourceRows> databaseRows(final String entityType) {
    final Optional<SourceRows> rows;
    if (SearchIndexEntityTypes.isDataInsightEntity(entityType)) {
      rows = Optional.empty();
    } else if (SearchIndexEntityTypes.isTimeSeriesEntity(entityType)) {
      final EntityTimeSeriesDAO dao =
          Entity.getEntityTimeSeriesRepository(entityType).getTimeSeriesDao();
      rows = Optional.of(dao::findExistingIds);
    } else {
      final EntityDAO<?> dao = Entity.getEntityRepository(entityType).getDao();
      rows = Optional.of(ids -> dao.findExistingIds(dao.getTableName(), ids));
    }
    return rows;
  }

  /** Deletes {@code entityType}'s orphaned documents from {@code index}; returns how many. */
  long removeOrphans(final String entityType, final String index, final long runStart)
      throws IOException {
    final Optional<SourceRows> rows = sourceRowsByType.apply(entityType);
    final AtomicLong removed = new AtomicLong();
    if (rows.isPresent()) {
      // Documents the run rewrote become visible to the candidate query only after a refresh.
      indexOperations.refresh(index);
      indexOperations.forEachIdPage(
          index,
          untouchedSince(runStart),
          PAGE_SIZE,
          ids -> removed.addAndGet(removeMissing(entityType, index, ids, rows.get())));
    }
    return removed.get();
  }

  /**
   * Documents read before {@code runStart}, or never stamped with a read time. A live write is
   * applied only after its transaction commits, so a document always has a committed row behind it
   * when it is written. Entity indexes map {@code updatedAt} as epoch seconds while it holds
   * milliseconds, so a range on it cannot tell when a document changed.
   */
  static JsonNode untouchedSince(final long runStart) {
    final ObjectNode bool = JsonUtils.getObjectNode();
    final ArrayNode notRewritten = bool.putArray("should");
    notRewritten
        .addObject()
        .putObject("range")
        .putObject(SearchVersionGuard.SOURCE_READ_AT)
        .put("lt", runStart);
    notRewritten
        .addObject()
        .putObject("bool")
        .putObject("must_not")
        .putObject("exists")
        .put("field", SearchVersionGuard.SOURCE_READ_AT);
    bool.put("minimum_should_match", 1);
    return JsonUtils.getObjectNode("bool", bool);
  }

  private long removeMissing(
      final String entityType, final String index, final List<String> ids, final SourceRows rows)
      throws IOException {
    final Set<String> existing = new HashSet<>(rows.existing(ids));
    final List<String> missing = ids.stream().filter(id -> !existing.contains(id)).toList();
    long deleted = 0;
    if (!missing.isEmpty()) {
      deleted = indexOperations.deleteIds(index, missing);
      deleteChunks(entityType, missing);
      LOG.info(
          "Removed {} {} documents from {} whose rows no longer exist", deleted, entityType, index);
    }
    return deleted;
  }

  private void deleteChunks(final String entityType, final List<String> ids) {
    if (vectorIndexService != null && AvailableEntityTypes.isVectorIndexable(entityType)) {
      ids.forEach(vectorIndexService::deleteEntityChunks);
    }
  }
}
