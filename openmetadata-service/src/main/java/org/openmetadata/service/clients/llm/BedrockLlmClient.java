/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.clients.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.internal.McpChatAppConfig;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.AwsCredentialsUtil;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClientBuilder;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

@Slf4j
public class BedrockLlmClient implements LlmClient {
  private static final int MAX_TOKENS = 4096;
  private static final String ANTHROPIC_VERSION = "bedrock-2023-05-31";

  private final String model;
  private final ObjectMapper mapper;
  private final BedrockRuntimeClient bedrockClient;

  public BedrockLlmClient(McpChatAppConfig config) {
    this.model = config.getLlmModel();
    this.mapper = JsonUtils.getObjectMapper();

    AWSBaseConfig awsConfig = config.getAwsConfig();
    if (awsConfig == null || awsConfig.getRegion() == null) {
      throw new IllegalArgumentException(
          "AWS configuration with a region is required for the Bedrock LLM provider.");
    }
    BedrockRuntimeClientBuilder builder =
        BedrockRuntimeClient.builder()
            .credentialsProvider(AwsCredentialsUtil.buildCredentialsProvider(awsConfig))
            .region(Region.of(awsConfig.getRegion()));

    if (awsConfig.getEndpointUrl() != null) {
      builder.endpointOverride(awsConfig.getEndpointUrl());
    }

    this.bedrockClient = builder.build();
  }

  @Override
  public LlmResponse sendMessages(List<LlmMessage> messages, List<Map<String, Object>> tools) {
    ObjectNode requestBody = buildRequestBody(messages, tools);
    String json;
    try {
      json = mapper.writeValueAsString(requestBody);
    } catch (IOException e) {
      throw new LlmException("Failed to serialize Bedrock request", e);
    }

    InvokeModelRequest request =
        InvokeModelRequest.builder()
            .modelId(model)
            .contentType("application/json")
            .accept("application/json")
            .body(SdkBytes.fromUtf8String(json))
            .build();

    InvokeModelResponse response = bedrockClient.invokeModel(request);
    return parseResponse(response.body().asUtf8String());
  }

  @Override
  public LlmResponse sendMessagesStreaming(
      List<LlmMessage> messages, List<Map<String, Object>> tools, Consumer<String> onTextChunk) {
    LOG.warn(
        "Bedrock provider does not support true streaming; falling back to non-streaming response");
    LlmResponse response = sendMessages(messages, tools);
    if (response.content() != null) {
      onTextChunk.accept(response.content());
    }
    return response;
  }

  @Override
  public void close() {
    if (bedrockClient != null) {
      bedrockClient.close();
    }
  }

  private ObjectNode buildRequestBody(List<LlmMessage> messages, List<Map<String, Object>> tools) {
    ObjectNode body = mapper.createObjectNode();
    body.put("anthropic_version", ANTHROPIC_VERSION);
    body.put("max_tokens", MAX_TOKENS);

    String systemPrompt = extractSystemPrompt(messages);
    if (systemPrompt != null) {
      body.put("system", systemPrompt);
    }

    ArrayNode messagesArray = body.putArray("messages");
    for (LlmMessage msg : messages) {
      if (msg.role() == LlmMessage.Role.system) {
        continue;
      }
      messagesArray.add(buildMessageNode(msg));
    }

    if (tools != null && !tools.isEmpty()) {
      ArrayNode toolsArray = body.putArray("tools");
      for (Map<String, Object> tool : tools) {
        toolsArray.add(buildToolNode(tool));
      }
    }

    return body;
  }

  private String extractSystemPrompt(List<LlmMessage> messages) {
    for (LlmMessage msg : messages) {
      if (msg.role() == LlmMessage.Role.system && msg.content() != null) {
        return msg.content();
      }
    }
    return null;
  }

  private ObjectNode buildMessageNode(LlmMessage msg) {
    ObjectNode node = mapper.createObjectNode();

    if (msg.role() == LlmMessage.Role.tool) {
      node.put("role", "user");
      ArrayNode contentArray = node.putArray("content");
      ObjectNode toolResultBlock = mapper.createObjectNode();
      toolResultBlock.put("type", "tool_result");
      toolResultBlock.put("tool_use_id", msg.toolCallId());
      toolResultBlock.put("content", msg.content() != null ? msg.content() : "");
      contentArray.add(toolResultBlock);
      return node;
    }

    node.put("role", msg.role() == LlmMessage.Role.assistant ? "assistant" : "user");

    if (msg.toolCalls() != null && !msg.toolCalls().isEmpty()) {
      ArrayNode contentArray = node.putArray("content");
      for (LlmToolCall tc : msg.toolCalls()) {
        ObjectNode toolUseBlock = mapper.createObjectNode();
        toolUseBlock.put("type", "tool_use");
        toolUseBlock.put("id", tc.id());
        toolUseBlock.put("name", tc.name());
        try {
          toolUseBlock.set("input", mapper.readTree(tc.arguments()));
        } catch (IOException e) {
          toolUseBlock.put("input", tc.arguments());
        }
        contentArray.add(toolUseBlock);
      }
      return node;
    }

    if (msg.content() != null) {
      node.put("content", msg.content());
    }

    return node;
  }

  @SuppressWarnings("unchecked")
  private ObjectNode buildToolNode(Map<String, Object> tool) {
    ObjectNode toolNode = mapper.createObjectNode();

    Map<String, Object> function = (Map<String, Object>) tool.get("function");
    if (function != null) {
      toolNode.put("name", (String) function.get("name"));
      if (function.containsKey("description")) {
        toolNode.put("description", (String) function.get("description"));
      }
      if (function.containsKey("parameters")) {
        toolNode.set("input_schema", mapper.valueToTree(function.get("parameters")));
      }
    }

    return toolNode;
  }

  private LlmResponse parseResponse(String responseBody) {
    try {
      JsonNode root = mapper.readTree(responseBody);

      String stopReason = root.has("stop_reason") ? root.get("stop_reason").asText() : null;

      JsonNode usage = root.path("usage");
      int inputTokens = usage.path("input_tokens").asInt(0);
      int outputTokens = usage.path("output_tokens").asInt(0);

      StringBuilder textContent = new StringBuilder();
      List<LlmToolCall> toolCalls = new ArrayList<>();

      JsonNode contentArray = root.path("content");
      if (contentArray.isArray()) {
        for (JsonNode block : contentArray) {
          String type = block.path("type").asText();
          if ("text".equals(type)) {
            textContent.append(block.path("text").asText());
          } else if ("tool_use".equals(type)) {
            String id = block.get("id").asText();
            String name = block.get("name").asText();
            String arguments = mapper.writeValueAsString(block.get("input"));
            toolCalls.add(new LlmToolCall(id, name, arguments));
          }
        }
      }

      String content = textContent.length() > 0 ? textContent.toString() : null;
      return new LlmResponse(content, toolCalls, inputTokens, outputTokens, stopReason);
    } catch (IOException e) {
      throw new LlmException("Failed to parse Bedrock response", e);
    }
  }
}
