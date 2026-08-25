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
import org.openmetadata.schema.configuration.LLMAnthropicConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;

/** Anthropic Messages API chat-completion client. */
@Slf4j
public final class AnthropicCompletionClient extends LLMCompletionClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ANTHROPIC_VERSION = "2023-06-01";
  private static final String DEFAULT_BASE_URL = "https://api.anthropic.com";

  private final HttpClient httpClient;
  private final String apiKey;
  private final String modelId;
  private final String endpoint;
  private final double temperature;
  private final int maxTokens;
  private final int timeoutSeconds;

  public AnthropicCompletionClient(LLMConfiguration config) {
    super(resolveMaxConcurrent(config));
    LLMAnthropicConfig cfg = config.getAnthropic();
    if (cfg == null || cfg.getApiKey() == null || cfg.getApiKey().isBlank()) {
      throw new IllegalArgumentException("Anthropic API key is required for LLM completion");
    }
    this.apiKey = cfg.getApiKey();
    this.modelId = cfg.getModelId();
    this.temperature = cfg.getTemperature() == null ? 0.0 : cfg.getTemperature();
    this.maxTokens = cfg.getMaxTokens() == null ? 4096 : cfg.getMaxTokens();
    this.timeoutSeconds = cfg.getTimeoutSeconds() == null ? 60 : cfg.getTimeoutSeconds();
    String base =
        cfg.getBaseUrl() == null || cfg.getBaseUrl().isBlank()
            ? DEFAULT_BASE_URL
            : cfg.getBaseUrl().replaceAll("/+$", "");
    this.endpoint = base + "/v1/messages";
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  }

  @Override
  protected CompletionResult doComplete(
      String systemPrompt, String userPrompt, CompletionOptions options) {
    String model = options.modelIdOr(this.modelId);
    int tokens = options.maxTokensOr(this.maxTokens);
    double temp = options.temperatureOr(this.temperature);
    int timeout = options.timeoutSecondsOr(this.timeoutSeconds);
    CompletionResult result;
    try {
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(endpoint))
              .header("Content-Type", "application/json")
              .header("x-api-key", apiKey)
              .header("anthropic-version", ANTHROPIC_VERSION)
              .timeout(Duration.ofSeconds(timeout))
              .POST(
                  HttpRequest.BodyPublishers.ofString(
                      buildRequestBody(systemPrompt, userPrompt, model, tokens, temp)))
              .build();
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        throw new LLMCompletionException(
            "Anthropic API returned status " + response.statusCode() + ": " + response.body());
      }
      result = parseResult(response.body());
    } catch (IOException e) {
      throw new LLMCompletionException("Anthropic completion failed due to IO error", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LLMCompletionException("Anthropic completion was interrupted", e);
    }
    return result;
  }

  static String buildRequestBody(
      String systemPrompt, String userPrompt, String model, int maxTokens, double temperature) {
    String result;
    try {
      ObjectNode payload = MAPPER.createObjectNode();
      payload.put("model", model);
      payload.put("max_tokens", maxTokens);
      payload.put("temperature", temperature);
      payload.put("system", systemPrompt);
      ArrayNode messages = payload.putArray("messages");
      messages.addObject().put("role", "user").put("content", userPrompt);
      result = MAPPER.writeValueAsString(payload);
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to build Anthropic request body", e);
    }
    return result;
  }

  static CompletionResult parseResult(String responseBody) {
    CompletionResult result;
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode text = root.path("content").path(0).path("text");
      if (!text.isTextual()) {
        throw new LLMCompletionException("Invalid Anthropic response: no text content returned");
      }
      JsonNode usage = root.path("usage");
      result =
          new CompletionResult(
              text.asText(),
              usage.path("input_tokens").asInt(0),
              usage.path("output_tokens").asInt(0));
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to parse Anthropic response", e);
    }
    return result;
  }

  @Override
  public String getModelId() {
    return modelId;
  }
}
