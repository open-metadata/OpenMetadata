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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AnthropicCompletionClientTest {

  private static final String RESPONSE =
      "{\"content\":[{\"type\":\"text\",\"text\":\"hi\"}],"
          + "\"usage\":{\"input_tokens\":21,\"output_tokens\":4}}";

  @Test
  void parsesTextAndUsage() {
    CompletionResult result = AnthropicCompletionClient.parseResult(RESPONSE);
    assertEquals("hi", result.text());
    assertEquals(21, result.inputTokens());
    assertEquals(4, result.outputTokens());
  }

  @Test
  void requestBodyHonorsOverrides() {
    String body = AnthropicCompletionClient.buildRequestBody("sys", "user", "claude-x", 256, 0.0);
    assertTrue(body.contains("\"model\":\"claude-x\""));
    assertTrue(body.contains("\"max_tokens\":256"));
  }
}
