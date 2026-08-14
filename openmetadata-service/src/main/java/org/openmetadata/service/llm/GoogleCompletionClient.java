package org.openmetadata.service.llm;

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
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMGoogleConfig;

/** Google Gemini chat-completion client (generateContent). Mirrors GoogleEmbeddingClient. */
@Slf4j
public final class GoogleCompletionClient extends LLMCompletionClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String DEFAULT_BASE =
      "https://generativelanguage.googleapis.com/v1beta/models";

  private final HttpClient httpClient;
  private final String apiKey;
  private final String modelId;
  private final String base;
  private final double temperature;
  private final int maxTokens;
  private final int timeoutSeconds;

  public GoogleCompletionClient(LLMConfiguration config) {
    super(resolveMaxConcurrent(config));
    LLMGoogleConfig cfg = config.getGoogle();
    if (cfg == null || cfg.getApiKey() == null || cfg.getApiKey().isBlank()) {
      throw new IllegalArgumentException("Google API key is required for LLM completion");
    }
    this.apiKey = cfg.getApiKey();
    this.modelId = cfg.getModelId();
    this.temperature = cfg.getTemperature() == null ? 0.0 : cfg.getTemperature();
    this.maxTokens = cfg.getMaxTokens() == null ? 4096 : cfg.getMaxTokens();
    this.timeoutSeconds = cfg.getTimeoutSeconds() == null ? 60 : cfg.getTimeoutSeconds();
    // API key travels in a header, never the URL, so it can't leak via logged URIs or
    // exception messages that include the endpoint.
    this.base =
        cfg.getEndpoint() == null || cfg.getEndpoint().isBlank()
            ? DEFAULT_BASE
            : cfg.getEndpoint().replaceAll("/+$", "");
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  }

  @Override
  protected CompletionResult doComplete(
      String systemPrompt, String userPrompt, CompletionOptions options) {
    String model = options.modelIdOr(this.modelId);
    int tokens = options.maxTokensOr(this.maxTokens);
    double temp = options.temperatureOr(this.temperature);
    int timeout = options.timeoutSecondsOr(this.timeoutSeconds);
    String url = String.format("%s/%s:generateContent", base, model);
    CompletionResult result;
    try {
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .header("Content-Type", "application/json")
              .header("x-goog-api-key", apiKey)
              .timeout(Duration.ofSeconds(timeout))
              .POST(
                  HttpRequest.BodyPublishers.ofString(
                      buildRequestBody(systemPrompt, userPrompt, tokens, temp)))
              .build();
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        throw new LLMCompletionException(
            "Google API returned status " + response.statusCode() + ": " + response.body());
      }
      result = parseResult(response.body());
    } catch (IOException e) {
      throw new LLMCompletionException("Google completion failed due to IO error", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LLMCompletionException("Google completion was interrupted", e);
    }
    return result;
  }

  static String buildRequestBody(
      String systemPrompt, String userPrompt, int maxTokens, double temperature) {
    String result;
    try {
      ObjectNode payload = MAPPER.createObjectNode();
      ObjectNode systemInstruction = payload.putObject("system_instruction");
      systemInstruction.putArray("parts").addObject().put("text", systemPrompt);
      ArrayNode contents = payload.putArray("contents");
      ObjectNode userContent = contents.addObject();
      userContent.put("role", "user");
      userContent.putArray("parts").addObject().put("text", userPrompt);
      ObjectNode generationConfig = payload.putObject("generationConfig");
      generationConfig.put("temperature", temperature);
      generationConfig.put("maxOutputTokens", maxTokens);
      result = MAPPER.writeValueAsString(payload);
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to build Google request body", e);
    }
    return result;
  }

  static CompletionResult parseResult(String responseBody) {
    CompletionResult result;
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode text =
          root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
      if (!text.isTextual()) {
        throw new LLMCompletionException("Invalid Google response: no text content returned");
      }
      JsonNode usage = root.path("usageMetadata");
      result =
          new CompletionResult(
              text.asText(),
              usage.path("promptTokenCount").asInt(0),
              usage.path("candidatesTokenCount").asInt(0));
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to parse Google response", e);
    }
    return result;
  }

  @Override
  public String getModelId() {
    return modelId;
  }
}
