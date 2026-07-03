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
package org.openmetadata.service.apps.bundles.searchIndex;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Engine-agnostic embedding-reuse logic shared by the Elasticsearch and OpenSearch bulk sinks. Both
 * sinks index via full document replacement, so a state-matched entity must carry its embedding on
 * the re-indexed doc — otherwise an incremental reindex strips the stored vector. Everything here
 * operates on the {@link VectorIndexService} abstraction; the only per-engine difference (which
 * concrete service is active) is resolved by the caller and passed in.
 */
final class VectorEmbeddingBulkHelper {

  private static final Logger LOG = LoggerFactory.getLogger(VectorEmbeddingBulkHelper.class);

  private VectorEmbeddingBulkHelper() {}

  /** Outcome of an {@link #enrichWithEmbedding} call, so the caller can update its own stats. */
  enum EmbeddingOutcome {
    /** No embedding applied (no active service, or the index doc was not a JSON object). */
    SKIPPED,
    /** Embedding spliced (cached reuse) or regenerated and merged into the doc. */
    ENRICHED,
    /** An error occurred; the original doc JSON is returned unchanged. */
    FAILED
  }

  record EnrichmentResult(String json, EmbeddingOutcome outcome) {}

  /**
   * Build the per-entity reuse inputs. The fingerprint is a lazy supplier so the service-layer
   * {@code updatedAt} fast-path can skip the MD5 + meta-text construction when it already matches.
   */
  static Map<String, VectorIndexService.EntityFingerprintInput> buildCurrentById(
      List<EntityInterface> entities) {
    Map<String, VectorIndexService.EntityFingerprintInput> currentById =
        new HashMap<>(entities.size());
    for (EntityInterface entity : entities) {
      currentById.put(
          entity.getId().toString(),
          new VectorIndexService.EntityFingerprintInput(
              entity.getUpdatedAt(), () -> VectorDocBuilder.computeFingerprintForEntity(entity)));
    }
    return currentById;
  }

  /**
   * Pre-fetch cached embeddings for entities whose state is unchanged. During a recreate the read
   * targets the pre-recreate live (original) index because the staged index is empty by definition;
   * otherwise it reads the canonical index passed in.
   */
  static Map<String, JsonNode> fetchExistingEmbeddings(
      VectorIndexService vectorService,
      List<EntityInterface> entities,
      Map<String, VectorIndexService.EntityFingerprintInput> currentById,
      String indexName,
      ReindexContext reindexContext) {
    Map<String, JsonNode> result = Collections.emptyMap();
    if (vectorService != null && !entities.isEmpty()) {
      try {
        String entityType = entities.getFirst().getEntityReference().getType();
        String sourceIndex =
            reindexContext != null
                ? reindexContext.getOriginalIndex(entityType).orElse(indexName)
                : indexName;
        result = vectorService.getExistingEmbeddingsBatch(sourceIndex, currentById);
      } catch (Exception e) {
        LOG.warn("Failed to fetch existing embeddings (canonical index={})", indexName, e);
      }
    }
    return result;
  }

  /**
   * Always produce a doc that carries an embedding: splice the cached vector when the service layer
   * reports a state match and the dimension is compatible, otherwise regenerate. Never returns the
   * doc embedding-less when a service is active — that would wipe the stored vector on re-index.
   */
  static EnrichmentResult enrichWithEmbedding(
      VectorIndexService vectorService,
      EntityInterface entity,
      String json,
      Map<String, JsonNode> existingEmbeddingsById,
      ObjectMapper mapper) {
    EnrichmentResult result;
    try {
      if (vectorService == null) {
        result = new EnrichmentResult(json, EmbeddingOutcome.SKIPPED);
      } else if (!(mapper.readTree(json) instanceof ObjectNode doc)) {
        LOG.warn(
            "Skipping embedding enrichment for entity {} — index doc is not a JSON object",
            entity.getId());
        result = new EnrichmentResult(json, EmbeddingOutcome.SKIPPED);
      } else {
        spliceOrRegenerate(vectorService, entity, existingEmbeddingsById, doc, mapper);
        result = new EnrichmentResult(mapper.writeValueAsString(doc), EmbeddingOutcome.ENRICHED);
      }
    } catch (Exception e) {
      LOG.warn(
          "Failed to generate embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
      result = new EnrichmentResult(json, EmbeddingOutcome.FAILED);
    }
    return result;
  }

  private static void spliceOrRegenerate(
      VectorIndexService vectorService,
      EntityInterface entity,
      Map<String, JsonNode> existingEmbeddingsById,
      ObjectNode doc,
      ObjectMapper mapper) {
    int expectedDimension =
        vectorService.getEmbeddingClient() != null
            ? vectorService.getEmbeddingClient().getDimension()
            : -1;
    JsonNode cached = existingEmbeddingsById.get(entity.getId().toString());
    if (VectorIndexService.canReuseCachedEmbedding(cached, expectedDimension)) {
      doc.setAll((ObjectNode) cached);
    } else {
      doc.setAll((ObjectNode) mapper.valueToTree(vectorService.generateEmbeddingFields(entity)));
    }
  }
}
