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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;

/**
 * Finds and hard-deletes ingestion pipelines whose container {@code CONTAINS} relationship row is
 * missing. A pipeline is contained by its service (any service type) or by a test suite; when that
 * parent is hard-deleted without the cascade reaching the pipeline, the pipeline row survives with
 * no incoming {@code CONTAINS} row. Such a pipeline can no longer resolve its service, so it can
 * never run and it breaks search indexing: {@code IngestionPipelineRepository.setFields} resolves
 * the container via {@code getContainer} (which requires the relationship) and the reindex throws
 * "does not have expected relationship contains to/from entity type null".
 *
 * <p>This complements {@link EntityRelationshipCleanup} (which removes relationship rows whose
 * endpoints are gone). Here the pipeline row still exists but is unusable because the relationship
 * row it depends on is absent.
 *
 * <p>Deletion first tries {@link Entity#deleteEntity} with {@code recursive=true, hardDelete=true}.
 * A pipeline with a missing container can't be deleted that way — the delete path resolves the
 * container and throws the same "does not have expected relationship" error — so it falls back to a
 * direct delete of the pipeline's footprint (pipeline-status time series, relationship rows, search
 * doc, row). Soft-deleted pipelines are skipped (the operator kept them on purpose).
 */
@Slf4j
public class OrphanIngestionPipelineCleanup {

  private static final String PIPELINE_STATUS_EXTENSION = "ingestionPipeline.pipelineStatus";

  private final CollectionDAO collectionDAO;
  private final boolean dryRun;

  public OrphanIngestionPipelineCleanup(CollectionDAO collectionDAO, boolean dryRun) {
    this.collectionDAO = collectionDAO;
    this.dryRun = dryRun;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Result {
    private int totalScanned;
    private int orphansDeleted;
    private int orphanFailures;
  }

  public Result performCleanup(int batchSize) {
    LOG.info(
        "Starting orphan ingestion pipeline cleanup. Dry run: {}, Batch size: {}",
        dryRun,
        batchSize);
    Result result = Result.builder().build();

    int offset = 0;
    while (true) {
      List<String> jsonBatch =
          collectionDAO
              .ingestionPipelineDAO()
              .listAfterWithOffset(
                  collectionDAO.ingestionPipelineDAO().getTableName(), batchSize, offset);
      if (nullOrEmpty(jsonBatch)) {
        break;
      }
      List<IngestionPipeline> pipelines = parsePipelines(jsonBatch);
      result.setTotalScanned(result.getTotalScanned() + pipelines.size());

      int deletedInBatch = cleanupBatch(pipelines, result);

      if (jsonBatch.size() < batchSize) {
        break;
      }
      // Hard deletes shift subsequent rows backward, so only advance past the rows we kept.
      offset += batchSize - deletedInBatch;
    }

    LOG.info(
        "Orphan ingestion pipeline cleanup done. Scanned: {}, Deleted: {}, Failed: {}",
        result.getTotalScanned(),
        result.getOrphansDeleted(),
        result.getOrphanFailures());
    return result;
  }

  private int cleanupBatch(List<IngestionPipeline> pipelines, Result result) {
    List<String> ids = pipelines.stream().map(pipeline -> pipeline.getId().toString()).toList();
    Set<String> withContainer = idsWithContainer(ids);

    int deletedInBatch = 0;
    for (IngestionPipeline pipeline : pipelines) {
      if (!withContainer.contains(pipeline.getId().toString())) {
        deletedInBatch += handleOrphan(pipeline, result);
      }
    }
    return deletedInBatch;
  }

  /**
   * Records and (unless dry run) deletes one orphan. Returns 1 if a row was actually removed (so the
   * caller can adjust its paging offset), 0 otherwise.
   */
  private int handleOrphan(IngestionPipeline pipeline, Result result) {
    boolean removed = !dryRun && deleteOrphan(pipeline);
    int rowsRemoved = 0;
    if (dryRun || removed) {
      result.setOrphansDeleted(result.getOrphansDeleted() + 1);
      if (removed) {
        rowsRemoved = 1;
      }
    } else {
      result.setOrphanFailures(result.getOrphanFailures() + 1);
    }
    return rowsRemoved;
  }

  private Set<String> idsWithContainer(List<String> pipelineIds) {
    List<EntityRelationshipObject> records =
        collectionDAO
            .relationshipDAO()
            .findFromBatch(pipelineIds, INGESTION_PIPELINE, Relationship.CONTAINS.ordinal());
    Set<String> withContainer = new HashSet<>();
    for (EntityRelationshipObject record : records) {
      withContainer.add(record.getToId());
    }
    return withContainer;
  }

  private List<IngestionPipeline> parsePipelines(List<String> jsonBatch) {
    List<IngestionPipeline> pipelines = new ArrayList<>(jsonBatch.size());
    for (String json : jsonBatch) {
      try {
        IngestionPipeline pipeline = JsonUtils.readValue(json, IngestionPipeline.class);
        // Skip soft-deleted pipelines — kept on purpose, and the cascade would no-op anyway.
        if (!Boolean.TRUE.equals(pipeline.getDeleted())) {
          pipelines.add(pipeline);
        }
      } catch (Exception ex) {
        LOG.warn("Skipping unparseable ingestion pipeline row: {}", ex.getMessage());
      }
    }
    return pipelines;
  }

  private boolean deleteOrphan(IngestionPipeline pipeline) {
    UUID id = pipeline.getId();
    boolean deleted;
    try {
      Entity.deleteEntity(Entity.ADMIN_USER_NAME, INGESTION_PIPELINE, id, true, true);
      deleted = true;
    } catch (Exception ex) {
      // The standard delete resolves the pipeline's container; for a missing container that
      // resolution itself throws "does not have expected relationship", so a broken pipeline cannot
      // be removed the normal way. Fall back to a direct delete of its DB footprint.
      LOG.warn(
          "Standard delete failed for ingestion pipeline {} ({}); falling back to direct cleanup",
          id,
          ex.getMessage());
      deleted = forceDelete(pipeline);
    }
    return deleted;
  }

  private boolean forceDelete(IngestionPipeline pipeline) {
    UUID id = pipeline.getId();
    boolean deleted;
    try {
      // Drop the search doc by id (no-op when the broken pipeline was never indexed; this does not
      // rebuild the doc, so it won't re-trigger the container resolution).
      try {
        Entity.getSearchRepository().deleteEntityIndex(pipeline);
      } catch (Exception ex) {
        LOG.debug(
            "Search-index cleanup skipped for ingestion pipeline {}: {}", id, ex.getMessage());
      }
      // Remove its pipeline-status time series, all relationship rows, then the row itself.
      if (!nullOrEmpty(pipeline.getFullyQualifiedName())) {
        collectionDAO
            .entityExtensionTimeSeriesDao()
            .delete(pipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION);
      }
      collectionDAO.relationshipDAO().deleteAll(id, INGESTION_PIPELINE);
      collectionDAO
          .ingestionPipelineDAO()
          .delete(collectionDAO.ingestionPipelineDAO().getTableName(), id);
      deleted = true;
    } catch (Exception ex) {
      LOG.warn("Force delete failed for ingestion pipeline {}: {}", id, ex.getMessage());
      deleted = false;
    }
    return deleted;
  }
}
