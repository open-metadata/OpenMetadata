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
import org.openmetadata.service.search.vector.client.EmbeddingClient;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PatchTableEmbeddingIT {

  private static final String TABLE_INDEX = "openmetadata_table_search_index";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void testPatchTableDescriptionUpdatesEmbeddingForSemanticSearch(TestNamespace ns)
      throws Exception {
    Assumptions.assumeTrue(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "Vector embedding tests require OpenSearch");
    Assumptions.assumeTrue(
        Entity.getSearchRepository().isVectorEmbeddingEnabled(),
        "Vector embedding is not enabled in test configuration");

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

    Awaitility.await("Wait for initial embedding")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(() -> getFieldFromIndex(tableId, "fingerprint") != null);

    String initialFingerprint = getFieldFromIndex(tableId, "fingerprint");
    assertNotNull(initialFingerprint, "Initial fingerprint should exist");

    table.setDescription("Revenue metrics for quarterly financial reporting analysis");
    client.tables().update(tableId, table);

    Awaitility.await("Wait for embedding update after PATCH")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              String fp = getFieldFromIndex(tableId, "fingerprint");
              return fp != null && !fp.equals(initialFingerprint);
            });

    String textToEmbed = getFieldFromIndex(tableId, "textToEmbed");
    assertTrue(
        textToEmbed.contains("Revenue metrics"),
        "textToEmbed should reflect the patched description");

    List<String> searchResultIds = executeKnnSearch("quarterly financial revenue reporting", 10);
    assertTrue(
        searchResultIds.contains(tableId),
        "Patched table should be found via semantic search for its new description");
  }

  private String getFieldFromIndex(String entityId, String field) throws Exception {
    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
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

  private List<String> executeKnnSearch(String queryText, int size) throws Exception {
    EmbeddingClient embeddingClient = Entity.getSearchRepository().getEmbeddingClient();
    float[] queryVector = embeddingClient.embed(queryText);
    String vectorStr = Arrays.toString(queryVector);
    String knnQuery =
        String.format(
            "{\"size\":%d,\"_source\":[\"parentId\"],"
                + "\"query\":{\"knn\":{\"embedding\":{\"vector\":%s,\"k\":%d,"
                + "\"filter\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}}}}",
            size, vectorStr, size);

    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
      Request request = new Request("POST", "/" + TABLE_INDEX + "/_search");
      request.setJsonEntity(knnQuery);

      Response response = searchClient.performRequest(request);
      String body =
          new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
      JsonNode root = MAPPER.readTree(body);
      JsonNode hits = root.path("hits").path("hits");

      List<String> resultIds = new ArrayList<>();
      for (JsonNode hit : hits) {
        String parentId = hit.path("_source").path("parentId").asText(null);
        if (parentId != null) {
          resultIds.add(parentId);
        }
      }
      return resultIds;
    }
  }
}
