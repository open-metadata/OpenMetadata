/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.cache;

/**
 * Thread-scoped opt-out for the Redis-backed entity caches.
 *
 * <p>Reindex is a streaming bulk read: each entity is fetched exactly once and is never re-read
 * from the same job, so the entity-cache hit rate during reindex is approximately zero. The cost
 * of going through the cache anyway is real:
 *
 * <ul>
 *   <li>Every relationship lookup ({@code Entity.getEntityReferenceById}) calls into the
 *       cache layer first and only falls through to DB on a miss.
 *   <li>On a healthy cache that's a couple of milliseconds wasted per lookup, but with millions
 *       of relationship resolutions during a 580k-entity reindex the writes alone add up to 2–3M
 *       Redis ops we don't need.
 *   <li>On an unhealthy cache (the {@code RedisCacheProvider} flap pattern we hit in
 *       PR #27876), every miss pays a 300ms timeout before falling through, and the indexer
 *       crawls at 0.6 r/s while the database is essentially idle.
 * </ul>
 *
 * <p>Setting this thread-local flag while a reindex worker is running causes the cached DAOs
 * ({@code CachedEntityDao}, {@code CachedRelationshipDao}, {@code CachedTagUsageDao},
 * {@code CachedReadBundle}) to skip their cache reads and write-throughs entirely and fetch
 * straight from the database. The flag is per-thread, so it doesn't affect any other code path
 * — UI requests, ingestion, scheduled apps, etc. continue to use the cache normally.
 *
 * <p>Usage:
 *
 * <pre>{@code
 * try (var ignored = EntityCacheBypass.skip()) {
 *   // any EntityRepository.find()/getReference() calls on this thread bypass the cache
 *   readEntitiesAndIndex();
 * }
 * }</pre>
 *
 * <p>The returned handle restores the previous bypass state on close, so nesting is safe (an
 * inner block leaves the outer block's bypass state intact when it exits).
 */
public final class EntityCacheBypass {

  private static final ThreadLocal<Boolean> SKIP = ThreadLocal.withInitial(() -> Boolean.FALSE);

  private EntityCacheBypass() {
    // utility class
  }

  /** True if the current thread has opted out of cache reads/write-throughs. */
  public static boolean isSkipped() {
    return Boolean.TRUE.equals(SKIP.get());
  }

  /**
   * Mark the current thread as skipping the cache. Returns an {@link AutoCloseable} that
   * restores the previous skip state — typically used with try-with-resources.
   */
  public static Handle skip() {
    boolean previous = SKIP.get();
    SKIP.set(Boolean.TRUE);
    return () -> SKIP.set(previous);
  }

  /** Closeable handle that restores the prior skip state on {@link #close()}. */
  @FunctionalInterface
  public interface Handle extends AutoCloseable {
    @Override
    void close();
  }

  /**
   * Test-only escape hatch: clear the thread-local on the calling thread regardless of any
   * outstanding {@link Handle} references. Production code must use {@link #skip()} with
   * try-with-resources; using this from the request path would defeat the
   * stack-discipline guarantee that nested skip blocks restore correctly.
   */
  static void resetForTesting() {
    SKIP.remove();
  }
}
