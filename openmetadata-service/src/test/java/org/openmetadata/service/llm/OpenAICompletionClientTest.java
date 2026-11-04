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
import org.junit.jupiter.api.Test;

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
    assertEquals(256, body.get("max_tokens").asInt());
  }

  @Test
  void requestBodyKeepsTemperatureForModelThatAcceptsIt() throws Exception {
    JsonNode body =
        MAPPER.readTree(
            OpenAICompletionClient.buildRequestBody("sys", "user", "gpt-4o-mini", 256, 0.0));
    assertEquals(0.0, body.get("temperature").asDouble(-1.0));
  }
}
