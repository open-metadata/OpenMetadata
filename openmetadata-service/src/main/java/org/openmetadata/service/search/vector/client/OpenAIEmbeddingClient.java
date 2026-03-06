package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.Openai;

@Slf4j
public final class OpenAIEmbeddingClient implements EmbeddingClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final HttpClient httpClient;
  private final String apiKey;
  private final String modelId;
  private final int dimension;
  private final String endpoint;
  private final boolean isAzure;

  public OpenAIEmbeddingClient(ElasticSearchConfiguration config) {
    NaturalLanguageSearchConfiguration nlsCfg = config.getNaturalLanguageSearch();
    Openai openaiCfg = nlsCfg.getOpenai();
    if (openaiCfg == null) {
      throw new IllegalArgumentException("OpenAI configuration is required");
    }
    if (openaiCfg.getApiKey() == null || openaiCfg.getApiKey().isBlank()) {
      throw new IllegalArgumentException("OpenAI API key is required");
    }
    if (openaiCfg.getEmbeddingModelId() == null || openaiCfg.getEmbeddingModelId().isBlank()) {
      throw new IllegalArgumentException("OpenAI embedding model ID is required");
    }
    if (openaiCfg.getEmbeddingDimension() == null || openaiCfg.getEmbeddingDimension() <= 0) {
      throw new IllegalArgumentException("OpenAI embedding dimension must be positive");
    }

    this.apiKey = openaiCfg.getApiKey();
    this.modelId = openaiCfg.getEmbeddingModelId();
    this.dimension = openaiCfg.getEmbeddingDimension();

    String endpoint = openaiCfg.getEndpoint();
    String deploymentName = openaiCfg.getDeploymentName();
    boolean hasEndpoint = endpoint != null && !endpoint.isBlank();
    boolean hasDeployment = deploymentName != null && !deploymentName.isBlank();

    this.isAzure = hasEndpoint && hasDeployment;

    if (this.isAzure
        && (openaiCfg.getApiVersion() == null || openaiCfg.getApiVersion().isBlank())) {
      throw new IllegalArgumentException(
          "Azure API version is required for Azure OpenAI deployments");
    }

    this.endpoint = resolveEndpoint(openaiCfg);
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

    LOG.info(
        "Initialized OpenAIEmbeddingClient with model={}, dimension={}, endpoint={}, azure={}",
        modelId,
        dimension,
        endpoint,
        isAzure);
  }

  OpenAIEmbeddingClient(
      HttpClient httpClient,
      String apiKey,
      String modelId,
      int dimension,
      String endpoint,
      boolean isAzure) {
    this.httpClient = httpClient;
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.dimension = dimension;
    this.endpoint = endpoint;
    this.isAzure = isAzure;
  }

  private String resolveEndpoint(Openai config) {
    String endpoint = config.getEndpoint();
    String deploymentName = config.getDeploymentName();
    boolean hasEndpoint = endpoint != null && !endpoint.isBlank();
    boolean hasDeployment = deploymentName != null && !deploymentName.isBlank();

    if (hasEndpoint && hasDeployment) {
      String base = endpoint.replaceAll("/+$", "");
      return String.format(
          "%s/openai/deployments/%s/embeddings?api-version=%s",
          base, deploymentName, config.getApiVersion());
    }
    if (hasEndpoint) {
      String base = endpoint.replaceAll("/+$", "");
      return base + "/embeddings";
    }
    return "https://api.openai.com/v1/embeddings";
  }

  @Override
  public float[] embed(String text) {
    if (text == null || text.isBlank()) {
      throw new IllegalArgumentException("Input text must not be null or blank");
    }

    try {
      ObjectNode payload = MAPPER.createObjectNode();
      ArrayNode inputArray = payload.putArray("input");
      inputArray.add(text);
      payload.put("model", modelId);
      String body = MAPPER.writeValueAsString(payload);

      HttpRequest.Builder requestBuilder =
          HttpRequest.newBuilder()
              .uri(URI.create(endpoint))
              .header("Content-Type", "application/json")
              .timeout(Duration.ofSeconds(30))
              .POST(HttpRequest.BodyPublishers.ofString(body));

      if (isAzure) {
        requestBuilder.header("api-key", apiKey);
      } else {
        requestBuilder.header("Authorization", "Bearer " + apiKey);
      }

      HttpResponse<String> response =
          httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        String errorMsg = extractErrorMessage(response.body());
        throw new RuntimeException(
            "OpenAI API returned status " + response.statusCode() + ": " + errorMsg);
      }

      return parseEmbeddingResponse(response.body());
    } catch (IOException e) {
      LOG.error("IO error calling OpenAI API: {}", e.getMessage(), e);
      throw new RuntimeException("OpenAI embedding generation failed due to IO error", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("OpenAI embedding generation was interrupted", e);
    }
  }

  @Override
  public int getDimension() {
    return dimension;
  }

  @Override
  public String getModelId() {
    return modelId;
  }

  private float[] parseEmbeddingResponse(String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode data = root.get("data");
      if (data == null || !data.isArray() || data.isEmpty()) {
        throw new RuntimeException("Invalid OpenAI response: no data array found");
      }
      JsonNode embeddingNode = data.get(0).get("embedding");
      if (embeddingNode == null || !embeddingNode.isArray()) {
        throw new RuntimeException("Invalid OpenAI response: no embedding array found");
      }
      float[] embedding = new float[embeddingNode.size()];
      for (int i = 0; i < embeddingNode.size(); i++) {
        embedding[i] = (float) embeddingNode.get(i).asDouble();
      }
      return embedding;
    } catch (IOException e) {
      throw new RuntimeException("Failed to parse OpenAI embedding response", e);
    }
  }

  private String extractErrorMessage(String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode error = root.get("error");
      if (error != null && error.has("message")) {
        return error.get("message").asText();
      }
    } catch (Exception ignored) {
    }
    return responseBody;
  }
}
