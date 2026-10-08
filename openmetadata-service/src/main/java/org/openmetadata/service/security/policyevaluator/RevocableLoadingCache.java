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

package org.openmetadata.service.security.policyevaluator;

import com.google.common.base.Ticker;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.CacheStats;
import com.google.common.cache.LoadingCache;
import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * A bounded per-user loading cache whose invalidation also covers loads that are already running.
 *
 * <p>Guava's {@code invalidate} removes entries but does not cancel a load in flight: a loader
 * that read the pre-change rows publishes its result afterwards as a fresh entry with a new write
 * time, so a revoked grant would be served for a whole TTL. Two guards close that window without
 * serializing loads behind a lock:
 *
 * <ul>
 *   <li>{@link #invalidateAll()} swaps in a new, empty cache. A load running against the retired
 *       cache can only publish into it, and the reader that started it sees the swap and retries
 *       against the active cache.
 *   <li>Targeted invalidation bumps an epoch before it removes the entry. A reader that overlapped
 *       with it drops whatever it just loaded and retries.
 * </ul>
 */
final class RevocableLoadingCache<V> {
  private static final int MAX_LOAD_ATTEMPTS = 3;

  private final Duration expireAfterWrite;
  private final Ticker ticker;
  private final Function<String, V> loader;
  private final Object swapLock = new Object();
  private final AtomicLong targetedInvalidations = new AtomicLong();
  private volatile LoadingCache<String, V> active;
  private volatile int maxEntries;

  RevocableLoadingCache(
      int maxEntries, Duration expireAfterWrite, Ticker ticker, Function<String, V> loader) {
    this.maxEntries = maxEntries;
    this.expireAfterWrite = expireAfterWrite;
    this.ticker = ticker;
    this.loader = loader;
    this.active = newCache(maxEntries);
  }

  /**
   * Returns a value that was loaded after the most recent invalidation that preceded this call. If
   * invalidations keep overtaking the load, the value is read straight from the loader instead, so
   * the caller is never handed a value that predates an invalidation it could have observed.
   */
  V get(String key) throws ExecutionException {
    V value = null;
    for (int attempt = 0; value == null && attempt < MAX_LOAD_ATTEMPTS; attempt++) {
      value = loadIfStillCurrent(key);
    }
    return value != null ? value : loader.apply(key);
  }

  private V loadIfStillCurrent(String key) throws ExecutionException {
    LoadingCache<String, V> generation = active;
    long invalidationsBefore = targetedInvalidations.get();
    V value = generation.get(key);
    boolean current = generation == active && invalidationsBefore == targetedInvalidations.get();
    if (!current) {
      generation.invalidate(key);
    }
    return current ? value : null;
  }

  void invalidate(String key) {
    targetedInvalidations.incrementAndGet();
    active.invalidate(key);
  }

  void invalidateMatching(Predicate<String> keyFilter) {
    targetedInvalidations.incrementAndGet();
    active.asMap().keySet().removeIf(keyFilter);
  }

  /** Retires the current cache. Loads still running against it can no longer reach readers. */
  void invalidateAll() {
    synchronized (swapLock) {
      active = newCache(maxEntries);
    }
  }

  void resize(int newMaxEntries) {
    synchronized (swapLock) {
      maxEntries = newMaxEntries;
      active = newCache(newMaxEntries);
    }
  }

  CacheStats stats() {
    return active.stats();
  }

  private LoadingCache<String, V> newCache(int entries) {
    return CacheBuilder.newBuilder()
        .maximumSize(entries)
        .expireAfterWrite(expireAfterWrite)
        .ticker(ticker)
        .recordStats()
        .build(
            new CacheLoader<String, V>() {
              @Override
              public V load(String key) {
                return loader.apply(key);
              }
            });
  }
}
