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
import java.util.Optional;
import java.util.function.Supplier;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.MgetResponse;
import os.org.opensearch.client.opensearch.core.get.GetResult;
import os.org.opensearch.client.opensearch.core.mget.MultiGetResponseItem;
import os.org.opensearch.client.opensearch.generic.Body;
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

  public static synchronized void init(OpenSearchClient client, EmbeddingClient embeddingClient) {
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
    // No-op by design. The opensearch-java client stored here was constructed
    // elsewhere and its transport is shared with OpenSearchClient and every
    // other manager. Closing the transport from here permanently shuts down
    // the HC5 IOReactor for the whole application, which was a root cause of
    // production "I/O reactor has been shut down" errors.
  }

  public void ensureHybridSearchPipeline(double keywordWeight, double semanticWeight) {
    var weights = MAPPER.createArrayNode().add(keywordWeight).add(semanticWeight);
    var combination =
        MAPPER
            .createObjectNode()
            .put("technique", "rrf")
            .put("rank_constant", 30)
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

  public Optional<String> checkHybridSearchPipeline() {
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var request =
          Requests.builder()
              .endpoint("/_search/pipeline/" + HYBRID_PIPELINE_NAME)
              .method("GET")
              .build();
      try (var response = genericClient.execute(request)) {
        int status = response.getStatus();
        if (status < 400) {
          return Optional.empty();
        }
        if (status == 404) {
          return Optional.of(
              "Hybrid search pipeline '"
                  + HYBRID_PIPELINE_NAME
                  + "' not found. Run a reindex to create it.");
        }
        String detail =
            response
                .getBody()
                .map(
                    b -> {
                      try {
                        String body = new String(b.bodyAsBytes(), StandardCharsets.UTF_8);
                        return body.length() > 200 ? body.substring(0, 200) : body;
                      } catch (Exception ignored) {
                        return "";
                      }
                    })
                .orElse("");
        return Optional.of(
            "Unexpected status "
                + status
                + " when checking hybrid search pipeline '"
                + HYBRID_PIPELINE_NAME
                + "'."
                + (detail.isEmpty() ? "" : " Response: " + detail));
      }
    } catch (Exception e) {
      LOG.error("Failed to check hybrid search pipeline '{}'", HYBRID_PIPELINE_NAME, e);
      return Optional.of("Failed to check hybrid search pipeline: " + e.toString());
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

  private static final String CHUNK_INDEX_BASE = "data_asset_embeddings_chunks";
  private volatile boolean chunkIndexEnsured = false;

  /**
   * Name of the dedicated chunk index (issue #4789). Lives alongside the entity indices; the
   * {@code dataAssetEmbeddings} alias is attached to it so the vector read path sees chunk docs
   * together with legacy entity-doc embeddings during migration.
   */
  public String getChunkIndexName() {
    String clusterAlias = null;
    try {
      clusterAlias = Entity.getSearchRepository().getClusterAlias();
    } catch (Exception ignored) {
      // No SearchRepository in standalone/test contexts; fall back to the unprefixed name.
    }
    return clusterAlias == null || clusterAlias.isEmpty()
        ? CHUNK_INDEX_BASE
        : clusterAlias.toLowerCase(java.util.Locale.ROOT) + "_" + CHUNK_INDEX_BASE;
  }

  @Override
  public void updateEntityEmbeddingChunks(EntityInterface entity) {
    ensureChunkIndex();
    updateEntityEmbeddingChunks(entity, getChunkIndexName());
  }

  @Override
  public void deleteEntityChunks(String parentId) {
    try {
      deleteChunksByParent(getChunkIndexName(), parentId);
    } catch (Exception e) {
      LOG.debug("Failed to delete chunks for {}: {}", parentId, e.getMessage());
    }
  }

  /**
   * Idempotently creates the dedicated chunk index (dynamic:false mapping with the KNN vector and
   * the filter fields the vector query uses) and attaches the {@code dataAssetEmbeddings} alias so
   * reads cover both legacy entity-doc embeddings and the new chunk docs.
   */
  private void ensureChunkIndex() {
    if (!chunkIndexEnsured) {
      synchronized (this) {
        if (!chunkIndexEnsured) {
          createChunkIndexIfAbsent();
          chunkIndexEnsured = true;
        }
      }
    }
  }

  private void createChunkIndexIfAbsent() {
    String indexName = getChunkIndexName();
    try {
      boolean exists = client.indices().exists(e -> e.index(indexName)).value();
      if (!exists) {
        executeGenericRequest("PUT", "/" + indexName, buildChunkIndexMapping());
        LOG.info("Created dedicated vector chunk index {}", indexName);
      }
    } catch (Exception e) {
      LOG.error("Failed to ensure chunk index {}: {}", indexName, e.getMessage());
    }
  }

  private String buildChunkIndexMapping() {
    var method =
        MAPPER
            .createObjectNode()
            .put("name", "hnsw")
            .put("engine", "lucene")
            .put("space_type", "cosinesimil")
            .set("parameters", MAPPER.createObjectNode().put("m", 48).put("ef_construction", 256));
    var embedding =
        MAPPER
            .createObjectNode()
            .put("type", "knn_vector")
            .put("dimension", embeddingClient.getDimension())
            .set("method", method);
    var properties = MAPPER.createObjectNode();
    properties.set("embedding", embedding);
    for (String keyword :
        List.of(
            "parentId", "fingerprint", "entityType", "name", "displayName", "fullyQualifiedName")) {
      properties.set(keyword, MAPPER.createObjectNode().put("type", "keyword"));
    }
    for (String integer : List.of("chunkIndex", "chunkCount")) {
      properties.set(integer, MAPPER.createObjectNode().put("type", "integer"));
    }
    for (String text : List.of("textToEmbed", "textToLLMContext")) {
      properties.set(text, MAPPER.createObjectNode().put("type", "text"));
    }
    properties.set("deleted", MAPPER.createObjectNode().put("type", "boolean"));
    properties.set("tags", nestedKeyword("tagFQN"));
    properties.set("domains", nestedKeyword("name"));
    properties.set("tier", nestedKeyword("tagFQN"));
    properties.set(
        "relatedTerms", MAPPER.createObjectNode().put("type", "object").put("enabled", false));
    var mappings = MAPPER.createObjectNode().put("dynamic", "false").set("properties", properties);
    var root = MAPPER.createObjectNode();
    root.set(
        "settings",
        MAPPER.createObjectNode().set("index", MAPPER.createObjectNode().put("knn", true)));
    root.set("mappings", mappings);
    root.set("aliases", MAPPER.createObjectNode().set(getSearchAlias(), MAPPER.createObjectNode()));
    return root.toString();
  }

  private com.fasterxml.jackson.databind.node.ObjectNode nestedKeyword(String field) {
    return (com.fasterxml.jackson.databind.node.ObjectNode)
        MAPPER
            .createObjectNode()
            .set(
                "properties",
                MAPPER
                    .createObjectNode()
                    .set(field, MAPPER.createObjectNode().put("type", "keyword")));
  }

  /**
   * Multi-chunk write path (issue #4789): index one standalone document per body chunk into the
   * dedicated chunk index, keyed {@code <parentId>_<chunkIndex>}, after deleting the entity's stale
   * chunks so a shrinking body never leaves orphans. Skips work when the whole-body fingerprint is
   * unchanged. Unlike the legacy {@link #updateEntityEmbedding} partial-update, each chunk doc is a
   * complete, independently filterable/rankable document.
   */
  public void updateEntityEmbeddingChunks(EntityInterface entity, String chunkIndexName) {
    try {
      String parentId = entity.getId().toString();
      if (chunkFingerprintUnchanged(chunkIndexName, parentId, entity)) {
        LOG.debug("Skipping chunk embedding for {} - fingerprint unchanged", parentId);
        return;
      }
      List<Map<String, Object>> chunkDocs = VectorDocBuilder.fromEntity(entity, embeddingClient);
      deleteChunksByParent(chunkIndexName, parentId);
      bulkIndexChunks(chunkIndexName, parentId, chunkDocs);
    } catch (Exception e) {
      LOG.error("Failed to update chunk embeddings for {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private boolean chunkFingerprintUnchanged(
      String indexName, String parentId, EntityInterface entity) {
    String existing = getExistingChunkFingerprint(indexName, parentId);
    String current = VectorDocBuilder.computeFingerprintForEntity(entity);
    return current.equals(existing);
  }

  private String getExistingChunkFingerprint(String indexName, String parentId) {
    String fingerprint = null;
    try {
      String query =
          "{\"size\":1,\"_source\":[\"fingerprint\"],\"query\":{\"term\":{\"parentId\":\""
              + VectorSearchQueryBuilder.escape(parentId)
              + "\"}}}";
      String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
      JsonNode hits = MAPPER.readTree(response).path("hits").path("hits");
      if (hits.isArray() && !hits.isEmpty()) {
        fingerprint = hits.get(0).path("_source").path("fingerprint").asText(null);
      }
    } catch (Exception e) {
      LOG.debug(
          "No existing chunk fingerprint for {} in {}: {}", parentId, indexName, e.getMessage());
    }
    return fingerprint;
  }

  private void deleteChunksByParent(String indexName, String parentId) {
    String body =
        "{\"query\":{\"term\":{\"parentId\":\""
            + VectorSearchQueryBuilder.escape(parentId)
            + "\"}}}";
    executeGenericRequest("POST", "/" + indexName + "/_delete_by_query?refresh=true", body);
  }

  private void bulkIndexChunks(
      String indexName, String parentId, List<Map<String, Object>> chunkDocs) throws IOException {
    if (chunkDocs.isEmpty()) {
      return;
    }
    StringBuilder bulk = new StringBuilder();
    for (int i = 0; i < chunkDocs.size(); i++) {
      bulk.append("{\"index\":{\"_index\":\"")
          .append(indexName)
          .append("\",\"_id\":\"")
          .append(parentId)
          .append('_')
          .append(i)
          .append("\"}}\n")
          .append(MAPPER.writeValueAsString(chunkDocs.get(i)))
          .append('\n');
    }
    executeGenericRequest("POST", "/_bulk?refresh=true", bulk.toString());
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
      int requestedParents = from + size + 1; // Fetch one extra parent so hasMore is accurate.
      int overFetchSize = Math.max(requestedParents * OVER_FETCH_MULTIPLIER, OVER_FETCH_MULTIPLIER);
      if (threshold <= 0.0) {
        overFetchSize = Math.min(overFetchSize, k);
      }

      String aliasName = getSearchAlias();
      while (!exhausted && byParent.size() < requestedParents) {
        String queryJson =
            VectorSearchQueryBuilder.build(
                queryVector, overFetchSize, rawOffset, k, filters, threshold);
        String endpoint =
            SearchUtils.appendPreferenceParam("/" + aliasName + "/_search", preference);
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
      // When threshold > 0, OpenSearch already applies min_score at the KNN query level.
      // This post-filter acts as a safety net for the no-threshold case (k-based retrieval),
      // where low-scoring neighbors may still be returned to fill the k count.
      if (score < threshold) {
        continue;
      }

      Map<String, Object> hitMap = MAPPER.convertValue(hit.path("_source"), Map.class);
      hitMap.put("_score", score);

      String parentId = (String) hitMap.getOrDefault("parentId", hit.path("_id").asText());
      List<Map<String, Object>> group =
          byParent.computeIfAbsent(parentId, ignored -> new ArrayList<>());
      // During chunk-index migration the same chunk can surface twice — once from the legacy
      // entity-doc embedding and once from the dedicated chunk index. Keep the first (higher
      // scoring) occurrence per chunkIndex.
      if (!isDuplicateChunk(group, hitMap.get("chunkIndex"))) {
        group.add(hitMap);
      }
    }
    return pageHitCount;
  }

  private static boolean isDuplicateChunk(List<Map<String, Object>> group, Object chunkIndex) {
    boolean duplicate = false;
    if (chunkIndex != null) {
      for (Map<String, Object> member : group) {
        if (chunkIndex.equals(member.get("chunkIndex"))) {
          duplicate = true;
          break;
        }
      }
    }
    return duplicate;
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

  private static final List<String> EMBEDDING_SOURCE_FIELDS =
      List.of(
          "fingerprint",
          "embedding",
          "textToLLMContext",
          "textToEmbed",
          "chunkIndex",
          "chunkCount",
          "parentId");

  // Jackson-backed mapper so JsonData.to(JsonNode.class, ...) deserializes via Jackson
  // and produces a tree of Jackson types (TextNode, ArrayNode, etc.) rather than
  // jakarta.json.JsonValue wrappers like org.glassfish.json.JsonStringImpl.
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER = new JacksonJsonpMapper(MAPPER);

  /**
   * Per-entity input to {@link #getExistingEmbeddingsBatch(String, Map)}. {@code currentFingerprint}
   * is a {@link Supplier} so the caller doesn't pay the MD5 + meta-text construction cost when the
   * cheaper {@code updatedAt} fast-path resolves the match. {@code updatedAt} may be {@code null}
   * for entities that don't expose it; in that case the supplier is consulted unconditionally.
   */
  public record EntityFingerprintInput(Long updatedAt, Supplier<String> currentFingerprint) {}

  private static final List<String> FINGERPRINT_HEADER_FIELDS = List.of("fingerprint", "updatedAt");

  /**
   * Two-step batch fetch of cached embedding documents from {@code indexName}, scoped to entities
   * whose cached state matches the caller-provided current state. Designed to keep large vector
   * payloads off the wire for entities that will be re-embedded anyway.
   *
   * <p>Step 1 — {@code mget} {@code fingerprint} + {@code updatedAt} only for every requested ID,
   * then decide which IDs "match":
   *
   * <ul>
   *   <li>Fast path: cached {@code updatedAt} equals current {@code updatedAt} — the entity hasn't
   *       been touched since the prior index, so the embedding is reusable without recomputing the
   *       fingerprint.
   *   <li>Fallback: the lazy fingerprint {@link Supplier} is invoked and compared against the
   *       cached fingerprint.
   * </ul>
   *
   * <p>Step 2 — issue a second {@code mget} that pulls the full embedding {@code _source} only for
   * matching IDs. Entries that don't match are dropped, and the caller can rely on every returned
   * value being safe to splice into a staged index document.
   */
  public Map<String, JsonNode> getExistingEmbeddingsBatch(
      String indexName, Map<String, EntityFingerprintInput> currentById) {
    if (currentById == null || currentById.isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      List<String> entityIds = new ArrayList<>(currentById.keySet());
      MgetResponse<JsonData> headerResponse =
          client.mget(
              m -> m.index(indexName).ids(entityIds).sourceIncludes(FINGERPRINT_HEADER_FIELDS),
              JsonData.class);

      List<String> matchingIds = new ArrayList<>();
      for (MultiGetResponseItem<JsonData> item : headerResponse.docs()) {
        if (!item.isResult()) {
          continue;
        }
        GetResult<JsonData> doc = item.result();
        if (!doc.found() || doc.source() == null) {
          continue;
        }
        JsonNode header = doc.source().to(JsonNode.class, JACKSON_JSONP_MAPPER);
        if (header == null || !header.isObject()) {
          continue;
        }
        EntityFingerprintInput input = currentById.get(doc.id());
        if (input == null) {
          continue;
        }
        if (cachedStateMatches(header, input)) {
          matchingIds.add(doc.id());
        }
      }
      if (matchingIds.isEmpty()) {
        return Collections.emptyMap();
      }

      MgetResponse<JsonData> response =
          client.mget(
              m -> m.index(indexName).ids(matchingIds).sourceIncludes(EMBEDDING_SOURCE_FIELDS),
              JsonData.class);

      Map<String, JsonNode> result = new HashMap<>();
      for (MultiGetResponseItem<JsonData> item : response.docs()) {
        if (!item.isResult()) {
          continue;
        }
        GetResult<JsonData> doc = item.result();
        if (!doc.found() || doc.source() == null) {
          continue;
        }
        JsonNode cached = doc.source().to(JsonNode.class, JACKSON_JSONP_MAPPER);
        if (isSpliceable(cached)) {
          result.put(doc.id(), cached);
        }
      }
      return result;
    } catch (Exception e) {
      LOG.error("Failed to batch get embeddings in index={}", indexName, e);
      return Collections.emptyMap();
    }
  }

  /**
   * The splice-site contract: callers can rely on every returned entry being a JSON object whose
   * {@code embedding} is a non-empty array and whose {@code fingerprint} is non-blank text.
   * Anything else is dropped — silently, since these only fail on corrupt or partial cached docs
   * that the caller will regenerate from scratch anyway.
   */
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
          String errorBody = response.getBody().map(Body::bodyAsString).orElse("no body");
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
