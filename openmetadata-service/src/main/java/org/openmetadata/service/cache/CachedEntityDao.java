package org.openmetadata.service.cache;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

@Slf4j
@RequiredArgsConstructor
public class CachedEntityDao {
  private final CollectionDAO dao;
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  public String getBase(UUID entityId, String entityType) {
    String cacheKey = keys.entity(entityType, entityId);

    // Try to get from cache first
    Optional<String> cached = cache.hget(cacheKey, "base");
    if (cached.isPresent()) {
      LOG.debug("Cache hit for entity: {} -> {}", entityType, entityId);
      return cached.get();
    }

    LOG.debug("Cache miss for entity: {} -> {}", entityType, entityId);

    // Fetch from database
    String entityJson = fetchEntityFromDatabase(entityId, entityType);

    // Write to cache (write-through caching)
    if (entityJson != null && !entityJson.equals("{}")) {
      try {
        cache.hset(
            cacheKey, Map.of("base", entityJson), Duration.ofSeconds(config.entityTtlSeconds));
        LOG.debug("Cached entity: {} -> {}", entityType, entityId);
      } catch (Exception e) {
        LOG.warn("Failed to cache entity: {} -> {}", entityType, entityId, e);
      }
    }

    return entityJson != null ? entityJson : "{}";
  }

  private String fetchEntityFromDatabase(UUID entityId, String entityType) {
    try {
      // Get the repository for this entity type
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      if (repository != null) {
        // Fetch the entity
        Object entity = repository.get(null, entityId, repository.getFields("*"));
        if (entity != null) {
          // Convert to JSON
          return JsonUtils.pojoToJson(entity);
        }
      }
    } catch (Exception e) {
      LOG.debug("Failed to fetch entity from database: {} -> {}", entityType, entityId, e);
    }
    return null;
  }

  /**
   * Write-through cache: Store entity in cache (called after DB write)
   */
  public void putBase(String entityType, UUID entityId, String entityJson) {
    if (entityJson == null || entityJson.isEmpty() || "{}".equals(entityJson)) {
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(cacheKey, Map.of("base", entityJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached entity: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache entity: {} -> {}", entityType, entityId, e);
    }
  }

  /**
   * Write-through cache: Store entity by name for fast name-based lookups
   */
  public void putByName(String entityType, String fqn, String entityJson) {
    if (entityJson == null || entityJson.isEmpty() || "{}".equals(entityJson)) {
      return;
    }

    String cacheKey = keys.entityByName(entityType, fqn);
    try {
      cache.set(cacheKey, entityJson, Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached entity by name: {} -> {}", entityType, fqn);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache entity by name: {} -> {}", entityType, fqn, e);
    }
  }

  /**
   * Write-through cache: Store entity reference for fast reference lookups
   */
  public void putReference(String entityType, UUID entityId, String refJson) {
    if (refJson == null || refJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(cacheKey, Map.of("ref", refJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached entity reference: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache entity reference: {} -> {}", entityType, entityId, e);
    }
  }

  /**
   * Write-through cache: Store entity reference by name
   */
  public void putReferenceByName(String entityType, String fqn, String refJson) {
    if (refJson == null || refJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.refByName(entityType, fqn);
    try {
      cache.set(cacheKey, refJson, Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached entity reference by name: {} -> {}", entityType, fqn);
    } catch (Exception e) {
      LOG.warn(
          "Failed to write-through cache entity reference by name: {} -> {}", entityType, fqn, e);
    }
  }

  /**
   * Get entity by name from cache
   */
  public Optional<String> getByName(String entityType, String fqn) {
    String cacheKey = keys.entityByName(entityType, fqn);
    return cache.get(cacheKey);
  }

  /**
   * Get entity reference by ID from cache
   */
  public Optional<String> getReference(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    return cache.hget(cacheKey, "ref");
  }

  /**
   * Get entity reference by name from cache
   */
  public Optional<String> getReferenceByName(String entityType, String fqn) {
    String cacheKey = keys.refByName(entityType, fqn);
    return cache.get(cacheKey);
  }

  public void invalidate(UUID entityId, String entityType) {
    String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateByName(String entityType, String fqn) {
    String cacheKeyEntity = keys.entityByName(entityType, fqn);
    String cacheKeyRef = keys.refByName(entityType, fqn);
    cache.del(cacheKeyEntity);
    cache.del(cacheKeyRef);
    LOG.debug("Invalidated cache for entity by name: {} -> {}", entityType, fqn);
  }

  // Additional invalidation methods for delete operations
  public void invalidateBase(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated base cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateReference(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    // Remove just the reference field from the hash
    cache.hdel(cacheKey, "ref");
    LOG.debug("Invalidated reference cache for entity: {} -> {}", entityType, entityId);
  }

  // Delete methods for evicting corrupted cache entries
  public void deleteBase(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Deleted corrupted cache entry for entity: {} -> {}", entityType, entityId);
  }

  public void deleteByName(String entityType, String fqn) {
    String entityCacheKey = keys.entityByName(entityType, fqn);
    String refCacheKey = keys.refByName(entityType, fqn);
    cache.del(entityCacheKey);
    cache.del(refCacheKey);
    LOG.debug("Deleted corrupted cache entries for entity by name: {} -> {}", entityType, fqn);
  }

  public void invalidateReferenceByName(String entityType, String fqn) {
    String cacheKey = keys.refByName(entityType, fqn);
    cache.del(cacheKey);
    LOG.debug("Invalidated reference cache by name: {} -> {}", entityType, fqn);
  }
}
