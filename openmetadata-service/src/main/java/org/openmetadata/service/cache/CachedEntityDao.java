package org.openmetadata.service.cache;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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

  private static final String FIELD_BASE = "base";
  private static final String FIELD_REF = "ref";
  private static final String EMPTY_JSON_OBJECT = "{}";

  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  /** One entity's cached variants: the id hash (base and reference) and the by-name aliases. */
  public record EntityKey(String entityType, UUID id, String fqn) {}

  public Optional<String> getBase(final UUID entityId, final String entityType) {
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }

    final Optional<String> cached = readDecodedBase(entityType, entityId);
    recordLayerOutcome(entityType, cached.isPresent());
    LOG.debug(
        "Cache {} for entity: {} -> {}", cached.isPresent() ? "hit" : "miss", entityType, entityId);
    return cached;
  }

  /**
   * Store an entity's JSON. Returns {@code true} if the entry was written to Redis, or {@code
   * false} if skipped (bypassed, empty, oversized, or unavailable).
   */
  public boolean putBase(final String entityType, final UUID entityId, final String entityJson) {
    if (EntityCacheBypass.isPopulateSkipped() || !cache.available()) {
      return false;
    }
    if (isEmptyEntityJson(entityJson)) {
      LOG.warn(
          "CACHE: Skipping cache write for empty entity JSON - Type: {}, ID: {}",
          entityType,
          entityId);
      return false;
    }

    final String encoded = CacheValueCodec.encode(entityJson, config.compressionThresholdBytes);
    if (exceedsMaxEntrySize(encoded)) {
      LOG.debug(
          "CACHE: Skipping oversized entity - Type: {}, ID: {}, encodedBytes={}, maxEntrySizeBytes={}",
          entityType,
          entityId,
          encoded.length(),
          config.maxEntrySizeBytes);
      return false;
    }

    final String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(cacheKey, Map.of(FIELD_BASE, encoded), entityTtl());
      LOG.debug(
          "CACHE: putBase succeeded - Key: {}, rawLength: {}, storedLength: {}",
          cacheKey,
          entityJson.length(),
          encoded.length());
      return true;
    } catch (RuntimeException e) {
      LOG.error(
          "CACHE: Failed to write entity to Redis - Type: {} -> ID: {}", entityType, entityId, e);
      return false;
    }
  }

  /**
   * Store an FQN-to-UUID pointer so name-based lookups resolve against the single entity JSON held
   * under {@link CacheKeys#entity(String, UUID)} instead of storing a second copy of the JSON.
   */
  public void putByName(final String entityType, final String fqn, final UUID entityId) {
    if (EntityCacheBypass.isPopulateSkipped()
        || !cache.available()
        || nullOrEmpty(fqn)
        || entityId == null) {
      return;
    }

    final String cacheKey = keys.entityIdByName(entityType, fqn);
    try {
      cache.set(cacheKey, entityId.toString(), entityTtl());
      LOG.debug("CACHE: putByName pointer succeeded - Key: {}, ID: {}", cacheKey, entityId);
    } catch (RuntimeException e) {
      LOG.error(
          "CACHE: Failed to write entity ID pointer by name - Type: {} -> FQN: {}",
          entityType,
          fqn,
          e);
    }
  }

  public void putReference(final String entityType, final UUID entityId, final String refJson) {
    if (nullOrEmpty(refJson) || EntityCacheBypass.isPopulateSkipped()) {
      return;
    }

    final String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(cacheKey, Map.of(FIELD_REF, refJson), entityTtl());
      LOG.debug("Write-through cached entity reference: {} -> {}", entityType, entityId);
    } catch (RuntimeException e) {
      LOG.warn("Failed to write-through cache entity reference: {} -> {}", entityType, entityId, e);
    }
  }

  public void putReferenceByName(final String entityType, final String fqn, final String refJson) {
    if (nullOrEmpty(refJson) || EntityCacheBypass.isPopulateSkipped()) {
      return;
    }

    final String cacheKey = keys.refByName(entityType, fqn);
    try {
      cache.set(cacheKey, refJson, entityTtl());
      LOG.debug("Write-through cached entity reference by name: {} -> {}", entityType, fqn);
    } catch (RuntimeException e) {
      LOG.warn(
          "Failed to write-through cache entity reference by name: {} -> {}", entityType, fqn, e);
    }
  }

  /**
   * Resolve entity JSON by FQN via two single-slot Redis reads: FQN pointer → UUID → base JSON.
   */
  public Optional<String> getByName(final String entityType, final String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }
    final Optional<UUID> entityId = resolveIdByName(entityType, fqn);
    final Optional<String> result = entityId.flatMap(id -> readDecodedBase(entityType, id));
    recordLayerOutcome(entityType, result.isPresent());
    return result;
  }

  public Optional<String> getReference(final String entityType, final UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }
    final String cacheKey = keys.entity(entityType, entityId);
    final Optional<String> result = cache.hget(cacheKey, FIELD_REF);
    recordLayerOutcome(entityType, result.isPresent());
    return result;
  }

  public Optional<String> getReferenceByName(final String entityType, final String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return Optional.empty();
    }
    final String cacheKey = keys.refByName(entityType, fqn);
    final Optional<String> result = cache.get(cacheKey);
    recordLayerOutcome(entityType, result.isPresent());
    return result;
  }

  public void invalidate(final UUID entityId, final String entityType) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    final String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateByName(final String entityType, final String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    cache.del(nameAliasKeys(entityType, fqn));
    LOG.debug("Invalidated cache for entity by name: {} -> {}", entityType, fqn);
  }

  public void invalidateEntities(final List<EntityKey> entities) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    final List<String> cacheKeys = entities.stream().flatMap(this::cacheKeysOf).toList();
    for (List<String> chunk : Lists.partition(cacheKeys, MAX_KEYS_PER_DELETE)) {
      cache.del(chunk.toArray(String[]::new));
    }
  }

  private Stream<String> cacheKeysOf(final EntityKey entity) {
    final Stream<String> nameKeys =
        entity.fqn() == null
            ? Stream.empty()
            : Stream.of(nameAliasKeys(entity.entityType(), entity.fqn()));
    return Stream.concat(Stream.of(keys.entity(entity.entityType(), entity.id())), nameKeys);
  }

  public void invalidateBase(final String entityType, final UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    final String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated base cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateReference(final String entityType, final UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    final String cacheKey = keys.entity(entityType, entityId);
    cache.hdel(cacheKey, FIELD_REF);
    LOG.debug("Invalidated reference cache for entity: {} -> {}", entityType, entityId);
  }

  public void deleteBase(final String entityType, final UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    final String cacheKey = keys.entity(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Deleted corrupted cache entry for entity: {} -> {}", entityType, entityId);
  }

  public void deleteByName(final String entityType, final String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    cache.del(nameAliasKeys(entityType, fqn));
    LOG.debug("Deleted corrupted cache entries for entity by name: {} -> {}", entityType, fqn);
  }

  public void invalidateReferenceByName(final String entityType, final String fqn) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    final String cacheKey = keys.refByName(entityType, fqn);
    cache.del(cacheKey);
    LOG.debug("Invalidated reference cache by name: {} -> {}", entityType, fqn);
  }

  private Optional<String> readDecodedBase(final String entityType, final UUID entityId) {
    final String cacheKey = keys.entity(entityType, entityId);
    final Optional<String> stored = cache.hget(cacheKey, FIELD_BASE);
    if (stored.isEmpty()) {
      return Optional.empty();
    }
    try {
      return Optional.of(CacheValueCodec.decode(stored.get()));
    } catch (IllegalArgumentException e) {
      LOG.warn("Evicting corrupted compressed entity cache entry: key={}", cacheKey, e);
      cache.del(cacheKey);
      return Optional.empty();
    }
  }

  private boolean exceedsMaxEntrySize(final String encoded) {
    return CacheValueCodec.exceedsMaxEntrySize(encoded, config.maxEntrySizeBytes);
  }

  private Optional<UUID> resolveIdByName(final String entityType, final String fqn) {
    final String aliasKey = keys.entityIdByName(entityType, fqn);
    final Optional<String> rawId = cache.get(aliasKey);
    if (rawId.isEmpty()) {
      return Optional.empty();
    }
    try {
      return Optional.of(UUID.fromString(rawId.get()));
    } catch (IllegalArgumentException e) {
      LOG.warn("Evicting malformed UUID pointer in cache: key={} value={}", aliasKey, rawId.get());
      cache.del(aliasKey);
      return Optional.empty();
    }
  }

  private String[] nameAliasKeys(final String entityType, final String fqn) {
    return new String[] {
      keys.entityIdByName(entityType, fqn),
      keys.entityByName(entityType, fqn),
      keys.refByName(entityType, fqn)
    };
  }

  private Duration entityTtl() {
    return Duration.ofSeconds(config.entityTtlSeconds);
  }

  private static boolean isEmptyEntityJson(final String entityJson) {
    return nullOrEmpty(entityJson) || EMPTY_JSON_OBJECT.equals(entityJson);
  }

  private static void recordLayerOutcome(final String entityType, final boolean hit) {
    final CacheMetrics metrics = CacheMetrics.getInstance();
    if (metrics == null) {
      return;
    }
    if (hit) {
      metrics.recordLayerHit(entityType);
    } else {
      metrics.recordLayerMiss(entityType);
    }
  }
}
