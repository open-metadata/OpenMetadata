/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 *  or implied. See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.Google;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;

@Slf4j
public final class GoogleEmbeddingClient extends EmbeddingClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String MODELS_PREFIX = "models/";
  private static final String DEFAULT_BASE_URL =
      "https://generativelanguage.googleapis.com/v1beta/" + MODELS_PREFIX;

  private final HttpClient httpClient;
  private final String apiKey;
  private final String modelId;
  private final int dimension;
  private final String endpoint;

  public GoogleEmbeddingClient(ElasticSearchConfiguration config) {
    super(resolveMaxConcurrent(config));
    NaturalLanguageSearchConfiguration nlsCfg = config.getNaturalLanguageSearch();
    Google googleCfg = nlsCfg.getGoogle();
    if (googleCfg == null) {
      throw new IllegalArgumentException("Google configuration is required");
    }
    if (googleCfg.getApiKey() == null || googleCfg.getApiKey().isBlank()) {
      throw new IllegalArgumentException("Google API key is required");
    }
    if (googleCfg.getEmbeddingModelId() == null || googleCfg.getEmbeddingModelId().isBlank()) {
      throw new IllegalArgumentException("Google embedding model ID is required");
    }
    if (googleCfg.getEmbeddingDimension() == null || googleCfg.getEmbeddingDimension() <= 0) {
      throw new IllegalArgumentException("Google embedding dimension must be positive");
    }

    this.apiKey = googleCfg.getApiKey();
    this.modelId = googleCfg.getEmbeddingModelId();
    this.dimension = googleCfg.getEmbeddingDimension();
    this.endpoint = resolveEndpoint(googleCfg);
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

    LOG.info(
        "Initialized GoogleEmbeddingClient with model={}, dimension={}, endpoint={}",
        modelId,
        dimension,
        endpoint);
  }

  GoogleEmbeddingClient(
      HttpClient httpClient, String apiKey, String modelId, int dimension, String endpoint) {
    this(httpClient, apiKey, modelId, dimension, endpoint, DEFAULT_MAX_CONCURRENT_REQUESTS);
  }

  GoogleEmbeddingClient(
      HttpClient httpClient,
      String apiKey,
      String modelId,
      int dimension,
      String endpoint,
      int maxConcurrentRequests) {
    super(maxConcurrentRequests);
    this.httpClient = httpClient;
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.dimension = dimension;
    this.endpoint = endpoint;
  }

  private String resolveEndpoint(Google config) {
    String configured = config.getEndpoint();
    if (configured != null && !configured.isBlank()) {
      String normalizedEndpoint = configured.replaceAll("/+$", "");
      if (!normalizedEndpoint.contains(":embedContent")) {
        throw new IllegalArgumentException(
            "Invalid google.endpoint configuration. Expected a full Google embedding endpoint "
                + "URL containing ':embedContent', for example "
                + "'https://generativelanguage.googleapis.com/v1beta/models/"
                + config.getEmbeddingModelId()
                + ":embedContent'.");
      }
      return normalizedEndpoint;
    }
    return DEFAULT_BASE_URL + config.getEmbeddingModelId() + ":embedContent";
  }

  @Override
  protected float[] doEmbed(String text) {
    if (text == null || text.isBlank()) {
      throw new IllegalArgumentException("Input text must not be null or blank");
    }

    try {
      String body = buildRequestBody(text);
      HttpRequest request = buildRequest(body);
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        String errorMsg = extractErrorMessage(response.body());
        throw new RuntimeException(
            "Google API returned status " + response.statusCode() + ": " + errorMsg);
      }

      return parseEmbeddingResponse(response.body());
    } catch (IOException e) {
      LOG.error("IO error calling Google API: {}", e.getMessage(), e);
      throw new RuntimeException("Google embedding generation failed due to IO error", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Google embedding generation was interrupted", e);
    }
  }

  private String buildRequestBody(String text) throws IOException {
    ObjectNode payload = MAPPER.createObjectNode();
    payload.put("model", MODELS_PREFIX + modelId);
    ObjectNode content = payload.putObject("content");
    ArrayNode parts = content.putArray("parts");
    ObjectNode part = parts.addObject();
    part.put("text", text);
    // Pin the response vector size to the configured dimension. Required for `gemini-embedding-001`
    // (defaults to 3072 otherwise); supported and silently truncating for `text-embedding-004`.
    payload.put("outputDimensionality", dimension);
    return MAPPER.writeValueAsString(payload);
  }

  private HttpRequest buildRequest(String body) {
    // Google's Generative Language API requires the API key as a `key=` query parameter;
    // it does not accept Bearer/Authorization headers for AI Studio keys.
    String encodedKey = URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
    String separator = endpoint.contains("?") ? "&" : "?";
    String url = endpoint + separator + "key=" + encodedKey;
    return HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Content-Type", "application/json")
        .timeout(Duration.ofSeconds(30))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
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
      JsonNode embedding = root.get("embedding");
      if (embedding == null || !embedding.isObject()) {
        throw new RuntimeException("Invalid Google response: no embedding object found");
      }
      JsonNode values = embedding.get("values");
      if (values == null || !values.isArray() || values.isEmpty()) {
        throw new RuntimeException("Invalid Google response: no values array found");
      }
      float[] result = new float[values.size()];
      for (int i = 0; i < values.size(); i++) {
        result[i] = (float) values.get(i).asDouble();
      }
      return result;
    } catch (IOException e) {
      throw new RuntimeException("Failed to parse Google embedding response", e);
    }
  }

  private String extractErrorMessage(String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode error = root.get("error");
      if (error != null && error.has("message")) {
        return error.get("message").asText();
      }
    } catch (Exception e) {
      LOG.trace("Could not parse Google error envelope: {}", e.getMessage());
    }
    return responseBody;
  }
}
