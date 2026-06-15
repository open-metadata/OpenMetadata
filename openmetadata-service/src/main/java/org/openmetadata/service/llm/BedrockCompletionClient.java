package org.openmetadata.service.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMBedrockConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.service.util.AwsCredentialsUtil;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

/** AWS Bedrock chat-completion client (Anthropic messages API). Mirrors BedrockEmbeddingClient. */
@Slf4j
public final class BedrockCompletionClient extends LLMCompletionClient implements AutoCloseable {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ANTHROPIC_VERSION = "bedrock-2023-05-31";

  private final BedrockRuntimeClient bedrockClient;
  private final String modelId;
  private final double temperature;
  private final int maxTokens;

  public BedrockCompletionClient(LLMConfiguration config) {
    super(resolveMaxConcurrent(config));
    LLMBedrockConfig cfg = config.getBedrock();
    if (cfg == null) {
      throw new IllegalArgumentException("Bedrock configuration is required for LLM completion");
    }
    AWSBaseConfig awsConfig = cfg.getAwsConfig();
    if (awsConfig == null || awsConfig.getRegion() == null || awsConfig.getRegion().isBlank()) {
      throw new IllegalArgumentException("AWS region is required for Bedrock completion");
    }
    this.modelId = cfg.getModelId();
    this.temperature = cfg.getTemperature() == null ? 0.0 : cfg.getTemperature();
    this.maxTokens = cfg.getMaxTokens() == null ? 4096 : cfg.getMaxTokens();
    this.bedrockClient =
        BedrockRuntimeClient.builder()
            .credentialsProvider(AwsCredentialsUtil.buildCredentialsProvider(awsConfig))
            .region(Region.of(awsConfig.getRegion()))
            .build();
  }

  @Override
  protected CompletionResult doComplete(
      String systemPrompt, String userPrompt, CompletionOptions options) {
    String text;
    try {
      InvokeModelRequest request =
          InvokeModelRequest.builder()
              .modelId(modelId)
              .contentType("application/json")
              .accept("application/json")
              .body(SdkBytes.fromUtf8String(buildRequestBody(systemPrompt, userPrompt)))
              .build();
      InvokeModelResponse response = bedrockClient.invokeModel(request);
      text = parseContent(response.body().asUtf8String());
    } catch (AwsServiceException | SdkClientException e) {
      throw new LLMCompletionException("Bedrock completion failed", e);
    }
    return new CompletionResult(text, 0, 0);
  }

  private String buildRequestBody(String systemPrompt, String userPrompt) {
    String result;
    try {
      ObjectNode payload = MAPPER.createObjectNode();
      payload.put("anthropic_version", ANTHROPIC_VERSION);
      payload.put("max_tokens", maxTokens);
      payload.put("temperature", temperature);
      payload.put("system", systemPrompt);
      ArrayNode messages = payload.putArray("messages");
      messages.addObject().put("role", "user").put("content", userPrompt);
      result = MAPPER.writeValueAsString(payload);
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to build Bedrock request body", e);
    }
    return result;
  }

  private String parseContent(String responseBody) {
    String result;
    try {
      JsonNode content = MAPPER.readTree(responseBody).get("content");
      if (content == null || !content.isArray() || content.isEmpty()) {
        throw new LLMCompletionException("Invalid Bedrock response: no content returned");
      }
      result = content.get(0).get("text").asText();
    } catch (IOException e) {
      throw new LLMCompletionException("Failed to parse Bedrock response", e);
    }
    return result;
  }

  @Override
  public String getModelId() {
    return modelId;
  }

  @Override
  public void close() {
    if (bedrockClient != null) {
      bedrockClient.close();
    }
  }
}
