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
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.internal.McpChatAppConfig;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class AnthropicLlmClient implements LlmClient {
  private static final String DEFAULT_ENDPOINT = "https://api.anthropic.com";
  private static final String ANTHROPIC_VERSION = "2023-06-01";
  private static final int MAX_TOKENS = 4096;
  private static final Duration TIMEOUT = Duration.ofSeconds(120);

  private final String apiEndpoint;
  private final String apiKey;
  private final String model;
  private final ObjectMapper mapper;
  private final HttpClient httpClient;

  public AnthropicLlmClient(McpChatAppConfig config) {
    this.apiKey = config.getLlmApiKey();
    if (apiKey == null || apiKey.isBlank()) {
      throw new IllegalArgumentException("An API key is required for the Anthropic LLM provider.");
    }
    this.model = config.getLlmModel();
    this.apiEndpoint =
        config.getLlmApiEndpoint() != null && !config.getLlmApiEndpoint().isBlank()
            ? config.getLlmApiEndpoint()
            : DEFAULT_ENDPOINT;
    this.mapper = JsonUtils.getObjectMapper();
    this.httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
  }

  @Override
  public LlmResponse sendMessages(List<LlmMessage> messages, List<Map<String, Object>> tools) {
    try {
      ObjectNode requestBody = buildRequestBody(messages, tools);
      String json = mapper.writeValueAsString(requestBody);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(apiEndpoint + "/v1/messages"))
              .header("Content-Type", "application/json")
              .header("x-api-key", apiKey)
              .header("anthropic-version", ANTHROPIC_VERSION)
              .timeout(TIMEOUT)
              .POST(HttpRequest.BodyPublishers.ofString(json))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        throw new LlmException(
            "Anthropic API returned status " + response.statusCode() + ": " + response.body());
      }

      return parseResponse(response.body());
    } catch (IOException e) {
      throw new LlmException("Failed to call Anthropic API", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LlmException("Anthropic API call interrupted", e);
    }
  }

  private ObjectNode buildRequestBody(List<LlmMessage> messages, List<Map<String, Object>> tools) {
    ObjectNode body = mapper.createObjectNode();
    body.put("model", model);
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

  @Override
  public LlmResponse sendMessagesStreaming(
      List<LlmMessage> messages, List<Map<String, Object>> tools, Consumer<String> onTextChunk) {
    try {
      ObjectNode requestBody = buildRequestBody(messages, tools);
      requestBody.put("stream", true);

      String json = mapper.writeValueAsString(requestBody);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(apiEndpoint + "/v1/messages"))
              .header("Content-Type", "application/json")
              .header("x-api-key", apiKey)
              .header("anthropic-version", ANTHROPIC_VERSION)
              .timeout(TIMEOUT)
              .POST(HttpRequest.BodyPublishers.ofString(json))
              .build();

      HttpResponse<InputStream> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

      if (response.statusCode() != 200) {
        throw new LlmException(
            "Anthropic API returned status "
                + response.statusCode()
                + ": "
                + readErrorBody(response));
      }

      return parseStreamingResponse(response.body(), onTextChunk);
    } catch (IOException e) {
      throw new LlmException("Failed to call Anthropic streaming API", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LlmException("Anthropic streaming API call interrupted", e);
    }
  }

  private static String readErrorBody(HttpResponse<InputStream> response) throws IOException {
    try (InputStream errorStream = response.body()) {
      return new String(errorStream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  private LlmResponse parseStreamingResponse(InputStream body, Consumer<String> onTextChunk)
      throws IOException {
    StringBuilder textContent = new StringBuilder();
    List<LlmToolCall> toolCalls = new ArrayList<>();
    int inputTokens = 0;
    int outputTokens = 0;
    String stopReason = null;

    String currentToolId = null;
    String currentToolName = null;
    StringBuilder currentToolArgs = new StringBuilder();

    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(body, StandardCharsets.UTF_8))) {
      String line;
      String currentEvent = null;

      while ((line = reader.readLine()) != null) {
        if (line.startsWith("event: ")) {
          currentEvent = line.substring(7).trim();
          continue;
        }
        if (!line.startsWith("data: ")) {
          continue;
        }
        String data = line.substring(6).trim();
        if (data.isEmpty()) {
          continue;
        }

        JsonNode chunk = mapper.readTree(data);

        if (currentEvent == null) {
          continue;
        }

        switch (currentEvent) {
          case "message_start" -> {
            JsonNode usage = chunk.path("message").path("usage");
            inputTokens = usage.path("input_tokens").asInt(0);
          }
          case "content_block_start" -> {
            JsonNode contentBlock = chunk.path("content_block");
            if ("tool_use".equals(contentBlock.path("type").asText())) {
              currentToolId = contentBlock.path("id").asText();
              currentToolName = contentBlock.path("name").asText();
              currentToolArgs = new StringBuilder();
            }
          }
          case "content_block_delta" -> {
            JsonNode delta = chunk.path("delta");
            String deltaType = delta.path("type").asText();
            if ("text_delta".equals(deltaType)) {
              String text = delta.path("text").asText();
              textContent.append(text);
              onTextChunk.accept(text);
            } else if ("input_json_delta".equals(deltaType)) {
              currentToolArgs.append(delta.path("partial_json").asText());
            }
          }
          case "content_block_stop" -> {
            if (currentToolId != null) {
              toolCalls.add(
                  new LlmToolCall(currentToolId, currentToolName, currentToolArgs.toString()));
              currentToolId = null;
              currentToolName = null;
              currentToolArgs = new StringBuilder();
            }
          }
          case "message_delta" -> {
            JsonNode delta = chunk.path("delta");
            if (delta.has("stop_reason") && !delta.get("stop_reason").isNull()) {
              stopReason = delta.get("stop_reason").asText();
            }
            outputTokens = chunk.path("usage").path("output_tokens").asInt(0);
          }
          default -> {}
        }
      }
    }

    String content = textContent.length() > 0 ? textContent.toString() : null;
    return new LlmResponse(content, toolCalls, inputTokens, outputTokens, stopReason);
  }

  private LlmResponse parseResponse(String responseBody) throws IOException {
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
  }
}
