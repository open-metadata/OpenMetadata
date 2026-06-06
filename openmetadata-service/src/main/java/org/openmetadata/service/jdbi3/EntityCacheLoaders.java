/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;

import com.google.common.cache.CacheLoader;
import jakarta.validation.constraints.NotNull;
import java.util.Optional;
import java.util.UUID;
import lombok.NonNull;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.exception.EntityNotFoundException;

// Guava CacheLoaders backing the entity name/id read-through caches. Extracted from
// EntityRepository; constructed by its buildEntityNameCache/buildEntityIdCache.
class EntityLoaderWithName extends CacheLoader<Pair<String, String>, String> {
  private static final org.slf4j.Logger LOG =
      org.slf4j.LoggerFactory.getLogger(EntityLoaderWithName.class);

  @Override
  public @NonNull String load(@NotNull Pair<String, String> fqnPair) {
    String entityType = fqnPair.getLeft();
    String fqn = fqnPair.getRight();
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    EntityDAO<?> dao = repository.getDao();

    // Try to load from external cache first (read-through) for cacheable entity types.
    if (EntityRepository.isCacheableEntityType(entityType)) {
      var cachedEntityDao = CacheBundle.getCachedEntityDao();
      if (cachedEntityDao != null) {
        Optional<String> cachedJson = cachedEntityDao.getByName(entityType, fqn);
        if (cachedJson.isPresent()) {
          LOG.debug("CACHE HIT: Loading entity by name from Redis cache: {} {}", entityType, fqn);
          try {
            Class<? extends EntityInterface> entityClass = repository.getEntityClass();
            EntityInterface entity = JsonUtils.readValue(cachedJson.get(), entityClass);
            if (entity.getId() == null || entity.getFullyQualifiedName() == null) {
              LOG.error(
                  "CACHE ERROR: Cached entity from name lookup is invalid! Evicting. Type: {}, Name: {}",
                  entityType,
                  fqn);
              cachedEntityDao.deleteByName(entityType, fqn);
            } else {
              return cachedJson.get();
            }
          } catch (Exception e) {
            LOG.warn(
                "Failed to deserialize cached entity, evicting and falling back to database: {} {}",
                entityType,
                fqn,
                e);
            try {
              cachedEntityDao.deleteByName(entityType, fqn);
            } catch (Exception evictError) {
              LOG.debug(
                  "Failed to evict bad cache entry by name: {} {}", entityType, fqn, evictError);
            }
          }
        }
        LOG.debug("CACHE MISS: Entity not in Redis cache by name: {} {}", entityType, fqn);
      }
    }

    // Load raw JSON from database. User entities store nameHash off the lowercased FQN —
    // UserDAO.findEntityByName lowercases the input. We call dao.findByName directly here
    // to stay in the JSON-only path, so mirror the same case-fold for user types.
    String lookupFqn = "user".equals(entityType) ? fqn.toLowerCase() : fqn;
    LOG.debug("Loading entity by name from database: {} {}", entityType, lookupFqn);
    String json =
        dao.findByName(
            dao.getTableName(), dao.getNameHashColumn(), lookupFqn, dao.getCondition(ALL));
    if (json == null) {
      throw new EntityNotFoundException(String.format("Entity not found: %s %s", entityType, fqn));
    }

    // Validate
    EntityInterface entity = JsonUtils.readValue(json, repository.getEntityClass());
    if (!EntityRepository.isValidEntityForCache(entity)) {
      LOG.error(
          "CRITICAL: Entity loaded from database by name is invalid! Type: {}, Name: {}, ID: {}",
          entityType,
          fqn,
          entity == null ? "null" : entity.getId());
      throw new IllegalStateException(
          String.format("Invalid entity from database: %s %s", entityType, fqn));
    }

    // Populate Redis on miss so subsequent reads (incl. cross-instance) can hit cache
    if (EntityRepository.isCacheableEntityType(entityType)) {
      var cachedEntityDao = CacheBundle.getCachedEntityDao();
      if (cachedEntityDao != null) {
        try {
          cachedEntityDao.putByName(entityType, fqn, json);
          if (entity.getId() != null) {
            cachedEntityDao.putBase(entityType, entity.getId(), json);
          }
        } catch (Exception e) {
          LOG.debug("Failed to populate Redis on byName miss: {} {}", entityType, fqn, e);
        }
      }
    }

    return json;
  }
}

class EntityLoaderWithId extends CacheLoader<Pair<String, UUID>, String> {
  private static final org.slf4j.Logger LOG =
      org.slf4j.LoggerFactory.getLogger(EntityLoaderWithId.class);

  @Override
  public @NonNull String load(@NotNull Pair<String, UUID> idPair) {
    String entityType = idPair.getLeft();
    UUID id = idPair.getRight();
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    EntityDAO<?> dao = repository.getDao();

    // Try to load from external cache first (read-through) for cacheable entity types.
    if (EntityRepository.isCacheableEntityType(entityType)) {
      var cachedEntityDao = CacheBundle.getCachedEntityDao();
      if (cachedEntityDao != null) {
        String cachedJson = cachedEntityDao.getBase(id, entityType);
        if (cachedJson != null && !cachedJson.isEmpty()) {
          LOG.debug("CACHE HIT: Loading entity from Redis cache: {} {}", entityType, id);
          try {
            Class<? extends EntityInterface> entityClass = repository.getEntityClass();
            EntityInterface entity = JsonUtils.readValue(cachedJson, entityClass);
            if (entity.getId() == null) {
              LOG.error(
                  "CACHE ERROR: Cached entity has null ID! Evicting. Type: {}, Expected ID: {}",
                  entityType,
                  id);
              cachedEntityDao.deleteBase(entityType, id);
            } else {
              return cachedJson;
            }
          } catch (Exception e) {
            LOG.warn(
                "Failed to deserialize cached entity, evicting and falling back to database: {} {}",
                entityType,
                id,
                e);
            try {
              cachedEntityDao.deleteBase(entityType, id);
            } catch (Exception evictError) {
              LOG.debug("Failed to evict bad cache entry: {} {}", entityType, id, evictError);
            }
          }
        }
        LOG.debug("CACHE MISS: Entity not in Redis cache: {} {}", entityType, id);
      }
    }

    // Load raw JSON from database
    LOG.debug("Loading entity from database: {} {}", entityType, id);
    String json = dao.findById(dao.getTableName(), id, dao.getCondition(ALL));
    if (json == null) {
      throw new EntityNotFoundException(String.format("Entity not found: %s %s", entityType, id));
    }

    // Validate
    EntityInterface entity = JsonUtils.readValue(json, repository.getEntityClass());
    if (!EntityRepository.isValidEntityForCache(entity)) {
      if (entity.getId() == null) {
        LOG.error(
            "CRITICAL: Entity loaded from database has null ID! Type: {}, Expected ID: {}, FQN: {}",
            entityType,
            id,
            entity.getFullyQualifiedName());
        entity.setId(id);
        json = JsonUtils.pojoToJson(entity);
      }
      entity = JsonUtils.readValue(json, repository.getEntityClass());
      if (!EntityRepository.isValidEntityForCache(entity)) {
        LOG.error("Entity from database is invalid for caching: {} {}", entityType, id);
        throw new IllegalStateException(
            String.format("Invalid entity from database: %s %s", entityType, id));
      }
    }

    return json;
  }
}
