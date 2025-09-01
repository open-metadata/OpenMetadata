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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
@RequiredArgsConstructor
public class CachedRelationshipDao {
  private final CollectionDAO dao;
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  private static final TypeReference<List<EntityReference>> ENTITY_REF_LIST_TYPE =
      new TypeReference<List<EntityReference>>() {};

  public List<EntityReference> list(
      UUID entityId, String entityType, String relType, String direction) {
    String cacheKey = keys.rel(entityType, entityId, relType, direction);

    Optional<String> cached = cache.get(cacheKey);
    if (cached.isPresent()) {
      LOG.debug(
          "Cache hit for relationships: {} -> {} -> {} -> {}",
          entityType,
          entityId,
          relType,
          direction);
      return JsonUtils.readValue(cached.get(), ENTITY_REF_LIST_TYPE);
    }

    LOG.debug(
        "Cache miss for relationships: {} -> {} -> {} -> {}",
        entityType,
        entityId,
        relType,
        direction);

    // For now, return empty list - actual implementation needs proper relationship fetching
    return Collections.emptyList();
  }

  /**
   * Write-through cache: Store owners relationship
   */
  public void putOwners(String entityType, UUID entityId, String ownersJson) {
    if (ownersJson == null || ownersJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(
          cacheKey, Map.of("owners", ownersJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached owners for: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache owners: {} -> {}", entityType, entityId, e);
    }
  }

  /**
   * Write-through cache: Store domains relationship
   */
  public void putDomains(String entityType, UUID entityId, String domainsJson) {
    if (domainsJson == null || domainsJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(
          cacheKey, Map.of("domains", domainsJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached domains for: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache domains: {} -> {}", entityType, entityId, e);
    }
  }

  public void invalidate(UUID entityId, String entityType) {
    // Invalidate all relationship caches for this entity
    for (String relType : List.of("contains", "owns", "uses")) {
      for (String direction : List.of("IN", "OUT")) {
        String cacheKey = keys.rel(entityType, entityId, relType, direction);
        cache.del(cacheKey);
      }
    }
    LOG.debug("Invalidated relationship caches for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateOwners(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    // Remove just the owners field from the hash
    cache.hdel(cacheKey, "owners");
    LOG.debug("Invalidated owners cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateDomains(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    // Remove just the domains field from the hash
    cache.hdel(cacheKey, "domains");
    LOG.debug("Invalidated domains cache for entity: {} -> {}", entityType, entityId);
  }
}
