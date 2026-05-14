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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.util.EntityUtil;

/**
 * Repository for handling entity relationships with proper filtering of deleted entities.
 * This class provides optimized methods for retrieving entity relationships with Include
 * filter support to handle soft-deleted entities appropriately.
 */
@Slf4j
public class EntityRelationshipRepository {
  private final CollectionDAO daoCollection;

  public EntityRelationshipRepository(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  /**
   * Get entity references from relationship records with Include filter support.
   * This method filters out deleted entities when Include.NON_DELETED is used,
   * and handles broken relationships gracefully (where relationship exists but entity is deleted).
   *
   * @param records List of entity relationship records
   * @param include Include filter (ALL, DELETED, or NON_DELETED)
   * @return List of entity references, filtering based on Include parameter
   */
  public List<EntityReference> getEntityReferences(
      List<EntityRelationshipRecord> records, Include include) {
    if (nullOrEmpty(records)) {
      return Collections.emptyList();
    }

    long startTime = System.currentTimeMillis();

    // Group by entity type for batch fetch - reduces N queries to M queries
    Map<String, List<UUID>> idsByType =
        records.stream()
            .collect(
                Collectors.groupingBy(
                    EntityRelationshipRecord::getType,
                    Collectors.mapping(EntityRelationshipRecord::getId, Collectors.toList())));

    List<EntityReference> refs = new ArrayList<>();
    int queryCount = 0;
    int skippedCount = 0;

    for (Map.Entry<String, List<UUID>> entry : idsByType.entrySet()) {
      String entityType = entry.getKey();
      List<UUID> ids = entry.getValue();
      queryCount++;

      try {
        List<EntityReference> typeRefs = Entity.getEntityReferencesByIds(entityType, ids, include);
        refs.addAll(typeRefs);
      } catch (Exception e) {
        // Fallback for partial failures - fetch individually to handle deleted entities gracefully
        LOG.warn(
            "Batch fetch failed for type {}, falling back to individual fetch: {}",
            entityType,
            e.getMessage());
        for (UUID id : ids) {
          try {
            refs.add(Entity.getEntityReferenceById(entityType, id, include));
          } catch (EntityNotFoundException ex) {
            // Skip deleted or missing entities
            skippedCount++;
            LOG.debug(
                "Skipping entity reference (deleted or missing): {} {} - {}",
                entityType,
                id,
                ex.getMessage());
          }
        }
      }
    }

    refs.sort(EntityUtil.compareEntityReference);

    LOG.debug(
        "getEntityReferences: {} records -> {} types -> {} queries, {} skipped in {}ms (Include: {})",
        records.size(),
        idsByType.size(),
        queryCount,
        skippedCount,
        System.currentTimeMillis() - startTime,
        include);

    return refs;
  }

  /**
   * Get entity references from relationship records, defaulting to NON_DELETED.
   * This is the safe default for GET operations to avoid showing deleted entities.
   *
   * @param records List of entity relationship records
   * @return List of entity references with deleted entities filtered out
   */
  public List<EntityReference> getEntityReferences(List<EntityRelationshipRecord> records) {
    return getEntityReferences(records, NON_DELETED);
  }
}
