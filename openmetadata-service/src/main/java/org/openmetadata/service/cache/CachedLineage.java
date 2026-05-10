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
package org.openmetadata.service.cache;

import com.google.common.util.concurrent.Striped;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;

/**
 * Cache for {@code GET /api/v1/lineage/...} responses. Hybrid TTL + direct-invalidation: a short
 * TTL ({@link CacheConfig#lineageTtlSeconds}, default 60s) acts as a backstop, while explicit
 * invalidation handles the cases where staleness is most user-visible (the user just edited an
 * entity or changed a lineage edge involving the affected root).
 *
 * <p>Why not a reverse index of every entity → root that contains it? Hub entities (popular
 * tables referenced in thousands of lineage graphs) would invalidate all of them on every PATCH,
 * causing a write storm. The TTL+direct strategy gives 90% of the value at 10% of the
 * implementation cost; if production telemetry shows real staleness complaints we can upgrade
 * later — design notes in {@code .context/cache-improvements-design.md}.
 *
 * <p>Cache-off semantics: when {@link CacheConfig#provider} is {@code none} or
 * {@code lineageTtlSeconds <= 0}, {@link #enabled()} returns false. {@link #loadOrCompute} skips
 * the cache check entirely and just runs the supplier — same behavior as if this layer didn't
 * exist. No hard dependency on Redis.
 */
@Slf4j
public final class CachedLineage implements Invalidatable {
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final int ttlSeconds;
  private final Striped<Lock> loadLocks;

  public CachedLineage(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keys = keys;
    this.ttlSeconds = config.lineageTtlSeconds;
    // Same striping pattern as CachedReadBundle — shares the bundle stripe count for consistency.
    this.loadLocks = Striped.lazyWeakLock(Math.max(16, config.bundleLoadLockStripes));
  }

  public boolean enabled() {
    return ttlSeconds > 0 && cache != null && cache.available();
  }

  /**
   * Single-flight load: cache lookup, then under a per-root stripe lock the supplier runs once
   * and the result is cached. Concurrent waiters double-check the cache after acquiring the lock
   * — the first waiter to win the race seeds the cache, the rest read it back without re-running
   * the supplier.
   *
   * <p>If the cache is disabled, this degrades to {@code supplier.get()} with no locking. That
   * matches what would happen if there were no cache layer at all — important for the
   * "cache is optional" guarantee.
   */
  public String loadOrCompute(
      UUID rootId,
      int upstreamDepth,
      int downstreamDepth,
      boolean includeDeleted,
      Supplier<String> supplier) {
    if (!enabled()) {
      return supplier.get();
    }
    String key = keys.lineageGraph(rootId, upstreamDepth, downstreamDepth, includeDeleted);
    Optional<String> first = safeGet(key);
    if (first.isPresent()) {
      recordHit();
      return first.get();
    }
    // Lock on the FULL cache key, not the rootId. Different (depth, includeDeleted)
    // combinations for the same root produce distinct cache slots and shouldn't serialize on
    // each other — locking on rootId would cause concurrent `?upstreamDepth=1` and
    // `?upstreamDepth=3` for the same entity to block each other for no good reason. Striped
    // hashes the key into one of N locks; two genuinely-identical requests still single-flight,
    // distinct requests run in parallel (modulo hash collisions, which are acceptable).
    Lock lock = loadLocks.get(key);
    lock.lock();
    try {
      Optional<String> recheck = safeGet(key);
      if (recheck.isPresent()) {
        recordHit();
        return recheck.get();
      }
      recordMiss();
      String fresh = supplier.get();
      safePut(key, fresh);
      return fresh;
    } finally {
      lock.unlock();
    }
  }

  /**
   * Invalidate every cached lineage variant rooted at {@code rootId} (all depths, both
   * include-deleted flags). Called from entity mutation paths and from the
   * {@code addLineage}/{@code deleteLineage} hooks for both endpoints of the affected edge.
   *
   * <p>No-op when the cache is disabled.
   */
  public void invalidate(UUID rootId) {
    if (!enabled() || rootId == null) {
      return;
    }
    try {
      long deleted = cache.scanDelete(keys.lineageGraphPattern(rootId));
      if (deleted > 0) {
        LOG.debug("Lineage cache invalidated rootId={} keys={}", rootId, deleted);
      }
    } catch (Exception e) {
      LOG.debug("Lineage invalidate failed for rootId={}", rootId, e);
    }
  }

  /** Convenience for the lineage edge mutation hooks — invalidates both endpoints. */
  public void invalidateEdge(UUID fromId, UUID toId) {
    invalidate(fromId);
    invalidate(toId);
  }

  /**
   * {@link Invalidatable} adapter. Lineage is keyed only by entity id (type doesn't enter the key
   * because lineage relationships are between entities of any type) — so we drop everything for
   * the given id and ignore type/fqn.
   */
  @Override
  public void invalidate(String type, UUID id, String fqn) {
    invalidate(id);
  }

  private Optional<String> safeGet(String key) {
    try {
      return cache.get(key);
    } catch (Exception e) {
      LOG.debug("Lineage cache get failed (treated as miss) key={}", key, e);
      return Optional.empty();
    }
  }

  private void safePut(String key, String value) {
    if (value == null) return;
    try {
      cache.set(key, value, Duration.ofSeconds(ttlSeconds));
      recordWrite();
    } catch (Exception e) {
      LOG.debug("Lineage cache put failed key={}", key, e);
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) m.recordError();
    }
  }

  private static void recordHit() {
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) m.recordLayerHit("lineage");
  }

  private static void recordMiss() {
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) m.recordLayerMiss("lineage");
  }

  private static void recordWrite() {
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) m.recordLayerWrite("lineage");
  }
}
