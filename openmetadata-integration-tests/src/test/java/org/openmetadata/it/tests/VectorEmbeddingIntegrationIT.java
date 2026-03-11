package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorSearchQueryBuilder;
import org.openmetadata.service.search.vector.client.DjlEmbeddingClient;
import org.openmetadata.service.search.vector.client.DjlEmbeddingClient.EmbeddingInitializationException;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class VectorEmbeddingIntegrationIT {

  private static final String TEST_INDEX = "table_search_index";

  @Container
  static OpensearchContainer<?> opensearch =
      new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("discovery.type", "single-node")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");

  private OpenSearchClient openSearchClient;
  private DjlEmbeddingClient embeddingClient;
  private OpenSearchVectorService vectorService;
  private ObjectMapper mapper;
  private Table testTable;

  @BeforeAll
  void setUpOnce() throws Exception {
    HttpHost httpHost = new HttpHost("http", opensearch.getHost(), opensearch.getMappedPort(9200));
    ApacheHttpClient5Transport transport =
        ApacheHttpClient5TransportBuilder.builder(httpHost)
            .setMapper(new JacksonJsonpMapper())
            .build();
    openSearchClient = new OpenSearchClient(transport);

    try {
      embeddingClient = createTestEmbeddingClient();
    } catch (EmbeddingInitializationException e) {
      Assumptions.assumeTrue(false, "DJL model not available: " + e.getMessage());
      return;
    }

    OpenSearchVectorService.init(openSearchClient, embeddingClient, "en");
    vectorService = OpenSearchVectorService.getInstance();

    mapper = new ObjectMapper();
  }

  @BeforeEach
  void setUp() throws Exception {
    Assumptions.assumeTrue(embeddingClient != null, "Embedding client not available");

    testTable =
        createTestTable(
            UUID.randomUUID(),
            "Test Table",
            "This is a test table for vector embedding",
            "test.database.testTable");

    createEntityIndex();
    indexEntityDocument(testTable);
  }

  @AfterEach
  void tearDownEach() throws Exception {
    if (openSearchClient != null) {
      try {
        openSearchClient.indices().delete(d -> d.index(TEST_INDEX));
      } catch (Exception e) {
        // Ignore cleanup errors
      }
    }
  }

  @AfterAll
  void tearDownOnce() throws Exception {
    if (embeddingClient != null) {
      embeddingClient.close();
    }
    if (openSearchClient != null) {
      openSearchClient._transport().close();
    }
  }

  @Test
  void testEntityEmbeddingCreationViaPartialUpdate() throws Exception {
    vectorService.updateEntityEmbedding(testTable, TEST_INDEX);
    Thread.sleep(1000);

    Map<String, Object> doc = getDocumentById(testTable.getId().toString());
    assertNotNull(doc, "Entity document should exist");
    assertNotNull(doc.get("textToEmbed"), "Document should have text_to_embed");
    assertNotNull(doc.get("embedding"), "Document should have embedding");
    assertNotNull(doc.get("fingerprint"), "Document should have fingerprint");
    assertEquals(
        testTable.getId().toString(), doc.get("parentId"), "Parent ID should match entity ID");

    Object embedding = doc.get("embedding");
    assertTrue(embedding instanceof List, "Embedding should be a list");

    @SuppressWarnings("unchecked")
    List<Number> embeddingList = (List<Number>) embedding;
    assertEquals(
        embeddingClient.getDimension(),
        embeddingList.size(),
        "Embedding dimension should match client dimension");
  }

  @Test
  void testFingerprintOptimization() throws Exception {
    vectorService.updateEntityEmbedding(testTable, TEST_INDEX);
    Thread.sleep(1000);

    Map<String, Object> initialDoc = getDocumentById(testTable.getId().toString());
    String initialFingerprint = (String) initialDoc.get("fingerprint");

    vectorService.updateEntityEmbedding(testTable, TEST_INDEX);
    Thread.sleep(1000);

    Map<String, Object> unchangedDoc = getDocumentById(testTable.getId().toString());
    assertEquals(
        initialFingerprint, unchangedDoc.get("fingerprint"), "Fingerprint should be unchanged");

    testTable.setDescription(testTable.getDescription() + " - UPDATED");
    vectorService.updateEntityEmbedding(testTable, TEST_INDEX);
    Thread.sleep(1000);

    Map<String, Object> updatedDoc = getDocumentById(testTable.getId().toString());
    String newFingerprint = (String) updatedDoc.get("fingerprint");

    assertFalse(
        initialFingerprint.equals(newFingerprint),
        "Fingerprint should change when content changes");
  }

  @Test
  void testDjlEmbeddingGeneration() {
    String testText = "This is a test sentence for embedding generation";
    float[] embedding = embeddingClient.embed(testText);

    assertNotNull(embedding, "Embedding should not be null");
    assertTrue(embedding.length > 0, "Embedding should have dimensions");
    assertEquals(
        embeddingClient.getDimension(),
        embedding.length,
        "Embedding length should match declared dimension");

    float[] embedding2 = embeddingClient.embed(testText);
    assertEquals(embedding.length, embedding2.length, "Embeddings should have same length");

    for (int i = 0; i < embedding.length; i++) {
      assertEquals(
          embedding[i],
          embedding2[i],
          0.0001f,
          "Embedding values should be consistent for same text");
    }
  }

  @Test
  void testExistingFingerprintRetrieval() throws Exception {
    String entityId = testTable.getId().toString();

    String fingerprint = vectorService.getExistingFingerprint(TEST_INDEX, entityId);
    assertNull(fingerprint, "Should return null when no embedding fields exist yet");

    vectorService.updateEntityEmbedding(testTable, TEST_INDEX);
    Thread.sleep(1000);

    fingerprint = vectorService.getExistingFingerprint(TEST_INDEX, entityId);
    assertNotNull(fingerprint, "Should return fingerprint after embedding update");
    assertFalse(fingerprint.isEmpty(), "Fingerprint should not be empty");

    String computedFingerprint = VectorDocBuilder.computeFingerprintForEntity(testTable);
    assertEquals(
        computedFingerprint,
        fingerprint,
        "Retrieved fingerprint should match computed fingerprint");
  }

  @Test
  void testBatchFingerprintOperations() throws Exception {
    UUID entity1Id = UUID.randomUUID();
    Table entity1 =
        createTestTable(
            entity1Id,
            "Entity 1",
            "First test entity",
            "test.entity1." + entity1Id.toString().substring(0, 8));

    UUID entity2Id = UUID.randomUUID();
    Table entity2 =
        createTestTable(
            entity2Id,
            "Entity 2",
            "Second test entity",
            "test.entity2." + entity2Id.toString().substring(0, 8));

    indexEntityDocument(entity1);
    indexEntityDocument(entity2);

    vectorService.updateEntityEmbedding(entity1, TEST_INDEX);
    vectorService.updateEntityEmbedding(entity2, TEST_INDEX);
    Thread.sleep(1000);

    Map<String, String> fingerprints =
        vectorService.getExistingFingerprintsBatch(
            TEST_INDEX, List.of(entity1Id.toString(), entity2Id.toString()));

    assertEquals(2, fingerprints.size(), "Should retrieve fingerprints for both entities");
    assertNotNull(fingerprints.get(entity1Id.toString()));
    assertNotNull(fingerprints.get(entity2Id.toString()));
  }

  @Test
  void testGenerateEmbeddingFields() {
    Map<String, Object> fields = vectorService.generateEmbeddingFields(testTable);

    assertNotNull(fields);
    assertNotNull(fields.get("embedding"));
    assertNotNull(fields.get("textToEmbed"));
    assertNotNull(fields.get("fingerprint"));
    assertEquals(testTable.getId().toString(), fields.get("parentId"));
    assertEquals(0, fields.get("chunkIndex"));
    assertTrue((int) fields.get("chunkCount") >= 1);
  }

  @Test
  void testPatchTableDescriptionUpdatesEmbeddingForSemanticSearch() throws Exception {
    UUID decoyId = UUID.randomUUID();
    Table decoyTable =
        createTestTable(
            decoyId,
            "Decoy Table",
            "User authentication logs and session tracking data",
            "test.database.decoyTable." + decoyId.toString().substring(0, 8));
    indexEntityDocument(decoyTable);

    vectorService.updateEntityEmbedding(testTable, TEST_INDEX);
    vectorService.updateEntityEmbedding(decoyTable, TEST_INDEX);
    Thread.sleep(1000);

    Map<String, Object> initialDoc = getDocumentById(testTable.getId().toString());
    String initialFingerprint = (String) initialDoc.get("fingerprint");
    String initialTextToEmbed = (String) initialDoc.get("textToEmbed");

    String patchedDescription = "Revenue metrics for quarterly financial reporting analysis";
    testTable.setDescription(patchedDescription);
    indexEntityDocument(testTable);

    vectorService.updateEntityEmbedding(testTable, TEST_INDEX);
    Thread.sleep(1000);

    Map<String, Object> updatedDoc = getDocumentById(testTable.getId().toString());
    String updatedFingerprint = (String) updatedDoc.get("fingerprint");
    String updatedTextToEmbed = (String) updatedDoc.get("textToEmbed");

    assertFalse(
        initialFingerprint.equals(updatedFingerprint), "Fingerprint should change after PATCH");
    assertFalse(
        initialTextToEmbed.equals(updatedTextToEmbed), "textToEmbed should change after PATCH");
    assertTrue(
        updatedTextToEmbed.contains("Revenue metrics"),
        "Updated textToEmbed should reflect patched description");

    List<Map<String, Object>> results =
        executeKnnSearch("quarterly financial revenue reporting", 10);

    assertFalse(results.isEmpty(), "Semantic search should return results");

    String topResultParentId = (String) results.get(0).get("parentId");
    assertEquals(
        testTable.getId().toString(),
        topResultParentId,
        "Patched table should be the top result for its new description content");
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> executeKnnSearch(String queryText, int size) throws Exception {
    openSearchClient.indices().refresh(r -> r.index(TEST_INDEX));

    float[] queryVector = embeddingClient.embed(queryText);
    String searchQuery = VectorSearchQueryBuilder.build(queryVector, size, 0, size, Map.of(), 0.0);

    var genericClient = openSearchClient.generic();
    try (var response =
        genericClient.execute(
            os.org.opensearch.client.opensearch.generic.Requests.builder()
                .method("POST")
                .endpoint("/" + TEST_INDEX + "/_search")
                .json(searchQuery)
                .build())) {
      String body =
          response
              .getBody()
              .map(
                  b -> {
                    try {
                      return new String(b.bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    } catch (Exception e) {
                      return "{}";
                    }
                  })
              .orElse("{}");
      JsonNode root = mapper.readTree(body);
      JsonNode hitsNode = root.path("hits").path("hits");

      List<Map<String, Object>> results = new ArrayList<>();
      for (JsonNode hit : hitsNode) {
        Map<String, Object> hitMap = mapper.convertValue(hit.path("_source"), Map.class);
        hitMap.put("_score", hit.path("_score").asDouble(0.0));
        results.add(hitMap);
      }
      return results;
    }
  }

  private DjlEmbeddingClient createTestEmbeddingClient() throws EmbeddingInitializationException {
    org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration config =
        new org.openmetadata.schema.service.configuration.elasticsearch
            .ElasticSearchConfiguration();

    org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration
        nlSearch =
            new org.openmetadata.schema.service.configuration.elasticsearch
                .NaturalLanguageSearchConfiguration();

    org.openmetadata.schema.service.configuration.elasticsearch.Djl djlConfig =
        new org.openmetadata.schema.service.configuration.elasticsearch.Djl();

    djlConfig.setEmbeddingModel(
        "ai.djl.huggingface.pytorch/sentence-transformers/all-MiniLM-L6-v2");
    nlSearch.setDjl(djlConfig);
    config.setNaturalLanguageSearch(nlSearch);

    return new DjlEmbeddingClient(config);
  }

  private void createEntityIndex() throws Exception {
    InputStream indexStream =
        getClass().getResourceAsStream("/elasticsearch/en/table_index_mapping.json");
    String rawMapping = new String(indexStream.readAllBytes(), StandardCharsets.UTF_8);

    String enrichedMapping = OsUtils.enrichIndexMappingForOpenSearch(rawMapping);

    JsonNode indexConfig = mapper.readTree(enrichedMapping);
    int actualDimension = embeddingClient.getDimension();

    // In integration tests there is no full SearchRepository context, so
    // addKnnVectorSettings (called by enrichIndexMappingForOpenSearch) correctly
    // skips knn_vector setup. We build the embedding field manually here.
    ObjectNode properties = (ObjectNode) indexConfig.get("mappings").get("properties");
    if (!properties.has("embedding")) {
      ObjectNode embeddingNode = mapper.createObjectNode();
      embeddingNode.put("type", "knn_vector");
      embeddingNode.put("dimension", actualDimension);

      ObjectNode methodNode = mapper.createObjectNode();
      methodNode.put("name", "hnsw");
      methodNode.put("engine", "lucene");
      methodNode.put("space_type", "cosinesimil");
      ObjectNode paramsNode = mapper.createObjectNode();
      paramsNode.put("m", 48);
      paramsNode.put("ef_construction", 256);
      methodNode.set("parameters", paramsNode);
      embeddingNode.set("method", methodNode);

      properties.set("embedding", embeddingNode);

      ObjectNode indexSettings = (ObjectNode) indexConfig.get("settings").get("index");
      indexSettings.put("knn", true);
    } else {
      ((ObjectNode) properties.get("embedding")).put("dimension", actualDimension);
    }

    String indexMapping = mapper.writeValueAsString(indexConfig);

    var genericClient = openSearchClient.generic();
    try (var response =
        genericClient.execute(
            os.org.opensearch.client.opensearch.generic.Requests.builder()
                .method("PUT")
                .endpoint("/" + TEST_INDEX)
                .json(indexMapping)
                .build())) {
      if (response.getStatus() >= 400) {
        String errorBody = response.getBody().map(b -> b.bodyAsString()).orElse("no body");
        throw new IOException(
            "Failed to create index "
                + TEST_INDEX
                + " (status "
                + response.getStatus()
                + "): "
                + errorBody);
      }
    }
  }

  private void indexEntityDocument(Table entity) throws Exception {
    String entityId = entity.getId().toString();
    String docJson =
        mapper.writeValueAsString(
            Map.of(
                "name",
                entity.getName(),
                "displayName",
                entity.getDisplayName() != null ? entity.getDisplayName() : "",
                "description",
                entity.getDescription() != null ? entity.getDescription() : "",
                "fullyQualifiedName",
                entity.getFullyQualifiedName() != null ? entity.getFullyQualifiedName() : "",
                "deleted",
                false,
                "entityType",
                "table"));

    var genericClient = openSearchClient.generic();
    try (var response =
        genericClient.execute(
            os.org.opensearch.client.opensearch.generic.Requests.builder()
                .method("PUT")
                .endpoint("/" + TEST_INDEX + "/_doc/" + entityId + "?refresh=true")
                .json(docJson)
                .build())) {
      if (response.getStatus() >= 400) {
        String errorBody = response.getBody().map(b -> b.bodyAsString()).orElse("no body");
        throw new IOException("Failed to index entity doc: " + errorBody);
      }
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> getDocumentById(String docId) throws Exception {
    openSearchClient.indices().refresh(r -> r.index(TEST_INDEX));

    var genericClient = openSearchClient.generic();
    try (var response =
        genericClient.execute(
            os.org.opensearch.client.opensearch.generic.Requests.builder()
                .method("GET")
                .endpoint("/" + TEST_INDEX + "/_doc/" + docId)
                .build())) {
      if (response.getStatus() == 404) {
        return null;
      }
      String body =
          response
              .getBody()
              .map(
                  b -> {
                    try {
                      return new String(b.bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8);
                    } catch (Exception e) {
                      return "{}";
                    }
                  })
              .orElse("{}");
      JsonNode root = mapper.readTree(body);
      if (root.has("_source")) {
        return mapper.convertValue(root.get("_source"), Map.class);
      }
      return null;
    }
  }

  private Table createTestTable(
      UUID id, String name, String description, String fullyQualifiedName) {
    return new Table()
        .withId(id)
        .withName(name)
        .withDescription(description)
        .withFullyQualifiedName(fullyQualifiedName)
        .withVersion(1.0)
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy("test-user");
  }
}
