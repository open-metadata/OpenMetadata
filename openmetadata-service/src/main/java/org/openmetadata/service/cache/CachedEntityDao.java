package org.openmetadata.service.cache;

import com.google.common.collect.Lists;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
public class CachedEntityDao {
  /** Caps a single DEL so evicting a very large cascade never blocks Redis on one command. */
  static final int MAX_KEYS_PER_DELETE = 1_000;

  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  /** One entity's cached variants: the id hash (base and reference) and the by-name aliases. */
  public record EntityKey(String entityType, UUID id, String fqn) {}

  public Optional<String> getBase(UUID entityId, String entityType) {
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }

    String cacheKey = keys.entity(entityType, entityId);
    Optional<String> cached = cache.hget(cacheKey, "base");
    CacheMetrics m = CacheMetrics.getInstance();
    if (cached.isPresent()) {
      LOG.debug("Cache hit for entity: {} -> {}", entityType, entityId);
      if (m != null) m.recordLayerHit(entityType);
      return cached;
    }

    LOG.debug("Cache miss for entity: {} -> {}", entityType, entityId);
    if (m != null) m.recordLayerMiss(entityType);
    return Optional.empty();
  }

  /**
   * Write-through cache: Store entity in cache (called after DB write)
   */
  public void putBase(String entityType, UUID entityId, String entityJson) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    if (entityJson == null || entityJson.isEmpty() || "{}".equals(entityJson)) {
      LOG.warn(
          "CACHE: Skipping cache write for empty entity JSON - Type: {}, ID: {}",
          entityType,
          entityId);
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    LOG.info(
        "CACHE: Writing entity to Redis - Key: {}, JSON length: {}", cacheKey, entityJson.length());
    try {
      cache.hset(cacheKey, Map.of("base", entityJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.info(
          "CACHE: Successfully wrote entity to Redis - Type: {} -> ID: {}", entityType, entityId);
    } catch (Exception e) {
      LOG.error(
          "CACHE: Failed to write entity to Redis - Type: {} -> ID: {}", entityType, entityId, e);
    }
  }

  /**
   * Write-through cache: Store entity by name for fast name-based lookups
   */
  public void putByName(String entityType, String fqn, String entityJson) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    if (entityJson == null || entityJson.isEmpty() || "{}".equals(entityJson)) {
      LOG.warn(
          "CACHE: Skipping cache write by name for empty entity JSON - Type: {}, FQN: {}",
          entityType,
          fqn);
      return;
    }

    String cacheKey = keys.entityByName(entityType, fqn);
    LOG.info(
        "CACHE: Writing entity by name to Redis - Key: {}, JSON length: {}",
        cacheKey,
        entityJson.length());
    try {
      cache.set(cacheKey, entityJson, Duration.ofSeconds(config.entityTtlSeconds));
      LOG.info(
          "CACHE: Successfully wrote entity by name to Redis - Type: {} -> FQN: {}",
          entityType,
          fqn);
    } catch (Exception e) {
      LOG.error(
          "CACHE: Failed to write entity by name to Redis - Type: {} -> FQN: {}",
          entityType,
          fqn,
          e);
    }
  }

  /**
   * Write-through cache: Store entity reference for fast reference lookups
   */
  public void putReference(String entityType, UUID entityId, String refJson) {
    if (refJson == null || refJson.isEmpty() || EntityCacheBypass.isSkipped()) {
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
    if (refJson == null || refJson.isEmpty() || EntityCacheBypass.isSkipped()) {
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
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }
    String cacheKey = keys.entityByName(entityType, fqn);
    Optional<String> result = cache.get(cacheKey);
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) {
      if (result.isPresent()) m.recordLayerHit(entityType);
      else m.recordLayerMiss(entityType);
    }
    return result;
  }

  /**
   * Get entity reference by ID from cache
   */
  public Optional<String> getReference(String entityType, UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }
    String cacheKey = keys.entity(entityType, entityId);
    Optional<String> result = cache.hget(cacheKey, "ref");
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) {
      if (result.isPresent()) m.recordLayerHit(entityType);
      else m.recordLayerMiss(entityType);
    }
    return result;
  }

  /**
   * Get entity reference by name from cache
   */
  public Optional<String> getReferenceByName(String entityType, String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }
    String cacheKey = keys.refByName(entityType, fqn);
    Optional<String> result = cache.get(cacheKey);
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) {
      if (result.isPresent()) m.recordLayerHit(entityType);
      else m.recordLayerMiss(entityType);
    }
    return result;
  }

  public void invalidate(UUID entityId, String entityType) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateByName(String entityType, String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    String cacheKeyEntity = keys.entityByName(entityType, fqn);
    String cacheKeyRef = keys.refByName(entityType, fqn);
    // One DEL, not two: between two round trips a reader can see the entity alias evicted and the
    // reference alias still live (or the reverse) and cache a half-stale view of the same entity.
    cache.del(cacheKeyEntity, cacheKeyRef);
    LOG.debug("Invalidated cache for entity by name: {} -> {}", entityType, fqn);
  }

  /**
   * Evicts every cached variant of a batch of entities in one DEL (split only past {@link
   * #MAX_KEYS_PER_DELETE} keys). A committed batch has to turn over at once: evicted entity by
   * entity, a reader finds one entity fresh while a sibling still serves its pre-write copy.
   */
  public void invalidateEntities(List<EntityKey> entities) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    List<String> cacheKeys = entities.stream().flatMap(this::cacheKeysOf).toList();
    for (List<String> chunk : Lists.partition(cacheKeys, MAX_KEYS_PER_DELETE)) {
      cache.del(chunk.toArray(String[]::new));
    }
  }

  private Stream<String> cacheKeysOf(EntityKey entity) {
    Stream<String> nameKeys =
        entity.fqn() == null
            ? Stream.empty()
            : Stream.of(
                keys.entityByName(entity.entityType(), entity.fqn()),
                keys.refByName(entity.entityType(), entity.fqn()));
    return Stream.concat(Stream.of(keys.entity(entity.entityType(), entity.id())), nameKeys);
  }

  // Additional invalidation methods for delete operations
  public void invalidateBase(String entityType, UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated base cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateReference(String entityType, UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    String cacheKey = keys.entity(entityType, entityId);
    // Remove just the reference field from the hash
    cache.hdel(cacheKey, "ref");
    LOG.debug("Invalidated reference cache for entity: {} -> {}", entityType, entityId);
  }

  // Delete methods for evicting corrupted cache entries
  public void deleteBase(String entityType, UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Deleted corrupted cache entry for entity: {} -> {}", entityType, entityId);
  }

  public void deleteByName(String entityType, String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    String entityCacheKey = keys.entityByName(entityType, fqn);
    String refCacheKey = keys.refByName(entityType, fqn);
    cache.del(entityCacheKey, refCacheKey);
    LOG.debug("Deleted corrupted cache entries for entity by name: {} -> {}", entityType, fqn);
  }

  public void invalidateReferenceByName(String entityType, String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    String cacheKey = keys.refByName(entityType, fqn);
    cache.del(cacheKey);
    LOG.debug("Invalidated reference cache by name: {} -> {}", entityType, fqn);
  }
}
