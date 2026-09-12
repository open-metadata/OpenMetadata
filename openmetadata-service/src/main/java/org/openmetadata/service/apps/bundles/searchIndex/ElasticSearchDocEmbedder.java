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
import org.openmetadata.service.search.vector.ElasticSearchVectorService;

/**
 * The vector-embedding half of {@link ElasticSearchBulkSink}: splice a reusable cached embedding
 * into a rebuilt document, or pay for a fresh one.
 *
 * <p>Separate from {@link OpenSearchDocEmbedder} on purpose. The two enrich paths have genuinely
 * diverged — OpenSearch grew multi-chunk docs, chunk backfill, and a provider circuit check
 * (issue #4789) that run through the middle of the method — so a shared template would be mostly
 * hooks. What the two actually have in common is already shared: the reuse predicate and the
 * source-index rule in {@link BulkSinkSupport}, and the stats arithmetic in {@link BulkCounters}.
 */
@Slf4j
final class ElasticSearchDocEmbedder {

  private final ObjectMapper objectMapper;
  private final AtomicLong success = new AtomicLong(0);
  private final AtomicLong failed = new AtomicLong(0);

  ElasticSearchDocEmbedder(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /**
   * Returns {@code json} enriched with embedding fields, or {@code json} unchanged when embedding is
   * not applicable or fails. Never throws: an entity that cannot be embedded is still worth
   * indexing.
   */
  String enrich(
      EntityInterface entity,
      String json,
      Map<String, JsonNode> existingEmbeddingsById,
      StageStatsTracker tracker) {
    try {
      // Per-instance gate, mirroring VectorEmbeddingHandler: the entity-type check the sink already
      // made cannot see that an individual ContextMemory is Private/Shared, and the vector query
      // path carries no per-document visibility filter.
      if (!Entity.isVectorEmbeddable(entity)) {
        return json;
      }
      ElasticSearchVectorService vectorService = ElasticSearchVectorService.getInstance();
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
      int expectedDimension =
          vectorService.getEmbeddingClient() != null
              ? vectorService.getEmbeddingClient().getDimension()
              : -1;
      JsonNode cached = existingEmbeddingsById.get(entity.getId().toString());
      if (BulkSinkSupport.canReuseCachedEmbedding(cached, expectedDimension)) {
        // Splice the cached embedding so the full index op carries the vector instead of stripping
        // it; the service-layer pre-filter only admits state-matched entries.
        doc.setAll((ObjectNode) cached);
      } else {
        Map<String, Object> embeddingFields = vectorService.generateEmbeddingFields(entity);
        doc.setAll((ObjectNode) objectMapper.valueToTree(embeddingFields));
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
      Map<String, ElasticSearchVectorService.EntityFingerprintInput> currentById,
      String indexName,
      ReindexContext reindexContext) {
    try {
      ElasticSearchVectorService vectorService = ElasticSearchVectorService.getInstance();
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
