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

package org.openmetadata.service.events.lifecycle.handlers;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class SearchIndexHandler implements EntityLifecycleEventHandler {

  private static final String OP_CREATE_INDEX = "createEntityIndex";
  private static final String OP_UPDATE_INDEX = "updateEntityIndex";
  private static final String OP_DELETE_INDEX = "deleteEntityIndex";
  private static final String OP_SOFT_DELETE_INDEX = "softDeleteEntityIndex";
  private static final String OP_RESTORE_INDEX = "restoreEntityIndex";

  private final SearchRepository searchRepository;

  public SearchIndexHandler(SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
  }

  @Override
  public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    if (entity == null) {
      LOG.warn("Received null entity in onEntityCreated");
      return;
    }
    try {
      searchRepository.createEntityIndex(entity);
    } catch (Exception e) {
      LOG.error(
          "Failed to create search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
      SearchIndexRetryQueue.enqueue(entity, OP_CREATE_INDEX, e);
    }
  }

  @Override
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    if (entity == null) {
      LOG.warn("Received null entity in onEntityUpdated");
      return;
    }
    try {
      searchRepository.updateEntityIndex(entity);
    } catch (Exception e) {
      LOG.error(
          "Failed to update search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
      SearchIndexRetryQueue.enqueue(entity, OP_UPDATE_INDEX, e);
    }
  }

  @Override
  public void onEntityUpdated(EntityReference entityRef, SubjectContext subjectContext) {
    if (entityRef == null) {
      LOG.warn("Received null entity in onEntityUpdated");
      return;
    }
    try {
      searchRepository.updateEntity(entityRef);
    } catch (Exception e) {
      LOG.error(
          "Failed to update search index for entity {} {}",
          entityRef.getType(),
          entityRef.getId(),
          e);
      SearchIndexRetryQueue.enqueue(
          entityRef.getId() != null ? entityRef.getId().toString() : null,
          entityRef.getFullyQualifiedName(),
          entityRef.getType() == null ? "" : entityRef.getType(),
          SearchIndexRetryQueue.failureReason(OP_UPDATE_INDEX, e));
    }
  }

  @Override
  public void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
    if (entity == null) {
      LOG.warn("Received null entity in onEntityDeleted");
      return;
    }
    try {
      searchRepository.deleteEntityIndex(entity);
    } catch (Exception e) {
      LOG.error(
          "Failed to delete search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
      SearchIndexRetryQueue.enqueue(entity, OP_DELETE_INDEX, e);
    }
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    if (entity == null) {
      LOG.warn("Received null entity in onEntitySoftDeletedOrRestored");
      return;
    }
    try {
      searchRepository.softDeleteOrRestoreEntityIndex(entity, isDeleted);
    } catch (Exception e) {
      LOG.error(
          "Failed to {} search index for entity {} {}",
          isDeleted ? "soft delete" : "restore",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
      SearchIndexRetryQueue.enqueue(entity, isDeleted ? OP_SOFT_DELETE_INDEX : OP_RESTORE_INDEX, e);
    }
  }

  @Override
  public String getHandlerName() {
    return "SearchIndexHandler";
  }

  @Override
  public int getPriority() {
    return 10;
  }

  @Override
  public boolean isAsync() {
    // Search indexing must be visible to follow-up operations in the same request flow (e.g., a
    // postCreate hook that immediately updates the indexed document, or a create-then-search). It
    // therefore runs synchronously post-commit on the request thread — never deferred to a
    // background lane, which would make the entity eventually consistent and break read-your-write.
    return false;
  }

  public void onEntitiesCreated(List<EntityInterface> entities, SubjectContext subjectContext) {
    if (entities == null || entities.isEmpty()) {
      LOG.warn("Received null entities in onEntitiesCreated");
      return;
    }

    try {
      Map<String, List<EntityInterface>> entitiesByType =
          entities.stream().collect(Collectors.groupingBy(e -> e.getEntityReference().getType()));

      for (Map.Entry<String, List<EntityInterface>> entry : entitiesByType.entrySet()) {
        searchRepository.createEntitiesIndex(entry.getValue());
      }
    } catch (Exception e) {
      LOG.error("Failed to create search indexes for {} entities", entities.size(), e);
      for (EntityInterface entity : entities) {
        onEntityCreated(entity, subjectContext);
      }
    }
  }

  /**
   * Handle bulk entity updates to the search index. Prefer bulk update API on
   * SearchRepository and fall back to per-entity updates on failure.
   */
  @Override
  public void onEntitiesUpdated(
      List<? extends EntityInterface> entities,
      ChangeDescription changeDescription,
      SubjectContext subjectContext) {
    if (entities == null || entities.isEmpty()) {
      LOG.warn("Received null entities in onEntitiesUpdated");
      return;
    }

    LOG.debug("Search index handler: Updating search indexes for {} entities", entities.size());

    try {
      searchRepository.updateEntitiesIndex(entities);
      LOG.debug("Successfully updated search indexes for {} entities", entities.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk update search indexes for {} entities", entities.size(), e);
      for (EntityInterface entity : entities) {
        onEntityUpdated(
            entity,
            entity.getChangeDescription() != null
                ? entity.getChangeDescription()
                : changeDescription,
            subjectContext);
      }
    }
  }
}
