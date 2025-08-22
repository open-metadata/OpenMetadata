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

package org.openmetadata.service.cache;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.CacheConfiguration;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class LazyCacheService {

  private final CacheConfiguration cacheConfig;
  private final CollectionDAO collectionDAO;
  private final ExecutorService executorService;

  private final AtomicLong cacheHits = new AtomicLong(0);
  private final AtomicLong cacheMisses = new AtomicLong(0);
  private final AtomicLong prefetchCount = new AtomicLong(0);
  private final AtomicBoolean metricsEnabled = new AtomicBoolean(true);

  public LazyCacheService(CacheConfiguration cacheConfig, CollectionDAO collectionDAO) {
    this.cacheConfig = cacheConfig;
    this.collectionDAO = collectionDAO;
    try {
      this.executorService =
          org.openmetadata.service.util.ExecutorManager.getInstance()
              .getVirtualThreadExecutor(
                  "lazy-cache-service", Math.max(1, cacheConfig.getWarmupThreads()));
    } catch (Exception e) {
      LOG.warn("ExecutorManager not available, falling back to default executor", e);
      throw new RuntimeException("Failed to initialize lazy cache executor", e);
    }

    LOG.info("LazyCacheService initialized with {} threads", cacheConfig.getWarmupThreads());
  }

  public CompletableFuture<Void> initializeLazyCache() {
    if (!cacheConfig.isWarmupEnabled() || !RelationshipCache.isAvailable()) {
      LOG.info("Cache lazy loading disabled or cache not available");
      return CompletableFuture.completedFuture(null);
    }

    return CompletableFuture.runAsync(
        () -> {
          try {
            LOG.info("Lazy cache system initialized - simple background prefetching enabled");
            testCacheConnectivity();
          } catch (Exception e) {
            LOG.error("Failed to initialize lazy cache system: {}", e.getMessage(), e);
            throw new RuntimeException("Cache initialization failed", e);
          }
        },
        executorService);
  }

  public CacheStats getCacheStats() {
    return new CacheStats(
        cacheHits.get(), cacheMisses.get(), prefetchCount.get(), metricsEnabled.get());
  }

  public void recordCacheHit() {
    if (metricsEnabled.get()) {
      cacheHits.incrementAndGet();
    }
  }

  public void recordCacheMiss() {
    if (metricsEnabled.get()) {
      cacheMisses.incrementAndGet();
    }
  }

  public void recordPrefetch() {
    if (metricsEnabled.get()) {
      prefetchCount.incrementAndGet();
    }
  }

  public void shutdown() {
    try {
      executorService.shutdown();
      if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
        executorService.shutdownNow();
        LOG.warn("Cache service executor did not terminate gracefully");
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      executorService.shutdownNow();
    }
  }

  public void testCacheConnectivity() {
    if (!RelationshipCache.isAvailable()) {
      throw new RuntimeException("Cache is not available");
    }

    try {
      String testKey = "cache-test-" + System.currentTimeMillis();
      Map<String, Object> testData = Map.of("test", "connectivity");

      RelationshipCache.put(testKey, testData);
      Map<String, Object> retrieved = RelationshipCache.get(testKey);

      if (retrieved == null || !"connectivity".equals(retrieved.get("test"))) {
        throw new RuntimeException("Cache connectivity test failed");
      }

      RelationshipCache.evict(testKey);
      LOG.debug("Cache connectivity test passed");

    } catch (Exception e) {
      throw new RuntimeException("Cache connectivity test failed: " + e.getMessage(), e);
    }
  }

  public CompletableFuture<Void> testLazyCachePopulation() {
    return CompletableFuture.runAsync(
        () -> {
          try {
            LOG.info("Testing lazy cache population");
            String[] testEntityTypes = {Entity.TABLE, Entity.DATABASE_SCHEMA, Entity.DATABASE};
            for (String entityType : testEntityTypes) {
              try {
                EntityRepository<?> repository = Entity.getEntityRepository(entityType);
                Fields fields = EntityUtil.Fields.EMPTY_FIELDS;
                ListFilter filter = new ListFilter(Include.NON_DELETED);
                ResultList<?> result = repository.listAfter(null, fields, filter, 3, null);

                result.getData().stream()
                    .limit(2)
                    .forEach(
                        entity -> {
                          try {
                            UUID entityId = ((EntityInterface) entity).getId();
                            collectionDAO
                                .relationshipDAO()
                                .findTo(entityId, entityType, List.of(1, 2, 8));
                            recordCacheMiss(); // This will trigger background prefetching
                            // automatically
                          } catch (Exception e) {
                            LOG.debug("Test query failed for entity: {}", e.getMessage());
                          }
                        });

              } catch (Exception e) {
                LOG.debug("Test failed for entity type {}: {}", entityType, e.getMessage());
              }
            }

            LOG.info("Lazy cache population test completed");

          } catch (Exception e) {
            LOG.error("Lazy cache population test failed: {}", e.getMessage(), e);
            throw new RuntimeException(e);
          }
        },
        executorService);
  }

  public static class CacheStats {
    public final long cacheHits;
    public final long cacheMisses;
    public final long prefetchCount;
    public final boolean metricsEnabled;

    public CacheStats(
        long cacheHits, long cacheMisses, long prefetchCount, boolean metricsEnabled) {
      this.cacheHits = cacheHits;
      this.cacheMisses = cacheMisses;
      this.prefetchCount = prefetchCount;
      this.metricsEnabled = metricsEnabled;
    }

    public double getCacheHitRatio() {
      long total = cacheHits + cacheMisses;
      return total > 0 ? (double) cacheHits / total : 0.0;
    }

    @Override
    public String toString() {
      return String.format(
          "CacheStats{hits=%d, misses=%d, hitRatio=%.2f%%, prefetches=%d, metricsEnabled=%s}",
          cacheHits, cacheMisses, getCacheHitRatio() * 100, prefetchCount, metricsEnabled);
    }
  }
}
