package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public interface VectorIndexService {

  String VECTOR_EMBEDDING_ALIAS = "dataAssetEmbeddings";

  Logger EMBEDDING_LOG = LoggerFactory.getLogger(VectorIndexService.class);

  /** Header fields fetched in step 1 of {@link #getExistingEmbeddingsBatch} to decide reuse. */
  List<String> FINGERPRINT_HEADER_FIELDS = List.of("fingerprint", "updatedAt");

  /** Full embedding {@code _source} fetched in step 2 for entities whose cached state matches. */
  List<String> EMBEDDING_SOURCE_FIELDS =
      List.of(
          "fingerprint",
          "embedding",
          "textToLLMContext",
          "textToEmbed",
          "chunkIndex",
          "chunkCount",
          "parentId");

  Map<String, Object> generateEmbeddingFields(EntityInterface entity);

  EmbeddingClient getEmbeddingClient();

  void updateEntityEmbedding(EntityInterface entity, String entityIndexName);

  default VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold) {
    return search(query, filters, size, from, k, threshold, null);
  }

  VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold,
      String preference);

  String getExistingFingerprint(String indexName, String entityId);

  Map<String, String> getExistingFingerprintsBatch(String indexName, List<String> entityIds);

  String executeGenericRequest(String method, String endpoint, String body);

  default String getIndexAlias() {
    try {
      String clusterAlias = Entity.getSearchRepository().getClusterAlias();
      if (clusterAlias == null || clusterAlias.isEmpty()) {
        return VECTOR_EMBEDDING_ALIAS;
      }
      return clusterAlias + "_" + VECTOR_EMBEDDING_ALIAS;
    } catch (Exception ex) {
      return VECTOR_EMBEDDING_ALIAS;
    }
  }

  /**
   * Per-entity input to {@link #getExistingEmbeddingsBatch(String, Map)}. {@code currentFingerprint}
   * is a {@link Supplier} so the caller doesn't pay the MD5 + meta-text construction cost when the
   * cheaper {@code updatedAt} fast-path resolves the match. {@code updatedAt} may be {@code null} for
   * entities that don't expose it; in that case the supplier is consulted unconditionally.
   */
  record EntityFingerprintInput(Long updatedAt, Supplier<String> currentFingerprint) {}

  /**
   * Engine-specific primitive: fetch {@code sourceFields} of the documents with the given ids from
   * {@code indexName}, keyed by document id. Implemented per engine (Elasticsearch {@code _search},
   * OpenSearch {@code mget}); the reuse orchestration in {@link #getExistingEmbeddingsBatch} is
   * shared on top of it.
   */
  Map<String, JsonNode> fetchSourceByIds(
      String indexName, List<String> ids, List<String> sourceFields);

  /**
   * Two-step batch fetch of cached embedding documents shared by both engines. Step 1 reads only
   * {@code fingerprint} + {@code updatedAt} for every requested id and keeps the ids whose cached
   * state matches the caller-provided current state (fast-path on {@code updatedAt}, fallback on the
   * lazy fingerprint supplier). Step 2 pulls the full embedding {@code _source} only for those
   * matching ids, so large vector payloads stay off the wire for entities that will be re-embedded
   * anyway. A returned value is safe to splice into a staged index document without regenerating.
   */
  default Map<String, JsonNode> getExistingEmbeddingsBatch(
      String indexName, Map<String, EntityFingerprintInput> currentById) {
    Map<String, JsonNode> result = Collections.emptyMap();
    if (currentById != null && !currentById.isEmpty()) {
      try {
        List<String> entityIds = new ArrayList<>(currentById.keySet());
        Map<String, JsonNode> headers =
            fetchSourceByIds(indexName, entityIds, FINGERPRINT_HEADER_FIELDS);
        List<String> matchingIds = new ArrayList<>();
        for (Map.Entry<String, JsonNode> entry : headers.entrySet()) {
          EntityFingerprintInput input = currentById.get(entry.getKey());
          if (input != null
              && entry.getValue().isObject()
              && cachedStateMatches(entry.getValue(), input)) {
            matchingIds.add(entry.getKey());
          }
        }
        if (!matchingIds.isEmpty()) {
          Map<String, JsonNode> spliceable = new HashMap<>();
          for (Map.Entry<String, JsonNode> entry :
              fetchSourceByIds(indexName, matchingIds, EMBEDDING_SOURCE_FIELDS).entrySet()) {
            if (isSpliceable(entry.getValue())) {
              spliceable.put(entry.getKey(), entry.getValue());
            }
          }
          result = spliceable;
        }
      } catch (Exception e) {
        EMBEDDING_LOG.error("Failed to batch get embeddings in index={}", indexName, e);
      }
    }
    return result;
  }

  private static boolean cachedStateMatches(JsonNode header, EntityFingerprintInput input) {
    JsonNode cachedUpdatedAt = header.path("updatedAt");
    boolean matches;
    if (cachedUpdatedAt.isIntegralNumber()
        && input.updatedAt() != null
        && cachedUpdatedAt.asLong() == input.updatedAt()) {
      matches = true;
    } else {
      String cachedFp = header.path("fingerprint").asText(null);
      matches = cachedFp != null && cachedFp.equals(input.currentFingerprint().get());
    }
    return matches;
  }

  private static boolean isSpliceable(JsonNode cached) {
    boolean spliceable = false;
    if (cached != null && cached.isObject()) {
      JsonNode embedding = cached.path("embedding");
      JsonNode fingerprint = cached.path("fingerprint");
      spliceable =
          embedding.isArray()
              && !embedding.isEmpty()
              && fingerprint.isTextual()
              && !fingerprint.asText().isBlank();
    }
    return spliceable;
  }

  /**
   * Splice-site guard used by the bulk sinks: a cached embedding is reusable only when it is
   * {@link #isSpliceable} and its vector length matches {@code expectedDimension} (the current
   * embedding client's dimension). The dimension check is essential because the reuse pre-filter
   * keys only on entity content, which does not change when the embedding model/dimension changes.
   * When {@code expectedDimension} is non-positive (no active client) the dimension check is skipped.
   */
  static boolean canReuseCachedEmbedding(JsonNode cached, int expectedDimension) {
    boolean reusable = isSpliceable(cached);
    if (reusable && expectedDimension > 0) {
      reusable = cached.path("embedding").size() == expectedDimension;
    }
    return reusable;
  }
}
