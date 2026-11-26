package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
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
import org.openmetadata.service.search.vector.AbstractVectorIndexService;
import org.openmetadata.service.search.vector.ElasticSearchVectorService;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingModel;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

/**
 * A reindex reuses the embedding stored on an entity doc only when its fingerprint is current and
 * the model it records is the configured one. The docs are seeded as an earlier release or another
 * model left them: the entity's current {@code updatedAt}, with the fingerprint and vector of the
 * text that release embedded, or the vectors of another model of the same dimension.
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

  /** A provider stub that returns one vector for any text and counts the texts it embeds. */
  private static final class StubModel extends EmbeddingClient {
    private final String modelId;
    private final float[] vector;
    private final AtomicInteger textsEmbedded = new AtomicInteger();

    private StubModel(String modelId, float... vector) {
      this.modelId = modelId;
      this.vector = vector;
    }

    @Override
    protected float[] doEmbed(String text) {
      textsEmbedded.incrementAndGet();
      return vector.clone();
    }

    @Override
    public int getDimension() {
      return vector.length;
    }

    @Override
    public String getModelId() {
      return modelId;
    }
  }

  // Two models of one dimension place the same text at unrelated points.
  private final StubModel modelA = new StubModel("model-a", 0.5f, 0.25f, 0.125f);
  private final StubModel modelB = new StubModel("model-b", 0.125f, 0.25f, 0.5f);

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

    private OpenSearchVectorService serviceOf(EmbeddingClient model) {
      return new OpenSearchVectorService(client, model);
    }

    @AfterAll
    void stop() throws Exception {
      client._transport().close();
      container.stop();
    }

    @Test
    void reindexReusesOnlyEmbeddingsWhoseTextIsUnchanged() {
      String index = createIndex(service, "text", OPENSEARCH_SETTINGS, OPENSEARCH_VECTOR);
      assertOnlyUnchangedTextIsReused(service, index, service::getExistingEmbeddingsBatch);
    }

    @Test
    void aReindexReusesOnlyEmbeddingsOfTheConfiguredModel() {
      String index = createIndex(service, "model", OPENSEARCH_SETTINGS, OPENSEARCH_VECTOR);
      assertOnlyEmbeddingsOfTheConfiguredModelAreReused(
          serviceOf(modelA), serviceOf(modelB), index);
    }

    @Test
    void aSwitchToAnotherModelReembedsOnALiveEditARecreateAndAReembed() {
      String index = createIndex(service, "switch", OPENSEARCH_SETTINGS, OPENSEARCH_VECTOR);
      assertASwitchReembedsEverywhere(serviceOf(modelA), serviceOf(modelB), modelB, index);
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

    private ElasticSearchVectorService serviceOf(EmbeddingClient model) {
      return new ElasticSearchVectorService(
          new ElasticsearchClient(new Rest5ClientTransport(restClient, new JacksonJsonpMapper())),
          model);
    }

    @AfterAll
    void stop() throws Exception {
      restClient.close();
      container.stop();
    }

    @Test
    void reindexReusesOnlyEmbeddingsWhoseTextIsUnchanged() {
      String index = createIndex(service, "text", "{}", ELASTICSEARCH_VECTOR);
      assertOnlyUnchangedTextIsReused(service, index, service::getExistingEmbeddingsBatch);
    }

    @Test
    void aReindexReusesOnlyEmbeddingsOfTheConfiguredModel() {
      String index = createIndex(service, "model", "{}", ELASTICSEARCH_VECTOR);
      assertOnlyEmbeddingsOfTheConfiguredModelAreReused(
          serviceOf(modelA), serviceOf(modelB), index);
    }

    @Test
    void aSwitchToAnotherModelReembedsOnALiveEditARecreateAndAReembed() {
      String index = createIndex(service, "switch", "{}", ELASTICSEARCH_VECTOR);
      assertASwitchReembedsEverywhere(serviceOf(modelA), serviceOf(modelB), modelB, index);
    }
  }

  private static final String OPENSEARCH_SETTINGS = "{\"index\":{\"knn\":true}}";
  private static final String OPENSEARCH_VECTOR =
      "{\"type\":\"knn_vector\",\"dimension\":" + DIMENSION + "}";
  private static final String ELASTICSEARCH_VECTOR =
      "{\"type\":\"dense_vector\",\"dims\":" + DIMENSION + "}";

  /**
   * After a switch to model B, a reindex keeps none of model A's vectors, and none of a doc written
   * before docs recorded their model; under model A it keeps model A's.
   */
  private static void assertOnlyEmbeddingsOfTheConfiguredModelAreReused(
      VectorIndexService serviceOfA, VectorIndexService serviceOfB, String index) {
    Table embeddedByA = table("orders", "Orders placed online");
    Table unrecorded = table("payments", "Customer payments by card");
    seed(serviceOfA, index, embeddedByA, embeddingFieldsOf(embeddedByA, serviceOfA));
    Map<String, Object> withoutModel = new HashMap<>(embeddingFieldsOf(unrecorded, serviceOfA));
    withoutModel.keySet().removeAll(EmbeddingModel.FIELDS);
    seed(serviceOfA, index, unrecorded, withoutModel);
    Map<String, Supplier<String>> current =
        Map.of(
            id(embeddedByA), currentFingerprint(embeddedByA),
            id(unrecorded), currentFingerprint(unrecorded));

    assertEquals(Map.of(), serviceOfB.getExistingEmbeddingsBatch(index, current));
    assertEquals(
        Set.of(id(embeddedByA)), serviceOfA.getExistingEmbeddingsBatch(index, current).keySet());
  }

  /**
   * Model A embedded an entity on the real engine. Under model B, a live edit with unchanged text,
   * a recreate's chunk copy and {@code reembed} each give it model B's vectors.
   */
  private static void assertASwitchReembedsEverywhere(
      AbstractVectorIndexService serviceOfA,
      AbstractVectorIndexService serviceOfB,
      StubModel modelB,
      String index) {
    Table edited = table("customers", "Customers who ordered");
    Table copied = table("carriers", "Carriers we ship with");
    Table reembedded = table("shipments", "Shipments in transit");
    for (Table table : List.of(edited, copied, reembedded)) {
      embedAndWrite(serviceOfA, index, table);
    }
    refresh(serviceOfA, index);
    refresh(serviceOfA, serviceOfA.getChunkIndexName());

    serviceOfB.updateEntityEmbeddings(edited, index);
    String staged = serviceOfB.beginStagedChunkRecreate();
    int beforeTheCopy = modelB.textsEmbedded.get();
    assertTrue(serviceOfB.backfillEntityChunks(copied, staged));
    assertEquals(beforeTheCopy + 1, modelB.textsEmbedded.get(), "model A's chunks are not copied");
    assertTrue(serviceOfB.reembedEntity(reembedded, index));
    refresh(serviceOfB, index);
    refresh(serviceOfB, serviceOfB.getChunkIndexName());
    refresh(serviceOfB, staged);

    assertVectorsOf(modelB, serviceOfB, index, id(edited));
    assertVectorsOf(modelB, serviceOfB, serviceOfB.getChunkIndexName(), id(edited) + "_0");
    assertVectorsOf(modelB, serviceOfB, staged, id(copied) + "_0");
    assertVectorsOf(modelB, serviceOfB, index, id(reembedded));
    assertVectorsOf(modelB, serviceOfB, serviceOfB.getChunkIndexName(), id(reembedded) + "_0");
  }

  private static void embedAndWrite(AbstractVectorIndexService service, String index, Table table) {
    List<Map<String, Object>> chunks =
        VectorDocBuilder.fromEntity(table, service.getEmbeddingClient());
    seed(service, index, table, VectorDocBuilder.legacyEmbeddingFields(chunks.getFirst()));
    assertTrue(service.writeEntityChunks(id(table), chunks, null));
  }

  private static void assertVectorsOf(
      StubModel model, VectorIndexService service, String index, String docId) {
    JsonNode doc =
        JsonUtils.readTree(
            service.executeGenericRequest(
                "GET",
                "/" + index + "/_doc/" + docId + "?_source_includes=embedding,embeddingModel",
                null));
    JsonNode source = doc.path("_source");
    assertEquals(model.getModelId(), source.path("embeddingModel").asText(), index + " " + docId);
    assertEquals(
        JsonUtils.readTree(JsonUtils.pojoToJson(model.vector)),
        source.path("embedding"),
        index + " " + docId);
  }

  private static void refresh(VectorIndexService service, String index) {
    service.executeGenericRequest("POST", "/" + index + "/_refresh", null);
  }

  private static Map<String, Object> embeddingFieldsOf(Table table, VectorIndexService service) {
    return VectorDocBuilder.legacyEmbeddingFields(
        VectorDocBuilder.fromEntity(table, service.getEmbeddingClient()).getFirst());
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

  /** Each scenario gets its own index, since the scenarios of one engine share its cluster. */
  private static String createIndex(
      VectorIndexService service, String scenario, String settings, String vectorMapping) {
    String index =
        new TestNamespace("stored_embedding_reuse_" + scenario).prefix("table_search_index");
    String body =
        """
        {"settings":%s,"mappings":{"properties":{
          "name":{"type":"keyword"},
          "updatedAt":{"type":"date","format":"epoch_millis"},
          "fingerprint":{"type":"keyword"},
          "embeddingModel":{"type":"keyword"},
          "embeddingDimension":{"type":"integer"},
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
        "fingerprint",
        VectorDocBuilder.computeFingerprintForEntity(embeddedAs),
        "embedding",
        STORED_VECTOR,
        "parentId",
        id(embeddedAs),
        EmbeddingModel.ID_FIELD,
        NO_EMBEDDINGS.getModelId(),
        EmbeddingModel.DIMENSION_FIELD,
        DIMENSION);
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
