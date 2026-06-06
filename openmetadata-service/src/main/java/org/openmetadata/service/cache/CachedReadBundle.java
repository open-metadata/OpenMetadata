package org.openmetadata.service.cache;

import com.google.common.util.concurrent.Striped;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Cache for the relationship/tag bundle attached to a single entity read.
 *
 * <p>A GET of an entity triggers {@code buildReadBundle} which fans out to ~3 DB queries (TO
 * relationships, FROM relationships, tag_usage). This cache collapses that to a single Redis GET
 * when the bundle is warm. Only the {@code NON_DELETED} include is cached — {@code DELETED}/
 * {@code ALL} requests are rare and fall through to the DB path.
 *
 * <p>Single-flight uses an in-process {@link Striped} lock keyed by (type, id). Waiters block
 * briefly on the lock instead of busy-polling Redis, and the holder's populate happens under the
 * lock so re-checkers see it immediately on acquire. Cross-instance coordination is skipped on
 * purpose — Redis {@code SET} is idempotent, so independent instances racing on a cold miss each
 * produce the same bundle and write converges.
 */
@Slf4j
public class CachedReadBundle {
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;
  private final Striped<Lock> loadLocks;

  public CachedReadBundle(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keys = keys;
    this.config = config;
    this.loadLocks = Striped.lazyWeakLock(Math.max(16, config.bundleLoadLockStripes));
  }

  /** Serializable view of the fraction of {@link org.openmetadata.service.jdbi3.ReadBundle} we cache. */
  public static class Dto {
    public Map<String, List<EntityReference>> relations;
    public List<TagLabel> tags;
    public boolean tagsLoaded;
    public AssetCertification certification;
    public boolean certificationLoaded;
  }

  /**
   * Batch fetch — pipelined Redis GETs aligned 1:1 with the input ids. Useful for prefetch
   * scenarios where a caller knows it's about to touch a list of entities and wants one
   * round-trip instead of N. The returned list has {@code null} entries where the cache was
   * cold OR where the cache itself is disabled (the layer falls back to single-entity gets
   * via {@link CacheProvider#mget}'s default).
   *
   * <p>Caller-side use: pre-warming for a list-then-detail navigation pattern; UI prefetch
   * on hover. The list endpoint hot path itself doesn't go through this layer (list responses
   * are SQL-batched in {@link org.openmetadata.service.jdbi3.EntityRepository#setFieldsInBulk}),
   * so this method is mostly a primitive for future paths to leverage.
   */
  public java.util.List<Dto> getBatch(String entityType, java.util.List<UUID> entityIds) {
    if (entityIds == null || entityIds.isEmpty()) {
      return java.util.Collections.emptyList();
    }
    // Bypass = "treat every position as a miss" rather than an empty list. Callers index
    // the returned list by position (parallel to entityIds); returning size 0 here would
    // silently shift their hydration loop off the rails. The 1:1 contract takes precedence
    // over the cheap empty-list short-circuit.
    if (EntityCacheBypass.isSkipped()) {
      java.util.List<Dto> out = new java.util.ArrayList<>(entityIds.size());
      for (int i = 0; i < entityIds.size(); i++) {
        out.add(null);
      }
      return out;
    }
    java.util.List<String> cacheKeys = new java.util.ArrayList<>(entityIds.size());
    for (UUID id : entityIds) {
      cacheKeys.add(id == null ? null : keys.bundle(entityType, id));
    }
    java.util.List<Optional<String>> raw = cache.mget(cacheKeys);
    java.util.List<Dto> out = new java.util.ArrayList<>(entityIds.size());
    String layerType = bundleType(entityType);
    CacheMetrics m = CacheMetrics.getInstance();
    for (int i = 0; i < entityIds.size(); i++) {
      Optional<String> json = i < raw.size() ? raw.get(i) : Optional.empty();
      if (json.isEmpty()) {
        out.add(null);
        if (m != null) m.recordLayerMiss(layerType);
        continue;
      }
      try {
        out.add(JsonUtils.readValue(json.get(), Dto.class));
        if (m != null) m.recordLayerHit(layerType);
      } catch (Exception e) {
        // Bad cache entry — evict and treat as miss for this position.
        try {
          cache.del(cacheKeys.get(i));
        } catch (Exception ignored) {
          // best-effort
        }
        out.add(null);
        if (m != null) m.recordError();
      }
    }
    return out;
  }

  public Dto get(String entityType, UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return null;
    }
    String key = keys.bundle(entityType, entityId);
    String layerType = bundleType(entityType);
    CacheMetrics m = CacheMetrics.getInstance();
    try {
      Optional<String> json = cache.get(key);
      if (json.isEmpty()) {
        if (m != null) m.recordLayerMiss(layerType);
        return null;
      }
      Dto dto = JsonUtils.readValue(json.get(), Dto.class);
      if (m != null) m.recordLayerHit(layerType);
      return dto;
    } catch (Exception e) {
      LOG.warn("Bad bundle cache entry, evicting: {} {}", entityType, entityId, e);
      cache.del(key);
      if (m != null) m.recordError();
      return null;
    }
  }

  public void put(String entityType, UUID entityId, Dto dto) {
    if (dto == null || EntityCacheBypass.isSkipped()) {
      return;
    }
    String key = keys.bundle(entityType, entityId);
    try {
      String json = JsonUtils.pojoToJson(dto);
      cache.set(key, json, Duration.ofSeconds(config.entityTtlSeconds));
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) m.recordLayerWrite(bundleType(entityType));
    } catch (Exception e) {
      LOG.warn("Failed to cache read bundle: {} {}", entityType, entityId, e);
    }
  }

  /**
   * Tag the bundle layer's per-type counters with a {@code bundle:<entityType>} prefix so they
   * sort separately from the entity-cache counters in {@code /cache/stats}. Without the prefix a
   * bundle hit on table and an entity hit on table would merge — operators couldn't tell which
   * layer is doing the work.
   */
  private static String bundleType(String entityType) {
    return "bundle:" + entityType;
  }

  public void invalidate(String entityType, UUID entityId) {
    if (EntityCacheBypass.isSkipped()) {
      return;
    }
    cache.del(keys.bundle(entityType, entityId));
  }

  /**
   * Get the in-process load lock for a specific entity. Callers run their cache-check + DB-load +
   * cache-populate sequence under this lock so concurrent readers of the same entity collapse to
   * one DB hit. Returns a {@link Lock} the caller must {@code lock()} / {@code unlock()} — the
   * caller controls the blocking window because the lock acquisition happens outside of any
   * tracing phase.
   */
  public Lock loadLockFor(String entityType, UUID entityId) {
    return loadLocks.get(entityType + ":" + entityId);
  }
}
