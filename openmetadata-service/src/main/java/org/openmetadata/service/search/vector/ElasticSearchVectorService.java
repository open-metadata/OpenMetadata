package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.io.InputStream;
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
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

@Slf4j
public class ElasticSearchVectorService implements VectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int OVER_FETCH_MULTIPLIER = 2;

  private static volatile ElasticSearchVectorService instance;

  private final ElasticsearchClient client;
  private final Rest5Client restClient;
  @Getter private final EmbeddingClient embeddingClient;
  private final int knnNumCandidatesMultiplier;

  public ElasticSearchVectorService(
      ElasticsearchClient client, EmbeddingClient embeddingClient, int knnNumCandidatesMultiplier) {
    this.client = client;
    this.restClient = extractRestClient(client);
    this.embeddingClient = embeddingClient;
    this.knnNumCandidatesMultiplier =
        knnNumCandidatesMultiplier > 0
            ? knnNumCandidatesMultiplier
            : VectorSearchQueryBuilder.DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER;
  }

  public ElasticSearchVectorService(ElasticsearchClient client, EmbeddingClient embeddingClient) {
    this(client, embeddingClient, VectorSearchQueryBuilder.DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER);
  }

  private static Rest5Client extractRestClient(ElasticsearchClient client) {
    if (!(client._transport() instanceof Rest5ClientTransport rest5)) {
      throw new IllegalArgumentException(
          "ElasticSearchVectorService requires Rest5ClientTransport, got: "
              + client._transport().getClass().getName());
    }
    return rest5.restClient();
  }

  public static synchronized void init(
      ElasticsearchClient client, EmbeddingClient embeddingClient, int knnNumCandidatesMultiplier) {
    if (instance != null) {
      LOG.warn("ElasticSearchVectorService already initialized, reinitializing");
      EntityLifecycleEventDispatcher.getInstance().unregisterHandler("VectorEmbeddingHandler");
    }
    ElasticSearchVectorService svc =
        new ElasticSearchVectorService(client, embeddingClient, knnNumCandidatesMultiplier);
    svc.registerVectorEmbeddingHandler();
    instance = svc;
    LOG.info(
        "ElasticSearchVectorService initialized with model={}, dimension={}",
        embeddingClient.getModelId(),
        embeddingClient.getDimension());
  }

  public static synchronized void init(
      ElasticsearchClient client, EmbeddingClient embeddingClient) {
    init(client, embeddingClient, VectorSearchQueryBuilder.DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER);
  }

  public static ElasticSearchVectorService getInstance() {
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
      LinkedHashMap<String, List<Map<String, Object>>> byParent = new LinkedHashMap<>();
      int rawOffset = 0;
      long totalHits = -1L;
      boolean exhausted = false;
      int requestedParents = from + size + 1;
      int overFetchSize = Math.max(requestedParents * OVER_FETCH_MULTIPLIER, OVER_FETCH_MULTIPLIER);
      if (threshold <= 0.0) {
        overFetchSize = Math.min(overFetchSize, k);
      }

      String indexName = getIndexAlias();
      while (!exhausted && byParent.size() < requestedParents) {
        String queryJson =
            VectorSearchQueryBuilder.buildNativeESQuery(
                queryVector, overFetchSize, rawOffset, k, filters, knnNumCandidatesMultiplier);
        String responseBody =
            executeGenericRequest("POST", "/" + indexName + "/_search", queryJson);

        JsonNode root = MAPPER.readTree(responseBody);
        JsonNode hitsNode = root.path("hits").path("hits");
        totalHits = extractTotalHits(root);

        int pageHitCount = collectSearchHits(hitsNode, threshold, byParent);
        if (pageHitCount == 0) {
          exhausted = true;
          break;
        }

        rawOffset += pageHitCount;
        exhausted = totalHits >= 0 ? rawOffset >= totalHits : pageHitCount < overFetchSize;
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

      boolean hasMore = byParent.size() > (from + parentCount);
      long tookMillis = System.currentTimeMillis() - start;
      return new VectorSearchResponse(
          tookMillis, results, totalHits >= 0 ? totalHits : null, hasMore);
    } catch (Exception e) {
      LOG.error("Vector search failed: {}", e.getMessage(), e);
      throw new RuntimeException("Vector search failed", e);
    }
  }

  private static int collectSearchHits(
      JsonNode hitsNode,
      double threshold,
      LinkedHashMap<String, List<Map<String, Object>>> byParent) {
    int pageHitCount = 0;
    for (JsonNode hit : hitsNode) {
      pageHitCount++;
      double score = hit.path("_score").asDouble(0.0);
      if (score < threshold) {
        continue;
      }
      Map<String, Object> hitMap = MAPPER.convertValue(hit.path("_source"), Map.class);
      hitMap.put("_score", score);
      String parentId = (String) hitMap.getOrDefault("parentId", hit.path("_id").asText());
      byParent.computeIfAbsent(parentId, ignored -> new ArrayList<>()).add(hitMap);
    }
    return pageHitCount;
  }

  private static long extractTotalHits(JsonNode root) {
    JsonNode totalNode = root.path("hits").path("total");
    if (totalNode.isIntegralNumber()) {
      return totalNode.asLong(-1L);
    }
    if (totalNode.isObject()) {
      return totalNode.path("value").asLong(-1L);
    }
    return -1L;
  }

  @Override
  public String executeGenericRequest(String method, String endpoint, String body) {
    try {
      Request request = new Request(method, endpoint);
      if (body != null) {
        request.setJsonEntity(body);
      }
      Response response = restClient.performRequest(request);
      int statusCode = response.getStatusCode();
      try (InputStream is = response.getEntity().getContent()) {
        String responseBody = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        if (statusCode >= 400) {
          throw new IOException(
              "Elasticsearch request failed with status " + statusCode + ": " + responseBody);
        }
        return responseBody;
      }
    } catch (Exception e) {
      LOG.error("Generic request failed: {} {}", method, endpoint, e);
      throw new RuntimeException("Elasticsearch generic request failed", e);
    }
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

  @Override
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

  public void close() {
    try {
      if (client != null && client._transport() != null) {
        client._transport().close();
      }
    } catch (Exception e) {
      LOG.warn("Error closing Elasticsearch transport: {}", e.getMessage());
    }
  }
}
