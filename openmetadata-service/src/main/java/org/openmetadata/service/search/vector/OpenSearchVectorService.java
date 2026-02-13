package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.stream.JsonParser;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
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
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch._types.mapping.TypeMapping;
import os.org.opensearch.client.opensearch.core.BulkRequest;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;
import os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.opensearch.indices.ExistsRequest;
import os.org.opensearch.client.opensearch.indices.IndexSettings;

@Slf4j
public class OpenSearchVectorService implements VectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int OVER_FETCH_MULTIPLIER = 2;

  private static volatile OpenSearchVectorService instance;

  private final OpenSearchClient client;
  @Getter private final EmbeddingClient embeddingClient;
  private final String language;

  public OpenSearchVectorService(
      OpenSearchClient client, EmbeddingClient embeddingClient, String language) {
    this.client = client;
    this.embeddingClient = embeddingClient;
    this.language = language != null ? language.toLowerCase() : "en";
  }

  public OpenSearchVectorService(OpenSearchClient client, EmbeddingClient embeddingClient) {
    this.client = client;
    this.embeddingClient = embeddingClient;
    this.language = "en";
  }

  public static synchronized void init(
      OpenSearchClient client, EmbeddingClient embeddingClient, String language) {
    if (instance != null) {
      LOG.warn("OpenSearchVectorService already initialized, reinitializing");
    }
    instance = new OpenSearchVectorService(client, embeddingClient, language);
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

  @Override
  @SuppressWarnings("unchecked")
  public VectorSearchResponse search(
      String query, Map<String, List<String>> filters, int size, int k, double threshold) {
    long start = System.currentTimeMillis();
    try {
      float[] queryVector = embeddingClient.embed(query);
      int overFetchSize = size * OVER_FETCH_MULTIPLIER;

      String queryJson = VectorSearchQueryBuilder.build(queryVector, overFetchSize, k, filters);
      String indexName = getClusteredIndexName();
      String responseBody = executeGenericRequest("POST", "/" + indexName + "/_search", queryJson);

      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode hitsNode = root.path("hits").path("hits");

      LinkedHashMap<String, List<Map<String, Object>>> byParent = new LinkedHashMap<>();
      for (JsonNode hit : hitsNode) {
        double score = hit.path("_score").asDouble(0.0);
        if (score < threshold) {
          continue;
        }

        Map<String, Object> hitMap = MAPPER.convertValue(hit.path("_source"), Map.class);
        hitMap.put("_score", score);

        String parentId = (String) hitMap.get("parent_id");
        if (parentId != null) {
          byParent.computeIfAbsent(parentId, kVal -> new ArrayList<>()).add(hitMap);
        }
      }

      List<Map<String, Object>> results = new ArrayList<>();
      int parentCount = 0;
      for (List<Map<String, Object>> chunks : byParent.values()) {
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

  @Override
  public void updateVectorEmbeddings(EntityInterface entity, String targetIndex) {
    try {
      String parentId = entity.getId().toString();
      String existingFingerprint = getExistingFingerprint(targetIndex, parentId);
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);

      if (currentFingerprint.equals(existingFingerprint)) {
        LOG.debug("Skipping entity {} - fingerprint unchanged", parentId);
        return;
      }

      List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(entity, embeddingClient);
      deleteByParentId(targetIndex, parentId);
      bulkIndex(docs, targetIndex);
    } catch (Exception e) {
      LOG.error(
          "Failed to update vector embeddings for entity {}: {}",
          entity.getId(),
          e.getMessage(),
          e);
    }
  }

  @Override
  public void updateVectorEmbeddingsWithMigration(
      EntityInterface entity, String targetIndex, String sourceIndex) {
    try {
      String parentId = entity.getId().toString();
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);

      if (sourceIndex != null) {
        try {
          String existingFingerprint = getExistingFingerprint(sourceIndex, parentId);
          if (currentFingerprint.equals(existingFingerprint)) {
            if (copyExistingVectorDocuments(
                sourceIndex, targetIndex, parentId, currentFingerprint)) {
              return;
            }
          }
        } catch (Exception ex) {
          LOG.warn(
              "Migration copy failed for entity {}, falling back to recomputation: {}",
              parentId,
              ex.getMessage());
        }
      }

      List<Map<String, Object>> docs = VectorDocBuilder.fromEntity(entity, embeddingClient);
      bulkIndex(docs, targetIndex);
    } catch (Exception e) {
      LOG.error(
          "Failed to update vector embeddings with migration for entity {}: {}",
          entity.getId(),
          e.getMessage(),
          e);
    }
  }

  @Override
  public String getExistingFingerprint(String indexName, String parentId) {
    try {
      String query =
          "{\"size\":1,\"_source\":[\"fingerprint\"],"
              + "\"query\":{\"term\":{\"parent_id\":\""
              + VectorSearchQueryBuilder.escape(parentId)
              + "\"}}}";
      String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
      JsonNode root = MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");
      if (hits.isArray() && !hits.isEmpty()) {
        return hits.get(0).path("_source").path("fingerprint").asText(null);
      }
    } catch (Exception e) {
      LOG.debug(
          "Failed to get fingerprint for parent_id={} in index={}: {}",
          parentId,
          indexName,
          e.getMessage());
    }
    return null;
  }

  @Override
  public Map<String, String> getExistingFingerprintsBatch(
      String indexName, List<String> parentIds) {
    if (parentIds == null || parentIds.isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      StringBuilder termsArray = new StringBuilder("[");
      for (int i = 0; i < parentIds.size(); i++) {
        if (i > 0) termsArray.append(',');
        termsArray
            .append("\"")
            .append(VectorSearchQueryBuilder.escape(parentIds.get(i)))
            .append("\"");
      }
      termsArray.append("]");

      String query =
          "{\"size\":"
              + parentIds.size()
              + ",\"_source\":[\"parent_id\",\"fingerprint\"]"
              + ",\"query\":{\"terms\":{\"parent_id\":"
              + termsArray
              + "}}"
              + ",\"collapse\":{\"field\":\"parent_id\"}}";

      String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
      JsonNode root = MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      Map<String, String> result = new HashMap<>();
      for (JsonNode hit : hits) {
        String pid = hit.path("_source").path("parent_id").asText();
        String fp = hit.path("_source").path("fingerprint").asText(null);
        if (pid != null && fp != null) {
          result.put(pid, fp);
        }
      }
      return result;
    } catch (Exception e) {
      LOG.error("Failed to batch get fingerprints in index={}: {}", indexName, e.getMessage(), e);
      return Collections.emptyMap();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  public boolean copyExistingVectorDocuments(
      String sourceIndex, String targetIndex, String parentId, String fingerprint) {
    try {
      String searchQuery =
          "{\"size\":1000,\"query\":{\"term\":{\"parent_id\":\""
              + VectorSearchQueryBuilder.escape(parentId)
              + "\"}}}";
      String response = executeGenericRequest("POST", "/" + sourceIndex + "/_search", searchQuery);
      JsonNode root = MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (!hits.isArray() || hits.isEmpty()) {
        return false;
      }

      List<Map<String, Object>> docs = new ArrayList<>();
      for (JsonNode hit : hits) {
        Map<String, Object> source = MAPPER.convertValue(hit.path("_source"), Map.class);
        source.put("fingerprint", fingerprint);
        docs.add(source);
      }
      bulkIndex(docs, targetIndex);
      return true;
    } catch (Exception e) {
      LOG.error(
          "Failed to copy vector documents from {} to {} for parent_id={}: {}",
          sourceIndex,
          targetIndex,
          parentId,
          e.getMessage(),
          e);
      return false;
    }
  }

  @Override
  public void softDeleteEmbeddings(EntityInterface entity) {
    try {
      String parentId = entity.getId().toString();
      String indexName = getClusteredIndexName();
      String script =
          "{\"script\":{\"source\":\"ctx._source.deleted = true\"},"
              + "\"query\":{\"term\":{\"parent_id\":\""
              + VectorSearchQueryBuilder.escape(parentId)
              + "\"}}}";
      executeGenericRequest("POST", "/" + indexName + "/_update_by_query", script);
    } catch (Exception e) {
      LOG.error(
          "Failed to soft delete embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  @Override
  public void hardDeleteEmbeddings(EntityInterface entity) {
    try {
      String parentId = entity.getId().toString();
      String indexName = getClusteredIndexName();
      deleteByParentId(indexName, parentId);
    } catch (Exception e) {
      LOG.error(
          "Failed to hard delete embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  @Override
  public void restoreEmbeddings(EntityInterface entity) {
    try {
      String parentId = entity.getId().toString();
      String indexName = getClusteredIndexName();
      String script =
          "{\"script\":{\"source\":\"ctx._source.deleted = false\"},"
              + "\"query\":{\"term\":{\"parent_id\":\""
              + VectorSearchQueryBuilder.escape(parentId)
              + "\"}}}";
      executeGenericRequest("POST", "/" + indexName + "/_update_by_query", script);
    } catch (Exception e) {
      LOG.error(
          "Failed to restore embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private void deleteByParentId(String indexName, String parentId) {
    try {
      String query =
          "{\"query\":{\"term\":{\"parent_id\":\""
              + VectorSearchQueryBuilder.escape(parentId)
              + "\"}}}";
      executeGenericRequest("POST", "/" + indexName + "/_delete_by_query", query);
    } catch (Exception e) {
      LOG.error(
          "Failed to delete by parent_id={} in index={}: {}",
          parentId,
          indexName,
          e.getMessage(),
          e);
    }
  }

  private static String getClusteredIndexName() {
    return VectorIndexService.getClusteredIndexName();
  }

  @Override
  public void createOrUpdateIndex(int dimension) {
    try {
      if (indexExists()) {
        LOG.info("Vector index {} already exists", VECTOR_INDEX_NAME);
        return;
      }

      String mappingJson = loadIndexMapping(dimension);
      JsonNode rootNode = MAPPER.readTree(mappingJson);
      JsonNode mappingsNode = rootNode.get("mappings");
      JsonNode settingsNode = rootNode.get("settings");

      CreateIndexRequest request =
          CreateIndexRequest.of(
              builder -> {
                builder.index(getClusteredIndexName());

                if (mappingsNode != null && !mappingsNode.isNull()) {
                  TypeMapping typeMapping = parseTypeMapping(mappingsNode);
                  builder.mappings(typeMapping);
                }

                if (settingsNode != null && !settingsNode.isNull()) {
                  IndexSettings settings = parseIndexSettings(settingsNode);
                  builder.settings(settings);
                }

                return builder;
              });
      client.indices().create(request);

      LOG.info("Created vector index {} with dimension {}", getClusteredIndexName(), dimension);
    } catch (Exception e) {
      LOG.error("Failed to create vector index: {}", e.getMessage(), e);
    }
  }

  @Override
  public boolean indexExists() {
    try {
      ExistsRequest request = ExistsRequest.of(b -> b.index(getClusteredIndexName()));
      return client.indices().exists(request).value();
    } catch (Exception e) {
      LOG.error("Failed to check if vector index exists: {}", e.getMessage(), e);
      return false;
    }
  }

  @Override
  public String getIndexName() {
    return getClusteredIndexName();
  }

  @Override
  @SuppressWarnings("unchecked")
  public void bulkIndex(List<Map<String, Object>> documents, String targetIndex) {
    if (documents == null || documents.isEmpty()) {
      return;
    }

    try {
      List<BulkOperation> operations = new ArrayList<>();
      for (int i = 0; i < documents.size(); i++) {
        Map<String, Object> doc = documents.get(i);
        String parentId = (String) doc.get("parent_id");
        int chunkIndex = doc.containsKey("chunk_index") ? (int) doc.get("chunk_index") : i;
        String docId = parentId + "-" + chunkIndex;

        operations.add(
            BulkOperation.of(
                op -> op.index(idx -> idx.index(targetIndex).id(docId).document(doc))));
      }

      BulkRequest bulkRequest =
          BulkRequest.of(b -> b.operations(operations).refresh(Refresh.False));
      BulkResponse response = client.bulk(bulkRequest);

      if (response.errors()) {
        long errorCount = 0;
        for (BulkResponseItem item : response.items()) {
          if (item.error() != null) {
            errorCount++;
            LOG.warn(
                "Bulk vector indexing error for document [{}] in [{}]: type={}, reason={}",
                item.id(),
                targetIndex,
                item.error().type(),
                item.error().reason());
          }
        }
        LOG.warn(
            "Bulk vector indexing completed with {}/{} errors in {}",
            errorCount,
            documents.size(),
            targetIndex);
      } else {
        LOG.debug(
            "Successfully bulk indexed {} vector documents in {}", documents.size(), targetIndex);
      }
    } catch (Exception e) {
      LOG.error("Bulk vector indexing failed in {}: {}", targetIndex, e.getMessage(), e);
    }
  }

  private TypeMapping parseTypeMapping(JsonNode mappingsNode) {
    JsonParser parser =
        client
            ._transport()
            .jsonpMapper()
            .jsonProvider()
            .createParser(new StringReader(mappingsNode.toString()));
    return TypeMapping._DESERIALIZER.deserialize(parser, client._transport().jsonpMapper());
  }

  private IndexSettings parseIndexSettings(JsonNode settingsNode) {
    JsonParser parser =
        client
            ._transport()
            .jsonpMapper()
            .jsonProvider()
            .createParser(new StringReader(settingsNode.toString()));
    return IndexSettings._DESERIALIZER.deserialize(parser, client._transport().jsonpMapper());
  }

  private String loadIndexMapping(int dimension) {
    String resourcePath = "elasticsearch/" + language + "/vector_search_index.json";
    try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
      if (inputStream == null) {
        throw new IllegalStateException("Could not find " + resourcePath + " in classpath");
      }
      String template = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
      String result = template.replace("\"dimension\": 512", "\"dimension\": " + dimension);
      if (result.equals(template) && dimension != 512) {
        throw new IllegalStateException(
            "Failed to replace dimension placeholder in vector index mapping template");
      }
      return result;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load vector search index mapping", e);
    }
  }
}
