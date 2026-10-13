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

package org.openmetadata.service.migration.utils;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.function.BiFunction;
import org.jdbi.v3.core.Handle;

/**
 * Walks a table's ids in primary-key order, {@link #BATCH_SIZE} at a time, so a data migration's
 * statements are bounded by the batch rather than the table
 * (ADR:2026-10-09-data-migration-backfills-walk-ids-in-batches). Keyset pagination: each batch is
 * an index seek, never OFFSET's row skipping.
 */
public final class IdBatches {

  /** Ids per batch. */
  public static final int BATCH_SIZE = 500;

  private static final String AFTER_ID_BIND = "afterId";
  private static final String LIMIT_BIND = "limit";

  private IdBatches() {}

  /**
   * Folds {@code step} over every batch of {@code table}'s ids, starting from {@code identity}.
   * {@code step} never sees an empty batch. The table name is interpolated because SQL forbids
   * binding an identifier, so callers pass constants only.
   */
  public static <T> T fold(
      final Handle handle,
      final String table,
      final T identity,
      final BiFunction<T, List<String>, T> step) {
    T result = identity;
    String afterId = "";
    boolean hasMore = true;
    while (hasMore) {
      final List<String> batch = nextBatch(handle, table, afterId);
      result = nullOrEmpty(batch) ? result : step.apply(result, batch);
      hasMore = batch.size() == BATCH_SIZE;
      if (hasMore) {
        afterId = batch.getLast();
      }
    }
    return result;
  }

  private static List<String> nextBatch(
      final Handle handle, final String table, final String afterId) {
    return handle
        .createQuery("SELECT id FROM " + table + " WHERE id > :afterId ORDER BY id LIMIT :limit")
        .bind(AFTER_ID_BIND, afterId)
        .bind(LIMIT_BIND, BATCH_SIZE)
        .mapTo(String.class)
        .list();
  }
}
