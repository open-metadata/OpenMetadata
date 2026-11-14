package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.events.lifecycle.handlers.SearchIndexHandler;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchIndexManager;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Isolated("Temporarily installs an embedding-enabled search repository")
@Execution(ExecutionMode.SAME_THREAD)
class OpenSearchVectorReaderIT {
  private static final int DIMENSION = 64;
  private static final List<Double> VECTOR = Collections.nCopies(DIMENSION, 0.1);
  private static final EmbeddingClient EMBEDDINGS =
      new EmbeddingClient() {
        @Override
        protected float[] doEmbed(String text) {
          throw new UnsupportedOperationException("This test writes fixed vectors directly");
        }

        @Override
        public int getDimension() {
          return DIMENSION;
        }

        @Override
        public String getModelId() {
          return "reader-regression";
        }
      };

  @Container
  private static final OpensearchContainer<?> OPENSEARCH =
      new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");

  private OpenSearchClient client;
  private SearchRepository previousRepository;
  private List<EntityLifecycleEventHandler> previousHandlers;

  @BeforeAll
  void setUp() throws IOException {
    previousRepository = Entity.getSearchRepository();
    previousHandlers = EntityLifecycleEventDispatcher.getInstance().getHandlers();
    IndexMappingLoader.init();
    final var repository =
        new SearchRepository(
            new ElasticSearchConfiguration()
                .withHost(OPENSEARCH.getHost())
                .withPort(OPENSEARCH.getMappedPort(9200))
                .withScheme("http")
                .withSearchType(ElasticSearchConfiguration.SearchType.OPENSEARCH)
                .withConnectionTimeoutSecs(10)
                .withSocketTimeoutSecs(30)
                .withKeepAliveTimeoutSecs(600)
                .withBatchSize(10)
                .withClusterAlias(new TestNamespace("vector_reader").prefix("repro"))
                .withNaturalLanguageSearch(
                    new NaturalLanguageSearchConfiguration().withSemanticSearchEnabled(true)),
            1) {
          @Override
          public EmbeddingClient getEmbeddingClient() {
            return EMBEDDINGS;
          }
        };
    Entity.setSearchRepository(repository);
    client = (OpenSearchClient) repository.getSearchClient();
  }

  @AfterAll
  void tearDown() {
    Entity.setSearchRepository(previousRepository);
    final var dispatcher = EntityLifecycleEventDispatcher.getInstance();
    dispatcher.unregisterHandler(SearchIndexHandler.class.getSimpleName());
    previousHandlers.forEach(dispatcher::replaceHandler);
    if (client != null) {
      client.close();
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void embeddingUpdatesSurviveConcurrentReaderRelease(boolean chunks) throws Exception {
    final var vectorService = new OpenSearchVectorService(client.getNewClient(), EMBEDDINGS);
    final String index = createIndex(vectorService, chunks);
    try {
      seedDocuments(vectorService, index);
      exerciseReaders(vectorService, index);

      final var updatedVector = Collections.nCopies(DIMENSION, 0.2);
      vectorService.partialUpdateEntity(
          index, "500", Map.of("embedding", updatedVector, "fingerprint", "updated"));
      final JsonNode source =
          request(vectorService, "GET", "/" + index + "/_doc/500", null).path("_source");
      assertEquals("updated", source.path("fingerprint").asText());
      assertEquals("test-500", source.path("name").asText());
      assertEquals(
          JsonUtils.readTree(JsonUtils.pojoToJson(updatedVector)), source.path("embedding"));
      final String query =
          """
          {"size":1,"query":{"knn":{"embedding":{"vector":%s,"k":1}}}}
          """
              .formatted(JsonUtils.pojoToJson(VECTOR));
      assertEquals(
          1,
          request(vectorService, "POST", "/" + index + "/_search", query)
              .path("hits")
              .path("hits")
              .size());
      assertEquals(
          "false",
          request(
                  vectorService,
                  "GET",
                  "/" + index + "/_settings?flat_settings=true&include_defaults=true",
                  null)
              .path(index)
              .path("settings")
              .path("index.knn.derived_source.enabled")
              .asText());
    } finally {
      vectorService.executeGenericRequest("DELETE", "/" + index, null);
    }
  }

  private String createIndex(OpenSearchVectorService vectorService, boolean chunks)
      throws IOException {
    if (chunks) {
      vectorService.writeEntityChunks("seed", List.of());
      return vectorService.getChunkIndexName();
    }
    final String index = new TestNamespace("vector_reader").prefix("test_case_search_index");
    try (var mapping =
        getClass().getResourceAsStream("/elasticsearch/en/test_case_index_mapping.json")) {
      new OpenSearchIndexManager(client.getNewClient(), "")
          .createIndex(index, new String(mapping.readAllBytes(), StandardCharsets.UTF_8));
    }
    return index;
  }

  private void seedDocuments(OpenSearchVectorService service, String index) {
    service.executeGenericRequest(
        "PUT",
        "/" + index + "/_settings",
        """
        {"index":{"number_of_replicas":0,"refresh_interval":"100ms"}}
        """);
    final var bulk = new StringBuilder();
    for (int id = 0; id < 1000; id++) {
      bulk.append(JsonUtils.pojoToJson(Map.of("index", Map.of("_id", Integer.toString(id)))))
          .append('\n');
      bulk.append(JsonUtils.pojoToJson(Map.of("name", "test-" + id, "embedding", VECTOR)))
          .append('\n');
    }
    final JsonNode response =
        request(service, "POST", "/" + index + "/_bulk?refresh=true", bulk.toString());
    assertFalse(response.path("errors").asBoolean(), response::toString);
    service.executeGenericRequest("POST", "/" + index + "/_flush", null);
  }

  private void exerciseReaders(OpenSearchVectorService service, String index) throws Exception {
    final List<Callable<Void>> tasks = new ArrayList<>();
    for (int worker = 0; worker < 3; worker++) {
      final int operation = worker;
      tasks.add(
          () -> {
            for (int iteration = 0; iteration < 20; iteration++) {
              exerciseReader(service, index, operation, iteration);
            }
            return null;
          });
    }
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      for (var result : executor.invokeAll(tasks, 90, TimeUnit.SECONDS)) {
        result.get();
      }
    }
  }

  private void exerciseReader(
      OpenSearchVectorService service, String index, int worker, int iteration) {
    switch (worker) {
      case 0 -> {
        service.executeGenericRequest(
            "POST",
            "/" + index + "/_update/" + iteration + "?retry_on_conflict=3&timeout=1s",
            JsonUtils.pojoToJson(
                Map.of(
                    "doc",
                    Map.of("fingerprint", Integer.toString(iteration), "embedding", VECTOR))));
        service.executeGenericRequest("POST", "/" + index + "/_refresh", null);
        service.executeGenericRequest("POST", "/" + index + "/_flush", null);
      }
      case 1 -> service.executeGenericRequest(
          "POST", "/" + index + "/_forcemerge?max_num_segments=5", null);
      default -> {
        final JsonNode scroll =
            request(service, "POST", "/" + index + "/_search?scroll=1m", "{\"size\":100}");
        service.executeGenericRequest("POST", "/" + index + "/_refresh", null);
        service.executeGenericRequest(
            "DELETE",
            "/_search/scroll",
            JsonUtils.pojoToJson(Map.of("scroll_id", scroll.path("_scroll_id").asText())));
      }
    }
  }

  private JsonNode request(
      OpenSearchVectorService service, String method, String path, String body) {
    return JsonUtils.readTree(service.executeGenericRequest(method, path, body));
  }
}
