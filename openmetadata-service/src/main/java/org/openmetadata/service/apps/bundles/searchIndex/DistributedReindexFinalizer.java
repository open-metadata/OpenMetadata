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
import org.openmetadata.service.apps.bundles.searchIndex.promotion.EntityPromotionContext;
import org.openmetadata.service.apps.bundles.searchIndex.promotion.PromotionPolicy;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;

@Slf4j
class DistributedReindexFinalizer {
  private final RecreateIndexHandler indexPromotionHandler;
  private final ReindexContext stagedIndexContext;
  private final PromotionPolicy promotionPolicy;

  DistributedReindexFinalizer(
      RecreateIndexHandler indexPromotionHandler,
      ReindexContext stagedIndexContext,
      PromotionPolicy promotionPolicy) {
    this.indexPromotionHandler = indexPromotionHandler;
    this.stagedIndexContext = stagedIndexContext;
    this.promotionPolicy = promotionPolicy;
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
    boolean allPromoted =
        promoteColumnIndexIfTableWasPromoted(
            promotedEntities, entityStats, entitiesToFinalize, finalizedEntities);
    allPromoted &=
        finalizeEntities(entitiesToFinalize, entityStats, finalSuccess, finalizedEntities);

    return allPromoted;
  }

  private void routeColumnFinalizationThroughTable(Set<String> entitiesToFinalize) {
    if (entitiesToFinalize.contains(Entity.TABLE)) {
      entitiesToFinalize.remove(Entity.TABLE_COLUMN);
    }
  }

  private boolean promoteColumnIndexIfTableWasPromoted(
      Set<String> promotedEntities,
      Map<String, SearchIndexJob.EntityTypeStats> entityStats,
      Set<String> entitiesToFinalize,
      Set<String> finalizedEntities) {
    boolean promoted = true;
    if (promotedEntities.contains(Entity.TABLE)
        && !promotedEntities.contains(Entity.TABLE_COLUMN)) {
      boolean tableSuccess = computeEntitySuccess(Entity.TABLE, entityStats);
      promoted = promoteColumnIndex(tableSuccess, finalizedEntities);
      entitiesToFinalize.remove(Entity.TABLE_COLUMN);
    }
    return promoted;
  }

  private boolean finalizeEntities(
      Set<String> entitiesToFinalize,
      Map<String, SearchIndexJob.EntityTypeStats> entityStats,
      boolean finalSuccess,
      Set<String> finalizedEntities) {
    LOG.debug("Entities to finalize={}", entitiesToFinalize);
    if (entitiesToFinalize.isEmpty()) {
      return true;
    }

    LOG.info("Finalizing {} remaining entities", entitiesToFinalize.size());
    boolean allPromoted = true;
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
        boolean promoted = finalizeEntityReindex(entityType, entitySuccess);
        if (!promoted) {
          allPromoted = false;
          LOG.error(
              "Finalizer could not promote staged index for entity '{}'; it may still be served "
                  + "by the stale pre-reindex index",
              entityType);
        }
        if (Entity.TABLE.equals(entityType)) {
          allPromoted &= promoteColumnIndex(entitySuccess, finalizedEntities);
        }
      } catch (Exception ex) {
        allPromoted = false;
        LOG.error("Failed to finalize reindex for entity: {}", entityType, ex);
      }
    }
    return allPromoted;
  }

  private boolean promoteColumnIndex(boolean tableSuccess, Set<String> finalizedEntities) {
    if (stagedIndexContext.getStagedIndex(Entity.TABLE_COLUMN).isEmpty()) {
      return true;
    }
    if (!finalizedEntities.add(Entity.TABLE_COLUMN)) {
      LOG.debug("Skipping already finalized column index");
      return true;
    }
    boolean promoted = false;
    try {
      promoted = finalizeEntityReindex(Entity.TABLE_COLUMN, tableSuccess);
      LOG.info("Promoted column index (tableSuccess={}, promoted={})", tableSuccess, promoted);
    } catch (Exception ex) {
      LOG.error("Failed to promote column index", ex);
    }
    return promoted;
  }

  private boolean computeEntitySuccess(
      String entityType, Map<String, SearchIndexJob.EntityTypeStats> entityStats) {
    if (entityStats == null || entityStats.isEmpty() || entityStats.get(entityType) == null) {
      // No stats recorded for this entity type means the reader did zero work — either
      // the source had 0 rows, or the entity is driven by a parallel pipeline (e.g.
      // vectorEmbedding via RecreateWithEmbeddings) that doesn't feed the reader→sink
      // stats. Treat absent stats as success so the staged index gets promoted rather
      // than the job rolling up to FAILED on an entity that has nothing to fail on.
      return true;
    }
    SearchIndexJob.EntityTypeStats stats = entityStats.get(entityType);
    EntityPromotionContext promotionContext =
        new EntityPromotionContext(
            entityType,
            stats.getTotalRecords(),
            stats.getSuccessRecords(),
            stats.getFailedRecords(),
            stats.getProcessedRecords());
    PromotionPolicy.Decision decision = promotionPolicy.evaluate(promotionContext);
    LOG.debug(
        "Promotion decision for entity '{}': fullySuccessful={} reason={} (stats: total={}, success={}, failed={})",
        entityType,
        decision.fullySuccessful(),
        decision.reason(),
        stats.getTotalRecords(),
        stats.getSuccessRecords(),
        stats.getFailedRecords());
    return decision.fullySuccessful();
  }

  private boolean finalizeEntityReindex(String entityType, boolean success) {
    return indexPromotionHandler.finalizeReindex(
        EntityReindexContextMapper.fromStagedContext(stagedIndexContext, entityType), success);
  }
}
