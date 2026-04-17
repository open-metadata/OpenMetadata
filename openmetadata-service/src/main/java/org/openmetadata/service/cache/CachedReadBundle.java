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
}
