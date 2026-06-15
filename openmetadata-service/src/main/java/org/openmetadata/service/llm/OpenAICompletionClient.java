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
import org.openmetadata.schema.configuration.LLMOpenAIConfig;

/** OpenAI (and Azure OpenAI) chat-completion client. Mirrors {@code OpenAIEmbeddingClient}. */
@Slf4j
public final class OpenAICompletionClient extends LLMCompletionClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";

  private final HttpClient httpClient;
  private final String apiKey;
  private final String modelId;
  private final String endpoint;
  private final boolean isAzure;
  private final double temperature;
  private final int maxTokens;
  private final int timeoutSeconds;

  public OpenAICompletionClient(LLMConfiguration config) {
    super(resolveMaxConcurrent(config));
    LLMOpenAIConfig cfg = config.getOpenai();
    if (cfg == null || cfg.getApiKey() == null || cfg.getApiKey().isBlank()) {
      throw new IllegalArgumentException("OpenAI API key is required for LLM completion");
    }
    this.apiKey = cfg.getApiKey();
    this.modelId = cfg.getModelId();
    this.temperature = cfg.getTemperature() == null ? 0.0 : cfg.getTemperature();
    this.maxTokens = cfg.getMaxTokens() == null ? 4096 : cfg.getMaxTokens();
    this.timeoutSeconds = cfg.getTimeoutSeconds() == null ? 60 : cfg.getTimeoutSeconds();
    boolean hasEndpoint = cfg.getEndpoint() != null && !cfg.getEndpoint().isBlank();
    boolean hasDeployment = cfg.getDeploymentName() != null && !cfg.getDeploymentName().isBlank();
    this.isAzure = hasEndpoint && hasDeployment;
    this.endpoint = resolveEndpoint(cfg);
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  }

  private String resolveEndpoint(LLMOpenAIConfig cfg) {
    String configured = cfg.getEndpoint();
    boolean hasEndpoint = configured != null && !configured.isBlank();
    boolean hasDeployment = cfg.getDeploymentName() != null && !cfg.getDeploymentName().isBlank();
    String result = DEFAULT_ENDPOINT;
    if (hasEndpoint && hasDeployment) {
      String base = configured.replaceAll("/+$", "");
      result =
          String.format(
              "%s/openai/deployments/%s/chat/completions?api-version=%s",
              base, cfg.getDeploymentName(), cfg.getApiVersion());
    } else if (hasEndpoint) {
      result = configured.replaceAll("/+$", "") + "/chat/completions";
    }
    return result;
  }

  @Override
  protected String doComplete(String systemPrompt, String userPrompt) {
    String result;
    try {
      HttpRequest request = buildRequest(buildRequestBody(systemPrompt, userPrompt));
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        throw new LLMCompletionException(
            "OpenAI API returned status " + response.statusCode() + ": " + response.body());
      }
      result = parseContent(response.body());
    } catch (IOException e) {
      throw new LLMCompletionException("OpenAI completion failed due to IO error", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LLMCompletionException("OpenAI completion was interrupted", e);
    }
    return result;
  }

  private HttpRequest buildRequest(String body) {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(endpoint))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(timeoutSeconds))
            .POST(HttpRequest.BodyPublishers.ofString(body));
    if (isAzure) {
      builder.header("api-key", apiKey);
    } else {
      builder.header("Authorization", "Bearer " + apiKey);
    }
    return builder.build();
  }

  private String buildRequestBody(String systemPrompt, String userPrompt) {
    String result;
    try {
      ObjectNode payload = MAPPER.createObjectNode();
      payload.put("model", modelId);
      payload.put("temperature", temperature);
      payload.put("max_tokens", maxTokens);
      ArrayNode messages = payload.putArray("messages");
      messages.addObject().put("role", "system").put("content", systemPrompt);
      messages.addObject().put("role", "user").put("content", userPrompt);
      result = MAPPER.writeValueAsString(payload);
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to build OpenAI request body", e);
    }
    return result;
  }

  static String parseContent(String responseBody) {
    String result;
    try {
      JsonNode content =
          MAPPER.readTree(responseBody).path("choices").path(0).path("message").path("content");
      if (!content.isTextual()) {
        throw new LLMCompletionException("Invalid OpenAI response: no message content returned");
      }
      result = content.asText();
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to parse OpenAI response", e);
    }
    return result;
  }

  @Override
  public String getModelId() {
    return modelId;
  }
}
