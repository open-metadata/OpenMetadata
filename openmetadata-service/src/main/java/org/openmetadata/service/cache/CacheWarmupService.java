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

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.CacheConfiguration;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class CacheWarmupService {

  private final CacheConfiguration cacheConfig;
  private final CollectionDAO collectionDAO;
  private final ExecutorService executorService;
  private final RateLimiter rateLimiter;

  // Track active warmup to avoid duplicate warmups on the same server
  private volatile CompletableFuture<Void> activeWarmup = null;

  private volatile boolean warmupInProgress = false;
  private volatile long warmupStartTime;
  private volatile int entitiesProcessed = 0;
  private volatile int relationshipsWarmed = 0;
  private volatile int tagsWarmed = 0;

  public CacheWarmupService(CacheConfiguration cacheConfig, CollectionDAO collectionDAO) {
    this.cacheConfig = cacheConfig;
    this.collectionDAO = collectionDAO;
    this.executorService = AsyncService.getInstance().getExecutorService();
    // Create Resilience4j rate limiter to control warmup pace and prevent database overload
    RateLimiterConfig rateLimiterConfig =
        RateLimiterConfig.custom()
            .limitForPeriod((int) cacheConfig.getWarmupRateLimit())
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(60))
            .build();

    this.rateLimiter = RateLimiter.of("cache-warmup", rateLimiterConfig);

    LOG.info(
        "CacheWarmupService initialized with Resilience4j rate limiter: {} ops/sec",
        cacheConfig.getWarmupRateLimit());
  }

  public synchronized CompletableFuture<Void> startWarmup() {
    if (!cacheConfig.isWarmupEnabled() || !RelationshipCache.isAvailable()) {
      LOG.info("Cache warmup disabled or cache not available, skipping warmup");
      return CompletableFuture.completedFuture(null);
    }

    // Check if there's already an active warmup on this server
    if (activeWarmup != null && !activeWarmup.isDone()) {
      LOG.debug("Warmup already in progress on this server, returning existing future");
      return activeWarmup;
    }

    // Create new warmup future
    LOG.info(
        "Starting cache warmup with {} threads, batch size: {}",
        cacheConfig.getWarmupThreads(),
        cacheConfig.getWarmupBatchSize());

    activeWarmup =
        CompletableFuture.runAsync(this::performWarmup, executorService)
            .whenComplete(
                (result, error) -> {
                  if (error != null) {
                    LOG.error("Cache warmup failed", error);
                  }
                  activeWarmup = null; // Clear reference when done
                });

    return activeWarmup;
  }

  public WarmupStats getWarmupStats() {
    return new WarmupStats(
        warmupInProgress, warmupStartTime, entitiesProcessed, relationshipsWarmed, tagsWarmed);
  }

  public void shutdown() {
    try {
      // Cancel any active warmup
      if (activeWarmup != null && !activeWarmup.isDone()) {
        activeWarmup.cancel(true);
      }

      executorService.shutdown();
      if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
        executorService.shutdownNow();
        LOG.warn("Cache warmup executor did not terminate gracefully");
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      executorService.shutdownNow();
    }
  }

  private void performWarmup() {
    warmupInProgress = true;
    warmupStartTime = System.currentTimeMillis();
    entitiesProcessed = 0;
    relationshipsWarmed = 0;
    tagsWarmed = 0;

    try {
      LOG.info("Cache warmup started");
      List<CompletableFuture<Void>> warmupTasks = new ArrayList<>();
      warmupTasks.add(CompletableFuture.runAsync(this::warmupEntityRelationships, executorService));
      warmupTasks.add(CompletableFuture.runAsync(this::warmupTagRelationships, executorService));
      warmupTasks.add(
          CompletableFuture.runAsync(this::warmupFrequentlyAccessedEntities, executorService));
      CompletableFuture.allOf(warmupTasks.toArray(new CompletableFuture[0])).join();
      long duration = System.currentTimeMillis() - warmupStartTime;
      LOG.info(
          "Cache warmup completed in {}ms. Processed {} entities, {} relationships, {} tags",
          duration,
          entitiesProcessed,
          relationshipsWarmed,
          tagsWarmed);

    } catch (Exception e) {
      LOG.error("Cache warmup failed: {}", e.getMessage(), e);
    } finally {
      warmupInProgress = false;
    }
  }

  private void warmupEntityRelationships() {
    try {
      String[] entityTypes = {
        Entity.TABLE, Entity.DATABASE, Entity.DATABASE_SCHEMA, Entity.DASHBOARD, Entity.TOPIC
      };

      for (String entityType : entityTypes) {
        warmupEntityRelationshipsForType(entityType);
      }

    } catch (Exception e) {
      LOG.error("Error warming up entity relationships: {}", e.getMessage(), e);
    }
  }

  private void warmupEntityRelationshipsForType(String entityType) {
    try {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);

      Fields fields = EntityUtil.Fields.EMPTY_FIELDS; // Minimal data for performance
      ListFilter filter = new ListFilter(Include.NON_DELETED);
      ResultList<?> result =
          repository.listAfter(null, fields, filter, cacheConfig.getWarmupBatchSize() * 2, null);
      List<?> entities = result.getData();

      List<UUID> entityIds =
          entities.stream()
              .map(entity -> ((org.openmetadata.schema.EntityInterface) entity).getId())
              .toList();

      if (entityIds.isEmpty()) {
        LOG.debug("No entities found for type: {}", entityType);
        return;
      }

      LOG.debug(
          "Warming up relationships for {} entities of type: {}", entityIds.size(), entityType);

      for (int i = 0; i < entityIds.size(); i += cacheConfig.getWarmupBatchSize()) {
        int endIndex = Math.min(i + cacheConfig.getWarmupBatchSize(), entityIds.size());
        List<UUID> batch = entityIds.subList(i, endIndex);

        for (UUID uuid : batch) {
          try {
            // Use rate limiter to control the pace of database queries
            rateLimiter.acquirePermission();

            List<CollectionDAO.EntityRelationshipRecord> toRelations =
                collectionDAO.relationshipDAO().findTo(uuid, entityType, List.of(1, 2, 3, 4, 5));
            List<CollectionDAO.EntityRelationshipRecord> fromRelations =
                collectionDAO.relationshipDAO().findFrom(uuid, entityType, 1, entityType);

            relationshipsWarmed += toRelations.size() + fromRelations.size();
            entitiesProcessed++;

          } catch (Exception e) {
            LOG.debug("Error warming up relationships for entity {}: {}", uuid, e.getMessage());
          }
        }
      }

    } catch (Exception e) {
      LOG.error(
          "Error warming up relationships for entity type {}: {}", entityType, e.getMessage(), e);
    }
  }

  private void warmupTagRelationships() {
    try {
      LOG.debug("Starting tag relationships warmup");
      String[] taggedEntityTypes = {
        Entity.TABLE, Entity.DATABASE, Entity.DASHBOARD, Entity.TOPIC, Entity.PIPELINE
      };

      for (String entityType : taggedEntityTypes) {
        warmupTagRelationshipsForType(entityType);
      }

    } catch (Exception e) {
      LOG.error("Error warming up tag relationships: {}", e.getMessage(), e);
    }
  }

  private void warmupTagRelationshipsForType(String entityType) {
    try {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);

      // Get a sample of entities
      Fields fields = EntityUtil.Fields.EMPTY_FIELDS;
      ListFilter filter = new ListFilter(Include.NON_DELETED);
      ResultList<?> result =
          repository.listAfter(null, fields, filter, cacheConfig.getWarmupBatchSize(), null);
      List<?> entities = result.getData();

      List<String> entityFQNs =
          entities.stream()
              .map(
                  entity ->
                      ((org.openmetadata.schema.EntityInterface) entity).getFullyQualifiedName())
              .toList();

      if (entityFQNs.isEmpty()) {
        return;
      }

      LOG.debug("Warming up tags for {} entities of type: {}", entityFQNs.size(), entityType);
      for (int i = 0; i < entityFQNs.size(); i += cacheConfig.getWarmupBatchSize()) {
        int endIndex = Math.min(i + cacheConfig.getWarmupBatchSize(), entityFQNs.size());
        List<String> batch = entityFQNs.subList(i, endIndex);

        for (String entityFQN : batch) {
          try {
            // Use rate limiter to control the pace of database queries
            rateLimiter.acquirePermission();

            List<TagLabel> tags = collectionDAO.tagUsageDAO().getTags(entityFQN);
            tagsWarmed += tags.size();
          } catch (Exception e) {
            LOG.debug("Error warming up tags for entity {}: {}", entityFQN, e.getMessage());
          }
        }
      }

    } catch (Exception e) {
      LOG.error("Error warming up tags for entity type {}: {}", entityType, e.getMessage(), e);
    }
  }

  private void warmupFrequentlyAccessedEntities() {
    try {
      LOG.debug("Starting frequently accessed entities warmup");
      warmupCoreMetadataEntities();
    } catch (Exception e) {
      LOG.error("Error warming up frequently accessed entities: {}", e.getMessage(), e);
    }
  }

  private void warmupCoreMetadataEntities() {
    try {
      String[] coreEntityTypes = {Entity.USER, Entity.TEAM, Entity.POLICY, Entity.ROLE};

      for (String entityType : coreEntityTypes) {
        try {
          EntityRepository<?> repository = Entity.getEntityRepository(entityType);
          Fields fields = EntityUtil.Fields.EMPTY_FIELDS;
          ListFilter filter = new ListFilter(Include.NON_DELETED);
          ResultList<?> result = repository.listAfter(null, fields, filter, 1000, null);
          List<?> entities = result.getData();

          List<UUID> entityIds =
              entities.stream()
                  .map(entity -> ((org.openmetadata.schema.EntityInterface) entity).getId())
                  .toList();

          for (UUID uuid : entityIds) {
            try {
              // Use rate limiter to control the pace of database queries
              rateLimiter.acquirePermission();

              collectionDAO.relationshipDAO().findTo(uuid, entityType, List.of(1, 2, 3));
              entitiesProcessed++;
            } catch (Exception e) {
              LOG.debug("Error warming up core entity {}: {}", uuid, e.getMessage());
            }
          }

        } catch (Exception e) {
          LOG.debug("Error warming up core entity type {}: {}", entityType, e.getMessage());
        }
      }

    } catch (Exception e) {
      LOG.error("Error warming up core metadata entities: {}", e.getMessage(), e);
    }
  }

  public static class WarmupStats {
    public final boolean inProgress;
    public final long startTime;
    public final int entitiesProcessed;
    public final int relationshipsWarmed;
    public final int tagsWarmed;

    public WarmupStats(
        boolean inProgress,
        long startTime,
        int entitiesProcessed,
        int relationshipsWarmed,
        int tagsWarmed) {
      this.inProgress = inProgress;
      this.startTime = startTime;
      this.entitiesProcessed = entitiesProcessed;
      this.relationshipsWarmed = relationshipsWarmed;
      this.tagsWarmed = tagsWarmed;
    }

    public long getDurationMs() {
      return inProgress ? System.currentTimeMillis() - startTime : 0;
    }

    @Override
    public String toString() {
      return String.format(
          "WarmupStats{inProgress=%s, duration=%dms, entities=%d, relationships=%d, tags=%d}",
          inProgress, getDurationMs(), entitiesProcessed, relationshipsWarmed, tagsWarmed);
    }
  }
}
