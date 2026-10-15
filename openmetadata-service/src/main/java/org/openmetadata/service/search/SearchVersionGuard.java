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

package org.openmetadata.service.search;

import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;

/**
 * Makes an entity's search writes "last write wins" by when their content was read rather than by
 * when they arrive: a write whose content was read before the stored document's becomes a no-op.
 * A live write reads its content when it is prepared after commit; a rebuild reads its batch
 * before preparing it. Neither the entity version nor {@code updatedAt} can order writes, because
 * consolidating a change that undoes the previous one restores both to their earlier values.
 * Equal read times still apply, so a rebuild can repair a document whose inherited fields
 * drifted. A skipped write reports success, not a conflict. Read times come from server clocks.
 */
public final class SearchVersionGuard {
  public static final String VERSION = "version";
  public static final String UPDATED_AT = "updatedAt";
  public static final String SOURCE_READ_AT = "sourceReadAt";
  private static final String STALE_CHECK =
      """
      boolean omStale = params.sourceReadAt != null && ctx._source.sourceReadAt != null
          && ((Number) ctx._source.sourceReadAt).longValue()
              > ((Number) params.sourceReadAt).longValue();
      if (omStale) {
        ctx.op = 'noop';
      } else {
      """;
  // The wrapped script ends its own block, so its last statement may omit the semicolon.
  private static final String STAMP =
      """

      }
      if (!omStale) {
        ctx._source.version = params.version;
        ctx._source.updatedAt = params.updatedAt;
        ctx._source.sourceReadAt = params.sourceReadAt;
      }
      """;

  /**
   * When the entity state an asynchronous write carries was read. The write runs later on a lane,
   * but it must be ordered by when its content was read, or a backlogged lane would overwrite a
   * newer write another server made in the meantime.
   */
  private static final ThreadLocal<Long> BOUND_READ_AT = new ThreadLocal<>();

  private SearchVersionGuard() {}

  /** Runs {@code write} with its guarded writes stamped as read at {@code readAt}. */
  public static Runnable readAt(final long readAt, final Runnable write) {
    return () -> {
      final Long previous = BOUND_READ_AT.get();
      BOUND_READ_AT.set(readAt);
      try {
        write.run();
      } finally {
        restore(previous);
      }
    };
  }

  private static void restore(final Long previous) {
    if (previous == null) {
      BOUND_READ_AT.remove();
    } else {
      BOUND_READ_AT.set(previous);
    }
  }

  /** When the content being written was read: when its write was queued, or else now. */
  public static long readTime() {
    final Long boundReadAt = BOUND_READ_AT.get();
    return boundReadAt == null ? System.currentTimeMillis() : boundReadAt;
  }

  /**
   * {@code script} applied only when its {@code params.sourceReadAt} is not older than the stored
   * one, for documents without an entity version, such as time-series records; the script itself
   * writes {@code sourceReadAt}.
   */
  public static String guardReadTime(final String script) {
    return STALE_CHECK + script + "\n}\n";
  }

  /** Guards a live write, read when it was queued or, outside a queued write, as it is prepared. */
  public static SearchDocumentUpdate apply(
      final SearchDocumentUpdate update, final EntityInterface<?> entity) {
    return apply(update, entity, readTime());
  }

  /**
   * Guards {@code update} with the time its content was read, and stamps the entity's state. A
   * relationship replacement is left to its revision fence and changes nothing else.
   */
  public static SearchDocumentUpdate apply(
      final SearchDocumentUpdate update, final EntityInterface<?> entity, final long readAt) {
    if (SearchDocumentUpdates.isRelationshipReplacement(update)) {
      return update;
    }
    return new SearchDocumentUpdate(
        guard(update.script()),
        withEntityState(update.parameters(), entity, readAt),
        update.scriptedUpsert());
  }

  /** {@code script} applied only when {@code params.sourceReadAt} is not older than the stored one. */
  public static String guard(final String script) {
    return STALE_CHECK + script + STAMP;
  }

  static Map<String, Object> withEntityState(
      final Map<String, Object> parameters, final EntityInterface<?> entity, final long readAt) {
    final Map<String, Object> stamped = new LinkedHashMap<>(parameters);
    stamped.putIfAbsent(VERSION, entity.getVersion());
    stamped.putIfAbsent(UPDATED_AT, entity.getUpdatedAt());
    stamped.put(SOURCE_READ_AT, readAt);
    return stamped;
  }
}
