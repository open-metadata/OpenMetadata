package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.mapping.DenseVectorIndexOptions;
import es.co.elastic.clients.elasticsearch._types.mapping.Property;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.io.StringReader;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexManager;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.testcontainers.elasticsearch.ElasticsearchContainer;

/**
 * Creates and then updates entity index mappings on a real Elasticsearch. The engine treats a
 * {@code dense_vector} sent without {@code index_options} as its own default and refuses to change
 * the options of an existing field, and a refused field fails the whole {@code PUT _mapping}, so
 * only a real cluster shows whether every new field of an upgrade reaches the live index.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
class ElasticsearchVectorMappingUpdateIT {

  /** 384 dimensions or more get {@code bbq_hnsw} as the engine default from Elasticsearch 9.1. */
  private static final int DIMENSION = 384;

  private static final String FIRST_RELEASE_MAPPING =
      "{\"mappings\":{\"properties\":{\"fingerprint\":{\"type\":\"keyword\"},"
          + "\"name\":{\"type\":\"keyword\"}}}}";
  private static final String NEXT_RELEASE_MAPPING =
      "{\"mappings\":{\"properties\":{\"fingerprint\":{\"type\":\"keyword\"},"
          + "\"name\":{\"type\":\"keyword\"},\"addedInNextRelease\":{\"type\":\"keyword\"}}}}";
  private static final String EMBEDDING_WITH_ENGINE_DEFAULTS =
      "{\"mappings\":{\"properties\":{\"fingerprint\":{\"type\":\"keyword\"},"
          + "\"name\":{\"type\":\"keyword\"},\"embedding\":{\"type\":\"dense_vector\","
          + "\"dims\":"
          + DIMENSION
          + ",\"index\":true,\"similarity\":\"cosine\"}}}}";

  private static final class FixedDimensionClient extends EmbeddingClient {
    private final int dimension;

    FixedDimensionClient(int dimension) {
      this.dimension = dimension;
    }

    @Override
    protected float[] doEmbed(String text) {
      return new float[dimension];
    }

    @Override
    public int getDimension() {
      return dimension;
    }

    @Override
    public String getModelId() {
      return "vector-mapping-update";
    }
  }

  private final ElasticsearchContainer container =
      new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:9.3.0")
          .withEnv("discovery.type", "single-node")
          .withEnv("xpack.security.enabled", "false")
          .withEnv("ES_JAVA_OPTS", "-Xms512m -Xmx512m")
          .withStartupTimeout(Duration.ofMinutes(5));
  private Rest5Client restClient;
  private ElasticsearchClient client;
  private ElasticSearchIndexManager indexManager;

  @BeforeAll
  void start() {
    container.start();
    restClient =
        Rest5Client.builder(
                new HttpHost("http", container.getHost(), container.getMappedPort(9200)))
            .setHttpClientConfigCallback(builder -> builder.disableContentCompression())
            .build();
    client =
        new ElasticsearchClient(new Rest5ClientTransport(restClient, new JacksonJsonpMapper()));
    indexManager = new ElasticSearchIndexManager(client, "");
  }

  @AfterAll
  void stop() throws IOException {
    restClient.close();
    container.stop();
  }

  @Test
  void anUpgradeAddsItsNewFieldsToAnIndexWithPinnedVectorOptions() throws IOException {
    String rebuiltIndex = "pinned_table_search_index_rebuild_1";
    String canonicalName = "pinned_table_search_index";
    withEmbeddings(DIMENSION, () -> indexManager.createIndex(rebuiltIndex, FIRST_RELEASE_MAPPING));
    client.indices().putAlias(alias -> alias.index(rebuiltIndex).name(canonicalName));

    withEmbeddings(
        DIMENSION,
        () -> indexManager.updateIndex(entityIndex(canonicalName), NEXT_RELEASE_MAPPING));

    Map<String, Property> live = liveProperties(rebuiltIndex);
    assertTrue(live.containsKey("addedInNextRelease"), "the new field must reach the live index");
    DenseVectorIndexOptions options = live.get("embedding").denseVector().indexOptions();
    assertEquals("hnsw", options.type().jsonValue());
    assertEquals(48, options.m());
    assertEquals(256, options.efConstruction());
  }

  @Test
  void anUpgradeAddsItsNewFieldsToAnIndexCreatedWithTheEngineDefaults() throws IOException {
    String indexName = "default_options_table_search_index";
    client
        .indices()
        .create(
            create ->
                create.index(indexName).withJson(new StringReader(EMBEDDING_WITH_ENGINE_DEFAULTS)));
    String engineDefault = embeddingOptionsType(indexName);

    withEmbeddings(
        DIMENSION, () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    assertTrue(liveProperties(indexName).containsKey("addedInNextRelease"));
    assertNotEquals("hnsw", engineDefault, "the engine default must differ from the pinned one");
    assertEquals(engineDefault, embeddingOptionsType(indexName));
  }

  @Test
  void turningEmbeddingsOnAddsThePinnedVectorFieldToAnExistingIndex() throws IOException {
    String indexName = "embeddings_off_table_search_index";
    withSearchRepository(
        mock(SearchRepository.class),
        () -> indexManager.createIndex(indexName, FIRST_RELEASE_MAPPING));
    assertFalse(liveProperties(indexName).containsKey("embedding"));

    withEmbeddings(
        DIMENSION, () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    Map<String, Property> live = liveProperties(indexName);
    assertTrue(live.containsKey("addedInNextRelease"));
    assertEquals(DIMENSION, live.get("embedding").denseVector().dims());
    DenseVectorIndexOptions options = live.get("embedding").denseVector().indexOptions();
    assertEquals("hnsw", options.type().jsonValue());
    assertEquals(48, options.m());
  }

  @Test
  void anUpgradeWithAnotherEmbeddingDimensionFailsLoudly() {
    String indexName = "other_dimension_table_search_index";
    withEmbeddings(DIMENSION, () -> indexManager.createIndex(indexName, FIRST_RELEASE_MAPPING));

    assertThrows(
        IllegalStateException.class,
        () ->
            withEmbeddings(
                DIMENSION * 2,
                () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING)));
  }

  private static IndexMapping entityIndex(String indexName) {
    return IndexMapping.builder()
        .indexName(indexName)
        .alias(indexName + "_alias")
        .parentAliases(List.of())
        .childAliases(List.of())
        .build();
  }

  /** Runs the action with semantic search on, as {@code Entity.getSearchRepository()} reports it. */
  private static void withEmbeddings(int dimension, Runnable action) {
    SearchRepository searchRepository = mock(SearchRepository.class);
    EmbeddingClient embeddingClient = new FixedDimensionClient(dimension);
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
    withSearchRepository(searchRepository, action);
  }

  private static void withSearchRepository(SearchRepository searchRepository, Runnable action) {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      action.run();
    }
  }

  private Map<String, Property> liveProperties(String indexName) throws IOException {
    return client
        .indices()
        .getMapping(request -> request.index(indexName))
        .mappings()
        .get(indexName)
        .mappings()
        .properties();
  }

  private String embeddingOptionsType(String indexName) throws IOException {
    Property embedding = liveProperties(indexName).get("embedding");
    assertNotNull(embedding);
    return embedding.denseVector().indexOptions().type().jsonValue();
  }
}
