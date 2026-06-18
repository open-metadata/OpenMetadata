/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.llm;

import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMBedrockConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.service.util.AwsCredentialsUtil;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.ContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.ConversationRole;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseRequest;
import software.amazon.awssdk.services.bedrockruntime.model.ConverseResponse;
import software.amazon.awssdk.services.bedrockruntime.model.InferenceConfiguration;
import software.amazon.awssdk.services.bedrockruntime.model.Message;
import software.amazon.awssdk.services.bedrockruntime.model.SystemContentBlock;
import software.amazon.awssdk.services.bedrockruntime.model.TokenUsage;

/** AWS Bedrock chat-completion client (Converse API — works with all Bedrock model families). */
@Slf4j
public final class BedrockCompletionClient extends LLMCompletionClient implements AutoCloseable {

  private final BedrockRuntimeClient bedrockClient;
  private final String modelId;
  private final double temperature;
  private final int maxTokens;
  private final int timeoutSeconds;

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
    this.timeoutSeconds = cfg.getTimeoutSeconds() == null ? 60 : cfg.getTimeoutSeconds();
    this.bedrockClient =
        BedrockRuntimeClient.builder()
            .credentialsProvider(AwsCredentialsUtil.buildCredentialsProvider(awsConfig))
            .region(Region.of(awsConfig.getRegion()))
            .build();
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
      ConverseResponse response =
          bedrockClient.converse(
              buildRequest(model, systemPrompt, userPrompt, tokens, temp, timeout));
      result = toResult(response);
    } catch (AwsServiceException | SdkClientException e) {
      throw new LLMCompletionException("Bedrock completion failed", e);
    }
    return result;
  }

  static ConverseRequest buildRequest(
      String model,
      String systemPrompt,
      String userPrompt,
      int maxTokens,
      double temperature,
      int timeoutSeconds) {
    return ConverseRequest.builder()
        .modelId(model)
        .system(SystemContentBlock.fromText(systemPrompt))
        .messages(
            Message.builder()
                .role(ConversationRole.USER)
                .content(ContentBlock.fromText(userPrompt))
                .build())
        .inferenceConfig(
            InferenceConfiguration.builder()
                .maxTokens(maxTokens)
                .temperature((float) temperature)
                .build())
        .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(timeoutSeconds)))
        .build();
  }

  static CompletionResult toResult(ConverseResponse response) {
    String text = extractText(response);
    if (text.isEmpty()) {
      throw new LLMCompletionException("Invalid Bedrock response: no text content returned");
    }
    TokenUsage usage = response.usage();
    int inputTokens = usage != null && usage.inputTokens() != null ? usage.inputTokens() : 0;
    int outputTokens = usage != null && usage.outputTokens() != null ? usage.outputTokens() : 0;
    return new CompletionResult(text, inputTokens, outputTokens);
  }

  private static String extractText(ConverseResponse response) {
    StringBuilder text = new StringBuilder();
    if (response.output() != null && response.output().message() != null) {
      for (ContentBlock block : response.output().message().content()) {
        if (block.text() != null) {
          text.append(block.text());
        }
      }
    }
    return text.toString();
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
