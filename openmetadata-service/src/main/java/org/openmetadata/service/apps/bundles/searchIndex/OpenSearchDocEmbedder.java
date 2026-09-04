/*
 *  Copyright 2026 Collate.
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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;

/**
 * The vector-embedding half of {@link OpenSearchBulkSink}: splice a reusable cached embedding into a
 * rebuilt document, or build the entity's chunk docs and embed those.
 *
 * <p>Separate from {@link ElasticSearchDocEmbedder} on purpose — see that class for why. This side
 * carries the multi-chunk work (issue #4789) the Elasticsearch side does not have.
 */
@Slf4j
final class OpenSearchDocEmbedder {

  private final ObjectMapper objectMapper;
  private final AtomicLong success = new AtomicLong(0);
  private final AtomicLong failed = new AtomicLong(0);

  OpenSearchDocEmbedder(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /**
   * Returns {@code json} enriched with embedding fields, or {@code json} unchanged when embedding is
   * not applicable or fails. Never throws: an entity that cannot be embedded is still worth
   * indexing.
   *
   * @param stagedChunkTarget chunk index to write chunk docs to, or null for the canonical one
   */
  String enrich(
      EntityInterface entity,
      String json,
      Map<String, JsonNode> existingEmbeddingsById,
      StageStatsTracker tracker,
      String stagedChunkTarget) {
    try {
      // Per-instance gate, mirroring VectorEmbeddingHandler: the entity-type check the sink already
      // made cannot see that an individual ContextMemory is Private/Shared, and the vector query
      // path carries no per-document visibility filter.
      if (!Entity.isVectorEmbeddable(entity)) {
        return json;
      }
      OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
      if (vectorService == null) {
        return json;
      }

      JsonNode parsed = objectMapper.readTree(json);
      if (!(parsed instanceof ObjectNode doc)) {
        LOG.warn(
            "Skipping embedding enrichment for entity {} — index doc is not a JSON object",
            entity.getId());
        return json;
      }

      var embeddingClient = vectorService.getEmbeddingClient();
      int expectedDimension = embeddingClient != null ? embeddingClient.getDimension() : -1;
      JsonNode cached = existingEmbeddingsById.get(entity.getId().toString());
      if (BulkSinkSupport.canReuseCachedEmbedding(cached, expectedDimension)) {
        // Splices chunkIndex/chunkCount/parentId along with embedding — safe because the
        // service-layer pre-filter only admits entries whose state matches (same fingerprint or
        // same updatedAt), and fingerprint covers the body text that determines chunk count.
        doc.setAll((ObjectNode) cached);
        // Backfill: the entity content is unchanged, but the dedicated chunk index (issue #4789)
        // may not hold this entity's chunk docs yet (catalogs embedded before multi-chunk
        // shipped). The call is fingerprint-guarded, so it is a cheap no-op once chunks exist;
        // chunk docs reflect committed entity state, so writing them mid-reindex is safe even if
        // the staged index is never promoted.
        vectorService.backfillEntityChunks(entity, stagedChunkTarget);
      } else if (embeddingClient != null && embeddingClient.isAvailable()) {
        // Build the chunk docs once (one embedding call per chunk): chunk 0's embedding fields
        // are spliced into the staged entity doc for hybrid search, and the full set is written to
        // the dedicated chunk index for the semantic vector path (issue #4789). Skipped when the
        // provider circuit is open so a transient outage indexes without embeddings (self-heals on
        // the next reindex) instead of failing every entity.
        List<Map<String, Object>> chunkDocs = VectorDocBuilder.fromEntity(entity, embeddingClient);
        if (!chunkDocs.isEmpty()) {
          doc.setAll(
              (ObjectNode)
                  objectMapper.valueToTree(
                      OpenSearchVectorService.legacyEmbeddingFields(chunkDocs.get(0))));
          vectorService.writeEntityChunks(entity.getId().toString(), chunkDocs, stagedChunkTarget);
        }
      }

      success.incrementAndGet();
      if (tracker != null) {
        tracker.recordVector(StatsResult.SUCCESS);
      }
      return objectMapper.writeValueAsString(doc);
    } catch (Exception e) {
      LOG.warn(
          "Failed to generate embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
      failed.incrementAndGet();
      if (tracker != null) {
        tracker.recordVector(StatsResult.FAILED);
      }
      return json;
    }
  }

  /** Cached embeddings for this batch, keyed by entity id; empty when reuse is unavailable. */
  Map<String, JsonNode> fetchExisting(
      List<EntityInterface> entities,
      Map<String, OpenSearchVectorService.EntityFingerprintInput> currentById,
      String indexName,
      ReindexContext reindexContext) {
    try {
      OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
      if (vectorService == null || entities.isEmpty()) {
        return Collections.emptyMap();
      }
      String entityType = entities.getFirst().getEntityReference().getType();
      String sourceIndex =
          BulkSinkSupport.resolveEmbeddingSourceIndex(reindexContext, entityType, indexName);
      return vectorService.getExistingEmbeddingsBatch(sourceIndex, currentById);
    } catch (Exception e) {
      LOG.warn("Failed to fetch existing embeddings (canonical index={})", indexName, e);
      return Collections.emptyMap();
    }
  }

  StepStats stats() {
    return BulkCounters.statsOf(success.get(), failed.get(), 0L);
  }
}
