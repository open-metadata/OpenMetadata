package org.openmetadata.service.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
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

  private static final TypeReference<List<TagLabel>> TAG_LIST_TYPE =
      new TypeReference<List<TagLabel>>() {};

  public List<TagLabel> getEntityTags(UUID entityId, String entityType) {
    String cacheKey = keys.tags(entityType, entityId);

    Optional<String> cached = cache.get(cacheKey);
    if (cached.isPresent()) {
      LOG.debug("Cache hit for entity tags: {} -> {}", entityType, entityId);
      return JsonUtils.readValue(cached.get(), TAG_LIST_TYPE);
    }

    LOG.debug("Cache miss for entity tags: {} -> {}", entityType, entityId);
    // For now, return empty list - actual implementation needs proper tag fetching
    return Collections.emptyList();
  }

  public List<TagLabel> getColumnTags(UUID entityId, String entityType, String columnFqn) {
    String cacheKey = keys.ctags(entityType, entityId, columnFqn);

    Optional<String> cached = cache.get(cacheKey);
    if (cached.isPresent()) {
      LOG.debug("Cache hit for column tags: {} -> {} -> {}", entityType, entityId, columnFqn);
      return JsonUtils.readValue(cached.get(), TAG_LIST_TYPE);
    }

    LOG.debug("Cache miss for column tags: {} -> {} -> {}", entityType, entityId, columnFqn);
    // For now, return empty list - actual implementation needs proper tag fetching
    return Collections.emptyList();
  }

  /**
   * Write-through cache: Store tags for entity
   */
  public void putTags(String entityType, UUID entityId, String tagsJson) {
    if (tagsJson == null || tagsJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(cacheKey, Map.of("tags", tagsJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached tags for: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache tags: {} -> {}", entityType, entityId, e);
    }
  }

  public void invalidate(UUID entityId, String entityType) {
    String cacheKey = keys.tags(entityType, entityId);
    cache.del(cacheKey);
    LOG.debug("Invalidated tag cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateColumn(UUID entityId, String entityType, String columnFqn) {
    String cacheKey = keys.ctags(entityType, entityId, columnFqn);
    cache.del(cacheKey);
    LOG.debug("Invalidated column tag cache: {} -> {} -> {}", entityType, entityId, columnFqn);
  }

  public void invalidateTags(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    // Remove just the tags field from the hash
    cache.hdel(cacheKey, "tags");
    LOG.debug("Invalidated tags cache for entity: {} -> {}", entityType, entityId);
  }
}
