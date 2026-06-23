/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util.relationshipcleanup;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.FeedRepository;

/**
 * Resolves entity existence for relationship cleanup in bulk instead of one row at a time.
 *
 * <p>The previous implementation called {@code repository.get(...)} for both endpoints of every
 * relationship row, turning a scan of N relationships into up to 2*N hydrated single-row reads on a
 * single thread - the root cause of multi-day DataRetention runs on large catalogs. This resolver
 * instead {@link #prefetch(List) prefetches} a whole batch with a single {@code WHERE id IN (...)}
 * query per entity type and caches the answers (positive and negative) in a bounded LRU, so a
 * relationship endpoint that recurs across batches is resolved once.
 */
@Slf4j
public class BatchEntityExistenceResolver implements RelationshipValidator.EntityExistenceChecker {

  private static final int MAX_CACHE_ENTRIES = 100_000;
  private static final int MAX_IDS_PER_QUERY = 5_000;

  private final Map<String, EntityRepository<?>> entityRepositories;
  private final Map<String, EntityTimeSeriesRepository<?>> entityTimeSeriesRepositories;
  private final FeedRepository feedRepository;
  private final Map<String, Boolean> existenceCache;

  public BatchEntityExistenceResolver(
      Map<String, EntityRepository<?>> entityRepositories,
      Map<String, EntityTimeSeriesRepository<?>> entityTimeSeriesRepositories,
      FeedRepository feedRepository) {
    this.entityRepositories = entityRepositories;
    this.entityTimeSeriesRepositories = entityTimeSeriesRepositories;
    this.feedRepository = feedRepository;
    this.existenceCache = boundedCache();
  }

  /**
   * Resolves the existence of both endpoints of every relationship in the batch using one bulk
   * query per entity type. Endpoints already cached and entity types without a regular repository
   * (time series, threads) are skipped here and resolved lazily by {@link #exists(UUID, String)}.
   */
  public void prefetch(List<CollectionDAO.EntityRelationshipObject> batch) {
    Map<String, Set<UUID>> idsByType = collectRegularEntityIds(batch);
    for (Map.Entry<String, Set<UUID>> entry : idsByType.entrySet()) {
      prefetchType(entry.getKey(), entry.getValue());
    }
  }

  @Override
  public boolean exists(UUID entityId, String entityType) {
    String key = cacheKey(entityType, entityId);
    Boolean cached = existenceCache.get(key);
    boolean result;
    if (cached != null) {
      result = cached;
    } else {
      result = resolveSingle(entityId, entityType);
      existenceCache.put(key, result);
    }
    return result;
  }

  private Map<String, Set<UUID>> collectRegularEntityIds(
      List<CollectionDAO.EntityRelationshipObject> batch) {
    Map<String, Set<UUID>> idsByType = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject relationship : batch) {
      addRegularEntityId(idsByType, relationship.getFromEntity(), relationship.getFromId());
      addRegularEntityId(idsByType, relationship.getToEntity(), relationship.getToId());
    }
    return idsByType;
  }

  private void addRegularEntityId(Map<String, Set<UUID>> idsByType, String entityType, String id) {
    UUID entityId = toUuid(id);
    boolean prefetchable =
        entityId != null
            && entityRepositories.containsKey(entityType)
            && !existenceCache.containsKey(cacheKey(entityType, entityId));
    if (prefetchable) {
      idsByType.computeIfAbsent(entityType, type -> new HashSet<>()).add(entityId);
    }
  }

  private void prefetchType(String entityType, Set<UUID> ids) {
    EntityDAO<?> dao = entityRepositories.get(entityType).getDao();
    for (List<UUID> chunk : partition(new ArrayList<>(ids))) {
      cacheChunkExistence(entityType, dao, chunk);
    }
  }

  private void cacheChunkExistence(String entityType, EntityDAO<?> dao, List<UUID> chunk) {
    Set<UUID> existing = findExistingIds(entityType, dao, chunk);
    for (UUID id : chunk) {
      existenceCache.put(cacheKey(entityType, id), existing.contains(id));
    }
  }

  private Set<UUID> findExistingIds(String entityType, EntityDAO<?> dao, List<UUID> chunk) {
    Set<UUID> existing = new HashSet<>();
    try {
      List<String> idStrings = chunk.stream().map(UUID::toString).toList();
      for (String foundId : dao.findExistingIds(dao.getTableName(), idStrings)) {
        existing.add(UUID.fromString(foundId));
      }
    } catch (Exception ex) {
      LOG.warn(
          "Bulk existence check failed for entity type {}; treating endpoints as existing to avoid "
              + "deleting valid relationships",
          entityType,
          ex);
      existing.addAll(chunk);
    }
    return existing;
  }

  private boolean resolveSingle(UUID entityId, String entityType) {
    boolean result;
    if (entityRepositories.containsKey(entityType)) {
      result = existsInEntityRepository(entityId, entityType);
    } else if (entityTimeSeriesRepositories.containsKey(entityType)) {
      result = existsInTimeSeriesRepository(entityId, entityType);
    } else if (Entity.THREAD.equals(entityType)) {
      result = existsInFeedRepository(entityId);
    } else {
      result = true;
    }
    return result;
  }

  private boolean existsInEntityRepository(UUID entityId, String entityType) {
    EntityDAO<?> dao = entityRepositories.get(entityType).getDao();
    boolean result;
    try {
      result = dao.exists(dao.getTableName(), entityId);
    } catch (Exception ex) {
      LOG.debug("Entity {}:{} existence check failed: {}", entityType, entityId, ex.getMessage());
      result = true;
    }
    return result;
  }

  private boolean existsInTimeSeriesRepository(UUID entityId, String entityType) {
    boolean result;
    try {
      result = entityTimeSeriesRepositories.get(entityType).getById(entityId) != null;
    } catch (Exception ex) {
      LOG.debug("Entity {}:{} existence check failed: {}", entityType, entityId, ex.getMessage());
      result = true;
    }
    return result;
  }

  private boolean existsInFeedRepository(UUID entityId) {
    boolean result;
    try {
      result = feedRepository.get(entityId) != null;
    } catch (EntityNotFoundException e) {
      result = false;
    } catch (Exception ex) {
      LOG.debug("Thread {} existence check failed: {}", entityId, ex.getMessage());
      result = true;
    }
    return result;
  }

  private List<List<UUID>> partition(List<UUID> ids) {
    List<List<UUID>> chunks = new ArrayList<>();
    for (int start = 0; start < ids.size(); start += MAX_IDS_PER_QUERY) {
      chunks.add(ids.subList(start, Math.min(start + MAX_IDS_PER_QUERY, ids.size())));
    }
    return chunks;
  }

  private UUID toUuid(String id) {
    UUID result;
    try {
      result = UUID.fromString(id);
    } catch (IllegalArgumentException | NullPointerException ex) {
      result = null;
    }
    return result;
  }

  private String cacheKey(String entityType, UUID entityId) {
    return entityType + ":" + entityId;
  }

  private Map<String, Boolean> boundedCache() {
    return new LinkedHashMap<>(1024, 0.75f, true) {
      @Override
      protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
        return size() > MAX_CACHE_ENTRIES;
      }
    };
  }
}
