/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMOpenAIConfig;

class OpenAICompletionClientTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final String RESPONSE =
      "{\"choices\":[{\"message\":{\"content\":\"hello\"}}],"
          + "\"usage\":{\"prompt_tokens\":11,\"completion_tokens\":7,\"total_tokens\":18}}";

  @Test
  void parsesTextAndUsage() {
    CompletionResult result = OpenAICompletionClient.parseResult(RESPONSE);
    assertEquals("hello", result.text());
    assertEquals(11, result.inputTokens());
    assertEquals(7, result.outputTokens());
  }

  @Test
  void requestBodyHonorsOverrides() {
    String body =
        OpenAICompletionClient.buildRequestBody("sys", "user", "override-model", 256, 0.3);
    assertTrue(body.contains("\"model\":\"override-model\""));
    assertTrue(body.contains("\"max_tokens\":256"));
    assertTrue(body.contains("\"temperature\":0.3"));
  }

  @Test
  void requestBodyOmitsTemperatureForModelThatRejectsIt() throws Exception {
    JsonNode body =
        MAPPER.readTree(
            OpenAICompletionClient.buildRequestBody("sys", "user", "o3-mini", 256, 0.0));
    assertFalse(body.has("temperature"));
    assertFalse(body.has("max_tokens"));
    assertEquals(256, body.get("max_completion_tokens").asInt());
  }

  @Test
  void requestBodyKeepsTemperatureForModelThatAcceptsIt() throws Exception {
    JsonNode body =
        MAPPER.readTree(
            OpenAICompletionClient.buildRequestBody("sys", "user", "gpt-4o-mini", 256, 0.0));
    assertEquals(0.0, body.get("temperature").asDouble(-1.0));
    assertEquals(256, body.get("max_tokens").asInt());
    assertFalse(body.has("max_completion_tokens"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "o1",
        "o1-mini",
        "o3",
        "o3-mini",
        "o4-mini",
        "gpt-5",
        "gpt-5-mini",
        "gpt-5.6",
        "gpt-6"
      })
  void requestBodySendsMaxCompletionTokensForOSeriesAndGpt5Plus(String model) throws Exception {
    JsonNode body =
        MAPPER.readTree(OpenAICompletionClient.buildRequestBody("sys", "user", model, 512, 0.2));
    assertEquals(512, body.get("max_completion_tokens").asInt());
    assertFalse(body.has("max_tokens"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4-turbo", "gpt-3.5-turbo"})
  void requestBodySendsMaxTokensForLegacyModels(String model) throws Exception {
    JsonNode body =
        MAPPER.readTree(OpenAICompletionClient.buildRequestBody("sys", "user", model, 512, 0.2));
    assertEquals(512, body.get("max_tokens").asInt());
    assertFalse(body.has("max_completion_tokens"));
  }

  @Test
  void completeSendsMaxCompletionTokensOverHttpForGpt5AndMaxTokensForGpt4o() throws Exception {
    AtomicReference<String> capturedBody = new AtomicReference<>();
    HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
    server.createContext(
        "/v1/chat/completions",
        exchange -> {
          String requestBody =
              new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
          capturedBody.set(requestBody);
          JsonNode parsed = MAPPER.readTree(requestBody);
          String model = parsed.path("model").asText();
          boolean requiresCompletionTokens = model.startsWith("gpt-5") || model.startsWith("o3");
          byte[] responseBytes;
          int status;
          if (requiresCompletionTokens && parsed.has("max_tokens")) {
            status = 400;
            responseBytes =
                "{\"error\":{\"message\":\"Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.\"}}"
                    .getBytes(StandardCharsets.UTF_8);
          } else {
            status = 200;
            responseBytes = RESPONSE.getBytes(StandardCharsets.UTF_8);
          }
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, responseBytes.length);
          exchange.getResponseBody().write(responseBytes);
          exchange.close();
        });
    server.start();
    try {
      String endpoint = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1";

      LLMConfiguration gpt5Config =
          new LLMConfiguration()
              .withOpenai(
                  new LLMOpenAIConfig()
                      .withApiKey("test-key")
                      .withModelId("gpt-5.6")
                      .withMaxTokens(300)
                      .withEndpoint(endpoint));
      CompletionResult gpt5Result = new OpenAICompletionClient(gpt5Config).complete("sys", "user");
      assertEquals("hello", gpt5Result.text());
      JsonNode gpt5Sent = MAPPER.readTree(capturedBody.get());
      assertEquals(300, gpt5Sent.get("max_completion_tokens").asInt());
      assertFalse(gpt5Sent.has("max_tokens"));
      assertFalse(gpt5Sent.has("temperature"));

      LLMConfiguration gpt4oConfig =
          new LLMConfiguration()
              .withOpenai(
                  new LLMOpenAIConfig()
                      .withApiKey("test-key")
                      .withModelId("gpt-4o-mini")
                      .withMaxTokens(300)
                      .withEndpoint(endpoint));
      CompletionResult gpt4oResult =
          new OpenAICompletionClient(gpt4oConfig).complete("sys", "user");
      assertEquals("hello", gpt4oResult.text());
      JsonNode gpt4oSent = MAPPER.readTree(capturedBody.get());
      assertEquals(300, gpt4oSent.get("max_tokens").asInt());
      assertFalse(gpt4oSent.has("max_completion_tokens"));
    } finally {
      server.stop(0);
    }
  }
}
