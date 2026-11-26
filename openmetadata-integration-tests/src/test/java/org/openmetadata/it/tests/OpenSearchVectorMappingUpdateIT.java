package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
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
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.opensearch.testcontainers.OpensearchContainer;
import org.slf4j.LoggerFactory;
import org.testcontainers.utility.DockerImageName;

/**
 * Creates and then updates entity index mappings on a real OpenSearch. The engine refuses to change
 * the dimension or the method of an existing {@code knn_vector}, and a refused field fails the
 * whole {@code PUT _mapping}, so only a real cluster shows whether every new field of an upgrade
 * reaches the live index.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.SAME_THREAD)
class OpenSearchVectorMappingUpdateIT {

  private static final int DIMENSION = 384;

  private static final String FIRST_RELEASE_MAPPING =
      "{\"settings\":{\"index\":{}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"}}}}";
  private static final String NEXT_RELEASE_MAPPING =
      "{\"settings\":{\"index\":{}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"},"
          + "\"addedInNextRelease\":{\"type\":\"keyword\"}}}}";
  private static final String EMBEDDING_WITH_OTHER_METHOD_PARAMETERS =
      "{\"settings\":{\"index\":{\"knn\":true}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"},"
          + "\"embedding\":{\"type\":\"knn_vector\",\"dimension\":"
          + DIMENSION
          + ",\"method\":{\"name\":\"hnsw\",\"engine\":\"lucene\",\"space_type\":\"cosinesimil\","
          + "\"parameters\":{\"m\":16,\"ef_construction\":100}}}}}}";
  private static final String KNN_INDEX_WITHOUT_VECTOR_FIELD =
      "{\"settings\":{\"index\":{\"knn\":true}},\"mappings\":{\"properties\":{"
          + "\"fingerprint\":{\"type\":\"keyword\"},\"name\":{\"type\":\"keyword\"}}}}";
  private static final String EMBEDDING_AS_FLOATS =
      "{\"mappings\":{\"properties\":{\"fingerprint\":{\"type\":\"keyword\"},"
          + "\"name\":{\"type\":\"keyword\"},\"embedding\":{\"type\":\"float\"}}}}";

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

  /** Another supported version can be checked with {@code -DopensearchVectorMappingImage}. */
  private static final String IMAGE =
      System.getProperty("opensearchVectorMappingImage", "opensearchproject/opensearch:3.4.0");

  private final OpensearchContainer<?> container =
      new OpensearchContainer<>(DockerImageName.parse(IMAGE))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");
  private final HttpClient http = HttpClient.newHttpClient();
  private final ListAppender<ILoggingEvent> searchLogs = new ListAppender<>();
  private OpenSearchClient client;

  @BeforeAll
  void start() {
    container.start();
    client = new OpenSearchClient(configFor(container.getHost(), container.getMappedPort(9200)));
  }

  @AfterAll
  void stop() {
    client.close();
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
  void anUpgradeAddsItsNewFieldsToAnIndexWithTheVectorField() throws Exception {
    String rebuiltIndex = "pinned_table_search_index_rebuild_1";
    String canonicalName = "pinned_table_search_index";
    withEmbeddings(DIMENSION, () -> client.createIndex(rebuiltIndex, FIRST_RELEASE_MAPPING));
    send("PUT", "/" + rebuiltIndex + "/_alias/" + canonicalName, "{}");

    withEmbeddings(
        DIMENSION, () -> client.updateIndex(entityIndex(canonicalName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(rebuiltIndex);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    JsonNode embedding = live.path("properties").path("embedding");
    assertEquals(DIMENSION, embedding.path("dimension").asInt());
    assertEquals(48, embedding.path("method").path("parameters").path("m").asInt());
    assertTrue(errors().isEmpty(), "the normal path reports nothing: " + errors());
  }

  @Test
  void anUpgradeKeepsTheMethodAnExistingVectorFieldWasCreatedWith() throws Exception {
    String indexName = "other_method_table_search_index";
    send("PUT", "/" + indexName, EMBEDDING_WITH_OTHER_METHOD_PARAMETERS);

    withEmbeddings(
        DIMENSION, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(
        16,
        live.path("properties")
            .path("embedding")
            .path("method")
            .path("parameters")
            .path("m")
            .asInt());
    assertTrue(errors().isEmpty(), "nothing to report: " + errors());
  }

  @Test
  void turningEmbeddingsOnAddsTheVectorFieldToAnIndexWithVectorSupport() throws Exception {
    String indexName = "knn_ready_table_search_index";
    send("PUT", "/" + indexName, KNN_INDEX_WITHOUT_VECTOR_FIELD);

    withEmbeddings(
        DIMENSION, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals("knn_vector", live.path("properties").path("embedding").path("type").asText());
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dimension").asInt());
    assertTrue(errors().isEmpty(), "nothing to report: " + errors());
  }

  @Test
  void turningEmbeddingsOnReportsThatAnIndexCreatedWithoutKnnNeedsARebuild() throws Exception {
    String indexName = "embeddings_off_table_search_index";
    withSearchRepository(
        mock(SearchRepository.class), () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));
    assertFalse(liveMappings(indexName).path("properties").has("embedding"));

    withEmbeddings(
        DIMENSION, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertFalse(live.path("properties").has("embedding"));
    assertReportedOnce(indexName, "created without vector support", "reindex --force");
  }

  @Test
  void anUpgradeWithAnotherEmbeddingDimensionStillAddsItsOtherFieldsAndSaysHowToRebuild()
      throws Exception {
    String indexName = "other_dimension_table_search_index";
    withEmbeddings(DIMENSION, () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));

    assertDoesNotThrow(
        () ->
            withEmbeddings(
                DIMENSION * 2,
                () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING)));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dimension").asInt());
    assertReportedOnce(
        indexName, String.valueOf(DIMENSION), String.valueOf(DIMENSION * 2), "reindex --force");
  }

  @Test
  void anEmbeddingMappedAsAnotherTypeIsReportedAndLeftAlone() throws Exception {
    String indexName = "float_embedding_table_search_index";
    send("PUT", "/" + indexName, EMBEDDING_AS_FLOATS);

    withEmbeddings(
        DIMENSION, () -> client.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals("float", live.path("properties").path("embedding").path("type").asText());
    assertReportedOnce(indexName, "float", String.valueOf(DIMENSION), "reindex --force");
  }

  @Test
  void theLiveFieldIsReadThroughTheAliasOfARebuiltIndex() throws Exception {
    String rebuiltIndex = "aliased_table_search_index_rebuild_2";
    String canonicalName = "aliased_table_search_index";
    withEmbeddings(DIMENSION, () -> client.createIndex(rebuiltIndex, FIRST_RELEASE_MAPPING));
    send("PUT", "/" + rebuiltIndex + "/_alias/" + canonicalName, "{}");

    withEmbeddings(
        DIMENSION * 2, () -> client.updateIndex(entityIndex(canonicalName), NEXT_RELEASE_MAPPING));

    JsonNode live = liveMappings(rebuiltIndex);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(DIMENSION, live.path("properties").path("embedding").path("dimension").asInt());
    assertReportedOnce(
        rebuiltIndex, String.valueOf(DIMENSION), String.valueOf(DIMENSION * 2), "reindex --force");
  }

  @Test
  void aFailedLiveReadStillAddsTheOtherFieldsAndNeverResendsTheVectorField() throws Exception {
    String indexName = "unreadable_table_search_index";
    send("PUT", "/" + indexName, EMBEDDING_WITH_OTHER_METHOD_PARAMETERS);

    try (MappingReadFailingProxy proxy =
        new MappingReadFailingProxy(container.getHost(), container.getMappedPort(9200))) {
      OpenSearchClient proxied = new OpenSearchClient(configFor("localhost", proxy.port()));
      try {
        withEmbeddings(
            DIMENSION, () -> proxied.updateIndex(entityIndex(indexName), NEXT_RELEASE_MAPPING));
      } finally {
        proxied.close();
      }
    }

    JsonNode live = liveMappings(indexName);
    assertTrue(live.path("properties").has("addedInNextRelease"));
    assertEquals(
        16,
        live.path("properties")
            .path("embedding")
            .path("method")
            .path("parameters")
            .path("m")
            .asInt());
    assertReportedOnce(indexName, "Could not read", "Restart the server");
  }

  @Test
  void theServerDeclaresTheVectorFieldOnAnIndexWithVectorSupport() throws Exception {
    String indexName = "knn_ready_at_startup_table_search_index";
    send("PUT", "/" + indexName, KNN_INDEX_WITHOUT_VECTOR_FIELD);

    withEmbeddings(DIMENSION, () -> client.updateEmbeddingField(entityIndex(indexName)));

    JsonNode embedding = liveMappings(indexName).path("properties").path("embedding");
    assertEquals("knn_vector", embedding.path("type").asText());
    assertEquals(DIMENSION, embedding.path("dimension").asInt());
    assertTrue(errors().isEmpty(), "nothing to report: " + errors());
  }

  @Test
  void theServerReportsAnIndexCreatedWithoutKnnAndLeavesItAlone() throws Exception {
    String indexName = "created_at_startup_table_search_index";
    withSearchRepository(
        mock(SearchRepository.class), () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));

    withEmbeddings(DIMENSION, () -> client.updateEmbeddingField(entityIndex(indexName)));

    assertFalse(liveMappings(indexName).path("properties").has("embedding"));
    assertReportedOnce(indexName, "created without vector support", "reindex --force");
  }

  @Test
  void theServerReportsAnIndexHoldingAnotherDimensionAndLeavesItAlone() throws Exception {
    String indexName = "previous_model_table_search_index";
    withEmbeddings(DIMENSION, () -> client.createIndex(indexName, FIRST_RELEASE_MAPPING));
    JsonNode before = liveMappings(indexName);

    withEmbeddings(DIMENSION * 2, () -> client.updateEmbeddingField(entityIndex(indexName)));

    assertEquals(before, liveMappings(indexName));
    assertReportedOnce(
        indexName, String.valueOf(DIMENSION), String.valueOf(DIMENSION * 2), "reindex --force");
  }

  private static ElasticSearchConfiguration configFor(String host, int port) {
    return new ElasticSearchConfiguration()
        .withHost(host)
        .withPort(port)
        .withScheme("http")
        .withSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH)
        .withConnectionTimeoutSecs(10)
        .withSocketTimeoutSecs(30)
        .withKeepAliveTimeoutSecs(600)
        .withBatchSize(10)
        .withClusterAlias("");
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

  private String send(String method, String path, String body) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(
                URI.create(
                    "http://" + container.getHost() + ":" + container.getMappedPort(9200) + path))
            .header("Content-Type", "application/json")
            .method(method, HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(response.statusCode() < 300, method + " " + path + ": " + response.body());
    return response.body();
  }

  private JsonNode liveMappings(String indexName) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(
                URI.create(
                    "http://"
                        + container.getHost()
                        + ":"
                        + container.getMappedPort(9200)
                        + "/"
                        + indexName
                        + "/_mapping"))
            .GET()
            .build();
    String body = http.send(request, HttpResponse.BodyHandlers.ofString()).body();
    return JsonUtils.readTree(body).path(indexName).path("mappings");
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
