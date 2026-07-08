package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.ResponseException;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.SearchUtils;
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
      double threshold,
      String preference) {
    long start = System.currentTimeMillis();
    try {
      float[] queryVector = embeddingClient.embed(query);
      LinkedHashMap<String, List<Map<String, Object>>> byParent = new LinkedHashMap<>();
      int rawOffset = 0;
      long totalHits = -1L;
      boolean exhausted = false;
      int requestedParents = from + size + 1;
      int overFetchSize = Math.max(requestedParents * OVER_FETCH_MULTIPLIER, OVER_FETCH_MULTIPLIER);
      // ES native kNN never returns more than k hits (threshold is applied client-side in
      // collectSearchHits), so a size larger than k fetches nothing extra and, for larger from,
      // can push from+size past index.max_result_window and 400 the request. Clamp unconditionally.
      overFetchSize = Math.min(overFetchSize, k);

      String indexName = getIndexAlias();
      while (!exhausted && byParent.size() < requestedParents) {
        String queryJson =
            VectorSearchQueryBuilder.buildNativeESQuery(
                queryVector, overFetchSize, rawOffset, k, filters, knnNumCandidatesMultiplier);
        String endpoint =
            SearchUtils.appendPreferenceParam("/" + indexName + "/_search", preference);
        String responseBody = executeGenericRequest("POST", endpoint, queryJson);

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
      // Persist the fallback into the result map so consumers (e.g. SemanticSearchTool
      // via copyIfPresent) always see a populated parentId, not just the grouping key.
      hitMap.put("parentId", parentId);
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
      // Rest5Client.performRequest only throws ResponseException on 5xx (its internal
      // isCorrectServerResponse is `code < 500`). 4xx responses are returned normally,
      // so we still need a manual status-code check below for client errors.
      Response response = restClient.performRequest(request);
      int statusCode = response.getStatusCode();
      String responseBody = readEntityBody(response.getEntity());
      if (statusCode >= 400) {
        // 4xx path: Rest5Client returns these normally, so we surface the status
        // and body in the exception message — symmetric to the OS path.
        LOG.error("Generic request failed: {} {} status={}", method, endpoint, statusCode);
        throw new RuntimeException(
            "Elasticsearch request failed with status " + statusCode + ": " + responseBody);
      }
      return responseBody;
    } catch (ResponseException e) {
      // 5xx path: format symmetrically with the OS generic-client error message.
      int statusCode = e.getResponse().getStatusCode();
      String errorBody = readEntityBody(e.getResponse().getEntity());
      LOG.error("Generic request failed: {} {}", method, endpoint, e);
      throw new RuntimeException(
          "Elasticsearch request failed with status " + statusCode + ": " + errorBody, e);
    } catch (RuntimeException e) {
      // Already a RuntimeException with a meaningful message (e.g. our 4xx-status
      // surface). Don't double-wrap and lose the message.
      throw e;
    } catch (Exception e) {
      LOG.error("Generic request failed: {} {}", method, endpoint, e);
      throw new RuntimeException("Elasticsearch generic request failed", e);
    }
  }

  /**
   * Read an HttpEntity body as UTF-8, tolerating a null or unreadable entity. Some ES
   * endpoints return no body on 4xx; dereferencing entity.getContent() unconditionally
   * would NPE and mask the real HTTP status.
   */
  private static String readEntityBody(org.apache.hc.core5.http.HttpEntity entity) {
    if (entity == null) {
      return "";
    }
    try (InputStream is = entity.getContent()) {
      return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    } catch (Exception ignored) {
      return "";
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

  /**
   * Per-entity input to {@link #getExistingEmbeddingsBatch(String, Map)}. Mirrors the OpenSearch
   * service; kept engine-local so the ES path stays self-contained.
   */
  public record EntityFingerprintInput(Long updatedAt, Supplier<String> currentFingerprint) {}

  private static final List<String> FINGERPRINT_HEADER_FIELDS = List.of("fingerprint", "updatedAt");

  private static final List<String> EMBEDDING_SOURCE_FIELDS =
      List.of(
          "fingerprint",
          "embedding",
          "textToLLMContext",
          "textToEmbed",
          "chunkIndex",
          "chunkCount",
          "parentId");

  /**
   * Two-step batch fetch of cached embedding documents for entities whose cached state matches the
   * caller-provided current state. Step 1 reads only fingerprint+updatedAt and keeps matching ids;
   * step 2 pulls the full embedding _source for those, so large vectors stay off the wire for
   * entities that will be re-embedded anyway. Mirrors OpenSearchVectorService (ES uses _search).
   */
  public Map<String, JsonNode> getExistingEmbeddingsBatch(
      String indexName, Map<String, EntityFingerprintInput> currentById) {
    if (currentById == null || currentById.isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      List<String> entityIds = new ArrayList<>(currentById.keySet());
      List<String> matchingIds = new ArrayList<>();
      for (Map.Entry<String, JsonNode> entry :
          fetchSourceByIds(indexName, entityIds, FINGERPRINT_HEADER_FIELDS).entrySet()) {
        EntityFingerprintInput input = currentById.get(entry.getKey());
        if (input != null
            && entry.getValue().isObject()
            && cachedStateMatches(entry.getValue(), input)) {
          matchingIds.add(entry.getKey());
        }
      }
      if (matchingIds.isEmpty()) {
        return Collections.emptyMap();
      }
      Map<String, JsonNode> result = new HashMap<>();
      for (Map.Entry<String, JsonNode> entry :
          fetchSourceByIds(indexName, matchingIds, EMBEDDING_SOURCE_FIELDS).entrySet()) {
        if (isSpliceable(entry.getValue())) {
          result.put(entry.getKey(), entry.getValue());
        }
      }
      return result;
    } catch (Exception e) {
      LOG.error("Failed to batch get embeddings in index={}", indexName, e);
      return Collections.emptyMap();
    }
  }

  private static boolean cachedStateMatches(JsonNode header, EntityFingerprintInput input) {
    JsonNode cachedUpdatedAt = header.path("updatedAt");
    if (cachedUpdatedAt.isIntegralNumber()
        && input.updatedAt() != null
        && cachedUpdatedAt.asLong() == input.updatedAt()) {
      return true;
    }
    String cachedFp = header.path("fingerprint").asText(null);
    return cachedFp != null && cachedFp.equals(input.currentFingerprint().get());
  }

  private static boolean isSpliceable(JsonNode cached) {
    if (cached == null || !cached.isObject()) {
      return false;
    }
    JsonNode embedding = cached.path("embedding");
    if (!embedding.isArray() || embedding.isEmpty()) {
      return false;
    }
    JsonNode fingerprint = cached.path("fingerprint");
    return fingerprint.isTextual() && !fingerprint.asText().isBlank();
  }

  private Map<String, JsonNode> fetchSourceByIds(
      String indexName, List<String> ids, List<String> sourceFields) {
    Map<String, JsonNode> result = new HashMap<>();
    try {
      String query =
          "{\"size\":"
              + ids.size()
              + ",\"_source\":"
              + toJsonArray(sourceFields, false)
              + ",\"query\":{\"ids\":{\"values\":"
              + toJsonArray(ids, true)
              + "}}}";
      String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
      JsonNode hits = MAPPER.readTree(response).path("hits").path("hits");
      for (JsonNode hit : hits) {
        result.put(hit.path("_id").asText(), hit.path("_source"));
      }
    } catch (Exception e) {
      LOG.error("Failed to fetch _source by ids in index={}: {}", indexName, e.getMessage(), e);
    }
    return result;
  }

  private static String toJsonArray(List<String> values, boolean escapeForQuery) {
    StringBuilder array = new StringBuilder("[");
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) {
        array.append(',');
      }
      String value =
          escapeForQuery ? VectorSearchQueryBuilder.escape(values.get(i)) : values.get(i);
      array.append("\"").append(value).append("\"");
    }
    return array.append("]").toString();
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
    // No-op by design, mirroring OpenSearchVectorService. The elasticsearch-java client stored
    // here was constructed elsewhere and its Rest5Client transport is shared with
    // ElasticSearchClient and every other manager. Closing the transport from here would shut
    // down HTTP I/O for the whole application (the same failure mode as the OpenSearch
    // "I/O reactor has been shut down" production incident).
  }
}
