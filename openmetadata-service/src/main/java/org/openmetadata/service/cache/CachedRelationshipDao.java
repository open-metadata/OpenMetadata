package org.openmetadata.service.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
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

  public List<EntityReference> getOwners(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    try {
      Optional<String> cached = cache.hget(cacheKey, "owners");
      if (cached.isPresent()) {
        return JsonUtils.readValue(cached.get(), ENTITY_REF_LIST_TYPE);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get cached owners: {} -> {}", entityType, entityId, e);
    }
    return null;
  }

  public List<EntityReference> getDomains(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    try {
      Optional<String> cached = cache.hget(cacheKey, "domains");
      if (cached.isPresent()) {
        return JsonUtils.readValue(cached.get(), ENTITY_REF_LIST_TYPE);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get cached domains: {} -> {}", entityType, entityId, e);
    }
    return null;
  }

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
    Relationship[] relationships = Relationship.values();
    String[] cacheKeys = new String[relationships.length * 2];
    int i = 0;
    for (Relationship rel : relationships) {
      cacheKeys[i++] = keys.rel(entityType, entityId, rel.name(), "IN");
      cacheKeys[i++] = keys.rel(entityType, entityId, rel.name(), "OUT");
    }
    cache.del(cacheKeys);
    LOG.debug("Invalidated all relationship caches for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateOwners(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    cache.hdel(cacheKey, "owners");
    LOG.debug("Invalidated owners cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateDomains(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    cache.hdel(cacheKey, "domains");
    LOG.debug("Invalidated domains cache for entity: {} -> {}", entityType, entityId);
  }
}
