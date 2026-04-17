package org.openmetadata.service.cache;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 */
@Slf4j
@RequiredArgsConstructor
public class CachedReadBundle {
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  /** Serializable view of the fraction of {@link org.openmetadata.service.jdbi3.ReadBundle} we cache. */
  public static class Dto {
    public Map<String, List<EntityReference>> relations;
    public List<TagLabel> tags;
    public boolean tagsLoaded;
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
    if (dto == null || (dto.relations == null && !dto.tagsLoaded)) {
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
   * Attempt to claim a single-flight load lock for this bundle. Returns true if the caller should
   * proceed to load from DB and populate; false if another caller already holds the lock.
   *
   * <p>Lock TTL ({@code loadLockTtlMs}) guarantees that if the holder crashes, waiters can retake
   * the lock after the TTL. Callers must pair a successful claim with {@link #releaseLoadLock}.
   */
  public boolean tryAcquireLoadLock(String entityType, UUID entityId) {
    return cache.setIfAbsent(
        loadLockKey(entityType, entityId), "1", Duration.ofMillis(config.loadLockTtlMs));
  }

  public void releaseLoadLock(String entityType, UUID entityId) {
    cache.del(loadLockKey(entityType, entityId));
  }

  /**
   * Poll for a concurrent load to publish the bundle. Used by waiters that lost the
   * {@link #tryAcquireLoadLock} race. Returns the populated Dto on hit, or {@code null} after a
   * short budget — in which case the caller should fall through to its own DB load.
   */
  public Dto waitForConcurrentLoad(String entityType, UUID entityId) {
    long deadlineNs = System.nanoTime() + config.loadLockWaitMs * 1_000_000L;
    while (System.nanoTime() < deadlineNs) {
      try {
        Thread.sleep(Math.min(25L, config.loadLockWaitMs));
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return null;
      }
      Dto dto = get(entityType, entityId);
      if (dto != null) {
        return dto;
      }
    }
    return null;
  }

  private String loadLockKey(String entityType, UUID entityId) {
    return keys.bundle(entityType, entityId) + ":loading";
  }
}
