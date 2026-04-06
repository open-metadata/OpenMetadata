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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.lock.HierarchicalLockManager;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Orchestrates fast prefix-based hard deletion of an entity and all its descendants.
 *
 * <p>Uses 7 phases to atomically delete an entire subtree by FQN prefix rather than walking the
 * entity tree one-by-one. This is orders of magnitude faster for large hierarchies and eliminates
 * the race condition where concurrent ingestion creates orphaned entities during slow cascade
 * deletion.
 *
 * <p>This service handles hard delete only. Soft delete still uses the existing tree walk in
 * {@link EntityRepository} to preserve relationship data for restoration.
 */
@Slf4j
public final class PrefixDeletionService {

  private static volatile PrefixDeletionService instance;

  private final HierarchicalLockManager lockManager;

  private PrefixDeletionService(HierarchicalLockManager lockManager) {
    this.lockManager = lockManager;
  }

  public static void initialize(HierarchicalLockManager lockMgr) {
    if (instance == null) {
      synchronized (PrefixDeletionService.class) {
        if (instance == null) {
          instance = new PrefixDeletionService(lockMgr);
        }
      }
    }
  }

  public static PrefixDeletionService getInstance() {
    return instance;
  }

  /**
   * Hard-deletes the given root entity and all descendants whose FQN starts with the root's FQN.
   * Works at any hierarchy level (service, database, schema, etc.).
   */
  public void deletePrefixHard(EntityInterface rootEntity, String deletedBy) {
    String rootFqn = rootEntity.getFullyQualifiedName();
    String fqnHashPrefix = FullyQualifiedName.buildHash(rootFqn);
    DeletionLock lock = acquireLock(rootEntity, deletedBy);
    try {
      Map<String, List<UUID>> descendantsByType = collectDescendantIds(fqnHashPrefix);
      List<String> allIds = buildAllIds(rootEntity.getId(), descendantsByType);
      deleteDependencyTables(rootFqn, fqnHashPrefix, allIds);
      runEntityHooks(rootEntity, deletedBy, fqnHashPrefix);
      deleteEntityTables(descendantsByType, rootEntity);
      emitDeleteEvent(rootEntity);
    } finally {
      releaseLock(lock, rootEntity);
    }
  }

  private DeletionLock acquireLock(EntityInterface entity, String deletedBy) {
    if (lockManager == null) {
      return null;
    }
    try {
      return lockManager.acquireDeletionLock(entity, deletedBy, true);
    } catch (Exception e) {
      LOG.warn(
          "Could not acquire deletion lock for {}: {}",
          entity.getFullyQualifiedName(),
          e.getMessage());
      return null;
    }
  }

  private Map<String, List<UUID>> collectDescendantIds(String fqnHashPrefix) {
    Map<String, List<UUID>> descendantsByType = new HashMap<>();
    for (String entityType : Entity.getEntityList()) {
      try {
        EntityRepository<?> repo = Entity.getEntityRepository(entityType);
        List<UUID> ids = repo.getDao().findIdsByFqnHashPrefix(fqnHashPrefix);
        if (!ids.isEmpty()) {
          descendantsByType.put(entityType, ids);
        }
      } catch (Exception e) {
        LOG.debug("Skipping type {} during descendant collection: {}", entityType, e.getMessage());
      }
    }
    return descendantsByType;
  }

  private List<String> buildAllIds(UUID rootId, Map<String, List<UUID>> descendantsByType) {
    List<String> allIds = new ArrayList<>();
    allIds.add(rootId.toString());
    for (List<UUID> ids : descendantsByType.values()) {
      for (UUID id : ids) {
        allIds.add(id.toString());
      }
    }
    return allIds;
  }

  private void deleteDependencyTables(String rootFqn, String fqnHashPrefix, List<String> allIds) {
    CollectionDAO dao = Entity.getCollectionDAO();
    dao.relationshipDAO().deleteAllByFqnHashPrefix(fqnHashPrefix);
    dao.fieldRelationshipDAO().deleteAllByPrefix(rootFqn);
    dao.entityExtensionDAO().deleteAllBatch(allIds);
    dao.tagUsageDAO().deleteTagLabelsByTargetPrefix(rootFqn);
    dao.usageDAO().deleteBatch(allIds);
    List<UUID> allUuids = allIds.stream().map(UUID::fromString).toList();
    Entity.getFeedRepository().deleteByAboutBatch(allUuids);
  }

  private void runEntityHooks(EntityInterface rootEntity, String deletedBy, String fqnHashPrefix) {
    String rootType = rootEntity.getEntityReference().getType();
    try {
      Entity.getEntityRepository(rootType).callPreDelete(rootEntity, deletedBy);
    } catch (Exception e) {
      LOG.warn(
          "preDelete hook failed for {}: {}", rootEntity.getFullyQualifiedName(), e.getMessage());
    }
    for (String entityType : Entity.getEntityList()) {
      try {
        Entity.getEntityRepository(entityType).deleteTimeSeriesByFqnPrefix(fqnHashPrefix);
      } catch (Exception e) {
        LOG.debug("deleteTimeSeriesByFqnPrefix failed for type {}: {}", entityType, e.getMessage());
      }
    }
  }

  private void deleteEntityTables(
      Map<String, List<UUID>> descendantsByType, EntityInterface rootEntity) {
    for (Map.Entry<String, List<UUID>> entry : descendantsByType.entrySet()) {
      String entityType = entry.getKey();
      List<String> ids = entry.getValue().stream().map(UUID::toString).toList();
      try {
        Entity.getEntityRepository(entityType).getDao().deleteBatch(ids);
      } catch (Exception e) {
        LOG.warn(
            "Failed to delete {} entities of type {}: {}", ids.size(), entityType, e.getMessage());
      }
    }
    String rootType = rootEntity.getEntityReference().getType();
    EntityRepository<?> rootRepo = Entity.getEntityRepository(rootType);
    rootRepo.getDao().delete(rootEntity.getId());
    rootRepo.invalidateEntity(rootEntity);
  }

  private void emitDeleteEvent(EntityInterface rootEntity) {
    try {
      EntityLifecycleEventDispatcher.getInstance().onEntityDeleted(rootEntity, null);
    } catch (Exception e) {
      LOG.warn(
          "Failed to emit delete event for {}: {}",
          rootEntity.getFullyQualifiedName(),
          e.getMessage());
    }
  }

  private void releaseLock(DeletionLock lock, EntityInterface entity) {
    if (lock == null || lockManager == null) {
      return;
    }
    try {
      lockManager.releaseDeletionLock(entity.getId(), entity.getEntityReference().getType());
    } catch (Exception e) {
      LOG.warn(
          "Failed to release deletion lock for {}: {}",
          entity.getFullyQualifiedName(),
          e.getMessage());
    }
  }
}
