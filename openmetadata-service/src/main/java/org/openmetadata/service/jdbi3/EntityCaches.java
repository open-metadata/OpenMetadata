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

package org.openmetadata.service.jdbi3;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.cache.Weigher;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.CacheConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Static entity name/id read-through caches, count cache, and the field-fetch executor.
 * Extracted from EntityRepository. EntityRepository keeps thin delegators for the public
 * lifecycle methods (initCaches / setFieldFetchPoolSize / resetFieldFetchPoolSize). */
public final class EntityCaches {
  private static final Logger LOG = LoggerFactory.getLogger(EntityCaches.class);

  private EntityCaches() {}

  private static final int STRING_OBJECT_OVERHEAD_BYTES = 40;

  // Conservative upper-bound weight for a String: length() * 2 (UTF-16 worst-case) + 40 (header).
  // On Java 21 with compact strings, LATIN1 content uses fewer bytes, so this overestimates
  // slightly — which is intentional for memory capping. Zero allocation, single field read.
  // Defaults used before CacheConfiguration is loaded at startup. initCaches() replaces these.
  public static volatile LoadingCache<Pair<String, String>, String> CACHE_WITH_NAME =
      buildEntityNameCache(
          CacheConfiguration.DEFAULT_ENTITY_CACHE_MAX_SIZE_BYTES,
          CacheConfiguration.DEFAULT_ENTITY_CACHE_TTL_SECONDS);
  public static volatile LoadingCache<Pair<String, UUID>, String> CACHE_WITH_ID =
      buildEntityIdCache(
          CacheConfiguration.DEFAULT_ENTITY_CACHE_MAX_SIZE_BYTES,
          CacheConfiguration.DEFAULT_ENTITY_CACHE_TTL_SECONDS);

  /**
   * Canonical {@link #CACHE_WITH_NAME} key. User FQNs are lowercased at the DB layer
   * ({@code UserDAO.findEntityByName}), so the Guava cache must use the same normalization —
   * otherwise {@code Alice@x.com} and {@code alice@x.com} produce two split entries and
   * invalidations written against the lowercased canonical form miss the mixed-case entry,
   * serving stale data until TTL.
   */
  public static Pair<String, String> cacheNameKey(String entityType, String fqn) {
    if (fqn != null && Entity.USER.equals(entityType)) {
      return new ImmutablePair<>(entityType, fqn.toLowerCase(Locale.ROOT));
    }
    return new ImmutablePair<>(entityType, fqn);
  }

  /**
   * Rebuild entity caches with values from {@link CacheConfiguration}. Called once during app
   * startup after the configuration is loaded. Safe to call multiple times — subsequent calls
   * replace the caches (old entries are lost, which is fine during initialization).
   */
  public static void initCaches(CacheConfiguration config) {
    CACHE_WITH_NAME =
        buildEntityNameCache(
            config.getEntityCacheMaxSizeBytes(), config.getEntityCacheTTLSeconds());
    CACHE_WITH_ID =
        buildEntityIdCache(config.getEntityCacheMaxSizeBytes(), config.getEntityCacheTTLSeconds());
    LOG.info(
        "Entity caches initialized: maxWeight={}MB, ttl={}s",
        config.getEntityCacheMaxSizeBytes() / (1024 * 1024),
        config.getEntityCacheTTLSeconds());
  }

  private static LoadingCache<Pair<String, String>, String> buildEntityNameCache(
      long maxWeightBytes, int ttlSeconds) {
    return CacheBuilder.newBuilder()
        .maximumWeight(maxWeightBytes)
        .weigher(
            (Weigher<Pair<String, String>, String>)
                (key, value) -> value.length() * 2 + STRING_OBJECT_OVERHEAD_BYTES)
        .expireAfterWrite(ttlSeconds, TimeUnit.SECONDS)
        .recordStats()
        .build(new EntityLoaderWithName());
  }

  private static LoadingCache<Pair<String, UUID>, String> buildEntityIdCache(
      long maxWeightBytes, int ttlSeconds) {
    return CacheBuilder.newBuilder()
        .maximumWeight(maxWeightBytes)
        .weigher(
            (Weigher<Pair<String, UUID>, String>)
                (key, value) -> value.length() * 2 + STRING_OBJECT_OVERHEAD_BYTES)
        .expireAfterWrite(ttlSeconds, TimeUnit.SECONDS)
        .recordStats()
        .build(new EntityLoaderWithId());
  }

  private static final int DEFAULT_FIELD_FETCH_POOL_SIZE =
      Math.min(50, Runtime.getRuntime().availableProcessors() * 4);
  private static final ThreadPoolExecutor FIELD_FETCH_EXECUTOR =
      createFieldFetchExecutor(DEFAULT_FIELD_FETCH_POOL_SIZE);

  private static ThreadPoolExecutor createFieldFetchExecutor(int poolSize) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            poolSize,
            poolSize,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(),
            java.lang.Thread.ofVirtual().name("om-field-fetch-", 0).factory());
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  public static synchronized void setFieldFetchPoolSize(int size) {
    int newSize = Math.max(1, Math.min(50, size));
    if (newSize <= FIELD_FETCH_EXECUTOR.getMaximumPoolSize()) {
      FIELD_FETCH_EXECUTOR.setCorePoolSize(newSize);
      FIELD_FETCH_EXECUTOR.setMaximumPoolSize(newSize);
    } else {
      FIELD_FETCH_EXECUTOR.setMaximumPoolSize(newSize);
      FIELD_FETCH_EXECUTOR.setCorePoolSize(newSize);
    }
    LOG.info("Field-fetch pool resized to {} threads", newSize);
  }

  public static synchronized void resetFieldFetchPoolSize() {
    setFieldFetchPoolSize(DEFAULT_FIELD_FETCH_POOL_SIZE);
  }

  public static final LoadingCache<String, Integer> COUNT_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(500)
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .recordStats()
          .build(
              new CacheLoader<String, Integer>() {
                @Override
                public Integer load(String key) {
                  throw new UnsupportedOperationException("Use get() method with a custom loader");
                }
              });
}
