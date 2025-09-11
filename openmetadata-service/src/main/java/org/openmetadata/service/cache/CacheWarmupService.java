package org.openmetadata.service.cache;

import com.google.common.util.concurrent.RateLimiter;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

@Slf4j
public class CacheWarmupService {
  private final CacheConfig config;
  private final Jdbi jdbi;
  private final CollectionDAO dao;
  private final CacheProvider cache;
  private final CachedEntityDao entityDao;
  private final CachedRelationshipDao relationshipDao;
  private final CachedTagUsageDao tagUsageDao;
  private final ExecutorService executor;
  private final Semaphore concurrencyLimiter;
  private final RateLimiter rateLimiter;
  private final AtomicBoolean isRunning = new AtomicBoolean(false);
  private final CacheKeys keys;

  @Getter private final WarmupStats stats = new WarmupStats();

  public CacheWarmupService(CacheConfig config, Jdbi mainJdbi, CacheProvider cache) {
    this.config = config;
    this.jdbi = mainJdbi;
    this.cache = cache;
    this.dao = mainJdbi.onDemand(CollectionDAO.class);

    this.keys = new CacheKeys(config.redis.keyspace);
    this.entityDao = new CachedEntityDao(dao, cache, keys, config);
    this.relationshipDao = new CachedRelationshipDao(dao, cache, keys, config);
    this.tagUsageDao = new CachedTagUsageDao(dao, cache, keys, config);

    // Use default values since warmup config was removed
    // Warmup is optional with write-through caching
    int maxConcurrent = 8; // Default concurrent threads
    this.executor = Executors.newFixedThreadPool(maxConcurrent);
    this.concurrencyLimiter = new Semaphore(maxConcurrent);
    this.rateLimiter = RateLimiter.create(50); // Default 50 QPS
  }

  public boolean isWarmupInProgress() {
    return isRunning.get();
  }

  public void startWarmup() {
    startWarmup(false);
  }

  public void startWarmup(boolean force) {
    // Warmup is optional with write-through caching
    // Only run if explicitly forced (for load testing)
    if (!force) {
      LOG.info("Cache warmup skipped - write-through caching populates cache naturally");
      return;
    }

    if (!isRunning.compareAndSet(false, true)) {
      LOG.warn("Cache warmup already in progress");
      return;
    }

    // Leader election using Redis SETNX - only one server performs warmup
    if (!acquireWarmupLeadership()) {
      LOG.info("Another server is performing cache warmup, skipping");
      isRunning.set(false);
      return;
    }

    stats.reset();
    stats.inProgress = true;
    stats.startTime = System.currentTimeMillis();

    CompletableFuture.runAsync(this::performWarmup, executor)
        .whenComplete(
            (result, error) -> {
              if (error != null) {
                LOG.error("Cache warmup failed", error);
                stats.errors.incrementAndGet();
              }
              stats.inProgress = false;
              stats.endTime = System.currentTimeMillis();
              releaseWarmupLeadership();
              isRunning.set(false);
              LOG.info("Cache warmup completed: {}", stats);
            });
  }

  private void performWarmup() {
    int topNByUsage = 2000; // Default value
    LOG.info("Starting cache warmup for top {} entities", topNByUsage);

    try {
      List<EntityReference> hotEntities = getHotEntities();
      LOG.info("Found {} hot entities to warm up", hotEntities.size());

      for (EntityReference entityRef : hotEntities) {
        if (!isRunning.get()) {
          LOG.info("Cache warmup cancelled");
          break;
        }

        rateLimiter.acquire();

        try {
          concurrencyLimiter.acquire();
          CompletableFuture.runAsync(() -> warmupEntity(entityRef), executor)
              .whenComplete((r, e) -> concurrencyLimiter.release());
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }
      }

      // Shutdown executor and wait for all warmup tasks to complete
      executor.shutdown();
      if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
        LOG.warn("Cache warmup tasks did not complete within 30 seconds timeout");
        executor.shutdownNow();
      }

    } catch (InterruptedException e) {
      // This is expected when shutting down, don't log as error
      LOG.debug("Cache warmup interrupted during shutdown");
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      LOG.error("Error during cache warmup", e);
      stats.errors.incrementAndGet();
    }
  }

  private List<EntityReference> getHotEntities() {
    LOG.info("Starting cache warmup - loading entities from database for load testing");

    List<EntityReference> entities = new ArrayList<>();

    // For load testing, we want ALL entities, not just hot ones
    // Query each entity type and load them all
    String[] entityTypes = {
      "table",
      "database",
      "databaseSchema",
      "dashboard",
      "pipeline",
      "topic",
      "mlmodel",
      "container",
      "dataProduct",
      "chart",
      "report",
      "storedProcedure",
      "glossary",
      "glossaryTerm"
    };

    for (String entityType : entityTypes) {
      try {
        // Get the actual table name from the EntityRepository
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
        if (repository == null) {
          LOG.debug("No repository found for entity type: {}", entityType);
          continue;
        }

        String tableName = repository.getDao().getTableName();
        String query = "SELECT id, name FROM " + tableName + " LIMIT ?";
        int topNByUsage = 2000; // Default value
        int limitPerType = Math.max(100, topNByUsage / entityTypes.length);

        // Direct JDBI query to get real entity data
        List<EntityReference> typeEntities =
            jdbi.withHandle(
                handle -> {
                  try {
                    return handle
                        .createQuery(query)
                        .bind(0, limitPerType)
                        .map(
                            (rs, ctx) ->
                                new EntityReference()
                                    .withId(UUID.fromString(rs.getString("id")))
                                    .withType(entityType)
                                    .withName(rs.getString("name")))
                        .list();
                  } catch (Exception e) {
                    // Table might not exist for this entity type
                    LOG.debug("Could not query {} table: {}", tableName, e.getMessage());
                    return new ArrayList<>();
                  }
                });

        entities.addAll(typeEntities);
        LOG.info("Found {} {} entities for warmup", typeEntities.size(), entityType);

      } catch (Exception e) {
        LOG.warn("Could not fetch {} entities: {}", entityType, e.getMessage());
      }
    }

    // If we want to prioritize by usage, also query the most viewed entities
    try {
      // For MySQL/PostgreSQL compatibility, use JSON extraction
      String usageQuery =
          "SELECT DISTINCT entityFQN, extension FROM entity_extension_time_series "
              + "WHERE extension IS NOT NULL "
              + "ORDER BY entityFQN DESC "
              + "LIMIT ?";

      List<EntityReference> hotEntities =
          jdbi.withHandle(
              handle ->
                  handle
                      .createQuery(usageQuery)
                      .bind(0, Math.min(1000, 2000)) // Default topNByUsage
                      .map(
                          (rs, ctx) -> {
                            try {
                              String fqn = rs.getString("entityFQN");
                              // Parse FQN to extract entity type and ID
                              // FQN format: entityType.name or entityType.uuid
                              if (fqn != null && fqn.contains(".")) {
                                String[] parts = fqn.split("\\.", 2);
                                return new EntityReference().withType(parts[0]).withName(parts[1]);
                              }
                            } catch (Exception e) {
                              // Ignore malformed FQNs
                            }
                            return null;
                          })
                      .list()
                      .stream()
                      .filter(ref -> ref != null)
                      .collect(Collectors.toList()));

      // Add hot entities to the front of the list for priority warming
      entities.addAll(0, hotEntities);
      LOG.info("Added {} hot entities based on usage metrics", hotEntities.size());

    } catch (Exception e) {
      LOG.debug("Could not fetch usage metrics: {}", e.getMessage());
    }

    LOG.info("Total entities to warm up: {}", entities.size());
    return entities;
  }

  private void warmupEntity(EntityReference entityRef) {
    try {
      UUID entityId = entityRef.getId();
      String entityType = entityRef.getType();

      entityDao.getBase(entityId, entityType);
      stats.entitiesWarmed.incrementAndGet();

      relationshipDao.list(entityId, entityType, "contains", "OUT");
      relationshipDao.list(entityId, entityType, "contains", "IN");
      relationshipDao.list(entityId, entityType, "owns", "OUT");
      relationshipDao.list(entityId, entityType, "owns", "IN");
      stats.relationshipsWarmed.addAndGet(4);

      tagUsageDao.getEntityTags(entityId, entityType);
      stats.tagsWarmed.incrementAndGet();

      LOG.debug("Warmed up entity: {} -> {}", entityType, entityRef.getName());

    } catch (Exception e) {
      LOG.error("Failed to warm up entity: {}", entityRef, e);
      stats.errors.incrementAndGet();
    }
  }

  private boolean acquireWarmupLeadership() {
    if (!cache.available()) {
      LOG.info("Cache not available, proceeding with warmup on this server");
      return true;
    }

    String lockKey = keys.ns + ":warmup:lock";
    String serverId = getServerId();
    Duration lockTtl = Duration.ofMinutes(10);

    try {
      String existingLock = cache.get(lockKey).orElse(null);
      if (existingLock != null) {
        LOG.info("Warmup lock held by server: {}", existingLock);
        return false;
      }

      cache.set(lockKey, serverId, lockTtl);

      Thread.sleep(100);

      String verifyLock = cache.get(lockKey).orElse("");
      boolean acquired = serverId.equals(verifyLock) || verifyLock.isEmpty();

      if (acquired) {
        LOG.info("Acquired warmup lock for server: {}", serverId);
      } else {
        LOG.info("Failed to acquire warmup lock, another server won: {}", verifyLock);
      }

      return acquired;

    } catch (Exception e) {
      LOG.error("Error acquiring warmup lock", e);
      return false;
    }
  }

  private void releaseWarmupLeadership() {
    if (!cache.available()) {
      return;
    }

    String lockKey = keys.ns + ":warmup:lock";
    String serverId = getServerId();

    try {
      String existingLock = cache.get(lockKey).orElse(null);
      if (serverId.equals(existingLock)) {
        cache.del(lockKey);
        LOG.info("Released warmup lock for server: {}", serverId);
      }
    } catch (Exception e) {
      LOG.error("Error releasing warmup lock", e);
    }
  }

  private String getServerId() {
    try {
      return java.net.InetAddress.getLocalHost().getHostName()
          + "_"
          + java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
    } catch (java.net.UnknownHostException e) {
      return "server_" + java.lang.management.ManagementFactory.getRuntimeMXBean().getName();
    }
  }

  public void shutdown() {
    isRunning.set(false);
    executor.shutdown();
    try {
      if (!executor.awaitTermination(10, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (InterruptedException e) {
      executor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }

  @Getter
  public static class WarmupStats {
    private volatile boolean inProgress = false;
    private long startTime;
    private long endTime;
    private final AtomicInteger entitiesWarmed = new AtomicInteger();
    private final AtomicInteger relationshipsWarmed = new AtomicInteger();
    private final AtomicInteger tagsWarmed = new AtomicInteger();
    private final AtomicInteger errors = new AtomicInteger();

    public int getEntitiesWarmed() {
      return entitiesWarmed.get();
    }

    public int getRelationshipsWarmed() {
      return relationshipsWarmed.get();
    }

    public int getTagsWarmed() {
      return tagsWarmed.get();
    }

    public int getErrors() {
      return errors.get();
    }

    public void reset() {
      entitiesWarmed.set(0);
      relationshipsWarmed.set(0);
      tagsWarmed.set(0);
      errors.set(0);
    }

    public long getDurationSeconds() {
      if (endTime > 0) {
        return (endTime - startTime) / 1000;
      } else if (startTime > 0) {
        return (System.currentTimeMillis() - startTime) / 1000;
      }
      return 0;
    }

    @Override
    public String toString() {
      return String.format(
          "WarmupStats{inProgress=%s, duration=%dms, entities=%d, relationships=%d, tags=%d, errors=%d}",
          inProgress,
          endTime > 0 ? endTime - startTime : System.currentTimeMillis() - startTime,
          entitiesWarmed.get(),
          relationshipsWarmed.get(),
          tagsWarmed.get(),
          errors.get());
    }
  }
}
