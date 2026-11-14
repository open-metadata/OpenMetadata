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
import com.google.common.cache.AbstractCache.SimpleStatsCounter;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.CacheStats;
import com.google.common.cache.LoadingCache;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.ExecutionException;
import java.util.function.Function;

/**
 * A bounded per-user loading cache whose invalidation also covers loads that are already running.
 *
 * <p>Guava's {@code invalidate} removes entries but does not cancel a load in flight: a loader
 * that read the pre-change rows publishes its result afterwards as a fresh entry with a new write
 * time, and any reader that arrives meanwhile joins that load. Invalidation therefore never
 * removes anything from a cache that could still receive such a result; it retires the whole cache
 * and installs an empty one:
 *
 * <ul>
 *   <li>A reader that starts after the swap uses the new cache, so it cannot join a load that
 *       began before the invalidation.
 *   <li>A reader that was already waiting on the retired cache sees the swap once its load
 *       returns, discards the result and retries against the active cache.
 * </ul>
 *
 * <p>The keys are spread over {@value #SHARDS} independent shards so that invalidating one user
 * retires one shard rather than every user's entry. The configured maximum is divided among the
 * shards and never exceeded; below {@value #SHARDS} entries some shards hold nothing. Shard
 * selection is case-insensitive so invalidation covers every spelling of a principal name;
 * keys within each shard retain Guava's case-sensitive matching.
 */
final class RevocableLoadingCache<V> {
  static final int SHARDS = 32;
  private static final int MAX_LOAD_ATTEMPTS = 3;

  private final Duration expireAfterWrite;
  private final Ticker ticker;
  private final Function<String, V> loader;
  private final Object swapLock = new Object();
  // Retired generations can still finish loads, so their counters must outlive the swap.
  private final SimpleStatsCounter statistics = new SimpleStatsCounter();
  private final Shard<V>[] shards;
  private volatile int maxEntries;

  @SuppressWarnings("unchecked")
  RevocableLoadingCache(
      int maxEntries, Duration expireAfterWrite, Ticker ticker, Function<String, V> loader) {
    this.expireAfterWrite = expireAfterWrite;
    this.ticker = ticker;
    this.loader = loader;
    this.maxEntries = maxEntries;
    this.shards = new Shard[SHARDS];
    for (int index = 0; index < SHARDS; index++) {
      shards[index] = new Shard<>(index, newCache(capacityOf(index)));
    }
  }

  /**
   * Returns a value that was loaded after the most recent invalidation that preceded this call. If
   * invalidations keep overtaking the load, the value is read straight from the loader instead, so
   * the caller is never handed a value that predates an invalidation it could have observed.
   */
  V get(String key) throws ExecutionException {
    Shard<V> shard = shardFor(key);
    V value = null;
    for (int attempt = 0; value == null && attempt < MAX_LOAD_ATTEMPTS; attempt++) {
      value = loadIfStillCurrent(shard, key);
    }
    return value != null ? value : loadUncached(key);
  }

  private V loadIfStillCurrent(Shard<V> shard, String key) throws ExecutionException {
    LoadingCache<String, V> generation = shard.active;
    V value = generation.getIfPresent(key);
    if (value == null) {
      statistics.recordMisses(1);
      value = generation.get(key);
    } else {
      statistics.recordHits(1);
    }
    return generation == shard.active ? value : null;
  }

  /** Retires the shard holding {@code key}, whatever case it was written in. */
  void invalidateUser(String key) {
    Shard<V> shard = shardFor(key);
    synchronized (swapLock) {
      shard.active = newCache(capacityOf(shard.index));
    }
  }

  /** Retires every shard. Loads still running against them can no longer reach readers. */
  void invalidateAll() {
    synchronized (swapLock) {
      replaceAllShards();
    }
  }

  void resize(int newMaxEntries) {
    synchronized (swapLock) {
      maxEntries = newMaxEntries;
      replaceAllShards();
    }
  }

  CacheStats stats() {
    return statistics.snapshot();
  }

  private V loadUncached(String key) {
    statistics.recordMisses(1);
    return loadAndRecord(key);
  }

  private V loadAndRecord(String key) {
    long started = System.nanoTime();
    boolean succeeded = false;
    try {
      V value = loader.apply(key);
      succeeded = value != null;
      return value;
    } finally {
      long elapsed = System.nanoTime() - started;
      if (succeeded) {
        statistics.recordLoadSuccess(elapsed);
      } else {
        statistics.recordLoadException(elapsed);
      }
    }
  }

  private void replaceAllShards() {
    for (Shard<V> shard : shards) {
      shard.active = newCache(capacityOf(shard.index));
    }
  }

  private Shard<V> shardFor(String key) {
    return shards[Math.floorMod(key.toLowerCase(Locale.ROOT).hashCode(), SHARDS)];
  }

  /** Splits the configured maximum across the shards so that the capacities sum to exactly it. */
  private int capacityOf(int shardIndex) {
    int total = maxEntries;
    return total / SHARDS + (shardIndex < total % SHARDS ? 1 : 0);
  }

  private LoadingCache<String, V> newCache(int entries) {
    return CacheBuilder.newBuilder()
        .maximumSize(entries)
        .expireAfterWrite(expireAfterWrite)
        .ticker(ticker)
        .removalListener(
            notification -> {
              if (notification.wasEvicted()) {
                statistics.recordEviction();
              }
            })
        .build(
            new CacheLoader<String, V>() {
              @Override
              public V load(String key) {
                return loadAndRecord(key);
              }
            });
  }

  private static final class Shard<V> {
    private final int index;
    private volatile LoadingCache<String, V> active;

    private Shard(int index, LoadingCache<String, V> active) {
      this.index = index;
      this.active = active;
    }
  }
}
