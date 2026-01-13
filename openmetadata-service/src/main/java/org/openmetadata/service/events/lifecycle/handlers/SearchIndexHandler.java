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
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Search index handler that manages search indexing operations as part of the
 * entity lifecycle event framework. This handler replaces direct SearchRepository
 * calls from EntityRepository with a more flexible delegation pattern.
 */
@Slf4j
public class SearchIndexHandler implements EntityLifecycleEventHandler {

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
      LOG.debug(
          "Successfully created search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId());
    } catch (Exception e) {
      LOG.error(
          "Failed to create search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
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
      LOG.debug(
          "Successfully updated search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId());
    } catch (Exception e) {
      LOG.error(
          "Failed to update search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
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
      LOG.debug(
          "Successfully updated search index for entity {} {}",
          entityRef.getType(),
          entityRef.getId());
    } catch (Exception e) {
      LOG.error(
          "Failed to update search index for entity {} {}",
          entityRef.getType(),
          entityRef.getId(),
          e);
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
      LOG.debug(
          "Successfully deleted search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId());
    } catch (Exception e) {
      LOG.error(
          "Failed to delete search index for entity {} {}",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
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
      LOG.debug(
          "Successfully {} search index for entity {} {}",
          isDeleted ? "soft deleted" : "restored",
          entity.getEntityReference().getType(),
          entity.getId());
    } catch (Exception e) {
      LOG.error(
          "Failed to {} search index for entity {} {}",
          isDeleted ? "soft delete" : "restore",
          entity.getEntityReference().getType(),
          entity.getId(),
          e);
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
    return false;
  }

  /**
   * Handle bulk entity creation for better performance.
   * This method can be used by the dispatcher for optimized bulk operations.
   */
  public void onEntitiesCreated(List<EntityInterface> entities, SubjectContext subjectContext) {
    if (entities == null || entities.isEmpty()) {
      LOG.warn("Received null entities in onEntitiesCreated");
      return;
    }

    LOG.debug("Search index handler: Creating search indexes for {} entities", entities.size());

    try {
      // Group entities by type for bulk operations
      Map<String, List<EntityInterface>> entitiesByType =
          entities.stream().collect(Collectors.groupingBy(e -> e.getEntityReference().getType()));

      // Process each entity type separately for optimal bulk indexing
      for (Map.Entry<String, List<EntityInterface>> entry : entitiesByType.entrySet()) {
        List<EntityInterface> typedEntities = entry.getValue();
        LOG.debug(
            "Creating search indexes for {} {} entities", typedEntities.size(), entry.getKey());
        searchRepository.createEntitiesIndex(typedEntities);
      }

      LOG.debug("Successfully created search indexes for {} entities", entities.size());
    } catch (Exception e) {
      LOG.error("Failed to create search indexes for {} entities", entities.size(), e);
      // Fallback to individual entity creation
      LOG.info("Falling back to individual entity indexing");
      for (EntityInterface entity : entities) {
        onEntityCreated(entity, subjectContext);
      }
    }
  }
}
