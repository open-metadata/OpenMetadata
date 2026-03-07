package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Requests;

@Slf4j
public class OpenSearchVectorService implements VectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int OVER_FETCH_MULTIPLIER = 2;
  public static final String HYBRID_PIPELINE_NAME = "hybrid-rrf";

  private static volatile OpenSearchVectorService instance;

  private final OpenSearchClient client;
  @Getter private final EmbeddingClient embeddingClient;

  public OpenSearchVectorService(OpenSearchClient client, EmbeddingClient embeddingClient) {
    this.client = client;
    this.embeddingClient = embeddingClient;
  }

  public static synchronized void init(
      OpenSearchClient client, EmbeddingClient embeddingClient, String language) {
    if (instance != null) {
      LOG.warn("OpenSearchVectorService already initialized, reinitializing");
    }
    instance = new OpenSearchVectorService(client, embeddingClient);
    instance.registerVectorEmbeddingHandler();
    LOG.info(
        "OpenSearchVectorService initialized with model={}, dimension={}",
        embeddingClient.getModelId(),
        embeddingClient.getDimension());
  }

  public static OpenSearchVectorService getInstance() {
    return instance;
  }

  private void registerVectorEmbeddingHandler() {
    try {
      VectorEmbeddingHandler handler = new VectorEmbeddingHandler(this);
      EntityLifecycleEventDispatcher.getInstance().registerHandler(handler);
      LOG.info("Registered VectorEmbeddingHandler for entity lifecycle events");
    } catch (Exception e) {
      LOG.error("Failed to register VectorEmbeddingHandler", e);
    }
  }

  public void close() {
    try {
      if (client != null && client._transport() != null) {
        client._transport().close();
      }
    } catch (Exception e) {
      LOG.warn("Error closing OpenSearch transport: {}", e.getMessage());
    }
  }

  public void ensureHybridSearchPipeline(double keywordWeight, double semanticWeight) {
    var weights = MAPPER.createArrayNode().add(keywordWeight).add(semanticWeight);
    var combination =
        MAPPER
            .createObjectNode()
            .put("technique", "rrf")
            .put("rank_constant", 60)
            .set("parameters", MAPPER.createObjectNode().set("weights", weights));
    var scoreRanker =
        MAPPER
            .createObjectNode()
            .set(
                "score-ranker-processor",
                MAPPER.createObjectNode().set("combination", combination));
    var collapse =
        MAPPER
            .createObjectNode()
            .set("collapse", MAPPER.createObjectNode().put("field", "parentId"));

    var pipeline = MAPPER.createObjectNode();
    pipeline.set("phase_results_processors", MAPPER.createArrayNode().add(scoreRanker));
    pipeline.set("response_processors", MAPPER.createArrayNode().add(collapse));

    executeGenericRequest("PUT", "/_search/pipeline/" + HYBRID_PIPELINE_NAME, pipeline.toString());
    LOG.info(
        "Hybrid search pipeline '{}' created/updated with weights keyword={}, semantic={}",
        HYBRID_PIPELINE_NAME,
        keywordWeight,
        semanticWeight);
  }

  @Override
  public Map<String, Object> generateEmbeddingFields(EntityInterface entity) {
    return VectorDocBuilder.buildEmbeddingFields(entity, embeddingClient);
  }

  @Override
  public void updateEntityEmbedding(EntityInterface entity, String entityIndexName) {
    try {
      String entityId = entity.getId().toString();
      String existingFingerprint = getExistingFingerprint(entityIndexName, entityId);
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);

      if (currentFingerprint.equals(existingFingerprint)) {
        LOG.debug("Skipping entity {} - fingerprint unchanged", entityId);
        return;
      }

      Map<String, Object> embeddingFields = generateEmbeddingFields(entity);
      partialUpdateEntity(entityIndexName, entityId, embeddingFields);
    } catch (Exception e) {
      LOG.error("Failed to update embedding for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  public VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold) {
    long start = System.currentTimeMillis();
    try {
      float[] queryVector = embeddingClient.embed(query);
      int overFetchSize = (from + size) * OVER_FETCH_MULTIPLIER;

      String queryJson =
          VectorSearchQueryBuilder.build(queryVector, overFetchSize, 0, k, filters, threshold);
      String aliasName = getSearchAlias();
      String responseBody = executeGenericRequest("POST", "/" + aliasName + "/_search", queryJson);

      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode hitsNode = root.path("hits").path("hits");

      LinkedHashMap<String, List<Map<String, Object>>> byParent = new LinkedHashMap<>();
      for (JsonNode hit : hitsNode) {
        double score = hit.path("_score").asDouble(0.0);
        // When threshold > 0, OpenSearch already applies min_score at the KNN query level.
        // This post-filter acts as a safety net for the no-threshold case (k-based retrieval),
        // where low-scoring neighbors may still be returned to fill the k count.
        if (score < threshold) {
          continue;
        }

        Map<String, Object> hitMap = MAPPER.convertValue(hit.path("_source"), Map.class);
        hitMap.put("_score", score);

        String parentId = (String) hitMap.getOrDefault("parentId", hit.path("_id").asText());
        byParent.computeIfAbsent(parentId, kVal -> new ArrayList<>()).add(hitMap);
      }

      List<Map<String, Object>> results = new ArrayList<>();
      int parentCount = 0;
      int skipped = 0;
      for (List<Map<String, Object>> chunks : byParent.values()) {
        if (skipped < from) {
          skipped++;
          continue;
        }
        if (parentCount >= size) {
          break;
        }
        results.addAll(chunks);
        parentCount++;
      }

      long tookMillis = System.currentTimeMillis() - start;
      return new VectorSearchResponse(tookMillis, results);
    } catch (Exception e) {
      LOG.error("Vector search failed: {}", e.getMessage(), e);
      throw new RuntimeException("Vector search failed", e);
    }
  }

  public String getExistingFingerprint(String indexName, String entityId) {
    try {
      String query =
          "{\"size\":1,\"_source\":[\"fingerprint\"],"
              + "\"query\":{\"term\":{\"_id\":\""
              + VectorSearchQueryBuilder.escape(entityId)
              + "\"}}}";
      String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
      JsonNode root = MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");
      if (hits.isArray() && !hits.isEmpty()) {
        return hits.get(0).path("_source").path("fingerprint").asText(null);
      }
    } catch (Exception e) {
      LOG.debug(
          "Failed to get fingerprint for entityId={} in index={}: {}",
          entityId,
          indexName,
          e.getMessage());
    }
    return null;
  }

  public Map<String, String> getExistingFingerprintsBatch(
      String indexName, List<String> entityIds) {
    if (entityIds == null || entityIds.isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      StringBuilder idsArray = new StringBuilder("[");
      for (int i = 0; i < entityIds.size(); i++) {
        if (i > 0) idsArray.append(',');
        idsArray
            .append("\"")
            .append(VectorSearchQueryBuilder.escape(entityIds.get(i)))
            .append("\"");
      }
      idsArray.append("]");

      String query =
          "{\"size\":"
              + entityIds.size()
              + ",\"_source\":[\"fingerprint\"]"
              + ",\"query\":{\"ids\":{\"values\":"
              + idsArray
              + "}}}";

      String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
      JsonNode root = MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      Map<String, String> result = new HashMap<>();
      for (JsonNode hit : hits) {
        String id = hit.path("_id").asText();
        String fp = hit.path("_source").path("fingerprint").asText(null);
        if (id != null && fp != null) {
          result.put(id, fp);
        }
      }
      return result;
    } catch (Exception e) {
      LOG.error("Failed to batch get fingerprints in index={}: {}", indexName, e.getMessage(), e);
      return Collections.emptyMap();
    }
  }

  public void partialUpdateEntity(
      String indexName, String entityId, Map<String, Object> embeddingFields) {
    try {
      String docJson = MAPPER.writeValueAsString(embeddingFields);
      String updateBody = "{\"doc\":" + docJson + "}";
      executeGenericRequest(
          "POST", "/" + indexName + "/_update/" + entityId + "?retry_on_conflict=3", updateBody);
    } catch (Exception e) {
      LOG.error(
          "Failed to partial update entity {} in {}: {}", entityId, indexName, e.getMessage(), e);
    }
  }

  String executeGenericRequest(String method, String endpoint, String body) {
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var request = Requests.builder().endpoint(endpoint).method(method).json(body).build();
      try (var response = genericClient.execute(request)) {
        if (response.getStatus() >= 400) {
          String errorBody = response.getBody().map(b -> b.bodyAsString()).orElse("no body");
          throw new IOException(
              "OpenSearch request failed with status " + response.getStatus() + ": " + errorBody);
        }
        return response
            .getBody()
            .map(
                b -> {
                  try {
                    return new String(b.bodyAsBytes(), StandardCharsets.UTF_8);
                  } catch (Exception e) {
                    return "{}";
                  }
                })
            .orElse("{}");
      }
    } catch (Exception e) {
      LOG.error("Generic request failed: {} {}", method, endpoint, e);
      throw new RuntimeException("OpenSearch generic request failed", e);
    }
  }

  private String getSearchAlias() {
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
}
