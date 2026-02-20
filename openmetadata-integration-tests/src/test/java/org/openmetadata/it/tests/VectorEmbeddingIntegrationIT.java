package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.search.vector.VectorIndexService.VECTOR_INDEX_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
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

  @BeforeEach
  void setUp() throws Exception {
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

    testTable =
        createTestTable(
            UUID.randomUUID(),
            "Test Table",
            "This is a test table for vector embedding",
            "test.database.testTable");

    createVectorIndex();
  }

  @AfterEach
  void tearDown() throws Exception {
    if (embeddingClient != null) {
      embeddingClient.close();
    }
    if (openSearchClient != null) {
      try {
        openSearchClient.indices().delete(d -> d.index(VECTOR_INDEX_NAME));
      } catch (Exception e) {
        // Ignore cleanup errors
      }
      openSearchClient._transport().close();
    }
  }

  @Test
  void testVectorEmbeddingCreationAndRetrieval() throws Exception {
    vectorService.updateVectorEmbeddings(testTable, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    List<Map<String, Object>> docs = searchAllDocuments();
    assertFalse(docs.isEmpty(), "Vector documents should be created");

    Map<String, Object> doc = docs.get(0);
    assertNotNull(doc.get("text_to_embed"), "Document should have content");
    assertNotNull(doc.get("embedding"), "Document should have embedding");
    assertNotNull(doc.get("fingerprint"), "Document should have fingerprint");

    assertEquals(
        testTable.getId().toString(), doc.get("parent_id"), "Parent ID should match entity ID");

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
    vectorService.updateVectorEmbeddings(testTable, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    List<Map<String, Object>> initialDocs = searchAllDocuments();
    String initialFingerprint = (String) initialDocs.get(0).get("fingerprint");
    int initialCount = initialDocs.size();

    vectorService.updateVectorEmbeddings(testTable, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    List<Map<String, Object>> unchangedDocs = searchAllDocuments();
    assertEquals(initialCount, unchangedDocs.size(), "Document count should remain the same");
    assertEquals(
        initialFingerprint,
        unchangedDocs.get(0).get("fingerprint"),
        "Fingerprint should be unchanged");

    testTable.setDescription(testTable.getDescription() + " - UPDATED");
    vectorService.updateVectorEmbeddings(testTable, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    List<Map<String, Object>> updatedDocs = searchAllDocuments();
    String newFingerprint = (String) updatedDocs.get(0).get("fingerprint");

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
  void testVectorIndexServiceFingerprinting() throws Exception {
    String entityId = testTable.getId().toString();

    String fingerprint = vectorService.getExistingFingerprint(VECTOR_INDEX_NAME, entityId);
    assertNull(fingerprint, "Should return null when no documents exist");

    vectorService.updateVectorEmbeddings(testTable, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    fingerprint = vectorService.getExistingFingerprint(VECTOR_INDEX_NAME, entityId);
    assertNotNull(fingerprint, "Should return fingerprint after indexing");
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

    vectorService.updateVectorEmbeddings(entity1, VECTOR_INDEX_NAME);
    vectorService.updateVectorEmbeddings(entity2, VECTOR_INDEX_NAME);
    Thread.sleep(1000);
  }

  @Test
  void testVectorDocumentMigrationDuringIndexRecreation() throws Exception {
    vectorService.updateVectorEmbeddings(testTable, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    String originalFingerprint = VectorDocBuilder.computeFingerprintForEntity(testTable);

    String stagedIndex = VECTOR_INDEX_NAME + "_staged";
    createVectorIndex(stagedIndex);

    String entityId = testTable.getId().toString();

    boolean copied =
        vectorService.copyExistingVectorDocuments(
            VECTOR_INDEX_NAME, stagedIndex, entityId, originalFingerprint);

    assertTrue(copied, "Documents should be successfully copied");

    List<Map<String, Object>> originalDocs = searchAllDocuments(VECTOR_INDEX_NAME);
    List<Map<String, Object>> copiedDocs = searchAllDocuments(stagedIndex);

    assertEquals(
        originalDocs.size(), copiedDocs.size(), "Same number of documents should be copied");
    assertFalse(originalDocs.isEmpty(), "Original documents should exist");
    assertFalse(copiedDocs.isEmpty(), "Copied documents should exist");

    assertEquals(
        originalFingerprint,
        copiedDocs.get(0).get("fingerprint"),
        "Fingerprint should be preserved in copied documents");
  }

  @Test
  void testUpdateVectorEmbeddingsWithMigration() throws Exception {
    vectorService.updateVectorEmbeddings(testTable, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    String stagedIndex = VECTOR_INDEX_NAME + "_migration_test";
    createVectorIndex(stagedIndex);

    vectorService.updateVectorEmbeddingsWithMigration(testTable, stagedIndex, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    List<Map<String, Object>> originalDocs = searchAllDocuments(VECTOR_INDEX_NAME);
    List<Map<String, Object>> migratedDocs = searchAllDocuments(stagedIndex);

    assertEquals(
        originalDocs.size(), migratedDocs.size(), "Migration should preserve document count");
    assertFalse(migratedDocs.isEmpty(), "Migrated documents should exist");

    testTable.setDescription(testTable.getDescription() + " - CHANGED FOR MIGRATION TEST");

    vectorService.updateVectorEmbeddingsWithMigration(testTable, stagedIndex, VECTOR_INDEX_NAME);
    Thread.sleep(1000);

    List<Map<String, Object>> recomputedDocs = searchAllDocuments(stagedIndex);
    String newFingerprint = (String) recomputedDocs.get(0).get("fingerprint");
    String expectedFingerprint = VectorDocBuilder.computeFingerprintForEntity(testTable);

    assertEquals(
        expectedFingerprint,
        newFingerprint,
        "Fingerprint should be updated after content change during migration");

    openSearchClient.indices().delete(d -> d.index(stagedIndex));
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

  private void createVectorIndex() throws Exception {
    createVectorIndex(VECTOR_INDEX_NAME);
  }

  private void createVectorIndex(String indexName) throws Exception {
    InputStream indexStream =
        getClass().getResourceAsStream("/elasticsearch/en/vector_search_index.json");
    JsonNode indexConfig = mapper.readTree(indexStream);

    int actualDimension = embeddingClient.getDimension();

    ((ObjectNode) indexConfig.get("mappings").get("properties").get("embedding"))
        .put("dimension", actualDimension);

    String indexMapping = mapper.writeValueAsString(indexConfig);

    var genericClient = openSearchClient.generic();
    try (var response =
        genericClient.execute(
            os.org.opensearch.client.opensearch.generic.Requests.builder()
                .method("PUT")
                .endpoint("/" + indexName)
                .json(indexMapping)
                .build())) {
      if (response.getStatus() >= 400) {
        String errorBody = response.getBody().map(b -> b.bodyAsString()).orElse("no body");
        throw new IOException(
            "Failed to create index "
                + indexName
                + " (status "
                + response.getStatus()
                + "): "
                + errorBody);
      }
    }
  }

  private List<Map<String, Object>> searchAllDocuments() throws Exception {
    return searchAllDocuments(VECTOR_INDEX_NAME);
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> searchAllDocuments(String indexName) throws Exception {
    openSearchClient.indices().refresh(r -> r.index(indexName));

    var searchResponse =
        openSearchClient.search(
            s -> s.index(indexName).query(q -> q.matchAll(m -> m)).size(100), Map.class);

    List<Map<String, Object>> results = new ArrayList<>();
    for (var hit : searchResponse.hits().hits()) {
      if (hit.source() != null) {
        Map<String, Object> source = (Map<String, Object>) hit.source();
        results.add(source);
      }
    }

    return results;
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
