package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.MockedStatic;
import org.openmetadata.it.util.MappingReadFailingProxy;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexManager;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.slf4j.LoggerFactory;
import org.testcontainers.elasticsearch.ElasticsearchContainer;

/**
 * Creates and then updates entity index mappings on a real Elasticsearch. The engine treats a
 * {@code dense_vector} sent without {@code index_options} as its own default and refuses to change
 * the options or the dimensions of an existing field, and a refused field fails the whole {@code
 * PUT _mapping}, so only a real cluster shows whether every new field of an upgrade reaches the
 * live index.
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
  private static final String EMBEDDING_AS_FLOATS =
      "{\"mappings\":{\"properties\":{\"fingerprint\":{\"type\":\"keyword\"},"
          + "\"name\":{\"type\":\"keyword\"},\"embedding\":{\"type\":\"float\"}}}}";

  /**
   * Elasticsearch 9.3 maps {@code element_type: bfloat16}, which the Java client of this build has
   * no enum value for, so a typed read of the whole mapping cannot parse this index.
   */
  private static final String UNRELATED_FIELD_THE_CLIENT_CANNOT_PARSE =
      "{\"mappings\":{\"properties\":{\"fingerprint\":{\"type\":\"keyword\"},"
          + "\"name\":{\"type\":\"keyword\"},\"previewVector\":{\"type\":\"dense_vector\","
          + "\"dims\":4,\"element_type\":\"bfloat16\"}}}}";

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
      return "vector-mapping-update-" + dimension;
    }
  }

  /** Another supported version can be checked with {@code -DelasticsearchVectorMappingImage}. */
  private static final String IMAGE =
      System.getProperty(
          "elasticsearchVectorMappingImage", "docker.elastic.co/elasticsearch/elasticsearch:9.3.0");

  private final ElasticsearchContainer container =
      new ElasticsearchContainer(IMAGE)
          .withEnv("discovery.type", "single-node")
          .withEnv("xpack.security.enabled", "false")
          .withEnv("ES_JAVA_OPTS", "-Xms512m -Xmx512m")
          .withStartupTimeout(Duration.ofMinutes(5));
  private final HttpClient http = HttpClient.newHttpClient();
  private final ListAppender<ILoggingEvent> searchLogs = new ListAppender<>();
  private Rest5Client restClient;
  private ElasticsearchClient client;
  private ElasticSearchIndexManager indexManager;

  @BeforeAll
  void start() {
    container.start();
    restClient = restClient(container.getHost(), container.getMappedPort(9200));
    client =
        new ElasticsearchClient(new Rest5ClientTransport(restClient, new JacksonJsonpMapper()));
    indexManager = new ElasticSearchIndexManager(client, "");
  }

  @AfterAll
  void stop() throws IOException {
    restClient.close();
    container.stop();
  }

  @BeforeEach
  void captureSearchLogs() {
    searchLogs.list.clear();
    searchLogs.start();
    searchLogger().addAppender(searchLogs);
  }

  @AfterEach
  void releaseSearchLogs() {
    searchLogger().detachAppender(searchLogs);
  }

  @Test
  void anUpgradeAddsItsNewFieldsToAnIndexWithPinnedVectorOptions() throws Exception {
    String rebuiltIndex = "pinned_table_search_index_rebuild_1";
    String canonicalName = "pinned_table_search_index";
    withEmbeddings(DIMENSION, () -> indexManager.createIndex(rebuiltIndex, FIRST_RELEASE_MAPPING));
    client.indices().putAlias(alias -> alias.index(rebuiltIndex).name(canonicalName));

    withEmbeddings(
        DIMENSION,
        () -> indexManager.updateIndex(entityIndex(canonicalName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(rebuiltIndex);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    JsonNode options = live.path("properties").path("embedding").path("index_options");
    assertEquals("hnsw", options.path("type").asText());
    assertEquals(48, options.path("m").asInt());
    assertEquals(256, options.path("ef_construction").asInt());
    assertTrue(errors().isEmpty(), "the normal path reports nothing: " + errors());
  }

  @Test
  void anUpgradeAddsItsNewFieldsToAnIndexCreatedWithTheEngineDefaults() throws Exception {
    String indexName = "default_options_table_search_index";
    createRaw(indexName, EMBEDDING_WITH_ENGINE_DEFAULTS);
    String engineDefault = embeddingOptionsType(indexName);

    withEmbeddings(
        DIMENSION, () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    assertTrue(liveMappings(indexName).path("properties").has("addedInNextRelease"));
    assertNotEquals("hnsw", engineDefault, "the engine default must differ from the pinned one");
    assertEquals(engineDefault, embeddingOptionsType(indexName));
  }

  @Test
  void turningEmbeddingsOnAddsThePinnedVectorFieldToAnExistingIndex() throws Exception {
    String indexName = "embeddings_off_table_search_index";
    withSearchRepository(
        mock(SearchRepository.class),
        () -> indexManager.createIndex(indexName, FIRST_RELEASE_MAPPING));
    assertFalse(liveMappings(indexName).path("properties").has("embedding"));

    withEmbeddings(
        DIMENSION, () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode embedding = liveMappings(indexName).path("properties").path("embedding");
    assertTrue(liveMappings(indexName).path("properties").has("addedInNextRelease"));
    assertEquals(DIMENSION, embedding.path("dims").asInt());
    assertEquals("hnsw", embedding.path("index_options").path("type").asText());
    assertEquals(48, embedding.path("index_options").path("m").asInt());
  }

  @Test
  void anUpgradeWithAnotherEmbeddingDimensionStillAddsItsOtherFieldsAndSaysHowToRebuild()
      throws Exception {
    String indexName = "other_dimension_table_search_index";
    withEmbeddings(DIMENSION, () -> indexManager.createIndex(indexName, FIRST_RELEASE_MAPPING));

    assertDoesNotThrow(
        () ->
            withEmbeddings(
                DIMENSION * 2,
                () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING)));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dims").asInt());
    assertEquals(DIMENSION, live.path("_meta").path("embedding_dimension").asInt());
    assertReportedOnce(
        indexName, String.valueOf(DIMENSION), String.valueOf(DIMENSION * 2), "reindex --force");
  }

  @Test
  void anEmbeddingMappedAsAnotherTypeIsReportedAndLeftAlone() throws Exception {
    String indexName = "float_embedding_table_search_index";
    createRaw(indexName, EMBEDDING_AS_FLOATS);

    withEmbeddings(
        DIMENSION, () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals("float", live.path("properties").path("embedding").path("type").asText());
    assertReportedOnce(indexName, "float", String.valueOf(DIMENSION), "reindex --force");
  }

  @Test
  void aFieldTheClientCannotParseElsewhereInTheMappingDoesNotBlockTheUpdate() throws Exception {
    String indexName = "unparsed_field_table_search_index";
    createRaw(indexName, UNRELATED_FIELD_THE_CLIENT_CANNOT_PARSE);

    withEmbeddings(
        DIMENSION, () -> indexManager.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dims").asInt());
    assertTrue(errors().isEmpty(), "nothing to report: " + errors());
  }

  @Test
  void theLiveFieldIsReadThroughTheAliasOfARebuiltIndex() throws Exception {
    String rebuiltIndex = "aliased_table_search_index_rebuild_2";
    String canonicalName = "aliased_table_search_index";
    withEmbeddings(DIMENSION, () -> indexManager.createIndex(rebuiltIndex, FIRST_RELEASE_MAPPING));
    client.indices().putAlias(alias -> alias.index(rebuiltIndex).name(canonicalName));

    withEmbeddings(
        DIMENSION * 2,
        () -> indexManager.updateIndex(entityIndex(canonicalName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(rebuiltIndex);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dims").asInt());
    assertReportedOnce(
        rebuiltIndex, String.valueOf(DIMENSION), String.valueOf(DIMENSION * 2), "reindex --force");
  }

  @Test
  void aFailedLiveReadStillAddsTheOtherFieldsAndNeverResendsTheVectorField() throws Exception {
    String indexName = "unreadable_table_search_index";
    createRaw(indexName, EMBEDDING_WITH_ENGINE_DEFAULTS);
    String engineDefault = embeddingOptionsType(indexName);

    try (MappingReadFailingProxy proxy =
            new MappingReadFailingProxy(container.getHost(), container.getMappedPort(9200));
        Rest5Client proxiedRest = restClient("localhost", proxy.port())) {
      ElasticSearchIndexManager proxied =
          new ElasticSearchIndexManager(
              new ElasticsearchClient(
                  new Rest5ClientTransport(proxiedRest, new JacksonJsonpMapper())),
              "");
      withEmbeddings(
          DIMENSION, () -> proxied.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));
    }

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(engineDefault, embeddingOptionsType(indexName));
    assertTrue(live.path("_meta").isMissingNode(), "an unverified field gets no _meta stamp");
    assertReportedOnce(indexName, "Could not read", "Restart the server");
  }

  @Test
  void theServerDeclaresThePinnedVectorFieldOnAnIndexCreatedWithoutIt() throws Exception {
    String indexName = "created_at_startup_table_search_index";
    withSearchRepository(
        mock(SearchRepository.class),
        () -> indexManager.createIndex(indexName, FIRST_RELEASE_MAPPING));

    withEmbeddings(DIMENSION, () -> indexManager.updateEmbeddingField(entityIndex(indexName)));

    JsonNode live = liveMappings(indexName);
    JsonNode embedding = live.path("properties").path("embedding");
    assertEquals("dense_vector", embedding.path("type").asText());
    assertEquals(DIMENSION, embedding.path("dims").asInt());
    assertEquals(48, embedding.path("index_options").path("m").asInt());
    assertEquals(DIMENSION, live.path("_meta").path("embedding_dimension").asInt());
    assertTrue(errors().isEmpty(), "nothing to report: " + errors());
  }

  @Test
  void theServerLeavesAnIndexOfTheConfiguredDimensionAlone() throws Exception {
    String indexName = "current_model_table_search_index";
    withEmbeddings(DIMENSION, () -> indexManager.createIndex(indexName, FIRST_RELEASE_MAPPING));
    JsonNode before = liveMappings(indexName);

    withEmbeddings(DIMENSION, () -> indexManager.updateEmbeddingField(entityIndex(indexName)));

    assertEquals(before, liveMappings(indexName));
    assertTrue(errors().isEmpty(), "nothing to report: " + errors());
  }

  @Test
  void theServerReportsAnIndexHoldingAnotherDimensionAndLeavesItAlone() throws Exception {
    String indexName = "previous_model_table_search_index";
    withEmbeddings(DIMENSION, () -> indexManager.createIndex(indexName, FIRST_RELEASE_MAPPING));
    JsonNode before = liveMappings(indexName);

    withEmbeddings(DIMENSION * 2, () -> indexManager.updateEmbeddingField(entityIndex(indexName)));

    assertEquals(before, liveMappings(indexName));
    assertReportedOnce(
        indexName, String.valueOf(DIMENSION), String.valueOf(DIMENSION * 2), "reindex --force");
  }

  private static Rest5Client restClient(String host, int port) {
    return Rest5Client.builder(new HttpHost("http", host, port))
        .setHttpClientConfigCallback(builder -> builder.disableContentCompression())
        .build();
  }

  /** Creates the index over plain HTTP, so the client model does not have to know the mapping. */
  private void createRaw(String indexName, String mapping) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(baseUrl() + "/" + indexName))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(mapping))
            .build();
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(response.statusCode() < 300, "create " + indexName + ": " + response.body());
  }

  private String baseUrl() {
    return "http://" + container.getHost() + ":" + container.getMappedPort(9200);
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

  /** The live mapping read as raw JSON, so no client model has to understand every field. */
  private JsonNode liveMappings(String indexName) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(baseUrl() + "/" + indexName + "/_mapping")).GET().build();
    String body = http.send(request, HttpResponse.BodyHandlers.ofString()).body();
    return JsonUtils.readTree(body).path(indexName).path("mappings");
  }

  private String embeddingOptionsType(String indexName) throws Exception {
    JsonNode embedding = liveMappings(indexName).path("properties").path("embedding");
    assertTrue(embedding.isObject(), "the index must map embedding");
    return embedding.path("index_options").path("type").asText();
  }

  private static Logger searchLogger() {
    return (Logger) LoggerFactory.getLogger("org.openmetadata.service.search");
  }

  private List<String> errors() {
    return searchLogs.list.stream()
        .filter(event -> event.getLevel() == Level.ERROR)
        .map(ILoggingEvent::getFormattedMessage)
        .toList();
  }

  /** One error names the index and every given detail, and tells the operator what to run. */
  private void assertReportedOnce(String indexName, String... details) {
    List<String> reports =
        errors().stream().filter(message -> message.contains(indexName)).toList();
    assertEquals(1, reports.size(), "one error for " + indexName + ", got " + errors());
    String report = reports.getFirst();
    for (String detail : details) {
      assertTrue(report.contains(detail), "'" + detail + "' missing from: " + report);
    }
  }
}
