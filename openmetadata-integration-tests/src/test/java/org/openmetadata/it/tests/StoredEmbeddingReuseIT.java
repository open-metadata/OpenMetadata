package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.ElasticSearchVectorService;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

/**
 * A reindex reuses the embedding stored on an entity doc only when its fingerprint is current. The
 * docs are seeded as an earlier release left them: the entity's current {@code updatedAt}, with the
 * fingerprint and vector of the text that release embedded.
 * ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches
 */
class StoredEmbeddingReuseIT {

  private static final int DIMENSION = 3;
  // Exact in float32: Elasticsearch returns a dense_vector from its float storage.
  private static final List<Double> STORED_VECTOR = List.of(0.5, 0.25, 0.125);
  private static final long UPDATED_AT = 1_700_000_000_000L;
  private static final EmbeddingClient NO_EMBEDDINGS =
      new EmbeddingClient() {
        @Override
        protected float[] doEmbed(String text) {
          throw new UnsupportedOperationException("Reuse lookups never embed");
        }

        @Override
        public int getDimension() {
          return DIMENSION;
        }

        @Override
        public String getModelId() {
          return "stored-embedding-reuse";
        }
      };

  @Nested
  @TestInstance(TestInstance.Lifecycle.PER_CLASS)
  class OnOpenSearch {
    private final OpensearchContainer<?> container =
        new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
            .withStartupTimeout(Duration.ofMinutes(5))
            .withEnv("DISABLE_SECURITY_PLUGIN", "true")
            .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
            .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
            .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");
    private OpenSearchClient client;
    private OpenSearchVectorService service;

    @BeforeAll
    void start() {
      container.start();
      HttpHost host = new HttpHost("http", container.getHost(), container.getMappedPort(9200));
      client =
          new OpenSearchClient(
              ApacheHttpClient5TransportBuilder.builder(host)
                  .setHttpClientConfigCallback(builder -> builder.disableContentCompression())
                  .build());
      service = new OpenSearchVectorService(client, NO_EMBEDDINGS);
    }

    @AfterAll
    void stop() throws Exception {
      client._transport().close();
      container.stop();
    }

    @Test
    void reindexReusesOnlyEmbeddingsWhoseTextIsUnchanged() {
      String index =
          createIndex(
              service,
              "{\"index\":{\"knn\":true}}",
              "{\"type\":\"knn_vector\",\"dimension\":" + DIMENSION + "}");
      assertOnlyUnchangedTextIsReused(service, index, service::getExistingEmbeddingsBatch);
    }
  }

  @Nested
  @TestInstance(TestInstance.Lifecycle.PER_CLASS)
  class OnElasticsearch {
    private final ElasticsearchContainer container =
        new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:9.3.0")
            .withEnv("discovery.type", "single-node")
            .withEnv("xpack.security.enabled", "false")
            .withEnv("ES_JAVA_OPTS", "-Xms512m -Xmx512m")
            .withStartupTimeout(Duration.ofMinutes(5));
    private Rest5Client restClient;
    private ElasticSearchVectorService service;

    @BeforeAll
    void start() {
      container.start();
      restClient =
          Rest5Client.builder(
                  new HttpHost("http", container.getHost(), container.getMappedPort(9200)))
              .setHttpClientConfigCallback(builder -> builder.disableContentCompression())
              .build();
      service =
          new ElasticSearchVectorService(
              new ElasticsearchClient(
                  new Rest5ClientTransport(restClient, new JacksonJsonpMapper())),
              NO_EMBEDDINGS);
    }

    @AfterAll
    void stop() throws Exception {
      restClient.close();
      container.stop();
    }

    @Test
    void reindexReusesOnlyEmbeddingsWhoseTextIsUnchanged() {
      String index =
          createIndex(service, "{}", "{\"type\":\"dense_vector\",\"dims\":" + DIMENSION + "}");
      assertOnlyUnchangedTextIsReused(service, index, service::getExistingEmbeddingsBatch);
    }
  }

  @FunctionalInterface
  interface ReuseLookup {
    Map<String, JsonNode> reusable(String index, Map<String, Supplier<String>> currentById);
  }

  private static void assertOnlyUnchangedTextIsReused(
      VectorIndexService service, String index, ReuseLookup lookup) {
    Table unchanged = table("orders", "Orders placed online");
    Table textChanged = table("payments", "Customer payments by card");
    Table textChangedAsLastEmbedded =
        table("payments", "Customer payments").withId(textChanged.getId());
    Table neverEmbedded = table("refunds", "Refunds issued");
    seed(service, index, unchanged, embeddingOf(unchanged));
    seed(service, index, textChanged, embeddingOf(textChangedAsLastEmbedded));
    seed(service, index, neverEmbedded, Map.of());

    Map<String, JsonNode> reusable =
        lookup.reusable(
            index,
            Map.of(
                id(unchanged), currentFingerprint(unchanged),
                id(textChanged), currentFingerprint(textChanged),
                id(neverEmbedded), currentFingerprint(neverEmbedded),
                UUID.randomUUID().toString(), currentFingerprint(unchanged)));

    assertEquals(Set.of(id(unchanged)), reusable.keySet());
    JsonNode reused = reusable.get(id(unchanged));
    assertEquals(
        VectorDocBuilder.computeFingerprintForEntity(unchanged),
        reused.path("fingerprint").asText());
    assertEquals(JsonUtils.valueToTree(STORED_VECTOR), reused.path("embedding"));
  }

  private static String createIndex(
      VectorIndexService service, String settings, String vectorMapping) {
    String index = new TestNamespace("stored_embedding_reuse").prefix("table_search_index");
    String body =
        """
        {"settings":%s,"mappings":{"properties":{
          "name":{"type":"keyword"},
          "updatedAt":{"type":"date","format":"epoch_millis"},
          "fingerprint":{"type":"keyword"},
          "parentId":{"type":"keyword"},
          "embedding":%s}}}
        """
            .formatted(settings, vectorMapping);
    service.executeGenericRequest("PUT", "/" + index, body);
    return index;
  }

  private static void seed(
      VectorIndexService service, String index, Table entity, Map<String, Object> embedding) {
    ObjectNode doc = JsonUtils.getObjectNode();
    doc.put("name", entity.getName());
    doc.put("updatedAt", entity.getUpdatedAt());
    doc.setAll((ObjectNode) JsonUtils.valueToTree(embedding));
    JsonNode response =
        JsonUtils.readTree(
            service.executeGenericRequest(
                "PUT", "/" + index + "/_doc/" + id(entity) + "?refresh=true", doc.toString()));
    assertFalse(
        response.path("result").isMissingNode(), "Seeding " + id(entity) + " got " + response);
  }

  private static Map<String, Object> embeddingOf(Table embeddedAs) {
    return Map.of(
        "fingerprint", VectorDocBuilder.computeFingerprintForEntity(embeddedAs),
        "embedding", STORED_VECTOR,
        "parentId", id(embeddedAs));
  }

  private static Table table(String name, String description) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("svc.db.schema." + name)
        .withDescription(description)
        .withUpdatedAt(UPDATED_AT);
  }

  private static String id(Table table) {
    return table.getId().toString();
  }

  private static Supplier<String> currentFingerprint(Table table) {
    return () -> VectorDocBuilder.computeFingerprintForEntity(table);
  }
}
