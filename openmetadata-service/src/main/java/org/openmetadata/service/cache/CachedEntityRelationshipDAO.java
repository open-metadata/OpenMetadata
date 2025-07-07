package org.openmetadata.service.cache;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipCount;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;

/**
 * Cached decorator for EntityRelationshipDAO that provides write-through caching
 * for entity relationships using Redis cache.
 * This decorator intercepts read operations and checks the cache first, falling back
 * to database queries when needed. Write operations update both the database and cache.
 */
@Slf4j
public class CachedEntityRelationshipDAO implements CollectionDAO.EntityRelationshipDAO {

  private final CollectionDAO.EntityRelationshipDAO delegate;
  private static final String CACHE_KEY_PREFIX = "relationships:";
  private static final String FIND_TO_KEY = "findTo";
  private static final String FIND_FROM_KEY = "findFrom";
  private static final String TIMESTAMP = "timestamp";
  private static final String PREFETCHED = "prefetched";
  private static final String RELATIONSHIPS = "relationships";

  private static final Executor PREFETCH_EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

  public CachedEntityRelationshipDAO(CollectionDAO.EntityRelationshipDAO delegate) {
    this.delegate = delegate;
  }

  private String createEntityCacheKey(String entityId, String entityType) {
    return CACHE_KEY_PREFIX + entityType + ":" + entityId;
  }

  private String createRelationshipCacheKey(
      String entityId, String entityType, String operation, String relationKey) {
    return CACHE_KEY_PREFIX + entityType + ":" + entityId + ":" + operation + ":" + relationKey;
  }

  private void evictEntityFromCache(UUID entityId, String entityType) {
    if (RelationshipCache.isAvailable() && entityId != null && entityType != null) {
      String cacheKey = createEntityCacheKey(entityId.toString(), entityType);
      RelationshipCache.evict(cacheKey);
      LOG.debug("Evicted cache for entity: {} ({})", entityId, entityType);
    }
  }

  @Override
  public void insert(
      UUID fromId, UUID toId, String fromEntity, String toEntity, int relation, String json) {
    delegate.insert(fromId, toId, fromEntity, toEntity, relation, json);

    evictEntityFromCache(fromId, fromEntity);
    evictEntityFromCache(toId, toEntity);

    LOG.debug(
        "Inserted relationship and evicted cache: {} ({}) -> {} ({}), relation: {}",
        fromId,
        fromEntity,
        toId,
        toEntity,
        relation);
  }

  @Override
  public void bulkInsertTo(List<EntityRelationshipObject> values) {
    delegate.bulkInsertTo(values);

    Set<String> evictedKeys = new HashSet<>();
    for (EntityRelationshipObject obj : values) {
      String fromKey = createEntityCacheKey(obj.getFromId(), obj.getFromEntity());
      String toKey = createEntityCacheKey(obj.getToId(), obj.getToEntity());

      if (evictedKeys.add(fromKey)) {
        RelationshipCache.evict(fromKey);
      }
      if (evictedKeys.add(toKey)) {
        RelationshipCache.evict(toKey);
      }
    }

    LOG.debug(
        "Bulk inserted {} relationships and evicted {} cache entries",
        values.size(),
        evictedKeys.size());
  }

  @Override
  public List<EntityRelationshipRecord> findTo(
      UUID fromId, String fromEntity, List<Integer> relation) {
    if (!RelationshipCache.isAvailable()) {
      return delegate.findTo(fromId, fromEntity, relation);
    }

    String cacheKey =
        createRelationshipCacheKey(fromId.toString(), fromEntity, FIND_TO_KEY, relation.toString());

    try {
      Map<String, Object> cached = RelationshipCache.get(cacheKey);
      if (cached.containsKey(RELATIONSHIPS)) {
        Object data = cached.get(RELATIONSHIPS);
        if (data instanceof List) {
          @SuppressWarnings("unchecked")
          List<EntityRelationshipRecord> cachedResults = (List<EntityRelationshipRecord>) data;
          boolean isPrefetched = cached.containsKey(PREFETCHED) && (Boolean) cached.get(PREFETCHED);
          LOG.debug(
              "Cache hit{} for findTo: {} ({}), relations: {}",
              isPrefetched ? " (prefetched)" : "",
              fromId,
              fromEntity,
              relation);
          return cachedResults;
        }
      }
    } catch (Exception e) {
      LOG.warn("Error reading from cache for findTo: {} ({})", fromId, fromEntity, e);
    }

    List<EntityRelationshipRecord> results = delegate.findTo(fromId, fromEntity, relation);

    try {
      Map<String, Object> cacheData = new HashMap<>();
      cacheData.put(RELATIONSHIPS, results);
      cacheData.put(TIMESTAMP, System.currentTimeMillis());
      RelationshipCache.put(cacheKey, cacheData);
      LOG.debug(
          "Cache miss - stored findTo results: {} ({}), relations: {}, count: {}",
          fromId,
          fromEntity,
          relation,
          results.size());

      // Trigger simple background prefetching for this entity
      triggerSimplePrefetch(fromId, fromEntity);

    } catch (Exception e) {
      LOG.warn("Error caching findTo results: {} ({})", fromId, fromEntity, e);
    }

    return results;
  }

  @Override
  public List<EntityRelationshipObject> findToBatch(
      List<String> fromIds, int relation, String fromEntityType, String toEntityType) {
    return delegate.findToBatch(fromIds, relation, fromEntityType, toEntityType);
  }

  @Override
  public List<EntityRelationshipObject> findToBatch(
      List<String> fromIds, int relation, String toEntityType) {
    return delegate.findToBatch(fromIds, relation, toEntityType);
  }

  @Override
  public List<EntityRelationshipObject> findToBatchAllTypesWithCondition(
      List<String> fromIds, int relation, String condition) {
    return delegate.findToBatchAllTypesWithCondition(fromIds, relation, condition);
  }

  @Override
  public List<EntityRelationshipObject> findToBatchWithCondition(
      List<String> fromIds, int relation, String toEntityType, String condition) {
    return delegate.findToBatchWithCondition(fromIds, relation, toEntityType, condition);
  }

  @Override
  public List<EntityRelationshipRecord> findTo(
      UUID fromId, String fromEntity, int relation, String toEntity) {
    return findTo(fromId, fromEntity, List.of(relation));
  }

  @Override
  public List<UUID> findToIds(UUID fromId, String fromEntity, int relation, String toEntity) {
    return delegate.findToIds(fromId, fromEntity, relation, toEntity);
  }

  @Override
  public List<EntityRelationshipCount> countFindTo(
      List<String> fromIds, String fromEntity, int relation, String toEntity) {
    return delegate.countFindTo(fromIds, fromEntity, relation, toEntity);
  }

  @Override
  public int countFindTo(UUID fromId, String fromEntity, List<Integer> relation) {
    return delegate.countFindTo(fromId, fromEntity, relation);
  }

  @Override
  public List<EntityRelationshipRecord> findToWithOffset(
      UUID fromId, String fromEntity, List<Integer> relation, int offset, int limit) {
    return delegate.findToWithOffset(fromId, fromEntity, relation, offset, limit);
  }

  @Override
  public List<EntityRelationshipRecord> findToPipeline(UUID fromId, int relation) {
    return delegate.findToPipeline(fromId, relation);
  }

  @Override
  public List<EntityRelationshipRecord> findFrom(
      UUID toId, String toEntity, int relation, String fromEntity) {
    if (!RelationshipCache.isAvailable()) {
      return delegate.findFrom(toId, toEntity, relation, fromEntity);
    }

    String cacheKey =
        createRelationshipCacheKey(
            toId.toString(), toEntity, FIND_FROM_KEY, relation + ":" + fromEntity);

    try {
      Map<String, Object> cached = RelationshipCache.get(cacheKey);
      if (cached.containsKey(RELATIONSHIPS)) {
        Object data = cached.get(RELATIONSHIPS);
        if (data instanceof List) {
          @SuppressWarnings("unchecked")
          List<EntityRelationshipRecord> cachedResults = (List<EntityRelationshipRecord>) data;
          boolean isPrefetched = cached.containsKey(PREFETCHED) && (Boolean) cached.get(PREFETCHED);
          LOG.debug(
              "Cache hit{} for findFrom: {} ({}), relation: {}, fromEntity: {}",
              isPrefetched ? " (prefetched)" : "",
              toId,
              toEntity,
              relation,
              fromEntity);
          return cachedResults;
        }
      }
    } catch (Exception e) {
      LOG.warn("Error reading from cache for findFrom: {} ({})", toId, toEntity, e);
    }

    List<EntityRelationshipRecord> results =
        delegate.findFrom(toId, toEntity, relation, fromEntity);

    try {
      Map<String, Object> cacheData = new HashMap<>();
      cacheData.put(RELATIONSHIPS, results);
      cacheData.put(TIMESTAMP, System.currentTimeMillis());
      RelationshipCache.put(cacheKey, cacheData);
      LOG.debug(
          "Cache miss - stored findFrom results: {} ({}), relation: {}, fromEntity: {}, count: {}",
          toId,
          toEntity,
          relation,
          fromEntity,
          results.size());

      triggerSimplePrefetch(toId, toEntity);

    } catch (Exception e) {
      LOG.warn("Error caching findFrom results: {} ({})", toId, toEntity, e);
    }

    return results;
  }

  @Override
  public List<EntityRelationshipObject> findFromBatch(List<String> toIds, int relation) {
    return delegate.findFromBatch(toIds, relation);
  }

  @Override
  public List<EntityRelationshipObject> findFromBatch(
      List<String> toIds, int relation, String fromEntityType) {
    return delegate.findFromBatch(toIds, relation, fromEntityType);
  }

  @Override
  public List<EntityRelationshipObject> findFromBatch(
      List<String> toIds, String toEntityType, int relation) {
    return delegate.findFromBatch(toIds, toEntityType, relation);
  }

  @Override
  public List<EntityRelationshipObject> findFromBatch(
      List<String> toIds, int relation, Include include) {
    return delegate.findFromBatch(toIds, relation, include);
  }

  @Override
  public List<EntityRelationshipRecord> findFrom(UUID toId, String toEntity, int relation) {
    return delegate.findFrom(toId, toEntity, relation);
  }

  @Override
  public List<EntityRelationshipObject> findFromBatch(
      List<String> toIds, int relation, String fromEntityType, String toEntityType) {
    return delegate.findFromBatch(toIds, relation, fromEntityType, toEntityType);
  }

  @Override
  public List<EntityRelationshipObject> findFromBatchWithCondition(
      List<String> toIds, int relation, String condition) {
    // For the 3-parameter version, we can't cache as effectively without entity type
    // So we'll delegate directly to avoid incorrect caching
    return delegate.findFromBatchWithCondition(toIds, relation, condition);
  }

  @Override
  public List<EntityRelationshipObject> findFromBatchWithEntityTypeAndCondition(
      List<String> toIds, int relation, String fromEntityType, String condition) {
    if (!RelationshipCache.isAvailable() || toIds == null || toIds.isEmpty()) {
      return delegate.findFromBatchWithEntityTypeAndCondition(
          toIds, relation, fromEntityType, condition);
    }

    CacheCheckResult cacheResult = checkCacheForBatch(toIds, relation, fromEntityType, condition);

    if (cacheResult.uncachedIds.isEmpty()) {
      LOG.debug("All {} entities found in cache", toIds.size());
      return cacheResult.cachedResults;
    }

    List<EntityRelationshipObject> dbResults =
        fetchAndCacheResults(cacheResult.uncachedIds, relation, fromEntityType, condition);

    cacheResult.cachedResults.addAll(dbResults);
    LOG.debug(
        "findFromBatchWithEntityTypeAndCondition: {} cached, {} from DB, {} total results",
        toIds.size() - cacheResult.uncachedIds.size(),
        cacheResult.uncachedIds.size(),
        cacheResult.cachedResults.size());

    return cacheResult.cachedResults;
  }

  private CacheCheckResult checkCacheForBatch(
      List<String> toIds, int relation, String fromEntityType, String condition) {
    List<EntityRelationshipObject> cachedResults = new ArrayList<>();
    List<String> uncachedIds = new ArrayList<>();

    for (String toId : toIds) {
      String cacheKey = buildBatchCacheKey(toId, relation, fromEntityType, condition);
      List<EntityRelationshipObject> cached =
          getCachedRelationships(cacheKey, toId, relation, fromEntityType);

      if (cached != null) {
        cachedResults.addAll(cached);
      } else {
        uncachedIds.add(toId);
      }
    }

    return new CacheCheckResult(cachedResults, uncachedIds);
  }

  private String buildBatchCacheKey(
      String toId, int relation, String fromEntityType, String condition) {
    return createRelationshipCacheKey(
        toId,
        "*",
        "findFromWithTypeCond",
        relation
            + ":"
            + fromEntityType
            + ":"
            + (condition != null ? condition.hashCode() : "null"));
  }

  private List<EntityRelationshipObject> getCachedRelationships(
      String cacheKey, String toId, int relation, String fromEntityType) {
    try {
      Map<String, Object> cached = RelationshipCache.get(cacheKey);
      if (cached.containsKey(RELATIONSHIPS)) {
        Object data = cached.get(RELATIONSHIPS);
        if (data instanceof List) {
          @SuppressWarnings("unchecked")
          List<EntityRelationshipObject> relationships = (List<EntityRelationshipObject>) data;
          LOG.debug(
              "Cache hit for entity {} with relation {}, fromType {}",
              toId,
              relation,
              fromEntityType);
          return relationships;
        }
      }
    } catch (Exception e) {
      LOG.warn("Error reading from cache for entity {}: {}", toId, e.getMessage());
    }
    return null;
  }

  private List<EntityRelationshipObject> fetchAndCacheResults(
      List<String> uncachedIds, int relation, String fromEntityType, String condition) {
    List<EntityRelationshipObject> dbResults =
        delegate.findFromBatchWithEntityTypeAndCondition(
            uncachedIds, relation, fromEntityType, condition);

    Map<String, List<EntityRelationshipObject>> resultsByToId =
        dbResults.stream().collect(Collectors.groupingBy(EntityRelationshipObject::getToId));

    for (String toId : uncachedIds) {
      List<EntityRelationshipObject> relationships =
          resultsByToId.getOrDefault(toId, Collections.emptyList());
      cacheRelationships(toId, relationships, relation, fromEntityType, condition);
    }

    return dbResults;
  }

  private void cacheRelationships(
      String toId,
      List<EntityRelationshipObject> relationships,
      int relation,
      String fromEntityType,
      String condition) {
    String cacheKey = buildBatchCacheKey(toId, relation, fromEntityType, condition);

    try {
      Map<String, Object> cacheData = new HashMap<>();
      cacheData.put(RELATIONSHIPS, relationships);
      cacheData.put(TIMESTAMP, System.currentTimeMillis());
      RelationshipCache.put(cacheKey, cacheData);
      LOG.debug("Cached {} relationships for entity {}", relationships.size(), toId);
    } catch (Exception e) {
      LOG.warn("Error caching relationships for entity {}: {}", toId, e.getMessage());
    }
  }

  private static class CacheCheckResult {
    final List<EntityRelationshipObject> cachedResults;
    final List<String> uncachedIds;

    CacheCheckResult(List<EntityRelationshipObject> cachedResults, List<String> uncachedIds) {
      this.cachedResults = cachedResults;
      this.uncachedIds = uncachedIds;
    }
  }

  @Override
  public List<EntityRelationshipRecord> findFromPipeline(UUID toId, int relation) {
    return delegate.findFromPipeline(toId, relation);
  }

  // ==========================================
  // SPECIALIZED QUERY OPERATIONS
  // ==========================================

  @Override
  public List<EntityRelationshipObject> findDownstreamDomains(UUID fromId, String fromEntity) {
    return delegate.findDownstreamDomains(fromId, fromEntity);
  }

  @Override
  public List<EntityRelationshipObject> findUpstreamDomains(UUID toId, String toEntity) {
    return delegate.findUpstreamDomains(toId, toEntity);
  }

  @Override
  public Integer countDomainChildAssets(UUID fromDomainId, UUID toDomainId) {
    return delegate.countDomainChildAssets(fromDomainId, toDomainId);
  }

  @Override
  public List<EntityRelationshipObject> findDownstreamDataProducts(UUID fromId, String fromEntity) {
    return delegate.findDownstreamDataProducts(fromId, fromEntity);
  }

  @Override
  public List<EntityRelationshipObject> findUpstreamDataProducts(UUID toId, String toEntity) {
    return delegate.findUpstreamDataProducts(toId, toEntity);
  }

  @Override
  public Integer countDataProductsChildAssets(UUID fromDataProductId, UUID toDataProductId) {
    return delegate.countDataProductsChildAssets(fromDataProductId, toDataProductId);
  }

  @Override
  public List<EntityRelationshipObject> findLineageBySource(
      UUID toId, String toEntity, String source, int relation) {
    return delegate.findLineageBySource(toId, toEntity, source, relation);
  }

  @Override
  public List<EntityRelationshipObject> findLineageBySourcePipeline(
      UUID toId, String toEntity, String source, int relation) {
    return delegate.findLineageBySourcePipeline(toId, toEntity, source, relation);
  }

  @Override
  public int findIfAnyRelationExist(String fromEntity, String toEntity) {
    return delegate.findIfAnyRelationExist(fromEntity, toEntity);
  }

  @Override
  public String getRelation(UUID fromId, UUID toId, int relation) {
    return delegate.getRelation(fromId, toId, relation);
  }

  @Override
  public EntityRelationshipObject getRecord(UUID fromId, UUID toId, int relation) {
    return delegate.getRecord(fromId, toId, relation);
  }

  @Override
  public List<EntityRelationshipObject> getRecordWithOffset(int relation, long offset, int limit) {
    return delegate.getRecordWithOffset(relation, offset, limit);
  }

  @Override
  public List<EntityRelationshipObject> getAllRelationshipsPaginated(long offset, int limit) {
    return delegate.getAllRelationshipsPaginated(offset, limit);
  }

  @Override
  public long getTotalRelationshipCount() {
    return delegate.getTotalRelationshipCount();
  }

  @Override
  public int delete(UUID fromId, String fromEntity, UUID toId, String toEntity, int relation) {
    int deleted = delegate.delete(fromId, fromEntity, toId, toEntity, relation);

    if (deleted > 0) {
      evictEntityFromCache(fromId, fromEntity);
      evictEntityFromCache(toId, toEntity);
      LOG.debug(
          "Deleted relationship and evicted cache: {} ({}) -> {} ({}), relation: {}",
          fromId,
          fromEntity,
          toId,
          toEntity,
          relation);
    }

    return deleted;
  }

  @Override
  public void deleteFrom(UUID fromId, String fromEntity, int relation, String toEntity) {
    delegate.deleteFrom(fromId, fromEntity, relation, toEntity);
    evictEntityFromCache(fromId, fromEntity);
    LOG.debug("Deleted relationships from {} ({}) and evicted cache", fromId, fromEntity);
  }

  @Override
  public void deleteTo(UUID toId, String toEntity, int relation, String fromEntity) {
    delegate.deleteTo(toId, toEntity, relation, fromEntity);
    evictEntityFromCache(toId, toEntity);
    LOG.debug("Deleted relationships to {} ({}) and evicted cache", toId, toEntity);
  }

  @Override
  public void deleteTo(UUID toId, String toEntity, int relation) {
    delegate.deleteTo(toId, toEntity, relation);
    evictEntityFromCache(toId, toEntity);
    LOG.debug("Deleted relationships to {} ({}) and evicted cache", toId, toEntity);
  }

  @Override
  public void deleteAll(UUID id, String entity) {
    delegate.deleteAll(id, entity);
    evictEntityFromCache(id, entity);
    LOG.debug("Deleted all relationships for {} ({}) and evicted cache", id, entity);
  }

  @Override
  public void deleteAllByThreadIds(List<String> ids, String entity) {
    delegate.deleteAllByThreadIds(ids, entity);
    for (String id : ids) {
      evictEntityFromCache(UUID.fromString(id), entity);
    }
    LOG.debug("Deleted all relationships for {} ({}) and evicted cache", ids, entity);
  }

  @Override
  public void deleteAllWithId(UUID id) {
    delegate.deleteAllWithId(id);
    LOG.debug("Deleted all relationships for entity ID: {} - consider broader cache eviction", id);
  }

  @Override
  public void deleteLineageBySource(UUID toId, String toEntity, String source, int relation) {
    delegate.deleteLineageBySource(toId, toEntity, source, relation);
    evictEntityFromCache(toId, toEntity);
    LOG.debug("Deleted lineage by source for {} ({}) and evicted cache", toId, toEntity);
  }

  @Override
  public void deleteLineageBySourcePipeline(UUID toId, String source, int relation) {
    delegate.deleteLineageBySourcePipeline(toId, source, relation);
    // Without knowing the entity type, we use a generic eviction
    if (RelationshipCache.isAvailable()) {
      RelationshipCache.evict(CACHE_KEY_PREFIX + toId.toString());
    }
    LOG.debug("Deleted lineage by source pipeline for entity ID: {}", toId);
  }

  @Override
  public void bulkRemoveTo(
      UUID fromId, List<String> toIds, String fromEntity, String toEntity, int relation) {
    delegate.bulkRemoveTo(fromId, toIds, fromEntity, toEntity, relation);

    // Evict cache for the from entity and all to entities
    evictEntityFromCache(fromId, fromEntity);
    for (String toIdStr : toIds) {
      try {
        UUID toId = UUID.fromString(toIdStr);
        evictEntityFromCache(toId, toEntity);
      } catch (IllegalArgumentException e) {
        LOG.warn("Invalid UUID in bulk remove operation: {}", toIdStr);
      }
    }

    LOG.debug(
        "Bulk removed {} relationships from {} ({}) and evicted cache",
        toIds.size(),
        fromId,
        fromEntity);
  }

  @Override
  public void bulkRemoveFrom(
      List<String> fromIds, UUID toId, String fromEntity, String toEntity, int relation) {
    delegate.bulkRemoveFrom(fromIds, toId, fromEntity, toEntity, relation);

    evictEntityFromCache(toId, toEntity);
    for (String fromIdStr : fromIds) {
      try {
        UUID fromId = UUID.fromString(fromIdStr);
        evictEntityFromCache(fromId, fromEntity);
      } catch (IllegalArgumentException e) {
        LOG.warn("Invalid UUID in bulk remove operation: {}", fromIdStr);
      }
    }

    LOG.debug(
        "Bulk removed {} relationships to {} ({}) and evicted cache",
        fromIds.size(),
        toId,
        toEntity);
  }

  private void triggerSimplePrefetch(UUID entityId, String entityType) {
    if (!RelationshipCache.isAvailable()) {
      return;
    }

    // Run simple prefetching in background
    CompletableFuture.runAsync(
        () -> {
          try {
            prefetchAllRelationshipsForEntity(entityId, entityType);
          } catch (Exception e) {
            LOG.debug(
                "Background prefetch failed for {} ({}): {}", entityId, entityType, e.getMessage());
          }
        },
        PREFETCH_EXECUTOR);
  }

  private void prefetchAllRelationshipsForEntity(UUID entityId, String entityType) {
    try {
      List<Integer> commonRelations = List.of(1, 2, 3, 4, 5, 8, 10, 11, 12, 13);

      String toKey =
          createRelationshipCacheKey(
              entityId.toString(), entityType, FIND_TO_KEY, commonRelations.toString());

      if (RelationshipCache.get(toKey).isEmpty()) {
        List<EntityRelationshipRecord> toResults =
            delegate.findTo(entityId, entityType, commonRelations);
        if (!toResults.isEmpty()) {
          Map<String, Object> cacheData = new HashMap<>();
          cacheData.put(RELATIONSHIPS, toResults);
          cacheData.put(TIMESTAMP, System.currentTimeMillis());
          cacheData.put(PREFETCHED, true);
          RelationshipCache.put(toKey, cacheData);
          LOG.debug(
              "Prefetched {} 'to' relationships for {} ({})",
              toResults.size(),
              entityId,
              entityType);
        }
      }

      for (Integer relation : List.of(1, 2, 8)) { // Most common reverse relationships
        String fromKey =
            createRelationshipCacheKey(
                entityId.toString(), entityType, FIND_FROM_KEY, relation + ":*");

        if (RelationshipCache.get(fromKey).isEmpty()) {
          List<EntityRelationshipRecord> fromResults =
              delegate.findFrom(entityId, entityType, relation);
          if (!fromResults.isEmpty()) {
            Map<String, Object> cacheData = new HashMap<>();
            cacheData.put(RELATIONSHIPS, fromResults);
            cacheData.put(TIMESTAMP, System.currentTimeMillis());
            cacheData.put(PREFETCHED, true);
            RelationshipCache.put(fromKey, cacheData);
            LOG.debug(
                "Prefetched {} 'from' relationships (rel:{}) for {} ({})",
                fromResults.size(),
                relation,
                entityId,
                entityType);
          }
        }
      }

    } catch (Exception e) {
      LOG.debug("Prefetch failed for {} ({}): {}", entityId, entityType, e.getMessage());
    }
  }
}
