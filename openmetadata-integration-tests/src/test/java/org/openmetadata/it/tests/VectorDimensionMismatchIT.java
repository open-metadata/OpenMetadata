package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;
import org.openmetadata.schema.configuration.LLMOpenAIConfig;
import org.openmetadata.schema.configuration.LLMOpenAIEmbeddingConfig;
import org.openmetadata.service.search.vector.VectorSearchQueryBuilder;
import org.openmetadata.service.search.vector.client.OpenAIEmbeddingClient;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.opensearch.generic.Response;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

/**
 * Reproduces the production "vector dimension mismatch" reported by a BYOC customer (Saxo, OM
 * 1.12.x): semantic search fails with {@code query_shard_exception: "Query vector has invalid
 * dimension: 1536. Dimension should be: 512"}.
 *
 * <p>Root cause: {@link OpenAIEmbeddingClient} sizes the vector index from the configured
 * {@code embeddingDimension} (via {@code getDimension()}), but never forwards a {@code dimensions}
 * parameter on the OpenAI {@code /embeddings} request. {@code text-embedding-3-small} therefore
 * returns its native 1536-dimensional vector regardless of the configured dimension. When the
 * configured/index dimension differs from the model's native output, every query vector is rejected
 * by the knn field.
 *
 * <p>The mock OpenAI server mimics the real API contract: it honours a {@code dimensions} request
 * parameter when present, and otherwise returns the model's native 1536-dimensional vector.
 *
 * <p>Both tests assert the desired (fixed) behaviour, so on current {@code main} they FAIL — and the
 * failure output is the reproduction. They pass once the client pins the output dimension.
 */
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class VectorDimensionMismatchIT {

  private static final String MODEL_ID = "text-embedding-3-small";
  private static final int MODEL_NATIVE_DIMENSION = 1536;
  private static final int CONFIGURED_DIMENSION = 512;
  private static final String QUERY_TEXT = "databases related to customers";
  private static final String VECTOR_INDEX = "vector_search_index";

  @Container
  static OpensearchContainer<?> opensearch =
      new OpensearchContainer<>(DockerImageName.parse("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("discovery.type", "single-node")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");

  private final ObjectMapper mapper = new ObjectMapper();

  private HttpServer mockOpenAi;
  private volatile String lastRequestBody;
  private OpenAIEmbeddingClient embeddingClient;
  private OpenSearchClient openSearchClient;

  @BeforeAll
  void setUp() throws Exception {
    mockOpenAi = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    mockOpenAi.createContext("/embeddings", this::handleEmbeddings);
    mockOpenAi.start();

    String endpoint = "http://localhost:" + mockOpenAi.getAddress().getPort();
    embeddingClient = new OpenAIEmbeddingClient(buildOpenAiConfig(endpoint));

    HttpHost httpHost = new HttpHost("http", opensearch.getHost(), opensearch.getMappedPort(9200));
    ApacheHttpClient5Transport transport =
        ApacheHttpClient5TransportBuilder.builder(httpHost)
            .setMapper(new JacksonJsonpMapper())
            .build();
    openSearchClient = new OpenSearchClient(transport);
  }

  @AfterAll
  void tearDown() throws Exception {
    if (mockOpenAi != null) {
      mockOpenAi.stop(0);
    }
    if (openSearchClient != null) {
      openSearchClient._transport().close();
    }
  }

  @Test
  void openAiEmbeddingHonorsConfiguredDimension() {
    float[] vector = embeddingClient.embed(QUERY_TEXT);

    assertEquals(
        CONFIGURED_DIMENSION,
        embeddingClient.getDimension(),
        "Client should report the configured/index dimension");
    assertTrue(
        lastRequestBody != null && lastRequestBody.contains("\"dimensions\""),
        "OpenAI embedding request must pin the output size via a 'dimensions' parameter so the "
            + "returned vector matches the index dimension. Request body sent was: "
            + lastRequestBody);
    assertEquals(
        CONFIGURED_DIMENSION,
        vector.length,
        "Embedding vector length must equal the configured/index dimension. Got "
            + vector.length
            + " (the model's native size) because the request omitted 'dimensions' — this is the "
            + "root cause of the production dimension mismatch.");
  }

  @Test
  void knnSearchSucceedsWhenIndexAndEmbeddingDimensionsAgree() throws Exception {
    createVectorIndex(embeddingClient.getDimension());

    float[] queryVector = embeddingClient.embed(QUERY_TEXT);
    String searchBody = VectorSearchQueryBuilder.build(queryVector, 10, 0, 10, Map.of(), 0.0);

    int status;
    String responseBody;
    try (Response response =
        openSearchClient
            .generic()
            .execute(
                Requests.builder()
                    .method("POST")
                    .endpoint("/" + VECTOR_INDEX + "/_search")
                    .json(searchBody)
                    .build())) {
      status = response.getStatus();
      responseBody = response.getBody().map(b -> b.bodyAsString()).orElse("");
    }

    assertTrue(
        status < 400,
        "KNN query against the vector index must not fail. OpenSearch returned status "
            + status
            + " with body: "
            + responseBody
            + " — this reproduces the customer's 'Query vector has invalid dimension: "
            + queryVector.length
            + ". Dimension should be: "
            + CONFIGURED_DIMENSION
            + "' error.");
  }

  private void handleEmbeddings(HttpExchange exchange) throws java.io.IOException {
    byte[] requestBytes = exchange.getRequestBody().readAllBytes();
    String body = new String(requestBytes, StandardCharsets.UTF_8);
    lastRequestBody = body;

    int outputDimension = MODEL_NATIVE_DIMENSION;
    JsonNode root = mapper.readTree(body);
    if (root.has("dimensions") && root.get("dimensions").isInt()) {
      outputDimension = root.get("dimensions").asInt();
    }

    ObjectNode responseNode = mapper.createObjectNode();
    ArrayNode dataArray = responseNode.putArray("data");
    ObjectNode entry = dataArray.addObject();
    ArrayNode embedding = entry.putArray("embedding");
    for (int i = 0; i < outputDimension; i++) {
      embedding.add((float) ((i % 7) + 1) * 0.013f);
    }
    responseNode.put("model", MODEL_ID);

    byte[] responseBytes = mapper.writeValueAsBytes(responseNode);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(200, responseBytes.length);
    exchange.getResponseBody().write(responseBytes);
    exchange.close();
  }

  private LLMConfiguration buildOpenAiConfig(String endpoint) {
    return new LLMConfiguration()
        .withOpenai(new LLMOpenAIConfig().withApiKey("test-key").withEndpoint(endpoint))
        .withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                .withOpenai(
                    new LLMOpenAIEmbeddingConfig()
                        .withEmbeddingModelId(MODEL_ID)
                        .withEmbeddingDimension(CONFIGURED_DIMENSION)));
  }

  private void createVectorIndex(int dimension) throws Exception {
    ObjectNode root = mapper.createObjectNode();
    ObjectNode indexSettings = root.putObject("settings").putObject("index");
    indexSettings.put("knn", true);

    ObjectNode properties = root.putObject("mappings").putObject("properties");
    properties.putObject("deleted").put("type", "boolean");

    ObjectNode embeddingNode = properties.putObject("embedding");
    embeddingNode.put("type", "knn_vector");
    embeddingNode.put("dimension", dimension);
    ObjectNode methodNode = embeddingNode.putObject("method");
    methodNode.put("name", "hnsw");
    methodNode.put("engine", "lucene");
    methodNode.put("space_type", "cosinesimil");
    ObjectNode paramsNode = methodNode.putObject("parameters");
    paramsNode.put("m", 48);
    paramsNode.put("ef_construction", 256);

    try (Response response =
        openSearchClient
            .generic()
            .execute(
                Requests.builder()
                    .method("PUT")
                    .endpoint("/" + VECTOR_INDEX)
                    .json(mapper.writeValueAsString(root))
                    .build())) {
      if (response.getStatus() >= 400) {
        throw new IllegalStateException(
            "Failed to create vector index: " + response.getBody().map(b -> b.bodyAsString()));
      }
    }
  }
}
