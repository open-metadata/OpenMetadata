package org.openmetadata.service.cache;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
@RequiredArgsConstructor
public class CachedTagUsageDao {
  private final CollectionDAO dao;
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  /**
   * Write-through cache: Store tags
   */
  public void putTags(String entityType, UUID entityId, String tagsJson) {
    if (tagsJson == null || tagsJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.tags(entityType, entityId);
    try {
      cache.set(cacheKey, tagsJson, Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached tags for: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache tags: {} -> {}", entityType, entityId, e);
    }
  }

  public void invalidateTags(String entityType, UUID entityId) {
    String cacheKey = keys.tags(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated cache for Tags: {} -> {}", entityType, entityId);
  }

  /**
   * Get tags from cache
   */
  public List<TagLabel> getTags(String entityType, UUID entityId) {
    String cacheKey = keys.tags(entityType, entityId);
    Optional<String> cached = cache.get(cacheKey);
    if (cached.isEmpty()) {
      LOG.debug("Cache miss for Tags: {} -> {}", entityType, entityId);
      return null;
    }
    return JsonUtils.readObjects(cached.get(), TagLabel.class);
  }
}
