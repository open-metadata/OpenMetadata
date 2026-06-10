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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.internal.McpChatAppConfig;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class OpenAiLlmClient implements LlmClient {
  private static final String DEFAULT_ENDPOINT = "https://api.openai.com";
  private static final Duration TIMEOUT = Duration.ofSeconds(120);

  private final String apiEndpoint;
  private final String apiKey;
  private final String model;
  private final ObjectMapper mapper;
  private final HttpClient httpClient;

  public OpenAiLlmClient(McpChatAppConfig config) {
    this.apiKey = config.getLlmApiKey();
    if (apiKey == null || apiKey.isBlank()) {
      throw new IllegalArgumentException("An API key is required for the OpenAI LLM provider.");
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
              .uri(URI.create(apiEndpoint + "/v1/chat/completions"))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + apiKey)
              .timeout(TIMEOUT)
              .POST(HttpRequest.BodyPublishers.ofString(json))
              .build();

      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        throw new LlmException(
            "OpenAI API returned status " + response.statusCode() + ": " + response.body());
      }

      return parseResponse(response.body());
    } catch (IOException e) {
      throw new LlmException("Failed to call OpenAI API", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LlmException("OpenAI API call interrupted", e);
    }
  }

  private ObjectNode buildRequestBody(List<LlmMessage> messages, List<Map<String, Object>> tools) {
    ObjectNode body = mapper.createObjectNode();
    body.put("model", model);

    ArrayNode messagesArray = body.putArray("messages");
    for (LlmMessage msg : messages) {
      messagesArray.add(buildMessageNode(msg));
    }

    if (tools != null && !tools.isEmpty()) {
      ArrayNode toolsArray = body.putArray("tools");
      for (Map<String, Object> tool : tools) {
        toolsArray.add(mapper.valueToTree(tool));
      }
    }

    return body;
  }

  private ObjectNode buildMessageNode(LlmMessage msg) {
    ObjectNode node = mapper.createObjectNode();
    node.put("role", msg.role().name());

    if (msg.content() != null) {
      node.put("content", msg.content());
    }

    if (msg.toolCallId() != null) {
      node.put("tool_call_id", msg.toolCallId());
    }

    if (msg.toolCalls() != null && !msg.toolCalls().isEmpty()) {
      ArrayNode toolCallsArray = node.putArray("tool_calls");
      for (LlmToolCall tc : msg.toolCalls()) {
        ObjectNode tcNode = mapper.createObjectNode();
        tcNode.put("id", tc.id());
        tcNode.put("type", "function");
        ObjectNode fnNode = tcNode.putObject("function");
        fnNode.put("name", tc.name());
        fnNode.put("arguments", tc.arguments());
        toolCallsArray.add(tcNode);
      }
    }

    return node;
  }

  @Override
  public LlmResponse sendMessagesStreaming(
      List<LlmMessage> messages, List<Map<String, Object>> tools, Consumer<String> onTextChunk) {
    try {
      ObjectNode requestBody = buildRequestBody(messages, tools);
      requestBody.put("stream", true);
      ObjectNode streamOptions = requestBody.putObject("stream_options");
      streamOptions.put("include_usage", true);

      String json = mapper.writeValueAsString(requestBody);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(apiEndpoint + "/v1/chat/completions"))
              .header("Content-Type", "application/json")
              .header("Authorization", "Bearer " + apiKey)
              .timeout(TIMEOUT)
              .POST(HttpRequest.BodyPublishers.ofString(json))
              .build();

      HttpResponse<InputStream> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

      if (response.statusCode() != 200) {
        throw new LlmException(
            "OpenAI API returned status " + response.statusCode() + ": " + readErrorBody(response));
      }

      return parseStreamingResponse(response.body(), onTextChunk);
    } catch (IOException e) {
      throw new LlmException("Failed to call OpenAI streaming API", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LlmException("OpenAI streaming API call interrupted", e);
    }
  }

  private static String readErrorBody(HttpResponse<InputStream> response) throws IOException {
    try (InputStream errorStream = response.body()) {
      return new String(errorStream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  private LlmResponse parseStreamingResponse(InputStream body, Consumer<String> onTextChunk)
      throws IOException {
    StringBuilder contentBuilder = new StringBuilder();
    Map<Integer, String> toolCallIds = new HashMap<>();
    Map<Integer, String> toolCallNames = new HashMap<>();
    Map<Integer, StringBuilder> toolCallArgs = new HashMap<>();
    int inputTokens = 0;
    int outputTokens = 0;
    String stopReason = null;

    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(body, StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (!line.startsWith("data: ")) {
          continue;
        }
        String data = line.substring(6).trim();
        if ("[DONE]".equals(data)) {
          break;
        }

        JsonNode chunk = mapper.readTree(data);

        if (chunk.has("usage") && !chunk.get("usage").isNull()) {
          JsonNode usage = chunk.get("usage");
          inputTokens = usage.path("prompt_tokens").asInt(0);
          outputTokens = usage.path("completion_tokens").asInt(0);
        }

        JsonNode choices = chunk.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
          continue;
        }

        JsonNode choice = choices.get(0);
        if (choice.has("finish_reason") && !choice.get("finish_reason").isNull()) {
          stopReason = choice.get("finish_reason").asText();
        }

        JsonNode delta = choice.path("delta");

        if (delta.has("content") && !delta.get("content").isNull()) {
          String text = delta.get("content").asText();
          contentBuilder.append(text);
          onTextChunk.accept(text);
        }

        if (delta.has("tool_calls")) {
          for (JsonNode tc : delta.get("tool_calls")) {
            int index = tc.get("index").asInt();
            if (tc.has("id")) {
              toolCallIds.put(index, tc.get("id").asText());
            }
            JsonNode function = tc.path("function");
            if (function.has("name")) {
              toolCallNames.put(index, function.get("name").asText());
            }
            if (function.has("arguments")) {
              toolCallArgs
                  .computeIfAbsent(index, k -> new StringBuilder())
                  .append(function.get("arguments").asText());
            }
          }
        }
      }
    }

    List<LlmToolCall> toolCalls = new ArrayList<>();
    for (Map.Entry<Integer, String> entry : toolCallIds.entrySet()) {
      int idx = entry.getKey();
      toolCalls.add(
          new LlmToolCall(
              entry.getValue(),
              toolCallNames.getOrDefault(idx, ""),
              toolCallArgs.containsKey(idx) ? toolCallArgs.get(idx).toString() : "{}"));
    }

    String content = contentBuilder.length() > 0 ? contentBuilder.toString() : null;
    return new LlmResponse(content, toolCalls, inputTokens, outputTokens, stopReason);
  }

  private LlmResponse parseResponse(String responseBody) throws IOException {
    JsonNode root = mapper.readTree(responseBody);
    JsonNode choice = root.path("choices").path(0);
    JsonNode message = choice.path("message");

    String content =
        message.has("content") && !message.get("content").isNull()
            ? message.get("content").asText()
            : null;

    List<LlmToolCall> toolCalls = new ArrayList<>();
    if (message.has("tool_calls")) {
      for (JsonNode tc : message.get("tool_calls")) {
        JsonNode function = tc.get("function");
        toolCalls.add(
            new LlmToolCall(
                tc.get("id").asText(),
                function.get("name").asText(),
                function.get("arguments").asText()));
      }
    }

    String stopReason = choice.has("finish_reason") ? choice.get("finish_reason").asText() : null;

    JsonNode usage = root.path("usage");
    int inputTokens = usage.path("prompt_tokens").asInt(0);
    int outputTokens = usage.path("completion_tokens").asInt(0);

    return new LlmResponse(content, toolCalls, inputTokens, outputTokens, stopReason);
  }
}
