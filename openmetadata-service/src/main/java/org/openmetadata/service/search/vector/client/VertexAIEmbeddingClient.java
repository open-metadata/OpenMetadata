/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 *  or implied. See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMGoogleConfig;
import org.openmetadata.schema.configuration.LLMGoogleEmbeddingConfig;

public final class VertexAIEmbeddingClient extends EmbeddingClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration TIMEOUT = Duration.ofSeconds(30);
  private static final String CLOUD_PLATFORM_SCOPE =
      "https://www.googleapis.com/auth/cloud-platform";

  private final GoogleCredentials credentials;
  private final HttpClient http;
  private final URI endpoint;
  private final String modelId;
  private final int dimension;

  public VertexAIEmbeddingClient(LLMConfiguration config) {
    this(
        config,
        HttpClient.newBuilder().connectTimeout(TIMEOUT).build(),
        VertexAIEmbeddingClient::applicationCredentials);
  }

  VertexAIEmbeddingClient(
      LLMConfiguration config, HttpClient http, Supplier<GoogleCredentials> credentialProvider) {
    super(resolveMaxConcurrent(config));
    final LLMGoogleEmbeddingConfig embeddings = config.getEmbeddings().getGoogle();
    this.modelId = embeddings.getEmbeddingModelId();
    this.endpoint = predictionEndpoint(config.getGoogle(), modelId);
    if (embeddings.getEmbeddingDimension() == null || embeddings.getEmbeddingDimension() < 1) {
      throw new IllegalArgumentException("Google embedding dimension must be positive");
    }
    this.dimension = embeddings.getEmbeddingDimension();
    this.http = http;
    this.credentials = credentialProvider.get().createScoped(List.of(CLOUD_PLATFORM_SCOPE));
  }

  private static GoogleCredentials applicationCredentials() {
    try {
      return GoogleCredentials.getApplicationDefault();
    } catch (IOException e) {
      throw new UncheckedIOException(
          "Unable to load Google Application Default Credentials for Vertex AI", e);
    }
  }

  private static URI predictionEndpoint(LLMGoogleConfig google, String modelId) {
    final String project = google.getVertexProject();
    final String location = google.getVertexLocation();
    if (project == null || !project.matches("[a-z0-9][a-z0-9-]*")) {
      throw new IllegalArgumentException(
          "LLM_GOOGLE_VERTEX_PROJECT must be a Google Cloud project ID or number");
    }
    if (location == null || !location.matches("[a-z][a-z0-9-]*")) {
      throw new IllegalArgumentException(
          "LLM_GOOGLE_VERTEX_LOCATION must be a Google Cloud location");
    }
    if (modelId == null || !modelId.matches("[a-zA-Z0-9][a-zA-Z0-9._-]*")) {
      throw new IllegalArgumentException(
          "GOOGLE_EMBEDDING_MODEL_ID must be a Google publisher model ID");
    }
    final String host =
        location.equals("global")
            ? "aiplatform.googleapis.com"
            : location + "-aiplatform.googleapis.com";
    return URI.create(
        "https://"
            + host
            + "/v1/projects/"
            + project
            + "/locations/"
            + location
            + "/publishers/google/models/"
            + modelId
            + ":predict");
  }

  @Override
  protected float[] doEmbed(String text) {
    return doEmbedWithUsage(text, false).vector();
  }

  @Override
  protected EmbeddingResult doEmbedWithUsage(String text, boolean query) {
    if (text == null || text.isBlank()) {
      throw new IllegalArgumentException("Input text must not be null or blank");
    }
    try {
      final HttpResponse<String> response =
          http.send(buildRequest(text, query), HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        throw new IllegalStateException(
            "Vertex AI embedding request failed with HTTP " + response.statusCode());
      }
      return parsePrediction(response.body());
    } catch (IOException e) {
      throw new UncheckedIOException("Vertex AI embedding request failed", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Vertex AI embedding request was interrupted", e);
    }
  }

  private HttpRequest buildRequest(String text, boolean query) throws IOException {
    final ObjectNode payload = MAPPER.createObjectNode();
    payload
        .putArray("instances")
        .addObject()
        .put("content", text)
        .put("task_type", query ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT");
    payload.putObject("parameters").put("outputDimensionality", dimension);
    final HttpRequest.Builder request =
        HttpRequest.newBuilder(endpoint)
            .timeout(TIMEOUT)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload)));
    // Request metadata lets the SDK refresh tokens and supply the ADC quota project when
    // configured.
    credentials
        .getRequestMetadata(endpoint)
        .forEach((name, values) -> values.forEach(value -> request.header(name, value)));
    return request.build();
  }

  private EmbeddingResult parsePrediction(String body) throws IOException {
    final JsonNode embeddings = MAPPER.readTree(body).at("/predictions/0/embeddings");
    final JsonNode values = embeddings.path("values");
    if (!values.isArray() || values.size() != dimension) {
      throw new IllegalStateException(
          "Vertex AI response must contain an embedding with " + dimension + " values");
    }
    final float[] vector = new float[dimension];
    for (int index = 0; index < dimension; index++) {
      if (!values.get(index).isNumber() || !Float.isFinite(values.get(index).floatValue())) {
        throw new IllegalStateException("Vertex AI returned an invalid embedding value");
      }
      vector[index] = values.get(index).floatValue();
    }
    final JsonNode tokens = embeddings.at("/statistics/token_count");
    final EmbeddingUsage usage =
        tokens.canConvertToExactIntegral() && tokens.canConvertToLong() && tokens.longValue() >= 0
            ? new EmbeddingUsage(tokens.longValue())
            : null;
    return new EmbeddingResult(vector, usage);
  }

  @Override
  public int getDimension() {
    return dimension;
  }

  @Override
  public String getModelId() {
    return modelId;
  }
}
