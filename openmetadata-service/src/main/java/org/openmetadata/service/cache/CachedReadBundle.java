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

  public Dto get(String entityType, UUID entityId) {
    String key = keys.bundle(entityType, entityId);
    try {
      Optional<String> json = cache.get(key);
      if (json.isEmpty()) {
        return null;
      }
      return JsonUtils.readValue(json.get(), Dto.class);
    } catch (Exception e) {
      LOG.warn("Bad bundle cache entry, evicting: {} {}", entityType, entityId, e);
      cache.del(key);
      return null;
    }
  }

  public void put(String entityType, UUID entityId, Dto dto) {
    if (dto == null) {
      return;
    }
    String key = keys.bundle(entityType, entityId);
    try {
      String json = JsonUtils.pojoToJson(dto);
      cache.set(key, json, Duration.ofSeconds(config.entityTtlSeconds));
    } catch (Exception e) {
      LOG.warn("Failed to cache read bundle: {} {}", entityType, entityId, e);
    }
  }

  public void invalidate(String entityType, UUID entityId) {
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
