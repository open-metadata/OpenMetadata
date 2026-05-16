/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;

@Slf4j
class DistributedReindexFinalizer {
  private final RecreateIndexHandler indexPromotionHandler;
  private final ReindexContext stagedIndexContext;

  DistributedReindexFinalizer(
      RecreateIndexHandler indexPromotionHandler, ReindexContext stagedIndexContext) {
    this.indexPromotionHandler = indexPromotionHandler;
    this.stagedIndexContext = stagedIndexContext;
  }

  boolean finalizeRemainingEntities(
      Set<String> promotedEntities,
      Map<String, SearchIndexJob.EntityTypeStats> entityStats,
      boolean finalSuccess) {
    LOG.debug(
        "Finalization: finalSuccess={}, promotedEntities={}, allEntities={}",
        finalSuccess,
        promotedEntities,
        stagedIndexContext.getEntities());

    Set<String> entitiesToFinalize = new HashSet<>(stagedIndexContext.getEntities());
    entitiesToFinalize.removeAll(promotedEntities);
    Set<String> finalizedEntities = new HashSet<>(promotedEntities);

    routeColumnFinalizationThroughTable(entitiesToFinalize);
    promoteColumnIndexIfTableWasPromoted(
        promotedEntities, entityStats, entitiesToFinalize, finalizedEntities);
    finalizeEntities(entitiesToFinalize, entityStats, finalSuccess, finalizedEntities);

    return finalSuccess;
  }

  private void routeColumnFinalizationThroughTable(Set<String> entitiesToFinalize) {
    if (entitiesToFinalize.contains(Entity.TABLE)) {
      entitiesToFinalize.remove(Entity.TABLE_COLUMN);
    }
  }

  private void promoteColumnIndexIfTableWasPromoted(
      Set<String> promotedEntities,
      Map<String, SearchIndexJob.EntityTypeStats> entityStats,
      Set<String> entitiesToFinalize,
      Set<String> finalizedEntities) {
    if (promotedEntities.contains(Entity.TABLE)
        && !promotedEntities.contains(Entity.TABLE_COLUMN)) {
      boolean tableSuccess = computeEntitySuccess(Entity.TABLE, entityStats);
      promoteColumnIndex(tableSuccess, finalizedEntities);
      entitiesToFinalize.remove(Entity.TABLE_COLUMN);
    }
  }

  private void finalizeEntities(
      Set<String> entitiesToFinalize,
      Map<String, SearchIndexJob.EntityTypeStats> entityStats,
      boolean finalSuccess,
      Set<String> finalizedEntities) {
    LOG.debug("Entities to finalize={}", entitiesToFinalize);
    if (entitiesToFinalize.isEmpty()) {
      return;
    }

    LOG.info("Finalizing {} remaining entities", entitiesToFinalize.size());
    for (String entityType : entitiesToFinalize) {
      if (!finalizedEntities.add(entityType)) {
        LOG.debug("Skipping already finalized entity '{}'", entityType);
        continue;
      }
      try {
        boolean entitySuccess = computeEntitySuccess(entityType, entityStats);
        LOG.debug(
            "Finalizing entity '{}' with perEntitySuccess={} (globalSuccess={})",
            entityType,
            entitySuccess,
            finalSuccess);
        finalizeEntityReindex(entityType, entitySuccess);
        if (Entity.TABLE.equals(entityType)) {
          promoteColumnIndex(entitySuccess, finalizedEntities);
        }
      } catch (Exception ex) {
        LOG.error("Failed to finalize reindex for entity: {}", entityType, ex);
      }
    }
  }

  private void promoteColumnIndex(boolean tableSuccess, Set<String> finalizedEntities) {
    if (stagedIndexContext.getStagedIndex(Entity.TABLE_COLUMN).isEmpty()) {
      return;
    }
    if (!finalizedEntities.add(Entity.TABLE_COLUMN)) {
      LOG.debug("Skipping already finalized column index");
      return;
    }
    try {
      finalizeEntityReindex(Entity.TABLE_COLUMN, tableSuccess);
      LOG.info("Promoted column index (tableSuccess={})", tableSuccess);
    } catch (Exception ex) {
      LOG.error("Failed to promote column index", ex);
    }
  }

  private boolean computeEntitySuccess(
      String entityType, Map<String, SearchIndexJob.EntityTypeStats> entityStats) {
    if (entityStats == null || entityStats.isEmpty()) {
      return false;
    }
    SearchIndexJob.EntityTypeStats stats = entityStats.get(entityType);
    if (stats == null) {
      return false;
    }
    return stats.getFailedRecords() == 0
        && stats.getSuccessRecords() + stats.getFailedRecords() >= stats.getTotalRecords();
  }

  private void finalizeEntityReindex(String entityType, boolean success) {
    indexPromotionHandler.finalizeReindex(
        EntityReindexContextMapper.fromStagedContext(stagedIndexContext, entityType), success);
  }
}
