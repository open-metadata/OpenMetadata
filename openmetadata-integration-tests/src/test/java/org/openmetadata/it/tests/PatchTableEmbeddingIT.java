package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PatchTableEmbeddingIT {

  private static final String TABLE_INDEX = "openmetadata_table_search_index";
  private static final String KNN_TEST_INDEX = "test_knn_embedding_index";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void testPatchTableDescriptionUpdatesEmbeddingForSemanticSearch(TestNamespace ns)
      throws Exception {
    Assumptions.assumeTrue(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "Vector embedding tests require OpenSearch");

    SearchRepository searchRepo = Entity.getSearchRepository();
    TestSuiteBootstrap.withNaturalLanguageSearch(searchRepo.getSearchConfiguration());
    EntityLifecycleEventDispatcher.getInstance().unregisterHandler("VectorEmbeddingHandler");
    searchRepo.initializeVectorSearchService();

    Assumptions.assumeTrue(
        searchRepo.isVectorEmbeddingEnabled(), "Vector embedding could not be initialized");

    try {
      runEmbeddingTest(ns);
    } finally {
      searchRepo.getSearchConfiguration().setNaturalLanguageSearch(null);
    }
  }

  private void runEmbeddingTest(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createRequest = new CreateTable();
    createRequest.setName(ns.prefix("emb_patch"));
    createRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    createRequest.setDescription("Initial description about sales data processing");
    createRequest.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("amount", "DOUBLE").build()));

    Table table = client.tables().create(createRequest);
    String tableId = table.getId().toString();

    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      Awaitility.await("Wait for initial embedding")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .until(() -> getFieldFromIndex(searchClient, tableId, "fingerprint") != null);

      String initialFingerprint = getFieldFromIndex(searchClient, tableId, "fingerprint");
      assertNotNull(initialFingerprint, "Initial fingerprint should exist");

      table.setDescription("Revenue metrics for quarterly financial reporting analysis");
      client.tables().update(tableId, table);

      Awaitility.await("Wait for embedding update after PATCH")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(2))
          .ignoreExceptions()
          .until(
              () -> {
                String fp = getFieldFromIndex(searchClient, tableId, "fingerprint");
                return fp != null && !fp.equals(initialFingerprint);
              });

      String textToEmbed = getFieldFromIndex(searchClient, tableId, "textToEmbed");
      assertTrue(
          textToEmbed.contains("Revenue metrics"),
          "textToEmbed should reflect the patched description");

      String embeddingJson = getFieldFromIndex(searchClient, tableId, "embedding");
      assertNotNull(embeddingJson, "Embedding vector should exist after PATCH");

      List<String> knnResults =
          verifyKnnSearchWithDedicatedIndex(searchClient, tableId, embeddingJson);
      assertTrue(
          knnResults.contains(tableId),
          "Patched table should be found via KNN search for its new description");
    }
  }

  /**
   * Creates a temporary knn_vector index, indexes the entity's embedding, runs a KNN query against
   * it, and cleans up. This avoids modifying the shared table search index while still validating
   * that the generated embedding produces correct KNN search results.
   */
  private List<String> verifyKnnSearchWithDedicatedIndex(
      Rest5Client searchClient, String tableId, String embeddingJson) throws Exception {
    int dimension = Entity.getSearchRepository().getEmbeddingClient().getDimension();
    try {
      createKnnIndex(searchClient, dimension);
      indexEmbeddingDocument(searchClient, tableId, embeddingJson);
      refreshIndex(searchClient);
      return executeKnnSearch(searchClient, 10);
    } finally {
      deleteKnnIndex(searchClient);
    }
  }

  private void createKnnIndex(Rest5Client searchClient, int dimension) throws Exception {
    String mapping =
        String.format(
            "{\"settings\":{\"index\":{\"knn\":true,\"number_of_shards\":1,"
                + "\"number_of_replicas\":0}},"
                + "\"mappings\":{\"properties\":{"
                + "\"embedding\":{\"type\":\"knn_vector\",\"dimension\":%d,"
                + "\"method\":{\"name\":\"hnsw\",\"engine\":\"lucene\","
                + "\"space_type\":\"cosinesimil\"}},"
                + "\"entityId\":{\"type\":\"keyword\"},"
                + "\"deleted\":{\"type\":\"boolean\"}}}}",
            dimension);

    Request request = new Request("PUT", "/" + KNN_TEST_INDEX);
    request.setJsonEntity(mapping);
    searchClient.performRequest(request);
  }

  private void indexEmbeddingDocument(
      Rest5Client searchClient, String tableId, String embeddingJson) throws Exception {
    String doc =
        String.format(
            "{\"embedding\":%s,\"entityId\":\"%s\",\"deleted\":false}", embeddingJson, tableId);

    Request request = new Request("PUT", "/" + KNN_TEST_INDEX + "/_doc/" + tableId);
    request.setJsonEntity(doc);
    searchClient.performRequest(request);
  }

  private void refreshIndex(Rest5Client searchClient) throws Exception {
    searchClient.performRequest(new Request("POST", "/" + KNN_TEST_INDEX + "/_refresh"));
  }

  private List<String> executeKnnSearch(Rest5Client searchClient, int size) throws Exception {
    EmbeddingClient embeddingClient = Entity.getSearchRepository().getEmbeddingClient();
    float[] queryVector = embeddingClient.embed("quarterly financial revenue reporting");
    String vectorStr = Arrays.toString(queryVector);
    String knnQuery =
        String.format(
            "{\"size\":%d,\"_source\":[\"entityId\"],"
                + "\"query\":{\"knn\":{\"embedding\":{\"vector\":%s,\"k\":%d,"
                + "\"filter\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}}}}",
            size, vectorStr, size);

    Request request = new Request("POST", "/" + KNN_TEST_INDEX + "/_search");
    request.setJsonEntity(knnQuery);

    Response response = searchClient.performRequest(request);
    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    JsonNode hits = root.path("hits").path("hits");

    List<String> resultIds = new ArrayList<>();
    for (JsonNode hit : hits) {
      String entityId = hit.path("_source").path("entityId").asText(null);
      if (entityId != null) {
        resultIds.add(entityId);
      }
    }
    return resultIds;
  }

  private void deleteKnnIndex(Rest5Client searchClient) {
    try {
      searchClient.performRequest(new Request("DELETE", "/" + KNN_TEST_INDEX));
    } catch (Exception e) {
      // Best-effort cleanup
    }
  }

  private String getFieldFromIndex(Rest5Client searchClient, String entityId, String field)
      throws Exception {
    String query =
        String.format(
            "{\"size\":1,\"_source\":[\"%s\"],\"query\":{\"term\":{\"_id\":\"%s\"}}}",
            field, entityId);

    Request request = new Request("POST", "/" + TABLE_INDEX + "/_search");
    request.setJsonEntity(query);

    Response response = searchClient.performRequest(request);
    String body =
        new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    JsonNode root = MAPPER.readTree(body);
    JsonNode hits = root.path("hits").path("hits");
    if (hits.isArray() && !hits.isEmpty()) {
      JsonNode fieldValue = hits.get(0).path("_source").path(field);
      if (fieldValue.isMissingNode() || fieldValue.isNull()) {
        return null;
      }
      return fieldValue.isTextual() ? fieldValue.asText() : fieldValue.toString();
    }
    return null;
  }
}
